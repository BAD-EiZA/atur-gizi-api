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
exports.UsersController = void 0;
const common_1 = require("@nestjs/common");
const auth_guard_1 = require("../../common/auth/auth.guard");
const current_user_decorator_1 = require("../../common/auth/current-user.decorator");
const auth_types_1 = require("../../common/auth/auth.types");
const users_service_1 = require("./users.service");
const profile_dto_1 = require("./dto/profile.dto");
let UsersController = class UsersController {
    users;
    constructor(users) {
        this.users = users;
    }
    sync(user) {
        return this.users.sync(user.claims);
    }
    me(user) {
        return this.users.me(user.appUserId);
    }
    patchProfile(user, dto) {
        return this.users.patchProfile(user.appUserId, dto);
    }
    patchSettings(user, dto) {
        return this.users.patchSettings(user.appUserId, dto);
    }
};
exports.UsersController = UsersController;
__decorate([
    (0, common_1.Post)('users/sync'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [auth_types_1.AuthenticatedUser]),
    __metadata("design:returntype", void 0)
], UsersController.prototype, "sync", null);
__decorate([
    (0, common_1.Get)('me'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [auth_types_1.AuthenticatedUser]),
    __metadata("design:returntype", void 0)
], UsersController.prototype, "me", null);
__decorate([
    (0, common_1.Patch)('me/profile'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [auth_types_1.AuthenticatedUser, profile_dto_1.PatchProfileDto]),
    __metadata("design:returntype", void 0)
], UsersController.prototype, "patchProfile", null);
__decorate([
    (0, common_1.Patch)('me/settings'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [auth_types_1.AuthenticatedUser, profile_dto_1.PatchSettingsDto]),
    __metadata("design:returntype", void 0)
], UsersController.prototype, "patchSettings", null);
exports.UsersController = UsersController = __decorate([
    (0, common_1.Controller)('v1'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard),
    __metadata("design:paramtypes", [users_service_1.UsersService])
], UsersController);
//# sourceMappingURL=users.controller.js.map