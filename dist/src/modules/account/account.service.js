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
exports.AccountService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const media_service_1 = require("../media/media.service");
const app_exception_1 = require("../../common/errors/app.exception");
let AccountService = class AccountService {
    prisma;
    media;
    constructor(prisma, media) {
        this.prisma = prisma;
        this.media = media;
    }
    async requestDeletion(userId) {
        const user = await this.prisma.appUser.findUnique({ where: { id: userId } });
        if (!user) {
            throw new app_exception_1.AppException('USER_NOT_FOUND', 'Pengguna tidak ditemukan.', common_1.HttpStatus.NOT_FOUND);
        }
        if (user.status === 'deleted') {
            return { status: 'deleted' };
        }
        await this.prisma.appUser.update({
            where: { id: userId },
            data: { status: 'deletion_requested' },
        });
        await this.prisma.auditEvent.create({
            data: {
                userId,
                action: 'account_deletion_requested',
                entityType: 'app_users',
                entityId: userId,
            },
        });
        const analyses = await this.prisma.aiAnalysisRun.findMany({
            where: { userId },
            select: { cloudinaryPublicId: true },
        });
        for (const a of analyses) {
            await this.media.destroy(a.cloudinaryPublicId);
        }
        const foods = await this.prisma.foodLog.findMany({
            where: { userId, cloudinaryPublicId: { not: null } },
            select: { cloudinaryPublicId: true },
        });
        for (const f of foods) {
            if (f.cloudinaryPublicId)
                await this.media.destroy(f.cloudinaryPublicId);
        }
        await this.prisma.$transaction([
            this.prisma.foodItem.deleteMany({
                where: { foodLog: { userId } },
            }),
            this.prisma.foodLog.deleteMany({ where: { userId } }),
            this.prisma.activityLog.deleteMany({ where: { userId } }),
            this.prisma.aiAnalysisRun.deleteMany({ where: { userId } }),
            this.prisma.aiUsageDaily.deleteMany({ where: { userId } }),
            this.prisma.dailyTarget.deleteMany({ where: { userId } }),
            this.prisma.idempotencyKey.deleteMany({ where: { userId } }),
            this.prisma.userProfile.deleteMany({ where: { userId } }),
            this.prisma.userSettings.deleteMany({ where: { userId } }),
            this.prisma.appUser.update({
                where: { id: userId },
                data: {
                    status: 'deleted',
                    email: null,
                    displayName: 'deleted',
                    deletedAt: new Date(),
                    kindeUserId: `deleted_${userId}`,
                },
            }),
        ]);
        return { status: 'deleted' };
    }
    async status(userId) {
        const user = await this.prisma.appUser.findUnique({ where: { id: userId } });
        if (!user) {
            return { status: 'not_found' };
        }
        return { status: user.status };
    }
};
exports.AccountService = AccountService;
exports.AccountService = AccountService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        media_service_1.MediaService])
], AccountService);
//# sourceMappingURL=account.service.js.map