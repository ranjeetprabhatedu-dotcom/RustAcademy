import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthController, SUPPORTED_PROBES } from './health/health.controller';

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

  describe('Health Endpoint Query Parameter Validation (BA-113)', () => {
    let healthController: HealthController;

    beforeEach(() => {
      healthController = new HealthController();
    });

    it('should cover accepted default probe when no query parameters are provided', () => {
      const res = healthController.getHealth();
      expect(res.status).toBe('ok');
      expect(res.service).toBe('backend-academy');
      expect(res.probe).toBe('full');
      expect(res.timestamp).toBeDefined();
    });

    it('should accept all supported probe options', () => {
      for (const probe of SUPPORTED_PROBES) {
        const res = healthController.getHealth(probe);
        expect(res.status).toBe('ok');
        expect(res.probe).toBe(probe);
      }
    });

    it('should reject unsupported probe options with BadRequestException', () => {
      expect(() => healthController.getHealth('unsupported-probe')).toThrow(BadRequestException);
      expect(() => healthController.getHealth('db')).toThrow(BadRequestException);

      try {
        healthController.getHealth('invalid');
      } catch (err: any) {
        expect(err).toBeInstanceOf(BadRequestException);
        expect(err.message).toContain("Unsupported probe option 'invalid'");
      }
    });

    it('should include diagnostic fields when verbose query is true', () => {
      const res = healthController.getHealth('readiness', 'true');
      expect(res.status).toBe('ok');
      expect(res.probe).toBe('readiness');
      expect(res.uptime).toBeDefined();
      expect(res.nodeVersion).toBeDefined();
    });
  });
});
