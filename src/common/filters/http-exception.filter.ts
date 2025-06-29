import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    const errorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message:
        typeof exceptionResponse === 'object' && exceptionResponse !== null
          ? (exceptionResponse as any).message || exceptionResponse
          : exceptionResponse || exception.message || 'Internal server error',
    };

    // Log the error for debugging
    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      console.error('Server Error:', {
        status,
        path: request.url,
        method: request.method,
        error: exceptionResponse,
        stack:
          process.env.NODE_ENV === 'development' ? exception.stack : undefined,
      });
    }

    response.status(status).json(errorResponse);
  }
}
