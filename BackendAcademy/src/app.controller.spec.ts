import { Test, TestingModule } from '@nestjs/testing';
import { ArgumentsHost, BadRequestException, NotFoundException } from '@nestjs/common';
import {
  AppController,
  CorrelationIdExceptionFilter,
  getOrGenerateCorrelationId,
} from './app.controller';
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

  describe('Request Correlation IDs (BA-115)', () => {
    describe('getOrGenerateCorrelationId', () => {
      it('should echo x-correlation-id when present in headers', () => {
        const req = { headers: { 'x-correlation-id': 'client-trace-1234' } };
        expect(getOrGenerateCorrelationId(req)).toBe('client-trace-1234');
      });

      it('should echo x-request-id when x-correlation-id is absent', () => {
        const req = { headers: { 'x-request-id': 'request-id-5678' } };
        expect(getOrGenerateCorrelationId(req)).toBe('request-id-5678');
      });

      it('should generate a valid UUID when no correlation header is provided', () => {
        const id = getOrGenerateCorrelationId({});
        expect(id).toBeDefined();
        expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      });
    });

    describe('CorrelationIdExceptionFilter', () => {
      let filter: CorrelationIdExceptionFilter;

      beforeEach(() => {
        filter = new CorrelationIdExceptionFilter();
      });

      it('should include echoed correlation ID in response header and body for failed requests', () => {
        let setHeaderKey = '';
        let setHeaderVal = '';
        let responseStatus = 0;
        let responsePayload: any = null;

        const mockResponse: any = {
          setHeader: (key: string, val: string) => {
            setHeaderKey = key;
            setHeaderVal = val;
          },
          status: (code: number) => {
            responseStatus = code;
            return mockResponse;
          },
          json: (data: any) => {
            responsePayload = data;
            return mockResponse;
          },
        };

        const mockRequest: any = {
          headers: { 'x-correlation-id': 'custom-error-trace-999' },
        };

        const mockHost: ArgumentsHost = {
          switchToHttp: () => ({
            getResponse: () => mockResponse,
            getRequest: () => mockRequest,
            getNext: () => jest.fn(),
          }),
        } as any;

        const exception = new BadRequestException('Validation failed');
        filter.catch(exception, mockHost);

        expect(setHeaderKey).toBe('x-correlation-id');
        expect(setHeaderVal).toBe('custom-error-trace-999');
        expect(responseStatus).toBe(400);
        expect(responsePayload).toBeDefined();
        expect(responsePayload.statusCode).toBe(400);
        expect(responsePayload.message).toBe('Validation failed');
        expect(responsePayload.correlationId).toBe('custom-error-trace-999');
        expect(responsePayload.timestamp).toBeDefined();
      });

      it('should generate a correlation ID and include it when error request lacks trace header', () => {
        let capturedPayload: any = null;
        let capturedHeader = '';

        const mockResponse: any = {
          setHeader: (_key: string, val: string) => {
            capturedHeader = val;
          },
          status: (_code: number) => mockResponse,
          json: (data: any) => {
            capturedPayload = data;
            return mockResponse;
          },
        };

        const mockHost: ArgumentsHost = {
          switchToHttp: () => ({
            getResponse: () => mockResponse,
            getRequest: () => ({ headers: {} }),
            getNext: () => jest.fn(),
          }),
        } as any;

        const exception = new NotFoundException('Course not found');
        filter.catch(exception, mockHost);

        expect(capturedHeader).toBeDefined();
        expect(capturedPayload.correlationId).toBe(capturedHeader);
        expect(capturedPayload.statusCode).toBe(404);
        expect(capturedPayload.message).toBe('Course not found');
      });
    });
  });
});
