import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Activity, ActivitySchema } from '../activities/schemas';
import { Category, CategorySchema } from '../categories/schemas';
import { FavoritesController } from './favorites.controller';
import { Favorite, FavoriteSchema } from './schemas';
import { FavoritesService } from './favorites.service';

@Module({
  imports: [MongooseModule.forFeature([
      { name: Favorite.name, schema: FavoriteSchema },
      { name: Activity.name, schema: ActivitySchema },
      { name: Category.name, schema: CategorySchema },
    ])],
  controllers: [FavoritesController],
  providers: [FavoritesService],
})
export class FavoritesModule {}
