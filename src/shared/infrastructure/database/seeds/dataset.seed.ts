import * as fs from 'fs';
import * as path from 'path';
import * as bcrypt from 'bcrypt';
import { DataSource } from 'typeorm';
import { UserEntity } from '@contexts/users/domain/entities/user.entity';
import { MerchantEntity } from '@contexts/merchants/domain/entities/merchant.entity';
import { MerchantCategoryEntity } from '@contexts/loyalty/domain/entities/merchant-category.entity';
import { LoyaltyTierEntity, TierLevel } from '@contexts/loyalty/domain/entities/loyalty-tier.entity';
import { LoyaltyCouponEntity, CouponStatus } from '@contexts/loyalty/domain/entities/loyalty-coupon.entity';

const DATASETS_DIR = path.join(process.cwd(), 'datasets1');
const DEFAULT_PASSWORD_HASH_CACHE: { hash?: string } = {};

const CSV_CATEGORY_MAP: Record<string, string> = {
  Comida: 'FOOD_BEVERAGE',
  'Víveres': 'GROCERY',
  Farmacia: 'PHARMACY',
  Transporte: 'OTHER',
};

const TIER_POINTS: Record<number, number> = { 1: 75, 2: 215, 3: 430 };

function parseCsv(filename: string): Record<string, string>[] {
  const content = fs.readFileSync(path.join(DATASETS_DIR, filename), 'utf8');
  const lines = content.trim().split('\n');
  const headers = lines[0].split(',');
  return lines.slice(1).map((line) => {
    // Regex for standard CSV: split by comma but ignore commas inside double quotes
    const values = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
    return Object.fromEntries(headers.map((h, i) => [
      h.trim(), 
      (values[i] ?? '').replace(/^"|"$/g, '').trim()
    ]));
  });
}

function toE164(userId: string): string {
  return '+593' + userId.replace(/^0/, '');
}

async function getDefaultHash(): Promise<string> {
  if (!DEFAULT_PASSWORD_HASH_CACHE.hash) {
    DEFAULT_PASSWORD_HASH_CACHE.hash = await bcrypt.hash('deuna123', 10);
  }
  return DEFAULT_PASSWORD_HASH_CACHE.hash;
}

export async function runDatasetSeed(dataSource: DataSource): Promise<void> {
  if (!fs.existsSync(DATASETS_DIR)) return;

  const userRepo = dataSource.getRepository(UserEntity);
  const merchantRepo = dataSource.getRepository(MerchantEntity);
  const categoryRepo = dataSource.getRepository(MerchantCategoryEntity);
  const tierRepo = dataSource.getRepository(LoyaltyTierEntity);
  const couponRepo = dataSource.getRepository(LoyaltyCouponEntity);

  const passwordHash = await getDefaultHash();

  const csvMerchants = parseCsv('dim_merchants.csv');
  const csvUsers = parseCsv('dim_users.csv');
  const csvTxs = parseCsv('fact_transactions.csv');

  // ── Mapa de categorías DB ──────────────────────────────────────────────────
  const allCategories = await categoryRepo.find();
  const categoryByCode = new Map(allCategories.map((c) => [c.code, c]));

  // ── Merchants ──────────────────────────────────────────────────────────────
  const merchantById = new Map<string, MerchantEntity>();
  const merchantMeta = new Map(csvMerchants.map((r) => [r.merchant_id, r]));

  for (const row of csvMerchants) {
    const categoryCode = CSV_CATEGORY_MAP[row.categoria] ?? 'OTHER';
    const category = categoryByCode.get(categoryCode);
    if (!category) continue;

    const ruc = row.merchant_id.replace('M', '00000000000').slice(0, 13);
    const email = `${row.merchant_id.toLowerCase()}@deuna-demo.ec`;

    let merchant = await merchantRepo.findOneBy({ ruc });
    if (!merchant) {
      merchant = await merchantRepo.save(
        merchantRepo.create({
          categoryId: category.id,
          businessName: row.nombre,
          ruc,
          ownerEmail: email,
          passwordHash,
          averageTicket: parseFloat(row.ticket_promedio) || 0,
          couponFundingBalance: 5,
          isActive: true,
          loyaltyEnabled: true,
          latitude: parseFloat(row.lat) || 0,
          longitude: parseFloat(row.lng) || 0,
        }),
      );
    } else {
      // Update existing merchant coordinates just in case
      merchant.latitude = parseFloat(row.lat) || 0;
      merchant.longitude = parseFloat(row.lng) || 0;
      await merchantRepo.save(merchant);
    }
    merchantById.set(row.merchant_id, merchant);
  }

  // ── Usuarios ───────────────────────────────────────────────────────────────
  const userByCsvId = new Map<string, UserEntity>();

  for (const row of csvUsers) {
    const phone = toE164(row.user_id);
    let user = await userRepo.findOneBy({ phone });
    if (!user) {
      user = await userRepo.save(
        userRepo.create({
          phone,
          fullName: row.nombre_completo,
          email: null,
          passwordHash,
          isActive: true,
          latitude: parseFloat(row.lat) || 0,
          longitude: parseFloat(row.lng) || 0,
        }),
      );
    } else {
      user.latitude = parseFloat(row.lat) || 0;
      user.longitude = parseFloat(row.lng) || 0;
      await userRepo.save(user);
    }
    userByCsvId.set(row.user_id, user);
  }

  const userMeta = new Map(
    csvUsers.map((r) => [
      r.user_id,
      {
        tier: parseInt(r.nivel_lealtad_inicial, 10) as 1 | 2 | 3,
        lastTx: r.fecha_ultima_tx ? new Date(r.fecha_ultima_tx) : null,
      },
    ]),
  );

  // ── Loyalty tiers y cupones activos por par (user, merchant) ───────────────
  const pairsSet = new Set<string>();
  const pairDisponible = new Set<string>();

  for (const tx of csvTxs) {
    const key = `${tx.user_id}::${tx.merchant_id}`;
    pairsSet.add(key);
    if (tx.estado_yapa === 'Disponible') pairDisponible.add(key);
  }

  for (const key of pairsSet) {
    const [csvUserId, csvMerchantId] = key.split('::');
    const user = userByCsvId.get(csvUserId);
    const merchant = merchantById.get(csvMerchantId);
    if (!user || !merchant) continue;

    const meta = userMeta.get(csvUserId);
    if (!meta) continue;

    const tierLevel = meta.tier as TierLevel;
    const existing = await tierRepo.findOneBy({ userId: user.id, merchantId: merchant.id });

    if (!existing) {
      const degradationDue = meta.lastTx
        ? new Date(meta.lastTx.getTime() + 30 * 86400000)
        : null;

      await tierRepo.save(
        tierRepo.create({
          userId: user.id,
          merchantId: merchant.id,
          tierLevel,
          trustPoints: TIER_POINTS[meta.tier] ?? 75,
          lastTransactionAt: meta.lastTx,
          degradationDueDate: degradationDue,
          avgFrequencyDays: null,
        }),
      );
    }

    if (!pairDisponible.has(key)) continue;

    const alreadyCoupon = await couponRepo.findOne({
      where: { userId: user.id, merchantId: merchant.id, status: CouponStatus.ACTIVE },
    });
    if (alreadyCoupon) continue;

    const mRow = merchantMeta.get(csvMerchantId);
    const avgTicket = parseFloat(mRow?.ticket_promedio ?? '5');
    const couponValue = Math.round(parseFloat(mRow?.coupon_descuento ?? '1') * 100) / 100;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await couponRepo.save(
      couponRepo.create({
        userId: user.id,
        merchantId: merchant.id,
        tierEarnedAt: tierLevel,
        value: couponValue,
        avgTicketSnapshot: avgTicket,
        cashbackPctSnapshot: 0.18,
        status: CouponStatus.ACTIVE,
        redeemedInTransactionId: null,
        expiresAt,
      }),
    );
  }

  // ── Transacciones (570 filas del CSV) ─────────────────────────────────────
  // Verificar cuántas ya existen para decidir si insertar
  const existingTxCount = await dataSource.query(
    `SELECT COUNT(*) FROM transactions WHERE avg_ticket_snapshot > 0 AND coupon_discount_amount = 0 AND created_at < NOW() - INTERVAL '30 days'`
  );
  if (parseInt(existingTxCount[0].count, 10) >= 500) {
    console.log('Dataset transactions already seeded, skipping.');
    console.log(`Dataset seed: ${merchantById.size} merchants, ${userByCsvId.size} users.`);
    return;
  }

  // Batch insert de transacciones con timestamps históricos reales
  const BATCH_SIZE = 50;
  let insertedTxCount = 0;

  for (let i = 0; i < csvTxs.length; i += BATCH_SIZE) {
    const batch = csvTxs.slice(i, i + BATCH_SIZE);
    const values: string[] = [];
    const params: unknown[] = [];
    let paramIdx = 1;

    for (const tx of batch) {
      const user = userByCsvId.get(tx.user_id);
      const merchant = merchantById.get(tx.merchant_id);
      if (!user || !merchant) continue;

      const amount = parseFloat(tx.monto) || 0;
      const avgTicketSnapshot = parseFloat(tx.ticket_promedio_ref) || 0;
      const isFraud = tx.status_fraude === 'Detectado';
      const effortoRelativo = parseFloat(tx.esfuerzo_relativo) || 0;
      const trustPointsEarned = isFraud ? 0 : effortoRelativo * 10;
      const tierAtTx = parseInt(tx.nivel_usuario, 10) || 1;
      const hasRedemption = tx.redemption_status === 'Exitosa';
      const mRow = merchantMeta.get(tx.merchant_id);
      const couponDiscount = hasRedemption
        ? Math.round(parseFloat(mRow?.coupon_descuento ?? '1') * 100) / 100
        : 0;
      const txTimestamp = tx.timestamp || new Date().toISOString();

      values.push(
        `($${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++})`,
      );
      params.push(
        user.id,
        merchant.id,
        amount,
        trustPointsEarned,
        avgTicketSnapshot,
        couponDiscount,
        tierAtTx,
        'completed',
        txTimestamp,
      );
      insertedTxCount++;
    }

    if (values.length === 0) continue;

    await dataSource.query(
      `INSERT INTO transactions
         (user_id, merchant_id, amount, trust_points_earned, avg_ticket_snapshot,
          coupon_discount_amount, tier_at_transaction, status, created_at)
       VALUES ${values.join(', ')}
       ON CONFLICT DO NOTHING`,
      params,
    );
  }

  console.log(
    `Dataset seed: ${merchantById.size} merchants, ${userByCsvId.size} users, ${insertedTxCount} transactions inserted.`,
  );
}
