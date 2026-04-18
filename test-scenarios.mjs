/**
 * test-scenarios.mjs — Runner automático del sistema de Yapas (v3)
 *
 * Cubre:
 *   - Merchant FRESCO por cada run → averageTicket = 0 → cálculos estables
 *   - Generación automática de Yapas (reset puntos + ascenso tier al generarse)
 *   - Tiered cashback: Tier1 [$0.50-$2], Tier2 [$1-$3.50], Tier3 [$1.50-$5]
 *   - Límite de 5 Yapas activas por usuario+local
 *   - Redención voluntaria con couponId
 *   - Errores: couponId inválido, cross-user, cross-merchant, doble redención
 *   - Seguridad de tokens y validaciones DTO
 *   - Antifraud: adaptable — si ANTIFRAUD_VELOCITY_WINDOW_SECONDS=0 corre todo
 *
 * Uso: node test-scenarios.mjs
 * Requiere: servidor corriendo (npm run start:dev) + Docker (postgres + redis)
 */

const BASE = 'http://localhost:3000';
const SEED_MERCHANT_EMAIL = 'elrincon@test.com';
const SEED_MERCHANT_PASS  = 'password123';

// ── Colores ────────────────────────────────────────────────────────────────
const C = {
  reset: '\x1b[0m', green: '\x1b[32m', red: '\x1b[31m',
  yellow: '\x1b[33m', cyan: '\x1b[36m', bold: '\x1b[1m', dim: '\x1b[2m',
};
let passed = 0, failed = 0, skipped = 0;

function header(title) {
  console.log(`\n${C.bold}${C.cyan}═══════════════════════════════════════════════${C.reset}`);
  console.log(`${C.bold}  ${title}${C.reset}`);
  console.log(`${C.cyan}═══════════════════════════════════════════════${C.reset}`);
}

function check(label, condition, got, expected) {
  if (condition) {
    console.log(`  ${C.green}✓ PASS${C.reset}  ${label}`);
    passed++;
  } else {
    console.log(`  ${C.red}✗ FAIL${C.reset}  ${label}`);
    console.log(`    ${C.dim}esperado: ${JSON.stringify(expected)} | obtenido: ${JSON.stringify(got)}${C.reset}`);
    failed++;
  }
}

function skip(label, reason) {
  console.log(`  ${C.yellow}⚠ SKIP${C.reset}  ${label}  ${C.dim}[${reason}]${C.reset}`);
  skipped++;
}

function show(label, value) {
  console.log(`  ${C.cyan}ℹ${C.reset}  ${label}: ${C.yellow}${JSON.stringify(value)}${C.reset}`);
}

function showErr(label, res) {
  if (res.status >= 400) {
    console.log(`    ${C.red}ERR ${res.status}:${C.reset} ${C.dim}${JSON.stringify(res.body?.message ?? res.body)}${C.reset}`);
  }
}

// ── HTTP ───────────────────────────────────────────────────────────────────
async function api(method, path, body, token) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, body: json };
}

// ── Helpers ────────────────────────────────────────────────────────────────
let _uidSeq = 0;
function uid() {
  return `${Date.now()}${String(++_uidSeq).padStart(3,'0')}`;
}

/**
 * Crea un usuario único y hace login.
 * (register no devuelve token → login por separado)
 */
async function createUser(name) {
  const id  = uid();
  const ph  = `+593${id.slice(-9)}`.slice(0, 13);
  const em  = `u${id}@test.ec`;
  const pw  = 'deuna123';
  await api('POST', '/auth/register', { phone: ph, fullName: name, password: pw, email: em });
  const r = await api('POST', '/auth/login', { phone: ph, password: pw });
  return { token: r.body?.data?.accessToken, phone: ph };
}

/**
 * Registra un merchant fresco (avgTicket=0) y hace login.
 * Esto garantiza que los cálculos de puntos sean estables entre runs.
 */
async function createFreshMerchant(categoryId) {
  const id  = uid();
  const em  = `m${id}@testmerch.ec`;
  const pw  = 'deuna123';
  const ruc = id.slice(-13).padEnd(13, '0');
  const reg = await api('POST', '/merchants/auth/register', {
    categoryId,
    businessName: `TestMerch_${id}`,
    ruc,
    ownerEmail: em,
    password: pw,
  });
  const mId = reg.body?.data?.merchantId;
  if (!mId) return null;
  const login = await api('POST', '/merchants/auth/login', { ownerEmail: em, password: pw });
  return { token: login.body?.data?.accessToken, merchantId: mId };
}

async function scan(token, merchantId, amount, couponId) {
  const body = { merchantId, amount };
  if (couponId) body.couponId = couponId;
  return api('POST', '/loyalty/scan', body, token);
}

async function getProfile(token) {
  const r = await api('GET', '/loyalty/profile', null, token);
  return r.body?.data ?? [];
}

async function getMerchantStats(token) {
  const r = await api('GET', '/merchants/me/stats', null, token);
  return r.body?.data ?? {};
}

/**
 * Monto requerido para ganar al menos `neededPts` en un solo scan.
 * avgTicket=0 → primer scan del merchant → siempre son 10 pts → usa 10*neededPts.
 * avgTicket>0 → formula: amount = ceil(neededPts * avgTicket / 10) + 1
 */
function amountFor(neededPts, avgTicket) {
  if (avgTicket <= 0) return neededPts * 10;
  return Math.ceil((neededPts * avgTicket) / 10) + 1;
}

// ════════════════════════════════════════════════════════════════════════════
async function run() {
  console.log(`\n${C.bold}🚀  Deuna Loyalty — Test Runner v3 (Merchant Fresco + Yapas)${C.reset}`);
  console.log(`${C.dim}  Base URL: ${BASE}  |  Cada run usa merchant fresco → avgTicket estable${C.reset}\n`);

  // ══════════════════════════════════════════════════════════════════════
  // FASE 0 — Health
  // ══════════════════════════════════════════════════════════════════════
  header('FASE 0 — Health Check');
  const health = await api('GET', '/health');
  check('Servidor en línea (200)', health.status === 200, health.status, 200);
  check('Database: ok', health.body?.services?.database === 'ok', health.body?.services?.database, 'ok');
  check('Redis: ok',    health.body?.services?.redis    === 'ok', health.body?.services?.redis,    'ok');
  if (health.status !== 200) { console.error('Servidor caído. Abortando.'); process.exit(1); }

  // ══════════════════════════════════════════════════════════════════════
  // FASE 1 — Setup: seed merchant + fresh merchant + usuarios
  // ══════════════════════════════════════════════════════════════════════
  header('FASE 1 — Setup');

  // Verificar merchant seed (elrincon@test.com)
  const seedLogin = await api('POST', '/merchants/auth/login',
    { ownerEmail: SEED_MERCHANT_EMAIL, password: SEED_MERCHANT_PASS });
  const seedToken = seedLogin.body?.data?.accessToken;
  if (!seedToken) {
    console.error(`\n${C.red}${C.bold}No se pudo hacer login como merchant seed (${SEED_MERCHANT_EMAIL}).`);
    console.error(`Corre primero los pasos 2.1-2.2 del POSTMAN_TESTING_GUIDE.md${C.reset}\n`);
    process.exit(1);
  }
  check('Login merchant seed (elrincon) OK', !!seedToken, !!seedToken, true);

  // Obtener categoryId del seed merchant para crear merchants frescos
  const cats = await api('GET', '/merchants/categories', null, seedToken);
  const catId = cats.body?.data?.[0]?.id;
  check('Categorías disponibles', !!catId, !!catId, true);
  show('categoryId usado', catId);

  // Crear merchant FRESCO (avgTicket=0, cálculos estables)
  const freshM = await createFreshMerchant(catId);
  check('Merchant fresco creado', !!freshM?.merchantId, !!freshM?.merchantId, true);
  const fMToken = freshM?.token;
  const fMId    = freshM?.merchantId;
  show('freshMerchantId', fMId);

  // Crear usuarios frescos
  const userA = await createUser('Usuario A Test');
  const userB = await createUser('Usuario B Test');
  check('Usuario A creado + login OK', !!userA.token, !!userA.token, true);
  check('Usuario B creado + login OK', !!userB.token, !!userB.token, true);

  // ══════════════════════════════════════════════════════════════════════
  // FASE 2 — Primera Compra (merchant fresco → 10 pts exactos)
  // ══════════════════════════════════════════════════════════════════════
  header('FASE 2 — Primera Compra (avgTicket=0 → 10 pts base)');

  const s1 = await scan(userA.token, fMId, 10.00);
  check('Primera compra → 200', s1.status === 200, s1.status, 200); showErr('s1', s1);
  check('trustPointsEarned = 10 (avgTicket=0)', Math.abs((s1.body?.data?.trustPointsEarned ?? -1) - 10) < 0.01,
    s1.body?.data?.trustPointsEarned, 10);
  check('tierLevel = 1',          s1.body?.data?.tierLevel     === 1,    s1.body?.data?.tierLevel, 1);
  check('couponUnlocked = null',  s1.body?.data?.couponUnlocked === null, s1.body?.data?.couponUnlocked, null);
  check('couponApplied = null',   s1.body?.data?.couponApplied  === null, s1.body?.data?.couponApplied, null);
  check('activeYapasCount = 0',   s1.body?.data?.activeYapasCount === 0,  s1.body?.data?.activeYapasCount, 0);
  check('antifraudBlocked = false', s1.body?.data?.antifraudBlocked === false, s1.body?.data?.antifraudBlocked, false);
  show('totalTrustPoints', s1.body?.data?.totalTrustPoints);
  show('pointsToNextCoupon', s1.body?.data?.pointsToNextCoupon);

  // ══════════════════════════════════════════════════════════════════════
  // FASE 3 — Antifraud (velocity limit)
  // ══════════════════════════════════════════════════════════════════════
  header('FASE 3 — Antifraud (Velocity Limit)');

  const sAF = await scan(userA.token, fMId, 15.00);
  check('Segunda compra inmediata → 200', sAF.status === 200, sAF.status, 200); showErr('sAF', sAF);
  const antifraudActive = sAF.body?.data?.antifraudBlocked === true;

  if (antifraudActive) {
    check('antifraudBlocked = true ✓',          true, true, true);
    check('trustPointsEarned = 0 (bloqueado)',   sAF.body?.data?.trustPointsEarned === 0, sAF.body?.data?.trustPointsEarned, 0);
    check('couponUnlocked = null (bloqueado)',    sAF.body?.data?.couponUnlocked === null,  sAF.body?.data?.couponUnlocked, null);
    show('Antifraud', 'ACTIVO — fases 6-7 se saltan (pon ANTIFRAUD_VELOCITY_WINDOW_SECONDS=0)');
  } else {
    check('antifraudBlocked = false (desactivado) ✓', true, true, true);
    check('trustPointsEarned > 0 (segunda compra OK)', (sAF.body?.data?.trustPointsEarned ?? 0) > 0, sAF.body?.data?.trustPointsEarned, '>0');
    show('Antifraud', 'DESACTIVADO ✓ (ANTIFRAUD_VELOCITY_WINDOW_SECONDS=0)');
  }

  // ══════════════════════════════════════════════════════════════════════
  // FASE 4 — Perfil del Usuario (sin Yapas)
  // ══════════════════════════════════════════════════════════════════════
  header('FASE 4 — Perfil del Usuario (sin Yapas todavía)');

  const profEmpty = await getProfile(userA.token);
  const entA = profEmpty.find(e => e.merchantId === fMId);
  check('Perfil tiene entrada para el fresh merchant', !!entA, !!entA, true);
  check('activeYapas = []',        Array.isArray(entA?.activeYapas) && entA?.activeYapas?.length === 0, entA?.activeYapas, []);
  check('yapasCount = 0',          entA?.yapasCount === 0,         entA?.yapasCount, 0);
  check('totalYapasValue = 0',     entA?.totalYapasValue === 0,    entA?.totalYapasValue, 0);
  check('trustPoints > 0',         (entA?.trustPoints ?? 0) > 0,   entA?.trustPoints, '>0');
  check('tierLevel = 1',           entA?.tierLevel === 1,           entA?.tierLevel, 1);
  check('pointsToNextCoupon OK',   typeof entA?.pointsToNextCoupon === 'number', typeof entA?.pointsToNextCoupon, 'number');
  show('trustPoints actuales', entA?.trustPoints);
  show('pointsToNextCoupon',   entA?.pointsToNextCoupon);

  // ══════════════════════════════════════════════════════════════════════
  // FASE 5 — Validaciones de couponId
  // ══════════════════════════════════════════════════════════════════════
  header('FASE 5 — Validaciones de couponId');

  const badUuid = await scan(userA.token, fMId, 10.00, '00000000-0000-0000-0000-000000000000');
  check('couponId UUID inexistente → 400', badUuid.status === 400, badUuid.status, 400);
  show('Mensaje couponId inválido', badUuid.body?.message);

  const badFmt = await api('POST', '/loyalty/scan', { merchantId: fMId, amount: 10, couponId: 'no-es-uuid' }, userA.token);
  check('couponId formato inválido → 400', badFmt.status === 400, badFmt.status, 400);

  // ══════════════════════════════════════════════════════════════════════
  // FASES 6-7 — Acumulación (requiere antifraud=0)
  // ══════════════════════════════════════════════════════════════════════
  if (antifraudActive) {
    header('FASES 6-7 — Acumulación de Yapas (skipped)');
    skip('Yapa #1 (Tier 1→2, pts reset)',           'Necesita ANTIFRAUD_VELOCITY_WINDOW_SECONDS=0');
    skip('Yapa #2 (Tier 2→3)',                       'Necesita ANTIFRAUD_VELOCITY_WINDOW_SECONDS=0');
    skip('Yapas #3,4,5 (Tier 3 repeat)',              'Necesita ANTIFRAUD_VELOCITY_WINDOW_SECONDS=0');
    skip('Límite 5 yapas (no genera #6)',             'Necesita ANTIFRAUD_VELOCITY_WINDOW_SECONDS=0');
    skip('Redención voluntaria con couponId',         'Necesita ANTIFRAUD_VELOCITY_WINDOW_SECONDS=0');
    skip('Cross-user y cross-merchant → 400',         'Necesita ANTIFRAUD_VELOCITY_WINDOW_SECONDS=0');
    skip('Doble redención → 400',                    'Necesita ANTIFRAUD_VELOCITY_WINDOW_SECONDS=0');
    skip('Regenerar yapa tras redención',             'Necesita ANTIFRAUD_VELOCITY_WINDOW_SECONDS=0');
  } else {
    // ── Merchant FRESCO exclusivo para acumulación (aislado del FASE 2-5)
    // Usamos un segundo merchant fresco para que userA de FASE 2 no tenga pts previos
    const accumM = await createFreshMerchant(catId);
    check('Merchant acumulación creado', !!accumM?.merchantId, !!accumM?.merchantId, true);
    const aMToken = accumM?.token;
    const aMId    = accumM?.merchantId;

    // Usuario dedicado a acumulación (estado limpio)
    const yapUser = await createUser('Yapa Accum User');
    check('Usuario acumulador creado', !!yapUser.token, !!yapUser.token, true);
    const YT = yapUser.token;

    // ─────────────────────────────────────────────────────────────────────
    header('FASE 6 — Generación de Yapas (acumulación hasta 5)');
    // ─────────────────────────────────────────────────────────────────────

    // ── yScan #1: avgTicket=0 → 10 pts base
    const yS1 = await scan(YT, aMId, 10.00);
    check('yScan #1 → 200', yS1.status === 200, yS1.status, 200); showErr('yScan1', yS1);
    const pts1 = yS1.body?.data?.totalTrustPoints ?? 0;
    check('yScan #1 → 10 pts (avgTicket=0)', Math.abs(pts1 - 10) < 0.1, pts1, 10);
    check('yScan #1 → tierLevel = 1',         yS1.body?.data?.tierLevel === 1, yS1.body?.data?.tierLevel, 1);
    check('yScan #1 → couponUnlocked = null', yS1.body?.data?.couponUnlocked === null, yS1.body?.data?.couponUnlocked, null);
    show('yScan #1 totalTrustPoints', pts1);

    // ── yScan #2: alcanzar threshold Tier1 (100 pts) → Yapa #1
    const statsA1 = await getMerchantStats(aMToken);
    const avgTA1  = Number(statsA1.averageTicket ?? 10);
    const amtA2   = amountFor(100 - pts1 + 1, avgTA1);
    show('avgTicket tras yScan #1', avgTA1);
    show('Monto yScan #2 (Tier1 threshold)', `$${amtA2}`);

    const yS2 = await scan(YT, aMId, amtA2);
    check('yScan #2 → 200', yS2.status === 200, yS2.status, 200); showErr('yScan2', yS2);
    const yapa1 = yS2.body?.data?.couponUnlocked;
    check('yScan #2 → Yapa #1 desbloqueada',       !!yapa1, !!yapa1, true);
    check('Yapa #1 → id UUID',                     typeof yapa1?.id === 'string' && yapa1.id.length > 10, yapa1?.id, 'uuid');
    check('Yapa #1 → value > 0',                   (yapa1?.value ?? 0) > 0, yapa1?.value, '>0');
    check('Yapa #1 → value en rango [$0.50-$2.00]', (yapa1?.value ?? 0) >= 0.50 && (yapa1?.value ?? 0) <= 2.00, yapa1?.value, '[0.50-2.00]');
    check('Yapa #1 → mensaje string',              typeof yapa1?.message === 'string', typeof yapa1?.message, 'string');
    check('yScan #2 → tier subió a 2 al generar',  yS2.body?.data?.tierLevel === 2, yS2.body?.data?.tierLevel, 2);
    check('yScan #2 → trustPoints = 0 (reset)',    yS2.body?.data?.totalTrustPoints === 0, yS2.body?.data?.totalTrustPoints, 0);
    check('yScan #2 → activeYapasCount = 1',       yS2.body?.data?.activeYapasCount === 1, yS2.body?.data?.activeYapasCount, 1);
    show('Yapa #1', { id: yapa1?.id?.slice(0,8)+'...', value: yapa1?.value });

    // Perfil tras Yapa #1
    const prof1 = await getProfile(YT);
    const ent1  = prof1.find(e => e.merchantId === aMId);
    check('Perfil Yapa #1: yapasCount = 1',              ent1?.yapasCount === 1, ent1?.yapasCount, 1);
    check('Perfil Yapa #1: activeYapas[0].id correcto',  ent1?.activeYapas?.[0]?.id === yapa1?.id, ent1?.activeYapas?.[0]?.id, yapa1?.id);
    check('Perfil Yapa #1: tierEarnedAt = 1',            ent1?.activeYapas?.[0]?.tierEarnedAt === 1, ent1?.activeYapas?.[0]?.tierEarnedAt, 1);
    check('Perfil Yapa #1: tierLevel = 2',               ent1?.tierLevel === 2, ent1?.tierLevel, 2);
    check('Perfil Yapa #1: trustPoints = 0',             ent1?.trustPoints === 0, ent1?.trustPoints, 0);
    check('Perfil Yapa #1: totalYapasValue = yapa1.value', ent1?.totalYapasValue === yapa1?.value, ent1?.totalYapasValue, yapa1?.value);
    const yapa1Id    = yapa1?.id;
    const yapa1Value = yapa1?.value;

    // ── yScan #3: threshold Tier2 (250 pts) → Yapa #2
    const statsA2 = await getMerchantStats(aMToken);
    const avgTA2  = Number(statsA2.averageTicket);
    const amtA3   = amountFor(251, avgTA2);
    show('Monto yScan #3 (Tier2 threshold)', `$${amtA3}`);

    const yS3 = await scan(YT, aMId, amtA3);
    check('yScan #3 → 200', yS3.status === 200, yS3.status, 200); showErr('yScan3', yS3);
    const yapa2 = yS3.body?.data?.couponUnlocked;
    check('yScan #3 → Yapa #2 desbloqueada',      !!yapa2, !!yapa2, true);
    check('yScan #3 → tier subió a 3',             yS3.body?.data?.tierLevel === 3, yS3.body?.data?.tierLevel, 3);
    check('yScan #3 → trustPoints = 0 (reset)',    yS3.body?.data?.totalTrustPoints === 0, yS3.body?.data?.totalTrustPoints, 0);
    check('yScan #3 → activeYapasCount = 2',       yS3.body?.data?.activeYapasCount === 2, yS3.body?.data?.activeYapasCount, 2);
    check('Yapa #2 → value >= Yapa #1 (Tier2>=Tier1)', (yapa2?.value ?? 0) >= (yapa1Value ?? 0), yapa2?.value, `>=${yapa1Value}`);
    check('Yapa #2 → value en rango [$1.00-$3.50]', (yapa2?.value ?? 0) >= 1.00 && (yapa2?.value ?? 0) <= 3.50, yapa2?.value, '[1.00-3.50]');
    check('Yapa #2 → id único',                    yapa2?.id !== yapa1Id, yapa2?.id, 'distinto a yapa1');
    show('Yapa #2', { id: yapa2?.id?.slice(0,8)+'...', value: yapa2?.value });
    const yapa2Id    = yapa2?.id;
    const yapa2Value = yapa2?.value;

    // ── Yapas #3, #4, #5 en Tier3 (500 pts cada vez)
    const yapaIds = [yapa1Id, yapa2Id];
    for (let n = 3; n <= 5; n++) {
      const statsN  = await getMerchantStats(aMToken);
      const avgTN   = Number(statsN.averageTicket);
      const amtN    = amountFor(501, avgTN);
      show(`Monto yScan #${n+1} (Yapa #${n} Tier3)`, `$${amtN}`);

      const ySN = await scan(YT, aMId, amtN);
      check(`yScan #${n+1} → 200`, ySN.status === 200, ySN.status, 200); showErr(`yScan${n+1}`, ySN);
      const yapaN = ySN.body?.data?.couponUnlocked;
      check(`Yapa #${n} desbloqueada`,              !!yapaN, !!yapaN, true);
      check(`Yapa #${n} → tier se mantiene en 3`,   ySN.body?.data?.tierLevel === 3, ySN.body?.data?.tierLevel, 3);
      check(`Yapa #${n} → trustPoints = 0 (reset)`, ySN.body?.data?.totalTrustPoints === 0, ySN.body?.data?.totalTrustPoints, 0);
      check(`Yapa #${n} → activeYapasCount = ${n}`, ySN.body?.data?.activeYapasCount === n, ySN.body?.data?.activeYapasCount, n);
      check(`Yapa #${n} → id único`, !yapaIds.includes(yapaN?.id), yapaN?.id, 'único');
      check(`Yapa #${n} → value en rango Tier3 [$1.50-$5]`, (yapaN?.value??0)>=1.50&&(yapaN?.value??0)<=5, yapaN?.value, '[1.50-5.00]');
      yapaIds.push(yapaN?.id);
      show(`Yapa #${n}`, { id: yapaN?.id?.slice(0,8)+'...', value: yapaN?.value, tierEarnedAt: yapaN?.tierEarnedAt });
    }

    // Perfil con 5 yapas
    const prof5 = await getProfile(YT);
    const ent5  = prof5.find(e => e.merchantId === aMId);
    check('5 yapas: yapasCount = 5',             ent5?.yapasCount === 5, ent5?.yapasCount, 5);
    check('5 yapas: activeYapas.length = 5',     ent5?.activeYapas?.length === 5, ent5?.activeYapas?.length, 5);
    check('5 yapas: totalYapasValue > 0',        (ent5?.totalYapasValue ?? 0) > 0, ent5?.totalYapasValue, '>0');
    check('5 yapas: cada yapa tiene id',         ent5?.activeYapas?.every(y => !!y.id), null, 'allHaveId');
    check('5 yapas: cada yapa tiene tierEarnedAt', ent5?.activeYapas?.every(y => !!y.tierEarnedAt), null, 'allHaveTier');
    show('totalYapasValue acumulado', ent5?.totalYapasValue);

    // ── Límite: scan extra NO genera Yapa #6
    const statsLim = await getMerchantStats(aMToken);
    const amtLim   = amountFor(501, Number(statsLim.averageTicket));
    const sLim = await scan(YT, aMId, amtLim);
    check('Con 5 yapas: scan → 200 (no se bloquea)',       sLim.status === 200, sLim.status, 200);
    check('Con 5 yapas: couponUnlocked = null (límite)',   sLim.body?.data?.couponUnlocked === null, sLim.body?.data?.couponUnlocked, null);
    check('Con 5 yapas: activeYapasCount sigue en 5',      sLim.body?.data?.activeYapasCount === 5, sLim.body?.data?.activeYapasCount, 5);
    check('Con 5 yapas: trustPoints NO se reset (sin yapa)', (sLim.body?.data?.totalTrustPoints ?? 0) > 0, sLim.body?.data?.totalTrustPoints, '>0');
    show('Pts acumulados con 5 yapas activas', sLim.body?.data?.totalTrustPoints);

    // ─────────────────────────────────────────────────────────────────────
    header('FASE 7 — Redención Voluntaria de Yapas');
    // ─────────────────────────────────────────────────────────────────────

    const profRedeem  = await getProfile(YT);
    const entRedeem   = profRedeem.find(e => e.merchantId === aMId);
    const activeYapas = entRedeem?.activeYapas ?? [];
    check('Pre-redención: 5 yapas con id', activeYapas.length === 5, activeYapas.length, 5);

    const bestYapa = activeYapas.reduce((b, y) => (y.value > b.value ? y : b), activeYapas[0]);
    show('Yapa elegida para redimir', { id: bestYapa?.id?.slice(0,8)+'...', value: bestYapa?.value, tierEarnedAt: bestYapa?.tierEarnedAt });

    // ── Cross-user: userB intenta usar yapa de YT en el mismo merchant
    const crossUser = await scan(userB.token, aMId, 15.00, bestYapa.id);
    check('Cross-user: yapa ajena → 400', crossUser.status === 400, crossUser.status, 400);
    show('Msg cross-user', crossUser.body?.message);

    // ── Cross-merchant: YT usa la yapa en un merchant diferente
    const otherM = await createFreshMerchant(catId);
    if (otherM?.merchantId) {
      const crossMerch = await scan(YT, otherM.merchantId, 15.00, bestYapa.id);
      check('Cross-merchant: yapa de otro local → 400', crossMerch.status === 400, crossMerch.status, 400);
      show('Msg cross-merchant', crossMerch.body?.message);
    } else {
      skip('Cross-merchant test', 'No se pudo crear merchant temporal');
    }

    // ── Redención exitosa
    const redeemScan = await scan(YT, aMId, 20.00, bestYapa.id);
    check('Redención con couponId válido → 200', redeemScan.status === 200, redeemScan.status, 200); showErr('redeem', redeemScan);
    const applied = redeemScan.body?.data?.couponApplied;
    check('couponApplied no es null',              !!applied, !!applied, true);
    check('applied.id = yapa elegida',             applied?.id === bestYapa.id, applied?.id, bestYapa.id);
    check('applied.discountAmount = value yapa',   applied?.discountAmount === bestYapa.value, applied?.discountAmount, bestYapa.value);
    check('activeYapasCount = 4 tras redención',   redeemScan.body?.data?.activeYapasCount === 4, redeemScan.body?.data?.activeYapasCount, 4);
    check('couponUnlocked = null (no umbral)',      redeemScan.body?.data?.couponUnlocked === null, redeemScan.body?.data?.couponUnlocked, null);
    check('Tier NO cambia al redimir (sigue en 3)', redeemScan.body?.data?.tierLevel === 3, redeemScan.body?.data?.tierLevel, 3);
    show('Descuento aplicado', applied?.discountAmount);

    // Perfil post-redención: 4 yapas
    const profPost = await getProfile(YT);
    const entPost  = profPost.find(e => e.merchantId === aMId);
    check('Post-redención: yapasCount = 4', entPost?.yapasCount === 4, entPost?.yapasCount, 4);
    check('Post-redención: yapa redimida NO está en activeYapas', !(entPost?.activeYapas ?? []).some(y => y.id === bestYapa.id), null, 'ausente');

    // ── Doble redención: misma yapa → 400
    const doubleRedeem = await scan(YT, aMId, 15.00, bestYapa.id);
    check('Doble redención → 400', doubleRedeem.status === 400, doubleRedeem.status, 400);
    show('Msg doble redención', doubleRedeem.body?.message);

    // ── Regenerar: con 4 yapas y pts > 500 → puede generar 5ta de nuevo
    // (User tiene ~501 pts del limit scan, cualquier compra adicional → threshold >= 500)
    const regenScan = await scan(YT, aMId, 1.00);
    check('Regen: puede generar Yapa nueva (4→5)',  !!regenScan.body?.data?.couponUnlocked, !!regenScan.body?.data?.couponUnlocked, true); showErr('regen', regenScan);
    check('Regen: activeYapasCount vuelve a 5',     regenScan.body?.data?.activeYapasCount === 5, regenScan.body?.data?.activeYapasCount, 5);
    show('Nueva yapa generada', regenScan.body?.data?.couponUnlocked?.value);
  }

  // ══════════════════════════════════════════════════════════════════════
  // FASE 8 — Seguridad de Tokens
  // ══════════════════════════════════════════════════════════════════════
  header('FASE 8 — Seguridad de Tokens');

  const secScan = await api('POST', '/loyalty/scan', { merchantId: fMId, amount: 10 }, seedToken);
  check('Token merchant en /loyalty/scan → 401 (guard rechaza rol)', secScan.status === 401, secScan.status, 401);

  const secStats = await api('GET', '/merchants/me/stats', null, userA.token);
  check('Token usuario en /merchants/me/stats → 401', secStats.status === 401, secStats.status, 401);

  const secNoToken = await api('GET', '/loyalty/profile', null, null);
  check('Sin token en /loyalty/profile → 401', secNoToken.status === 401, secNoToken.status, 401);

  const secBadToken = await api('GET', '/merchants/me/stats', null, 'tokenfalso.abc.xyz');
  check('Token inválido → 401', secBadToken.status === 401, secBadToken.status, 401);

  const secMerchProf = await api('GET', '/loyalty/profile', null, seedToken);
  check('Token merchant en /loyalty/profile → 401', secMerchProf.status === 401, secMerchProf.status, 401);

  // ══════════════════════════════════════════════════════════════════════
  // FASE 9 — Validaciones de DTO
  // ══════════════════════════════════════════════════════════════════════
  header('FASE 9 — Validaciones de DTO');

  const badPhone = await api('POST', '/auth/register', { phone: '0991234567', fullName: 'X', password: 'pass1234' });
  check('Teléfono sin E.164 → 400', badPhone.status === 400, badPhone.status, 400);

  const badMerchId = await api('POST', '/loyalty/scan', { merchantId: 'no-uuid', amount: 10 }, userA.token);
  check('merchantId no-UUID → 400', badMerchId.status === 400, badMerchId.status, 400);

  const badAmt = await api('POST', '/loyalty/scan', { merchantId: fMId, amount: -5 }, userA.token);
  check('amount negativo → 400', badAmt.status === 400, badAmt.status, 400);

  const missingAmt = await api('POST', '/loyalty/scan', { merchantId: fMId }, userA.token);
  check('amount faltante → 400', missingAmt.status === 400, missingAmt.status, 400);

  const notFoundM = await api('POST', '/loyalty/scan', { merchantId: '00000000-0000-0000-0000-000000000000', amount: 10 }, userA.token);
  check('merchantId inexistente → 404', notFoundM.status === 404, notFoundM.status, 404);

  const badCpFmt = await api('POST', '/loyalty/scan', { merchantId: fMId, amount: 10, couponId: 'bad' }, userA.token);
  check('couponId formato inválido → 400', badCpFmt.status === 400, badCpFmt.status, 400);

  // ══════════════════════════════════════════════════════════════════════
  // RESUMEN
  // ══════════════════════════════════════════════════════════════════════
  const total = passed + failed + skipped;
  console.log(`\n${C.bold}═══════════════════════════════════════════════${C.reset}`);
  console.log(`${C.bold}  RESUMEN FINAL${C.reset}`);
  console.log(`${C.bold}═══════════════════════════════════════════════${C.reset}`);
  console.log(`  Total checks  : ${C.bold}${total}${C.reset}`);
  console.log(`  ${C.green}Pasaron       : ${passed}${C.reset}`);
  console.log(`  ${failed > 0 ? C.red : C.green}Fallaron      : ${failed}${C.reset}`);
  if (skipped > 0) console.log(`  ${C.yellow}Skipped       : ${skipped}  (pon ANTIFRAUD_VELOCITY_WINDOW_SECONDS=0)${C.reset}`);
  console.log(`  Resultado     : ${failed === 0 ? `${C.green}${C.bold}TODO OK ✓${C.reset}` : `${C.red}${C.bold}HAY FALLOS ✗${C.reset}`}`);
  console.log();
  if (failed > 0) process.exit(1);
}

run().catch(e => {
  console.error(`\n${C.red}Error fatal:${C.reset}`, e.message);
  console.error(e.stack);
  process.exit(1);
});
