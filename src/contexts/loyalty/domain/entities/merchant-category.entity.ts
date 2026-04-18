import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('merchant_categories')
export class MerchantCategoryEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, length: 50 })
  code: string;

  @Column({ length: 150 })
  name: string;

  @Column({ name: 'typical_margin_pct', type: 'decimal', precision: 5, scale: 4 })
  typicalMarginPct: number;

  /**
   * Techo máximo que Deuna financia como cashback para esta categoría.
   * Derivado de typical_margin_pct para garantizar sostenibilidad del modelo.
   */
  @Column({ name: 'subsidy_cap_pct', type: 'decimal', precision: 5, scale: 4 })
  subsidyCapPct: number;

  @Column({ nullable: true, type: 'text' })
  description: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
