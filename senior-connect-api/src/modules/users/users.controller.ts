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
import { UsersService } from './users.service';
import { USERS_ROUTES } from './users.routes';
import {
  AdminListUsersDto,
  UpdateAppPreferencesDto,
  UpdateInterestsDto,
  UpdateLocationDto,
  UpdateProfileDto,
  UpdateProfilePhotoDto,
  UpdateUserStatusDto,
} from './dto';
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe';

@Controller(USERS_ROUTES.ROOT)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /** Mobile — Profile screen */
  @Get(USERS_ROUTES.ME)
  getMyProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.getMyProfile(user);
  }

  /** Mobile — profile completeness ring. Derived; nothing is stored. */
  @Get(USERS_ROUTES.ME_COMPLETENESS)
  completeness(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.completeness(user);
  }

  /** Mobile — Edit Profile Info. */
  @Patch(USERS_ROUTES.ME)
  updateProfile(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(user, dto);
  }

  /** Onboarding 1 of 3 — Your location */
  @Patch(USERS_ROUTES.ME_LOCATION)
  updateLocation(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateLocationDto) {
    return this.usersService.updateLocation(user, dto);
  }

  /** Onboarding 2 of 3 — Choose Interests */
  @Patch(USERS_ROUTES.ME_INTERESTS)
  updateInterests(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateInterestsDto) {
    return this.usersService.updateInterests(user, dto);
  }

  /** Onboarding 3 of 3 — Profile Photo */
  @Patch(USERS_ROUTES.ME_PROFILE_PHOTO)
  updateProfilePhoto(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProfilePhotoDto,
  ) {
    return this.usersService.updateProfilePhoto(user, dto);
  }

  /** Mobile — App Preferences */
  @Patch(USERS_ROUTES.ME_APP_PREFERENCES)
  updateAppPreferences(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateAppPreferencesDto,
  ) {
    return this.usersService.updateAppPreferences(user, dto);
  }

  /** Mobile — Blocked Users screen */
  @Get(USERS_ROUTES.ME_BLOCKED_USERS)
  listBlockedUsers(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.listBlockedUsers(user);
  }

  /** Mobile — Block a user */
  @Post(USERS_ROUTES.BLOCK_USER)
  blockUser(
    @CurrentUser() user: AuthenticatedUser,
    @Param('userId', ParseObjectIdPipe) userId: string,
  ) {
    return this.usersService.blockUser(user, userId);
  }

  /** Mobile — Unblock a user */
  @Delete(USERS_ROUTES.BLOCK_USER)
  unblockUser(
    @CurrentUser() user: AuthenticatedUser,
    @Param('userId', ParseObjectIdPipe) userId: string,
  ) {
    return this.usersService.unblockUser(user, userId);
  }

  /** Admin — Users table */
  @Roles(UserRole.Admin)
  @Get(USERS_ROUTES.ADMIN_USERS)
  adminListUsers(@Query() query: AdminListUsersDto) {
    return this.usersService.adminListUsers(query);
  }

  /** Admin — User Details */
  @Roles(UserRole.Admin)
  @Get(USERS_ROUTES.ADMIN_USER_DETAILS)
  adminUserDetails(@Param('userId', ParseObjectIdPipe) userId: string) {
    return this.usersService.adminUserDetails(userId);
  }

  /** Admin — Block user / change status */
  @Roles(UserRole.Admin)
  @Patch(USERS_ROUTES.ADMIN_USER_STATUS)
  adminUpdateUserStatus(
    @Param('userId', ParseObjectIdPipe) userId: string,
    @Body() dto: UpdateUserStatusDto,
  ) {
    return this.usersService.adminUpdateUserStatus(userId, dto);
  }
}
