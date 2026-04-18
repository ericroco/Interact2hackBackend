import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Cupones de adquisición emitidos por comerciantes para atraer clientes nuevos.
 * Financiados 100% por el comerciante (deduce de merchant.couponFundingBalance).
 * El comerciante define el valor y la compra mínima requerida.
 *
 * Distintos a loyalty_coupons: diferente origen, diferente financiador, diferente flujo.
 */
@Entity('acquisition_coupons')
export class AcquisitionCouponEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'merchant_id' })
  merchantId: string;

  @Column({ unique: true, length: 20 })
  code: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  value: number;

  @Column({ name: 'minimum_ticket', type: 'decimal', precision: 10, scale: 2 })
  minimumTicket: number;

  @Column({ name: 'is_redeemed', default: false })
  isRedeemed: boolean;

  @Column({ name: 'redeemed_by', type: 'varchar', nullable: true })
  redeemedBy: string | null;

  @Column({ name: 'redeemed_at', type: 'timestamptz', nullable: true })
  redeemedAt: Date | null;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
