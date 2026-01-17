import { Controller, Get } from '@nestjs/common';
import { Public } from '../../common/decorators/index.js';

interface HealthCheckResponse {
  status: string;
  timestamp: string;
  uptime: number;
  version: string;
}

@Controller('health')
export class HealthController {
  @Get()
  @Public()
  check(): HealthCheckResponse {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version ?? '0.0.1',
    };
  }
}
