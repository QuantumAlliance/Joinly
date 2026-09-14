









import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums';
import { AuthenticatedUser } from '../../common/interfaces/api-response.interface';
import { ActivitiesService } from './activities.service';
import { ACTIVITIES_ROUTES } from './activities.routes';
import {
  ActivitySuggestionsDto,
  ActivitySummaryDto,
  AdminListActivitiesDto,
  CreateActivityDto,
  DiscoverActivitiesDto,
  MyActivitiesDto,
  UpdateActivityDto,
  UpdateActivityStatusDto,
} from './dto';
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe';

@Controller(ACTIVITIES_ROUTES.ROOT)
export class ActivitiesController {
  constructor(private readonly activitiesService: ActivitiesService) {}

  /** Mobile — Create Activities */
  @Post(ACTIVITIES_ROUTES.LIST)
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateActivityDto) {
    return this.activitiesService.create(user, dto);
  }

  /** Mobile — Discover (search + Apply Filter + map/list) */
  @Get(ACTIVITIES_ROUTES.LIST)
  discover(@CurrentUser() user: AuthenticatedUser, @Query() query: DiscoverActivitiesDto) {
    return this.activitiesService.discover(user, query);
  }

  /** Mobile Home — Featured this weekend */
  @Get(ACTIVITIES_ROUTES.FEATURED)
  featured(@CurrentUser() user: AuthenticatedUser) {
    return this.activitiesService.featured(user);
  }

  /**
   * Mobile Home — hero banner count ("12 activities happening near you today").
   *
   * Declared above `:id`: Nest matches in declaration order, and the param
   * route would otherwise swallow `/summary` and try it as an ObjectId.
   */
  @Get(ACTIVITIES_ROUTES.SUMMARY)
  summary(@CurrentUser() user: AuthenticatedUser, @Query() query: ActivitySummaryDto) {
    return this.activitiesService.summary(user, query);
  }

  /** Mobile Discover — search autocomplete. */
  @Get(ACTIVITIES_ROUTES.SUGGESTIONS)
  suggestions(@CurrentUser() user: AuthenticatedUser, @Query() query: ActivitySuggestionsDto) {
    return this.activitiesService.suggestions(user, query);
  }

  /** Mobile — My Activities (All | Upcoming | Past) */
  @Get(ACTIVITIES_ROUTES.MY_ACTIVITIES)
  myActivities(@CurrentUser() user: AuthenticatedUser, @Query() query: MyActivitiesDto) {
    return this.activitiesService.myActivities(user, query);
  }

  /** Mobile — Joined Activities (All | Upcoming | Past) */
  @Get(ACTIVITIES_ROUTES.JOINED_ACTIVITIES)
  joinedActivities(@CurrentUser() user: AuthenticatedUser, @Query() query: MyActivitiesDto) {
    return this.activitiesService.joinedActivities(user, query);
  }

  /** Admin — moderation list (Pending | Approved | Rejected) */
  @Roles(UserRole.Admin)
  @Get(ACTIVITIES_ROUTES.ADMIN_ACTIVITIES)
  adminList(@Query() query: AdminListActivitiesDto) {
    return this.activitiesService.adminList(query);
  }

  /** Admin — activity details */
  @Roles(UserRole.Admin)
  @Get(ACTIVITIES_ROUTES.ADMIN_ACTIVITY)
  adminDetails(@Param('id', ParseObjectIdPipe) id: string) {
    return this.activitiesService.adminDetails(id);
  }

  /** Admin — Approve / Reject */
  @Roles(UserRole.Admin)
  @Patch(ACTIVITIES_ROUTES.ADMIN_ACTIVITY_STATUS)
  adminUpdateStatus(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdateActivityStatusDto,
  ) {
    return this.activitiesService.adminUpdateStatus(id, dto);
  }

  /** Admin — delete */
  @Roles(UserRole.Admin)
  @Delete(ACTIVITIES_ROUTES.ADMIN_ACTIVITY)
  adminRemove(@Param('id', ParseObjectIdPipe) id: string) {
    return this.activitiesService.adminRemove(id);
  }

  /** Mobile — Activity Details */
  @Get(ACTIVITIES_ROUTES.DETAILS)
  details(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseObjectIdPipe) id: string) {
    return this.activitiesService.details(user, id);
  }

  /** Mobile — organizer updates own activity */
  @Patch(ACTIVITIES_ROUTES.DETAILS)
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdateActivityDto,
  ) {
    return this.activitiesService.update(user, id, dto);
  }

  /** Mobile — organizer deletes own activity */
  @Delete(ACTIVITIES_ROUTES.DETAILS)
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseObjectIdPipe) id: string) {
    return this.activitiesService.remove(user, id);
  }
}
