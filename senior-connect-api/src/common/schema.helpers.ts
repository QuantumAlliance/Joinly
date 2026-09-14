import { SchemaOptions } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

/**
 * Shared @Schema options.
 *
 * `timestamps` supplies createdAt/updatedAt (the old @CreateDateColumn pair).
 * The transform exposes `id` and hides Mongo's `_id`/`__v`, so the API surface
 * keeps the string `id` every interface and the admin dashboard already expect.
 */
export const baseSchemaOptions: SchemaOptions = {
  timestamps: true,
  versionKey: false,
  toJSON: {
    virtuals: true,
    transform: (_doc, ret: Record<string, unknown>) => {
      ret.id = String(ret._id);
      delete ret._id;
      return ret;
    },
  },
  toObject: { virtuals: true },
};

/** Every document gains these once `timestamps` is on. */
export interface Timestamped {
  createdAt: Date;
  updatedAt: Date;
}

/** A hydrated document's `_id`, as the string the API returns. */
export const idOf = (doc: { _id: Types.ObjectId } | Document): string =>
  String((doc as { _id: Types.ObjectId })._id);

/**
 * Narrow an untrusted string to an ObjectId, or null when it could never match
 * a document. Callers turn null into a 404 rather than letting Mongo throw a
 * CastError, which would surface as a 500.
 */
export const toObjectId = (value: string | null | undefined): Types.ObjectId | null =>
  value && Types.ObjectId.isValid(value) ? new Types.ObjectId(value) : null;

/** GeoJSON point, as stored for 2dsphere indexes. */
export interface GeoPoint {
  type: 'Point';
  coordinates: [number, number]; // [longitude, latitude] — GeoJSON order
}

/**
 * Sub-schema for the point. A nested inline @Prop cannot express "absent by
 * default", which a 2dsphere index requires — an empty object is not a valid
 * point and would be rejected on save.
 */
export const GeoPointSchema = new MongooseSchema<GeoPoint>(
  {
    type: { type: String, enum: ['Point'], required: true },
    coordinates: { type: [Number], required: true },
  },
  { _id: false },
);

/** Build a GeoJSON point, or undefined when either ordinate is missing. */
export const geoPoint = (
  latitude?: number | null,
  longitude?: number | null,
): GeoPoint | undefined =>
  latitude === null || latitude === undefined || longitude === null || longitude === undefined
    ? undefined
    : { type: 'Point', coordinates: [longitude, latitude] };
