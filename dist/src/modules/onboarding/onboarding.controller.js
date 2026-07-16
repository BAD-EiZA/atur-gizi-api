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
exports.OnboardingController = void 0;
const common_1 = require("@nestjs/common");
const auth_guard_1 = require("../../common/auth/auth.guard");
const current_user_decorator_1 = require("../../common/auth/current-user.decorator");
const auth_types_1 = require("../../common/auth/auth.types");
const onboarding_service_1 = require("./onboarding.service");
const onboarding_dto_1 = require("./dto/onboarding.dto");
const idempotency_service_1 = require("../../common/idempotency/idempotency.service");
const analytics_service_1 = require("../../common/analytics/analytics.service");
let OnboardingController = class OnboardingController {
    onboarding;
    idempotency;
    analytics;
    constructor(onboarding, idempotency, analytics) {
        this.onboarding = onboarding;
        this.idempotency = idempotency;
        this.analytics = analytics;
    }
    preview(dto) {
        return this.onboarding.preview(dto);
    }
    async complete(user, dto, idemKey) {
        const route = 'POST /v1/onboarding/complete';
        const started = await this.idempotency.begin(user.appUserId, idemKey, route, dto);
        if (started?.replay)
            return started.body;
        const result = await this.onboarding.complete(user.appUserId, dto);
        if (idemKey && started && !started.replay) {
            await this.idempotency.save(user.appUserId, idemKey, route, started.requestHash, 201, result);
        }
        await this.analytics.track(user.appUserId, 'onboarding_completed');
        return result;
    }
};
exports.OnboardingController = OnboardingController;
__decorate([
    (0, common_1.Post)('preview-target'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [onboarding_dto_1.PreviewTargetDto]),
    __metadata("design:returntype", void 0)
], OnboardingController.prototype, "preview", null);
__decorate([
    (0, common_1.Post)('complete'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('idempotency-key')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [auth_types_1.AuthenticatedUser,
        onboarding_dto_1.CompleteOnboardingDto, String]),
    __metadata("design:returntype", Promise)
], OnboardingController.prototype, "complete", null);
exports.OnboardingController = OnboardingController = __decorate([
    (0, common_1.Controller)('v1/onboarding'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard),
    __metadata("design:paramtypes", [onboarding_service_1.OnboardingService,
        idempotency_service_1.IdempotencyService,
        analytics_service_1.AnalyticsService])
], OnboardingController);
//# sourceMappingURL=onboarding.controller.js.map