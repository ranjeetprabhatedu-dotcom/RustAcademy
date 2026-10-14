import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthController } from './health/health.controller';

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

  describe('Report Dependency Health Separately (BA-112)', () => {
    let healthController: HealthController;
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
      delete process.env.DATABASE_HEALTH;
      delete process.env.STELLAR_RPC_HEALTH;
      healthController = new HealthController();
    });

    afterAll(() => {
      process.env = originalEnv;
    });

    it('should report healthy application and all dependencies as up under normal conditions', () => {
      const res = healthController.getHealth();
      expect(res.status).toBe('ok');
      expect(res.service).toBe('backend-academy');
      expect(res.application).toBeDefined();
      expect(res.application.status).toBe('up');
      expect(res.application.uptime).toBeGreaterThanOrEqual(0);
      expect(res.dependencies.database.status).toBe('up');
      expect(res.dependencies.stellarRpc.status).toBe('up');
      expect(res.dependencies.storage.status).toBe('up');
    });

    it('should distinguish application health from unavailable database dependency', () => {
      process.env.DATABASE_HEALTH = 'down';

      let setStatus = 0;
      const mockRes: any = {
        status(code: number) {
          setStatus = code;
          return this;
        },
      };

      const res = healthController.getHealth(mockRes);

      // Overall status is degraded, but application itself remains up
      expect(res.status).toBe('degraded');
      expect(res.application.status).toBe('up');
      expect(res.dependencies.database.status).toBe('down');
      expect(res.dependencies.database.message).toBe('Database connection unavailable');
      expect(res.dependencies.stellarRpc.status).toBe('up');
      expect(setStatus).toBe(HttpStatus.SERVICE_UNAVAILABLE);
    });

    it('should distinguish application health from unreachable Stellar RPC dependency', () => {
      process.env.STELLAR_RPC_HEALTH = 'down';

      let setStatus = 0;
      const mockRes: any = {
        status(code: number) {
          setStatus = code;
          return this;
        },
      };

      const res = healthController.getHealth(mockRes);

      expect(res.status).toBe('degraded');
      expect(res.application.status).toBe('up');
      expect(res.dependencies.stellarRpc.status).toBe('down');
      expect(res.dependencies.stellarRpc.message).toBe('Stellar RPC endpoint unreachable');
      expect(res.dependencies.database.status).toBe('up');
      expect(setStatus).toBe(HttpStatus.SERVICE_UNAVAILABLE);
    });
  });
});
