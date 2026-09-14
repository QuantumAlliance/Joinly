import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import {
  ActivityStatus,
  ActivityTab,
  CategoryStatus,
  Difficulty,
  ParticipantStatus,
} from '../../common/enums';
import {
  AuthenticatedUser,
  ServiceResponse,
} from '../../common/interfaces/api-response.interface';
import { distanceKm } from '../../common/utils/distance.util';
import { geoPoint, idOf, toObjectId } from '../../common/schema.helpers';
import { buildMeta, getPagination } from '../../common/utils/pagination.util';
import { Category, CategoryDocument } from '../categories/schemas';
import { Favorite, FavoriteDocument } from '../favorites/schemas';
import { ActivityParticipant, ActivityParticipantDocument } from '../participants/schemas';
import { BlockedUser, BlockedUserDocument, User, UserDocument } from '../users/schemas';
import {
  ActivityCard,
  ActivityDetails,
  ActivitySuggestion,
  ActivitySummary,
} from './interfaces/activities.interface';
import { Activity, ActivityDocument } from './schemas';
import {
  ActivitySuggestionsDto,
  ActivitySummaryDto,
  AdminListActivitiesDto,
  CreateActivityDto,
  DiscoverActivitiesDto,
  DiscoverSort,
  MyActivitiesDto,
  UpdateActivityDto,
  UpdateActivityStatusDto,
} from './dto';

/** Escape user input before it reaches a $regex. */
const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Today as the ISO date string activityDate is stored in. */
const today = (): string => new Date().toISOString().slice(0, 10);

/** Radius the Home hero banner means by "near you", when none is given. */
const DEFAULT_NEARBY_RADIUS_KM = 25;

/** Autocomplete rows returned when the caller does not ask for a count. */
const DEFAULT_SUGGESTION_LIMIT = 8;
const MAX_SUGGESTION_LIMIT = 20;

/** Kilometres to the radians $centerSphere wants. */
const EARTH_RADIUS_KM = 6371;

@Injectable()
export class ActivitiesService {
  constructor(
    @InjectModel(Activity.name) private readonly activityModel: Model<ActivityDocument>,
    @InjectModel(Category.name) private readonly categoryModel: Model<CategoryDocument>,
    @InjectModel(ActivityParticipant.name)
    private readonly participantModel: Model<ActivityParticipantDocument>,
    @InjectModel(Favorite.name) private readonly favoriteModel: Model<FavoriteDocument>,
    @InjectModel(BlockedUser.name)
    private readonly blockedUserModel: Model<BlockedUserDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  /** Figma "Create Activities" flow (Draft or Pending) */
  async create(
    currentUser: AuthenticatedUser,
    dto: CreateActivityDto,
  ): Promise<ServiceResponse<ActivityDetails>> {
    let categoryId = toObjectId(dto.categoryId);

    if (!categoryId && dto.categoryName) {
      // "Add Category name" — a user-proposed category. Created as Pending and
      // used immediately: approval is non-blocking, and only decides whether
      // the chip becomes public for everyone else. It was Disabled before
      // Phase 4, which is indistinguishable from a category an admin had
      // deliberately retired.
      const existing = await this.categoryModel.findOne({
        categoryName: { $regex: `^${escapeRegex(dto.categoryName)}$`, $options: 'i' },
      });
      const category =
        existing ??
        (await this.categoryModel.create({
          categoryName: dto.categoryName,
          status: CategoryStatus.Pending,
          proposedBy: new Types.ObjectId(currentUser.userId),
        }));
      categoryId = category._id;
    }

    if (!categoryId) throw new NotFoundException('Category is required');
    const category = await this.categoryModel.findById(categoryId);
    if (!category) throw new NotFoundException('Category not found');

    const activity = await this.activityModel.create({
      activityName: dto.activityName,
      categoryId,
      descriptions: dto.descriptions,
      maximumNumberOfParticipants: dto.maximumNumberOfParticipants,
      activityPhoto: dto.activityPhoto ?? null,
      activityDate: dto.activityDate,
      activityTime: dto.activityTime,
      activityDuration: dto.activityDuration,
      activityEquipment: dto.activityEquipment ?? null,
      activityLocation: dto.activityLocation,
      latitude: dto.latitude ?? null,
      longitude: dto.longitude ?? null,
      location: geoPoint(dto.latitude, dto.longitude),
      minAge: dto.minAge,
      maxAge: dto.maxAge,
      price: dto.price ?? null,
      difficulty: dto.difficulty ?? Difficulty.Beginner,
      status: dto.saveAsDraft ? ActivityStatus.Draft : ActivityStatus.Pending,
      organizerId: new Types.ObjectId(currentUser.userId),
    });

    const data = await this.buildDetails(idOf(activity), currentUser);
    return {
      message: dto.saveAsDraft ? 'Activity saved as draft' : 'Activity submitted for approval',
      data,
    };
  }

  /** Figma "Discover" — search, category chips, Apply Filter, Map/List view */
  async discover(
    currentUser: AuthenticatedUser,
    query: DiscoverActivitiesDto,
  ): Promise<ServiceResponse<ActivityCard[]>> {
    const { page, limit, skip } = getPagination(query);

    // Conditions are collected into $and so that two rules over the same field
    // (upcoming-only plus an explicit date) both apply instead of overwriting.
    const and: FilterQuery<ActivityDocument>[] = [{ activityDate: { $gte: today() } }];

    const filter: FilterQuery<ActivityDocument> = {
      ...(await this.visibilityFilter(currentUser.userId)),
      status: ActivityStatus.Approved,
    };

    if (query.search) {
      const search = { $regex: escapeRegex(query.search), $options: 'i' };
      and.push({
        $or: [{ activityName: search }, { activityLocation: search }, { descriptions: search }],
      });
    }
    if (query.categoryId) {
      const categoryId = toObjectId(query.categoryId);
      if (!categoryId) {
        return { message: 'Activities retrieved successfully', data: [], meta: buildMeta(page, limit, 0) };
      }
      filter.categoryId = categoryId;
    }
    if (query.activityDate) and.push({ activityDate: query.activityDate });
    if (query.minAge !== undefined) filter.maxAge = { $gte: query.minAge };
    if (query.maxAge !== undefined) filter.minAge = { $lte: query.maxAge };

    const userLat = query.latitude ?? null;
    const userLng = query.longitude ?? null;

    // "Activity distances" filter (km). $geoWithin uses the 2dsphere index, so
    // the radius is applied by Mongo rather than by filtering every row in Node.
    if (query.maxDistance !== undefined && userLat !== null && userLng !== null) {
      filter.location = {
        $geoWithin: { $centerSphere: [[userLng, userLat], Number(query.maxDistance) / 6371] },
      };
    }

    filter.$and = and;

    const { sort, near } = this.sortFor(query.sort, userLat, userLng, query.maxDistance);
    const isMap = query.view === 'map';

    // `near` goes only into the find. countDocuments cannot take $near — the
    // driver runs it as an aggregation $match, where $near is rejected — so
    // the count keeps the $geoWithin form the distance filter already set.
    // Both express the same radius, so the total still matches the rows.
    const findFilter: FilterQuery<ActivityDocument> = near
      ? { ...filter, location: near }
      : filter;

    const [activities, total] = await Promise.all([
      isMap
        ? this.activityModel.find(findFilter).sort(sort)
        : this.activityModel.find(findFilter).sort(sort).skip(skip).limit(limit),
      this.activityModel.countDocuments(filter),
    ]);

    return {
      message: 'Activities retrieved successfully',
      data: await this.toCards(activities, userLat, userLng),
      meta: buildMeta(page, isMap ? total || 1 : limit, total),
    };
  }

  /** Figma Home — "Featured this weekend" */
  async featured(currentUser: AuthenticatedUser): Promise<ServiceResponse<ActivityCard[]>> {
    const now = new Date();
    const day = now.getDay(); // 0 Sun .. 6 Sat
    const daysUntilSaturday = (6 - day + 7) % 7;
    const saturday = new Date(now);
    saturday.setDate(now.getDate() + daysUntilSaturday);
    const sunday = new Date(saturday);
    sunday.setDate(saturday.getDate() + 1);
    const toIso = (d: Date): string => d.toISOString().slice(0, 10);

    const activities = await this.activityModel
      .find({
        ...(await this.visibilityFilter(currentUser.userId)),
        status: ActivityStatus.Approved,
        activityDate: { $gte: toIso(day === 0 ? now : saturday), $lte: toIso(sunday) },
      })
      .sort({ activityDate: 1 })
      .limit(10);

    const user = await this.userModel.findById(currentUser.userId);
    return {
      message: 'Featured activities retrieved successfully',
      data: await this.toCards(activities, user?.latitude ?? null, user?.longitude ?? null),
    };
  }

  /**
   * Figma Home hero banner — "12 activities happening near you today".
   *
   * Coordinates come from the request, or fall back to the location saved on
   * the profile. With neither, the count is still returned but `radiusKm` is
   * null, so the banner can word itself honestly instead of claiming "near
   * you" about a national figure.
   */
  async summary(
    currentUser: AuthenticatedUser,
    query: ActivitySummaryDto,
  ): Promise<ServiceResponse<ActivitySummary>> {
    const user = await this.userModel.findById(currentUser.userId);
    const latitude = query.latitude ?? user?.latitude ?? null;
    const longitude = query.longitude ?? user?.longitude ?? null;
    const radiusKm = query.maxDistance ?? DEFAULT_NEARBY_RADIUS_KM;
    const date = today();

    const filter: FilterQuery<ActivityDocument> = {
      ...(await this.visibilityFilter(currentUser.userId)),
      status: ActivityStatus.Approved,
      activityDate: date,
    };

    const hasOrigin = latitude !== null && longitude !== null;
    if (hasOrigin) {
      // $geoWithin over the 2dsphere index — the radius is applied by Mongo,
      // not by counting every row in Node.
      filter.location = {
        $geoWithin: { $centerSphere: [[longitude, latitude], radiusKm / EARTH_RADIUS_KM] },
      };
    }

    const count = await this.activityModel.countDocuments(filter);
    return {
      message: 'Activity summary retrieved successfully',
      data: { date, count, radiusKm: hasOrigin ? radiusKm : null },
    };
  }

  /**
   * Figma Discover — search box autocomplete.
   *
   * A case-insensitive substring match rather than the `activityName` text
   * index: a text index matches whole words, so typing "swi" would return
   * nothing for "Swimming" — the one thing an autocomplete has to do. The
   * candidate set is already narrow (approved and upcoming only) and the
   * result is capped, so the scan stays small.
   */
  async suggestions(
    currentUser: AuthenticatedUser,
    query: ActivitySuggestionsDto,
  ): Promise<ServiceResponse<ActivitySuggestion[]>> {
    const limit = Math.min(Number(query.limit) || DEFAULT_SUGGESTION_LIMIT, MAX_SUGGESTION_LIMIT);

    const activities = await this.activityModel
      .find({
        ...(await this.visibilityFilter(currentUser.userId)),
        status: ActivityStatus.Approved,
        activityDate: { $gte: today() },
        activityName: { $regex: escapeRegex(query.q), $options: 'i' },
      })
      // Soonest first: of two equally good matches, the one happening next is
      // the more useful suggestion.
      .sort({ activityDate: 1, activityTime: 1 })
      .limit(limit);

    const categories = await this.categoryModel.find({
      _id: { $in: activities.map((a) => a.categoryId) },
    });
    const categoryName = new Map(categories.map((c) => [idOf(c), c.categoryName]));

    return {
      message: 'Suggestions retrieved successfully',
      data: activities.map((a) => ({
        id: idOf(a),
        activityName: a.activityName,
        categoryName: categoryName.get(String(a.categoryId)) ?? '',
      })),
    };
  }

  /** Figma Activities tab — "My Activities" (All | Upcoming | Past) */
  async myActivities(
    currentUser: AuthenticatedUser,
    query: MyActivitiesDto,
  ): Promise<ServiceResponse<ActivityCard[]>> {
    const { page, limit, skip } = getPagination(query);
    const filter: FilterQuery<ActivityDocument> = {
      organizerId: new Types.ObjectId(currentUser.userId),
      ...this.tabFilter(query.tab),
    };

    const [activities, total] = await Promise.all([
      this.activityModel.find(filter).sort({ activityDate: -1 }).skip(skip).limit(limit),
      this.activityModel.countDocuments(filter),
    ]);

    return {
      message: 'My activities retrieved successfully',
      data: await this.toCards(activities, null, null),
      meta: buildMeta(page, limit, total),
    };
  }

  /** Figma Activities tab — "Joined Activities" (All | Upcoming | Past) */
  async joinedActivities(
    currentUser: AuthenticatedUser,
    query: MyActivitiesDto,
  ): Promise<ServiceResponse<ActivityCard[]>> {
    const { page, limit, skip } = getPagination(query);

    const memberships = await this.participantModel
      .find({ userId: new Types.ObjectId(currentUser.userId), status: ParticipantStatus.Joined })
      .select('activityId');

    const filter: FilterQuery<ActivityDocument> = {
      _id: { $in: memberships.map((m) => m.activityId) },
      ...this.tabFilter(query.tab),
    };

    const [activities, total] = await Promise.all([
      this.activityModel.find(filter).sort({ activityDate: -1 }).skip(skip).limit(limit),
      this.activityModel.countDocuments(filter),
    ]);

    return {
      message: 'Joined activities retrieved successfully',
      data: await this.toCards(activities, null, null),
      meta: buildMeta(page, limit, total),
    };
  }

  /** Figma "Activity Details" screen */
  async details(
    currentUser: AuthenticatedUser,
    id: string,
  ): Promise<ServiceResponse<ActivityDetails>> {
    return {
      message: 'Activity details retrieved successfully',
      data: await this.buildDetails(id, currentUser),
    };
  }

  /** Organizer edits own activity (approved edits go back to Pending) */
  async update(
    currentUser: AuthenticatedUser,
    id: string,
    dto: UpdateActivityDto,
  ): Promise<ServiceResponse<ActivityDetails>> {
    const activity = await this.findById(id);
    if (!activity.organizerId.equals(new Types.ObjectId(currentUser.userId))) {
      throw new ForbiddenException('Only the organizer can update this activity');
    }

    const { submit, ...changes } = dto;
    Object.assign(activity, changes);
    if (changes.latitude !== undefined || changes.longitude !== undefined) {
      const point = geoPoint(activity.latitude, activity.longitude);
      if (point) activity.location = point;
    }
    if (submit && activity.status === ActivityStatus.Draft) {
      activity.status = ActivityStatus.Pending;
    } else if (activity.status === ActivityStatus.Approved && Object.keys(changes).length > 0) {
      activity.status = ActivityStatus.Pending;
    }
    await activity.save();

    return {
      message: 'Activity updated successfully',
      data: await this.buildDetails(id, currentUser),
    };
  }

  /** Organizer cancels/deletes own activity */
  async remove(currentUser: AuthenticatedUser, id: string): Promise<ServiceResponse<null>> {
    const activity = await this.findById(id);
    if (!activity.organizerId.equals(new Types.ObjectId(currentUser.userId))) {
      throw new ForbiddenException('Only the organizer can delete this activity');
    }
    await this.deleteWithDependents(activity);
    return { message: 'Activity deleted successfully', data: null };
  }

  /** Admin — activities list with tabs Pending | Approved | Rejected */
  async adminList(query: AdminListActivitiesDto): Promise<ServiceResponse<ActivityCard[]>> {
    const { page, limit, skip } = getPagination(query);
    const filter: FilterQuery<ActivityDocument> = {};

    if (query.status) filter.status = query.status;
    if (query.categoryId) {
      const categoryId = toObjectId(query.categoryId);
      if (!categoryId) {
        return { message: 'Activities retrieved successfully', data: [], meta: buildMeta(page, limit, 0) };
      }
      filter.categoryId = categoryId;
    }
    if (query.activityDate) filter.activityDate = query.activityDate;
    if (query.search) {
      filter.activityName = { $regex: escapeRegex(query.search), $options: 'i' };
    }

    const [activities, total] = await Promise.all([
      this.activityModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      this.activityModel.countDocuments(filter),
    ]);

    return {
      message: 'Activities retrieved successfully',
      data: await this.toCards(activities, null, null),
      meta: buildMeta(page, limit, total),
    };
  }

  /** Admin — activity details (moderation view) */
  async adminDetails(id: string): Promise<ServiceResponse<ActivityDetails>> {
    return {
      message: 'Activity details retrieved successfully',
      data: await this.buildDetails(id, null),
    };
  }

  /** Admin — Approve / Reject */
  async adminUpdateStatus(
    id: string,
    dto: UpdateActivityStatusDto,
  ): Promise<ServiceResponse<ActivityDetails>> {
    const activity = await this.findById(id);
    activity.status = dto.status;
    activity.rejectionReason =
      dto.status === ActivityStatus.Rejected ? dto.rejectionReason ?? null : null;
    await activity.save();

    return {
      message:
        dto.status === ActivityStatus.Approved
          ? 'Activity approved successfully'
          : 'Activity rejected successfully',
      data: await this.buildDetails(id, null),
    };
  }

  /** Admin — delete any activity */
  async adminRemove(id: string): Promise<ServiceResponse<null>> {
    await this.deleteWithDependents(await this.findById(id));
    return { message: 'Activity deleted successfully', data: null };
  }

  // ---------- helpers ----------

  private async findById(id: string): Promise<ActivityDocument> {
    const objectId = toObjectId(id);
    const activity = objectId ? await this.activityModel.findById(objectId) : null;
    if (!activity) throw new NotFoundException('Activity not found');
    return activity;
  }

  /**
   * Mongo has no cascading delete, so memberships and favourites are removed
   * explicitly rather than left behind as orphans.
   */
  private async deleteWithDependents(activity: ActivityDocument): Promise<void> {
    await Promise.all([
      this.participantModel.deleteMany({ activityId: activity._id }),
      this.favoriteModel.deleteMany({ activityId: activity._id }),
    ]);
    await activity.deleteOne();
  }

  /** Hide activities organised by someone in either direction of a block. */
  private async visibilityFilter(userId: string): Promise<FilterQuery<ActivityDocument>> {
    const id = new Types.ObjectId(userId);
    const blocks = await this.blockedUserModel.find({
      $or: [{ blockerId: id }, { blockedId: id }],
    });
    const hidden = blocks.map((b) => (b.blockerId.equals(id) ? b.blockedId : b.blockerId));
    return hidden.length > 0 ? { organizerId: { $nin: hidden } } : {};
  }

  /**
   * The Home tab feeds.
   *
   * `nearby` returns an empty sort on purpose and a `$near` clause instead:
   * `$near` already yields documents nearest-first off the 2dsphere index, and
   * an explicit sort on top would throw that ordering away and force an
   * in-memory sort of the whole match.
   *
   * The clause is handed back rather than written into the caller's filter
   * because it belongs only in the find. `countDocuments` runs as an
   * aggregation `$match`, which rejects `$near`; the count keeps the
   * `$geoWithin` form of the same radius.
   */
  private sortFor(
    sort: DiscoverSort | undefined,
    latitude: number | null,
    longitude: number | null,
    maxDistanceKm?: number,
  ): { sort: Record<string, 1 | -1>; near: FilterQuery<ActivityDocument> | null } {
    if (sort === 'popular') {
      // joinedCount is denormalised, so "popular" is one indexed read rather
      // than an aggregation over the participants collection.
      return { sort: { joinedCount: -1, activityDate: 1 }, near: null };
    }
    if (sort === 'recent') return { sort: { createdAt: -1 }, near: null };

    if (sort === 'nearby') {
      if (latitude === null || longitude === null) {
        throw new BadRequestException('sort=nearby requires latitude and longitude');
      }
      return {
        sort: {},
        near: {
          $near: {
            $geometry: { type: 'Point', coordinates: [longitude, latitude] },
            ...(maxDistanceKm !== undefined ? { $maxDistance: maxDistanceKm * 1000 } : {}),
          },
        } as FilterQuery<ActivityDocument>,
      };
    }

    // Discover's own order: soonest first.
    return { sort: { activityDate: 1, activityTime: 1 }, near: null };
  }

  private tabFilter(tab?: ActivityTab): FilterQuery<ActivityDocument> {
    if (tab === ActivityTab.Upcoming) return { activityDate: { $gte: today() } };
    if (tab === ActivityTab.Past) return { activityDate: { $lt: today() } };
    return {};
  }

  private distanceFrom(
    userLat: number | null,
    userLng: number | null,
    activity: ActivityDocument,
  ): number | null {
    if (userLat === null || userLng === null) return null;
    if (activity.latitude === null || activity.longitude === null) return null;
    return Math.round(distanceKm(userLat, userLng, activity.latitude, activity.longitude) * 10) / 10;
  }

  private async toCards(
    activities: ActivityDocument[],
    userLat: number | null,
    userLng: number | null,
  ): Promise<ActivityCard[]> {
    if (activities.length === 0) return [];

    // Resolve categories and organizers in two batched reads.
    const [categories, organizers] = await Promise.all([
      this.categoryModel.find({ _id: { $in: activities.map((a) => a.categoryId) } }),
      this.userModel.find({ _id: { $in: activities.map((a) => a.organizerId) } }),
    ]);
    const categoryNameById = new Map(categories.map((c) => [idOf(c), c.categoryName]));
    const organizerById = new Map(organizers.map((u) => [idOf(u), u]));

    return activities.map((activity) => {
      const organizer = organizerById.get(String(activity.organizerId));
      return {
        id: idOf(activity),
        activityName: activity.activityName,
        activityPhoto: activity.activityPhoto,
        categoryName: categoryNameById.get(String(activity.categoryId)) ?? '',
        activityDate: activity.activityDate,
        activityTime: activity.activityTime,
        activityLocation: activity.activityLocation,
        latitude: activity.latitude,
        longitude: activity.longitude,
        participants: `${activity.joinedCount}/${activity.maximumNumberOfParticipants}`,
        joinedCount: activity.joinedCount,
        maximumNumberOfParticipants: activity.maximumNumberOfParticipants,
        distanceKm: this.distanceFrom(userLat, userLng, activity),
        status: activity.status,
        organizer: {
          id: String(activity.organizerId),
          firstName: organizer?.firstName ?? '',
          lastName: organizer?.lastName ?? '',
          profilePhoto: organizer?.profilePhoto ?? null,
        },
      };
    });
  }

  private async buildDetails(
    id: string,
    currentUser: AuthenticatedUser | null,
  ): Promise<ActivityDetails> {
    const activity = await this.findById(id);

    const [category, organizer, participants] = await Promise.all([
      this.categoryModel.findById(activity.categoryId),
      this.userModel.findById(activity.organizerId),
      this.participantModel
        .find({ activityId: activity._id, status: ParticipantStatus.Joined })
        .sort({ joinedAt: 1 })
        .limit(5),
    ]);

    const avatarUsers = await this.userModel.find({
      _id: { $in: participants.map((p) => p.userId) },
    });
    const avatarById = new Map(avatarUsers.map((u) => [idOf(u), u.profilePhoto]));

    let isJoined = false;
    let isFavorite = false;
    let userLat: number | null = null;
    let userLng: number | null = null;

    if (currentUser) {
      const userId = new Types.ObjectId(currentUser.userId);
      const [joined, favorite, user] = await Promise.all([
        this.participantModel.exists({
          activityId: activity._id,
          userId,
          status: ParticipantStatus.Joined,
        }),
        this.favoriteModel.exists({ activityId: activity._id, userId }),
        this.userModel.findById(userId),
      ]);
      isJoined = Boolean(joined);
      isFavorite = Boolean(favorite);
      userLat = user?.latitude ?? null;
      userLng = user?.longitude ?? null;
    }

    return {
      id: idOf(activity),
      activityName: activity.activityName,
      activityPhoto: activity.activityPhoto,
      category: {
        id: String(activity.categoryId),
        categoryName: category?.categoryName ?? '',
      },
      activityDate: activity.activityDate,
      activityTime: activity.activityTime,
      activityLocation: activity.activityLocation,
      latitude: activity.latitude,
      longitude: activity.longitude,
      distanceKm: this.distanceFrom(userLat, userLng, activity),
      participants: `${activity.joinedCount}/${activity.maximumNumberOfParticipants}`,
      joinedCount: activity.joinedCount,
      maximumNumberOfParticipants: activity.maximumNumberOfParticipants,
      participantAvatars: participants.map((p) => avatarById.get(String(p.userId)) ?? null),
      descriptions: activity.descriptions,
      difficulty: activity.difficulty,
      activityEquipment: activity.activityEquipment,
      activityDuration: activity.activityDuration,
      organizer: {
        id: String(activity.organizerId),
        firstName: organizer?.firstName ?? '',
        lastName: organizer?.lastName ?? '',
        email: organizer?.email ?? '',
        profilePhoto: organizer?.profilePhoto ?? null,
      },
      minAge: activity.minAge,
      maxAge: activity.maxAge,
      ageLimit: `${activity.minAge} Years to ${activity.maxAge} Years`,
      price: activity.price,
      status: activity.status,
      rejectionReason: activity.rejectionReason,
      isJoined,
      isFavorite,
      createdAt: activity.createdAt,
    };
  }
}
