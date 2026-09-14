import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ActivityStatus, ParticipantStatus, UserRole } from '../../common/enums';
import { ServiceResponse } from '../../common/interfaces/api-response.interface';
import { idOf } from '../../common/schema.helpers';
import { Activity, ActivityDocument } from '../activities/schemas';
import { Category, CategoryDocument } from '../categories/schemas';
import { ActivityParticipant, ActivityParticipantDocument } from '../participants/schemas';
import { User, UserDocument } from '../users/schemas';
import {
  CategoryDistributionRow,
  DashboardStatistics,
  RecentActivityRow,
  RecentUserRow,
} from './interfaces/dashboard.interface';
import { RecentListDto } from './dto';

/** Recent-list endpoints never return more than this, whatever the caller asks. */
const MAX_RECENT = 50;

@Injectable()
export class DashboardService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Activity.name) private readonly activityModel: Model<ActivityDocument>,
    @InjectModel(Category.name) private readonly categoryModel: Model<CategoryDocument>,
    @InjectModel(ActivityParticipant.name)
    private readonly participantModel: Model<ActivityParticipantDocument>,
  ) {}

  /** Figma stat cards */
  async statistics(): Promise<ServiceResponse<DashboardStatistics>> {
    const [totalUsers, totalActivities, totalRegistrations, pendingApprovals] = await Promise.all([
      this.userModel.countDocuments({ role: UserRole.User }),
      this.activityModel.countDocuments(),
      this.participantModel.countDocuments({ status: ParticipantStatus.Joined }),
      this.activityModel.countDocuments({ status: ActivityStatus.Pending }),
    ]);
    return {
      message: 'Dashboard statistics retrieved successfully',
      data: { totalUsers, totalActivities, totalRegistrations, pendingApprovals },
    };
  }

  /** Figma "Category Distribution — Activity breakdown across the community." */
  async categoryDistribution(): Promise<ServiceResponse<CategoryDistributionRow[]>> {
    const rows = await this.activityModel.aggregate<{ categoryName: string; count: number }>([
      {
        $lookup: {
          from: 'categories',
          localField: 'categoryId',
          foreignField: '_id',
          as: 'category',
        },
      },
      { $unwind: '$category' },
      { $group: { _id: '$category.categoryName', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $project: { _id: 0, categoryName: '$_id', count: 1 } },
    ]);

    const total = rows.reduce((sum, row) => sum + row.count, 0);
    const data: CategoryDistributionRow[] = rows.map((row) => ({
      categoryName: row.categoryName,
      activityCount: row.count,
      percentage: total > 0 ? Math.round((row.count / total) * 100) : 0,
    }));
    return { message: 'Category distribution retrieved successfully', data };
  }

  /** Figma "Recent Users — New members who joined in the last 24 hours." */
  async recentUsers(query: RecentListDto): Promise<ServiceResponse<RecentUserRow[]>> {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const users = await this.userModel
      .find({ role: UserRole.User, createdAt: { $gte: since } })
      .sort({ createdAt: -1 })
      .limit(Math.min(MAX_RECENT, Number(query.limit) || 10));

    const data: RecentUserRow[] = users.map((user) => ({
      id: idOf(user),
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      profilePhoto: user.profilePhoto,
      dateJoined: user.createdAt,
      status: user.status,
    }));
    return { message: 'Recent users retrieved successfully', data };
  }

  /** Figma "Recent Activities — Latest events scheduled across the network." */
  async recentActivities(query: RecentListDto): Promise<ServiceResponse<RecentActivityRow[]>> {
    const activities = await this.activityModel
      .find()
      .sort({ createdAt: -1 })
      .limit(Math.min(MAX_RECENT, Number(query.limit) || 10));

    const categories = await this.categoryModel.find({
      _id: { $in: activities.map((a) => a.categoryId) },
    });
    const categoryNameById = new Map(categories.map((c) => [idOf(c), c.categoryName]));

    const data: RecentActivityRow[] = activities.map((activity) => ({
      id: idOf(activity),
      activityName: activity.activityName,
      activityPhoto: activity.activityPhoto,
      activityLocation: activity.activityLocation,
      categoryName: categoryNameById.get(String(activity.categoryId)) ?? '',
      activityDate: activity.activityDate,
      status: activity.status,
    }));
    return { message: 'Recent activities retrieved successfully', data };
  }
}
