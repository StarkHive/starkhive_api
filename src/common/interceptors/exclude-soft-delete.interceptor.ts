import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Reflector } from '@nestjs/core';
import { EXCLUDE_FROM_QUERY } from '../decorators/exclude-from-query.decorator';

@Injectable()
export class ExcludeSoftDeleteInterceptor implements NestInterceptor {
  constructor(private reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    // Check if the handler or class is decorated with ExcludeFromQuery
    const isExcluded = this.reflector.getAllAndOverride<boolean>(
      EXCLUDE_FROM_QUERY,
      [context.getHandler(), context.getClass()],
    );

    if (isExcluded) {
      return next.handle();
    }

    return next.handle().pipe(
      map((data) => {
        if (!data) return data;

        // Handle arrays
        if (Array.isArray(data)) {
          return data.filter((item) => {
            if (!item || typeof item !== 'object') return true;
            return item.deletedAt === null || item.deletedAt === undefined;
          });
        }

        // Handle single objects
        if (typeof data === 'object' && 'deletedAt' in data) {
          return data.deletedAt === null || data.deletedAt === undefined
            ? data
            : null;
        }

        return data;
      }),
    );
  }
}
