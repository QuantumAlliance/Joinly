import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  AuthenticatedUser,
  ServiceResponse,
} from '../../common/interfaces/api-response.interface';
import { idOf, toObjectId } from '../../common/schema.helpers';
import { buildMeta, getPagination } from '../../common/utils/pagination.util';
import { Activity, ActivityDocument } from '../activities/schemas';
import { Category, CategoryDocument } from '../categories/schemas';
import { FavoriteItem } from './interfaces/favorites.interface';
import { Favorite, FavoriteDocument } from './schemas';
import { ListFavoritesDto } from './dto';

@Injectable()
export class FavoritesService {
  constructor(
    @InjectModel(Favorite.name) private readonly favoriteModel: Model<FavoriteDocument>,
    @InjectModel(Activity.name) private readonly activityModel: Model<ActivityDocument>,
    @InjectModel(Category.name) private readonly categoryModel: Model<CategoryDocument>,
  ) {}

  /** Add to Favorite Activities */
  async add(currentUser: AuthenticatedUser, activityId: string): Promise<ServiceResponse<null>> {
    const id = toObjectId(activityId);
    if (!id) throw new NotFoundException('Activity not found');

    const activity = await this.activityModel.exists({ _id: id });
    if (!activity) throw new NotFoundException('Activity not found');

    const userId = new Types.ObjectId(currentUser.userId);
    const existing = await this.favoriteModel.exists({ userId, activityId: id });
    if (existing) throw new ConflictException('Activity is already in favorites');

    await this.favoriteModel.create({ userId, activityId: id });
    return { message: 'Added to favorite activities', data: null };
  }

  /** Remove from Favorite Activities */
  async remove(currentUser: AuthenticatedUser, activityId: string): Promise<ServiceResponse<null>> {
    const id = toObjectId(activityId);
    if (!id) throw new NotFoundException('Activity is not in favorites');

    const removed = await this.favoriteModel.findOneAndDelete({
      userId: new Types.ObjectId(currentUser.userId),
      activityId: id,
    });
    if (!removed) throw new NotFoundException('Activity is not in favorites');
    return { message: 'Removed from favorite activities', data: null };
  }

  /** Figma — "Favorite Activities: View and manage favorite Activity" */
  async list(
    currentUser: AuthenticatedUser,
    query: ListFavoritesDto,
  ): Promise<ServiceResponse<FavoriteItem[]>> {
    const { page, limit, skip } = getPagination(query);
    const filter = { userId: new Types.ObjectId(currentUser.userId) };

    const [favorites, total] = await Promise.all([
      this.favoriteModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      this.favoriteModel.countDocuments(filter),
    ]);

    // Resolve activities and their categories in two batched reads rather than
    // one populate per row.
    const activities = await this.activityModel.find({
      _id: { $in: favorites.map((f) => f.activityId) },
    });
    const activityById = new Map(activities.map((a) => [idOf(a), a]));

    const categories = await this.categoryModel.find({
      _id: { $in: activities.map((a) => a.categoryId) },
    });
    const categoryNameById = new Map(categories.map((c) => [idOf(c), c.categoryName]));

    const data: FavoriteItem[] = favorites.flatMap((favorite) => {
      const activity = activityById.get(String(favorite.activityId));
      if (!activity) return []; // activity deleted since it was favourited
      return [
        {
          id: idOf(favorite),
          activityId: String(favorite.activityId),
          activityName: activity.activityName,
          activityPhoto: activity.activityPhoto,
          categoryName: categoryNameById.get(String(activity.categoryId)) ?? '',
          activityDate: activity.activityDate,
          activityTime: activity.activityTime,
          activityLocation: activity.activityLocation,
          participants: `${activity.joinedCount}/${activity.maximumNumberOfParticipants}`,
          createdAt: favorite.createdAt,
        },
      ];
    });

    return {
      message: 'Favorite activities retrieved successfully',
      data,
      meta: buildMeta(page, limit, total),
    };
  }
}
