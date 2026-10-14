import { Test, TestingModule } from '@nestjs/testing';
import { ArgumentMetadata, BadRequestException, ValidationPipe, ValidationError } from '@nestjs/common';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';
import {
  AppController,
  formatValidationErrors,
  validationExceptionFactory,
} from './app.controller';
import { AppService } from './app.service';

class SampleUserDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  username!: string;

  @IsString()
  @IsNotEmpty()
  email!: string;
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

  describe('Standardized API Validation Error Responses (BA-114)', () => {
    describe('formatValidationErrors & validationExceptionFactory', () => {
      it('should format ValidationError items into stable field and constraints structure', () => {
        const mockError: ValidationError = {
          property: 'username',
          value: 'ab',
          constraints: {
            minLength: 'username must be longer than or equal to 3 characters',
          },
          children: [],
        };

        const formatted = formatValidationErrors([mockError]);
        expect(formatted).toHaveLength(1);
        expect(formatted[0].field).toBe('username');
        expect(formatted[0].value).toBe('ab');
        expect(formatted[0].constraints).toContain(
          'username must be longer than or equal to 3 characters',
        );
      });

      it('should construct a BadRequestException with stable code VALIDATION_FAILED', () => {
        const mockError: ValidationError = {
          property: 'email',
          value: '',
          constraints: {
            isNotEmpty: 'email should not be empty',
          },
          children: [],
        };

        const exception = validationExceptionFactory([mockError]);
        expect(exception).toBeInstanceOf(BadRequestException);
        expect(exception.getStatus()).toBe(400);

        const response: any = exception.getResponse();
        expect(response.statusCode).toBe(400);
        expect(response.code).toBe('VALIDATION_FAILED');
        expect(response.message).toBe('Validation failed for request payload');
        expect(response.errors).toBeDefined();
        expect(response.errors[0].field).toBe('email');
      });
    });

    describe('ValidationPipe with validationExceptionFactory', () => {
      let pipe: ValidationPipe;

      beforeEach(() => {
        pipe = new ValidationPipe({
          whitelist: true,
          transform: true,
          forbidNonWhitelisted: true,
          exceptionFactory: validationExceptionFactory,
        });
      });

      it('should return stable error code and field details when payload fails DTO validation', async () => {
        const metadata: ArgumentMetadata = {
          type: 'body',
          metatype: SampleUserDto,
          data: '',
        };

        const invalidPayload = {
          username: 'a', // Too short
          email: '', // Empty
        };

        try {
          await pipe.transform(invalidPayload, metadata);
          fail('Expected ValidationPipe to throw BadRequestException');
        } catch (err: any) {
          expect(err).toBeInstanceOf(BadRequestException);
          const response = err.getResponse();
          expect(response.statusCode).toBe(400);
          expect(response.code).toBe('VALIDATION_FAILED');
          expect(response.errors).toEqual(
            expect.arrayContaining([
              expect.objectContaining({ field: 'username' }),
              expect.objectContaining({ field: 'email' }),
            ]),
          );
        }
      });

      it('should cleanly accept valid DTO payloads without errors', async () => {
        const metadata: ArgumentMetadata = {
          type: 'body',
          metatype: SampleUserDto,
          data: '',
        };

        const validPayload = {
          username: 'rustacean',
          email: 'rust@academy.io',
        };

        const result = await pipe.transform(validPayload, metadata);
        expect(result).toBeInstanceOf(SampleUserDto);
        expect(result.username).toBe('rustacean');
        expect(result.email).toBe('rust@academy.io');
      });
    });
  });
});
