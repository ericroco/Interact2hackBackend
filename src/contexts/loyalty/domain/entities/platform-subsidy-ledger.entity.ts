import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export enum SubsidyStatus {
  PENDING = 'pending',
  SETTLED = 'settled',
  REVERSED = 'reversed',
}

/**
 * Libro contable de cada centavo que Deuna financia.
 * Una entrada por loyalty_coupon redimido.
 * Permite conciliación financiera y reporting de sostenibilidad del programa.
 */
@Entity('platform_subsidies_ledger')
@Index(['couponId'], { unique: true })
@Index(['merchantId', 'status', 'createdAt'])
export class PlatformSubsidyLedgerEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'coupon_id' })
  couponId: string;

  @Column({ name: 'transaction_id' })
  transactionId: string;

  @Column({ name: 'merchant_id' })
  merchantId: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ type: 'decimal', precision: 14, scale: 2 })
  amount: number;

  @Column({ type: 'enum', enum: SubsidyStatus, default: SubsidyStatus.PENDING })
  status: SubsidyStatus;

  @Column({ name: 'settled_at', type: 'timestamptz', nullable: true })
  settledAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
