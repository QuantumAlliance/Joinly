import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule, JwtSignOptions } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { mongooseConfig } from './config/mongoose.config';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { ActivitiesModule } from './modules/activities/activities.module';
import { ParticipantsModule } from './modules/participants/participants.module';
import { FavoritesModule } from './modules/favorites/favorites.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { UploadsModule } from './modules/uploads/uploads.module';
import { ContactModule } from './modules/contact/contact.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRootAsync({ useFactory: mongooseConfig }),
    JwtModule.register({
      global: true,
      secret: process.env.JWT_ACCESS_SECRET || 'change-me-access-secret',
      signOptions: {
        // @nestjs/jwt v11 types expiresIn as ms.StringValue | number; env vars are plain strings.
        expiresIn: (process.env.JWT_ACCESS_EXPIRES_IN || '1d') as JwtSignOptions['expiresIn'],
      },
    }),
    AuthModule,
    UsersModule,
    CategoriesModule,
    ActivitiesModule,
    ParticipantsModule,
    FavoritesModule,
    NotificationsModule,
    DashboardModule,
    UploadsModule,
    ContactModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
