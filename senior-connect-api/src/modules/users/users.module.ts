import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Activity, ActivitySchema } from '../activities/schemas';
import { Category, CategorySchema } from '../categories/schemas';
import { ActivityParticipant, ActivityParticipantSchema } from '../participants/schemas';
import { UsersController } from './users.controller';
import { BlockedUser, BlockedUserSchema, User, UserSchema, UserInterest, UserInterestSchema } from './schemas';
import { UsersService } from './users.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: UserInterest.name, schema: UserInterestSchema },
      { name: BlockedUser.name, schema: BlockedUserSchema },
      { name: Category.name, schema: CategorySchema },
      { name: Activity.name, schema: ActivitySchema },
      { name: ActivityParticipant.name, schema: ActivityParticipantSchema },
    ]),
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
