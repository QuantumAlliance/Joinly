import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Activity, ActivitySchema } from '../activities/schemas';
import { Category, CategorySchema } from '../categories/schemas';
import { ActivityParticipant, ActivityParticipantSchema } from '../participants/schemas';
import { User, UserSchema } from '../users/schemas';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Activity.name, schema: ActivitySchema },
      { name: Category.name, schema: CategorySchema },
      { name: ActivityParticipant.name, schema: ActivityParticipantSchema },
    ])],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
