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
exports.NutritionController = void 0;
const common_1 = require("@nestjs/common");
const auth_guard_1 = require("../../common/auth/auth.guard");
const current_user_decorator_1 = require("../../common/auth/current-user.decorator");
const auth_types_1 = require("../../common/auth/auth.types");
const nutrition_service_1 = require("./nutrition.service");
const food_log_dto_1 = require("./dto/food-log.dto");
const client_1 = require("@prisma/client");
let NutritionController = class NutritionController {
    nutrition;
    constructor(nutrition) {
        this.nutrition = nutrition;
    }
    create(user, dto) {
        return this.nutrition.create(user.appUserId, dto);
    }
    list(user, from, to, mealType, cursor, limit) {
        return this.nutrition.list(user.appUserId, {
            from,
            to,
            mealType,
            cursor,
            limit: limit ? parseInt(limit, 10) : undefined,
        });
    }
    get(user, id) {
        return this.nutrition.get(user.appUserId, id);
    }
    update(user, id, dto) {
        return this.nutrition.update(user.appUserId, id, dto);
    }
    remove(user, id) {
        return this.nutrition.remove(user.appUserId, id);
    }
};
exports.NutritionController = NutritionController;
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [auth_types_1.AuthenticatedUser, food_log_dto_1.CreateFoodLogDto]),
    __metadata("design:returntype", void 0)
], NutritionController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('from')),
    __param(2, (0, common_1.Query)('to')),
    __param(3, (0, common_1.Query)('mealType')),
    __param(4, (0, common_1.Query)('cursor')),
    __param(5, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [auth_types_1.AuthenticatedUser, String, String, String, String, String]),
    __metadata("design:returntype", void 0)
], NutritionController.prototype, "list", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [auth_types_1.AuthenticatedUser, String]),
    __metadata("design:returntype", void 0)
], NutritionController.prototype, "get", null);
__decorate([
    (0, common_1.Patch)(':id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [auth_types_1.AuthenticatedUser, String, food_log_dto_1.UpdateFoodLogDto]),
    __metadata("design:returntype", void 0)
], NutritionController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [auth_types_1.AuthenticatedUser, String]),
    __metadata("design:returntype", void 0)
], NutritionController.prototype, "remove", null);
exports.NutritionController = NutritionController = __decorate([
    (0, common_1.Controller)('v1/food-logs'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard),
    __metadata("design:paramtypes", [nutrition_service_1.NutritionService])
], NutritionController);
//# sourceMappingURL=nutrition.controller.js.map