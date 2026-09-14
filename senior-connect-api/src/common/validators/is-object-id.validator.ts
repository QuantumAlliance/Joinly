import { ValidationOptions, registerDecorator } from 'class-validator';
import { Types } from 'mongoose';

/** Body/query counterpart of @IsUUID() for Mongo ids. */
export function IsObjectId(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string): void {
    registerDecorator({
      name: 'isObjectId',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate: (value: unknown) => typeof value === 'string' && Types.ObjectId.isValid(value),
        defaultMessage: () => `${propertyName} must be a valid id`,
      },
    });
  };
}
