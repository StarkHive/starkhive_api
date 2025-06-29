import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification, NotificationType } from './entities/notification.entity';
import { ApplicationStatus } from 'src/applications/entities/application.entity';

export interface NotificationPayload {
  recruiterId: string;
  jobId: string;
  freelancerId: string;
  jobLink: string;
  freelancerProfileLink: string;
}

@Injectable()
export class NotificationsService {
  notifyStatusChange(id: string, status: ApplicationStatus) {
    throw new Error('Method not implemented.');
  }
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
  ) {}

  async sendNotification(payload: NotificationPayload): Promise<void> {
    try {
      this.logger.log(`Notification sent to recruiter ${payload.recruiterId}:`);
      this.logger.log(`Freelancer applied for job.`);
      this.logger.log(`Job link: ${payload.jobLink}`);
      this.logger.log(`Freelancer profile: ${payload.freelancerProfileLink}`);
    } catch (error) {
      this.logger.error(
        `Failed to send notification: ${error.message}`,
        error.stack,
      );
      throw new Error('Failed to send notification');
    }
  }

  async sendJobStatusNotification(
    userId: string,
    jobTitle: string,
    status: 'approved' | 'rejected',
  ) {
    const message =
      status === 'approved'
        ? `Your job "${jobTitle}" has been approved! 🎉`
        : `Your job "${jobTitle}" has been rejected. Please review and try again.`;

    const notification = this.notificationRepository.create({
      userId, // Ensure 'userId' exists on Notification entity
      message,
      type: NotificationType.JOB_STATUS_UPDATE,
      isRead: false,
      createdAt: new Date(),
    });

    await this.notificationRepository.save(notification);
  }

  async getNotificationsByUser(
    userId: string,
    page: number = 1,
    limit: number = 10,
  ) {
    if (page < 1) page = 1;
    if (limit < 1) limit = 10;
    if (limit > 100) limit = 100;
    const skip = (page - 1) * limit;

    try {
      const [notifications, total] =
        await this.notificationRepository.findAndCount({
          where: { userId },
          order: { createdAt: 'DESC' },
          skip,
          take: limit,
        });

      const totalPages = Math.ceil(total / limit);
      const hasNextPage = page < totalPages;
      const hasPreviousPage = page > 1;

      return {
        data: notifications,
        meta: {
          total,
          page,
          limit,
          totalPages,
          hasNextPage,
          hasPreviousPage,
        },
      };
    } catch (error) {
      throw new NotFoundException('Failed to retrieve notifications');
    }
  }

  async markAsRead(notificationId: string, userId: string) {
    const notification = await this.notificationRepository.findOne({
      where: { id: notificationId, userId },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    notification.isRead = true;
    notification.updatedAt = new Date();

    return await this.notificationRepository.save(notification);
  }

  async markAllAsRead(userId: string) {
    await this.notificationRepository.update(
      { userId, isRead: false },
      { isRead: true, updatedAt: new Date() },
    );

    return { message: 'All notifications marked as read' };
  }

  async getUnreadCount(userId: string): Promise<number> {
    return await this.notificationRepository.count({
      where: { userId, isRead: false },
    });
  }
}
