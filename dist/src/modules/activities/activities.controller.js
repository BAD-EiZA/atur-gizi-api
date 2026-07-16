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
exports.ActivitiesController = void 0;
const common_1 = require("@nestjs/common");
const auth_guard_1 = require("../../common/auth/auth.guard");
const current_user_decorator_1 = require("../../common/auth/current-user.decorator");
const auth_types_1 = require("../../common/auth/auth.types");
const activities_service_1 = require("./activities.service");
const activity_dto_1 = require("./dto/activity.dto");
const idempotency_service_1 = require("../../common/idempotency/idempotency.service");
const analytics_service_1 = require("../../common/analytics/analytics.service");
let ActivitiesController = class ActivitiesController {
    activities;
    idempotency;
    analytics;
    constructor(activities, idempotency, analytics) {
        this.activities = activities;
        this.idempotency = idempotency;
        this.analytics = analytics;
    }
    types() {
        return this.activities.listTypes();
    }
    estimate(user, dto) {
        return this.activities.estimate(user.appUserId, dto);
    }
    async create(user, dto, idemKey) {
        const route = 'POST /v1/activity-logs';
        const started = await this.idempotency.begin(user.appUserId, idemKey, route, dto);
        if (started?.replay)
            return started.body;
        const result = await this.activities.create(user.appUserId, dto);
        if (idemKey && started && !started.replay) {
            await this.idempotency.save(user.appUserId, idemKey, route, started.requestHash, 201, result);
        }
        await this.analytics.track(user.appUserId, 'activity_log_created');
        return result;
    }
    list(user, from, to, cursor, limit) {
        return this.activities.list(user.appUserId, {
            from,
            to,
            cursor,
            limit: limit ? parseInt(limit, 10) : undefined,
        });
    }
    get(user, id) {
        return this.activities.get(user.appUserId, id);
    }
    update(user, id, dto) {
        return this.activities.update(user.appUserId, id, dto);
    }
    remove(user, id) {
        return this.activities.remove(user.appUserId, id);
    }
};
exports.ActivitiesController = ActivitiesController;
__decorate([
    (0, common_1.Get)('activity-types'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ActivitiesController.prototype, "types", null);
__decorate([
    (0, common_1.Post)('activity-estimates'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [auth_types_1.AuthenticatedUser, activity_dto_1.EstimateActivityDto]),
    __metadata("design:returntype", void 0)
], ActivitiesController.prototype, "estimate", null);
__decorate([
    (0, common_1.Post)('activity-logs'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('idempotency-key')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [auth_types_1.AuthenticatedUser,
        activity_dto_1.CreateActivityLogDto, String]),
    __metadata("design:returntype", Promise)
], ActivitiesController.prototype, "create", null);
__decorate([
    (0, common_1.Get)('activity-logs'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('from')),
    __param(2, (0, common_1.Query)('to')),
    __param(3, (0, common_1.Query)('cursor')),
    __param(4, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [auth_types_1.AuthenticatedUser, String, String, String, String]),
    __metadata("design:returntype", void 0)
], ActivitiesController.prototype, "list", null);
__decorate([
    (0, common_1.Get)('activity-logs/:id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [auth_types_1.AuthenticatedUser, String]),
    __metadata("design:returntype", void 0)
], ActivitiesController.prototype, "get", null);
__decorate([
    (0, common_1.Patch)('activity-logs/:id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [auth_types_1.AuthenticatedUser, String, activity_dto_1.UpdateActivityLogDto]),
    __metadata("design:returntype", void 0)
], ActivitiesController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)('activity-logs/:id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [auth_types_1.AuthenticatedUser, String]),
    __metadata("design:returntype", void 0)
], ActivitiesController.prototype, "remove", null);
exports.ActivitiesController = ActivitiesController = __decorate([
    (0, common_1.Controller)('v1'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard),
    __metadata("design:paramtypes", [activities_service_1.ActivitiesService,
        idempotency_service_1.IdempotencyService,
        analytics_service_1.AnalyticsService])
], ActivitiesController);
//# sourceMappingURL=activities.controller.js.map