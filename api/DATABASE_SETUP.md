# Database Setup Guide

## Overview
Die Datenbank ist vollständig mit Prisma integriert. Alle Controllers verwenden jetzt echte Database-Repositories statt Mock-Daten.

## Schema

### Models
- **Account**: Account-Management mit Tiers und Credits
- **ApiKey**: API-Schlüssel-Verwaltung
- **Screenshot**: Screenshot-Jobs mit allen Konfigurationen
- **Pdf**: PDF-Jobs mit allen Konfigurationen
- **UsageEvent**: Usage-Tracking für Billing

### Repositories
- `ScreenshotRepository`: CRUD für Screenshots
- `PdfRepository`: CRUD für PDFs
- `AccountRepository`: Account, API-Key und Quota-Management

## Migration durchführen

### 1. Database URL konfigurieren
Stelle sicher, dass `DATABASE_URL` in `.env` gesetzt ist:

```bash
DATABASE_URL="postgresql://user:password@localhost:5432/screencraft?schema=public"
```

### 2. Prisma Client generieren
```bash
npm run prisma:generate
```

### 3. Migration erstellen und ausführen
```bash
# Development Migration
npm run prisma:migrate:dev

# Production Migration
npm run prisma:migrate:deploy
```

### 4. (Optional) Database seeden
```bash
npm run prisma:seed
```

## Prisma Studio (GUI)
```bash
npm run prisma:studio
```

## Wichtige Änderungen

### Controller
- Alle Controller verwenden jetzt Repositories statt Mock-Maps
- `screenshotsDb` Map wurde entfernt → `screenshotRepository`
- `pdfsDb` Map wurde entfernt → `pdfRepository`

### Account-Integration
- Controllers holen `accountId` aus `request.auth` (Auth Middleware)
- Fallback auf `'default'` wenn keine Auth (sollte entfernt werden wenn Auth required)

### Storage Keys
- Screenshots: Nutzen `storageKey` Feld statt generiertem Key
- PDFs: Nutzen `storageKey` Feld statt generiertem Key

### Status Enums
Prisma verwendet UPPERCASE Enums:
- `PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`

API verwendet lowercase:
- `pending`, `processing`, `completed`, `failed`

Helper-Funktionen konvertieren zwischen beiden:
- `toScreenshotResponse()`
- `toPdfResponse()`

## Repository-Methoden

### ScreenshotRepository
```typescript
create(data: CreateScreenshotData): Promise<Screenshot>
findById(id: string): Promise<Screenshot | null>
findByAccountId(accountId: string, pagination): Promise<{data, total}>
updateStatus(id: string, data: UpdateScreenshotStatusData): Promise<Screenshot>
markAsProcessing(id: string): Promise<Screenshot>
markAsCompleted(id: string, downloadUrl, storageKey, fileSize): Promise<Screenshot>
markAsFailed(id: string, error: string): Promise<Screenshot>
delete(id: string): Promise<void>
countByStatus(accountId: string, status): Promise<number>
findPending(limit: number): Promise<Screenshot[]>
cleanupOld(daysOld: number): Promise<number>
```

### PdfRepository
```typescript
create(data: CreatePdfData): Promise<Pdf>
findById(id: string): Promise<Pdf | null>
findByAccountId(accountId: string, pagination): Promise<{data, total}>
updateStatus(id: string, data: UpdatePdfStatusData): Promise<Pdf>
markAsProcessing(id: string): Promise<Pdf>
markAsCompleted(id: string, downloadUrl, storageKey, fileSize, pages): Promise<Pdf>
markAsFailed(id: string, error: string): Promise<Pdf>
delete(id: string): Promise<void>
countByStatus(accountId: string, status): Promise<number>
findPending(limit: number): Promise<Pdf[]>
cleanupOld(daysOld: number): Promise<number>
```

### AccountRepository
```typescript
findByApiKey(hashedKey: string): Promise<Account | null>
findById(id: string): Promise<Account | null>
findByEmail(email: string): Promise<Account | null>
create(data: CreateAccountData): Promise<Account>
checkQuota(accountId: string, requiredCredits): Promise<QuotaCheckResult>
incrementUsage(accountId: string, credits: number): Promise<Account>
recordUsageEvent(data: UsageEventData): Promise<void>
createApiKey(accountId, hashedKey, prefix, name?): Promise<ApiKey>
revokeApiKey(keyId: string): Promise<ApiKey>
listApiKeys(accountId: string, includeRevoked?): Promise<ApiKey[]>
updateTier(accountId: string, tier, monthlyCredits): Promise<Account>
getUsageStats(accountId, startDate?, endDate?): Promise<Stats>
resetMonthlyQuotas(): Promise<number>
```

## Next Steps

### TODO: Auth Required
Entferne Fallbacks in Controllern:
```typescript
// VORHER (aktuell)
const accountId = request.auth?.accountId || 'default';

// NACHHER (wenn Auth Middleware required ist)
const accountId = request.auth!.accountId;
```

### TODO: Queue Workers
Queue Workers müssen auch auf Repositories umgestellt werden:
- Screenshot Worker: Nutze `screenshotRepository.markAsCompleted()` / `markAsFailed()`
- PDF Worker: Nutze `pdfRepository.markAsCompleted()` / `markAsFailed()`

### TODO: Cleanup Cron Jobs
Implementiere Cron Jobs für:
```typescript
// Alte Screenshots/PDFs löschen (z.B. nach 30 Tagen)
await screenshotRepository.cleanupOld(30);
await pdfRepository.cleanupOld(30);

// Monthly Quota Reset
await accountRepository.resetMonthlyQuotas();
```

## Troubleshooting

### Migration Fehler
```bash
# Reset Database (ACHTUNG: Löscht alle Daten!)
npm run prisma:migrate:reset

# Fresh Migration
npm run prisma:migrate:dev
```

### Prisma Client nicht gefunden
```bash
npm run prisma:generate
```

### Type Errors
Stelle sicher, dass `@prisma/client` installiert ist:
```bash
npm install @prisma/client
```
