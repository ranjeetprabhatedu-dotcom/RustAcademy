import { Test, TestingModule } from '@nestjs/testing';
import { AppController, malformedJsonHandler } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('getHello', () => {
    it('should return the service greeting', () => {
      expect(appController.getHello()).toBe('RustAcademy BackendAcademy API');
    });
  });

  describe('Reject Malformed JSON (BA-116)', () => {
    it('should catch JSON SyntaxError with 400 and return a safe client 400 error rather than 500', () => {
      const syntaxError: any = new SyntaxError('Unexpected token } in JSON at position 12');
      syntaxError.status = 400;
      syntaxError.body = '{"invalid": }';

      const mockRes: any = {
        statusCode: 0,
        responseData: null,
        status(code: number) {
          this.statusCode = code;
          return this;
        },
        json(data: any) {
          this.responseData = data;
          return this;
        },
      };

      const next = jest.fn();

      malformedJsonHandler(syntaxError, {}, mockRes, next);

      expect(mockRes.statusCode).toBe(400);
      expect(mockRes.responseData).toEqual({
        statusCode: 400,
        message: 'Malformed JSON payload in request body',
        error: 'Bad Request',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should forward non-syntax or unrelated errors to next()', () => {
      const genericError = new Error('Database connection failed');
      const mockRes: any = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };
      const next = jest.fn();

      malformedJsonHandler(genericError, {}, mockRes, next);

      expect(next).toHaveBeenCalledWith(genericError);
      expect(mockRes.status).not.toHaveBeenCalled();
    });
  });
});
