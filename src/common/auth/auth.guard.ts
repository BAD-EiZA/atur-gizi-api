import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthClaims, AuthenticatedUser } from './auth.types';

@Injectable()
export class AuthGuard implements CanActivate {
  private jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{
      headers: { authorization?: string };
      user?: AuthenticatedUser;
    }>();

    const devBypass = this.config.get<boolean>('auth.devBypass');
    const issuer = this.config.get<string>('auth.issuerUrl') ?? '';
    const audience = this.config.get<string>('auth.audience') ?? '';

    let claims: AuthClaims;

    if (devBypass && !issuer) {
      claims = {
        sub: this.config.get<string>('auth.devUserId') ?? 'dev-user-1',
        email: this.config.get<string>('auth.devEmail'),
        name: this.config.get<string>('auth.devName'),
      };
    } else {
      const header = req.headers.authorization;
      if (!header?.startsWith('Bearer ')) {
        throw new UnauthorizedException({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Token tidak valid atau tidak ada.',
            details: [],
          },
        });
      }
      const token = header.slice(7);
      try {
        if (!this.jwks) {
          const jwksUrl =
            this.config.get<string>('auth.jwksUrl') ||
            `${issuer.replace(/\/$/, '')}/.well-known/jwks.json`;
          this.jwks = createRemoteJWKSet(new URL(jwksUrl));
        }
        const { payload } = await jwtVerify(token, this.jwks, {
          issuer,
          audience: audience || undefined,
        });
        if (!payload.sub) {
          throw new Error('missing sub');
        }
        claims = {
          sub: payload.sub,
          email: typeof payload.email === 'string' ? payload.email : undefined,
          name: typeof payload.name === 'string' ? payload.name : undefined,
          given_name:
            typeof payload.given_name === 'string' ? payload.given_name : undefined,
          family_name:
            typeof payload.family_name === 'string' ? payload.family_name : undefined,
        };
      } catch {
        throw new UnauthorizedException({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Token tidak valid atau kedaluwarsa.',
            details: [],
          },
        });
      }
    }

    const appUser = await this.prisma.appUser.findUnique({
      where: { kindeUserId: claims.sub },
    });

    if (appUser?.status === 'deletion_requested') {
      throw new UnauthorizedException({
        error: {
          code: 'ACCOUNT_DELETION_PENDING',
          message: 'Akun sedang dalam proses penghapusan.',
          details: [],
        },
      });
    }

    if (appUser?.status === 'deleted') {
      throw new UnauthorizedException({
        error: {
          code: 'ACCOUNT_DELETED',
          message: 'Akun telah dihapus.',
          details: [],
        },
      });
    }

    // appUserId may be empty until POST /v1/users/sync
    req.user = { claims, appUserId: appUser?.id ?? '' };
    return true;
  }
}
