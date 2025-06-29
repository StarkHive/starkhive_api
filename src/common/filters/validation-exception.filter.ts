import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
} from '@nestjs/common';
import { ValidationError } from 'class-validator';
import { Request, Response } from 'express';

export class ValidationException extends Error {
  constructor(public readonly errors: Record<string, any>) {
    super('Validation failed');
    this.name = 'ValidationException';
  }
}

@Catch(ValidationException)
export class ValidationExceptionFilter implements ExceptionFilter {
  catch(exception: ValidationException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const errorResponse = {
      statusCode: HttpStatus.BAD_REQUEST,
      message: 'Validation failed',
      errors: exception.errors,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    response.status(HttpStatus.BAD_REQUEST).json(errorResponse);
  }
}

// Helper function to format validation errors
export function formatValidationErrors(errors: ValidationError[]) {
  const result: Record<string, any> = {};

  errors.forEach((error) => {
    if (error.children && error.children.length > 0) {
      result[error.property] = formatValidationErrors(error.children);
    } else {
      result[error.property] = Object.values(error.constraints || {});
    }
  });

  return result;
}
