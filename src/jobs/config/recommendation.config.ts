export interface RecommendationConfig {
  popularity: {
    maxApplications: number;
    maxViews: number;
    maxSaves: number;
    weights: {
      applicationScore: number;
      viewScore: number;
      saveScore: number;
    };
  };
  scoring: {
    weights: {
      skillMatch: number;
      experienceMatch: number;
      locationMatch: number;
      budgetMatch: number;
      userBehavior: number;
      jobPopularity: number;
    };
  };
  limits: {
    defaultRecommendationLimit: number;
    maxRecommendationLimit: number;
    defaultBudgetMax: number;
    maxBudgetLimit: number;
  };
  behavior: {
    baseBehaviorScore: number;
    applicationBonus: number;
    saveBonus: number;
    viewBonus: number;
  };
}

export const recommendationConfig: RecommendationConfig = {
  popularity: {
    maxApplications: parseInt(
      process.env.RECOMMENDATION_MAX_APPLICATIONS || '100',
      10,
    ),
    maxViews: parseInt(process.env.RECOMMENDATION_MAX_VIEWS || '1000', 10),
    maxSaves: parseInt(process.env.RECOMMENDATION_MAX_SAVES || '50', 10),
    weights: {
      applicationScore: parseFloat(
        process.env.RECOMMENDATION_APPLICATION_WEIGHT || '0.4',
      ),
      viewScore: parseFloat(process.env.RECOMMENDATION_VIEW_WEIGHT || '0.3'),
      saveScore: parseFloat(process.env.RECOMMENDATION_SAVE_WEIGHT || '0.3'),
    },
  },
  scoring: {
    weights: {
      skillMatch: parseFloat(process.env.RECOMMENDATION_SKILL_WEIGHT || '0.25'),
      experienceMatch: parseFloat(
        process.env.RECOMMENDATION_EXPERIENCE_WEIGHT || '0.20',
      ),
      locationMatch: parseFloat(
        process.env.RECOMMENDATION_LOCATION_WEIGHT || '0.15',
      ),
      budgetMatch: parseFloat(
        process.env.RECOMMENDATION_BUDGET_WEIGHT || '0.15',
      ),
      userBehavior: parseFloat(
        process.env.RECOMMENDATION_BEHAVIOR_WEIGHT || '0.15',
      ),
      jobPopularity: parseFloat(
        process.env.RECOMMENDATION_POPULARITY_WEIGHT || '0.10',
      ),
    },
  },
  limits: {
    defaultRecommendationLimit: parseInt(
      process.env.RECOMMENDATION_DEFAULT_LIMIT || '20',
      10,
    ),
    maxRecommendationLimit: parseInt(
      process.env.RECOMMENDATION_MAX_LIMIT || '100',
      10,
    ),
    defaultBudgetMax: parseInt(
      process.env.RECOMMENDATION_DEFAULT_BUDGET_MAX || '10000',
      10,
    ),
    maxBudgetLimit: parseInt(
      process.env.RECOMMENDATION_MAX_BUDGET_LIMIT || '1000000',
      10,
    ),
  },
  behavior: {
    baseBehaviorScore: parseFloat(
      process.env.RECOMMENDATION_BASE_BEHAVIOR_SCORE || '0.5',
    ),
    applicationBonus: parseFloat(
      process.env.RECOMMENDATION_APPLICATION_BONUS || '0.3',
    ),
    saveBonus: parseFloat(process.env.RECOMMENDATION_SAVE_BONUS || '0.2'),
    viewBonus: parseFloat(process.env.RECOMMENDATION_VIEW_BONUS || '0.1'),
  },
};

// Validation function to ensure config values are within expected ranges
export function validateRecommendationConfig(
  config: RecommendationConfig,
): void {
  const errors: string[] = [];

  // Validate popularity weights sum to 1
  const popularityWeightSum =
    config.popularity.weights.applicationScore +
    config.popularity.weights.viewScore +
    config.popularity.weights.saveScore;

  if (Math.abs(popularityWeightSum - 1.0) > 0.01) {
    errors.push(
      `Popularity weights must sum to 1.0, got ${popularityWeightSum}`,
    );
  }

  // Validate scoring weights sum to 1
  const scoringWeightSum = Object.values(config.scoring.weights).reduce(
    (sum, weight) => sum + weight,
    0,
  );
  if (Math.abs(scoringWeightSum - 1.0) > 0.01) {
    errors.push(`Scoring weights must sum to 1.0, got ${scoringWeightSum}`);
  }

  // Validate limits
  if (
    config.limits.defaultRecommendationLimit >
    config.limits.maxRecommendationLimit
  ) {
    errors.push(
      'Default recommendation limit cannot be greater than max limit',
    );
  }

  if (config.limits.defaultBudgetMax > config.limits.maxBudgetLimit) {
    errors.push('Default budget max cannot be greater than max budget limit');
  }

  // Validate behavior scores are within 0-1 range
  if (
    config.behavior.baseBehaviorScore < 0 ||
    config.behavior.baseBehaviorScore > 1
  ) {
    errors.push('Base behavior score must be between 0 and 1');
  }

  if (
    config.behavior.applicationBonus < 0 ||
    config.behavior.applicationBonus > 1
  ) {
    errors.push('Application bonus must be between 0 and 1');
  }

  if (config.behavior.saveBonus < 0 || config.behavior.saveBonus > 1) {
    errors.push('Save bonus must be between 0 and 1');
  }

  if (config.behavior.viewBonus < 0 || config.behavior.viewBonus > 1) {
    errors.push('View bonus must be between 0 and 1');
  }

  if (errors.length > 0) {
    throw new Error(
      `Invalid recommendation configuration: ${errors.join(', ')}`,
    );
  }
}

// Validate config on module load
validateRecommendationConfig(recommendationConfig);
