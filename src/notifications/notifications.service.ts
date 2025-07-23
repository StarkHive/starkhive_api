import {
  Injectable,
  Logger,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification, NotificationType } from './entities/notification.entity';
import { NotificationDelivery } from './entities/notification-delivery.entity';
import { NotificationChannel } from './enums/notification-channel.enum';
import { NotificationDeliveryStatus } from './enums/notification-delivery-status.enum';
import { Preferences } from './entities/preferences.entity';
import { MailService } from '../mail/mail.service';
import { User } from '../auth/entities/user.entity';
import { NotificationFrequency } from './enums/notification-frequency.enum';
import { ApplicationStatus } from 'src/applications/entities/application.entity';
import { SmsService } from './services/sms.service';
import * as fs from 'fs';
import * as path from 'path';
import Handlebars from 'handlebars';

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
    @InjectRepository(NotificationDelivery)
    private readonly deliveryRepository: Repository<NotificationDelivery>,
    @InjectRepository(Preferences)
    private readonly preferencesRepository: Repository<Preferences>,
    @Inject(forwardRef(() => MailService))
    private readonly mailService: MailService,
    @Inject(forwardRef(() => SmsService))
    private readonly smsService: SmsService,
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
    user: User,
    jobTitle: string,
    status: 'approved' | 'rejected',
  ) {
    // 1. Get user preferences
    const preferences = await this.preferencesRepository.findOne({
      where: { user: { id: user.id } },
    });
    const pref = preferences?.application;
    const message =
      status === 'approved'
        ? `Your job \"${jobTitle}\" has been approved! 🎉`
        : `Your job \"${jobTitle}\" has been rejected. Please review and try again.`;
    const context = {
      subject: 'Job Status Update',
      title: 'Job Status Update',
      message,
      jobLink: `/jobs/${jobTitle}`,
    };
    // Always create the in-app notification first
    const notification = this.notificationRepository.create({
      userId: user.id,
      message,
      type: NotificationType.JOB_STATUS_UPDATE,
      isRead: false,
      createdAt: new Date(),
    });
    await this.notificationRepository.save(notification);
    // 2. In-app delivery tracking
    if (!pref || pref.inApp) {
      await this.deliveryRepository.save(
        this.deliveryRepository.create({
          notification: { id: notification.id },
          user: { id: user.id },
          channel: NotificationChannel.IN_APP,
          status: NotificationDeliveryStatus.DELIVERED,
          error: '',
        }),
      );
    }
    // 3. Email notification
    if (pref?.email) {
      let deliveryStatus = NotificationDeliveryStatus.PENDING;
      let error = null;
      try {
        await this.mailService.sendEmail({
          to: user.email,
          subject: context.subject,
          template: 'job-status-update-email.hbs',
          context,
        });
        deliveryStatus = NotificationDeliveryStatus.SENT;
      } catch (e) {
        deliveryStatus = NotificationDeliveryStatus.FAILED;
        error = e.message;
        this.logger.error(`Email delivery failed: ${e.message}`);
      }
      await this.deliveryRepository.save(
        this.deliveryRepository.create({
          notification: { id: notification.id },
          user: { id: user.id },
          channel: NotificationChannel.EMAIL,
          status: deliveryStatus,
          error: error ? error : '',
        }),
      );
    }
    // 4. SMS notification
    if (pref?.sms && user.phone) {
      let deliveryStatus = NotificationDeliveryStatus.PENDING;
      let error = null;
      try {
        // Render SMS template
        const templatePath = path.join(
          __dirname,
          'templates',
          'job-status-update-sms.hbs',
        );
        const templateSource = fs.readFileSync(templatePath, 'utf8');
        const template = Handlebars.compile(templateSource);
        const smsBody = template(context);
        await this.smsService.sendSms(user.phone, smsBody);
        deliveryStatus = NotificationDeliveryStatus.SENT;
      } catch (e) {
        deliveryStatus = NotificationDeliveryStatus.FAILED;
        error = e.message;
        this.logger.error(`SMS delivery failed: ${e.message}`);
      }
      await this.deliveryRepository.save(
        this.deliveryRepository.create({
          notification: { id: notification.id },
          user: { id: user.id },
          channel: NotificationChannel.SMS,
          status: deliveryStatus,
          error: error ? error : '',
        }),
      );
    }
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

  async markAsUnread(notificationId: string, userId: string) {
    const notification = await this.notificationRepository.findOne({
      where: { id: notificationId, userId },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    notification.isRead = false;
    notification.updatedAt = new Date();

    return await this.notificationRepository.save(notification);
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
