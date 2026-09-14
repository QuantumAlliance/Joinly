import 'dotenv/config';
import 'reflect-metadata';
import mongoose from 'mongoose';
import { mongoUri } from './config/mongoose.config';
import { ActivitySchema } from './modules/activities/schemas';
import { CategorySchema } from './modules/categories/schemas';
import { UserSchema } from './modules/users/schemas';
import { STOCK_PHOTO_URLS, avatarUrl, resolveActivityPhoto } from './stock-photos';

/**
 * Replace unusable image URLs on existing documents with real, live photos.
 *
 * Two distinct problems are repaired:
 *
 * 1. `res.cloudinary.com/demo/...` — paths that were never uploaded anywhere.
 *    They answer 404, so the mobile app and the dashboard both render a broken
 *    image. No seeder produces these; they were entered by hand.
 * 2. `picsum.photos/seed/<slug>` — these load, but Picsum returns a *random*
 *    photo for a seed. "Pickup Basketball Game" was illustrated with a
 *    landscape. Working, but wrong, which is worse than obviously broken.
 *
 * Both are rewritten to the curated Wikimedia Commons photos in
 * `stock-photos.ts`, so a repaired database matches what `npm run seed:demo`
 * would now produce.
 *
 * Safe to re-run: the filters match only the two bad hosts, so a second run is
 * a no-op. It never touches a photo a real user uploaded, and it never invents
 * a photo for a row that legitimately has none — an absent `activityPhoto` is
 * not a broken one, and the clients already fall back for it.
 */
const BAD_PHOTO = /res\.cloudinary\.com\/demo\/|picsum\.photos\//;

/**
 * A row is re-resolved when its photo is broken/placeholder *or* when it is one
 * this script set on an earlier run. Re-checking our own urls is what lets an
 * improvement to the catalogue reach rows that were already repaired — the
 * first pass resolved several bike rides by category and put a badminton court
 * on them. A photo uploaded by a real user matches neither test and is left
 * exactly as it is.
 */
const isReplaceable = (url: unknown): boolean =>
  typeof url === 'string' && (BAD_PHOTO.test(url) || STOCK_PHOTO_URLS.has(url));

/** Pravatar ids not already used by `seed-demo.ts` (which claims 5, 11-16, 33, 44-50). */
const SPARE_AVATAR_IDS = [51, 52, 53, 54, 55, 56, 57, 58, 59, 60];

async function fixPhotos(): Promise<void> {
  await mongoose.connect(mongoUri());

  const ActivityModel = mongoose.model('Activity', ActivitySchema);
  const CategoryModel = mongoose.model('Category', CategorySchema);
  const UserModel = mongoose.model('User', UserSchema);

  // ---- Activities ----
  const categories = await CategoryModel.find().select('_id categoryName');
  const categoryNameById = new Map(categories.map((c) => [String(c._id), c.categoryName]));

  const candidates = await ActivityModel.find({ activityPhoto: { $ne: null } }).select(
    '_id activityName categoryId activityPhoto',
  );

  const writes = candidates
    .filter((a) => isReplaceable(a.activityPhoto))
    .map((a) => {
      // Picsum urls carry the seeder's slug, which is the most precise signal
      // available; `resolveActivityPhoto` falls back through the activity name,
      // a keyword in it, and only then the category.
      const slug = /picsum\.photos\/seed\/([^/]+)/.exec(String(a.activityPhoto))?.[1];
      return {
        activityPhoto: resolveActivityPhoto(
          a.activityName,
          categoryNameById.get(String(a.categoryId)),
          slug,
        ),
        _id: a._id,
        previous: String(a.activityPhoto),
      };
    })
    .filter((w) => w.activityPhoto !== w.previous)
    .map((w) => ({
      updateOne: {
        filter: { _id: w._id },
        update: { $set: { activityPhoto: w.activityPhoto } },
      },
    }));

  if (writes.length > 0) await ActivityModel.bulkWrite(writes);
  console.log(
    writes.length === 0
      ? 'activities: no placeholder or dead photo urls found'
      : `activities: replaced ${writes.length} photo urls with real images`,
  );

  // ---- Users ----
  const users = await UserModel.find({ profilePhoto: BAD_PHOTO }).select('_id');
  if (users.length > 0) {
    await UserModel.bulkWrite(
      users.map((u, i) => ({
        updateOne: {
          filter: { _id: u._id },
          update: {
            $set: { profilePhoto: avatarUrl(SPARE_AVATAR_IDS[i % SPARE_AVATAR_IDS.length]) },
          },
        },
      })),
    );
  }
  console.log(
    users.length === 0
      ? 'users: no placeholder or dead avatar urls found'
      : `users: replaced ${users.length} avatar urls with real photos`,
  );

  await mongoose.disconnect();
  console.log('\nPhoto repair complete.');
}

fixPhotos().catch((err) => {
  console.error('Photo repair failed:', err);
  process.exit(1);
});
