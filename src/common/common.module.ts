import { Global, Module } from '@nestjs/common';
import { IdempotencyService } from './idempotency/idempotency.service';
import { RateLimitService } from './rate-limit/rate-limit.service';
import { AnalyticsService } from './analytics/analytics.service';

@Global()
@Module({
  providers: [IdempotencyService, RateLimitService, AnalyticsService],
  exports: [IdempotencyService, RateLimitService, AnalyticsService],
})
export class CommonModule {}
