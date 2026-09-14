import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { CategoryStatus } from '../../common/enums';
import {
  AuthenticatedUser,
  ServiceResponse,
} from '../../common/interfaces/api-response.interface';
import { idOf, toObjectId } from '../../common/schema.helpers';
import { buildMeta, getPagination } from '../../common/utils/pagination.util';
import { Activity, ActivityDocument } from '../activities/schemas';
import { User, UserDocument } from '../users/schemas';
import {
  AdminCategoryRow,
  AdminCategoryStats,
  CategoryItem,
} from './interfaces/categories.interface';
import { Category, CategoryDocument } from './schemas';
import {
  AdminListCategoriesDto,
  CreateCategoryDto,
  UpdateCategoryDto,
  UpdateCategoryStatusDto,
} from './dto';

/** Escape user input before it reaches a $regex. */
const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

@Injectable()
export class CategoriesService {
  constructor(
    @InjectModel(Category.name) private readonly categoryModel: Model<CategoryDocument>,
    @InjectModel(Activity.name) private readonly activityModel: Model<ActivityDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  /**
   * Mobile — category chips & "Choose Interests".
   *
   * `Active` only. A `Pending` proposal is deliberately absent here: it still
   * renders on the activity that introduced it (activity lookups resolve a
   * category by id, whatever its status), but it does not become a chip for
   * everyone else until an admin approves it. That is the whole of what
   * approval decides.
   */
  async listActive(): Promise<ServiceResponse<CategoryItem[]>> {
    const categories = await this.categoryModel
      .find({ status: CategoryStatus.Active })
      .sort({ categoryName: 1 });
    return { message: 'Categories retrieved successfully', data: categories.map(this.toItem) };
  }

  /** Admin — "Add Category". Live immediately; an admin needs no review. */
  async create(dto: CreateCategoryDto): Promise<ServiceResponse<CategoryItem>> {
    await this.assertNameFree(dto.categoryName);
    const category = await this.categoryModel.create({
      categoryName: dto.categoryName,
      status: CategoryStatus.Active,
    });
    return { message: 'Category created successfully', data: this.toItem(category) };
  }

  /**
   * Mobile — "Add Category name" from the Create Activity wizard.
   *
   * Created as `Pending` and returned straight away, so the caller can attach
   * it to the activity it is about to publish. Nothing waits on an admin.
   *
   * An existing name is returned rather than rejected: the user asked for a
   * category by that name and one exists, so handing it back is the answer to
   * their request. A 409 would only push the client into re-searching for a
   * row this method is already holding.
   */
  async suggest(
    currentUser: AuthenticatedUser,
    dto: CreateCategoryDto,
  ): Promise<ServiceResponse<CategoryItem>> {
    const existing = await this.findByName(dto.categoryName);
    if (existing) {
      return { message: 'Category already exists', data: this.toItem(existing) };
    }

    const category = await this.categoryModel.create({
      categoryName: dto.categoryName,
      status: CategoryStatus.Pending,
      proposedBy: new Types.ObjectId(currentUser.userId),
    });
    return {
      message: 'Category submitted for review. You can use it right away.',
      data: this.toItem(category),
    };
  }

  /** Admin — categories table with activityCount + header stats */
  async adminList(
    query: AdminListCategoriesDto,
  ): Promise<ServiceResponse<{ stats: AdminCategoryStats; categories: AdminCategoryRow[] }>> {
    const { page, limit, skip } = getPagination(query);
    const filter: FilterQuery<CategoryDocument> = {
      ...(query.search
        ? { categoryName: { $regex: escapeRegex(query.search), $options: 'i' } }
        : {}),
      ...(query.status ? { status: query.status } : {}),
    };

    const [categories, total, totalCategories, activeNow, pendingReview] = await Promise.all([
      // Newest first: a review queue is read from the top.
      this.categoryModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      this.categoryModel.countDocuments(filter),
      this.categoryModel.countDocuments(),
      this.categoryModel.countDocuments({ status: CategoryStatus.Active }),
      this.categoryModel.countDocuments({ status: CategoryStatus.Pending }),
    ]);

    // One grouped count for the whole page rather than a query per row.
    const [counts, proposers] = await Promise.all([
      this.activityModel.aggregate<{ _id: unknown; count: number }>([
        { $match: { categoryId: { $in: categories.map((c) => c._id) } } },
        { $group: { _id: '$categoryId', count: { $sum: 1 } } },
      ]),
      this.userModel.find({
        _id: { $in: categories.map((c) => c.proposedBy).filter((id) => id !== null) },
      }),
    ]);
    const countByCategory = new Map(counts.map((c) => [String(c._id), c.count]));
    const proposerById = new Map(proposers.map((u) => [idOf(u), u]));

    const rows: AdminCategoryRow[] = categories.map((category) => {
      const proposer = category.proposedBy ? proposerById.get(String(category.proposedBy)) : null;
      return {
        id: idOf(category),
        categoryName: category.categoryName,
        status: category.status,
        activityCount: countByCategory.get(idOf(category)) ?? 0,
        proposedBy: proposer
          ? { id: idOf(proposer), firstName: proposer.firstName, lastName: proposer.lastName }
          : null,
        createdAt: category.createdAt,
      };
    });

    return {
      message: 'Categories retrieved successfully',
      data: { stats: { totalCategories, activeNow, pendingReview }, categories: rows },
      meta: buildMeta(page, limit, total),
    };
  }

  /** Admin — update name/status */
  async update(id: string, dto: UpdateCategoryDto): Promise<ServiceResponse<CategoryItem>> {
    const category = await this.findById(id);
    if (dto.categoryName && dto.categoryName !== category.categoryName) {
      await this.assertNameFree(dto.categoryName);
    }
    Object.assign(category, dto);
    await category.save();
    return { message: 'Category updated successfully', data: this.toItem(category) };
  }

  /**
   * Admin — approve (`Active`) or reject (`Disabled`) a proposal.
   *
   * A rejected category is disabled, never deleted: the activity that
   * introduced it still points at it and still has to render its name.
   * Deleting would break that activity's card to tidy up a chip list.
   */
  async updateStatus(
    id: string,
    dto: UpdateCategoryStatusDto,
  ): Promise<ServiceResponse<CategoryItem>> {
    if (dto.status !== CategoryStatus.Active && dto.status !== CategoryStatus.Disabled) {
      throw new BadRequestException('status must be Active (approve) or Disabled (reject)');
    }
    const category = await this.findById(id);
    category.status = dto.status;
    await category.save();
    return {
      message:
        dto.status === CategoryStatus.Active ? 'Category approved' : 'Category rejected',
      data: this.toItem(category),
    };
  }

  /** Admin — delete category */
  async remove(id: string): Promise<ServiceResponse<null>> {
    const category = await this.findById(id);
    const activityCount = await this.activityModel.countDocuments({ categoryId: category._id });
    if (activityCount > 0) {
      throw new ConflictException('Category has activities. Disable it instead of deleting.');
    }
    await category.deleteOne();
    return { message: 'Category deleted successfully', data: null };
  }

  private toItem(category: CategoryDocument): CategoryItem {
    return {
      id: idOf(category),
      categoryName: category.categoryName,
      status: category.status,
    };
  }

  /** Category names are unique case-insensitively, as they were under ILike. */
  private findByName(categoryName: string): Promise<CategoryDocument | null> {
    return this.categoryModel.findOne({
      categoryName: { $regex: `^${escapeRegex(categoryName)}$`, $options: 'i' },
    });
  }

  private async assertNameFree(categoryName: string): Promise<void> {
    if (await this.findByName(categoryName)) {
      throw new ConflictException('Category with this name already exists');
    }
  }

  private async findById(id: string): Promise<CategoryDocument> {
    const objectId = toObjectId(id);
    const category = objectId ? await this.categoryModel.findById(objectId) : null;
    if (!category) throw new NotFoundException('Category not found');
    return category;
  }
}
