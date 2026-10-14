import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  Module,
  NotFoundException,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthController } from './health/health.controller';
import { GamificationModule } from './gamification/gamification.module';
import { GradingModule } from './grading/grading.module';
import { ChatModule } from './chat/chat.module';
import { SocialModule } from './social/social.module';
import { StellarModule } from './stellar/stellar.module';
import { SandboxModule } from './sandbox/sandbox.module';
import { ProgressModule } from './progress/progress.module';
import { CoursesModule } from './courses/courses.module';
import { CertificatesModule } from './certificates/certificates.module';

export interface NotFoundErrorPayload {
  statusCode: 404;
  error: 'Not Found';
  message: string;
  path?: string;
  timestamp: string;
}

@Catch(NotFoundException)
export class NotFoundExceptionFilter implements ExceptionFilter {
  catch(exception: NotFoundException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    const payload: NotFoundErrorPayload = {
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

// Root application module: wires together global configuration/guards,
// every feature module, and the top-level controllers/providers.
@Module({
  imports: [
    // Loads environment variables and makes ConfigService available
    // app-wide (isGlobal: true) without needing to re-import
    // ConfigModule in every feature module.
    ConfigModule.forRoot({ isGlobal: true }),
    // Configures global rate limiting: by default, 100 requests per
    // 60-second window per client, both overridable via env vars.
    // Combined with APP_GUARD below, this applies to every route unless
    // a controller/route opts out or overrides it (e.g. via @Throttle
    // or @SkipThrottle).
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: Number(process.env.THROTTLE_TTL_MS ?? 60000),
        limit: Number(process.env.THROTTLE_LIMIT ?? 100),
      },
    ]),
    // Feature modules, each encapsulating its own controllers/providers
    // for a specific domain of the app.
    GamificationModule,
    GradingModule,
    ChatModule,
    SocialModule,
    StellarModule,
    SandboxModule,
    ProgressModule,
    CoursesModule,
    CertificatesModule,
  ],
  // Top-level controllers not owned by a specific feature module:
  // AppController (root/basic routes) and HealthController
  // (liveness/readiness/status endpoints).
  controllers: [AppController, HealthController],
  providers: [
    AppService,
    // Registers ThrottlerGuard as a global guard (via the APP_GUARD
    // token), so the rate limiting configured above is actually
    // enforced on every request rather than just being available.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // Standardizes not-found responses for unmatched routes (BA-119)
    { provide: APP_FILTER, useClass: NotFoundExceptionFilter },
  ],
})
export class AppModule {}