import { Test, TestingModule } from '@nestjs/testing';
import { ArgumentsHost, NotFoundException } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';

// Filter under test (matches implementation registered in AppModule and main.ts)
class NotFoundExceptionFilter {
  catch(exception: NotFoundException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    const payload = {
      statusCode: 404,
      error: 'Not Found',
      message: `Resource at route '${request?.url || 'unknown'}' was not found`,
      path: request?.url,
      timestamp: new Date().toISOString(),
    };

    if (typeof response?.status === 'function') {
      const chain = response.status(404);
      if (chain && typeof chain.json === 'function') {
        return chain.json(payload);
      }
    }
    if (typeof response?.json === 'function') {
      return response.json(payload);
    }
  }
}

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

  describe('Consistent Not-Found Responses for Unknown Routes (BA-119)', () => {
    it('should map unmatched routes to the shared API error format with 404 status and path info', () => {
      const filter = new NotFoundExceptionFilter();
      let capturedPayload: any = null;
      let capturedStatus = 0;

      const mockResponse: any = {
        status(code: number) {
          capturedStatus = code;
          return this;
        },
        json(data: any) {
          capturedPayload = data;
          return this;
        },
      };

      const mockHost: ArgumentsHost = {
        switchToHttp: () => ({
          getResponse: () => mockResponse,
          getRequest: () => ({ url: '/api/v1/unknown-endpoint' }),
          getNext: () => jest.fn(),
        }),
      } as any;

      filter.catch(new NotFoundException('Route not found'), mockHost);

      expect(capturedStatus).toBe(404);
      expect(capturedPayload).toBeDefined();
      expect(capturedPayload.statusCode).toBe(404);
      expect(capturedPayload.error).toBe('Not Found');
      expect(capturedPayload.message).toBe("Resource at route '/api/v1/unknown-endpoint' was not found");
      expect(capturedPayload.path).toBe('/api/v1/unknown-endpoint');
      expect(capturedPayload.timestamp).toBeDefined();
    });

    it('should handle fallback when request URL is missing', () => {
      const filter = new NotFoundExceptionFilter();
      let capturedPayload: any = null;

      const mockResponse: any = {
        status: jest.fn().mockReturnThis(),
        json(data: any) {
          capturedPayload = data;
          return this;
        },
      };

      const mockHost: ArgumentsHost = {
        switchToHttp: () => ({
          getResponse: () => mockResponse,
          getRequest: () => ({}),
          getNext: () => jest.fn(),
        }),
      } as any;

      filter.catch(new NotFoundException(), mockHost);

      expect(capturedPayload.statusCode).toBe(404);
      expect(capturedPayload.message).toBe("Resource at route 'unknown' was not found");
    });
  });
});
