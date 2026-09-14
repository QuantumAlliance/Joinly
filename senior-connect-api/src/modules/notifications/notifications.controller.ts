import {
  Body,
  Controller,
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
import { NotificationsService } from './notifications.service';
import { NOTIFICATIONS_ROUTES } from './notifications.routes';
import { ComposeNotificationDto, ListNotificationsDto } from './dto';
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe';

@Controller(NOTIFICATIONS_ROUTES.ROOT)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  /** Mobile — my notifications */
  @Get(NOTIFICATIONS_ROUTES.LIST)
  myNotifications(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListNotificationsDto,
  ) {
    return this.notificationsService.myNotifications(user, query);
  }

  /**
   * Mobile Home — bell badge count.
   *
   * Declared above `:id/read` for the usual reason: Nest matches routes in
   * declaration order.
   */
  @Get(NOTIFICATIONS_ROUTES.UNREAD_COUNT)
  unreadCount(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.unreadCount(user);
  }

  /** Mobile — mark as read */
  @Patch(NOTIFICATIONS_ROUTES.READ)
  markAsRead(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseObjectIdPipe) id: string) {
    return this.notificationsService.markAsRead(user, id);
  }

  /** Admin — Compose Notification / Send Notification */
  @Roles(UserRole.Admin)
  @Post(NOTIFICATIONS_ROUTES.ADMIN_NOTIFICATIONS)
  compose(@CurrentUser() user: AuthenticatedUser, @Body() dto: ComposeNotificationDto) {
    return this.notificationsService.compose(user, dto);
  }

  /** Admin — Notification History */
  @Roles(UserRole.Admin)
  @Get(NOTIFICATIONS_ROUTES.ADMIN_NOTIFICATIONS)
  adminList(@Query() query: ListNotificationsDto) {
    return this.notificationsService.adminList(query);
  }
}
