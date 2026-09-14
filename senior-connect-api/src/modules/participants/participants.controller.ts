import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/api-response.interface';
import { ParticipantsService } from './participants.service';
import { PARTICIPANTS_ROUTES } from './participants.routes';
import { ListParticipantsDto } from './dto';
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe';

@Controller(PARTICIPANTS_ROUTES.ROOT)
export class ParticipantsController {
  constructor(private readonly participantsService: ParticipantsService) {}

  /** Join an activity */
  @Post(PARTICIPANTS_ROUTES.JOIN)
  join(
    @CurrentUser() user: AuthenticatedUser,
    @Param('activityId', ParseObjectIdPipe) activityId: string,
  ) {
    return this.participantsService.join(user, activityId);
  }

  /** Leave an activity */
  @Delete(PARTICIPANTS_ROUTES.LEAVE)
  leave(
    @CurrentUser() user: AuthenticatedUser,
    @Param('activityId', ParseObjectIdPipe) activityId: string,
  ) {
    return this.participantsService.leave(user, activityId);
  }

  /**
   * Organizer removes a participant from their own activity.
   *
   * Ejects from this activity only — it does not block the user. A client
   * offering "Remove and block" calls `POST /users/:userId/block` as well.
   */
  @Delete(PARTICIPANTS_ROUTES.REMOVE)
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('activityId', ParseObjectIdPipe) activityId: string,
    @Param('userId', ParseObjectIdPipe) userId: string,
  ) {
    return this.participantsService.remove(user, activityId, userId);
  }

  /** Participants of an activity */
  @Get(PARTICIPANTS_ROUTES.LIST)
  list(
    @Param('activityId', ParseObjectIdPipe) activityId: string,
    @Query() query: ListParticipantsDto,
  ) {
    return this.participantsService.list(activityId, query);
  }
}
