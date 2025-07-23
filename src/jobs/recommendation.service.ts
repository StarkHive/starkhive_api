import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Recommendation } from './entities/recommendation.entity';
import { Job } from './entities/job.entity';
import { User } from 'src/auth/entities/user.entity';
import { Application } from 'src/applications/entities/application.entity';
import { SavedJob } from './entities/saved-job.entity';
import { JobStatus } from 'src/feed/enums/job-status.enum';
import {
  GetRecommendationsDto,
  UpdateRecommendationActionDto,
  UserPreferencesDto,
  RecommendationResponseDto,
  RecommendationMetricsDto,
  ScoringFactorsDto,
  JobSummaryDto,
} from './dto/recommendation.dto';
import { recommendationConfig } from './config/recommendation.config';

@Injectable()
export class RecommendationService {
  constructor(
    @InjectRepository(Recommendation)
    private readonly recommendationRepository: Repository<Recommendation>,
    @InjectRepository(Job)
    private readonly jobRepository: Repository<Job>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Application)
    private readonly applicationRepository: Repository<Application>,
    @InjectRepository(SavedJob)
    private readonly savedJobRepository: Repository<SavedJob>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Generate personalized job recommendations for a user
   */
  async generateRecommendations(
    userId: string,
    options: GetRecommendationsDto = {},
  ): Promise<RecommendationResponseDto[]> {
    const { limit = 20, offset = 0, preferences } = options;

    // Get user preferences (either from request or stored)
    const userPreferences = preferences || this.getUserPreferences();

    // Get available jobs (filtered by user preferences)
    let availableJobs = await this.getAvailableJobs();

    // Filter jobs by user preferences (skills, location, experience, budget, job type)
    availableJobs = availableJobs.filter((job) => {
      // Skills filter
      if (userPreferences.skills && userPreferences.skills.length > 0) {
        const jobSkills = this.extractSkillsFromJob(job);
        const hasSkillMatch = userPreferences.skills.some((skill) =>
          jobSkills.includes(skill.toLowerCase()),
        );
        if (!hasSkillMatch) return false;
      }
      // Location filter
      if (userPreferences.location && userPreferences.location.trim() !== '') {
        const jobLocation = this.extractLocation();
        if (
          !jobLocation
            .toLowerCase()
            .includes(userPreferences.location.toLowerCase()) &&
          !(
            userPreferences.location.toLowerCase().includes('remote') &&
            job.isRemote
          )
        ) {
          return false;
        }
      }
      // Experience filter
      if (userPreferences.experienceLevel) {
        const jobLevel = this.extractExperienceLevel(job);
        if (jobLevel !== userPreferences.experienceLevel.toLowerCase()) {
          return false;
        }
      }
      // Budget filter
      if (userPreferences.budgetRange && job.budget) {
        if (
          job.budget < userPreferences.budgetRange.min ||
          job.budget > userPreferences.budgetRange.max
        ) {
          return false;
        }
      }
      // Job type filter (if job type exists on job)
      if (
        userPreferences.jobTypes &&
        userPreferences.jobTypes.length > 0 &&
        job.jobType
      ) {
        if (!userPreferences.jobTypes.includes(job.jobType)) {
          return false;
        }
      }
      return true;
    });

    // Apply pagination/batch processing to limit jobs processed
    const jobsToProcess = availableJobs.slice(offset, offset + limit);

    // Generate recommendations for each job in the batch
    const recommendations: Recommendation[] = [];
    for (const job of jobsToProcess) {
      const existingRecommendation =
        await this.recommendationRepository.findOne({
          where: { userId, jobId: job.id },
        });

      if (existingRecommendation) {
        // Update existing recommendation with new scoring
        await this.updateRecommendationScore(
          existingRecommendation,
          job,
          userPreferences,
        );
        recommendations.push(existingRecommendation);
      } else {
        // Create new recommendation
        const recommendation = await this.createRecommendation(
          userId,
          job,
          userPreferences,
        );
        recommendations.push(recommendation);
      }
    }

    // Sort and return recommendations
    const sortedRecommendations = this.sortRecommendations(
      recommendations,
      options,
    );
    // No need to slice again, already paginated
    return this.formatRecommendationResponses(sortedRecommendations);
  }

  /**
   * Create a new recommendation with AI-powered scoring
   */
  async createRecommendation(
    userId: string,
    job: Job,
    userPreferences: UserPreferencesDto,
  ): Promise<Recommendation> {
    const scoringFactors = await this.calculateScoringFactors(
      job,
      userPreferences,
      userId,
    );
    const totalScore = this.calculateTotalScore(scoringFactors);

    const recommendation = this.recommendationRepository.create({
      userId,
      jobId: job.id,
      score: totalScore,
      scoringFactors,
      userPreferences,
      impressionCount: 1,
    });

    return this.recommendationRepository.save(recommendation);
  }

  /**
   * Update recommendation score based on new data
   */
  async updateRecommendationScore(
    recommendation: Recommendation,
    job: Job,
    userPreferences: UserPreferencesDto,
  ): Promise<void> {
    const scoringFactors = await this.calculateScoringFactors(
      job,
      userPreferences,
      recommendation.userId,
    );
    const totalScore = this.calculateTotalScore(scoringFactors);

    recommendation.score = totalScore;
    recommendation.scoringFactors = scoringFactors;
    recommendation.userPreferences = userPreferences;

    await this.recommendationRepository.save(recommendation);
  }

  /**
   * Calculate scoring factors using ML algorithms
   */
  private async calculateScoringFactors(
    job: Job,
    userPreferences: UserPreferencesDto,
    userId: string,
  ): Promise<Recommendation['scoringFactors']> {
    const [
      skillMatch,
      experienceMatch,
      locationMatch,
      budgetMatch,
      userBehavior,
      jobPopularity,
    ] = await Promise.all([
      this.calculateSkillMatch(job, userPreferences),
      this.calculateExperienceMatch(job, userPreferences),
      this.calculateLocationMatch(job, userPreferences),
      this.calculateBudgetMatch(job, userPreferences),
      this.calculateUserBehaviorScore(userId, job),
      this.calculateJobPopularity(job),
    ]);

    return {
      skillMatch,
      experienceMatch,
      locationMatch,
      budgetMatch,
      userBehavior,
      jobPopularity,
    };
  }

  /**
   * Calculate skill match score using TF-IDF and cosine similarity
   */
  private calculateSkillMatch(
    job: Job,
    userPreferences: UserPreferencesDto,
  ): number {
    if (!userPreferences.skills || userPreferences.skills.length === 0) {
      return 0.5; // Default score if no skills provided
    }

    const jobSkills = this.extractSkillsFromJob(job);
    const userSkills = userPreferences.skills.map((skill) =>
      skill.toLowerCase(),
    );

    // Calculate intersection
    const matchingSkills = jobSkills.filter((skill) =>
      userSkills.some(
        (userSkill) => skill.includes(userSkill) || userSkill.includes(skill),
      ),
    );

    // Calculate Jaccard similarity
    const intersection = new Set(matchingSkills).size;
    const union = new Set([...jobSkills, ...userSkills]).size;

    return union > 0 ? intersection / union : 0;
  }

  /**
   * Calculate experience level match
   */
  private calculateExperienceMatch(
    job: Job,
    userPreferences: UserPreferencesDto,
  ): number {
    if (!userPreferences.experienceLevel) {
      return 0.5;
    }

    const experienceLevels = [
      'entry',
      'junior',
      'mid',
      'senior',
      'lead',
      'executive',
    ];
    const jobLevel = this.extractExperienceLevel(job);
    const userLevel = userPreferences.experienceLevel.toLowerCase();

    const jobIndex = experienceLevels.indexOf(jobLevel);
    const userIndex = experienceLevels.indexOf(userLevel);

    if (jobIndex === -1 || userIndex === -1) {
      return 0.5;
    }

    // Calculate distance-based similarity
    const distance = Math.abs(jobIndex - userIndex);
    const maxDistance = experienceLevels.length - 1;

    return 1 - distance / maxDistance;
  }

  /**
   * Calculate location match score
   */
  private calculateLocationMatch(
    job: Job,
    userPreferences: UserPreferencesDto,
  ): number {
    if (!userPreferences.location) {
      return 0.5;
    }

    const jobLocation = this.extractLocation();
    const userLocation = userPreferences.location.toLowerCase();

    // Simple string similarity for now
    if (
      jobLocation.includes(userLocation) ||
      userLocation.includes(jobLocation)
    ) {
      return 1.0;
    }

    // Check for remote work preference
    if (
      userPreferences.location.toLowerCase().includes('remote') &&
      job.isRemote
    ) {
      return 0.9;
    }

    return 0.1;
  }

  /**
   * Calculate budget match score
   */
  private calculateBudgetMatch(
    job: Job,
    userPreferences: UserPreferencesDto,
  ): number {
    if (!userPreferences.budgetRange || !job.budget) {
      return 0.5;
    }

    const { min, max } = userPreferences.budgetRange;
    const jobBudget = job.budget;

    if (jobBudget >= min && jobBudget <= max) {
      return 1.0;
    }

    // Calculate distance from preferred range
    const distance = Math.min(
      Math.abs(jobBudget - min),
      Math.abs(jobBudget - max),
    );
    const rangeSize = max - min;

    return Math.max(0, 1 - distance / rangeSize);
  }

  /**
   * Calculate user behavior score based on historical data
   */
  private async calculateUserBehaviorScore(
    userId: string,
    job: Job,
  ): Promise<number> {
    const [applicationHistory, savedJobs, viewHistory] = await Promise.all([
      this.getUserApplicationHistory(userId),
      this.getUserSavedJobs(userId),
      this.getUserViewHistory(),
    ]);

    let behaviorScore = 0.5; // Base score

    // Analyze application patterns
    const similarAppliedJobs = applicationHistory.filter((app) =>
      this.jobsAreSimilar(app.job, job),
    );
    if (similarAppliedJobs.length > 0) {
      behaviorScore += 0.3;
    }

    // Analyze saved job patterns
    const similarSavedJobs = savedJobs.filter((savedJob) =>
      this.jobsAreSimilar(savedJob.job, job),
    );
    if (similarSavedJobs.length > 0) {
      behaviorScore += 0.2;
    }

    // Analyze view patterns
    const similarViewedJobs = viewHistory.filter((viewedJob) =>
      this.jobsAreSimilar(viewedJob, job),
    );
    if (similarViewedJobs.length > 0) {
      behaviorScore += 0.1;
    }

    return Math.min(1.0, behaviorScore);
  }

  /**
   * Calculate job popularity score
   */
  private async calculateJobPopularity(job: Job): Promise<number> {
    const [applicationCount, viewCount, saveCount] = await Promise.all([
      this.getJobApplicationCount(job.id),
      this.getJobViewCount(),
      this.getJobSaveCount(job.id),
    ]);

    // Normalize popularity metrics using config
    const maxApplications = recommendationConfig.popularity.maxApplications;
    const maxViews = recommendationConfig.popularity.maxViews;
    const maxSaves = recommendationConfig.popularity.maxSaves;
    const weights = recommendationConfig.popularity.weights;

    const applicationScore = Math.min(1.0, applicationCount / maxApplications);
    const viewScore = Math.min(1.0, viewCount / maxViews);
    const saveScore = Math.min(1.0, saveCount / maxSaves);

    // Weighted average
    return (
      applicationScore * weights.applicationScore +
      viewScore * weights.viewScore +
      saveScore * weights.saveScore
    );
  }

  /**
   * Calculate total recommendation score
   */
  private calculateTotalScore(
    scoringFactors: Recommendation['scoringFactors'],
  ): number {
    const weights = {
      skillMatch: 0.25,
      experienceMatch: 0.2,
      locationMatch: 0.15,
      budgetMatch: 0.15,
      userBehavior: 0.15,
      jobPopularity: 0.1,
    };

    return Object.entries(scoringFactors).reduce((total, [factor, score]) => {
      return total + score * weights[factor as keyof typeof weights];
    }, 0);
  }

  /**
   * Update recommendation action (view, apply, save, dismiss)
   */
  async updateRecommendationAction(
    recommendationId: string,
    action: UpdateRecommendationActionDto,
    userId: string,
  ): Promise<void> {
    const recommendation = await this.recommendationRepository.findOne({
      where: { id: recommendationId },
    });

    if (!recommendation) {
      throw new NotFoundException('Recommendation not found');
    }

    // Security check: ensure user can only update their own recommendations
    if (recommendation.userId !== userId) {
      throw new UnauthorizedException(
        'You can only update your own recommendations',
      );
    }

    const now = new Date();
    const { action: actionType, value = true } = action;

    switch (actionType) {
      case 'view':
        recommendation.isViewed = value;
        if (value) recommendation.viewedAt = now;
        break;
      case 'apply':
        recommendation.isApplied = value;
        if (value) recommendation.appliedAt = now;
        break;
      case 'save':
        recommendation.isSaved = value;
        if (value) recommendation.savedAt = now;
        break;
      case 'dismiss':
        recommendation.isDismissed = value;
        if (value) recommendation.dismissedAt = now;
        break;
    }

    recommendation.updateMetrics();
    await this.recommendationRepository.save(recommendation);
  }

  /**
   * Get recommendation metrics for analytics
   */
  async getRecommendationMetrics(
    userId: string,
  ): Promise<RecommendationMetricsDto> {
    const recommendations = await this.recommendationRepository.find({
      where: { userId },
      relations: ['job'],
    });

    if (recommendations.length === 0) {
      return {
        totalRecommendations: 0,
        averageScore: 0,
        clickThroughRate: 0,
        applicationRate: 0,
        topSkills: [],
        topJobTypes: [],
        recommendationsByScore: [],
      };
    }

    const totalRecommendations = recommendations.length;
    const averageScore =
      recommendations.reduce((sum, rec) => sum + rec.score, 0) /
      totalRecommendations;

    const viewedRecommendations = recommendations.filter((rec) => rec.isViewed);
    const appliedRecommendations = recommendations.filter(
      (rec) => rec.isApplied,
    );

    const clickThroughRate =
      viewedRecommendations.length / totalRecommendations;
    const applicationRate =
      appliedRecommendations.length / totalRecommendations;

    // Analyze top skills and job types
    const skillCounts = this.analyzeSkills(recommendations);
    const jobTypeCounts = this.analyzeJobTypes(recommendations);
    const scoreRanges = this.analyzeScoreRanges(recommendations);

    return {
      totalRecommendations,
      averageScore,
      clickThroughRate,
      applicationRate,
      topSkills: skillCounts.slice(0, 10),
      topJobTypes: jobTypeCounts.slice(0, 5),
      recommendationsByScore: scoreRanges,
    };
  }

  // Helper methods
  private getUserPreferences(): UserPreferencesDto {
    return {
      skills: [],
      experienceLevel: 'mid',
      location: '',
      budgetRange: { min: 0, max: 10000 },
      jobTypes: [],
    };
  }

  private async getAvailableJobs(): Promise<Job[]> {
    return this.jobRepository.find({
      where: {
        status: JobStatus.OPEN,
        isAcceptingApplications: true,
      },
      order: { createdAt: 'DESC' },
    });
  }

  private extractSkillsFromJob(job: Job): string[] {
    // Extract skills from job description and title
    const text = `${job.title} ${job.description}`.toLowerCase();
    const commonSkills = [
      'javascript',
      'python',
      'java',
      'react',
      'node.js',
      'angular',
      'vue',
      'php',
      'ruby',
      'go',
      'rust',
      'c++',
      'c#',
      'swift',
      'kotlin',
      'html',
      'css',
      'sql',
      'mongodb',
      'postgresql',
      'mysql',
      'redis',
      'docker',
      'kubernetes',
      'aws',
      'azure',
      'gcp',
      'git',
      'jenkins',
      'figma',
      'adobe',
      'photoshop',
      'illustrator',
      'sketch',
      'wordpress',
      'shopify',
      'woocommerce',
      'magento',
    ];

    return commonSkills.filter((skill) => text.includes(skill));
  }

  private extractExperienceLevel(job: Job): string {
    const text = `${job.title} ${job.description}`.toLowerCase();
    const levels = ['entry', 'junior', 'mid', 'senior', 'lead', 'executive'];

    for (const level of levels) {
      if (text.includes(level)) {
        return level;
      }
    }

    return 'mid'; // Default
  }

  private extractLocation(): string {
    // This would need to be implemented based on your job entity structure
    return '';
  }

  private async getUserApplicationHistory(
    userId: string,
  ): Promise<Application[]> {
    return this.applicationRepository.find({
      where: { freelancerId: userId },
      relations: ['job'],
    });
  }

  private async getUserSavedJobs(userId: string): Promise<SavedJob[]> {
    return this.savedJobRepository.find({
      where: { user: { id: userId } },
      relations: ['job'],
    });
  }

  private getUserViewHistory(): Job[] {
    // This would need to be implemented based on your view tracking
    return [];
  }

  private jobsAreSimilar(job1: Job, job2: Job): boolean {
    const skills1 = this.extractSkillsFromJob(job1);
    const skills2 = this.extractSkillsFromJob(job2);

    const commonSkills = skills1.filter((skill) => skills2.includes(skill));
    return commonSkills.length > 0;
  }

  private async getJobApplicationCount(jobId: number): Promise<number> {
    return this.applicationRepository.count({ where: { jobId } });
  }

  private getJobViewCount(): number {
    // This would need to be implemented based on your view tracking
    return 0;
  }

  private async getJobSaveCount(jobId: number): Promise<number> {
    return this.savedJobRepository.count({ where: { job: { id: jobId } } });
  }

  private sortRecommendations(
    recommendations: Recommendation[],
    options: GetRecommendationsDto,
  ): Recommendation[] {
    const { sortBy = 'score', sortOrder = 'desc' } = options;

    return recommendations.sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'score':
          comparison = a.score - b.score;
          break;
        case 'createdAt':
          comparison = a.createdAt.getTime() - b.createdAt.getTime();
          break;
        case 'popularity':
          comparison =
            (a.scoringFactors?.jobPopularity || 0) -
            (b.scoringFactors?.jobPopularity || 0);
          break;
      }

      return sortOrder === 'desc' ? -comparison : comparison;
    });
  }

  private async formatRecommendationResponses(
    recommendations: Recommendation[],
  ): Promise<RecommendationResponseDto[]> {
    const recommendationsWithJobs = await Promise.all(
      recommendations.map(async (rec) => {
        const job = await this.jobRepository.findOne({
          where: { id: rec.jobId },
        });
        return { recommendation: rec, job };
      }),
    );

    return recommendationsWithJobs
      .filter(({ job }) => job !== null)
      .map(({ recommendation, job }) => {
        // Create properly typed objects for validation
        const scoringFactors: ScoringFactorsDto = {
          skillMatch: recommendation.scoringFactors?.skillMatch || 0,
          experienceMatch: recommendation.scoringFactors?.experienceMatch || 0,
          locationMatch: recommendation.scoringFactors?.locationMatch || 0,
          budgetMatch: recommendation.scoringFactors?.budgetMatch || 0,
          userBehavior: recommendation.scoringFactors?.userBehavior || 0,
          jobPopularity: recommendation.scoringFactors?.jobPopularity || 0,
        };

        const jobSummary: JobSummaryDto = {
          id: job?.id || 0,
          title: job?.title || 'Unknown Job',
          description: job?.description || 'No description available',
          budget: job?.budget || 0,
          deadline: job?.deadline || undefined,
          status: job?.status || 'OPEN',
          createdAt: job?.createdAt ? new Date(job.createdAt) : new Date(),
        };

        return {
          id: recommendation.id,
          jobId: recommendation.jobId,
          score: recommendation.score,
          scoringFactors,
          job: jobSummary,
          isViewed: recommendation.isViewed,
          isApplied: recommendation.isApplied,
          isSaved: recommendation.isSaved,
          isDismissed: recommendation.isDismissed,
          clickThroughRate: recommendation.clickThroughRate || 0,
          applicationRate: recommendation.applicationRate || 0,
          createdAt: recommendation.createdAt,
        } as RecommendationResponseDto;
      });
  }

  private analyzeSkills(
    recommendations: Recommendation[],
  ): Array<{ skill: string; count: number }> {
    const skillCounts: { [key: string]: number } = {};

    recommendations.forEach((rec) => {
      const skills = rec.userPreferences?.skills || [];
      skills.forEach((skill) => {
        skillCounts[skill] = (skillCounts[skill] || 0) + 1;
      });
    });

    return Object.entries(skillCounts)
      .map(([skill, count]) => ({ skill, count }))
      .sort((a, b) => b.count - a.count);
  }

  private analyzeJobTypes(
    recommendations: Recommendation[],
  ): Array<{ type: string; count: number }> {
    const typeCounts: { [key: string]: number } = {};

    recommendations.forEach((rec) => {
      const types = rec.userPreferences?.jobTypes || [];
      types.forEach((type) => {
        typeCounts[type] = (typeCounts[type] || 0) + 1;
      });
    });

    return Object.entries(typeCounts)
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count);
  }

  private analyzeScoreRanges(
    recommendations: Recommendation[],
  ): Array<{ scoreRange: string; count: number }> {
    const ranges = [
      { min: 0, max: 0.2, label: '0.0-0.2' },
      { min: 0.2, max: 0.4, label: '0.2-0.4' },
      { min: 0.4, max: 0.6, label: '0.4-0.6' },
      { min: 0.6, max: 0.8, label: '0.6-0.8' },
      { min: 0.8, max: 1.0, label: '0.8-1.0' },
    ];

    return ranges.map((range) => ({
      scoreRange: range.label,
      count: recommendations.filter(
        (rec) => rec.score >= range.min && rec.score < range.max,
      ).length,
    }));
  }
}
