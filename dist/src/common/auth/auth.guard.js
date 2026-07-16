"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthGuard = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const jose_1 = require("jose");
const prisma_service_1 = require("../../prisma/prisma.service");
let AuthGuard = class AuthGuard {
    config;
    prisma;
    jwks = null;
    constructor(config, prisma) {
        this.config = config;
        this.prisma = prisma;
    }
    async canActivate(context) {
        const req = context.switchToHttp().getRequest();
        const devBypass = this.config.get('auth.devBypass');
        const issuer = this.config.get('auth.issuerUrl') ?? '';
        const audience = this.config.get('auth.audience') ?? '';
        const header = req.headers.authorization;
        let claims;
        if (header?.startsWith('Bearer ')) {
            if (!issuer) {
                throw new common_1.UnauthorizedException({
                    error: {
                        code: 'AUTH_MISCONFIGURED',
                        message: 'Issuer Kinde belum dikonfigurasi.',
                        details: [],
                    },
                });
            }
            const token = header.slice(7);
            try {
                if (!this.jwks) {
                    const jwksUrl = this.config.get('auth.jwksUrl') ||
                        `${issuer.replace(/\/$/, '')}/.well-known/jwks.json`;
                    this.jwks = (0, jose_1.createRemoteJWKSet)(new URL(jwksUrl));
                }
                const verifyOpts = { issuer };
                if (audience)
                    verifyOpts.audience = audience;
                const { payload } = await (0, jose_1.jwtVerify)(token, this.jwks, verifyOpts);
                if (!payload.sub) {
                    throw new Error('missing sub');
                }
                claims = {
                    sub: payload.sub,
                    email: typeof payload.email === 'string' ? payload.email : undefined,
                    name: typeof payload.name === 'string' ? payload.name : undefined,
                    given_name: typeof payload.given_name === 'string' ? payload.given_name : undefined,
                    family_name: typeof payload.family_name === 'string' ? payload.family_name : undefined,
                };
            }
            catch {
                throw new common_1.UnauthorizedException({
                    error: {
                        code: 'UNAUTHORIZED',
                        message: 'Token tidak valid atau kedaluwarsa.',
                        details: [],
                    },
                });
            }
        }
        else if (devBypass) {
            claims = {
                sub: this.config.get('auth.devUserId') ?? 'dev-user-1',
                email: this.config.get('auth.devEmail'),
                name: this.config.get('auth.devName'),
            };
        }
        else {
            throw new common_1.UnauthorizedException({
                error: {
                    code: 'UNAUTHORIZED',
                    message: 'Token tidak valid atau tidak ada.',
                    details: [],
                },
            });
        }
        const appUser = await this.prisma.appUser.findUnique({
            where: { kindeUserId: claims.sub },
        });
        if (appUser?.status === 'deletion_requested') {
            throw new common_1.UnauthorizedException({
                error: {
                    code: 'ACCOUNT_DELETION_PENDING',
                    message: 'Akun sedang dalam proses penghapusan.',
                    details: [],
                },
            });
        }
        if (appUser?.status === 'deleted') {
            throw new common_1.UnauthorizedException({
                error: {
                    code: 'ACCOUNT_DELETED',
                    message: 'Akun telah dihapus.',
                    details: [],
                },
            });
        }
        req.user = { claims, appUserId: appUser?.id ?? '' };
        return true;
    }
};
exports.AuthGuard = AuthGuard;
exports.AuthGuard = AuthGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        prisma_service_1.PrismaService])
], AuthGuard);
//# sourceMappingURL=auth.guard.js.map