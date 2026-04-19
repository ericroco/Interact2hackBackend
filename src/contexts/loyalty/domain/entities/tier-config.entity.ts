import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('tier_config')
@Index(['categoryId', 'tierLevel'], { unique: true })
export class TierConfigEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'category_id' })
  categoryId: string;

  @Column({ name: 'tier_level', type: 'smallint' })
  tierLevel: number;

  @Column({ name: 'points_threshold', type: 'integer' })
  pointsThreshold: number;

  @Column({ name: 'cashback_pct', type: 'decimal', precision: 5, scale: 4 })
  cashbackPct: number;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
