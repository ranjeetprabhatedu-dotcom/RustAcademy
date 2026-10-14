import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

export const SUPPORTED_PROBES = new Set(['liveness', 'readiness', 'startup', 'full']);

export interface HealthResponse {
  status: 'ok';
  service: string;
  probe: string;
  timestamp: string;
  uptime?: number;
  nodeVersion?: string;
}

@ApiTags('health')
@Controller('health')
// controller for health check endpoint with query probe validation (BA-113)
export class HealthController {
  @Get()
  getHealth(
    @Query('probe') probe?: string,
    @Query('verbose') verbose?: string,
  ): HealthResponse {
    if (probe !== undefined && !SUPPORTED_PROBES.has(probe)) {
      throw new BadRequestException(
        `Unsupported probe option '${probe}'. Supported probe options are: ${Array.from(SUPPORTED_PROBES).join(', ')}`,
      );
    }

    const effectiveProbe = probe ?? 'full';
    const isVerbose = verbose === 'true' || verbose === '1';

    const response: HealthResponse = {
      status: 'ok',
      service: 'backend-academy',
      probe: effectiveProbe,
      timestamp: new Date().toISOString(),
    };

    if (isVerbose) {
      response.uptime = process.uptime();
      response.nodeVersion = process.version;
    }

    return response;
  }
}
