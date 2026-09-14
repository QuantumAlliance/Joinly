import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { ParticipantStatus, UserRole, UserStatus } from '../../common/enums';
import {
  AuthenticatedUser,
  ServiceResponse,
} from '../../common/interfaces/api-response.interface';
import { geoPoint, idOf, toObjectId } from '../../common/schema.helpers';
import { buildMeta, getPagination } from '../../common/utils/pagination.util';
import { normalizePhone } from '../../common/utils/phone.util';
import { Activity, ActivityDocument } from '../activities/schemas';
import { Category, CategoryDocument } from '../categories/schemas';
import { ActivityParticipant, ActivityParticipantDocument } from '../participants/schemas';
import {
  AdminUserDetails,
  AdminUserRow,
  BlockedUserRow,
  CompletenessStep,
  MyProfileResponse,
  ProfileCompleteness,
  UserProfile,
} from './interfaces/users.interface';
import {
  BlockedUser,
  BlockedUserDocument,
  User,
  UserDocument,
  UserInterest,
  UserInterestDocument,
} from './schemas';
import {
  AdminListUsersDto,
  UpdateAppPreferencesDto,
  UpdateInterestsDto,
  UpdateLocationDto,
  UpdateProfileDto,
  UpdateProfilePhotoDto,
  UpdateUserStatusDto,
} from './dto';

/** Escape user input before it reaches a $regex. */
const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(UserInterest.name)
    private readonly userInterestModel: Model<UserInterestDocument>,
    @InjectModel(BlockedUser.name)
    private readonly blockedUserModel: Model<BlockedUserDocument>,
    @InjectModel(Category.name) private readonly categoryModel: Model<CategoryDocument>,
    @InjectModel(Activity.name) private readonly activityModel: Model<ActivityDocument>,
    @InjectModel(ActivityParticipant.name)
    private readonly participantModel: Model<ActivityParticipantDocument>,
  ) {}

  /** Figma Profile screen — profile + counters + interests */
  async getMyProfile(currentUser: AuthenticatedUser): Promise<ServiceResponse<MyProfileResponse>> {
    const data = await this.buildProfile(currentUser.userId);
    return { message: 'Profile retrieved successfully', data };
  }

  /**
   * Figma Profile — the completeness ring.
   *
   * Pure derivation from fields that already exist; nothing is stored. The four
   * steps are the ones the frame draws, in the order it draws them, and each
   * weighs the same — a ring with weighted segments would need the weights
   * published somewhere for the client to render it honestly, and the design
   * does not have that.
   */
  async completeness(
    currentUser: AuthenticatedUser,
  ): Promise<ServiceResponse<ProfileCompleteness>> {
    const user = await this.findById(currentUser.userId);
    const interestCount = await this.userInterestModel.countDocuments({
      userId: new Types.ObjectId(currentUser.userId),
    });

    const steps: CompletenessStep[] = [
      {
        key: 'name',
        label: 'Add your name',
        // Always true today: both halves are required at registration. Kept
        // because the frame draws the step, and it is the one that would start
        // reading false if a social sign-in ever created an account without one.
        done: Boolean(user.firstName?.trim() && user.lastName?.trim()),
      },
      {
        key: 'interests',
        // Any interest counts. The "at least 3" rule belongs to the onboarding
        // form that writes them; a ring that called one interest "not done"
        // would be reporting on a rule the user has already moved past.
        label: 'Choose your interests',
        done: interestCount > 0,
      },
      {
        key: 'location',
        // Either half of what updateLocation accepts — GPS or a typed
        // country/region/city. Demanding both would mark a manual entry
        // incomplete for skipping a permission prompt.
        label: 'Set your location',
        done: Boolean(
          user.country || user.region || user.city || (user.latitude !== null && user.longitude !== null),
        ),
      },
      {
        key: 'profilePhoto',
        label: 'Add a profile photo',
        done: Boolean(user.profilePhoto),
      },
    ];

    const completed = steps.filter((step) => step.done).length;
    return {
      message: 'Profile completeness retrieved successfully',
      data: {
        percentage: Math.round((completed / steps.length) * 100),
        completed,
        total: steps.length,
        steps,
      },
    };
  }

  /** Figma "Edit Profile" — firstName, lastName, phoneNumber, dateOfBirth */
  async updateProfile(
    currentUser: AuthenticatedUser,
    dto: UpdateProfileDto,
  ): Promise<ServiceResponse<UserProfile>> {
    const user = await this.findById(currentUser.userId);
    Object.assign(user, dto);

    // Phone is a login identifier since Phase 2, not just a displayed field.
    // Editing either half here has to re-derive the canonical number and drop
    // the verified flag — otherwise the account keeps signing in with the old
    // number, and claims a new one it has never proven.
    if (dto.phoneCountryCode !== undefined || dto.phoneNumber !== undefined) {
      const phoneE164 = normalizePhone(user.phoneCountryCode, user.phoneNumber);
      if (user.phoneCountryCode && user.phoneNumber && !phoneE164) {
        throw new BadRequestException('phoneCountryCode and phoneNumber must form a valid number');
      }
      if (phoneE164 && phoneE164 !== user.phoneE164) {
        const taken = await this.userModel.findOne({ phoneE164, isPhoneVerified: true });
        if (taken && idOf(taken) !== idOf(user)) {
          throw new ConflictException('This phone number is already in use by another account');
        }
        user.phoneE164 = phoneE164;
        user.isPhoneVerified = false;
      } else if (!phoneE164) {
        user.phoneE164 = null;
        user.isPhoneVerified = false;
      }
    }

    await user.save();
    return { message: 'Profile updated successfully', data: this.toProfile(user) };
  }

  /** Onboarding 1 of 3 — "Your location" */
  async updateLocation(
    currentUser: AuthenticatedUser,
    dto: UpdateLocationDto,
  ): Promise<ServiceResponse<UserProfile>> {
    const hasGps = dto.latitude !== undefined && dto.longitude !== undefined;
    const hasManual = Boolean(dto.country || dto.region || dto.city);
    if (!hasGps && !hasManual) {
      throw new BadRequestException(
        'Provide GPS coordinates (Enable Location) or country/region/city (Enter Location Manually)',
      );
    }
    const user = await this.findById(currentUser.userId);
    Object.assign(user, dto);
    // Keep the 2dsphere mirror in step with the plain ordinates.
    const point = geoPoint(user.latitude, user.longitude);
    if (point) user.location = point;
    await user.save();
    return { message: 'Location updated successfully', data: this.toProfile(user) };
  }

  /** Onboarding 2 of 3 — "Choose Interests" */
  async updateInterests(
    currentUser: AuthenticatedUser,
    dto: UpdateInterestsDto,
  ): Promise<ServiceResponse<{ interests: { id: string; categoryName: string }[] }>> {
    // De-duplicate first: a repeated id would otherwise violate the unique
    // (userId, categoryId) index and surface as a 500.
    const unique = [...new Set(dto.categoryIds)];
    const ids = unique.map(toObjectId);
    if (ids.some((id) => id === null)) {
      throw new BadRequestException('One or more selected interests do not exist');
    }
    const categoryIds = ids as Types.ObjectId[];

    const categories = await this.categoryModel.find({ _id: { $in: categoryIds } });
    if (categories.length !== unique.length) {
      throw new BadRequestException('One or more selected interests do not exist');
    }

    const userId = new Types.ObjectId(currentUser.userId);
    await this.userInterestModel.deleteMany({ userId });
    if (categoryIds.length > 0) {
      await this.userInterestModel.insertMany(
        categoryIds.map((categoryId) => ({ userId, categoryId })),
        { ordered: false },
      );
    }

    return {
      message: 'Interests updated successfully',
      data: {
        interests: categories.map((c) => ({ id: idOf(c), categoryName: c.categoryName })),
      },
    };
  }

  /** Onboarding 3 of 3 — "Profile Photo" */
  async updateProfilePhoto(
    currentUser: AuthenticatedUser,
    dto: UpdateProfilePhotoDto,
  ): Promise<ServiceResponse<UserProfile>> {
    const user = await this.findById(currentUser.userId);
    user.profilePhoto = dto.profilePhoto;
    await user.save();
    return { message: 'Profile photo updated successfully', data: this.toProfile(user) };
  }

  /** Figma "App Preferences" — Language, Date Format, Notification Sounds */
  async updateAppPreferences(
    currentUser: AuthenticatedUser,
    dto: UpdateAppPreferencesDto,
  ): Promise<ServiceResponse<UserProfile>> {
    const user = await this.findById(currentUser.userId);
    Object.assign(user, dto);
    await user.save();
    return { message: 'App preferences updated successfully', data: this.toProfile(user) };
  }

  /** Figma participant profile — "Block" */
  async blockUser(currentUser: AuthenticatedUser, userId: string): Promise<ServiceResponse<null>> {
    if (currentUser.userId === userId) {
      throw new BadRequestException('You cannot block yourself');
    }
    const blocked = await this.findById(userId);
    const blockerId = new Types.ObjectId(currentUser.userId);

    const existing = await this.blockedUserModel.exists({ blockerId, blockedId: blocked._id });
    if (existing) throw new ConflictException('User is already blocked');

    await this.blockedUserModel.create({ blockerId, blockedId: blocked._id });
    return { message: 'User blocked successfully', data: null };
  }

  async unblockUser(currentUser: AuthenticatedUser, userId: string): Promise<ServiceResponse<null>> {
    const blockedId = toObjectId(userId);
    if (!blockedId) throw new NotFoundException('User is not blocked');

    const removed = await this.blockedUserModel.findOneAndDelete({
      blockerId: new Types.ObjectId(currentUser.userId),
      blockedId,
    });
    if (!removed) throw new NotFoundException('User is not blocked');
    return { message: 'User unblocked successfully', data: null };
  }

  /** Figma Profile — "Blocked Users" screen */
  async listBlockedUsers(
    currentUser: AuthenticatedUser,
  ): Promise<ServiceResponse<BlockedUserRow[]>> {
    const rows = await this.blockedUserModel
      .find({ blockerId: new Types.ObjectId(currentUser.userId) })
      .sort({ createdAt: -1 });

    const users = await this.userModel.find({ _id: { $in: rows.map((r) => r.blockedId) } });
    const userById = new Map(users.map((u) => [idOf(u), u]));

    const data: BlockedUserRow[] = rows.flatMap((row) => {
      const user = userById.get(String(row.blockedId));
      if (!user) return [];
      return [
        {
          id: idOf(user),
          firstName: user.firstName,
          lastName: user.lastName,
          profilePhoto: user.profilePhoto,
        },
      ];
    });
    return { message: 'Blocked users retrieved successfully', data };
  }

  /** Admin Users table — search by name, email or country; tabs All/Active/Blocked */
  async adminListUsers(query: AdminListUsersDto): Promise<ServiceResponse<AdminUserRow[]>> {
    const { page, limit, skip } = getPagination(query);
    const filter: FilterQuery<UserDocument> = { role: UserRole.User };

    if (query.search) {
      const search = { $regex: escapeRegex(query.search), $options: 'i' };
      filter.$or = [
        { firstName: search },
        { lastName: search },
        { email: search },
        { country: search },
      ];
    }
    if (query.status) {
      filter.status = query.status;
    } else if (query.tab === 'Active Users') {
      filter.status = UserStatus.Active;
    } else if (query.tab === 'Blocked Users') {
      filter.status = UserStatus.Blocked;
    }

    const [users, total] = await Promise.all([
      this.userModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      this.userModel.countDocuments(filter),
    ]);

    // Two grouped counts for the whole page rather than two queries per row.
    const userIds = users.map((u) => u._id);
    const [organised, joined] = await Promise.all([
      this.activityModel.aggregate<{ _id: unknown; count: number }>([
        { $match: { organizerId: { $in: userIds } } },
        { $group: { _id: '$organizerId', count: { $sum: 1 } } },
      ]),
      this.participantModel.aggregate<{ _id: unknown; count: number }>([
        { $match: { userId: { $in: userIds }, status: ParticipantStatus.Joined } },
        { $group: { _id: '$userId', count: { $sum: 1 } } },
      ]),
    ]);
    const organisedBy = new Map(organised.map((r) => [String(r._id), r.count]));
    const joinedBy = new Map(joined.map((r) => [String(r._id), r.count]));

    const rows: AdminUserRow[] = users.map((user) => ({
      id: idOf(user),
      firstName: user.firstName,
      lastName: user.lastName,
      profilePhoto: user.profilePhoto,
      email: user.email,
      country: user.country,
      activities: (organisedBy.get(idOf(user)) ?? 0) + (joinedBy.get(idOf(user)) ?? 0),
      status: user.status,
      dateJoined: user.createdAt,
    }));

    return {
      message: 'Users retrieved successfully',
      data: rows,
      meta: buildMeta(page, limit, total),
    };
  }

  /** Admin "User Details" page */
  async adminUserDetails(userId: string): Promise<ServiceResponse<AdminUserDetails>> {
    const profile = await this.buildProfile(userId);
    const id = new Types.ObjectId(userId);

    const [createdActivities, joined] = await Promise.all([
      this.activityModel.find({ organizerId: id }).sort({ activityDate: -1 }).limit(10),
      this.participantModel
        .find({ userId: id, status: ParticipantStatus.Joined })
        .sort({ joinedAt: -1 })
        .limit(10),
    ]);

    const joinedActivities = await this.activityModel.find({
      _id: { $in: joined.map((p) => p.activityId) },
    });

    const all = [...createdActivities, ...joinedActivities];
    const categories = await this.categoryModel.find({
      _id: { $in: all.map((a) => a.categoryId) },
    });
    const categoryNameById = new Map(categories.map((c) => [idOf(c), c.categoryName]));

    const toRow = (activity: ActivityDocument): Record<string, unknown> => ({
      id: idOf(activity),
      activityName: activity.activityName,
      categoryName: categoryNameById.get(String(activity.categoryId)) ?? '',
      activityDate: activity.activityDate,
      status: activity.status,
    });

    const data: AdminUserDetails = {
      ...profile,
      activitiesJoined: profile.activityJoined,
      activitiesCreated: profile.activityCreated,
      joinedActivities: joinedActivities.map(toRow),
      createdActivities: createdActivities.map(toRow),
    };
    return { message: 'User details retrieved successfully', data };
  }

  /** Admin — Active / Inactive / Suspended / Blocked ("Block user") */
  async adminUpdateUserStatus(
    userId: string,
    dto: UpdateUserStatusDto,
  ): Promise<ServiceResponse<UserProfile>> {
    const user = await this.findById(userId);
    user.status = dto.status;
    await user.save();
    return { message: `User status updated to ${dto.status}`, data: this.toProfile(user) };
  }

  // ---------- helpers ----------

  private async findById(id: string): Promise<UserDocument> {
    const objectId = toObjectId(id);
    const user = objectId ? await this.userModel.findById(objectId) : null;
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  private toProfile(user: UserDocument): UserProfile {
    return {
      id: idOf(user),
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phoneCountryCode: user.phoneCountryCode,
      phoneNumber: user.phoneNumber,
      phoneE164: user.phoneE164,
      dateOfBirth: user.dateOfBirth,
      language: user.language,
      profilePhoto: user.profilePhoto,
      country: user.country,
      region: user.region,
      city: user.city,
      latitude: user.latitude,
      longitude: user.longitude,
      role: user.role,
      status: user.status,
      dateFormat: user.dateFormat,
      notificationSounds: user.notificationSounds,
      allowNotifications: user.allowNotifications,
      isEmailVerified: user.isEmailVerified,
      isPhoneVerified: user.isPhoneVerified,
      memberSince: user.createdAt,
    };
  }

  private async buildProfile(userId: string): Promise<MyProfileResponse> {
    const user = await this.findById(userId);
    const id = user._id;

    const [activityJoined, activityCreated, connectionRows, interests] = await Promise.all([
      this.participantModel.countDocuments({ userId: id, status: ParticipantStatus.Joined }),
      this.activityModel.countDocuments({ organizerId: id }),
      // "Connections" — distinct people met through shared activities.
      this.participantModel.aggregate<{ _id: null; count: number }>([
        { $match: { userId: id, status: ParticipantStatus.Joined } },
        {
          $lookup: {
            from: 'activity_participants',
            localField: 'activityId',
            foreignField: 'activityId',
            as: 'others',
          },
        },
        { $unwind: '$others' },
        { $match: { $expr: { $ne: ['$others.userId', id] } } },
        { $group: { _id: null, users: { $addToSet: '$others.userId' } } },
        { $project: { count: { $size: '$users' } } },
      ]),
      this.userInterestModel.find({ userId: id }),
    ]);

    const interestCategories = await this.categoryModel.find({
      _id: { $in: interests.map((i) => i.categoryId) },
    });

    return {
      ...this.toProfile(user),
      activityJoined,
      activityCreated,
      connections: connectionRows[0]?.count ?? 0,
      interests: interestCategories.map((c) => ({
        id: idOf(c),
        categoryName: c.categoryName,
      })),
    };
  }
}
