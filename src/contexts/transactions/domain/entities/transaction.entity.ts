import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum TransactionStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  REVERSED = 'reversed',
}

@Entity('transactions')
@Index(['userId', 'merchantId', 'createdAt'])
@Index(['merchantId', 'createdAt'])
export class TransactionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'merchant_id' })
  merchantId: string;

  @Column({ type: 'decimal', precision: 14, scale: 2 })
  amount: number;

  /**
   * Puntos ganados = (amount / avg_ticket_snapshot) * 10
   * Calculados sobre el monto COMPLETO aunque se haya aplicado un cupón.
   * 0 si la tx fue bloqueada por velocity limit (antifraude).
   */
  @Column({ name: 'trust_points_earned', type: 'decimal', precision: 12, scale: 4, default: 0 })
  trustPointsEarned: number;

  /**
   * Snapshot del average_ticket del local en el momento exacto de la transacción.
   * Permite reproducir el cálculo de puntos en auditorías futuras.
   */
  @Column({ name: 'avg_ticket_snapshot', type: 'decimal', precision: 12, scale: 2, default: 0 })
  avgTicketSnapshot: number;

  @Column({ name: 'coupon_id_applied', type: 'varchar', nullable: true })
  couponIdApplied: string | null;

  @Column({ name: 'coupon_discount_amount', type: 'decimal', precision: 12, scale: 2, default: 0 })
  couponDiscountAmount: number;

  @Column({ name: 'tier_at_transaction', type: 'smallint', nullable: true })
  tierAtTransaction: number | null;

  @Column({ type: 'enum', enum: TransactionStatus, default: TransactionStatus.PENDING })
  status: TransactionStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
