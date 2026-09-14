import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Activity, ActivitySchema } from '../activities/schemas';
import { User, UserSchema } from '../users/schemas';
import { ParticipantsController } from './participants.controller';
import { ActivityParticipant, ActivityParticipantSchema } from './schemas';
import { ParticipantsService } from './participants.service';

@Module({
  imports: [MongooseModule.forFeature([
      { name: ActivityParticipant.name, schema: ActivityParticipantSchema },
      { name: Activity.name, schema: ActivitySchema },
      { name: User.name, schema: UserSchema },
    ])],
  controllers: [ParticipantsController],
  providers: [ParticipantsService],
})
export class ParticipantsModule {}
