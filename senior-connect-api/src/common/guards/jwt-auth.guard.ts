import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { JwtPayload } from '../interfaces/api-response.interface';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers.authorization;
    const token =
      authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null;

    // A public route still decodes a token when one is offered, so endpoints
    // that behave differently for a signed-in caller can see them via
    // @OptionalUser(). It stays public: a missing or bad token is ignored
    // here, never rejected.
    if (isPublic) {
      if (token) {
        try {
          this.attachUser(request, await this.jwtService.verifyAsync<JwtPayload>(token));
        } catch {
          // Anonymous is a valid way to call a public route.
        }
      }
      return true;
    }

    if (!token) throw new UnauthorizedException('Access token is missing');
    try {
      this.attachUser(request, await this.jwtService.verifyAsync<JwtPayload>(token));
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }
  }

  private attachUser(request: Request, payload: JwtPayload): void {
    (request as Request & { user: unknown }).user = {
      userId: payload.sub,
      email: payload.email,
      role: payload.role,
    };
  }
}
