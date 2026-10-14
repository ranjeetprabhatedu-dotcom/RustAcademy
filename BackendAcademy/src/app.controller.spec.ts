import { Test, TestingModule } from '@nestjs/testing';
import { json } from 'express';
import { Readable } from 'stream';
import { AppController } from './app.controller';
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

  describe('Bounded Request Body Size (BA-117)', () => {
    it('should reject oversized JSON bodies with a documented 413 client error', (done) => {
      const limitMiddleware = json({ limit: '64b' });
      const rawPayload = JSON.stringify({ message: 'A'.repeat(128) });
      const req: any = Readable.from([rawPayload]);
      req.headers = {
        'content-type': 'application/json',
        'content-length': String(Buffer.byteLength(rawPayload)),
      };
      const res: any = {};

      limitMiddleware(req, res, (err?: any) => {
        try {
          expect(err).toBeDefined();
          expect(err.status || err.statusCode).toBe(413);
          expect(err.type).toBe('entity.too.large');
          done();
        } catch (e) {
          done(e);
        }
      });
    });

    it('should allow valid JSON bodies within the size limit', (done) => {
      const limitMiddleware = json({ limit: '100kb' });
      const validPayload = JSON.stringify({ title: 'Rust course' });
      const req: any = Readable.from([validPayload]);
      req.headers = {
        'content-type': 'application/json',
        'content-length': String(Buffer.byteLength(validPayload)),
      };
      const res: any = {};

      limitMiddleware(req, res, (err?: any) => {
        try {
          expect(err).toBeUndefined();
          expect(req.body).toEqual({ title: 'Rust course' });
          done();
        } catch (e) {
          done(e);
        }
      });
    });
  });
});
