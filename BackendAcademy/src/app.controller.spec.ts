import { Test, TestingModule } from '@nestjs/testing';
import { ArgumentMetadata, BadRequestException, ValidationPipe } from '@nestjs/common';
import { IsNotEmpty, IsString } from 'class-validator';
import { AppController } from './app.controller';
import { AppService } from './app.service';

const validationPipeOptions = {
  whitelist: true,
  transform: true,
  forbidNonWhitelisted: true,
};

class SampleCourseDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsNotEmpty()
  description!: string;
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

  describe('Global Request Validation (BA-120)', () => {
    let pipe: ValidationPipe;

    beforeEach(() => {
      pipe = new ValidationPipe(validationPipeOptions);
    });

    it('should reject unknown DTO properties without stripping or silently accepting them', async () => {
      const metadata: ArgumentMetadata = {
        type: 'body',
        metatype: SampleCourseDto,
        data: '',
      };

      const payloadWithExtraneousField = {
        title: 'Soroban 101',
        description: 'Introduction to Soroban smart contracts',
        maliciousParam: 'unexpected',
        isAdmin: true,
      };

      await expect(
        pipe.transform(payloadWithExtraneousField, metadata),
      ).rejects.toThrow(BadRequestException);
    });

    it('should include property name in validation error response when unknown fields are present', async () => {
      const metadata: ArgumentMetadata = {
        type: 'body',
        metatype: SampleCourseDto,
        data: '',
      };

      try {
        await pipe.transform({ title: 'Rust', description: 'Basics', extraField: 123 }, metadata);
        fail('Expected ValidationPipe to reject unknown property');
      } catch (err) {
        expect(err).toBeInstanceOf(BadRequestException);
        const res = (err as BadRequestException).getResponse() as any;
        expect(res.message).toEqual(
          expect.arrayContaining([expect.stringContaining('property extraField should not exist')]),
        );
      }
    });

    it('should successfully accept valid payloads conforming to target DTO', async () => {
      const metadata: ArgumentMetadata = {
        type: 'body',
        metatype: SampleCourseDto,
        data: '',
      };

      const validPayload = {
        title: 'Rust Basics',
        description: 'Learn memory safety without garbage collection',
      };

      const result = await pipe.transform(validPayload, metadata);
      expect(result).toBeInstanceOf(SampleCourseDto);
      expect(result.title).toBe('Rust Basics');
      expect(result.description).toBe('Learn memory safety without garbage collection');
    });
  });
});

