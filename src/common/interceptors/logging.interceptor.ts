import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const userAgent = request.get('user-agent') || '';
    const { ip, method, path: url } = request;
    const timestamp = new Date().toISOString();

    this.logger.log(
      `[${timestamp}] ${method} ${url} ${userAgent} ${ip}: ${context.getClass().name} ${context.getHandler().name}`,
    );

    const now = Date.now();
    return next.handle().pipe(
      tap(() => {
        const response = context.switchToHttp().getResponse();
        const { statusCode } = response;
        const contentLength = response.get('content-length') || 0;

        this.logger.log(
          `${method} ${url} ${statusCode} ${contentLength}b - ${Date.now() - now}ms`,
        );
      }),
    );
  }
}
