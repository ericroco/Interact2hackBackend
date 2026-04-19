import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './redis.config';

@Injectable()
export class RedisAntifraudRepository {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  private get velocityTtl(): number {
    return Number(process.env.ANTIFRAUD_VELOCITY_WINDOW_SECONDS ?? 14_400);
  }

  async isVelocityLimitActive(userId: string, merchantId: string): Promise<boolean> {
    if (this.velocityTtl === 0) return false;
    const key = this.buildKey(userId, merchantId);
    const result = await this.redis.exists(key);
    return result === 1;
  }

  async setVelocityLimit(userId: string, merchantId: string): Promise<void> {
    if (this.velocityTtl === 0) return;
    const key = this.buildKey(userId, merchantId);
    await this.redis.set(key, '1', 'EX', this.velocityTtl, 'NX');
  }

  private buildKey(userId: string, merchantId: string): string {
    return `antifraud:velocity:${userId}:${merchantId}`;
  }
}
