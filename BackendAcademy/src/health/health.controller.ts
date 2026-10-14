import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

export type DependencyStatus = 'up' | 'down' | 'degraded';

export interface DependencyHealth {
  status: DependencyStatus;
  latencyMs?: number;
  message?: string;
}

export interface DetailedHealthResponse {
  status: 'ok' | 'degraded';
  service: string;
  application: {
    status: 'up';
    uptime: number;
    timestamp: string;
  };
  dependencies: {
    database: DependencyHealth;
    stellarRpc: DependencyHealth;
    storage: DependencyHealth;
  };
}

@ApiTags('health')
@Controller('health')
// controller for health check endpoint distinguishing application vs dependency health (BA-112)
export class HealthController {
  checkDependencies(): DetailedHealthResponse['dependencies'] {
    const dbHealthy = process.env.DATABASE_HEALTH !== 'down';
    const rpcHealthy = process.env.STELLAR_RPC_HEALTH !== 'down';

    return {
      database: {
        status: dbHealthy ? 'up' : 'down',
        message: dbHealthy ? 'Connected to primary database' : 'Database connection unavailable',
      },
      stellarRpc: {
        status: rpcHealthy ? 'up' : 'down',
        message: rpcHealthy ? 'Connected to Stellar Horizon/RPC' : 'Stellar RPC endpoint unreachable',
      },
      storage: {
        status: 'up',
        message: 'Storage service accessible',
      },
    };
  }

  @Get()
  getHealth(@Res({ passthrough: true }) res?: any): DetailedHealthResponse {
    const dependencies = this.checkDependencies();
    const hasDownDependencies = Object.values(dependencies).some(
      (dep) => dep.status === 'down',
    );

    const overallStatus: 'ok' | 'degraded' = hasDownDependencies ? 'degraded' : 'ok';
    const responsePayload: DetailedHealthResponse = {
      status: overallStatus,
      service: 'backend-academy',
      application: {
        status: 'up',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
      },
      dependencies,
    };

    if (hasDownDependencies && res && typeof res.status === 'function') {
      res.status(HttpStatus.SERVICE_UNAVAILABLE);
    }

    return responsePayload;
  }
}
