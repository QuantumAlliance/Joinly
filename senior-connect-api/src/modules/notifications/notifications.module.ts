import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Category, CategorySchema } from '../categories/schemas';
import { User, UserInterest, UserInterestSchema, UserSchema } from '../users/schemas';
import { NotificationsController } from './notifications.controller';
import {
  Notification,
  NotificationSchema,
  UserNotification,
  UserNotificationSchema,
} from './schemas';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Notification.name, schema: NotificationSchema },
      { name: UserNotification.name, schema: UserNotificationSchema },
      { name: User.name, schema: UserSchema },
      // Interest targeting resolves its recipients from these two.
      { name: UserInterest.name, schema: UserInterestSchema },
      { name: Category.name, schema: CategorySchema },
    ]),
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService],
})
export class NotificationsModule {}
