import { MongooseModuleOptions } from '@nestjs/mongoose';

/**
 * Mongo connection settings.
 *
 * MONGODB_URI (hosted, e.g. Atlas — includes credentials and replica set) wins
 * over the discrete DB_* vars used for local docker-compose.
 */
export const mongoUri = (): string => {
  if (process.env.MONGODB_URI) return process.env.MONGODB_URI;
  const host = process.env.DB_HOST || 'localhost';
  const port = process.env.DB_PORT || '27017';
  const database = process.env.DB_DATABASE || 'arooby';
  // directConnection lets a single-node replica set be addressed without the
  // driver trying to discover other members that do not exist.
  return `mongodb://${host}:${port}/${database}?replicaSet=rs0&directConnection=true`;
};

export const mongooseConfig = (): MongooseModuleOptions => ({
  uri: mongoUri(),
  // Fail fast in dev rather than buffering commands against a dead server.
  serverSelectionTimeoutMS: 8000,
});
