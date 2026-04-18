# Plan de Pruebas por Escenarios — Datos Reales
## Base URL: `http://localhost:3000`

> Este plan usa los **100 usuarios y 50 merchants reales** del dataset.  
> Contraseña para todos: **`deuna123`**  
> Formato E.164: `+593` + número sin el `0` inicial. Ej: `09113148622` → `+5939113148622`

---

## SETUP: Variables en Postman

```
base_url       = http://localhost:3000
user_token     = (se llena por script)
merchant_token = (se llena por script)
merchant_id    = (se llena por script)
```

---

## PASO 0 — Cómo activar la fidelización de un merchant

> **CRÍTICO**: Sin esto, todos los `POST /loyalty/scan` devolverán **422**.

Los merchants del dataset ya tienen `loyaltyEnabled: true` (activado en el seed).  
Para un merchant **nuevo** o al hacer pruebas con tu propio merchant:

### 0.1 Login del merchant
```
POST {{base_url}}/merchants/auth/login
Content-Type: application/json
```
```json
{ "ownerEmail": "m001@deuna-demo.ec", "password": "deuna123" }
```
**Script Tests:**
```javascript
const json = pm.response.json();
pm.collectionVariables.set("merchant_token", json.data.accessToken);
```

### 0.2 Activar fidelización
```
PATCH {{base_url}}/merchants/me/loyalty
Authorization: Bearer {{merchant_token}}
Content-Type: application/json
```
```json
{ "enabled": true }
```
**Respuesta esperada (200):**
```json
{ "success": true, "data": { "loyaltyEnabled": true } }
```

### 0.3 Desactivar fidelización (prueba de bloqueo)
```json
{ "enabled": false }
```
Luego intenta un scan → **422 Loyalty program not enabled for this merchant** ✓

### 0.4 Obtener `merchant_id` desde la DB
```sql
SELECT id, business_name, loyalty_enabled, average_ticket
FROM merchants
WHERE owner_email = 'm001@deuna-demo.ec';
```
Guarda ese UUID en la variable `merchant_id`.

---

## ESCENARIO 1 — Confianza Baja (Tier 1)

**Usuario**: Carlos Quishpe — poca actividad, 75 puntos acumulados  
**Merchant de prueba**: Ceviches de la Ruleta (avgTicket: $8.98)

### 1.1 Login usuario Tier 1
```
POST {{base_url}}/auth/login
Content-Type: application/json
```
```json
{ "phone": "+5939228431069", "password": "deuna123" }
```
**Script Tests:**
```javascript
pm.collectionVariables.set("user_token", pm.response.json().data.accessToken);
```

### 1.2 Ver perfil — confirmar Tier 1 con 75 puntos
```
GET {{base_url}}/loyalty/profile
Authorization: Bearer {{user_token}}
```
**Qué verificar:**
```json
{
  "loyaltyTiers": [{
    "tierLevel": 1,
    "trustPoints": 75,
    "pointsToNextCoupon": 25
  }]
}
```

### 1.3 Compra pequeña — ganar pocos puntos
```
POST {{base_url}}/loyalty/scan
Authorization: Bearer {{user_token}}
Content-Type: application/json
```
```json
{ "merchantId": "{{merchant_id}}", "amount": 5.00 }
```
**Qué verificar:**
- `trustPointsEarned ≈ 5.57` → `(5.00 / 8.98) * 10`
- `totalTrustPoints ≈ 80.57`
- `tierLevel: 1`
- `couponUnlocked: null` (aún no llega a 100)

### 1.4 Estado final esperado
```
Tier: 1 (LOW) | Puntos: ~80 | Faltan: ~20 para cupón | Sin cupón activo
```

---

## ESCENARIO 2 — Confianza Media (Tier 2)

**Usuario**: María Andrade — cliente frecuente, 215 puntos  
**Merchant**: Abarrotes Familia Morocho (avgTicket: $7.53)  
**María YA TIENE un cupón activo en ese merchant** 🎉

### 2.1 Login usuario Tier 2
```
POST {{base_url}}/auth/login
```
```json
{ "phone": "+5939133462959", "password": "deuna123" }
```

### 2.2 Ver perfil — confirmar Tier 2 CON cupón activo
```
GET {{base_url}}/loyalty/profile
Authorization: Bearer {{user_token}}
```
**Qué verificar:**
```json
{
  "loyaltyTiers": [{
    "tierLevel": 2,
    "trustPoints": 215,
    "activeCoupon": {
      "value": "2.95",
      "status": "active"
    }
  }]
}
```

### 2.3 Compra normal — acumular puntos (sin usar cupón aún)
Obtén el `merchant_id` de Abarrotes Familia Morocho:
```sql
SELECT id FROM merchants WHERE business_name = 'Abarrotes Familia Morocho';
```
```
POST {{base_url}}/loyalty/scan
Authorization: Bearer {{user_token}}
```
```json
{ "merchantId": "<id-abarrotes>", "amount": 10.00 }
```
**Qué verificar:**
- `trustPointsEarned ≈ 13.3` → `(10 / 7.53) * 10`
- `couponApplied`: contiene el cupón de $2.95 (se aplica automáticamente)
- `tierLevel: 3` (sube porque redimió cupón → Tier 2 → Tier 3)
- `totalTrustPoints ≈ 13.3` (reseteo tras redimir)

---

## ESCENARIO 3 — Confianza Alta (Tier 3)

**Usuario**: Jhonatan Masaquiza — cliente estrella, 430 puntos  
**Merchant**: Ceviches de la Ruleta (avgTicket: $8.98)

### 3.1 Login usuario Tier 3
```
POST {{base_url}}/auth/login
```
```json
{ "phone": "+5939832191793", "password": "deuna123" }
```

### 3.2 Ver perfil — confirmar Tier 3
```
GET {{base_url}}/loyalty/profile
Authorization: Bearer {{user_token}}
```
**Qué verificar:**
```json
{
  "loyaltyTiers": [{
    "tierLevel": 3,
    "trustPoints": 430,
    "pointsToNextCoupon": 70
  }]
}
```

### 3.3 Compra grande — ganar muchos puntos
```
POST {{base_url}}/loyalty/scan
```
```json
{ "merchantId": "{{merchant_id}}", "amount": 25.00 }
```
**Qué verificar:**
- `trustPointsEarned ≈ 27.8` → `(25 / 8.98) * 10`
- `totalTrustPoints ≈ 457.8`
- `tierLevel: 3` (ya está en máximo)
- Aún `pointsToNextCoupon ≈ 42`

---

## ESCENARIO 4 — Transición Tier 1 → Tier 2

**Situación**: usuario en Tier 1 con 75 puntos que cruza el umbral de 100 → desbloquea cupón → lo redime → sube a Tier 2.

**Usuario**: Carlos Quishpe (+5939228431069, tier 1, 75 pts)  
**Merchant**: M001 Ceviches de la Ruleta (avgTicket: $8.98)

> ⚠️ Desactiva el antifraud primero en `.env`: `ANTIFRAUD_VELOCITY_WINDOW_SECONDS=0`

### 4.1 Login
```json
{ "phone": "+5939228431069", "password": "deuna123" }
```

### 4.2 Compra que cruza el umbral de 100 puntos
Necesita 25 puntos más. Con avgTicket=$8.98 → amount = 25 × 8.98 / 10 = **$22.45**
```
POST {{base_url}}/loyalty/scan
```
```json
{ "merchantId": "{{merchant_id}}", "amount": 22.50 }
```
**Qué verificar — cupón desbloqueado:**
```json
{
  "trustPointsEarned": 25.06,
  "totalTrustPoints": 100.06,
  "tierLevel": 1,
  "pointsToNextCoupon": 0,
  "couponUnlocked": {
    "value": 1.62,
    "message": "¡Tienes una Yapa de $1.62 en Ceviches de la Ruleta!"
  }
}
```
> El cupón vale `clamp(8.98 × 18%, $0.50, $2.00) = clamp($1.62, $0.50, $2.00) = $1.62`

### 4.3 Siguiente compra — redimir cupón y SUBIR a Tier 2
```json
{ "merchantId": "{{merchant_id}}", "amount": 15.00 }
```
**Qué verificar:**
```json
{
  "couponApplied": { "discountAmount": 1.62 },
  "tierLevel": 2,
  "totalTrustPoints": 16.7,
  "couponUnlocked": null
}
```
✅ **Pasó de Tier 1 → Tier 2**

### 4.4 Verificar en DB
```sql
SELECT tier_level, trust_points FROM loyalty_tiers
WHERE user_id = (SELECT id FROM users WHERE phone = '+5939228431069');
```
Esperado: `tier_level = 2`

---

## ESCENARIO 5 — Transición Tier 2 → Tier 3

**Usuario**: Rosa Chimborazo (+5939518055247, tier 2, 215 pts)  
**Merchant**: M027 Despensa Familiar Pillajo (avgTicket: $13.16)

> ⚠️ `ANTIFRAUD_VELOCITY_WINDOW_SECONDS=0`

### 5.1 Login
```json
{ "phone": "+5939518055247", "password": "deuna123" }
```

### 5.2 Compra para cruzar umbral 250
Necesita 35 puntos más → amount = 35 × 13.16 / 10 = **$46.06**
```json
{ "merchantId": "<id-despensa-pillajo>", "amount": 46.10 }
```
**Qué verificar:**
```json
{
  "totalTrustPoints": 250.35,
  "tierLevel": 2,
  "couponUnlocked": {
    "value": 2.00,
    "message": "¡Tienes una Yapa de $2.00 en Despensa Familiar Pillajo!"
  }
}
```
> Cupón: `clamp(13.16 × 18%, $1.00, $3.50) = clamp($2.37, $1.00, $3.50) = $2.37`

### 5.3 Redimir → subir a Tier 3
```json
{ "merchantId": "<id-despensa-pillajo>", "amount": 20.00 }
```
**Qué verificar:**
```json
{
  "couponApplied": { "discountAmount": 2.37 },
  "tierLevel": 3
}
```
✅ **Pasó de Tier 2 → Tier 3**

---

## ESCENARIO 6 — Transición Tier 3 → Cupón Premium

**Usuario**: Jhonatan Masaquiza (+5939832191793, tier 3, 430 pts)  
**Merchant**: M041 Farmacia Popular Salud (avgTicket: $11.38)

### 6.1 Login y ver perfil
Verificar tier 3 con 430 puntos, faltan 70 para cupón Tier 3.

### 6.2 Compra que cruza umbral 500
Necesita 70 puntos → amount = 70 × 11.38 / 10 = **$79.66**
```json
{ "merchantId": "<id-farmacia-popular>", "amount": 80.00 }
```
**Qué verificar — cupón premium Tier 3:**
```json
{
  "totalTrustPoints": 500.74,
  "tierLevel": 3,
  "couponUnlocked": {
    "value": 2.00,
    "message": "¡Tienes una Yapa de $2.00 en Farmacia Popular Salud!"
  }
}
```
> Cupón Tier 3: `clamp(11.38 × 18%, $1.50, $5.00) = clamp($2.05, $1.50, $5.00) = $2.05`

### 6.3 Redimir cupón premium
```json
{ "merchantId": "<id-farmacia-popular>", "amount": 30.00 }
```
- `couponApplied.discountAmount: 2.05`
- `tierLevel: 3` (ya está en máximo, no sube más)
- `trustPoints` reseteados

---

## ESCENARIO 7 — Cupón Disponible (listo para usar)

**Usuario**: Narcisa Ortega — tiene 3 cupones activos en distintos merchants

### 7.1 Login
```json
{ "phone": "+5939113148622", "password": "deuna123" }
```

### 7.2 Ver perfil — 3 merchants con cupón activo
```
GET {{base_url}}/loyalty/profile
Authorization: Bearer {{user_token}}
```
**Qué verificar:**
```json
{
  "loyaltyTiers": [
    {
      "merchantId": "<M027>",
      "merchantName": "Despensa Familiar Pillajo",
      "tierLevel": 1,
      "activeCoupon": { "value": "2.97", "status": "active" }
    },
    {
      "merchantId": "<M028>",
      "merchantName": "Supermini Don Segundo",
      "tierLevel": 1,
      "activeCoupon": { "value": "1.77", "status": "active" }
    },
    {
      "merchantId": "<M042>",
      "merchantName": "Botica San Francisco",
      "tierLevel": 1,
      "activeCoupon": { "value": "1.78", "status": "active" }
    }
  ]
}
```

### 7.3 Usar el cupón de Despensa Familiar Pillajo
```
POST {{base_url}}/loyalty/scan
Authorization: Bearer {{user_token}}
```
```json
{ "merchantId": "<id-despensa-pillajo>", "amount": 15.00 }
```
**Qué verificar:**
```json
{
  "couponApplied": { "discountAmount": 2.97 },
  "tierLevel": 2,
  "totalTrustPoints": 11.39
}
```
> La Yapa de $2.97 se aplica automáticamente ✓

---

## ESCENARIO 8 — Antifraud (Velocity Limit)

**Situación del dataset**: Luis Morocho y Cristina Catota tienen transacciones marcadas como "Detectado" — dos compras en el mismo merchant con 20-30 min de diferencia.

### 8.1 Login Luis Morocho
```json
{ "phone": "+5939154618999", "password": "deuna123" }
```

### 8.2 Primera compra (limpia)
```
POST {{base_url}}/loyalty/scan
```
```json
{ "merchantId": "<id-empanadas-gloria>", "amount": 3.00 }
```
**Qué verificar:**
```json
{ "trustPointsEarned": 11.45, "antifraudBlocked": false }
```

### 8.3 Segunda compra inmediata (bloqueada)
```json
{ "merchantId": "<id-empanadas-gloria>", "amount": 5.00 }
```
**Qué verificar:**
```json
{
  "trustPointsEarned": 0,
  "antifraudBlocked": true,
  "totalTrustPoints": 75
}
```
> La tx se registra pero sin puntos ✓  
> El usuario tiene 4 horas de "penalización" en ese merchant

### 8.4 Verificar en DB
```sql
SELECT amount, trust_points_earned, status
FROM transactions
WHERE user_id = (SELECT id FROM users WHERE phone = '+5939154618999')
ORDER BY created_at DESC LIMIT 5;
```
Verás dos transacciones: una con puntos > 0 y otra con `trust_points_earned = 0`.

---

## ESCENARIO 9 — Fraud Histórico (del dataset)

Los datos incluyen 20 transacciones fraudulentas reales. Puedes verlas:

```sql
SELECT u.full_name, m.business_name, t.amount, t.trust_points_earned, t.created_at
FROM transactions t
JOIN users u ON u.id = t.user_id
JOIN merchants m ON m.id = t.merchant_id
WHERE t.trust_points_earned = 0
ORDER BY t.created_at DESC
LIMIT 20;
```

**Ejemplo confirmado de fraude en el dataset:**
- Cristina Catota (Tier 1) hizo 2 compras en "Empanadas Doña Gloria" con 25 min de diferencia
- Pedro Guamán (Tier 2) intentó 2 scans en "Papas con Cuero Don Abel" en el mismo intervalo

---

## ESCENARIO 10 — Equidad de Fórmulas entre Tipos de Local

Prueba la misma cantidad ($10) en merchants de distintas categorías para ver que los puntos y cupones son proporcionales, no fijos.

### Merchant Comida (avgTicket: $8.98) — M001
```json
{ "merchantId": "<id-ceviches>", "amount": 10.00 }
```
- `trustPointsEarned = (10/8.98)*10 = 11.14 pts`
- Cupón Tier1 al llegar 100 pts: `clamp(8.98×18%, $0.50, $2.00) = $1.62`

### Merchant Víveres (avgTicket: $14.85) — M022
```json
{ "merchantId": "<id-minimarket>", "amount": 10.00 }
```
- `trustPointsEarned = (10/14.85)*10 = 6.74 pts`
- Cupón Tier1: `clamp(14.85×18%, $0.50, $2.00) = $2.00` (techo)

### Merchant Farmacia (avgTicket: $28.84) — M043
```json
{ "merchantId": "<id-farmacia-cruz>", "amount": 10.00 }
```
- `trustPointsEarned = (10/28.84)*10 = 3.47 pts`
- Cupón Tier1: `clamp(28.84×18%, $0.50, $2.00) = $2.00` (techo)

### Merchant Transporte (avgTicket: $1.11) — M036
```json
{ "merchantId": "<id-trans-milenio>", "amount": 10.00 }
```
- `trustPointsEarned = (10/1.11)*10 = 90.1 pts` ← llega casi al umbral en 1 scan
- Cupón Tier1: `clamp(1.11×18%, $0.50, $2.00) = $0.50` (piso)

> **Conclusión**: Gastar exactamente el ticket promedio del local siempre da **10 puntos**. Los cupones están acotados para que ningún local dé demasiado ni demasiado poco.

---

## ESCENARIO 11 — Degradación por Inactividad

**Situación**: Tomás Tapia lleva tiempo sin comprar (última tx: 2025-04-18, más de 30 días).

```sql
SELECT u.full_name, lt.tier_level, lt.trust_points,
       lt.last_transaction_at, lt.degradation_due_date
FROM loyalty_tiers lt
JOIN users u ON u.id = lt.user_id
WHERE u.phone = '+5939375584674';
```
Si `degradation_due_date < NOW()` → el cron diario (2 AM) habrá bajado su tier.

**Para simular degradación manual en pruebas:**
```sql
UPDATE loyalty_tiers
SET degradation_due_date = NOW() - INTERVAL '1 minute'
WHERE user_id = (SELECT id FROM users WHERE phone = '+5939375584674');
```
Luego espera al cron o reinicia el servidor y verifica que el tier bajó.

---

## ESCENARIO 12 — Usuario con Múltiples Merchants (perfil complejo)

**Usuario**: Jéssica Jaigua — tiene relaciones con 5 merchants distintos

### Login
```json
{ "phone": "+5939126911160", "password": "deuna123" }
```

### Ver perfil completo
```
GET {{base_url}}/loyalty/profile
Authorization: Bearer {{user_token}}
```
**Qué verificar:**
```json
{
  "loyaltyTiers": [
    { "merchantName": "Canguilero del Parque", "tierLevel": 1, "activeCoupon": {...} },
    { "merchantName": "Jugos Naturales Pacheco", "tierLevel": 1, "activeCoupon": {...} },
    { "merchantName": "Tacos y Burritos El Gringo", "tierLevel": 1, "activeCoupon": {...} },
    { "merchantName": "Almuerzos Ejecutivos Silvia", "tierLevel": 1, "activeCoupon": {...} },
    { "merchantName": "Abarrotes Quishpe Hnos.", "tierLevel": 1, "activeCoupon": {...} }
  ]
}
```

---

## ESCENARIO 13 — Merchant sin Loyalty Activado

### Crear merchant nuevo (sin loyalty)
```
POST {{base_url}}/merchants/auth/register
```
```json
{
  "categoryId": "<category-id>",
  "businessName": "Tienda Sin Loyalty",
  "ruc": "9999999999001",
  "ownerEmail": "sinloyalty@test.com",
  "password": "password123"
}
```
> `loyaltyEnabled: false` por defecto

### Intentar scan → 422
```
POST {{base_url}}/loyalty/scan
Authorization: Bearer {{user_token}}
```
```json
{ "merchantId": "<id-tienda-sin-loyalty>", "amount": 10.00 }
```
**Respuesta esperada:**
```json
{
  "statusCode": 422,
  "message": "Loyalty program not enabled for this merchant"
}
```

### Activar y reintentar
```
PATCH {{base_url}}/merchants/me/loyalty
```
```json
{ "enabled": true }
```
Ahora el scan funciona ✓

---

## Queries SQL útiles para verificar estado

```sql
-- Distribución de usuarios por tier
SELECT tier_level, COUNT(*) as usuarios
FROM loyalty_tiers
GROUP BY tier_level ORDER BY tier_level;

-- Cupones activos por merchant
SELECT m.business_name, COUNT(lc.id) as cupones_activos
FROM loyalty_coupons lc
JOIN merchants m ON m.id = lc.merchant_id
WHERE lc.status = 'active'
GROUP BY m.business_name ORDER BY cupones_activos DESC;

-- Top usuarios con más puntos
SELECT u.full_name, lt.tier_level, lt.trust_points, m.business_name
FROM loyalty_tiers lt
JOIN users u ON u.id = lt.user_id
JOIN merchants m ON m.id = lt.merchant_id
ORDER BY lt.trust_points DESC LIMIT 10;

-- Transacciones con fraude detectado (puntos = 0)
SELECT u.full_name, m.business_name, t.amount, t.created_at
FROM transactions t
JOIN users u ON u.id = t.user_id
JOIN merchants m ON m.id = t.merchant_id
WHERE t.trust_points_earned = 0
ORDER BY t.created_at DESC;

-- Merchants con loyalty activo vs inactivo
SELECT loyalty_enabled, COUNT(*) FROM merchants GROUP BY loyalty_enabled;

-- Obtener IDs de merchants por nombre para copiar en Postman
SELECT id, business_name, average_ticket, loyalty_enabled
FROM merchants
WHERE business_name IN (
  'Ceviches de la Ruleta',
  'Despensa Familiar Pillajo',
  'Farmacia Popular Salud',
  'Cooperativa Trans Milenio',
  'Minimarket La Esquina'
);
```

---

## Resumen de usuarios clave

| Teléfono (E.164)    | Nombre            | Tier | Puntos | Cupón activo              |
|---------------------|-------------------|------|--------|---------------------------|
| +5939228431069      | Carlos Quishpe    | 1    | 75     | No                        |
| +5939113148622      | Narcisa Ortega    | 1    | 75     | Sí — M027, M028, M042     |
| +5939126911160      | Jéssica Jaigua    | 1    | 75     | Sí — M009, M010, M011...  |
| +5939133462959      | María Andrade     | 2    | 215    | Sí — M024, M043, M044     |
| +5939518055247      | Rosa Chimborazo   | 2    | 215    | No                        |
| +5939562779578      | Pedro Guamán      | 2    | 215    | No (tuvo fraude)          |
| +5939832191793      | Jhonatan Masaquiza| 3    | 430    | No                        |
| +5939532734158      | Ana Pilataxi      | 3    | 430    | No                        |
| +5939921615303      | Gustavo Guamán    | 3    | 430    | No                        |
| +5939154618999      | Luis Morocho      | 1    | 75     | No (tuvo fraude)          |

## Resumen de merchants clave

| Email demo                    | Nombre                      | Categoría   | AvgTicket | Loyalty |
|-------------------------------|-----------------------------|-------------|-----------|---------|
| m001@deuna-demo.ec            | Ceviches de la Ruleta       | Comida      | $8.98     | ✓       |
| m022@deuna-demo.ec            | Minimarket La Esquina       | Víveres     | $14.85    | ✓       |
| m027@deuna-demo.ec            | Despensa Familiar Pillajo   | Víveres     | $13.16    | ✓       |
| m036@deuna-demo.ec            | Cooperativa Trans Milenio   | Transporte  | $1.11     | ✓       |
| m041@deuna-demo.ec            | Farmacia Popular Salud      | Farmacia    | $11.38    | ✓       |
| m043@deuna-demo.ec            | Farmacia Cruz Azul Loja     | Farmacia    | $28.84    | ✓       |
| m048@deuna-demo.ec            | Distribuidora Médica Andina | Farmacia    | $38.86    | ✓       |

---

## Tabla de escenarios cubiertos

| # | Escenario                     | Usuario clave       | Resultado esperado                  |
|---|-------------------------------|---------------------|-------------------------------------|
| 1 | Confianza baja                | Carlos Quishpe      | Tier 1, sin cupón, pocos puntos     |
| 2 | Confianza media con cupón     | María Andrade       | Tier 2, cupón activo visible        |
| 3 | Confianza alta                | Jhonatan Masaquiza  | Tier 3, 430 pts                     |
| 4 | Tier 1 → Tier 2               | Carlos Quishpe      | Cruza 100pts → cupón → redime → T2  |
| 5 | Tier 2 → Tier 3               | Rosa Chimborazo     | Cruza 250pts → cupón → redime → T3  |
| 6 | Cupón premium Tier 3          | Jhonatan Masaquiza  | Cruza 500pts → cupón $2.05          |
| 7 | Cupón disponible (ya existe)  | Narcisa Ortega      | 3 cupones activos, redime uno       |
| 8 | Antifraud velocity limit      | Luis Morocho        | 2do scan → trustPointsEarned=0      |
| 9 | Fraude histórico dataset      | Cristina Catota     | Transacciones con 0 puntos en DB    |
| 10| Equidad entre categorías      | Cualquiera          | Misma lógica relativa todos locales |
| 11| Degradación por inactividad   | Tomás Tapia         | Tier baja si pasa 30+ días          |
| 12| Perfil multi-merchant         | Jéssica Jaigua      | 5 tiers en distintos merchants      |
| 13| Loyalty desactivado           | Merchant nuevo      | 422 al intentar scan                |
