import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import {
  NotificationAudience,
  NotificationStatus,
  UserRole,
  UserStatus,
} from '../../common/enums';
import {
  AuthenticatedUser,
  ServiceResponse,
} from '../../common/interfaces/api-response.interface';
import { idOf, toObjectId } from '../../common/schema.helpers';
import { buildMeta, getPagination } from '../../common/utils/pagination.util';
import { Category, CategoryDocument } from '../categories/schemas';
import { User, UserDocument, UserInterest, UserInterestDocument } from '../users/schemas';
import {
  AudienceCategory,
  MyNotificationRow,
  NotificationRow,
  UnreadCount,
} from './interfaces/notifications.interface';
import {
  Notification,
  NotificationDocument,
  UserNotification,
  UserNotificationDocument,
} from './schemas';
import { ComposeNotificationDto, ListNotificationsDto } from './dto';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<NotificationDocument>,
    @InjectModel(UserNotification.name)
    private readonly userNotificationModel: Model<UserNotificationDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(UserInterest.name)
    private readonly userInterestModel: Model<UserInterestDocument>,
    @InjectModel(Category.name) private readonly categoryModel: Model<CategoryDocument>,
  ) {}

  /**
   * Admin "Compose Notification" — Send Notification.
   *
   * `Everyone`, or an interest segment: users whose chosen interests include
   * any of the given categories. Those are the only segments the data can
   * resolve — see the note on `NotificationAudience`.
   */
  async compose(
    currentUser: AuthenticatedUser,
    dto: ComposeNotificationDto,
  ): Promise<ServiceResponse<NotificationRow>> {
    const audience = dto.audience ?? NotificationAudience.Everyone;
    const audienceCategoryIds = await this.resolveTargets(audience, dto.audienceCategoryIds);

    const notification = await this.notificationModel.create({
      notificationTitle: dto.notificationTitle,
      messageContent: dto.messageContent,
      audience,
      audienceCategoryIds,
      sentBy: new Types.ObjectId(currentUser.userId),
      sentDate: new Date(),
    });

    try {
      const recipients = await this.resolveRecipients(audience, audienceCategoryIds);

      if (recipients.length > 0) {
        // ordered:false so one duplicate cannot abort the rest of the batch.
        await this.userNotificationModel.insertMany(
          recipients.map((userId) => ({ notificationId: notification._id, userId })),
          { ordered: false },
        );
      }
      // A segment that matches nobody is not a failure — nothing broke, the
      // audience is simply empty. recipientCount is what makes that difference
      // visible in the history table.
      notification.recipientCount = recipients.length;
      notification.status = NotificationStatus.Delivered;
    } catch {
      notification.recipientCount = 0;
      notification.status = NotificationStatus.Failed;
    }
    await notification.save();

    return {
      message:
        notification.status === NotificationStatus.Delivered
          ? 'Notification sent successfully'
          : 'Notification failed to send',
      data: (await this.toRows([notification]))[0],
    };
  }

  /** Admin "Notification History" — SUBJECT, AUDIENCE, SENT DATE, STATUS */
  async adminList(query: ListNotificationsDto): Promise<ServiceResponse<NotificationRow[]>> {
    const { page, limit, skip } = getPagination(query);
    const filter: FilterQuery<NotificationDocument> = {
      ...(query.audience ? { audience: query.audience } : {}),
      ...(query.status ? { status: query.status } : {}),
    };

    const [notifications, total] = await Promise.all([
      this.notificationModel.find(filter).sort({ sentDate: -1 }).skip(skip).limit(limit),
      this.notificationModel.countDocuments(filter),
    ]);

    return {
      message: 'Notification history retrieved successfully',
      data: await this.toRows(notifications),
      meta: buildMeta(page, limit, total),
    };
  }

  /**
   * Figma Home — the bell badge.
   *
   * A `countDocuments` straight off the `{ userId, isRead }` index, kept
   * separate from `myNotifications` because the badge is polled far more often
   * than the list is opened and has no business paying for the $lookup that
   * joins each delivery row to its broadcast.
   */
  async unreadCount(currentUser: AuthenticatedUser): Promise<ServiceResponse<UnreadCount>> {
    const unreadCount = await this.userNotificationModel.countDocuments({
      userId: new Types.ObjectId(currentUser.userId),
      isRead: false,
    });
    return { message: 'Unread count retrieved successfully', data: { unreadCount } };
  }

  /** Mobile — my notifications */
  async myNotifications(
    currentUser: AuthenticatedUser,
    query: ListNotificationsDto,
  ): Promise<ServiceResponse<MyNotificationRow[]>> {
    const { page, limit, skip } = getPagination(query);
    const filter = { userId: new Types.ObjectId(currentUser.userId) };

    // Ordered by the broadcast's sentDate, which lives on the joined document —
    // an aggregation rather than populate, because populate cannot sort on it.
    const [rows, total] = await Promise.all([
      this.userNotificationModel.aggregate<{
        _id: Types.ObjectId;
        isRead: boolean;
        readAt: Date | null;
        notification: NotificationDocument;
      }>([
        { $match: filter },
        {
          $lookup: {
            from: 'notifications',
            localField: 'notificationId',
            foreignField: '_id',
            as: 'notification',
          },
        },
        { $unwind: '$notification' },
        { $sort: { 'notification.sentDate': -1 } },
        { $skip: skip },
        { $limit: limit },
        { $project: { isRead: 1, readAt: 1, notification: 1 } },
      ]),
      this.userNotificationModel.countDocuments(filter),
    ]);

    const base = await this.toRows(rows.map((row) => row.notification));
    const data: MyNotificationRow[] = base.map((row, index) => ({
      ...row,
      // The delivery row's own id, so "mark as read" addresses this user's copy.
      id: String(rows[index]._id),
      isRead: rows[index].isRead,
      readAt: rows[index].readAt,
    }));

    return {
      message: 'Notifications retrieved successfully',
      data,
      meta: buildMeta(page, limit, total),
    };
  }

  /** Mobile — mark as read. Accepts either the delivery id or the broadcast id. */
  async markAsRead(currentUser: AuthenticatedUser, id: string): Promise<ServiceResponse<null>> {
    const objectId = toObjectId(id);
    if (!objectId) throw new NotFoundException('Notification not found');

    const userId = new Types.ObjectId(currentUser.userId);
    const row = await this.userNotificationModel.findOneAndUpdate(
      { userId, $or: [{ _id: objectId }, { notificationId: objectId }] },
      { $set: { isRead: true, readAt: new Date() } },
    );
    if (!row) throw new NotFoundException('Notification not found');
    return { message: 'Notification marked as read', data: null };
  }

  /**
   * Validate the audience half of the request and return the ids to store.
   *
   * Every category must exist: a broadcast aimed at an id that resolves to
   * nothing would report success and reach no one, and the admin would have no
   * way to tell that from a genuinely empty segment.
   */
  private async resolveTargets(
    audience: NotificationAudience,
    categoryIds?: string[],
  ): Promise<Types.ObjectId[]> {
    if (audience !== NotificationAudience.Interests) return [];

    // De-duplicated first, so repeating an id cannot inflate the stored segment.
    const unique = [...new Set(categoryIds ?? [])];
    const ids = unique.map(toObjectId);
    if (ids.some((id) => id === null)) {
      throw new BadRequestException('One or more audience categories do not exist');
    }
    const objectIds = ids as Types.ObjectId[];

    const found = await this.categoryModel.countDocuments({ _id: { $in: objectIds } });
    if (found !== objectIds.length) {
      throw new BadRequestException('One or more audience categories do not exist');
    }
    return objectIds;
  }

  /**
   * Who actually receives it.
   *
   * The base filter is unchanged — active mobile users who allow notifications.
   * An interest segment narrows that to users holding a matching interest;
   * `distinct` collapses a user with three matching interests to one delivery
   * row, which the unique index would reject anyway.
   */
  private async resolveRecipients(
    audience: NotificationAudience,
    audienceCategoryIds: Types.ObjectId[],
  ): Promise<Types.ObjectId[]> {
    const filter: FilterQuery<UserDocument> = {
      role: UserRole.User,
      status: UserStatus.Active,
      allowNotifications: true,
    };

    if (audience === NotificationAudience.Interests) {
      const interested = await this.userInterestModel.distinct('userId', {
        categoryId: { $in: audienceCategoryIds },
      });
      if (interested.length === 0) return [];
      filter._id = { $in: interested };
    }

    const recipients = await this.userModel.find(filter).select('_id');
    return recipients.map((user) => user._id);
  }

  /**
   * Shape rows for the API, resolving every targeted category to its name in
   * one read for the whole page rather than a query per row.
   */
  private async toRows(notifications: NotificationDocument[]): Promise<NotificationRow[]> {
    const targeted = notifications.flatMap((n) => n.audienceCategoryIds ?? []);
    const categories = targeted.length
      ? await this.categoryModel.find({ _id: { $in: targeted } })
      : [];
    const nameById = new Map(categories.map((c) => [idOf(c), c.categoryName]));

    return notifications.map((notification) => {
      const audienceCategories: AudienceCategory[] = (
        notification.audienceCategoryIds ?? []
      ).flatMap((id) => {
        const categoryName = nameById.get(String(id));
        // A deleted category leaves history pointing at nothing; drop it rather
        // than rendering a blank chip in the Audience column.
        return categoryName ? [{ id: String(id), categoryName }] : [];
      });

      return {
        id: String(notification._id),
        notificationTitle: notification.notificationTitle,
        messageContent: notification.messageContent,
        audience: notification.audience,
        audienceCategories,
        recipientCount: notification.recipientCount ?? 0,
        sentDate: notification.sentDate,
        status: notification.status,
      };
    });
  }
}
