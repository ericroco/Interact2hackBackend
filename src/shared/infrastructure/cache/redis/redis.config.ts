import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export function createRedisClient(config: ConfigService): Redis {
  const url = config.getOrThrow<string>('REDIS_URL');
  return new Redis(url, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: false,
  });
}

export const REDIS_CLIENT = 'REDIS_CLIENT';
