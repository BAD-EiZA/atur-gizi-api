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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiController = void 0;
const common_1 = require("@nestjs/common");
const auth_guard_1 = require("../../common/auth/auth.guard");
const current_user_decorator_1 = require("../../common/auth/current-user.decorator");
const auth_types_1 = require("../../common/auth/auth.types");
const ai_service_1 = require("./ai.service");
const ai_dto_1 = require("./dto/ai.dto");
const rate_limit_service_1 = require("../../common/rate-limit/rate-limit.service");
const idempotency_service_1 = require("../../common/idempotency/idempotency.service");
const analytics_service_1 = require("../../common/analytics/analytics.service");
let AiController = class AiController {
    ai;
    rateLimit;
    idempotency;
    analytics;
    constructor(ai, rateLimit, idempotency, analytics) {
        this.ai = ai;
        this.rateLimit = rateLimit;
        this.idempotency = idempotency;
        this.analytics = analytics;
    }
    async start(user, dto, req) {
        await this.rateLimit.hit({
            userId: user.appUserId,
            ip: req.ip,
            routeKey: 'food-analyses',
            limit: 20,
            windowMinutes: 1,
        });
        await this.analytics.track(user.appUserId, 'food_ai_analysis_started');
        try {
            const result = await this.ai.start(user.appUserId, dto);
            await this.analytics.track(user.appUserId, 'food_ai_analysis_succeeded');
            return result;
        }
        catch (e) {
            await this.analytics.track(user.appUserId, 'food_ai_analysis_failed');
            throw e;
        }
    }
    get(user, id) {
        return this.ai.get(user.appUserId, id);
    }
    retry(user, id) {
        return this.ai.retry(user.appUserId, id);
    }
    async confirm(user, id, dto, idemKey) {
        const route = `POST /v1/food-analyses/${id}/confirm`;
        const started = await this.idempotency.begin(user.appUserId, idemKey, route, dto);
        if (started?.replay)
            return started.body;
        const result = await this.ai.confirm(user.appUserId, id, dto);
        if (idemKey && started && !started.replay) {
            await this.idempotency.save(user.appUserId, idemKey, route, started.requestHash, 201, result);
        }
        await this.analytics.track(user.appUserId, 'food_ai_result_confirmed');
        return result;
    }
    cancel(user, id) {
        return this.ai.cancel(user.appUserId, id);
    }
};
exports.AiController = AiController;
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [auth_types_1.AuthenticatedUser,
        ai_dto_1.StartAnalysisDto, Object]),
    __metadata("design:returntype", Promise)
], AiController.prototype, "start", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [auth_types_1.AuthenticatedUser, String]),
    __metadata("design:returntype", void 0)
], AiController.prototype, "get", null);
__decorate([
    (0, common_1.Post)(':id/retry'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [auth_types_1.AuthenticatedUser, String]),
    __metadata("design:returntype", void 0)
], AiController.prototype, "retry", null);
__decorate([
    (0, common_1.Post)(':id/confirm'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, common_1.Headers)('idempotency-key')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [auth_types_1.AuthenticatedUser, String, ai_dto_1.ConfirmAnalysisDto, String]),
    __metadata("design:returntype", Promise)
], AiController.prototype, "confirm", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [auth_types_1.AuthenticatedUser, String]),
    __metadata("design:returntype", void 0)
], AiController.prototype, "cancel", null);
exports.AiController = AiController = __decorate([
    (0, common_1.Controller)('v1/food-analyses'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard),
    __metadata("design:paramtypes", [ai_service_1.AiService,
        rate_limit_service_1.RateLimitService,
        idempotency_service_1.IdempotencyService,
        analytics_service_1.AnalyticsService])
], AiController);
//# sourceMappingURL=ai.controller.js.map