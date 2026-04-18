import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './redis.config';

const VELOCITY_TTL_SECONDS = 14_400; // 4 horas

@Injectable()
export class RedisAntifraudRepository {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async isVelocityLimitActive(userId: string, merchantId: string): Promise<boolean> {
    const key = this.buildKey(userId, merchantId);
    const result = await this.redis.exists(key);
    return result === 1;
  }

  async setVelocityLimit(userId: string, merchantId: string): Promise<void> {
    const key = this.buildKey(userId, merchantId);
    await this.redis.set(key, '1', 'EX', VELOCITY_TTL_SECONDS, 'NX');
  }

  private buildKey(userId: string, merchantId: string): string {
    return `antifraud:velocity:${userId}:${merchantId}`;
  }
}
