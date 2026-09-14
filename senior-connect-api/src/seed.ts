import 'dotenv/config';
import 'reflect-metadata';
import * as bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { UserRole, UserStatus } from './common/enums';
import { mongoUri } from './config/mongoose.config';
import { CategorySchema } from './modules/categories/schemas';
import { UserSchema } from './modules/users/schemas';

/** Category chips exactly as they appear in the Figma mobile designs. */
const FIGMA_CATEGORIES = [
  'Football',
  'Cycling',
  'Swimming',
  'Basketball',
  'Skiing',
  'Climbing',
  'Tennis',
  'Table Tennis',
  'Badminton',
  'Handball',
  'Golf',
  'Boxing',
  'Rowing',
];

async function seed(): Promise<void> {
  await mongoose.connect(mongoUri());

  const CategoryModel = mongoose.model('Category', CategorySchema);
  const UserModel = mongoose.model('User', UserSchema);

  // Indexes are declared on the schemas but only built on demand. syncIndexes
  // rather than createIndexes: seeding a database that predates a change in
  // index *options* (Phase 2 replaced the plain unique users.email_1 with a
  // partial one) would otherwise fail, since Mongo refuses to rebuild in place.
  await Promise.all([CategoryModel.syncIndexes(), UserModel.syncIndexes()]);

  await CategoryModel.bulkWrite(
    FIGMA_CATEGORIES.map((categoryName) => ({
      updateOne: {
        filter: { categoryName },
        update: { $setOnInsert: { categoryName } },
        upsert: true,
      },
    })),
  );
  console.log(`Seeded ${FIGMA_CATEGORIES.length} categories`);

  const adminEmail = 'admin@contenthub.io'; // Figma Admin Login placeholder
  const admin = await UserModel.findOne({ email: adminEmail });
  if (admin) {
    console.log('Admin already exists');
  } else {
    await UserModel.create({
      firstName: 'Admin',
      lastName: 'User',
      email: adminEmail,
      password: await bcrypt.hash('admin123', 10),
      role: UserRole.Admin,
      status: UserStatus.Active,
      isEmailVerified: true,
    });
    console.log(`Seeded admin: ${adminEmail} / admin123`);
  }

  await mongoose.disconnect();
}

void seed();
