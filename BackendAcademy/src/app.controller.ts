import {
  ArgumentsHost,
  Catch,
  Controller,
  ExceptionFilter,
  Get,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { AppService } from './app.service';

export interface ApiErrorResponse {
  statusCode: number;
  message: string | string[];
  correlationId: string;
  timestamp: string;
}

export function getOrGenerateCorrelationId(req: any): string {
  const headerId = req?.headers?.['x-correlation-id'] || req?.headers?.['x-request-id'];
  if (headerId) {
    return Array.isArray(headerId) ? headerId[0] : headerId;
  }
  return randomUUID();
}

@Catch()
export class CorrelationIdExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    const correlationId = getOrGenerateCorrelationId(request);
    if (typeof response?.setHeader === 'function') {
      response.setHeader('x-correlation-id', correlationId);
    }

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const resObj =
      exception instanceof HttpException ? exception.getResponse() : null;

    let message: string | string[] = 'Internal server error';
    if (typeof resObj === 'string') {
      message = resObj;
    } else if (resObj && typeof resObj === 'object' && 'message' in resObj) {
      message = (resObj as any).message;
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    const payload: ApiErrorResponse = {
      statusCode: status,
      message,
      correlationId,
      timestamp: new Date().toISOString(),
    };

    if (typeof response?.status === 'function') {
      const chain = response.status(status);
      if (chain && typeof chain.json === 'function') {
        return chain.json(payload);
      }
    }
    if (typeof response?.json === 'function') {
      return response.json(payload);
    }
  }
}

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}
