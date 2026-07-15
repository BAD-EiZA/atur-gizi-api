import { AuthenticatedUser } from '../../common/auth/auth.types';
import { DashboardService } from './dashboard.service';
export declare class DashboardController {
    private readonly dashboard;
    constructor(dashboard: DashboardService);
    daily(user: AuthenticatedUser, date?: string): Promise<{
        date: string;
        timezone: string;
        intake_target: number;
        consumed_calories: number;
        burned_calories: number;
        net_calories: number;
        remaining_calories: number;
        progress_pct: number;
        food_log_count: number;
        activity_duration_minutes: number;
        motivational_message: string;
        target: {
            calorie_target: number;
            bmr_kcal: number | null;
            tdee_kcal: number | null;
            goal: import(".prisma/client").$Enums.FitnessGoal;
        } | null;
        recent_food: {
            id: string;
            title: string;
            meal_type: import(".prisma/client").$Enums.MealType;
            total_calories: number;
            consumed_at: string;
        }[];
        recent_activity: {
            id: string;
            name: string;
            duration_minutes: number;
            calories_burned: number;
            started_at: string | null;
        }[];
    }>;
    history(user: AuthenticatedUser, from?: string, to?: string): Promise<{
        from: string;
        to: string;
        data: ({
            kind: "food";
            id: string;
            log_date: string;
            at: string;
            title: string;
            calories: number;
            meal_type: string;
        } | {
            kind: "activity";
            id: string;
            log_date: string;
            at: string | null;
            title: string;
            calories: number;
            duration_minutes: number;
        })[];
    }>;
}
