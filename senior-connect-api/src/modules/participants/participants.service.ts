import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ActivityStatus, ParticipantStatus } from '../../common/enums';
import {
  AuthenticatedUser,
  ServiceResponse,
} from '../../common/interfaces/api-response.interface';
import { idOf, toObjectId } from '../../common/schema.helpers';
import { buildMeta, getPagination } from '../../common/utils/pagination.util';
import { Activity, ActivityDocument } from '../activities/schemas';
import { User, UserDocument } from '../users/schemas';
import { ParticipantItem } from './interfaces/participants.interface';
import { ActivityParticipant, ActivityParticipantDocument } from './schemas';
import { ListParticipantsDto } from './dto';

/** Mongo duplicate-key error code. */
const DUPLICATE_KEY = 11000;

@Injectable()
export class ParticipantsService {
  constructor(
    @InjectModel(ActivityParticipant.name)
    private readonly participantModel: Model<ActivityParticipantDocument>,
    @InjectModel(Activity.name) private readonly activityModel: Model<ActivityDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  /** Figma Activity Details — Join ("✓ You're going!") */
  async join(
    currentUser: AuthenticatedUser,
    activityId: string,
  ): Promise<ServiceResponse<{ participants: string }>> {
    const id = toObjectId(activityId);
    if (!id) throw new NotFoundException('Activity not found');

    const activity = await this.activityModel.findById(id);
    if (!activity) throw new NotFoundException('Activity not found');
    if (activity.status !== ActivityStatus.Approved) {
      throw new BadRequestException('This activity is not open for joining');
    }

    const userId = new Types.ObjectId(currentUser.userId);
    if (activity.organizerId.equals(userId)) {
      throw new BadRequestException('You are the organizer of this activity');
    }

    const existing = await this.participantModel.findOne({ activityId: id, userId });
    if (existing?.status === ParticipantStatus.Joined) {
      throw new ConflictException('You have already joined this activity');
    }
    // Removal is the organizer's decision and has to stick. Without this a
    // removed participant simply presses Join again and is back in the seat.
    if (existing?.status === ParticipantStatus.Removed) {
      throw new ForbiddenException('The organizer removed you from this activity');
    }

    // "Age Limit" enforcement
    const user = await this.userModel.findById(userId);
    if (user?.dateOfBirth) {
      const age = this.calculateAge(user.dateOfBirth);
      if (age < activity.minAge || age > activity.maxAge) {
        throw new BadRequestException(
          `Age Limit: ${activity.minAge} Years to ${activity.maxAge} Years`,
        );
      }
    }

    // Claim a seat atomically. The $expr guard means capacity is tested and the
    // counter incremented in one document update, so concurrent joins cannot
    // both read "one seat left" and both take it.
    const claimed = await this.activityModel.findOneAndUpdate(
      {
        _id: id,
        status: ActivityStatus.Approved,
        $expr: { $lt: ['$joinedCount', '$maximumNumberOfParticipants'] },
      },
      { $inc: { joinedCount: 1 } },
      { new: true },
    );
    if (!claimed) throw new ConflictException('This activity is full');

    try {
      // Excluding Joined is what makes this safe under concurrency: if another
      // in-flight request already marked the row Joined, this filter misses,
      // the upsert falls through to an insert, and the unique index on
      // (activityId, userId) rejects it — so the duplicate seat is released
      // below instead of being silently kept.
      //
      // Removed is excluded for a different reason: the read above can race a
      // removal, and without it the upsert would quietly flip an ejected
      // participant back to Joined. Here it takes the same insert-and-fail
      // path, so the seat is handed back.
      await this.participantModel.findOneAndUpdate(
        {
          activityId: id,
          userId,
          status: { $nin: [ParticipantStatus.Joined, ParticipantStatus.Removed] },
        },
        { $set: { status: ParticipantStatus.Joined, joinedAt: new Date() } },
        { upsert: true, new: true },
      );
    } catch (error) {
      // Lost an upsert race — give the seat back rather than leaking capacity.
      await this.releaseSeat(id);
      if ((error as { code?: number }).code === DUPLICATE_KEY) {
        throw new ConflictException('You have already joined this activity');
      }
      throw error;
    }

    return {
      message: "You're going!",
      data: {
        participants: `${claimed.joinedCount}/${claimed.maximumNumberOfParticipants}`,
      },
    };
  }

  /** Leave a joined activity */
  async leave(currentUser: AuthenticatedUser, activityId: string): Promise<ServiceResponse<null>> {
    const id = toObjectId(activityId);
    if (!id) throw new NotFoundException('You have not joined this activity');

    // Only a row that is currently Joined may be cancelled, so a repeated call
    // cannot decrement the counter twice.
    const participant = await this.participantModel.findOneAndUpdate(
      { activityId: id, userId: new Types.ObjectId(currentUser.userId), status: ParticipantStatus.Joined },
      { $set: { status: ParticipantStatus.Cancelled } },
    );
    if (!participant) throw new NotFoundException('You have not joined this activity');

    await this.releaseSeat(id);
    return { message: 'You left the activity', data: null };
  }

  /**
   * Figma Participants list — the organizer ejects someone from their own
   * activity.
   *
   * Organizer-only, and scoped to this activity alone. It deliberately does
   * **not** touch the actor's personal block list: a block is bidirectional and
   * account-wide (see `visibilityFilter` in `activities.service`), so it would
   * hide every one of the organizer's activities from that user, and theirs
   * from the organizer, forever — an enormous, invisible consequence for
   * "remove from this event", and one that un-removing would not undo. A
   * client offering "Remove and block" calls `POST /users/:userId/block` as
   * well; the two actions stay separately named and separately reversible.
   */
  async remove(
    currentUser: AuthenticatedUser,
    activityId: string,
    userId: string,
  ): Promise<ServiceResponse<{ participants: string }>> {
    const id = toObjectId(activityId);
    const targetId = toObjectId(userId);
    if (!id) throw new NotFoundException('Activity not found');
    if (!targetId) throw new NotFoundException('This user is not a participant');

    const activity = await this.activityModel.findById(id);
    if (!activity) throw new NotFoundException('Activity not found');
    if (!activity.organizerId.equals(new Types.ObjectId(currentUser.userId))) {
      throw new ForbiddenException('Only the organizer can remove a participant');
    }
    if (activity.organizerId.equals(targetId)) {
      throw new BadRequestException('You cannot remove yourself from your own activity');
    }

    // Only a currently-Joined row transitions, in one atomic update — the same
    // guard `leave()` uses, so a repeated call cannot decrement joinedCount
    // twice and leave the activity looking emptier than it is.
    const participant = await this.participantModel.findOneAndUpdate(
      { activityId: id, userId: targetId, status: ParticipantStatus.Joined },
      { $set: { status: ParticipantStatus.Removed } },
    );
    if (!participant) throw new NotFoundException('This user is not a participant');

    // Same path as leave() — the joinedCount gotcha in CLAUDE.md.
    await this.releaseSeat(id);

    const updated = await this.activityModel.findById(id);
    return {
      message: 'Participant removed',
      data: {
        participants: `${updated?.joinedCount ?? 0}/${activity.maximumNumberOfParticipants}`,
      },
    };
  }

  /** Participants list (name, country, age) */
  async list(
    activityId: string,
    query: ListParticipantsDto,
  ): Promise<ServiceResponse<ParticipantItem[]>> {
    const id = toObjectId(activityId);
    if (!id) throw new NotFoundException('Activity not found');
    const activity = await this.activityModel.exists({ _id: id });
    if (!activity) throw new NotFoundException('Activity not found');

    const { page, limit, skip } = getPagination(query);
    const filter = { activityId: id, status: ParticipantStatus.Joined };

    const [participants, total] = await Promise.all([
      this.participantModel.find(filter).sort({ joinedAt: 1 }).skip(skip).limit(limit),
      this.participantModel.countDocuments(filter),
    ]);

    const users = await this.userModel.find({ _id: { $in: participants.map((p) => p.userId) } });
    const userById = new Map(users.map((u) => [idOf(u), u]));

    const data: ParticipantItem[] = participants.flatMap((p) => {
      const user = userById.get(String(p.userId));
      if (!user) return [];
      return [
        {
          id: idOf(p),
          userId: String(p.userId),
          firstName: user.firstName,
          lastName: user.lastName,
          profilePhoto: user.profilePhoto,
          country: user.country,
          age: user.dateOfBirth ? this.calculateAge(user.dateOfBirth) : null,
          joinedAt: p.joinedAt,
        },
      ];
    });

    return {
      message: 'Participants retrieved successfully',
      data,
      meta: buildMeta(page, limit, total),
    };
  }

  /** Hand a seat back, never letting the counter fall below zero. */
  private async releaseSeat(activityId: Types.ObjectId): Promise<void> {
    await this.activityModel.updateOne(
      { _id: activityId, joinedCount: { $gt: 0 } },
      { $inc: { joinedCount: -1 } },
    );
  }

  private calculateAge(dateOfBirth: string): number {
    const dob = new Date(dateOfBirth);
    const now = new Date();
    let age = now.getFullYear() - dob.getFullYear();
    const monthDiff = now.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) age -= 1;
    return age;
  }
}
