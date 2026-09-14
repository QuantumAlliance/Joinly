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
import { CategoriesService } from './categories.service';
import { CATEGORIES_ROUTES } from './categories.routes';
import {
  AdminListCategoriesDto,
  CreateCategoryDto,
  UpdateCategoryDto,
  UpdateCategoryStatusDto,
} from './dto';
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe';

@Controller(CATEGORIES_ROUTES.ROOT)
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  /** Mobile — active categories (chips, interests picker, create-activity picker) */
  @Get(CATEGORIES_ROUTES.LIST)
  listActive() {
    return this.categoriesService.listActive();
  }

  /**
   * Mobile — "Add Category name" in the Create Activity wizard.
   *
   * Any authenticated user. The category is created as `Pending` and returned
   * immediately, so the activity that proposed it publishes without waiting on
   * an admin. Approval only decides whether it becomes a public chip.
   */
  @Post(CATEGORIES_ROUTES.SUGGEST)
  suggest(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateCategoryDto) {
    return this.categoriesService.suggest(user, dto);
  }

  /** Admin — Add Category */
  @Roles(UserRole.Admin)
  @Post(CATEGORIES_ROUTES.ADMIN_CATEGORIES)
  create(@Body() dto: CreateCategoryDto) {
    return this.categoriesService.create(dto);
  }

  /** Admin — categories table (Category Name, Activity Count, Status) */
  @Roles(UserRole.Admin)
  @Get(CATEGORIES_ROUTES.ADMIN_CATEGORIES)
  adminList(@Query() query: AdminListCategoriesDto) {
    return this.categoriesService.adminList(query);
  }

  /** Admin — edit / enable / disable */
  @Roles(UserRole.Admin)
  @Patch(CATEGORIES_ROUTES.ADMIN_CATEGORY)
  update(@Param('id', ParseObjectIdPipe) id: string, @Body() dto: UpdateCategoryDto) {
    return this.categoriesService.update(id, dto);
  }

  /** Admin — approve (Active) or reject (Disabled) a proposed category */
  @Roles(UserRole.Admin)
  @Patch(CATEGORIES_ROUTES.ADMIN_CATEGORY_STATUS)
  updateStatus(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdateCategoryStatusDto,
  ) {
    return this.categoriesService.updateStatus(id, dto);
  }

  /** Admin — delete */
  @Roles(UserRole.Admin)
  @Delete(CATEGORIES_ROUTES.ADMIN_CATEGORY)
  remove(@Param('id', ParseObjectIdPipe) id: string) {
    return this.categoriesService.remove(id);
  }
}
