# Plan de Pruebas — Postman
## Base URL: `http://localhost:3000`

---

## Configuración inicial en Postman

1. Crea una **Collection** llamada `Deuna Loyalty`.
2. Ve a **Collection > Variables** y agrega:

| Variable         | Initial Value           | Descripción                      |
|------------------|-------------------------|----------------------------------|
| `base_url`       | `http://localhost:3000` | URL base                         |
| `user_token`     | *(vacío)*               | Se llena automáticamente         |
| `merchant_token` | *(vacío)*               | Se llena automáticamente         |
| `merchant_id`    | *(vacío)*               | Se llena automáticamente         |
| `category_id`    | *(vacío)*               | Se llena al listar categorías    |

---

## FASE 0 — Verificar sistema

### 0.1 Health Check
```
GET {{base_url}}/health
```
```json
{ "status": "ok", "services": { "database": "ok", "redis": "ok" } }
```

---

## FASE 1 — Datos demo (cargados automáticamente al bootear)

Al arrancar el servidor se insertan automáticamente:
- **50 merchants** de los datasets (Comida, Víveres, Farmacia, Transporte) con `loyaltyEnabled: true`
- **100 usuarios** con tiers 1, 2 y 3 y puntos reales
- **Cupones activos** para pares usuario-merchant con `estado_yapa: Disponible`

Contraseña de todos los usuarios y merchants demo: **`deuna123`**

### Consultar datos demo en PostgreSQL:
```sql
-- Ver merchants demo con loyalty activo
SELECT business_name, average_ticket, loyalty_enabled FROM merchants ORDER BY created_at LIMIT 20;

-- Ver usuarios por tier
SELECT u.full_name, lt.tier_level, lt.trust_points, lc.value as coupon_value
FROM users u
JOIN loyalty_tiers lt ON lt.user_id = u.id
LEFT JOIN loyalty_coupons lc ON lc.user_id = u.id AND lc.merchant_id = lt.merchant_id AND lc.status = 'active'
ORDER BY lt.tier_level DESC, lt.trust_points DESC
LIMIT 20;
```

### Login de un usuario demo:
```
POST {{base_url}}/auth/login
```
```json
{ "phone": "+5939228431069", "password": "deuna123" }
```
> Formato: `+593` + número sin el 0 inicial. Ej: `09228431069` → `+5939228431069`

### Login de un merchant demo:
```
POST {{base_url}}/merchants/auth/login
```
```json
{ "ownerEmail": "m001@deuna-demo.ec", "password": "deuna123" }
```
> Formato email: `m` + número en minúscula + `@deuna-demo.ec`. Ej: `m001@deuna-demo.ec`

---

## FASE 2 — Merchant (App: Deuna Negocios)

### 2.1 Registrar Merchant nuevo
```
POST {{base_url}}/merchants/auth/register
Content-Type: application/json
```
```json
{
  "categoryId": "{{category_id}}",
  "businessName": "Café El Rincón",
  "ruc": "1234567890001",
  "ownerEmail": "elrincon@test.com",
  "password": "password123"
}
```
> El merchant arranca con **`loyaltyEnabled: false`** y **$5.00** en saldo de cupones.

**Script Tests:**
```javascript
const json = pm.response.json();
pm.collectionVariables.set("merchant_token", json.data.accessToken);
pm.collectionVariables.set("merchant_id", json.data.merchantId);
```

---

### 2.2 Activar el programa de lealtad ⚠️ OBLIGATORIO ANTES DE ESCANEAR

Por defecto el loyalty está **desactivado**. El merchant debe activarlo explícitamente:

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

> Sin este paso, `/loyalty/scan` responderá **422** con `Loyalty program not enabled for this merchant`.

Para **desactivar** el programa:
```json
{ "enabled": false }
```

---

### 2.3 Login Merchant
```
POST {{base_url}}/merchants/auth/login
Content-Type: application/json
```
```json
{ "ownerEmail": "elrincon@test.com", "password": "password123" }
```
**Script Tests:**
```javascript
const json = pm.response.json();
pm.collectionVariables.set("merchant_token", json.data.accessToken);
```

---

### 2.4 Ver estadísticas del merchant
```
GET {{base_url}}/merchants/me/stats
Authorization: Bearer {{merchant_token}}
```
```json
{
  "success": true,
  "data": {
    "merchantId": "...",
    "businessName": "Café El Rincón",
    "couponFundingBalance": "5.00",
    "averageTicket": "0.00",
    "loyaltyEnabled": false
  }
}
```

---

### 2.5 Crear cupones de adquisición con el crédito inicial ($5)

El merchant decide libremente:
- `value`: valor del descuento
- `minimumPurchase`: compra mínima para usar el cupón (≥ value)
- `code`: código alfanumérico (4–20 chars)

```
POST {{base_url}}/merchants/me/coupons
Authorization: Bearer {{merchant_token}}
Content-Type: application/json
```
**Ejemplo A — un cupón de $5:**
```json
{
  "value": 5.00,
  "minimumPurchase": 15.00,
  "code": "BIENVENIDO5",
  "expiresAt": "2026-12-31T23:59:59.000Z"
}
```

**Ejemplo B — dos cupones con $5:**
```json
{ "value": 2.00, "minimumPurchase": 8.00, "code": "PROMO2", "expiresAt": "2026-12-31T23:59:59.000Z" }
```
```json
{ "value": 3.00, "minimumPurchase": 10.00, "code": "PROMO3", "expiresAt": "2026-12-31T23:59:59.000Z" }
```

**Error — minimumPurchase < value (400):**
```json
{ "value": 5.00, "minimumPurchase": 3.00, "code": "MAL", "expiresAt": "..." }
```
→ `minimumPurchase must be >= value`

**Error — saldo insuficiente (422):**
→ `Insufficient coupon funding balance`

---

### 2.6 Recargar saldo
```
POST {{base_url}}/merchants/me/fund
Authorization: Bearer {{merchant_token}}
Content-Type: application/json
```
```json
{ "amount": 20.00 }
```

---

### 2.7 Listar cupones del merchant
```
GET {{base_url}}/merchants/me/coupons
Authorization: Bearer {{merchant_token}}
```

---

### 2.8 Listar categorías
```
GET {{base_url}}/merchants/categories
Authorization: Bearer {{merchant_token}}
```

---

## FASE 3 — Usuario (App: Deuna)

### 3.1 Registrar Usuario
```
POST {{base_url}}/auth/register
Content-Type: application/json
```
```json
{
  "phone": "+593987654321",
  "fullName": "María López",
  "password": "password123",
  "email": "maria@test.com"
}
```
> Formato E.164: `+593XXXXXXXXX`. Ecuador: `+593 9XXXXXXXX`

**Script Tests:**
```javascript
const json = pm.response.json();
pm.collectionVariables.set("user_token", json.data.accessToken);
```

---

### 3.2 Login Usuario
```
POST {{base_url}}/auth/login
Content-Type: application/json
```
```json
{ "phone": "+593987654321", "password": "password123" }
```

---

## FASE 4 — Flujo de Lealtad

> El merchant DEBE tener `loyaltyEnabled: true` (ver FASE 2.2).

### 4.1 Primera compra — generar puntos
```
POST {{base_url}}/loyalty/scan
Authorization: Bearer {{user_token}}
Content-Type: application/json
```
```json
{ "merchantId": "{{merchant_id}}", "amount": 15.00 }
```
```json
{
  "data": {
    "trustPointsEarned": 10.0,
    "totalTrustPoints": 10.0,
    "tierLevel": 1,
    "pointsToNextCoupon": 90,
    "couponApplied": null,
    "couponUnlocked": null,
    "antifraudBlocked": false
  }
}
```

> La fórmula `(amount / avgTicket) * 10` es equitativa: gastar el ticket promedio siempre da 10 puntos, sin importar el tipo de local.

---

### 4.2 Loyalty desactivado (422)
Si el merchant NO activó su programa:
```json
{ "statusCode": 422, "message": "Loyalty program not enabled for this merchant" }
```

---

### 4.3 Antifraud — segunda compra inmediata
```json
{ "merchantId": "{{merchant_id}}", "amount": 20.00 }
```
```json
{ "data": { "trustPointsEarned": 0, "antifraudBlocked": true } }
```
> Máximo 1 tx con puntos por (usuario, merchant) cada 4 horas.

---

### 4.4 Ver perfil de lealtad
```
GET {{base_url}}/loyalty/profile
Authorization: Bearer {{user_token}}
```
```json
{
  "data": {
    "loyaltyTiers": [{
      "merchantName": "Café El Rincón",
      "tierLevel": 1,
      "trustPoints": 10.0,
      "pointsToNextCoupon": 90,
      "activeCoupon": null
    }]
  }
}
```

---

### 4.5 Probar con usuario demo (ya tiene puntos y cupones)

Consulta un usuario tier 3 de la DB:
```sql
SELECT u.phone, u.full_name, lt.tier_level, lt.trust_points, lc.value
FROM users u
JOIN loyalty_tiers lt ON lt.user_id = u.id
JOIN loyalty_coupons lc ON lc.user_id = u.id AND lc.status = 'active'
ORDER BY lt.tier_level DESC LIMIT 5;
```

Login con ese usuario (contraseña: `deuna123`), luego haz un scan.

---

### 4.6 Acumular hasta desbloquear cupón Yapa

Desactiva velocity limit para pruebas rápidas en `.env`:
```
ANTIFRAUD_VELOCITY_WINDOW_SECONDS=0
```

Repite scans con amount alto hasta ver `couponUnlocked`:
```json
{ "merchantId": "{{merchant_id}}", "amount": 150.00 }
```
```json
{
  "couponUnlocked": { "value": 1.50, "message": "¡Tienes una Yapa de $1.50 en Café El Rincón!" }
}
```

> **Fórmula del cupón (equitativa):** `clamp(avgTicket × 18%, tierFloor, tierCap)`
> - Tier 1: [$0.50 – $2.00]
> - Tier 2: [$1.00 – $3.50]
> - Tier 3: [$1.50 – $5.00]
> 
> Ejemplo: Food merchant avgTicket=$8 → $8×18%=$1.44 → cupón Tier1: **$1.44**  
> Ejemplo: Farmacia avgTicket=$40 → capped → cupón Tier1: **$2.00** (techo)  
> Ejemplo: Tienda avgTicket=$2 → floored → cupón Tier1: **$0.50** (piso)

---

### 4.7 Aplicar cupón Yapa en siguiente compra
```json
{ "merchantId": "{{merchant_id}}", "amount": 20.00 }
```
```json
{
  "couponApplied": { "discountAmount": 1.44 },
  "tierLevel": 2,
  "totalTrustPoints": 10.0
}
```
- `tierLevel` subió de 1 → 2
- `trustPoints` se reseteó a ~10

---

## FASE 5 — Seguridad

| Test | Endpoint | Resultado esperado |
|------|----------|-------------------|
| Token usuario en endpoint merchant | `GET /merchants/me/stats` con `user_token` | 403 |
| Token merchant en endpoint usuario | `POST /loyalty/scan` con `merchant_token` | 403 |
| Sin token | `GET /loyalty/profile` | 401 |
| Token inválido | cualquier endpoint protegido | 401 |

---

## FASE 6 — Validaciones

| Caso | Body / condición | Esperado |
|------|-----------------|----------|
| Loyalty desactivado | scan a merchant con `loyaltyEnabled: false` | 422 |
| Phone inválido | `phone: "09912345"` | 400 |
| minimumPurchase < value | en POST /me/coupons | 400 |
| Saldo insuficiente cupón | value > balance | 422 |
| merchantId inválido | `"no-es-uuid"` | 400 |
| Merchant inexistente | UUID que no existe | 404 |

---

## Resumen de endpoints

| # | Método | Ruta | Auth | App |
|---|--------|------|------|-----|
| 1 | GET | `/health` | Ninguna | Ambas |
| 2 | POST | `/merchants/auth/register` | Ninguna | Negocios |
| 3 | POST | `/merchants/auth/login` | Ninguna | Negocios |
| 4 | GET | `/merchants/me/stats` | MerchantGuard | Negocios |
| 5 | **PATCH** | **`/merchants/me/loyalty`** | MerchantGuard | Negocios |
| 6 | POST | `/merchants/me/coupons` | MerchantGuard | Negocios |
| 7 | GET | `/merchants/me/coupons` | MerchantGuard | Negocios |
| 8 | POST | `/merchants/me/fund` | MerchantGuard | Negocios |
| 9 | GET | `/merchants/categories` | MerchantGuard | Negocios |
| 10 | POST | `/auth/register` | Ninguna | Deuna |
| 11 | POST | `/auth/login` | Ninguna | Deuna |
| 12 | POST | `/loyalty/scan` | UserGuard | Deuna |
| 13 | GET | `/loyalty/profile` | UserGuard | Deuna |

---

## Tip: Acelerar pruebas

```env
ANTIFRAUD_VELOCITY_WINDOW_SECONDS=0
```
Tier 1 = 100 puntos. Con amount=$150 y avgTicket=$15 → ~100 pts en 1 scan.

---

## Notas de diseño

### Fórmula de puntos (equitativa)
`trustPoints = (monto / ticket_promedio_del_local) * 10`

- Gastar exactamente el promedio = **10 puntos** en cualquier local.
- Gastar el doble = 20 pts. Gastar la mitad = 5 pts.
- El primer scan de un local nuevo: divisor = monto (siempre 10 pts de arranque).

### Fórmula de cupones (equitativa con piso y techo)
`couponValue = clamp(avgTicket × 18%, tierFloor, tierCap)`

| Tier | Piso  | Techo |
|------|-------|-------|
| 1    | $0.50 | $2.00 |
| 2    | $1.00 | $3.50 |
| 3    | $1.50 | $5.00 |

Garantiza cupones útiles para locales de ticket bajo ($1–$3) y evita cupones excesivos para locales de ticket alto.
