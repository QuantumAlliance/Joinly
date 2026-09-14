import 'dotenv/config';
import 'reflect-metadata';
import mongoose from 'mongoose';
import { NotificationAudience } from './common/enums';
import { mongoUri } from './config/mongoose.config';
import { NotificationSchema } from './modules/notifications/schemas';

/**
 * Phase 7 — retire the `Seniors` and `Volunteers` audiences.
 *
 * Nothing on the user document ever distinguished a senior from a volunteer, so
 * neither value could be resolved into a recipient list: every broadcast that
 * carried one was in fact delivered to every active mobile user, and only the
 * history column claimed otherwise. The rows are rewritten to `Everyone`, which
 * is what actually happened.
 *
 * They are *not* rewritten to an interest segment. Guessing which categories a
 * past "Seniors" broadcast meant would invent a targeting decision nobody made
 * and leave the history table asserting something untrue.
 *
 * `recipientCount` is backfilled from the delivery rows that already exist, so
 * historic broadcasts report the reach they had rather than the 0 the new
 * field defaults to.
 *
 * Safe to re-run: the audience update matches only legacy values, and the
 * backfill only touches rows that have no count yet.
 */
async function migrateAudience(): Promise<void> {
  await mongoose.connect(mongoUri());

  const NotificationModel = mongoose.model('Notification', NotificationSchema);
  const legacy = ['Seniors', 'Volunteers'];

  const before = await NotificationModel.countDocuments({ audience: { $in: legacy } });
  const { modifiedCount } = await NotificationModel.updateMany(
    { audience: { $in: legacy } },
    { $set: { audience: NotificationAudience.Everyone, audienceCategoryIds: [] } },
  );
  console.log(
    before === 0
      ? 'notifications: no legacy Seniors/Volunteers rows to migrate'
      : `notifications: rewrote ${modifiedCount} of ${before} legacy rows to Everyone`,
  );

  // Backfill reach from the delivery rows each broadcast already fanned out to.
  const missing = await NotificationModel.find({
    $or: [{ recipientCount: { $exists: false } }, { recipientCount: null }],
  }).select('_id');

  if (missing.length > 0) {
    const counts = await mongoose.connection
      .collection('user_notifications')
      .aggregate<{ _id: mongoose.Types.ObjectId; count: number }>([
        { $match: { notificationId: { $in: missing.map((n) => n._id) } } },
        { $group: { _id: '$notificationId', count: { $sum: 1 } } },
      ])
      .toArray();
    const countById = new Map(counts.map((c) => [String(c._id), c.count]));

    await NotificationModel.bulkWrite(
      missing.map((n) => ({
        updateOne: {
          filter: { _id: n._id },
          update: { $set: { recipientCount: countById.get(String(n._id)) ?? 0 } },
        },
      })),
    );
  }
  console.log(
    missing.length === 0
      ? 'notifications: every row already has a recipientCount'
      : `notifications: backfilled recipientCount on ${missing.length} rows`,
  );

  await mongoose.disconnect();
  console.log('\nAudience migration complete.');
}

migrateAudience().catch((err) => {
  console.error('Audience migration failed:', err);
  process.exit(1);
});
