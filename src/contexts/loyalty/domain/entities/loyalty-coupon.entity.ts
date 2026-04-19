import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum CouponStatus {
  ACTIVE = 'active',
  REDEEMED = 'redeemed',
  EXPIRED = 'expired',
}

@Entity('loyalty_coupons')
@Index(['userId', 'merchantId'])
export class LoyaltyCouponEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'merchant_id' })
  merchantId: string;

  @Column({ name: 'tier_earned_at', type: 'smallint' })
  tierEarnedAt: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  value: number;

  @Column({ name: 'avg_ticket_snapshot', type: 'decimal', precision: 12, scale: 2 })
  avgTicketSnapshot: number;

  @Column({ name: 'cashback_pct_snapshot', type: 'decimal', precision: 5, scale: 4 })
  cashbackPctSnapshot: number;

  @Column({ type: 'enum', enum: CouponStatus, default: CouponStatus.ACTIVE })
  status: CouponStatus;

  @Column({ name: 'redeemed_in_transaction_id', type: 'varchar', nullable: true })
  redeemedInTransactionId: string | null;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
