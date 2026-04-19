import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { runSeeds } from './seed';

@Injectable()
export class SeedRunner implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedRunner.name);

  constructor(private readonly dataSource: DataSource) {}

  async onApplicationBootstrap(): Promise<void> {
    try {
      await runSeeds(this.dataSource);
      this.logger.log('Database seeds executed');
    } catch (err) {
      this.logger.error('Seed error', err);
    }
  }
}
