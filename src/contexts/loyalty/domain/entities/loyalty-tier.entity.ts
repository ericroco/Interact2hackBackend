import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum TierLevel {
  LOW = 1,
  MEDIUM = 2,
  HIGH = 3,
}

@Entity('loyalty_tiers')
@Index(['userId', 'merchantId'], { unique: true })
export class LoyaltyTierEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'merchant_id' })
  merchantId: string;

  @Column({ name: 'tier_level', type: 'smallint', default: TierLevel.LOW })
  tierLevel: TierLevel;

  @Column({ name: 'trust_points', type: 'decimal', precision: 14, scale: 4, default: 0 })
  trustPoints: number;

  @Column({ name: 'last_transaction_at', type: 'timestamptz', nullable: true })
  lastTransactionAt: Date | null;

  @Column({ name: 'degradation_due_date', type: 'timestamptz', nullable: true })
  degradationDueDate: Date | null;

  @Column({ name: 'avg_frequency_days', type: 'decimal', precision: 8, scale: 2, nullable: true })
  avgFrequencyDays: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
