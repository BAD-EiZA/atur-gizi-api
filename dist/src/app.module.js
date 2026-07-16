"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const configuration_1 = __importDefault(require("./config/configuration"));
const prisma_module_1 = require("./prisma/prisma.module");
const common_module_1 = require("./common/common.module");
const health_module_1 = require("./modules/health/health.module");
const users_module_1 = require("./modules/users/users.module");
const onboarding_module_1 = require("./modules/onboarding/onboarding.module");
const nutrition_module_1 = require("./modules/nutrition/nutrition.module");
const activities_module_1 = require("./modules/activities/activities.module");
const dashboard_module_1 = require("./modules/dashboard/dashboard.module");
const media_module_1 = require("./modules/media/media.module");
const ai_module_1 = require("./modules/ai/ai.module");
const account_module_1 = require("./modules/account/account.module");
const features_module_1 = require("./modules/features/features.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({ isGlobal: true, load: [configuration_1.default] }),
            prisma_module_1.PrismaModule,
            common_module_1.CommonModule,
            health_module_1.HealthModule,
            users_module_1.UsersModule,
            onboarding_module_1.OnboardingModule,
            nutrition_module_1.NutritionModule,
            activities_module_1.ActivitiesModule,
            dashboard_module_1.DashboardModule,
            media_module_1.MediaModule,
            ai_module_1.AiModule,
            account_module_1.AccountModule,
            features_module_1.FeaturesModule,
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map