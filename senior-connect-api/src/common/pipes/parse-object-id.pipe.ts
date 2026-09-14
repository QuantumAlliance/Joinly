import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { Types } from 'mongoose';

/**
 * Route-param guard for Mongo ids — the ObjectId counterpart of ParseUUIDPipe.
 *
 * Rejecting a malformed id here keeps a CastError out of the services, where it
 * would surface as a 500 instead of a 400.
 */
@Injectable()
export class ParseObjectIdPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!Types.ObjectId.isValid(value)) {
      throw new BadRequestException('Validation failed (ObjectId is expected)');
    }
    return value;
  }
}
