import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class RequestIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      requestId?: string;
    }>();
    const res = context.switchToHttp().getResponse<{ setHeader: (k: string, v: string) => void }>();
    const requestId = req.headers['x-request-id'] ?? randomUUID();
    req.requestId = requestId;
    res.setHeader('x-request-id', requestId);
    const start = Date.now();
    return next.handle().pipe(
      tap(() => {
        // structured log without PII
        const method = (req as { method?: string }).method;
        const url = (req as { url?: string }).url;
        console.log(
          JSON.stringify({
            level: 'info',
            request_id: requestId,
            method,
            route: url,
            duration_ms: Date.now() - start,
          }),
        );
      }),
    );
  }
}
