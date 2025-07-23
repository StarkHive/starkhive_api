import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { Notification } from './entities/notification.entity';
import { NotificationDelivery } from './entities/notification-delivery.entity';
import { Preferences } from './entities/preferences.entity';
import { AuthModule } from '../auth/auth.module';
import { ApplicationsModule } from 'src/applications/applications.module';
import { SmsService } from './services/sms.service';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [
    forwardRef(() => ApplicationsModule),
    TypeOrmModule.forFeature([Notification, NotificationDelivery, Preferences]),
    forwardRef(() => AuthModule),
    MailModule,
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService, SmsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
