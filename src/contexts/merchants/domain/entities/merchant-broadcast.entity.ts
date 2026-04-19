import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('merchant_broadcasts')
export class MerchantBroadcastEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'merchant_id' })
  merchantId: string;

  @Column({ name: 'merchant_name', length: 150 })
  merchantName: string;

  @Column({ name: 'coupon_id', type: 'varchar', nullable: true })
  couponId: string | null;

  @Column({ length: 300 })
  message: string;

  @Column({ name: 'coupon_value', type: 'decimal', precision: 10, scale: 2, nullable: true })
  couponValue: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 6, default: 0 })
  latitude: number;

  @Column({ type: 'decimal', precision: 10, scale: 6, default: 0 })
  longitude: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
