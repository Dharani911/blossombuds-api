# Blossom & Buds Floral Artistry — Technical Documentation

**Last Updated**: August 2026  
**Version**: 1.1  
**Audience**: Developers, DevOps engineers, technical leads

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Project Structure](#2-project-structure)
3. [Technology Stack](#3-technology-stack)
4. [Local Development Setup](#4-local-development-setup)
5. [Environment Configuration](#5-environment-configuration)
6. [Database Schema](#6-database-schema)
7. [Authentication & Security](#7-authentication--security)
8. [API Reference](#8-api-reference)
   - 8.1 [Admin Auth](#81-admin-auth)
   - 8.2 [Customer Auth](#82-customer-auth)
   - 8.3 [Catalog — Categories](#83-catalog--categories)
   - 8.4 [Catalog — Products](#84-catalog--products)
   - 8.5 [Catalog — Product Images](#85-catalog--product-images)
   - 8.6 [Catalog — Options & Values](#86-catalog--options--values)
   - 8.7 [Catalog — Global Discounts](#87-catalog--global-discounts)
   - 8.8 [Catalog — Back-in-Stock & Cart Suggestions](#88-catalog--back-in-stock--cart-suggestions)
   - 8.9 [Checkout](#89-checkout)
   - 8.10 [Orders](#810-orders)
   - 8.11 [Reviews](#811-reviews)
   - 8.12 [Customers & Addresses](#812-customers--addresses)
   - 8.13 [Promotions (Coupons)](#813-promotions-coupons)
   - 8.14 [Shipping](#814-shipping)
   - 8.15 [Delivery Partners](#815-delivery-partners)
   - 8.16 [Settings](#816-settings)
   - 8.17 [Search](#817-search)
   - 8.18 [CMS Pages](#818-cms-pages)
   - 8.19 [Admin Metrics](#819-admin-metrics)
   - 8.20 [Razorpay Payments](#820-razorpay-payments)
   - 8.21 [WhatsApp Admin & Webhooks](#821-whatsapp-admin--webhooks)
   - 8.22 [Email Marketing (Admin)](#822-email-marketing-admin)
   - 8.23 [Customer Communication Preferences](#823-customer-communication-preferences)
   - 8.24 [Delivery Regions & Shipping Rules (Admin)](#824-delivery-regions--shipping-rules-admin)
9. [Domain Model (Entities)](#9-domain-model-entities)
10. [Service Layer](#10-service-layer)
11. [Scheduled Jobs](#11-scheduled-jobs)
12. [External Integrations](#12-external-integrations)
13. [Frontend Architecture](#13-frontend-architecture)
14. [Deployment](#14-deployment)
15. [Key Dependency List](#15-key-dependency-list)

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────┐
│              Customer Browser               │
│  React + TypeScript + TanStack Query        │
│  Vite build | Tailwind CSS                  │
└──────────────┬──────────────────────────────┘
               │ HTTPS / REST (JWT)
               ▼
┌─────────────────────────────────────────────┐
│        Spring Boot 3.5.5 (Java 17)          │
│  REST Controllers → Services → Repositories │
│  Spring Security (JWT + OAuth2)             │
│  Redis (cache layer)                        │
└──────┬───────────┬──────────────────────────┘
       │           │
       ▼           ▼
┌──────────┐  ┌────────────────────────────────┐
│PostgreSQL│  │   External Services            │
│(Supabase)│  │  Razorpay | WhatsApp Cloud API │
│Liquibase │  │  CloudFlare R2 | Resend email  │
│migrations│  │  Google OAuth2 | ImageMagick   │
└──────────┘  └────────────────────────────────┘
```

**Key design decisions:**
- Schema-first with Liquibase; Hibernate DDL is disabled (`ddl-auto=none`).
- Soft deletes on most tables (`active = false` + `@SQLDelete`).
- All audit columns managed by a PostgreSQL trigger (not application code).
- Images normalised to JPEG via ImageMagick before storage.
- Presigned S3-compatible URLs (15-minute TTL) served to clients for image download.
- Redis used for product list and featured product caching.
- JWT-based stateless auth (no server-side sessions).

---

## 2. Project Structure

```
Blossom_Buds/
├── blossombuds-api/                    # Spring Boot backend
│   ├── src/main/java/com/blossombuds/
│   │   ├── web/                        # REST controllers
│   │   ├── service/                    # Business logic
│   │   ├── domain/                     # JPA entities
│   │   ├── repository/                 # Spring Data repositories
│   │   ├── dto/                        # Request/response DTOs
│   │   ├── config/                     # Spring configuration beans
│   │   └── security/                   # JWT filter, auth config
│   ├── src/main/resources/
│   │   ├── application.properties      # Local dev config
│   │   ├── application-staging.properties
│   │   ├── application-prod.properties
│   │   ├── db/changelog/liquibase/     # Liquibase migrations
│   │   └── templates/                  # Email HTML templates
│   └── pom.xml
│
├── blossombuds-frontend/               # React frontend
│   ├── src/
│   │   ├── pages/                      # Route-level page components
│   │   ├── components/                 # Reusable UI components
│   │   ├── api/                        # Axios API client modules
│   │   ├── app/                        # App providers + routing
│   │   └── App.tsx
│   ├── package.json
│   └── vite.config.ts
│
├── infra/
│   └── docker-compose.yml              # Local PostgreSQL + pgAdmin
│
└── docs/
    ├── BUSINESS_DOCUMENTATION.md
    └── TECHNICAL_DOCUMENTATION.md      # ← this file
```

---

## 3. Technology Stack

### Backend
| Component | Technology |
|---|---|
| Language | Java 17 |
| Framework | Spring Boot 3.5.5 |
| ORM | Spring Data JPA / Hibernate |
| Database | PostgreSQL 15 |
| Migrations | Liquibase |
| Caching | Spring Cache. **In-memory (`simple`) in production** — Redis is currently disabled, see §12 |
| Security | Spring Security 6 (JWT + OAuth2) |
| Build | Maven |
| PDF Generation | OpenPDF |
| Image Processing | ImageMagick (via im4java wrapper) |
| Cloud Storage | CloudFlare R2 (S3-compatible) via AWS SDK |

### Frontend
| Component | Technology |
|---|---|
| Language | TypeScript |
| Framework | React 19 |
| Build Tool | Vite |
| Styling | Tailwind CSS |
| HTTP Client | Axios |
| Data Fetching | TanStack Query (React Query) |
| Form Handling | React Hook Form |

### Infrastructure
| Component | Provider |
|---|---|
| API + Redis Hosting (Prod) | Railway (`blossombuds-api-production.up.railway.app`). Production is the only deployed environment |
| Database (Prod) | **Supabase PostgreSQL**, via the connection pooler |
| Database (Local) | PostgreSQL 15 in Docker (`127.0.0.1:5544`) |
| Object Storage | CloudFlare R2 |
| Caching (Prod) | In-memory. A Redis instance is deployed on Railway but unused — see §12 |
| Email | Resend (prod) / Zoho SMTP (dev) |
| Payment | Razorpay |
| WhatsApp | Meta Cloud API |
| Auth (Social) | Google OAuth2 |

---

## 4. Local Development Setup

### Prerequisites
- Java 17 JDK
- Maven 3.9+
- Node.js 20+ and npm (the repo uses `package-lock.json`)
- Docker Desktop
- ImageMagick 7.x (for image processing)
- Docker (for the local PostgreSQL container)

### Steps

**1. Start infrastructure**
```bash
cd infra
docker-compose up -d   # starts PostgreSQL on :5544 and pgAdmin on :5050
```

**2. Start the API**
```bash
cd blossombuds-api
./mvnw spring-boot:run
# API available at http://localhost:8080
# Liquibase runs migrations automatically on start
```

**3. Start the frontend**
```bash
cd blossombuds-frontend
npm install
npm run dev
# Frontend available at http://localhost:5173
# Vite proxies /api to http://127.0.0.1:8080 (120s timeout)
```

### Docker Compose Services
- **PostgreSQL** (`postgres:15`): port `5544`, database `bb`, schema `bb_app`, user `app_user` / password `app_password`
- **pgAdmin** (`dpage/pgadmin4`): port `5050`

> `infra/docker-compose.yml` defines **no Redis service**. Local runs use the in-memory cache, the
> same as production — see §12.

---

## 5. Environment Configuration

### `application.properties` (Local Dev — full reference)

```properties
# ── Database ──────────────────────────────────────────────────────
spring.datasource.url=jdbc:postgresql://127.0.0.1:5544/bb
spring.datasource.username=app_user
spring.datasource.password=app_password

# ── Hibernate ─────────────────────────────────────────────────────
spring.jpa.hibernate.ddl-auto=none
spring.jpa.show-sql=false
spring.jpa.open-in-view=false

# ── Liquibase ─────────────────────────────────────────────────────
spring.liquibase.enabled=true
spring.liquibase.change-log=classpath:db/changelog/liquibase/changelog-master.xml
spring.liquibase.default-schema=bb_app

# ── CORS (add all frontend origins) ──────────────────────────────
spring.mvc.cors.mappings.[/**].allowed-origins=http://localhost:5173,http://localhost:3000
spring.mvc.cors.mappings.[/**].allow-credentials=true

# ── JWT ───────────────────────────────────────────────────────────
app.jwt.secret=<base64-encoded-secret>
app.jwt.ttl-seconds=7200                    # admin token: 2 hours
app.jwt.customer-ttl-seconds=157680000      # customer token: ~5 years

# ── Email (Zoho SMTP for local dev) ───────────────────────────────
spring.mail.host=smtp.zoho.eu
spring.mail.port=587
spring.mail.username=no-reply@blossom-buds-floral-artistry.com
spring.mail.password=<smtp-password>

# ── Email (Resend for prod) ───────────────────────────────────────
app.mail.apiUrl=https://api.resend.com/emails
app.mail.apiKey=<resend-api-key>
app.mail.logoUrl=<logo-image-url>

# ── Frontend (for email links) ─────────────────────────────────────
app.frontend.baseUrl=http://localhost:5173

# ── CloudFlare R2 ─────────────────────────────────────────────────
cloudflare.r2.access-key=<access-key-id>
cloudflare.r2.secret-key=<secret-access-key>
cloudflare.r2.bucket=product-images
cloudflare.r2.endpoint=https://<account-id>.r2.cloudflarestorage.com

# ── ImageMagick ───────────────────────────────────────────────────
app.imagemagick.cmd=C:\\Program Files\\ImageMagick-7.1.2-Q16-HDRI\\magick.exe

# ── File Upload Limits ────────────────────────────────────────────
spring.servlet.multipart.max-file-size=10MB
spring.servlet.multipart.max-request-size=12MB

# ── Razorpay ─────────────────────────────────────────────────────
app.razorpay.base-url=https://api.razorpay.com/v1
app.razorpay.key-id=<razorpay-key-id>
app.razorpay.key-secret=<razorpay-key-secret>
app.razorpay.webhook-secret-test=<webhook-secret>

# ── Redis ─────────────────────────────────────────────────────────
spring.cache.type=redis
spring.data.redis.host=localhost
spring.data.redis.port=6379
spring.data.redis.password=
spring.data.redis.ssl.enabled=false

# ── Google OAuth2 ─────────────────────────────────────────────────
spring.security.oauth2.client.registration.google.client-id=<google-client-id>
spring.security.oauth2.client.registration.google.client-secret=<google-client-secret>
spring.security.oauth2.client.registration.google.redirect-uri=http://localhost:5173/login/oauth2/code/google
```

### Production Overrides

Production (`application-prod.properties`) is the only deployed profile; its secrets are injected
as Railway environment variables. A `application-staging.properties` exists using the same keys with
a `_STG` suffix, but **that environment is not deployed** and its config is unmaintained.

| Environment Variable | Description |
|---|---|
| `DB_URL_PROD` / `DB_USER_PROD` / `DB_PASSWORD_PROD` | Supabase pooler JDBC connection |
| `JWT_SECRET_PROD` | HMAC signing key for JWTs |
| `FRONTEND_BASE_PROD` | Base URL used to build links in emails |
| `FRONTEND_ORIGIN_PROD` | Allowed CORS origin |
| `RAZORPAY_KEY_ID_PROD` / `RAZORPAY_KEY_SECRET_PROD` / `RAZORPAY_WEBHOOK_SECRET_PROD` | Razorpay credentials and webhook signing secret |
| `CLOUDFLARE_R2_ENDPOINT` / `CLOUDFLARE_R2_ACCESS_KEY` / `CLOUDFLARE_R2_SECRET_KEY` / `CLOUDFLARE_R2_BUCKET_PROD` | R2 object storage |
| `APP_MAIL_APIKEY` / `MAIL_FROM_PROD` | Resend API key and From address |
| `SMTP_HOST_PROD` / `SMTP_USER_PROD` / `SMTP_PASS_PROD` | SMTP fallback |
| `MSG91_AUTHKEY` | MSG91 SMS auth key. Unset = SMS sends are skipped with a warning |
| `GOOGLE_CLIENT_ID` / `Google_CLIENT_SECRET` | Google OAuth2 (note the capitalisation of the second key — it is spelled that way in the properties file) |
| `REDIS_URL` | Redis connection URL |
| `APP_CACHE_REDIS_ENABLED` | `false` currently — see the Redis note below |
| `APP_CACHE_TYPE` | `simple` currently (in-memory) |

> **Connecting through the Supabase pooler.** Production points at the *pooler* host,
> not the direct database host, which constrains the datasource config:
>
> - `prepareThreshold=0` — server-side prepared statements must be off. A transaction pooler hands
>   out a different backend connection per transaction, so a prepared statement created on one
>   connection will not exist on the next. Removing this produces intermittent
>   `prepared statement "S_1" does not exist` errors under load.
> - `connection-init-sql=SET search_path TO blossombuds_prod` plus the `options=-c search_path=…`
>   data-source property — the pooler does not preserve session state, so the schema has to be set
>   on every connection rather than once.
> - Hikari pool sizes are deliberately modest (25 prod / 15 staging) and `max-lifetime` is kept
>   below the pooler's own idle timeout so connections are recycled by the app, not dropped
>   underneath it.
>
> Local development connects to a plain PostgreSQL 15 container with none of these constraints,
> so a query pattern can work locally and fail in staging. Schemas differ too: `bb_app` locally,
> `blossombuds_stg` in staging, `blossombuds_prod` in production.

> **A Redis instance is deployed on Railway, but the application does not currently use it.**
> `application-prod.properties` excludes the Redis auto-configuration classes *and* sets
> `spring.cache.type=simple`, so caching is in-process even though `REDIS_URL` points at a live
> instance. The Jedis pool settings in the file are inert until it is switched back on.
>
> Re-enabling means setting `APP_CACHE_REDIS_ENABLED=true` and `APP_CACHE_TYPE=redis`, and removing
> the Redis entries from `spring.autoconfigure.exclude` — the exclusion alone will keep it off
> regardless of the other two.
>
> Bump `app.cache.key-version` (currently `v31`) whenever a cached DTO's shape changes. Without it,
> entries written by the previous deployment deserialise into the new class and fail at runtime.
> Because caching is in-memory today the risk is dormant, but it returns the moment Redis is on.

### Application Settings (Stored in Database)

These are live-editable via the Admin Settings page and take effect immediately:

| Key | Type | Description |
|---|---|---|
| `shipping.free_threshold` | Decimal | Order subtotal (₹) required for free shipping |
| `whatsapp.payment_reminder.enabled` | Boolean (`true`/`false`) | Enable/disable payment reminders |
| `whatsapp.payment_reminder.delay_minutes` | Integer | Minutes before first reminder (default: 30) |
| `whatsapp.cloud.enabled` | Boolean | `true` = live sending. Anything else = dry-run |
| `whatsapp.cloud.api_version` | String | Graph API version (default `v25.0`) |
| `whatsapp.cloud.phone_number_id` | String | Meta sending number id |
| `whatsapp.cloud.business_account_id` | String | WABA id |
| `whatsapp.cloud.verify_token` | String | Token for Meta webhook hub verification — **secret** |
| `whatsapp.cloud.access_token` | String | Meta API bearer token — **secret** |
| `whatsapp.cloud.own_phone_number` | String | The app's own number; suppresses auto-reply loops |
| `brand.whatsapp` | String | Public support number shown in auto-replies and the storefront FAB |

Keys flagged **secret** are hidden from non-admin callers and masked for admins — see §8.16.

---

## 6. Database Schema

### Migration Files (Liquibase)

Located at `blossombuds-api/src/main/resources/db/changelog/liquibase/changes/`

| File | Contents |
|---|---|
| `0001-audit-and-types.xml` | Audit trigger, `order_status_enum`, `payment_status_enum` enums |
| `0002-catalog.xml` | `products`, `categories`, `product_categories` (M:N) |
| `0003-catalog-taxonomy-variants.xml` | `product_options`, `product_option_values` |
| `0004-security-accounts.xml` | `admins`, `customers` tables |
| `0005-promotions.xml` | `coupons`, `coupon_redemptions`, `global_sale_config` |
| `0006-delivery-partners.xml` | `delivery_partners` |
| `0007-orders-core.xml` | `orders`, `next_public_code()` PostgreSQL function |
| `0008-order-items-payments-events.xml` | `order_items`, `payments`, `order_events` |
| `0009-reviews.xml` | `product_reviews`, `product_review_images` |
| `0010-settings-and-cms.xml` | `settings` (KV), `cms_pages`, `cms_page_revisions` |
| `0011-indexes-and-uniques.xml` | Performance indexes |
| `0012-auth-tokens.xml` | OTP / email verification tokens |
| `0013-customers-email-verified.xml` | `email_verified`, `phone_verified` columns |
| `0014-geo-core.xml` | `countries`, `states`, `districts` |
| `0015-delivery-fee-rules.xml` | `delivery_fee_rules` (hierarchical) |
| `0016-geo-refs-on-addresses-and-orders.xml` | FK to state/district/country |
| `0017-checkout-intent.xml` | `checkout_intents` table |
| `0018-refdata-from-seed.xml` | Reference data seed (India states, districts) |
| `0019-table-updates.xml` | Column additions across `products`, `categories`, `coupons`, `orders`, `product_options`, `product_option_values`, `product_reviews`, `settings` |
| `0020-admin-metrics-indexes.xml` | Indexes for analytics queries |
| `0021-customer-login-and-register-changes.xml` | `google_subject` / `google_email` on `customers`, `auth_otp_tokens` table, **unique index `idx_customers_phone_unique`** |
| `0022-add-visible-column.xml` | `products.visible` |
| `0023-add-instock-flag.xml` | `products.in_stock` |
| `0024-add-global-sale-config.xml` | `global_sale_config` table |
| `0025-add-category-table-image.xml` | Category image columns |
| `0026-create-back-in-stock-request.xml` | `back_in_stock_requests` |
| `0027-add-fixed-fee-to-delivery-partners.xml` | `delivery_partners.fixed_fee` |
| `0028-cart-suggestion-products-table.xml` | `cart_suggestion_products` |
| `0029-create-razorpay-webhook-inbox-table.xml` | `razorpay_webhook_inbox` |
| `0030-payment-recovery-constraints.xml` | FK constraints for checkout intent |
| `0031-add-gst-fields-to-orders.xml` | `taxable_amount`, `gst_rate`, `gst_amount` |
| `0032-whatsapp-crm-and-payment-reminders.xml` | WhatsApp campaign tables + message events |
| `0033-seed-whatsapp-settings-and-templates.xml` | WhatsApp template seed data |
| `0034-whatsapp-transactional.xml` | Transactional WhatsApp integration |
| `0035-seed-festival-offers-template.xml` | Festival offer template seed |
| `0036-add-sms-preference-columns.xml` | SMS opt-in columns on `customer_whatsapp_preferences` |
| `0037-normalize-customer-phone-numbers.xml` | Strips whitespace from `customers.phone` (`+91 812…` → `+91812…`) |
| `0038-checkout-intent-reminder-fields.xml` | `reminder_count`, `reminder_sent_at` on `checkout_intent` |
| `0039-payment-reminders-table.xml` | `payment_reminders` table |
| `0040-whatsapp-contacts.xml` | `whatsapp_contacts` — expo / externally-sourced leads |
| `0041-seed-expo-outreach-template.xml` | `expo_outreach` template seed |
| `0042-delivery-regions.xml` | `delivery_regions`, `delivery_region_states` |
| `0043-extend-delivery-fee-rules.xml` | Adds `delivery_partner_id` and `region_id` to `delivery_fee_rules` |
| `0044-state-partner-allowlist.xml` | `state_partner_allowlist` |
| `0045-migrate-fixed-fees.xml` | Migrates partner fixed fees into the rules model |
| `0046-seed-delivery-regions.xml` | Delivery region seed data |
| `0047-fix-festival-offers-variable-count.xml` | Drops the 3rd body variable from `festival_offers` to match Meta approval |
| `0048-seed-expo-outreach-v2-template.xml` | `expo_outreach_v2` template seed (adds opt-out instruction) |
| `0049-add-email-marketing.xml` | `email_campaigns`, `email_campaign_recipients`, `customer_email_preferences` |
| `0050-link-whatsapp-email-campaigns.xml` | `also_email_phoneless`, `linked_email_campaign_id` on `whatsapp_campaigns` |
| `0099-attach-audit-triggers.xml` | Attaches the audit trigger to every table |
| `1001-seed-admin.xml` / `1002-seed-settings.xml` | Initial admin account and default settings |

> **Note on `0037`**: this migration normalises whitespace out of phone numbers. If two customer
> rows hold the same number in different formats (`+91 8124532524` and `+918124532524`), the
> update makes them identical and the unique index from `0021` rejects it — startup fails with
> `duplicate key value violates unique constraint "idx_customers_phone_unique"`. Deduplicate the
> `customers` table before deploying to an environment that has not yet run it.

### Key Schema Notes

- **Soft deletes**: Most tables have `active BOOLEAN DEFAULT TRUE`. Delete operations set `active = false`; Hibernate `@SQLDelete` + `@Where(clause="active=true")` filters them from queries automatically.
- **Audit columns**: `created_by`, `created_at`, `modified_by`, `modified_at` on every table; populated by a PostgreSQL trigger (not Spring).
- **Order public code**: Generated by the stored function `next_public_code()` — format `YYNNNN` (e.g., `250001` = year 2025, first order). UI prefix `BB` is added in application.
- **JSONB columns**: `order_items.selected_options`, `checkout_intents.order_draft_json / items_json`, `whatsapp_message_events.payload`.
- **PostgreSQL enums**: `order_status_enum` and `payment_status_enum` defined in migration 0001.

---

## 7. Authentication & Security

### JWT Tokens

| Token Type | Subject Format | TTL | Roles |
|---|---|---|---|
| Admin | `<admin-username>` | 2 hours | `ROLE_ADMIN` |
| Customer | `cust:<customerId>` | ~5 years | `ROLE_CUSTOMER` |

- Token signing: HMAC-SHA256 with the secret in `app.jwt.secret` (Base64-encoded).
- Tokens sent as `Authorization: Bearer <token>` header.
- No refresh token mechanism — customers get a long-lived token; admins re-login every 2 hours.

### Endpoint Access Levels

| Label | Meaning |
|---|---|
| **Public** | No authentication required |
| **CUSTOMER** | Valid customer JWT required |
| **ADMIN** | Valid admin JWT required |
| **CUSTOMER/ADMIN** | Either role accepted; ownership checked for CUSTOMER |

### Ownership Checks

For customer-scoped endpoints (e.g., addresses, orders), the service layer verifies that the resource belongs to the authenticated customer. Admins bypass this check.

### Password Security

- Bcrypt hashing (Spring Security `BCryptPasswordEncoder`).
- OTP-based reset (no clickable email links with embedded tokens — OTP is typed in manually).

### CORS

Local dev allows `localhost:5173` and `localhost:3000`. Production allows the configured frontend domain. Credentials (`cookies`, `Authorization` headers) are permitted.

### Webhook Security

- **Razorpay**: Validates `X-Razorpay-Signature` header using HMAC-SHA256 with `app.razorpay.webhook-secret-test`.
- **WhatsApp**: Hub challenge verification on `GET /api/webhooks/whatsapp` using `hub.verify_token` matched against the `whatsapp.cloud.verify_token` setting.

---

## 8. API Reference

**Base URL**: `http://localhost:8080` (local) | `https://api.blossombuds.in` (prod)

All endpoints are prefixed with `/api`.

**Common Headers:**
```
Content-Type: application/json
Authorization: Bearer <jwt-token>   (where required)
```

**Common Response Codes:**
| Code | Meaning |
|---|---|
| 200 OK | Successful GET / action |
| 201 Created | Resource created successfully |
| 204 No Content | Successful delete or void action |
| 400 Bad Request | Validation failure |
| 401 Unauthorized | Missing or invalid JWT |
| 403 Forbidden | Insufficient role |
| 404 Not Found | Resource not found |
| 409 Conflict | Duplicate resource or constraint violation |

---

### 8.1 Admin Auth

**Base path**: `/api/auth`

#### `POST /api/auth/login`
Admin email/password login.

**Auth**: None  
**Request body**:
```json
{
  "username": "admin@example.com",
  "password": "secret"
}
```
**Response** `200 OK`:
```json
{
  "token": "<jwt-token>"
}
```

---

#### `POST /api/auth/logout`
Stateless logout (client discards token; no server-side invalidation).

**Auth**: ADMIN  
**Response**: `204 No Content`

---

### 8.2 Customer Auth

**Base path**: `/api/customers/auth`

#### `POST /api/customers/auth/register`
Register a new customer. Sends an email verification OTP.

**Auth**: None  
**Request body**:
```json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "phone": "+919876543210",
  "password": "secret123"
}
```
**Response**: `201 Created`

---

#### `POST /api/customers/auth/verify-email`
Verify email with OTP (no auto-login).

**Auth**: None  
**Request body**:
```json
{ "email": "jane@example.com", "code": "123456" }
```
**Response**: `204 No Content`

---

#### `POST /api/customers/auth/verify-email-otp`
Verify email with OTP and receive JWT in one step.

**Auth**: None  
**Request body**:
```json
{ "email": "jane@example.com", "code": "123456" }
```
**Response** `200 OK`:
```json
{ "token": "<customer-jwt>" }
```

---

#### `POST /api/customers/auth/login`
Customer email/password login.

**Auth**: None  
**Request body**:
```json
{ "email": "jane@example.com", "password": "secret123" }
```
**Response** `200 OK`:
```json
{ "token": "<customer-jwt>" }
```

---

#### `POST /api/customers/auth/resend-verification`
Resend email verification OTP.

**Auth**: None  
**Request body**:
```json
{ "email": "jane@example.com" }
```
**Response**: `204 No Content`

---

#### `POST /api/customers/auth/password-reset/request`
Initiate password reset. Sends OTP to email.

**Auth**: None  
**Request body**:
```json
{ "email": "jane@example.com" }
```
**Response**: `204 No Content`

---

#### `POST /api/customers/auth/password-reset/confirm`
Complete password reset.

**Auth**: None  
**Request body**:
```json
{
  "email": "jane@example.com",
  "code": "123456",
  "newPassword": "newSecret123"
}
```
**Response**: `204 No Content`

---

#### `POST /api/customers/auth/verify-phone-otp`
Verify phone via SMS OTP and receive JWT.

**Auth**: None  
**Request body**:
```json
{ "phone": "+919876543210", "code": "123456" }
```
**Response** `200 OK`:
```json
{ "token": "<customer-jwt>" }
```

---

#### `POST /api/customers/auth/resend-phone-otp`
Resend SMS OTP.

**Auth**: None  
**Request body**:
```json
{ "phone": "+919876543210" }
```
**Response**: `204 No Content`

---

#### `POST /api/customers/auth/google-login`
Login or register via Google OAuth2.

**Auth**: None  
**Request body**:
```json
{ "idToken": "<google-id-token>" }
```
**Response** `200 OK`:
```json
{ "token": "<customer-jwt>" }
```

---

### 8.3 Catalog — Categories

**Base path**: `/api/catalog/categories`

#### `POST /api/catalog/categories`
Create a category.

**Auth**: ADMIN  
**Request body**:
```json
{
  "name": "Wedding Arrangements",
  "description": "Flower arrangements for weddings",
  "slug": "wedding-arrangements"
}
```
**Response** `201 Created`: `CategoryDto`

---

#### `GET /api/catalog/categories/{id}`
Get category by ID.

**Auth**: Public  
**Response** `200 OK`: `CategoryDto`

---

#### `PUT /api/catalog/categories/{id}`
Update a category.

**Auth**: ADMIN  
**Response** `200 OK`: `CategoryDto`

---

#### `DELETE /api/catalog/categories/{id}`
Soft-delete a category.

**Auth**: ADMIN  
**Response**: `204 No Content`

---

#### `POST /api/catalog/categories/{id}/image`
Upload category image (multipart).

**Auth**: ADMIN  
**Request**: `multipart/form-data` — field `file` (image), optional `altText` (string)  
**Response** `200 OK`: `CategoryDto`

---

#### `PUT /api/catalog/categories/{id}/image`
Replace category image.

**Auth**: ADMIN  
**Request**: Same as POST above  
**Response** `200 OK`: `CategoryDto`

---

#### `DELETE /api/catalog/categories/{id}/image`
Remove category image.

**Auth**: ADMIN  
**Response**: `204 No Content`

---

#### `PUT /api/catalog/categories/reorder`
Update the display sort order of categories.

**Auth**: ADMIN  
**Request body**:
```json
[
  { "id": 1, "sortOrder": 0 },
  { "id": 3, "sortOrder": 1 },
  { "id": 2, "sortOrder": 2 }
]
```
**Response**: `204 No Content`

---

### 8.4 Catalog — Products

**Base path**: `/api/catalog/products`

#### `POST /api/catalog/products`
Create a product.

**Auth**: ADMIN  
**Request body**:
```json
{
  "name": "Red Rose Bouquet",
  "slug": "red-rose-bouquet",
  "description": "A beautiful bouquet of 24 red roses.",
  "price": 1499.00,
  "active": true,
  "visible": true,
  "featured": false,
  "inStock": true,
  "excludeFromGlobalDiscount": false
}
```
**Response** `201 Created`: `ProductDto`

---

#### `GET /api/catalog/products`
List all active, visible products (paginated).

**Auth**: Public  
**Query params**: `page` (default 0), `size` (default 20)  
**Response** `200 OK`: `Page<ProductDto>`

---

#### `GET /api/catalog/products/new-arrivals`
Get up to 12 newest products.

**Auth**: Public  
**Response** `200 OK`: `List<ProductDto>`

---

#### `GET /api/catalog/products/featured`
List all featured products (paginated).

**Auth**: Public  
**Response** `200 OK`: `Page<ProductDto>`

---

#### `GET /api/catalog/products/featured/top`
Get up to 12 top featured products for homepage.

**Auth**: Public  
**Response** `200 OK`: `List<ProductDto>`

---

#### `GET /api/catalog/products/{id}`
Get product by ID.

**Auth**: Public  
**Response** `200 OK`: `ProductDto`

---

#### `PUT /api/catalog/products/{id}`
Update a product.

**Auth**: ADMIN  
**Response** `200 OK`: `ProductDto`

---

#### `DELETE /api/catalog/products/{id}`
Soft-delete a product.

**Auth**: ADMIN  
**Response**: `204 No Content`

---

#### `POST /api/catalog/products/{id}/featured`
Mark product as featured.

**Auth**: ADMIN  
**Response** `200 OK`: `Product`

---

#### `DELETE /api/catalog/products/{id}/featured`
Remove product from featured.

**Auth**: ADMIN  
**Response**: `204 No Content`

---

#### `POST /api/catalog/products/{id}/notify-me`
Subscribe to back-in-stock alert.

**Auth**: Public (optionally CUSTOMER)  
**Request body** (optional):
```json
{ "email": "jane@example.com" }
```
**Response**: `204 No Content`

---

#### Product ↔ Category Links

**`POST /api/catalog/products/{productId}/categories/{categoryId}`**  
Link product to a category. **Auth**: ADMIN. **Response**: `204 No Content`

**`DELETE /api/catalog/products/{productId}/categories/{categoryId}`**  
Unlink product from a category. **Auth**: ADMIN. **Response**: `204 No Content`

**`GET /api/catalog/products/{productId}/categories`**  
List all categories for a product. **Auth**: Public. **Response**: `List<CategoryDto>`

---

### 8.5 Catalog — Product Images

**Base path**: `/api/catalog/products/{productId}/images`

#### `POST /api/catalog/products/{productId}/images`
Upload a product image (multipart).

**Auth**: ADMIN  
**Request**: `multipart/form-data` — `file`, optional `altText`, optional `sortOrder`  
**Response** `201 Created`: `ProductImageDto`

---

#### `GET /api/catalog/products/{productId}/images`
Get all images for a product (includes signed URLs).

**Auth**: Public  
**Response** `200 OK`: `List<ProductImageDto>`

---

#### `PUT /api/catalog/products/{productId}/images/{imageId}`
Replace/update a product image.

**Auth**: ADMIN  
**Request**: `multipart/form-data`  
**Response** `200 OK`: `ProductImageDto`

---

#### `DELETE /api/catalog/products/{productId}/images/{imageId}`
Soft-delete a product image.

**Auth**: ADMIN  
**Response**: `204 No Content`

---

#### `POST /api/catalog/products/{productId}/images/{imageId}/primary`
Mark an image as the primary image.

**Auth**: ADMIN  
**Response**: `204 No Content`

---

#### `POST /api/catalog/uploads/presign`
Get a presigned URL for direct browser-to-R2 upload.

**Auth**: ADMIN  
**Request body**:
```json
{ "filename": "bouquet.jpg", "contentType": "image/jpeg" }
```
**Response** `200 OK`:
```json
{
  "uploadUrl": "https://r2.cloudflarestorage.com/...",
  "tempKey": "tmp/uuid-bouquet.jpg"
}
```

---

#### `POST /api/catalog/products/{productId}/images/from-key`
Attach a previously uploaded (presigned) image to a product.

**Auth**: ADMIN  
**Request body**:
```json
{ "tempKey": "tmp/uuid-bouquet.jpg", "altText": "Red rose bouquet", "sortOrder": 0 }
```
**Response** `201 Created`: `ProductImageDto`

---

### 8.6 Catalog — Options & Values

#### Product Options

**`POST /api/catalog/products/{productId}/options`**  
Add an option to a product (e.g., "Color").  
**Auth**: ADMIN  
**Request body**:
```json
{
  "name": "Color",
  "description": "Choose your flower colour",
  "displayType": "RADIO",
  "sortOrder": 0
}
```
**Response** `201 Created`: `ProductOptionDto`

**`GET /api/catalog/products/{productId}/options`**  
List all options with their values.  
**Auth**: Public  
**Response**: `List<ProductOptionWithValuesDto>`

**`GET /api/catalog/options/{optionId}`** — Get option by ID. Public.  
**`PUT /api/catalog/options/{optionId}`** — Update option. ADMIN.  
**`DELETE /api/catalog/options/{optionId}`** — Soft-delete option. ADMIN.

---

#### Option Values

**`POST /api/catalog/options/{optionId}/values`**  
Add a value to an option (e.g., "Red").  
**Auth**: ADMIN  
**Request body**:
```json
{
  "value": "Red",
  "additionalPrice": 0.00,
  "sortOrder": 0
}
```
**Response** `201 Created`: `ProductOptionValueDto`

**`GET /api/catalog/options/{optionId}/values`** — List values. Public.  
**`GET /api/catalog/options/{optionId}/values/{valueId}`** — Get value. Public.  
**`PUT /api/catalog/options/{optionId}/values/{valueId}`** — Update value. ADMIN.  
**`DELETE /api/catalog/options/{optionId}/values/{valueId}`** — Soft-delete value. ADMIN.

---

### 8.7 Catalog — Global Discounts

**Base path**: `/api/catalog/discounts`

#### `GET /api/catalog/discounts`
List all global discount configs.

**Auth**: ADMIN  
**Response**: `List<GlobalSaleConfigDto>`

---

#### `GET /api/catalog/discounts/{id}`
Get discount config by ID.

**Auth**: ADMIN  
**Response**: `GlobalSaleConfigDto`

---

#### `POST /api/catalog/discounts`
Create a global discount.

**Auth**: ADMIN  
**Request body**:
```json
{
  "enabled": true,
  "percentOff": 15.00,
  "label": "Diwali Offer",
  "startsAt": "2025-10-20T00:00:00Z",
  "endsAt": "2025-10-25T23:59:59Z"
}
```
**Response** `201 Created`: `GlobalSaleConfigDto`  
**Note**: Returns `409 Conflict` if another enabled discount overlaps the date range.

---

#### `PUT /api/catalog/discounts/{id}`
Update a discount config.

**Auth**: ADMIN  
**Response** `200 OK`: `GlobalSaleConfigDto`

---

#### `DELETE /api/catalog/discounts/{id}`
Hard-delete a discount config.

**Auth**: ADMIN  
**Response**: `204 No Content`

---

#### `GET /api/catalog/discounts/effective`
Get the currently effective discount (if any).

**Auth**: Public  
**Response** `200 OK`: `GlobalSaleConfigDto` or `null`

---

### 8.8 Catalog — Back-in-Stock & Cart Suggestions

#### Back-in-Stock

**`GET /api/catalog/stock-alerts/summary`**  
Admin view of pending stock alerts.  
**Auth**: ADMIN  
**Response**: `List<BackInStockAdminSummaryDto>`

---

#### Cart Suggestions

**`GET /api/catalog/cart-suggestions`** — Public cart suggestions. Public. Returns `List<ProductDto>`.

**`GET /api/catalog/admin/cart-suggestions`** — Admin view. ADMIN.  
**`POST /api/catalog/admin/cart-suggestions/{productId}`** — Add product. ADMIN.  
**`DELETE /api/catalog/admin/cart-suggestions/{productId}`** — Remove. ADMIN.  
**`PUT /api/catalog/admin/cart-suggestions/reorder`** — Reorder (list of `{id, sortOrder}`). ADMIN.

---

### 8.9 Checkout

**Base path**: `/api/checkout`

#### `POST /api/checkout`
Start checkout. Returns a Razorpay order (India) or WhatsApp URL (international).

**Auth**: CUSTOMER  
**Request body**:
```json
{
  "order": {
    "customerId": 1,
    "addressId": 5,
    "deliveryPartnerId": 2,
    "couponCode": "BBNEW10",
    "orderNotes": "Please add a greeting card"
  },
  "items": [
    { "productId": 10, "quantity": 2, "selectedOptions": { "Color": "Red" } }
  ]
}
```
**Response — India (Razorpay)** `200 OK`:
```json
{
  "type": "RZP_ORDER",
  "currency": "INR",
  "razorpayOrder": {
    "id": "order_XXXXX",
    "amount": 299800,
    "currency": "INR",
    ...
  }
}
```
**Response — International (WhatsApp)** `200 OK`:
```json
{
  "type": "WHATSAPP",
  "whatsappUrl": "https://wa.me/91XXXXXXXXXX?text=..."
}
```

---

### 8.10 Orders

**Base path**: `/api/orders`

#### `POST /api/orders`
Admin: Create an order manually.

**Auth**: ADMIN  
**Request body**: `OrderCreateRequest` (customerId, addressId, items, payment details)  
**Response** `201 Created`: `OrderLiteDto`

---

#### `PUT /api/orders/{orderId}`
Admin: Update an order.

**Auth**: ADMIN  
**Response** `200 OK`: `OrderLiteDto`

---

#### `GET /api/orders/{publicCode}`
Get order by public code (e.g., `BB250001` or `250001`).

**Auth**: Public  
**Response** `200 OK`: `OrderDetailDto`

`OrderDetailDto` includes: order fields, items (with product name, options, quantities), payments, events, shipping address with location names.

---

#### `GET /api/orders/by-customer/{customerId}`
List all orders for a customer.

**Auth**: CUSTOMER (own) / ADMIN  
**Response** `200 OK`: `List<OrderLiteDto>`

---

#### `GET /api/orders/all`
Paginated list of all orders (admin).

**Auth**: ADMIN  
**Query params**:
- `status`: `ORDERED` | `DISPATCHED` | `DELIVERED` | `CANCELLED` | `REFUNDED` | `RETURNED_REFUNDED`
- `from`: ISO date (inclusive)
- `to`: ISO date (inclusive)
- `page`, `size`

**Response** `200 OK`: `Page<OrderLiteDto>`

---

#### `PATCH /api/orders/{orderId}/status`
Update order status.

**Auth**: ADMIN  
**Request body**:
```json
{
  "status": "DISPATCHED",
  "note": "Handed over to DHL",
  "trackingNumber": "1234567890",
  "deliveryPartnerId": 2
}
```
**Response** `200 OK`: `OrderLiteDto`

---

#### `POST /api/orders/{orderId}/items`
Add an item to an existing order.

**Auth**: ADMIN  
**Request body**: `OrderItemDto`  
**Response** `201 Created`: `OrderItemView`

---

#### `GET /api/orders/{orderId}/items`
List items for an order.

**Auth**: ADMIN  
**Response** `200 OK`: `List<OrderItemView>`

---

#### `POST /api/orders/{orderId}/payments`
Record a payment for an order.

**Auth**: ADMIN  
**Request body**:
```json
{
  "amount": 1499.00,
  "currency": "INR",
  "method": "RAZORPAY",
  "rzpOrderId": "order_XXXXX",
  "rzpPaymentId": "pay_XXXXX"
}
```
**Response** `201 Created`: `PaymentView`

---

#### `GET /api/orders/{orderId}/payments`
List payments for an order.

**Auth**: ADMIN  
**Response** `200 OK`: `List<PaymentView>`

---

#### `GET /api/orders/{orderId}/events`
List the event timeline for an order.

**Auth**: ADMIN  
**Response** `200 OK`: `List<OrderEventView>`

Each event: `{ eventType, note, actor, createdAt }`

---

### 8.11 Reviews

**Base path**: `/api/reviews`

#### `POST /api/reviews`
Submit a review (created in PENDING status).

**Auth**: CUSTOMER / ADMIN  
**Request body**:
```json
{
  "productId": 10,
  "rating": 5,
  "title": "Absolutely stunning!",
  "comment": "The roses were fresh and beautifully arranged."
}
```
**Response** `201 Created`: `ProductReview`

---

#### `POST /api/reviews/{reviewId}/moderate/{status}`
Moderate a review.

**Auth**: ADMIN  
**Path param** `status`: `APPROVED` | `REJECTED`  
**Response** `200 OK`: `ProductReview`

---

#### `DELETE /api/reviews/{reviewId}`
Delete a review.

**Auth**: ADMIN  
**Response**: `204 No Content`

---

#### `GET /api/reviews/product/{productId}`
List APPROVED reviews for a product (public).

**Auth**: Public  
**Response** `200 OK`: `List<ProductReviewDetailView>`

---

#### `GET /api/reviews`
Paginated list of all APPROVED reviews across all products.

**Auth**: Public  
**Query params**: `q` (search), `page`, `size`  
**Response** `200 OK`: `Page<ProductReviewPublicView>`

---

#### `GET /api/reviews/admin`
Admin: Search all reviews.

**Auth**: ADMIN  
**Query params**: `status` (PENDING | APPROVED | REJECTED), `concernFlag` (boolean), `page`, `size`  
**Response** `200 OK`: `Page<ProductReview>`

---

#### `GET /api/reviews/{reviewId}`
Get review detail (owner or admin).

**Auth**: CUSTOMER (own) / ADMIN  
**Response** `200 OK`: `ProductReviewDetailView`

---

#### Review Images

**`POST /api/reviews/{reviewId}/images/upload`** — Upload image (multipart). CUSTOMER/ADMIN.  
**`POST /api/reviews/images/presign`** — Get presigned URL for browser upload. CUSTOMER/ADMIN.  
**`GET /api/reviews/{reviewId}/images/{imageId}/inline`** — Stream image bytes. CUSTOMER/ADMIN.  
**`POST /api/reviews/images/tmp/delete`** — Delete unused temp upload. CUSTOMER/ADMIN.  
**`POST /api/reviews/{reviewId}/images/attach`** — Attach presigned image to review. CUSTOMER/ADMIN.  
**`POST /api/reviews/{reviewId}/images/reorder`** — Reorder images (list of imageIds). CUSTOMER/ADMIN.  
**`DELETE /api/reviews/{reviewId}/images/{imageId}`** — Delete image. CUSTOMER/ADMIN.

---

### 8.12 Customers & Addresses

**Base path**: `/api/customers`

#### `POST /api/customers`
Admin: Create a customer.

**Auth**: ADMIN  
**Request body**: `CustomerDto` (name, email, phone, password)  
**Response** `201 Created`: `Customer`

---

#### `PATCH /api/customers/{customerId}`
Update customer profile.

**Auth**: CUSTOMER (own) / ADMIN  
**Request body**: `CustomerDto` (partial update)  
**Response** `200 OK`: `Customer`

---

#### `GET /api/customers/{customerId}`
Get customer.

**Auth**: CUSTOMER (own) / ADMIN  
**Response** `200 OK`: `Customer`

---

#### `GET /api/customers`
List all customers.

**Auth**: ADMIN  
**Response** `200 OK`: `List<Customer>`

---

#### Addresses

**`POST /api/customers/{customerId}/addresses`**  
Add address.  
**Auth**: CUSTOMER / ADMIN  
**Request body**:
```json
{
  "name": "Jane Doe",
  "phone": "+919876543210",
  "line1": "12 Rose Street",
  "line2": "Apt 3B",
  "districtId": 101,
  "stateId": 10,
  "countryId": 1
}
```
**Response** `201 Created`: `AddressView`

**`PATCH /api/customers/addresses/{addressId}`** — Update address. CUSTOMER/ADMIN.  
**`GET /api/customers/{customerId}/addresses`** — List addresses. CUSTOMER/ADMIN.  
**`POST /api/customers/addresses/{addressId}/set-default`** — Set as default. CUSTOMER/ADMIN.  
**`DELETE /api/customers/addresses/{addressId}`** — Soft-delete address. CUSTOMER/ADMIN.

---

### 8.13 Promotions (Coupons)

**Base path**: `/api/promotions`

#### `GET /api/promotions/coupons/{code}`
Get an active coupon by code.

**Auth**: Public  
**Response** `200 OK`: `CouponDto`

---

#### `POST /api/promotions/coupons/{code}/preview`
Preview the discount for a given cart.

**Auth**: Public  
**Request body**:
```json
{
  "orderTotal": 2499.00,
  "itemCount": 3
}
```
**Response** `200 OK`:
```json
{
  "discountAmount": 249.90,
  "discountedTotal": 2249.10
}
```

---

#### `POST /api/promotions/coupons/{code}/apply`
Apply coupon to an order (records redemption).

**Auth**: ADMIN  
**Request body**:
```json
{ "orderId": 55, "customerId": 1 }
```
**Response** `200 OK`: `CouponRedemption`

---

#### `POST /api/promotions/redemptions/{redemptionId}/revoke`
Revoke a coupon redemption.

**Auth**: ADMIN  
**Response**: `204 No Content`

---

#### Admin Coupon Management

**`GET /api/promotions/admin/coupons`** — List all. ADMIN.  
**`GET /api/promotions/admin/coupons/{id}`** — Get by ID. ADMIN.  
**`POST /api/promotions/admin/coupons`** — Create coupon. ADMIN.  
**`PUT /api/promotions/admin/coupons/{id}`** — Update coupon. ADMIN.  
**`POST /api/promotions/admin/coupons/{id}/active`** — Toggle active flag. ADMIN.  
**`POST /api/promotions/admin/coupons/{id}/visible`** — Toggle visibility. ADMIN.

**Coupon DTO fields**:
```json
{
  "code": "BBNEW10",
  "type": "PERCENT",
  "amount": 10.00,
  "minOrderValue": 500.00,
  "minItems": 1,
  "startsAt": "2025-01-01T00:00:00Z",
  "endsAt": "2025-12-31T23:59:59Z",
  "usageLimit": 1000,
  "perCustomerLimit": 1,
  "active": true,
  "visible": true
}
```

---

### 8.14 Shipping

**Base path**: `/api/shipping`

#### `GET /api/shipping/quote`
Get shipping fee for a given cart/address.

**Auth**: Public  
**Query params**: `itemsSubtotal`, `stateId`, `districtId`, `deliveryPartnerId`  
**Response** `200 OK`:
```json
{ "fee": 99.00, "free": false }
```

---

#### `POST /api/shipping/preview`
Preview full shipping details (used at checkout).

**Auth**: Public  
**Request body**:
```json
{
  "itemsSubtotal": 1499.00,
  "stateId": 10,
  "districtId": 101,
  "deliveryPartnerId": 2
}
```
**Response** `200 OK**: `ShippingPreviewResponse`

---

### 8.15 Delivery Partners

**Base path**: `/api/partners`

**`POST /api/partners`** — Create partner. ADMIN.  
**`PATCH /api/partners/{id}`** — Update partner. ADMIN.  
**`GET /api/partners/{id}`** — Get by ID. ADMIN.  
**`GET /api/partners/by-code/{code}`** — Get by code. Public.  
**`GET /api/partners/by-slug/{slug}`** — Get by slug. Public.  
**`GET /api/partners`** — List all. ADMIN.  
**`GET /api/partners/active`** — List active partners. Public.  
**`GET /api/partners/visible`** — List customer-visible partners. Public.  
**`POST /api/partners/{id}/active/{active}`** — Toggle active (`true`/`false`). ADMIN.  
**`POST /api/partners/{id}/visible/{visible}`** — Toggle visible. ADMIN.

**DeliveryPartner DTO fields**:
```json
{
  "name": "DHL",
  "code": "dhl",
  "description": "International courier",
  "logoUrl": "https://...",
  "trackingUrlPattern": "https://dhl.com/track?id={}",
  "fixedFee": 199.00,
  "active": true,
  "visible": true
}
```

---

### 8.16 Settings

**Base path**: `/api/settings`

#### `POST /api/settings`
Create or update a setting.

**Auth**: ADMIN  
**Request body**:
```json
{ "key": "shipping.free_threshold", "value": "500" }
```
**Response** `200 OK`: `Setting`

---

#### `GET /api/settings/{key}`
Get a setting by key.

**Auth**: Public — **except for credential keys**, which return `404` to non-admins
**Response** `200 OK`:
```json
{ "key": "shipping.free_threshold", "value": "500" }
```

This endpoint is intentionally anonymous: the storefront reads individual keys before any login —
`brand.whatsapp` for the WhatsApp FAB, `shipping.free_threshold` and `ui.topbanner_coupon` for the
top banner. Requiring ADMIN here breaks the public site, so secrets are protected **per key**
instead (see below). Non-admins get `404` rather than `403` so the endpoint cannot be used to
enumerate which secrets exist.

---

#### `GET /api/settings`
List active settings.

**Auth**: Public, but credential keys are **omitted** for non-admins and **masked** for admins
**Response** `200 OK`: `List<SettingView>`

---

#### Secret handling

A key is treated as a credential when it contains any of: `access_token`, `verify_token`,
`auth_token`, `authkey`, `auth_key`, `api_key`, `apikey`, `secret`, `password`, `private_key`,
`credential`. Pattern-matched rather than allow-listed, so a newly added secret is protected by
default instead of leaking until someone updates a list.

| Caller | `GET /api/settings/{key}` | `GET /api/settings` |
|---|---|---|
| Anonymous / customer | `404` for secret keys | Secret keys omitted entirely |
| ADMIN | Full value | Secret keys present, value replaced with `********` |

Because the admin UI receives secrets masked, `POST /api/settings` **ignores** a write whose value
is exactly `********` for a secret key — otherwise saving an untouched row would overwrite the real
credential with the mask and silently break sending.

> **History**: `GET /api/settings/**` is `permitAll()` in `SecurityConfig` and the method-level
> `@PreAuthorize` on the read endpoints had been commented out, so the bulk endpoint returned the
> WhatsApp access token and webhook verify token to unauthenticated callers. The per-key filtering
> above replaced that. Method security still applies under `permitAll()` — the filter chain only
> decides whether the request reaches the controller.

---

#### `DELETE /api/settings/{key}`
Soft-delete a setting.

**Auth**: ADMIN  
**Response**: `204 No Content`

---

#### Feature Images

**`PUT /api/settings/admin/feature-images/order`** — Reorder feature images. ADMIN.  
**`PATCH /api/settings/admin/feature-images/meta`** — Update alt text / sort order per image. ADMIN.  
**`GET /api/settings/ui/feature-images`** — Get feature images for UI. Public.

---

### 8.17 Search

**Base path**: `/api/search`

#### `GET /api/search/products`
Search products.

**Auth**: Public  
**Query params**:
- `q` — keyword
- `categoryId` — filter by category
- `priceMin`, `priceMax` — price range filter
- `page`, `size`

**Response** `200 OK`: `Page<ProductListItemDto>`

---

#### `GET /api/search/categories`
Search categories by name.

**Auth**: Public  
**Query params**: `q`, `page`, `size`  
**Response** `200 OK`: `Page<CategoryDto>`

---

### 8.18 CMS Pages

**Base path**: `/api/cms`

**`POST /api/cms/pages`** — Create page. ADMIN.  
**`PATCH /api/cms/pages/{pageId}`** — Update page (auto-creates revision). ADMIN.  
**`GET /api/cms/pages/by-slug/{slug}`** — Get by slug. Public.  
**`GET /api/cms/pages`** — List all pages. Public.  
**`GET /api/cms/pages/{pageId}/revisions`** — List revision history. ADMIN.  
**`DELETE /api/cms/pages/{pageId}`** — Soft-delete page. ADMIN.

**CmsPage DTO fields**:
```json
{
  "slug": "terms-of-service",
  "title": "Terms of Service",
  "content": "<h1>Terms...</h1>",
  "metaDescription": "Our terms of service"
}
```

---

### 8.19 Admin Metrics

**Base path**: `/api/admin/metrics`

**All endpoints require ADMIN auth.**

#### `GET /api/admin/metrics/summary`
```json
{
  "totalOrders": 250,
  "totalRevenue": 375000.00,
  "totalCustomers": 180,
  "totalReviews": 95
}
```

#### `GET /api/admin/metrics/trend`
**Query params**: `range` — `daily` | `weekly` | `monthly`  
**Response**: `List<{ label, orderCount, revenue }>`

#### `GET /api/admin/metrics/shipping/12m`
Orders by delivery partner over 12 months.  
**Response**: `List<{ label, value }>`

#### `GET /api/admin/metrics/customers/12m`
New customer registrations per month over 12 months.  
**Response**: `List<{ label, value }>`

#### `GET /api/admin/metrics/top-products`
**Query params**: `range`, `limit` (default 10)  
**Response**: `List<{ label, value }>` (product name, order count)

#### `GET /api/admin/metrics/top-categories`
**Query params**: `range`, `limit`  
**Response**: `List<{ label, value }>`

---

### 8.20 Razorpay Payments

**Base path**: `/api/payments/razorpay`

#### `GET /api/payments/razorpay/config`
Get Razorpay public key for the frontend.

**Auth**: Public  
**Response** `200 OK`:
```json
{ "keyId": "rzp_live_XXXXXXXX" }
```

---

#### `POST /api/payments/razorpay/orders/{orderId}`
Create (or retrieve) a Razorpay order for an existing BB order.

**Auth**: ADMIN / CUSTOMER  
**Response** `200 OK`: Razorpay order object (raw JSON from Razorpay API)

---

### 8.21 WhatsApp Admin & Webhooks

**Base path**: `/api/admin/whatsapp` (Admin), `/api/admin/whatsapp/preferences` (Admin),
and `/api/webhooks/whatsapp` (Webhooks)

#### `GET /api/admin/whatsapp/integration-status`
Reports whether the Meta Cloud integration is configured — **booleans only, never credential values**.

**Auth**: ADMIN
**Response**:
```json
{
  "cloudEnabled": true,
  "apiVersion": "v25.0",
  "phoneNumberIdConfigured": true,
  "businessAccountIdConfigured": true,
  "accessTokenConfigured": true,
  "verifyTokenConfigured": true,
  "readyForLive": true
}
```
`cloudEnabled: false` means the app is in **dry-run mode**: template sends are logged and return a
synthetic `DRY_RUN_*` message id instead of calling Meta.

---

#### `GET /api/admin/whatsapp/templates`
List active WhatsApp templates.

**Auth**: ADMIN  
**Response**: `List<TemplateResponse>`

---

#### `GET /api/admin/whatsapp/campaigns`
List all campaigns.

**Auth**: ADMIN  
**Response**: `List<CampaignResponse>`

---

#### `POST /api/admin/whatsapp/campaigns`
Create a campaign in `DRAFT` status and resolve its recipients. **Sends nothing.**

**Auth**: ADMIN
**Request body**:
```json
{
  "title": "Diwali 2026",
  "templateId": 1,
  "audienceType": "ALL_OPTED_IN",
  "link": "https://www.blossom-buds-floral-artistry.com/categories",
  "offerText": "20% off",
  "imageUrl": "https://…/api/public/whatsapp-campaign/abc.jpg",
  "notes": "internal only",
  "alsoEmailPhoneless": false,
  "recipients": [{ "name": "Priya", "phone": "918123456789" }]
}
```

| Field | Notes |
|---|---|
| `audienceType` | `MANUAL`, `ALL_OPTED_IN`, or `EXPO_CONTACTS`. Defaults to `ALL_OPTED_IN` |
| `recipients` | Required **only** when `audienceType` is `MANUAL` |
| `imageUrl` | Required for templates with an image header (see §12) |
| `alsoEmailPhoneless` | Only valid with `ALL_OPTED_IN`; rejected otherwise |

**Audience resolution**
- `MANUAL` — the supplied recipient list; a single-number test send.
- `ALL_OPTED_IN` — every `customer_whatsapp_preferences` row with `opted_in = true AND active = true`. Real customer names are looked up for template personalisation.
- `EXPO_CONTACTS` — every `whatsapp_contacts` row with `opted_in = true AND active = true`, **skipping** anyone whose last 10 digits match a registered customer.

**Template–audience pairing is enforced**: `expo_outreach` / `expo_outreach_v2` may only target
`EXPO_CONTACTS`; every other marketing template may only target `ALL_OPTED_IN`. `MANUAL` is always
allowed. A mismatch returns `400`.

**Response** `200 OK`: `CampaignResponse`

---

#### `POST /api/admin/whatsapp/campaigns/{campaignId}/send`
Send to all recipients still in `PENDING`.

**Auth**: ADMIN
**Response** `200 OK`: `CampaignResponse`

Behaviour worth knowing before calling it:

- **Synchronous.** The request blocks for the whole send loop — one Meta call per recipient with no
  pacing delay. The admin HTTP client times out at 120 s while the server keeps sending, so a
  large audience surfaces as a client error even though delivery succeeds. Refresh rather than retry.
- **Not re-entrant.** A campaign already in `SENDING` rejects a second call with `400`.
- **One-shot.** Final status is `COMPLETED` (all sent), `PARTIAL` (some failed) or `FAILED` (none
  sent). All three disable further sends — failed recipients need a new campaign.
- **`alsoEmailPhoneless`** additionally creates *and sends* a matching email campaign to customers
  with no phone on file, storing its id in `linkedEmailCampaignId`. This happens **regardless of
  dry-run mode** — email has no dry-run gate. Failures are logged, not surfaced.
- Crash recovery: rows left in `SENDING` are reset to `PENDING` on next startup.

---

#### `GET /api/admin/whatsapp/contacts`
List active expo / externally-sourced contacts.

**Auth**: ADMIN  **Response**: `List<WhatsAppContact>`

---

#### `POST /api/admin/whatsapp/contacts/import`
Bulk-import leads. Normalises to E.164, skips registered customers and existing active contacts,
and **re-opts-in** any previously opted-out contact.

**Auth**: ADMIN
**Request body**:
```json
{ "source": "EXPO_JUN_2026", "contacts": [{ "phone": "9876543210", "name": "Priya" }] }
```
**Response**: `{ "imported": 12, "skippedRegistered": 3, "skippedDuplicate": 1, "reactivated": 2 }`

---

#### `DELETE /api/admin/whatsapp/contacts/{id}`
Opt a contact out (sets `opted_in=false`, `active=false`, stamps `opted_out_at`).

**Auth**: ADMIN  **Response**: `204 No Content`

---

#### `POST /api/admin/whatsapp/upload-image`
Upload a campaign header image to R2 and return a stable public URL for Meta to fetch.

**Auth**: ADMIN  **Content-Type**: `multipart/form-data` (field `file`)
**Constraints**: JPEG or PNG only (WebP rejected), max 5 MB
**Response**: `{ "url": "https://…/api/public/whatsapp-campaign/<uuid>.jpg" }`

---

#### `GET /api/admin/whatsapp/consent-migration/eligible-count`
Count customers eligible for the one-time pre-feature consent migration. Read-only.

**Auth**: ADMIN  **Response**: `{ "eligible": 42 }`

---

#### `POST /api/admin/whatsapp/consent-migration/run`
Opt in customers who registered before the WhatsApp CRM existed and were never asked, and email
each the policy-update notice. Only touches customers with **no** preference row, so it never
overwrites a choice a customer made, and is safe to re-run.

**Auth**: ADMIN
**Response**: `{ "eligible": 42, "optedIn": 42, "emailFailed": 1, "noEmailOnFile": 3 }`

`noEmailOnFile` are customers opted in but **not notified** — no address to send to.

> **Policy date**: the notice email states the terms take effect on the date in
> `MarketingConsentMigrationService.POLICY_EFFECTIVE_DATE` (currently **22 August 2026**), but the
> service records consent immediately. Nothing in code blocks an earlier send — do not run an
> `ALL_OPTED_IN` campaign before that date.

---

#### `GET /api/admin/whatsapp/preferences`
List WhatsApp/SMS opt-in preference rows.

**Auth**: ADMIN  **Response**: `List<WhatsAppPreference>`

> Returns all **active** rows, which is a superset of the `ALL_OPTED_IN` audience: opting out from
> the profile page clears `opted_in` but leaves `active = true`. Only a `STOP` reply clears both.

---

#### `POST /api/admin/whatsapp/preferences/manual`
Add a manual opt-in (used to register a test number).

**Auth**: ADMIN  **Request body**: `{ "phone": "918123456789", "customerId": 12 }`

---

#### `DELETE /api/admin/whatsapp/preferences/{id}`
Disable a preference row.

**Auth**: ADMIN  **Response**: `204 No Content`

---

#### `GET /api/admin/whatsapp/campaigns/{campaignId}/recipients`
List campaign recipients with send status.

**Auth**: ADMIN  
**Response**: `List<RecipientResponse>`

---

#### `GET /api/webhooks/whatsapp`
Meta webhook hub verification (hub challenge).

**Auth**: Public (verified by `hub.verify_token`)  
**Query params**: `hub.mode`, `hub.verify_token`, `hub.challenge`  
**Response**: Challenge string (if verified) or `403 Forbidden`

---

#### `POST /api/webhooks/whatsapp`
Receive incoming WhatsApp webhook events.

**Auth**: Public (Meta signs the request)  
**Request body**: Meta webhook JSON payload  
**Response**: `"EVENT_RECEIVED"` (always 200; events processed asynchronously)

Every payload is persisted raw to `whatsapp_message_events` before parsing, then two things happen:

**Delivery statuses** advance the matching recipient by `providerMessageId`:
`sent → SENT`, `delivered → DELIVERED`, `read → READ`, `failed → FAILED` (with the Meta error
message). Campaign counters are then recomputed from the recipient rows, where
`sentCount = SENT + DELIVERED + READ` — a recipient that has been delivered is still counted as sent.

**Inbound messages** are handled as follows:
- Body exactly `STOP` (case-insensitive) → opt the sender out of **both** `customer_whatsapp_preferences`
  and `whatsapp_contacts` (trying the number with and without a leading `+`, since the two tables
  store different formats), then reply with an unsubscribe confirmation.
- Anything else → a canned auto-reply pointing at the `brand.whatsapp` support number,
  rate-limited to one per number per 5 minutes, and suppressed for the app's own number to prevent
  reply loops.

Both outbound replies are deferred to `afterCommit` so the DB connection is released before the
HTTP call to Meta.

---

### 8.22 Email Marketing (Admin)

**Base path**: `/api/admin/email-marketing` — all endpoints **ADMIN**

The email channel is the fallback for customers unreachable on WhatsApp/SMS. Unlike WhatsApp
campaigns there is **no audience picker**: the audience is a fixed rule — active customers with
**no phone number on file**, an email address, and not unsubscribed.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/campaigns` | List campaigns, newest first |
| `POST` | `/campaigns` | Create a draft and resolve recipients |
| `POST` | `/campaigns/{campaignId}/send` | Send to all `PENDING` recipients |
| `GET` | `/campaigns/{campaignId}/recipients` | Per-recipient delivery status |

**Create body**: `{ "title": "…", "subject": "…", "bodyText": "…" }`

`bodyText` supports inline markers rendered into HTML: `{{A|label|url}}` for a link and
`{{IMG|url}}` for an image. An unsubscribe footer is appended per recipient automatically.

Sending is paced at 250 ms between messages and uses the same crash-recovery and
`COMPLETED`/`PARTIAL`/`FAILED` semantics as WhatsApp campaigns.

---

#### `GET /api/public/email-preference/unsubscribe?token=…`

One-click unsubscribe target embedded in every marketing email footer. Unauthenticated — it is
reachable through the existing `GET /api/public/**` permitAll rule, and the opaque `token` (stored
as `customer_email_preferences.unsubscribe_token`) identifies the recipient.

Sets `unsubscribed = true` and stamps `unsubscribed_at`, then returns a small self-contained
**HTML page** (not JSON) confirming the result. An unknown token renders "This unsubscribe link is
invalid or has expired" rather than erroring. Already-unsubscribed recipients are idempotent.

Order and account emails are unaffected — this only suppresses marketing.

---

### 8.23 Customer Communication Preferences

**Base path**: `/api/customers/{customerId}/communication-preference`

| Method | Auth | Purpose |
|---|---|---|
| `GET` | CUSTOMER/ADMIN | Current WhatsApp + SMS opt-in state |
| `PUT` | CUSTOMER/ADMIN | Update either or both channels |

One row per customer covers both channels. Ownership is enforced — a customer may only read or
write their own row; admins bypass.

**PUT body**: `{ "phone": "9876543210", "whatsappOptedIn": true, "smsOptedIn": false, "source": "PROFILE" }`

A `null` channel field means "no change". Opting in requires a phone number: if neither the request
nor the stored row has one (e.g. a Google OAuth signup), the call returns `400` with
*"Add a phone number to your profile before enabling WhatsApp or SMS updates"*. Phone numbers are
normalised to E.164 on write.

These are the endpoints behind the **Notification Preferences** toggles on the customer profile page.

---

### 8.24 Delivery Regions & Shipping Rules (Admin)

| Base path | Endpoints | Purpose |
|---|---|---|
| `/api/admin/shipping/regions` | 9 | CRUD for delivery regions and their state membership |
| `/api/admin/shipping/rules` | 4 | CRUD for the hierarchical `delivery_fee_rules` |

All **ADMIN**. Backed by `delivery_regions`, `delivery_region_states`, `delivery_fee_rules` and
`state_partner_allowlist` (migrations `0042`–`0046`).

---

## 9. Domain Model (Entities)

All entities in `bb_app` schema. All include audit columns (`created_by`, `created_at`, `modified_by`, `modified_at`) and `active` flag (soft-delete).

### Customer
| Column | Type | Notes |
|---|---|---|
| `id` | BIGSERIAL | PK |
| `name` | VARCHAR(150) | |
| `email` | VARCHAR(320) | UNIQUE, nullable |
| `phone` | VARCHAR(20) | UNIQUE, nullable |
| `password_hash` | VARCHAR(255) | Bcrypt |
| `email_verified` | BOOLEAN | |
| `phone_verified` | BOOLEAN | |
| `google_subject` | VARCHAR(255) | UNIQUE, Google OAuth sub |
| `google_email` | VARCHAR(320) | |

### Product
| Column | Type | Notes |
|---|---|---|
| `id` | BIGSERIAL | PK |
| `slug` | VARCHAR(200) | UNIQUE |
| `name` | VARCHAR(200) | |
| `description` | TEXT | |
| `price` | NUMERIC(12,2) | |
| `active` | BOOLEAN | Soft-delete |
| `visible` | BOOLEAN | Hide from storefront |
| `featured` | BOOLEAN | |
| `featured_rank` | INT | Sort order in featured list |
| `in_stock` | BOOLEAN | |
| `exclude_from_global_discount` | BOOLEAN | |

### Order
| Column | Type | Notes |
|---|---|---|
| `id` | BIGSERIAL | PK |
| `public_code` | CHAR(6) | UNIQUE, e.g., `250001` |
| `customer_id` | BIGINT | FK → customers |
| `status` | order_status_enum | ORDERED / DISPATCHED / DELIVERED / CANCELLED / REFUNDED / RETURNED_REFUNDED |
| `items_subtotal` | NUMERIC(12,2) | |
| `shipping_fee` | NUMERIC(12,2) | |
| `discount_total` | NUMERIC(12,2) | |
| `grand_total` | NUMERIC(12,2) | |
| `currency` | CHAR(3) | Default INR |
| `taxable_amount` | NUMERIC(12,2) | For GST |
| `gst_rate` | NUMERIC(5,2) | Percentage |
| `gst_amount` | NUMERIC(12,2) | |
| `delivery_partner_id` | BIGINT | FK → delivery_partners |
| `tracking_number` | VARCHAR(80) | |
| `tracking_url` | TEXT | |
| `rzp_order_id` | VARCHAR(100) | |
| `rzp_payment_id` | VARCHAR(100) | |
| `ship_name` .. `ship_country` | VARCHAR | Address snapshot |
| `paid_at` | TIMESTAMPTZ | |
| `dispatched_at` | TIMESTAMPTZ | |
| `delivered_at` | TIMESTAMPTZ | |

### OrderItem
| Column | Type | Notes |
|---|---|---|
| `order_id` | BIGINT | FK |
| `product_id` | BIGINT | FK |
| `product_name` | VARCHAR(200) | Snapshot |
| `product_price` | NUMERIC(12,2) | Snapshot |
| `quantity` | INT | |
| `selected_options` | JSONB | e.g., `{"Color":"Red"}` |
| `line_total` | NUMERIC(12,2) | |

### CheckoutIntent
| Column | Type | Notes |
|---|---|---|
| `rzp_order_id` | VARCHAR(100) | Razorpay order ID |
| `status` | VARCHAR(20) | PENDING / CONVERTED / EXPIRED |
| `order_draft_json` | TEXT | Serialised order DTO |
| `items_json` | TEXT | Serialised items list |
| `reminder_count` | INT | 0, 1, or 2 |
| `reminder_sent_at` | TIMESTAMPTZ | Last reminder time |

### Coupon
| Column | Type | Notes |
|---|---|---|
| `code` | VARCHAR(40) | UNIQUE |
| `type` | VARCHAR(10) | PERCENT / FLAT |
| `amount` | NUMERIC(12,2) | Discount value |
| `min_order_value` | NUMERIC(12,2) | |
| `min_items` | INT | |
| `starts_at` / `ends_at` | TIMESTAMPTZ | Validity window |
| `usage_limit` | INT | Total redemptions allowed |
| `per_customer_limit` | INT | Per-customer max |
| `visible` | BOOLEAN | Customer-visible |

### GlobalSaleConfig
| Column | Type | Notes |
|---|---|---|
| `enabled` | BOOLEAN | |
| `percent_off` | NUMERIC(5,2) | e.g., 15.00 |
| `label` | VARCHAR(255) | Display name |
| `starts_at` / `ends_at` | TIMESTAMPTZ | |

**Constraint**: Only one `enabled = true` record within any overlapping date range.

### DeliveryFeeRule
| Column | Type | Notes |
|---|---|---|
| `delivery_partner_id` | BIGINT | FK, nullable |
| `state_id` | BIGINT | FK, nullable |
| `district_id` | BIGINT | FK, nullable |
| `fee` | NUMERIC(12,2) | |
| `priority` | INT | Higher = more specific |

**Lookup logic**: Find the rule with the highest `priority` that matches the order's district/state. If none match, use the default rule (no state/district).

---

### Messaging & Marketing Entities

| Entity | Table | Purpose |
|---|---|---|
| `CustomerWhatsAppPreference` | `customer_whatsapp_preferences` | One row per customer covering **both** WhatsApp and SMS consent. `opted_in` drives the `ALL_OPTED_IN` audience; `active` is cleared only by a `STOP` reply |
| `WhatsAppContact` | `whatsapp_contacts` | Expo / externally-sourced leads with no customer account. E.164 phone, `source` batch label |
| `WhatsAppTemplate` | `whatsapp_templates` | Meta-approved templates. `category` (`MARKETING`/`TRANSACTIONAL`) gates which appear in the campaign picker |
| `WhatsAppCampaign` | `whatsapp_campaigns` | Campaign header: `audienceType`, `status`, counters, `alsoEmailPhoneless`, `linkedEmailCampaignId` |
| `WhatsAppCampaignRecipient` | `whatsapp_campaign_recipients` | Per-recipient state, `providerMessageId` (the Meta `wamid`), error text, and `variablesJson` |
| `WhatsAppMessageEvent` | `whatsapp_message_events` | Raw webhook audit log — every payload stored before parsing |
| `CustomerEmailPreference` | `customer_email_preferences` | Marketing-email unsubscribe state |
| `EmailCampaign` | `email_campaigns` | Email campaign header: subject, body, counters |
| `EmailCampaignRecipient` | `email_campaign_recipients` | Per-recipient email delivery status |
| `PaymentReminder` | `payment_reminders` | Abandoned-checkout reminder audit trail |

**`variablesJson` format** — despite the name this is not JSON. It is a flat
`key=value;key=value` string (`name`, `link`, `orderCode`, `trackingNumber`, `trackingLink`,
`paymentLink`, `offerText`, `imageUrl`). Values are escaped on write (`\` → `\\`, `;` → `\s`,
`=` → `\e`) and unescaped on read, so an offer text containing a semicolon survives round-tripping.

### Delivery & Geography Entities

| Entity | Table |
|---|---|
| `DeliveryRegion` | `delivery_regions` |
| `StatePartnerAllowlist` | `state_partner_allowlist` |
| `RazorpayWebhookInbox` | `razorpay_webhook_inbox` |
| `AuthOtpToken` | `auth_otp_tokens` |
| `BackInStockRequest` | `back_in_stock_requests` |
| `CartSuggestionProduct` | `cart_suggestion_products` |

---

## 10. Service Layer

| Service | Key Responsibilities |
|---|---|
| `CatalogService` | Product/category CRUD, image upload/signing, Redis cache management, back-in-stock tracking |
| `OrderService` | Order lifecycle, public code generation, event logging, status transitions |
| `CustomerAuthService` | Registration, email/phone verification, password reset, Google OAuth |
| `CustomerService` | Profile CRUD, address management, ownership checks |
| `CheckoutService` | Razorpay order creation, WhatsApp URL generation, cart validation, discount calculation |
| `PromotionService` | Coupon CRUD, validation (date/usage/per-customer), discount preview, redemption management |
| `GlobalSaleConfigService` | Global discount CRUD, overlap validation, effective window query |
| `ReviewService` | Review submission, moderation, image upload/streaming |
| `PaymentReminderJob` | Scheduled: detect abandoned checkouts, send reminders via WhatsApp + email + SMS |
| `WhatsAppCloudClient` | Meta Cloud API HTTP client, template message send, webhook verification |
| `WhatsAppCampaignService` | Campaign creation, recipient seeding, bulk send, status tracking |
| `RazorpayService` | Razorpay order creation, signature verification, webhook processing |
| `DeliveryFeeRulesService` | Hierarchical fee lookup (district → state → default), free shipping check |
| `AdminMetricsService` | Aggregate queries for dashboard summary, trends, top products/categories |
| `EmailService` / `SmtpEmailService` | Email sending (Resend HTTP or Zoho SMTP), HTML template rendering |
| `SmsService` / `SmsServiceStub` | SMS sending — currently stub (logs only) |
| `CmsService` | CMS page CRUD, auto-revision on content change |
| `SettingsService` | KV settings CRUD, cache |
| `PrintService` | PDF generation (invoice, packing slip) via OpenPDF with QR codes |
| `FileImageService` | ImageMagick normalisation, CloudFlare R2 upload/delete, presigned URL generation |
| `SearchService` | Full-text product/category search with filtering |

---

## 11. Scheduled Jobs

### PaymentReminderJob

**Class**: `com.blossombuds.service.PaymentReminderJob`  
**Schedule**: Fixed delay — runs every **15 minutes**; initial delay of **3 minutes** after startup.  
**Controlled by**: `whatsapp.payment_reminder.enabled` setting (if `false`, job exits immediately).

**Logic**:
1. Query `checkout_intents` where `status = 'PENDING'` and `created_at < (now - delay_minutes)`.
2. For each intent:
   - If `reminder_count >= 2`, skip (max reached).
   - If `reminder_sent_at` is within the last 6 hours, skip (cooldown).
   - Send reminder via WhatsApp template, email, and SMS.
   - Increment `reminder_count`, set `reminder_sent_at = now`.
3. Mark intents older than 48 hours as `EXPIRED`.

**WhatsApp template variables**: `payment_pending_reminder` → `[name, orderCode, paymentLink]`

---

### CheckoutReconciliationService

**Class**: `com.blossombuds.service.payments.CheckoutReconciliationService`
**Schedule**: Fixed delay — every **5 minutes**.

`reconcilePendingIntents()` — reconciles pending checkout intents against Razorpay so a payment
that succeeded at the gateway but whose callback never arrived is still recovered.

Two settings bound the window it looks at: `cutoff_at` (a lower bound; falls back to a default and
logs a warning if missing or unparseable) and `max_age_hours` (defaults to `24`). Intents outside
that window are skipped.

---

### RazorpayWebhookProcessorService

**Class**: `com.blossombuds.service.payments.RazorpayWebhookProcessorService`
**Schedule**: Fixed delay — every **15 seconds**.

Drains the `razorpay_webhook_inbox` table. Webhooks are persisted on receipt and processed out of
band, so a slow handler can never cause Razorpay to time out and retry.

---

### Startup recovery (not scheduled)

`WhatsAppCampaignService` and `EmailCampaignService` both listen for `ApplicationReadyEvent` and
reset campaigns stranded in `SENDING` by a crash or restart: recipients go back to `PENDING` for
retry, and the campaign is marked `FAILED`.

> These run on `ApplicationReadyEvent` rather than `@PostConstruct` deliberately — Spring's
> transactional proxy does not exist during bean initialisation, so `@Transactional` on a
> `@PostConstruct` method is silently inert.

---

## 12. External Integrations

### Razorpay

| Item | Value |
|---|---|
| API Base | `https://api.razorpay.com/v1` |
| Auth | HTTP Basic (`key-id` : `key-secret`) |
| Order creation endpoint | `POST /orders` |
| Webhook events handled | `payment.authorized`, `payment.failed`, `payment.captured` |
| Signature verification | HMAC-SHA256 of `rzp_order_id|rzp_payment_id` |
| Config keys | `app.razorpay.key-id`, `app.razorpay.key-secret`, `app.razorpay.webhook-secret-test` |

**Webhook flow**: Meta sends POST to `/api/webhooks/razorpay` → stored in `razorpay_webhook_inbox` → `RazorpayWebhookProcessorService` processes asynchronously.

---

### Meta WhatsApp Cloud API

| Item | Value |
|---|---|
| API Endpoint | `https://graph.facebook.com/{apiVersion}/{phoneNumberId}/messages` |
| Auth | `Authorization: Bearer <access-token>` |
| HTTP timeouts | 10 s connect / 30 s read |

**Configuration lives in the `settings` database table, not in properties files.** All keys are
read at call time via `SettingsService`, so changing one takes effect without a redeploy:

| Setting key | Purpose |
|---|---|
| `whatsapp.cloud.enabled` | `"true"` = live. Anything else = **dry-run** (nothing sent; returns a `DRY_RUN_*` id that still counts as success) |
| `whatsapp.cloud.api_version` | Graph API version; defaults to `v25.0` |
| `whatsapp.cloud.phone_number_id` | Sending number id |
| `whatsapp.cloud.business_account_id` | WABA id |
| `whatsapp.cloud.access_token` | Bearer token — **secret** |
| `whatsapp.cloud.verify_token` | Webhook hub verification — **secret** |
| `whatsapp.cloud.own_phone_number` | Used to suppress auto-replies to itself |
| `brand.whatsapp` | Public support number used in auto-reply text |

> Keys matching a credential pattern (`access_token`, `verify_token`, `secret`, `apikey`, …) are
> filtered from `GET /api/settings` for non-admins and masked for admins — see §8.16.

**Message types used**: `template` (pre-approved, with variable substitution) and `text`
(auto-replies and unsubscribe confirmations only).

There are **two separate sets of templates**, and only the first has rows in the database:

**1. Rows in `whatsapp_templates`** (seeded by migrations `0033`, `0035`, `0041`, `0048`). These
populate the admin campaign picker and are sent through `WhatsAppCampaignService`, whose
`buildTemplateVariables` fixes the variable order per template name:

| Template | Category | Header | Body variables |
|---|---|---|---|
| `new_arrivals_campaign` | MARKETING | Image (required) | `[name, link]` |
| `festival_offers` | MARKETING | Image (required) | `[name, offerText]` |
| `expo_outreach` | MARKETING | Image (required) | `[name, offerText]` |
| `expo_outreach_v2` | MARKETING | Image (required) | `[name, offerText]` — body ends "Reply STOP to unsubscribe" |
| `order_confirmation` | UTILITY | — | `[name, orderCode]` |
| `order_dispatched` | UTILITY | — | `[name, orderCode, trackingNumber, trackingLink]` |
| `payment_pending_reminder` | UTILITY | — | `[name, orderCode, paymentLink]` |

The admin picker filters on `category === "MARKETING"`, so the three `UTILITY` rows never appear
there — they exist in the table for reference only and are sent by code paths, not by an operator.

**2. Names hardcoded in `WhatsAppTransactionalServiceImpl`**, sent straight to Meta on order events
from `OrderService`. These do **not** go through `whatsapp_templates` and need no database row:

| Template | Body variables | Seed row | Trigger |
|---|---|---|---|
| `order_confirmation` | `[name, orderCode]` | Yes | `OrderService.createOrderAsPaid` and `createOrderWithItems` |
| `order_dispatched` | `[name, orderCode, trackingNumber, trackingUrl]` | Yes | Status change to `DISPATCHED` **and** a tracking URL is present |
| `order_delivered` | `[name, orderCode, reviewUrl]` | **No seed row** | Status change to `DELIVERED` |

`order_delivered` is approved in Meta and works in production despite having no row in
`whatsapp_templates` — confirming that the transactional path never consults that table. The row
matters only for the admin UI, so the table is a reference catalogue, not the source of truth.

All three are `@Async("mailExecutor")` and dispatched via `runAfterCommit`, so a messaging failure
can never roll back the order. All three no-op silently when the customer has no phone number.

> **Every payment path reaches `createOrderAsPaid`** — the Razorpay callback
> (`RazorpayController`), the shared finalizer (`CheckoutFinalizeService`), and the 5-minute
> reconciliation job, which calls `finalizeCapturedPayment` rather than creating orders itself.
> So a missing order confirmation is not a missed code path; look at Meta instead. The failure is
> logged as `[WHATSAPP][TXN] order_confirmation failed for orderCode=… : <Meta error>`.

> **`festival_offers` takes no link variable.** The admin form still shows a "Marketing link" field,
> but migration `0047` dropped the third body variable to match Meta's approval, so the link is
> **not** sent in the WhatsApp message — it is only used in the linked email campaign's
> "Shop now" button. Put the URL in the offer text if WhatsApp recipients need it.

Only `MARKETING` templates appear in the admin campaign picker; transactional ones are sent
automatically by `WhatsAppTransactionalService` on order events.

---

#### Delivery statuses and failure codes

A successful send returns a `wamid` and sets the recipient to `SENT`. **That only means Meta
accepted the request** — it says nothing about delivery. Everything after that arrives by webhook:
`SENT → DELIVERED → READ`, or `FAILED` with a reason.

If the webhook subscription is broken, recipients stay on `SENT` forever and failures are
completely invisible, which reads in the admin UI as a campaign that succeeded. Verify with:

```sql
SELECT event_type, max(received_at) FROM whatsapp_message_events GROUP BY event_type;
```

No recent rows means no callbacks are arriving — see the webhook troubleshooting note below.

| Code | Meaning | What to do |
|---|---|---|
| **131049** | *"This message was not delivered to maintain healthy ecosystem engagement."* Meta's per-recipient **marketing** frequency cap — accepted, then deliberately not delivered | Not a defect. Affects `MARKETING` templates to users who haven't engaged. Get the recipient to message the business first (opens a 24-hour service window), reduce marketing frequency, and keep order updates on `UTILITY` templates |
| 131047 | Re-engagement required — outside the 24-hour window | Use an approved template, or wait for an inbound message |
| 131026 | Message undeliverable — recipient not on WhatsApp, or number invalid | Clean the contact list |
| 132001 | Template name/language does not exist | Check the exact name and language (`en` vs `en_US`) in WhatsApp Manager |
| 132000 | Parameter count mismatch | The `{{n}}` count in Meta's body must equal what `buildTemplateVariables` sends |
| 132015 / 132016 | Template paused or disabled for quality | Check the template's quality rating |
| 133010 | Template not approved yet | Wait for approval |
| 190 | Access token expired or invalid | Rotate `whatsapp.cloud.access_token` |

**Expo campaigns will see high 131049 rates regardless of consent.** Expo contacts give their
numbers voluntarily at events, asking for product updates — that consent is genuine and is what
keeps the business compliant with Meta's Business Messaging policy. But 131049 does not measure
consent. Meta cannot see a form signed at a stall; it evaluates engagement *on WhatsApp*: whether
the recipient has ever messaged this business number, how much marketing they have received
recently across all businesses, and the sender's quality rating. A first marketing template to a
number with no interaction history is throttled whether or not permission was given.

The way through is to make the contact message the business first. Any inbound message opens a
24-hour service window and establishes the engagement signal, so a click-to-WhatsApp link or QR
code at the event (`https://wa.me/<number>?text=...`) converts far better than importing numbers
and sending templates at them — and it produces a timestamped, WhatsApp-native consent record as
a side effect.

`UTILITY` templates such as `order_confirmation` and `order_delivered` are not subject to this cap,
which is why transactional messages keep working while marketing campaigns are throttled.

#### Webhook troubleshooting

Two *separate* subscriptions are required, and losing either silently stops all status callbacks:

1. **App ↔ WABA subscription** — check with
   `GET https://graph.facebook.com/v25.0/{WABA_ID}/subscribed_apps`.
   An empty `data: []` means it is gone; re-subscribe by POSTing to the same URL.
2. **Webhook field subscription** — App Dashboard → WhatsApp → Configuration → Webhook fields →
   `messages`. In Cloud API this single field carries both inbound messages *and* delivery statuses.

Webhook config lives in the **Meta App Dashboard** (`developers.facebook.com`), **not** WhatsApp
Manager — a common source of confusion.

Verify the endpoint itself with the same request Meta makes (URL-encode the token; a `#` in it will
otherwise truncate the query string):

```
GET /api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=<token>&hub.challenge=test123
```

It must echo `test123`.

> **Known incident (27 June – 8 Aug 2026)**: the app lost its WABA subscription and no webhook was
> received for six weeks. Every campaign in that period shows `SENT` with zero failures — those
> counters are unreliable, not evidence of successful delivery. The webhook controller previously
> let a database error escape as a 500; Meta disables a callback that repeatedly errors, which is
> the most likely cause. It now always returns 200 and logs the failure instead.

---

### MSG91 (SMS)

| Item | Value |
|---|---|
| API Endpoint | `https://api.msg91.com/api/v5/flow/` |
| Auth | `authkey` header, from the `MSG91_AUTHKEY` environment variable |
| Sender ID | `BLSMBD` (`msg91.sender`) |

Sends use MSG91 **Flows**: each message type maps to a flow id passed as `flow_id`, with variables
supplied as a map. The ids are compile-time constants in `SmsServiceImpl`, not settings — changing
one requires a code change and redeploy:

| Method | Flow id constant |
|---|---|
| `sendSignupOtp` | `TMPL_SIGNUP_OTP` |
| `sendPasswordResetOtp` | `TMPL_PASSWORD_RESET_OTP` |
| `sendLoginOtp` | `TMPL_LOGIN_OTP` |
| `sendOrderConfirmation` | `TMPL_ORDER_CONFIRMED` |
| `sendOrderDispatched` | `TMPL_ORDER_DISPATCHED` |
| `sendOrderDelivered` | `TMPL_ORDER_DELIVERED` |

If `MSG91_AUTHKEY` is unset, `send()` logs a warning and returns without calling MSG91 — SMS is
skipped silently rather than failing the surrounding operation. The same is true for a blank phone
number. `SmsServiceStub` exists in the source tree but carries no `@Service` annotation, so it is
never wired as a bean.

---

### CloudFlare R2 (Image Storage)

| Item | Value |
|---|---|
| Protocol | S3-compatible (AWS SDK) |
| Bucket | `product-images` |
| Endpoint | `https://<account-id>.r2.cloudflarestorage.com` |
| Region | `auto` |
| Image normalisation | All uploads converted to JPEG via ImageMagick before storing |
| Presigned URL TTL | 15 minutes |
| Config keys | `cloudflare.r2.access-key`, `cloudflare.r2.secret-key`, `cloudflare.r2.bucket`, `cloudflare.r2.endpoint` |

**Upload flow**:
1. Server receives image bytes (multipart or presigned).
2. ImageMagick converts to JPEG.
3. Stored in R2 under `product-images/<uuid>.jpg`.
4. Signed URL generated and returned to client.

---

### Email — Resend (Production)

| Item | Value |
|---|---|
| API URL | `https://api.resend.com/emails` |
| Auth | `Authorization: Bearer <api-key>` |
| From address | `no-reply@blossom-buds-floral-artistry.com` |
| Config keys | `app.mail.apiUrl`, `app.mail.apiKey` |

**Emails sent**:
- Email verification OTP
- Password reset OTP
- Payment pending reminder
- Order dispatched (tracking email)
- Back-in-stock notification

---

### Email — Zoho SMTP (Local Dev)

| Item | Value |
|---|---|
| Host | `smtp.zoho.eu:587` |
| Auth | Username/password |
| From | `no-reply@blossom-buds-floral-artistry.com` |

---

### Google OAuth2

| Item | Value |
|---|---|
| Scopes | `openid profile email` |
| Flow | Frontend receives Google ID token → POST to `/api/customers/auth/google-login` → server validates token → returns BB JWT |
| Account linking | Match by `google_subject` (sub claim); if new, check email match against existing customers |
| Config keys | `spring.security.oauth2.client.registration.google.client-id`, `.client-secret` |

---

### ImageMagick

- Used for: JPEG normalisation, HEIC→JPEG conversion, resize/compress.
- Invoked via `im4java` Java wrapper.
- Must be installed locally; production path configured via `app.imagemagick.cmd`.

---

## 13. Frontend Architecture

### Routing

All routes are defined in `src/app/routes.tsx`. Storefront routes render inside `AppLayout`; admin
routes sit behind `AdminGuard` and render inside `AdminLayout`.

| Path | Page | Auth |
|---|---|---|
| `/` | HomePage | Public |
| `/categories` | ShopCategoriesPage | Public |
| `/categories/:id` | ShopCategoriesPage | Public |
| `/featured` | FeaturedPage | Public |
| `/cart` | CartPage | Public |
| `/checkout` | CheckoutPage | CUSTOMER |
| `/payment-processing` | PaymentProcessingPage | CUSTOMER |
| `/profile` | ProfilePage | CUSTOMER |
| `/reviews` | CustomerReviewsPage | Public |
| `/contact` | ContactPage | Public |
| `/pages/:slug` | CmsPage | Public |
| `/policies` | PoliciesIndexPage | Public |
| `/policies/:slug` | PolicyPage | Public |
| `/login` | LoginPage | Public |
| `/register` | RegisterPage | Public |
| `/verify` | VerifyPage | Public |
| `/verify-email` | VerifyPage | Public |
| `/oauth2/redirect` | OAuth2RedirectHandler | Public |
| `/forgot-password` | ForgotPasswordPage | Public |
| `/reset-password` | ResetPasswordPage | Public |
| `*` | NotFoundPage | Public |
| `/admin/login` | AdminLoginPage | Public |
| `/admin` (index) | AdminDashboardPage | ADMIN |
| `/admin/products` | ProductsPage | ADMIN |
| `/admin/categories` | CategoriesPage | ADMIN |
| `/admin/orders` | OrdersPage | ADMIN |
| `/admin/orders/new` | CreateOrderPageAdmin | ADMIN |
| `/admin/customers` | CustomersPage | ADMIN |
| `/admin/reviews` | AdminReviewsPage | ADMIN |
| `/admin/whatsapp` | AdminWhatsAppPage | ADMIN |
| `/admin/email-marketing` | AdminEmailMarketingPage | ADMIN |
| `/admin/settings` | SettingsPage | ADMIN |

There is no `/admin/promotions` route. Several admin features have **no route of their own** and are
rendered as components inside `SettingsPage` instead:

| Component | Backing API client |
|---|---|
| `AdminCoupons` | `adminCoupons.ts` |
| `AdminDeliveryPartners` | `adminDeliveryPartners.ts` |
| `AdminDeliveryRegions` | `adminDeliveryRegions.ts` |
| `AdminDeliveryFeeRules` | `adminShippingRules.ts`, `adminDeliveryRegions.ts` |

So `/admin/settings` is the entry point for coupons and the whole delivery/shipping configuration,
not just key-value settings. The `promotions.ts` and `partners.ts` API clients are currently
imported by nothing.

`/login` and `/register` are additionally registered as modal routes rendered over a background
location, so they can appear as overlays without navigating away from the current page.

Note there is no `/search` or `/products/:id` route: product detail and search results are surfaced
within `ShopCategoriesPage` rather than as standalone pages.

### State Management

| State | Mechanism | Storage |
|---|---|---|
| Customer auth | React Context (`AuthProvider`) | `localStorage` (JWT) |
| Admin auth | React Context (`AdminAuthProvider`) | `localStorage` (JWT) |
| Cart | React Context (`CartProvider`) | `localStorage` |
| Server data | TanStack Query | Memory (with background refresh) |

### API Client Pattern

Each API module (e.g., `api/catalog.ts`, `api/orders.ts`) exports typed async functions using Axios. Two interceptor instances are set up:
- `authFetch` — attaches customer JWT.
- `adminHttp` — attaches admin JWT; redirects to `/admin/login` on `401`.

---

## 14. Deployment

### Local

```bash
# Start DB (PostgreSQL + pgAdmin)
cd infra && docker-compose up -d

# Start API (port 8080)
cd blossombuds-api && ./mvnw spring-boot:run

# Start Frontend (port 5173)
cd blossombuds-frontend && npm run dev
```

### Production

> **Production is the only live environment.** `application-staging.properties` and the `_STG`
> variables exist in the repo but that environment is **not deployed or used** — treat the staging
> profile as unmaintained configuration, not a place to test. There is no test environment either;
> local development is the only pre-production surface.

| Component | Host | Notes |
|---|---|---|
| Database | **Supabase** | Pooler connection string, `DB_URL_PROD` |
| API | **Railway** | `SPRING_PROFILES_ACTIVE=prod`; public host `blossombuds-api-production.up.railway.app` |
| Redis | **Railway** | Provisioned alongside the API and reachable via `REDIS_URL`, but the application is currently configured **not to use it** — see §12 |
| Frontend | **Vercel** (`blossombuds-frontend/vercel.json` present, SPA rewrite to `index.html`) | Set `VITE_API_BASE_URL`. `VITE_API_BASE` and `VITE_API_URL` are accepted as fallbacks; if none are set the client uses the relative `/api`, which only works behind the dev proxy |
| Images | CloudFlare R2 | Same bucket; prod credentials |

**Java startup command**:
```
java -jar blossombuds-api.jar --spring.profiles.active=prod
```

**Liquibase**: Runs automatically on startup. Migrations are checksummed; do not modify committed migration files.

---

## 15. Key Dependency List

### Backend (`pom.xml`)
```
spring-boot-starter-web
spring-boot-starter-data-jpa
spring-boot-starter-security
spring-boot-starter-oauth2-client
spring-boot-starter-mail
spring-boot-starter-cache
spring-boot-starter-data-redis
org.postgresql:postgresql
org.liquibase:liquibase-core
io.jsonwebtoken:jjwt-api / jjwt-impl / jjwt-jackson
com.github.librepdf:openpdf
software.amazon.awssdk:s3 (or aws-java-sdk-s3)
org.im4java:im4java
org.springdoc:springdoc-openapi-starter-webmvc-ui
org.projectlombok:lombok
```

### Frontend (`package.json`)
```
react
react-dom
typescript
vite
@vitejs/plugin-react
axios
@tanstack/react-query
react-hook-form
tailwindcss
postcss
autoprefixer
```