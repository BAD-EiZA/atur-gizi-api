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
exports.CompleteOnboardingDto = exports.PreviewTargetDto = void 0;
const class_validator_1 = require("class-validator");
const client_1 = require("@prisma/client");
class PreviewTargetDto {
    dateOfBirth;
    heightCm;
    weightKg;
    metabolicFormula;
    activityLevel;
    fitnessGoal;
    targetRate;
    manualTarget;
}
exports.PreviewTargetDto = PreviewTargetDto;
__decorate([
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], PreviewTargetDto.prototype, "dateOfBirth", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(50),
    (0, class_validator_1.Max)(250),
    __metadata("design:type", Number)
], PreviewTargetDto.prototype, "heightCm", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(20),
    (0, class_validator_1.Max)(400),
    __metadata("design:type", Number)
], PreviewTargetDto.prototype, "weightKg", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(client_1.MetabolicFormula),
    __metadata("design:type", String)
], PreviewTargetDto.prototype, "metabolicFormula", void 0);
__decorate([
    (0, class_validator_1.ValidateIf)((o) => o.metabolicFormula !== 'manual' && o.fitnessGoal !== 'manual'),
    (0, class_validator_1.IsEnum)(client_1.ActivityLevel),
    __metadata("design:type", String)
], PreviewTargetDto.prototype, "activityLevel", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(client_1.FitnessGoal),
    __metadata("design:type", String)
], PreviewTargetDto.prototype, "fitnessGoal", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], PreviewTargetDto.prototype, "targetRate", void 0);
__decorate([
    (0, class_validator_1.ValidateIf)((o) => o.fitnessGoal === 'manual' || o.metabolicFormula === 'manual'),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(800),
    (0, class_validator_1.Max)(10000),
    __metadata("design:type", Number)
], PreviewTargetDto.prototype, "manualTarget", void 0);
class CompleteOnboardingDto extends PreviewTargetDto {
    displayName;
    timezone;
    unitSystem;
    estimatesAccepted;
}
exports.CompleteOnboardingDto = CompleteOnboardingDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CompleteOnboardingDto.prototype, "displayName", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CompleteOnboardingDto.prototype, "timezone", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.UnitSystem),
    __metadata("design:type", String)
], CompleteOnboardingDto.prototype, "unitSystem", void 0);
__decorate([
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CompleteOnboardingDto.prototype, "estimatesAccepted", void 0);
//# sourceMappingURL=onboarding.dto.js.map