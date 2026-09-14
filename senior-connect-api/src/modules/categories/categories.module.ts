import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Activity, ActivitySchema } from '../activities/schemas';
import { User, UserSchema } from '../users/schemas';
import { CategoriesController } from './categories.controller';
import { Category, CategorySchema } from './schemas';
import { CategoriesService } from './categories.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Category.name, schema: CategorySchema },
      { name: Activity.name, schema: ActivitySchema },
      // Resolves `proposedBy` into a name for the admin review queue.
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [CategoriesController],
  providers: [CategoriesService],
  exports: [CategoriesService],
})
export class CategoriesModule {}
