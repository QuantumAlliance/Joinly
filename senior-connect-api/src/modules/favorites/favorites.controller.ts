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
import { FavoritesService } from './favorites.service';
import { FAVORITES_ROUTES } from './favorites.routes';
import { ListFavoritesDto } from './dto';
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe';

@Controller(FAVORITES_ROUTES.ROOT)
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  /** Favorite Activities list */
  @Get(FAVORITES_ROUTES.LIST)
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: ListFavoritesDto) {
    return this.favoritesService.list(user, query);
  }

  /** Add favorite */
  @Post(FAVORITES_ROUTES.ACTIVITY)
  add(
    @CurrentUser() user: AuthenticatedUser,
    @Param('activityId', ParseObjectIdPipe) activityId: string,
  ) {
    return this.favoritesService.add(user, activityId);
  }

  /** Remove favorite */
  @Delete(FAVORITES_ROUTES.ACTIVITY)
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('activityId', ParseObjectIdPipe) activityId: string,
  ) {
    return this.favoritesService.remove(user, activityId);
  }
}
