import { IsEnum } from 'class-validator';
import { CategoryStatus } from '../../../common/enums';

/**
 * Admin review of a proposed category — the approve / reject action on the
 * Pending queue.
 *
 * `Active` approves it (the chip joins the public list for everyone).
 * `Disabled` rejects it: the category is kept, not deleted, because the
 * activity that introduced it still points at it and still has to render its
 * name. Rejection only withholds it from the public chips.
 *
 * `Pending` is not accepted — review is a decision, and putting a row back
 * into the queue it just left is not one.
 */
export class UpdateCategoryStatusDto {
  @IsEnum(CategoryStatus, { message: 'status must be Active (approve) or Disabled (reject)' })
  status: CategoryStatus.Active | CategoryStatus.Disabled;
}
