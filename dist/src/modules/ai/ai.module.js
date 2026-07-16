"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiModule = void 0;
const common_1 = require("@nestjs/common");
const ai_controller_1 = require("./ai.controller");
const ai_service_1 = require("./ai.service");
const gemini_client_1 = require("./gemini.client");
const ai_assist_controller_1 = require("./ai-assist.controller");
const ai_assist_service_1 = require("./ai-assist.service");
const media_module_1 = require("../media/media.module");
const nutrition_module_1 = require("../nutrition/nutrition.module");
let AiModule = class AiModule {
};
exports.AiModule = AiModule;
exports.AiModule = AiModule = __decorate([
    (0, common_1.Module)({
        imports: [media_module_1.MediaModule, nutrition_module_1.NutritionModule],
        controllers: [ai_controller_1.AiController, ai_assist_controller_1.AiAssistController],
        providers: [ai_service_1.AiService, gemini_client_1.GeminiClient, ai_assist_service_1.AiAssistService],
    })
], AiModule);
//# sourceMappingURL=ai.module.js.map