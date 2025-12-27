# Admin Terminal (Overwatch)

Das Admin Terminal ermoeglicht die vollstaendige Verwaltung der ScreenCraft-Plattform.

## Features

- **Real-time Dashboard**: Live-Monitoring von Server, Browser-Pool und Job-Queues
- **User Management**: Accounts verwalten, Tiers aendern, Credits zuruecksetzen, Bans
- **API Key Management**: Alle API-Keys einsehen, revoken, reaktivieren
- **Job Queue**: Screenshots und PDFs ueberwachen, Jobs abbrechen/wiederholen
- **Audit Logs**: Alle Admin-Aktionen nachverfolgen

## Setup

### 1. Dependencies installieren

```bash
cd api
npm install
```

### 2. Environment konfigurieren

Fuege diese Variablen zu deiner `.env` hinzu:

```env
ADMIN_ENABLED=true
ADMIN_JWT_SECRET=dein_sicherer_geheimer_schluessel_min_32_zeichen
ADMIN_JWT_EXPIRES_IN=8h
```

### 3. Admin-User erstellen

```bash
npm run prisma:seed
```

Dies erstellt einen Admin-User:
- **Email**: admin@screencraft.dev
- **Password**: admin123

## API Endpoints

Alle Admin-Endpoints sind unter `/admin/api` verfuegbar.

### Authentication

| Endpoint | Method | Beschreibung |
|----------|--------|--------------|
| `/auth/login` | POST | Admin-Login |
| `/auth/logout` | POST | Admin-Logout |
| `/auth/me` | GET | Aktueller Admin |

### Metrics

| Endpoint | Method | Beschreibung |
|----------|--------|--------------|
| `/metrics/server` | GET | Server-Metriken |
| `/metrics/browser` | GET | Browser-Pool-Status |
| `/metrics/queue` | GET | Queue-Statistiken |
| `/metrics/overview` | GET | Alle Metriken kombiniert |

### Users

| Endpoint | Method | Beschreibung |
|----------|--------|--------------|
| `/users` | GET | User-Liste |
| `/users/:id` | GET | User-Details |
| `/users/:id/tier` | PATCH | Tier aendern |
| `/users/:id/ban` | POST | User bannen |
| `/users/:id/unban` | POST | User entbannen |

### API Keys

| Endpoint | Method | Beschreibung |
|----------|--------|--------------|
| `/api-keys` | GET | Alle API-Keys |
| `/api-keys/:id/revoke` | POST | Key revoken |
| `/api-keys/:id/reactivate` | POST | Key reaktivieren |

### Jobs

| Endpoint | Method | Beschreibung |
|----------|--------|--------------|
| `/jobs` | GET | Alle Jobs |
| `/jobs/:type/:id/cancel` | POST | Job abbrechen |
| `/jobs/:type/:id/retry` | POST | Job wiederholen |

### Logs

| Endpoint | Method | Beschreibung |
|----------|--------|--------------|
| `/logs/audit` | GET | Audit-Logs |
| `/logs/export` | GET | Logs exportieren |

## WebSocket

Real-time Updates unter `ws://localhost:3000/admin/ws?token=<jwt_token>`

Message Types:
- `metrics`: System-Metriken (alle 5 Sekunden)
- `alert`: Warnungen und Benachrichtigungen
- `job_update`: Job-Status-Updates
- `user_activity`: User-Aktivitaeten

## Frontend

Das Admin-Frontend ist unter `/admin` erreichbar:

- `/admin/login` - Login-Seite
- `/admin` - Dashboard
- `/admin/users` - User-Verwaltung
- `/admin/api-keys` - API-Key-Verwaltung
- `/admin/jobs` - Job-Queue
- `/admin/logs` - Audit-Logs

### Keyboard Shortcuts

| Taste | Aktion |
|-------|--------|
| `d` | Dashboard |
| `u` | Users |
| `k` | API Keys |
| `j` | Jobs |
| `l` | Logs |
| `r` | Refresh |
| `?` | Hilfe anzeigen |

## Rollen

| Rolle | Berechtigungen |
|-------|----------------|
| VIEWER | Nur lesender Zugriff |
| ADMIN | User verwalten, Jobs abbrechen |
| SUPER_ADMIN | Voller Zugriff inkl. Loeschen |

## Sicherheit

- JWT-basierte Authentifizierung
- Role-based Access Control (RBAC)
- Alle Aktionen werden im Audit-Log protokolliert
- Token-Validierung bei WebSocket-Verbindung
