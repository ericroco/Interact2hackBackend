import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Configuración de umbrales y cashback por (categoría, tier_level).
 * Valor del cupón en runtime = merchant.averageTicket * cashback_pct
 * Ningún porcentaje de cashback vive en código — solo aquí.
 */
@Entity('tier_config')
@Index(['categoryId', 'tierLevel'], { unique: true })
export class TierConfigEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'category_id' })
  categoryId: string;

  @Column({ name: 'tier_level', type: 'smallint' })
  tierLevel: number;

  /**
   * Puntos de Confianza necesarios para desbloquear el cupón de este tier.
   * Tier 1: 100 | Tier 2: 250 | Tier 3: 500 (valores configurables por categoría)
   */
  @Column({ name: 'points_threshold', type: 'integer' })
  pointsThreshold: number;

  /**
   * Porcentaje aplicado sobre merchant.averageTicket para calcular el valor del cupón.
   * coupon_value = averageTicket * cashback_pct
   * Acotado implícitamente por merchant_categories.subsidy_cap_pct.
   */
  @Column({ name: 'cashback_pct', type: 'decimal', precision: 5, scale: 4 })
  cashbackPct: number;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
