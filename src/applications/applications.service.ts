import { NotificationsService, NotificationPayload } from '../notifications/notifications.service';
import { Injectable, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Application } from './entities/application.entity';
import { Job } from 'src/jobs/entities/job.entity';
import { UpdateStatusDto } from './dto/update-status.dto';

@Injectable()
export class ApplicationsService {
  constructor(
    @InjectRepository(Application)
    private readonly applicationRepository: Repository<Application>,
    private readonly notificationsService: NotificationsService,

    @InjectRepository(Job) 
    private jobRepository: Repository<Job>,
  ) {}

  /**
   * Processes a job application and sends notification to the recruiter
   * Prevents duplicate applications (one per job per freelancer)
   * @param jobId The ID of the job being applied for
   * @param freelancerId The ID of the freelancer applying
   * @param recruiterId The ID of the recruiter to notify
   * @param coverLetter The cover letter/message
   * @returns The created application
   * @throws ConflictException if duplicate application exists
   */
  async applyForJob(
    jobId: number,
    freelancerId: string,
    recruiterId: string,
    coverLetter: string,
  ): Promise<Application> {
    if (!jobId || !freelancerId || !recruiterId || !coverLetter) {
      throw new ConflictException(
        'All parameters (jobId, freelancerId, recruiterId, coverLetter) are required',
      );
    }

    // Duplicate check
    const existing = await this.applicationRepository.findOne({
      where: { jobId, freelancerId },
    });
    if (existing) {
      throw new ConflictException('You have already applied to this job.');
    }

    // Create and save application
    const application = this.applicationRepository.create({
      jobId,
      freelancerId,
      recruiterId,
      coverLetter,
    });
    await this.applicationRepository.save(application);

    // Build links (replace with your actual URL structure)
    const jobLink = `/jobs/${jobId}`;
    const freelancerProfileLink = `/freelancers/${freelancerId}`;

    try {
      // Send notification to recruiter
      const notificationPayload: NotificationPayload = {
        recruiterId,
        jobId: jobId.toString(),
        freelancerId,
        jobLink,
        freelancerProfileLink,
      };
      await this.notificationsService.sendNotification(notificationPayload);
    } catch (error) {

      // Log error but don't fail the application creation

     
      console.error(`Failed to send notification for application ${application.id}:`, error);

    }

    return application;
  }

  async getApplicationsByUser(userId: string): Promise<Application[]> {
    return this.applicationRepository.find({
      where: { user: { id: userId } }, // id is string here, matching entity
      relations: ['job'],
      order: { createdAt: 'DESC' },
    });
  }

  async findApplicationsByJobId(jobId: number, recruiterId: number) {
    // Check if the job belongs to the recruiter
    const job = await this.jobRepository.findOne({
      where: { id: jobId },
      relations: ['recruiter'],
    });

    if (!job || job.recruiterId) {
      throw new ForbiddenException(
        'You are not authorized to view these applications.',
      );
    }

    // Fetch applications with freelancer info
    return this.applicationRepository.find({
      where: { job: { id: jobId } },
      relations: ['freelancer'],
    });
  }

  
  /**
   * Get applications for a freelancer with job relations
   * @param freelancerId The ID of the freelancer
   * @param ordered Whether to order by creation date descending
   * @returns List of applications with job details
   */
  async getApplicationsWithJobsByFreelancer(
    freelancerId: string,
    ordered: boolean = false,
  ): Promise<Application[]> {
    const options: any = {
      where: { freelancerId },
      relations: ['job'],
    };
    
    if (ordered) {
      options.order = { createdAt: 'DESC' };
    }
    
    return this.applicationRepository.find(options);
  }

  async updateStatus(id: string, dto: UpdateStatusDto): Promise<Application> {
    const app = await this.applicationRepository.findOneBy({ id });
    if (!app) throw new NotFoundException('Application not found');

    app.status = dto.status;

    app.statusHistory.push({
      status: dto.status,
      updatedAt: new Date(),
      updatedBy: dto.updatedBy || 'system',
    });

    await this.applicationRepository.save(app);

    // Trigger notification (pseudo)
    this.notificationsService?.notifyStatusChange(app.id, dto.status);

    return app;
  }

}
