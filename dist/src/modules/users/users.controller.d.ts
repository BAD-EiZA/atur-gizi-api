import { AuthenticatedUser } from '../../common/auth/auth.types';
import { UsersService } from './users.service';
import { PatchProfileDto, PatchSettingsDto } from './dto/profile.dto';
export declare class UsersController {
    private readonly users;
    constructor(users: UsersService);
    sync(user: AuthenticatedUser): Promise<{
        id: string;
        kinde_user_id: string;
        email: string | null;
        display_name: string | null;
        status: string;
        onboarding_completed: boolean;
        profile: {
            date_of_birth: string | null;
            height_cm: number | null;
            current_weight_kg: number | null;
            metabolic_formula: string;
            activity_level: string | null;
            fitness_goal: string | null;
            target_rate: number | null;
            estimates_accepted: boolean;
        } | null;
        settings: {
            timezone: string;
            unit_system: string;
            locale: string;
            retain_food_photos: boolean;
            analytics_consent: boolean;
        } | null;
    }>;
    me(user: AuthenticatedUser): Promise<{
        id: string;
        kinde_user_id: string;
        email: string | null;
        display_name: string | null;
        status: string;
        onboarding_completed: boolean;
        profile: {
            date_of_birth: string | null;
            height_cm: number | null;
            current_weight_kg: number | null;
            metabolic_formula: string;
            activity_level: string | null;
            fitness_goal: string | null;
            target_rate: number | null;
            estimates_accepted: boolean;
        } | null;
        settings: {
            timezone: string;
            unit_system: string;
            locale: string;
            retain_food_photos: boolean;
            analytics_consent: boolean;
        } | null;
    }>;
    patchProfile(user: AuthenticatedUser, dto: PatchProfileDto): Promise<{
        id: string;
        kinde_user_id: string;
        email: string | null;
        display_name: string | null;
        status: string;
        onboarding_completed: boolean;
        profile: {
            date_of_birth: string | null;
            height_cm: number | null;
            current_weight_kg: number | null;
            metabolic_formula: string;
            activity_level: string | null;
            fitness_goal: string | null;
            target_rate: number | null;
            estimates_accepted: boolean;
        } | null;
        settings: {
            timezone: string;
            unit_system: string;
            locale: string;
            retain_food_photos: boolean;
            analytics_consent: boolean;
        } | null;
    }>;
    patchSettings(user: AuthenticatedUser, dto: PatchSettingsDto): Promise<{
        id: string;
        kinde_user_id: string;
        email: string | null;
        display_name: string | null;
        status: string;
        onboarding_completed: boolean;
        profile: {
            date_of_birth: string | null;
            height_cm: number | null;
            current_weight_kg: number | null;
            metabolic_formula: string;
            activity_level: string | null;
            fitness_goal: string | null;
            target_rate: number | null;
            estimates_accepted: boolean;
        } | null;
        settings: {
            timezone: string;
            unit_system: string;
            locale: string;
            retain_food_photos: boolean;
            analytics_consent: boolean;
        } | null;
    }>;
}
