import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedUser } from '../interfaces/api-response.interface';

/**
 * The signed-in user on a `@Public()` route, or null when the caller is
 * anonymous.
 *
 * For endpoints whose meaning depends on whether anyone is signed in — phone
 * verification links a number to the account in hand when there is one, and is
 * a sign-in when there is not.
 */
export const OptionalUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser | null => {
    const request = ctx.switchToHttp().getRequest();
    return (request.user as AuthenticatedUser | undefined) ?? null;
  },
);
