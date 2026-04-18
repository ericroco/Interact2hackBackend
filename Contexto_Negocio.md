# Arquitectura y Reglas de Negocio: Backend Reto Deuna

## 1. Problema de Negocio (Hackathon Deuna)
El objetivo central es prevenir el abandono (churn) de los microcomerciantes en la plataforma Deuna. El sistema de fidelización que construiremos es una herramienta estratégica de retención: busca incentivar a los usuarios a volver a comprar en los mismos locales, demostrándole al comerciante que Deuna le genera ventas recurrentes. Todo el código, nombres de dominio y variables deben reflejar este enfoque en la retención y el crecimiento del ecosistema.

## 2. Stack Tecnológico y Directrices
* Framework: NestJS (TypeScript) o FastAPI (Python).
* Arquitectura: Hexagonal (Puertos y Adaptadores) + Domain-Driven Design (DDD).
* Persistencia: PostgreSQL (Transaccional) y Redis (In-Memory / Antifraude).
* Orquestación Local: Docker y Docker Compose.
* Infraestructura como Código (IaC): Terraform (Target: AWS).
* **Regla Estricta 1:** NO usar prefijo global de API. Las rutas deben ser directas (ej. `/auth/login`, `/loyalty/scan`).
* **Regla Estricta 2:** CERO comentarios residuales de IA. Usar únicamente comentarios técnicos de arquitectura y lógica.

## 3. Lógica de Negocio (Core Loyalty & Transactions)
1. **Motor de Esfuerzo Relativo:** Puntos de Confianza ganados = `(Monto / Ticket Promedio Histórico del Local) * 10`.
2. **Tiers & Financiamiento:** Nivel 1 (1%), Nivel 2 (2.5%), Nivel 3 (5%). El 100% del costo del cashback es asumido por la plataforma (Deuna). El saldo va a una "Billetera de Yapas" bloqueada para uso exclusivo en el local donde se generó.
3. **Adquisición:** Comercios emiten cupones financiados al 100% por ellos. Regla dura: `Ticket Mínimo = Valor Cupón * 4`.
4. **Degradación:** Inactividad de `Max(30 días, Frecuencia Promedio Local * 2)` = Downgrade de 1 Nivel.
5. **Antifraude (Redis):** 'Velocity Limit'. Máximo 1 transacción que otorgue puntos por local cada 4 horas.

## 4. Instrucciones Fase 1: Setup, Modelado e Infraestructura Base
(IMPORTANTE: NO generar controladores ni lógica de aplicación aún)
1. **IaC & Docker:** Generar `docker-compose.yml` para desarrollo local (App, Postgres, Redis). Definir estructura para Terraform (`/terraform/environments/dev`) y el `main.tf` base para AWS.
2. **Estructura de Carpetas:** Crear el árbol de directorios implementando Arquitectura Hexagonal y separando los dominios.
3. **Modelado de Base de Datos:** Definir entidades de dominio centrales (Users, Merchants, Transactions, LoyaltyTiers, PlatformSubsidiesLedger).
4. **Contrato de API Base:** Definir la interfaz de respuesta genérica (Standard JSON Wrapper) para el cliente Flutter.
