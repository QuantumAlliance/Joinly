import 'dotenv/config';
import 'reflect-metadata';
import mongoose from 'mongoose';
import { mongoUri } from './config/mongoose.config';
import { OtpRequestLogSchema, OtpSchema } from './modules/auth/schemas';
import { UserSchema } from './modules/users/schemas';

/**
 * Reconcile the indexes on disk with the ones the schemas declare.
 *
 * Needed because Phase 2 changed index *options*, which Mongo will not do in
 * place — a definition that differs from the live index is simply refused, and
 * Mongoose's autoIndex logs the failure rather than crashing the app. The
 * result would be an API that boots and then rejects every phone-only signup.
 *
 * What actually changed:
 *  - `users.email_1` was a plain unique index. A plain unique index treats
 *    every `null` as a colliding value, so exactly one phone-only account
 *    could ever exist. It is replaced by a partial unique index over the
 *    documents where `email` is a string.
 *  - `users.phoneE164_1` is new, on the same partial terms.
 *  - `otps.email_1` is gone: OTPs key on `identifier` now, because a code can
 *    be issued against either a mailbox or a number.
 *
 * `syncIndexes()` drops what the schema no longer declares and builds what it
 * does — including recreating an index whose options changed. Safe to re-run.
 */
async function syncIndexes(): Promise<void> {
  await mongoose.connect(mongoUri());

  const models = [
    mongoose.model('User', UserSchema),
    mongoose.model('Otp', OtpSchema),
    mongoose.model('OtpRequestLog', OtpRequestLogSchema),
  ];

  for (const model of models) {
    // Returns the names of the indexes it had to drop.
    const dropped = await model.syncIndexes();
    const collection = model.collection.collectionName;
    console.log(
      dropped.length
        ? `${collection}: dropped ${dropped.join(', ')}, rebuilt from schema`
        : `${collection}: already in sync`,
    );
  }

  await mongoose.disconnect();
  console.log('\nIndexes synced.');
}

syncIndexes().catch((err) => {
  console.error('Index sync failed:', err);
  process.exit(1);
});
