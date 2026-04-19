import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('merchants')
export class MerchantEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'category_id' })
  categoryId: string;

  @Column({ name: 'business_name', length: 255 })
  businessName: string;

  @Column({ unique: true, length: 13 })
  ruc: string;

  @Column({ name: 'owner_email', unique: true, length: 255 })
  ownerEmail: string;

  @Column({ name: 'password_hash', length: 255 })
  passwordHash: string;

  @Column({ name: 'average_ticket', type: 'decimal', precision: 12, scale: 2, default: 0 })
  averageTicket: number;

  @Column({ name: 'coupon_funding_balance', type: 'decimal', precision: 14, scale: 2, default: 0 })
  couponFundingBalance: number;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'loyalty_enabled', default: false })
  loyaltyEnabled: boolean;

  @Column({ type: 'decimal', precision: 10, scale: 6, default: 0 })
  latitude: number;

  @Column({ type: 'decimal', precision: 10, scale: 6, default: 0 })
  longitude: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
