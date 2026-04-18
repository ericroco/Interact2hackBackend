# Plan de Pruebas — Postman
## Base URL: `http://localhost:3000`

---

## Configuración inicial en Postman

1. Crea una **Collection** llamada `Deuna Loyalty`.
2. Ve a **Collection > Variables** y agrega:

| Variable         | Initial Value | Descripción                    |
|------------------|---------------|-------------------------------|
| `base_url`       | `http://localhost:3000` | URL base |
| `user_token`     | *(vacío)*     | Se llena automáticamente      |
| `merchant_token` | *(vacío)*     | Se llena automáticamente      |
| `merchant_id`    | *(vacío)*     | Se llena automáticamente      |
| `category_id`    | *(vacío)*     | Se llena al listar categorías |

3. En cada request que devuelva un token, agrega este script en **Tests** (se indica en cada paso):

```javascript
// Script genérico para guardar token de usuario
const json = pm.response.json();
pm.collectionVariables.set("user_token", json.data.accessToken);
```

---

## FASE 0 — Verificar que el sistema está vivo

### 0.1 Health Check
```
GET {{base_url}}/health
```
**Respuesta esperada:**
```json
{
  "status": "ok",
  "timestamp": "2026-04-18T...",
  "services": { "database": "ok", "redis": "ok" }
}
```
> Si `database` o `redis` están en `error`, el servidor no está listo. Revisar Docker.

---

## FASE 1 — Obtener categoryId (auto-seeded al bootear)

El seeder ya insertó las categorías al arrancar. Necesitas el `categoryId` de una categoría para registrar un merchant.

### 1.1 Consultar categorías disponibles
Ejecuta esta query directamente en tu cliente de PostgreSQL (DBeaver, TablePlus, psql, etc.):

```sql
SELECT id, code, name FROM merchant_categories ORDER BY name;
```

Anota el `id` de la categoría que quieras usar. Sugerencia: **FOOD_BEVERAGE** (restaurantes).

Guarda ese UUID en la variable de colección `category_id`.

> Alternativamente, después de registrar y loguearte como merchant, puedes llamar al endpoint de categorías:
> `GET {{base_url}}/merchants/categories` (requiere token de merchant)

---

## FASE 2 — Merchant (App: Deuna Negocios)

### 2.1 Registrar Merchant
```
POST {{base_url}}/merchants/auth/register
Content-Type: application/json
```
**Body:**
```json
{
  "categoryId": "{{category_id}}",
  "businessName": "Café El Rincón",
  "ruc": "1234567890",
  "ownerEmail": "elrincon@test.com",
  "password": "password123"
}
```
**Respuesta esperada (201):**
```json
{
  "success": true,
  "data": {
    "id": "uuid-del-merchant",
    "businessName": "Café El Rincón",
    "ownerEmail": "elrincon@test.com"
  }
}
```

**Script Tests** — guarda el `merchant_id`:
```javascript
const json = pm.response.json();
pm.collectionVariables.set("merchant_id", json.data.id);
```

---

### 2.2 Login Merchant
```
POST {{base_url}}/merchants/auth/login
Content-Type: application/json
```
**Body:**
```json
{
  "ownerEmail": "elrincon@test.com",
  "password": "password123"
}
```
**Respuesta esperada (200):**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGci..."
  }
}
```

**Script Tests** — guarda el token:
```javascript
const json = pm.response.json();
pm.collectionVariables.set("merchant_token", json.data.accessToken);
```

---

### 2.3 Ver estadísticas del merchant (dashboard Deuna Negocios)
```
GET {{base_url}}/merchants/me/stats
Authorization: Bearer {{merchant_token}}
```
**Respuesta esperada (200):**
```json
{
  "success": true,
  "data": {
    "merchantId": "...",
    "businessName": "Café El Rincón",
    "totalTransactions": 0,
    "totalRevenue": "0.00",
    "averageTicket": "0.00",
    "activeUsersCount": 0,
    "loyaltyDistribution": []
  }
}
```

---

### 2.4 Crear cupón de adquisición (financiado por el merchant)
```
POST {{base_url}}/merchants/me/coupons
Authorization: Bearer {{merchant_token}}
Content-Type: application/json
```
**Body:**
```json
{
  "value": 5.00,
  "code": "BIENVENIDO10",
  "expiresAt": "2026-12-31T23:59:59.000Z"
}
```
**Regla de dominio:** `minimumTicket = value * 4` → el sistema calculará `$20` como monto mínimo de compra para usar este cupón.

**Respuesta esperada (201):**
```json
{
  "success": true,
  "data": {
    "id": "uuid-coupon",
    "code": "BIENVENIDO10",
    "value": "5.00",
    "minimumTicket": "20.00"
  }
}
```

---

### 2.5 Listar cupones de adquisición del merchant
```
GET {{base_url}}/merchants/me/coupons
Authorization: Bearer {{merchant_token}}
```

---

### 2.6 Listar categorías (verificación)
```
GET {{base_url}}/merchants/categories
Authorization: Bearer {{merchant_token}}
```
**Respuesta esperada:** lista de 7 categorías seeded.

---

## FASE 3 — Usuario (App: Deuna)

### 3.1 Registrar Usuario
```
POST {{base_url}}/auth/register
Content-Type: application/json
```
**Body:**
```json
{
  "phone": "+593987654321",
  "fullName": "María López",
  "password": "password123",
  "email": "maria@test.com"
}
```
> `phone` debe ser formato E.164 (con código de país). Ecuador: `+593...`

**Respuesta esperada (201):**
```json
{
  "success": true,
  "data": {
    "id": "uuid-usuario",
    "phone": "+593987654321",
    "fullName": "María López"
  }
}
```

---

### 3.2 Login Usuario
```
POST {{base_url}}/auth/login
Content-Type: application/json
```
**Body:**
```json
{
  "phone": "+593987654321",
  "password": "password123"
}
```
**Respuesta esperada (200):**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGci..."
  }
}
```

**Script Tests:**
```javascript
const json = pm.response.json();
pm.collectionVariables.set("user_token", json.data.accessToken);
```

---

## FASE 4 — Flujo de Lealtad (el corazón del sistema)

> Asegúrate de tener `user_token` y `merchant_id` guardados en variables.

### 4.1 Primera compra — generar puntos (sin cupón activo)
```
POST {{base_url}}/loyalty/scan
Authorization: Bearer {{user_token}}
Content-Type: application/json
```
**Body:**
```json
{
  "merchantId": "{{merchant_id}}",
  "amount": 15.00
}
```
**Respuesta esperada (200):**
```json
{
  "success": true,
  "data": {
    "transactionId": "...",
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
> `trustPointsEarned = (amount / avgTicket) * 10`. En la primera compra, `avgTicket` empieza en `0` y el merchant actualiza su average. Los puntos exactos pueden variar según el avg_ticket del merchant.

**Verifica la lógica:**
- `trustPointsEarned` debe ser > 0
- `couponApplied` debe ser `null` (no hay cupón todavía)
- `antifraudBlocked` debe ser `false`

---

### 4.2 Antifraud — segunda compra inmediata (misma sesión)
```
POST {{base_url}}/loyalty/scan
Authorization: Bearer {{user_token}}
Content-Type: application/json
```
**Body (mismo merchant, inmediatamente):**
```json
{
  "merchantId": "{{merchant_id}}",
  "amount": 20.00
}
```
**Respuesta esperada — BLOQUEADA por velocity limit:**
```json
{
  "success": true,
  "data": {
    "trustPointsEarned": 0,
    "antifraudBlocked": true,
    "couponApplied": null,
    "couponUnlocked": null
  }
}
```
> El sistema permite máx. 1 transacción de puntos por usuario-merchant cada 4 horas (ANTIFRAUD_VELOCITY_WINDOW_SECONDS=14400). La transacción se registra pero sin puntos.

---

### 4.3 Ver perfil de lealtad del usuario
```
GET {{base_url}}/loyalty/profile
Authorization: Bearer {{user_token}}
```
**Respuesta esperada (200):**
```json
{
  "success": true,
  "data": {
    "userId": "...",
    "loyaltyTiers": [
      {
        "merchantId": "...",
        "merchantName": "Café El Rincón",
        "tierLevel": 1,
        "trustPoints": 10.0,
        "pointsToNextCoupon": 90,
        "activeCoupon": null,
        "degradationDueDate": "2026-..."
      }
    ]
  }
}
```

---

### 4.4 Simular acumulación hasta el umbral (Tier 1 = 100 puntos)

Para llegar al umbral rápido necesitas esperar las 4 horas del velocity limit, o temporalmente cambiar `ANTIFRAUD_VELOCITY_WINDOW_SECONDS=0` en `.env` y reiniciar el servidor.

**Con velocity limit desactivado**, repite el `POST /loyalty/scan` con montos altos hasta ver `couponUnlocked` en la respuesta:

```json
{
  "merchantId": "{{merchant_id}}",
  "amount": 150.00
}
```

**Respuesta cuando se desbloquea el cupón Yapa:**
```json
{
  "success": true,
  "data": {
    "trustPointsEarned": 15.0,
    "totalTrustPoints": 105.3,
    "tierLevel": 1,
    "couponApplied": null,
    "couponUnlocked": {
      "value": 4.80,
      "message": "¡Tienes una Yapa de $4.80 en Café El Rincón!"
    }
  }
}
```
> Esto significa que se generó un `loyalty_coupon` con `status: active`. Se aplicará automáticamente en la siguiente compra.

---

### 4.5 Aplicar cupón Yapa en la siguiente compra

Haz otra compra después de desbloquear el cupón:
```
POST {{base_url}}/loyalty/scan
Authorization: Bearer {{user_token}}
Content-Type: application/json
```
```json
{
  "merchantId": "{{merchant_id}}",
  "amount": 20.00
}
```
**Respuesta cuando el cupón se aplica automáticamente:**
```json
{
  "success": true,
  "data": {
    "transactionId": "...",
    "trustPointsEarned": 10.0,
    "totalTrustPoints": 10.0,
    "tierLevel": 2,
    "couponApplied": {
      "id": "uuid-coupon",
      "discountAmount": 4.80
    },
    "couponUnlocked": null,
    "antifraudBlocked": false
  }
}
```
**Verifica:**
- `couponApplied` tiene el descuento aplicado
- `totalTrustPoints` volvió a `~10` (puntos reseteados tras redimir)
- `tierLevel` subió de 1 → 2 (upgrade automático al redimir)

---

## FASE 5 — Pruebas de seguridad (Guard)

### 5.1 Intentar usar token de usuario en endpoint de merchant
```
GET {{base_url}}/merchants/me/stats
Authorization: Bearer {{user_token}}
```
**Respuesta esperada (403):**
```json
{
  "statusCode": 403,
  "message": "Forbidden resource"
}
```

### 5.2 Intentar usar token de merchant en endpoint de usuario
```
POST {{base_url}}/loyalty/scan
Authorization: Bearer {{merchant_token}}
Content-Type: application/json
```
**Respuesta esperada (403):**
```json
{
  "statusCode": 403,
  "message": "Forbidden resource"
}
```

### 5.3 Request sin token
```
GET {{base_url}}/loyalty/profile
(sin header Authorization)
```
**Respuesta esperada (401):**
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

### 5.4 Token inválido / expirado
```
GET {{base_url}}/merchants/me/stats
Authorization: Bearer tokenfalso123
```
**Respuesta esperada (401)**

---

## FASE 6 — Validaciones de DTO

### 6.1 Registrar usuario con teléfono inválido
```
POST {{base_url}}/auth/register
```
```json
{
  "phone": "09912345",
  "fullName": "Test",
  "password": "password123"
}
```
**Respuesta esperada (400):**
```json
{
  "statusCode": 400,
  "message": ["phone must be a valid E.164 number"]
}
```

### 6.2 Crear cupón de adquisición con valor inválido
```
POST {{base_url}}/merchants/me/coupons
Authorization: Bearer {{merchant_token}}
```
```json
{
  "value": -5,
  "code": "X",
  "expiresAt": "no-es-fecha"
}
```
**Respuesta esperada (400)** con lista de errores de validación.

### 6.3 Scan con merchantId inválido
```
POST {{base_url}}/loyalty/scan
Authorization: Bearer {{user_token}}
```
```json
{
  "merchantId": "no-es-uuid",
  "amount": 10.00
}
```
**Respuesta esperada (400)**

### 6.4 Scan con merchant que no existe
```
POST {{base_url}}/loyalty/scan
Authorization: Bearer {{user_token}}
```
```json
{
  "merchantId": "00000000-0000-0000-0000-000000000000",
  "amount": 10.00
}
```
**Respuesta esperada (404):**
```json
{
  "statusCode": 404,
  "message": "Merchant not found"
}
```

---

## Resumen de endpoints

| # | Método | Ruta | Auth | App |
|---|--------|------|------|-----|
| 1 | GET | `/health` | Ninguna | Ambas |
| 2 | POST | `/merchants/auth/register` | Ninguna | Negocios |
| 3 | POST | `/merchants/auth/login` | Ninguna | Negocios |
| 4 | GET | `/merchants/me/stats` | MerchantGuard | Negocios |
| 5 | POST | `/merchants/me/coupons` | MerchantGuard | Negocios |
| 6 | GET | `/merchants/me/coupons` | MerchantGuard | Negocios |
| 7 | GET | `/merchants/categories` | MerchantGuard | Negocios |
| 8 | POST | `/auth/register` | Ninguna | Deuna |
| 9 | POST | `/auth/login` | Ninguna | Deuna |
| 10 | POST | `/loyalty/scan` | UserGuard | Deuna |
| 11 | GET | `/loyalty/profile` | UserGuard | Deuna |

---

## Tip: Acelerar pruebas del flujo de lealtad

Para no esperar las 4h del antifraud, cambia temporalmente en `.env`:
```
ANTIFRAUD_VELOCITY_WINDOW_SECONDS=0
```
Reinicia el servidor. Así puedes hacer múltiples scans seguidos.

Para el Tier 1, necesitas llegar a **100 puntos**. Cada scan aporta aprox. `(amount / avgTicket) * 10` puntos. Con un amount de `$150` y avgTicket de `$15`, ganas `~100 puntos` en una sola transacción.
