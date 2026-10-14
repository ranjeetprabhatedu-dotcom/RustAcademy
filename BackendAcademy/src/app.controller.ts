import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

export interface MalformedJsonErrorResponse {
  statusCode: 400;
  message: string;
  error: string;
}

// Middleware to catch body-parser syntax errors and return a safe client 400 error
export const malformedJsonHandler = (err: any, _req: any, res: any, next: any) => {
  if (err instanceof SyntaxError && 'status' in err && (err as any).status === 400 && 'body' in err) {
    return res.status(400).json({
      statusCode: 400,
      message: 'Malformed JSON payload in request body',
      error: 'Bad Request',
    });
  }
  return next(err);
};

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}
