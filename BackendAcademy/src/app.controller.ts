import { BadRequestException, Controller, Get, ValidationError } from '@nestjs/common';
import { AppService } from './app.service';

export interface ValidationErrorFieldDetail {
  field: string;
  value?: any;
  constraints: string[];
}

export interface StandardValidationErrorPayload {
  statusCode: 400;
  code: 'VALIDATION_FAILED';
  message: string;
  errors: ValidationErrorFieldDetail[];
}

export function formatValidationErrors(
  errors: ValidationError[],
): ValidationErrorFieldDetail[] {
  return errors.map((err) => ({
    field: err.property,
    value: err.value,
    constraints: Object.values(err.constraints || {}),
  }));
}

export function validationExceptionFactory(errors: ValidationError[]): BadRequestException {
  const formatted = formatValidationErrors(errors);
  return new BadRequestException({
    statusCode: 400,
    code: 'VALIDATION_FAILED',
    message: 'Validation failed for request payload',
    errors: formatted,
  });
}

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}
