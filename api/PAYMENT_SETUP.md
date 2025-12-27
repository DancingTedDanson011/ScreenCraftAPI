# Stripe Payment Integration - Setup Guide

## Overview

Die ScreenCraft API ist jetzt vollständig mit Stripe integriert für Subscription-basierte Zahlungen. Diese Integration unterstützt alle Subscription Tiers (PRO, BUSINESS, ENTERPRISE) mit automatischem Credit-Management und Webhook-basierter Event-Verarbeitung.

## Features

### Implementierte Funktionalität

- ✅ **Stripe Customer Management** - Automatische Erstellung und Verwaltung von Stripe Customers
- ✅ **Checkout Sessions** - Sichere Redirect zu Stripe Checkout für Subscription-Abschluss
- ✅ **Customer Portal** - Self-Service Portal für Subscription-Verwaltung
- ✅ **Webhook Events** - Automatische Synchronisation von Subscription-Status
- ✅ **Idempotenz** - Doppelte Webhook-Events werden automatisch erkannt
- ✅ **Subscription Lifecycle** - Created, Updated, Canceled, Payment Success/Failed
- ✅ **Tier Management** - Automatisches Credit-Reset bei Tier-Wechsel

### Unterstützte Tiers

| Tier | Preis/Monat | Credits | Stripe Price ID |
|------|-------------|---------|-----------------|
| FREE | $0 | 100 | - |
| PRO | $29 | 1,000 | `STRIPE_PRICE_PRO` |
| BUSINESS | $99 | 5,000 | `STRIPE_PRICE_BUSINESS` |
| ENTERPRISE | $499 | 25,000 | `STRIPE_PRICE_ENTERPRISE` |

## Setup Instructions

### 1. Stripe Account Setup

1. Erstelle einen Stripe Account: https://dashboard.stripe.com/register
2. Wechsel zu **Test Mode** (Toggle oben rechts)
3. Erstelle Products & Prices:
   - Navigate zu **Products** → **Add Product**
   - Erstelle 3 Products (PRO, BUSINESS, ENTERPRISE)
   - Füge jeweils einen **Recurring Price** hinzu (monthly)
   - Kopiere die **Price IDs** (beginnen mit `price_...`)

### 2. Environment Variables

Füge folgende Variablen zu deiner `.env` Datei hinzu:

```env
# Stripe API Keys (von https://dashboard.stripe.com/apikeys)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Stripe Price IDs (von deinen erstellten Products)
STRIPE_PRICE_PRO=price_1234567890_pro_monthly
STRIPE_PRICE_BUSINESS=price_1234567890_business_monthly
STRIPE_PRICE_ENTERPRISE=price_1234567890_enterprise_monthly

# Redirect URLs (Frontend URLs für Success/Cancel)
STRIPE_SUCCESS_URL=http://localhost:3000/billing/success
STRIPE_CANCEL_URL=http://localhost:3000/billing/cancel
```

### 3. Webhook Setup

#### Lokal testen mit Stripe CLI

```bash
# Install Stripe CLI
# Windows: scoop install stripe
# Mac: brew install stripe/stripe-cli/stripe

# Login to Stripe
stripe login

# Forward webhooks to local server
stripe listen --forward-to http://localhost:3000/v1/payment/webhooks/stripe

# Der CLI gibt dir ein webhook secret aus - füge es zu .env hinzu:
# STRIPE_WEBHOOK_SECRET=whsec_...
```

#### Production Webhook Setup

1. Gehe zu https://dashboard.stripe.com/webhooks
2. Klicke **Add endpoint**
3. Endpoint URL: `https://your-api-domain.com/v1/payment/webhooks/stripe`
4. **Events to send** wähle:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
   - `checkout.session.completed`
5. Kopiere das **Signing secret** und füge es als `STRIPE_WEBHOOK_SECRET` hinzu

### 4. Database Migration

Führe die Prisma Migration aus um die neuen Payment-Tabellen zu erstellen:

```bash
# Generate Prisma Client mit neuen Models
npm run prisma:generate

# Create migration
npx prisma migrate dev --name add_stripe_integration

# Apply migration
npm run prisma:migrate
```

### 5. Install Dependencies

```bash
npm install stripe
```

## API Endpoints

### Payment & Subscription Endpoints

#### POST `/v1/payment/checkout`
Erstelle eine Stripe Checkout Session für einen Tier-Upgrade.

**Request:**
```json
{
  "tier": "PRO"  // or "BUSINESS", "ENTERPRISE"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "url": "https://checkout.stripe.com/c/pay/cs_test_...",
    "sessionId": "cs_test_..."
  }
}
```

**Frontend Integration:**
```javascript
const response = await fetch('/v1/payment/checkout', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': 'your_api_key'
  },
  body: JSON.stringify({ tier: 'PRO' })
});

const { data } = await response.json();
// Redirect user to Stripe Checkout
window.location.href = data.url;
```

---

#### GET `/v1/payment/portal`
Erstelle eine Customer Portal Session für Subscription-Verwaltung.

**Response:**
```json
{
  "success": true,
  "data": {
    "url": "https://billing.stripe.com/p/session/..."
  }
}
```

**Frontend Integration:**
```javascript
const response = await fetch('/v1/payment/portal', {
  headers: { 'X-API-Key': 'your_api_key' }
});

const { data } = await response.json();
window.location.href = data.url;
```

---

#### GET `/v1/payment/subscription`
Aktuelle Subscription Details abrufen.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "sub_abc123",
    "tier": "PRO",
    "status": "ACTIVE",
    "currentPeriodStart": "2024-01-01T00:00:00.000Z",
    "currentPeriodEnd": "2024-02-01T00:00:00.000Z",
    "cancelAtPeriodEnd": false
  }
}
```

---

#### POST `/v1/payment/subscription/cancel`
Subscription kündigen.

**Request:**
```json
{
  "immediately": false  // true = sofort, false = am Ende der Periode
}
```

**Response:**
```json
{
  "success": true,
  "message": "Subscription will be canceled at the end of the billing period"
}
```

---

#### POST `/v1/payment/webhooks/stripe`
Stripe Webhook Endpoint (intern - nicht direkt aufrufen).

**Headers:**
- `stripe-signature`: Webhook signature für Verification

## Architecture

### File Structure

```
src/
├── config/
│   └── stripe.config.ts          # Stripe Konfiguration & Price IDs
├── services/
│   └── payment/
│       ├── stripe.service.ts     # Stripe API Wrapper
│       └── subscription.service.ts # Subscription Business Logic
├── controllers/
│   └── payment.controller.ts     # HTTP Request Handler
├── routes/
│   └── payment.routes.ts         # Route Definitions
└── middleware/
    └── raw-body.middleware.ts    # Raw Body für Webhook Verification

prisma/
└── schema.prisma                 # Updated mit Subscription Models
```

### Database Schema

#### Account (erweitert)
```prisma
model Account {
  stripeCustomerId String?        @unique
  subscriptions    Subscription[]
  // ... existing fields
}
```

#### Subscription (neu)
```prisma
model Subscription {
  id                   String              @id
  accountId            String
  stripeSubscriptionId String              @unique
  stripePriceId        String
  status               SubscriptionStatus
  tier                 Tier
  currentPeriodStart   DateTime
  currentPeriodEnd     DateTime
  cancelAtPeriodEnd    Boolean
  // ...
}
```

#### WebhookEvent (neu)
```prisma
model WebhookEvent {
  stripeEventId String   @unique
  eventType     String
  processed     Boolean
  payload       Json
  // ... für Idempotenz
}
```

## Workflow Diagramme

### Checkout Flow

```
User → Frontend → API /checkout
                    ↓
              Create Customer (if needed)
                    ↓
              Create Checkout Session
                    ↓
              Return Stripe URL
                    ↓
User → Stripe Checkout → Payment
                    ↓
         Webhook: checkout.session.completed
                    ↓
         Webhook: customer.subscription.created
                    ↓
         Update Account Tier & Credits
```

### Webhook Event Processing

```
Stripe → POST /webhooks/stripe
            ↓
    Verify Signature
            ↓
    Check Idempotency (WebhookEvent table)
            ↓
    Process Event:
    - subscription.created  → Sync Subscription, Update Tier
    - subscription.updated  → Sync Subscription
    - subscription.deleted  → Cancel Subscription, Downgrade to FREE
    - invoice.payment_succeeded → Update Subscription Status
    - invoice.payment_failed → Mark Subscription PAST_DUE
            ↓
    Mark Event as Processed
```

## Testing

### Test Mode

Stripe bietet Test Cards für verschiedene Szenarien:

| Card Number | Szenario |
|-------------|----------|
| `4242 4242 4242 4242` | Erfolgreiche Zahlung |
| `4000 0000 0000 0002` | Abgelehnte Karte |
| `4000 0000 0000 9995` | Insufficient funds |

**Expiry:** Beliebiges zukünftiges Datum
**CVC:** Beliebige 3 Ziffern
**ZIP:** Beliebige 5 Ziffern

### Webhook Testing mit Stripe CLI

```bash
# Trigger specific events
stripe trigger checkout.session.completed
stripe trigger customer.subscription.created
stripe trigger invoice.payment_succeeded
stripe trigger invoice.payment_failed

# View webhook logs
stripe logs tail
```

### Manual Testing Flow

1. **Create Checkout Session**
   ```bash
   curl -X POST http://localhost:3000/v1/payment/checkout \
     -H "Content-Type: application/json" \
     -H "X-API-Key: your_api_key" \
     -d '{"tier":"PRO"}'
   ```

2. **Visit Checkout URL** und complete payment mit Test Card

3. **Verify Subscription**
   ```bash
   curl http://localhost:3000/v1/payment/subscription \
     -H "X-API-Key: your_api_key"
   ```

4. **Open Customer Portal**
   ```bash
   curl http://localhost:3000/v1/payment/portal \
     -H "X-API-Key: your_api_key"
   ```

## Security Best Practices

### Webhook Verification
✅ Alle Webhooks werden mit `stripe.webhooks.constructEvent()` verifiziert
✅ Raw body parsing für korrekte Signature Verification
✅ Idempotenz durch `WebhookEvent` table

### API Security
✅ Authentication via API Key (existing middleware)
✅ Rate Limiting auf allen Endpoints
✅ HTTPS erforderlich in Production
✅ Customer Portal URLs sind single-use und expiren

### Data Protection
✅ Keine sensiblen Card-Daten werden gespeichert
✅ Stripe Customer IDs sind encrypted at rest (PostgreSQL SSL)
✅ Webhook Secrets in Environment Variables

## Production Checklist

- [ ] Stripe Account auf **Live Mode** schalten
- [ ] Live API Keys in `.env` setzen
- [ ] Production Webhook Endpoint registrieren
- [ ] SSL/TLS für API Domain aktivieren
- [ ] Webhook Secret rotieren (alle 90 Tage)
- [ ] Monitoring für Failed Webhooks einrichten
- [ ] Rate Limits für Payment Endpoints anpassen
- [ ] Backup-Strategie für Subscription Daten
- [ ] Stripe Dashboard Notifications aktivieren
- [ ] PCI DSS Compliance Review

## Troubleshooting

### Webhook Events werden nicht verarbeitet

**Problem:** Events kommen an aber werden nicht processed.

**Lösung:**
1. Check `WebhookEvent` table für errors:
   ```sql
   SELECT * FROM webhook_events WHERE processed = false;
   ```
2. Check Server Logs für Event Processing Errors
3. Verify `STRIPE_WEBHOOK_SECRET` ist korrekt

### Subscription Status nicht synchronisiert

**Problem:** Stripe zeigt "active" aber DB zeigt andere Status.

**Lösung:**
```bash
# Force sync via API
curl http://localhost:3000/v1/payment/subscription \
  -H "X-API-Key: your_api_key"
```

Das löst ein `getSubscriptionWithSync()` aus der mit Stripe syncronisiert.

### Checkout Session expired

**Problem:** User bekommt "Session expired" Error.

**Lösung:** Checkout Sessions expiren nach 24h. Erstelle eine neue Session:
```javascript
// Frontend: Re-create checkout session on retry
```

## Support & Resources

- **Stripe Docs:** https://stripe.com/docs
- **Stripe Dashboard:** https://dashboard.stripe.com
- **Webhook Logs:** https://dashboard.stripe.com/webhooks
- **API Logs:** https://dashboard.stripe.com/logs
- **Test Mode:** https://dashboard.stripe.com/test

## Next Steps

### Empfohlene Erweiterungen

1. **Email Notifications**
   - Subscription Confirmation Email
   - Payment Failed Notifications
   - Cancellation Confirmations

2. **Analytics Integration**
   - Track Conversion Rates
   - Monitor Churn
   - Revenue Reporting

3. **Promo Codes**
   - Stripe Coupons Integration
   - Trial Periods
   - Referral Discounts

4. **Invoice Management**
   - Download Invoice PDFs
   - Invoice History
   - Custom Invoice Templates

5. **Usage-based Billing**
   - Metered Billing für Screenshot-Credits
   - Overage Charges
   - Pay-as-you-go Option

---

**Version:** 1.0.0
**Last Updated:** 2024-12-26
**Author:** ScreenCraft Team
