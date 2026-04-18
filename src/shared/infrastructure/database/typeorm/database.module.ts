import { Module } from '@nestjs/common';
import { SeedRunner } from '../seeds/seed.runner';

@Module({
  providers: [SeedRunner],
})
export class DatabaseModule {}
