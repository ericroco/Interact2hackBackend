import { DataSource } from 'typeorm';
import { MerchantCategoryEntity } from '@contexts/loyalty/domain/entities/merchant-category.entity';
import { TierConfigEntity } from '@contexts/loyalty/domain/entities/tier-config.entity';

const CATEGORIES = [
  { code: 'FOOD_BEVERAGE',     name: 'Restaurantes y Comida',    typicalMarginPct: 0.65, subsidyCapPct: 0.04 },
  { code: 'PERSONAL_SERVICES', name: 'Servicios Personales',     typicalMarginPct: 0.60, subsidyCapPct: 0.035 },
  { code: 'FASHION_RETAIL',    name: 'Ropa y Moda',              typicalMarginPct: 0.50, subsidyCapPct: 0.03 },
  { code: 'GROCERY',           name: 'Tienda y Abarrotes',       typicalMarginPct: 0.30, subsidyCapPct: 0.02 },
  { code: 'PHARMACY',          name: 'Farmacia',                 typicalMarginPct: 0.28, subsidyCapPct: 0.018 },
  { code: 'ELECTRONICS',       name: 'Electrónica',              typicalMarginPct: 0.12, subsidyCapPct: 0.01 },
  { code: 'OTHER',             name: 'Otros',                    typicalMarginPct: 0.35, subsidyCapPct: 0.022 },
];

// cashback_pct aplicado sobre average_ticket para calcular el valor del cupón
const TIER_CASHBACK: Record<string, [number, number, number]> = {
  FOOD_BEVERAGE:     [0.08, 0.12, 0.16],
  PERSONAL_SERVICES: [0.07, 0.11, 0.14],
  FASHION_RETAIL:    [0.06, 0.10, 0.13],
  GROCERY:           [0.05, 0.08, 0.11],
  PHARMACY:          [0.04, 0.07, 0.10],
  ELECTRONICS:       [0.02, 0.03, 0.04],
  OTHER:             [0.055, 0.09, 0.12],
};

const THRESHOLDS = [100, 250, 500];

export async function runSeeds(dataSource: DataSource): Promise<void> {
  const categoryRepo = dataSource.getRepository(MerchantCategoryEntity);
  const tierConfigRepo = dataSource.getRepository(TierConfigEntity);

  for (const cat of CATEGORIES) {
    const existing = await categoryRepo.findOneBy({ code: cat.code });
    if (existing) continue;

    const saved = await categoryRepo.save(categoryRepo.create(cat));

    const pcts = TIER_CASHBACK[cat.code];
    for (let i = 0; i < 3; i++) {
      await tierConfigRepo.save(
        tierConfigRepo.create({
          categoryId: saved.id,
          tierLevel: i + 1,
          pointsThreshold: THRESHOLDS[i],
          cashbackPct: pcts[i],
          isActive: true,
        }),
      );
    }
  }

  console.log('Seeds completed.');
}
