import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Category, CategorySchema } from '../categories/schemas';
import { Favorite, FavoriteSchema } from '../favorites/schemas';
import { ActivityParticipant, ActivityParticipantSchema } from '../participants/schemas';
import { BlockedUser, BlockedUserSchema, User, UserSchema } from '../users/schemas';
import { ActivitiesController } from './activities.controller';
import { Activity, ActivitySchema } from './schemas';
import { ActivitiesService } from './activities.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Activity.name, schema: ActivitySchema },
      { name: Category.name, schema: CategorySchema },
      { name: ActivityParticipant.name, schema: ActivityParticipantSchema },
      { name: Favorite.name, schema: FavoriteSchema },
      { name: BlockedUser.name, schema: BlockedUserSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [ActivitiesController],
  providers: [ActivitiesService],
  exports: [ActivitiesService],
})
export class ActivitiesModule {}
