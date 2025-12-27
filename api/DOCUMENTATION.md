# ScreenCraft API - Dokumentation

Vollständige API-Dokumentation für ScreenCraft Screenshot & PDF Generation Service.

## Dokumentations-Übersicht

Die API-Dokumentation ist jetzt vollständig verfügbar in verschiedenen Formaten:

### 1. Interaktive Swagger UI

Starte den Development-Server:

```bash
npm run dev
```

Öffne dann deinen Browser:
- **Swagger UI**: http://localhost:3000/docs
- Interaktive API-Dokumentation mit "Try it out" Funktionalität
- Alle Endpoints mit Request/Response-Beispielen

### 2. OpenAPI Spezifikation

Die vollständige OpenAPI 3.0 Spezifikation ist verfügbar unter:

- **YAML Format**: http://localhost:3000/openapi.yaml
- **JSON Format**: http://localhost:3000/openapi.json
- **Datei**: [docs/openapi.yaml](./docs/openapi.yaml)

Import diese Dateien in Tools wie:
- Postman (Import > OpenAPI)
- Insomnia (Import > From URL)
- VS Code REST Client Extensions
- Swagger Editor (https://editor.swagger.io)

### 3. Code-Beispiele

Vollständige, Copy-Paste-ready Beispiele für verschiedene Sprachen:

#### cURL Examples
- **Datei**: [docs/examples/curl-examples.md](./docs/examples/curl-examples.md)
- Alle Endpoints mit cURL-Befehlen
- Error Handling & Rate Limiting
- Batch Operations & Polling

#### Node.js/TypeScript Examples
- **Datei**: [docs/examples/nodejs-examples.md](./docs/examples/nodejs-examples.md)
- Vollständiger TypeScript Client mit Types
- Async/Await Patterns
- Webhook Handling (Express)
- Queue Integration (BullMQ)
- Testing (Jest)

#### Python Examples
- **Datei**: [docs/examples/python-examples.md](./docs/examples/python-examples.md)
- Vollständiger Python Client mit Dataclasses
- Sync & Async Clients (aiohttp)
- Webhook Handling (Flask)
- Django Integration
- Testing (pytest)

### 4. README

- **Datei**: [docs/README.md](./docs/README.md)
- Schnellstart-Guide
- Feature-Übersicht
- Best Practices
- Error Codes
- Common Use Cases

## Schnellstart

### 1. Dependencies installieren

```bash
npm install
```

### 2. Environment Variables

Erstelle `.env` Datei:

```env
NODE_ENV=development
PORT=3000
HOST=0.0.0.0

# Database
DATABASE_URL="postgresql://user:password@localhost:5432/screencraft"

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Storage (S3 or local)
STORAGE_TYPE=s3
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
S3_BUCKET=screencraft-uploads

# Rate Limiting
RATE_LIMIT_MAX=100
RATE_LIMIT_TIME_WINDOW=60000
```

### 3. Datenbank Setup

```bash
npm run prisma:migrate
npm run prisma:generate
```

### 4. Server starten

```bash
# Development
npm run dev

# Production
npm run build
npm start
```

### 5. Dokumentation aufrufen

Browser öffnen: http://localhost:3000/docs

## Verfügbare Endpoints

### Dokumentation

```
GET  /docs                - Swagger UI
GET  /openapi.json        - OpenAPI Spezifikation (JSON)
GET  /openapi.yaml        - OpenAPI Spezifikation (YAML)
```

### Health & Status

```
GET  /health              - API Health Check
```

### Screenshots (v1)

```
POST   /v1/screenshots                  - Screenshot erstellen
GET    /v1/screenshots                  - Screenshots auflisten
GET    /v1/screenshots/:id              - Screenshot Status
GET    /v1/screenshots/:id/download     - Screenshot herunterladen
DELETE /v1/screenshots/:id              - Screenshot löschen
```

### PDFs (v1)

```
POST   /v1/pdfs                         - PDF generieren
GET    /v1/pdfs                         - PDFs auflisten
GET    /v1/pdfs/:id                     - PDF Status
GET    /v1/pdfs/:id/download            - PDF herunterladen
DELETE /v1/pdfs/:id                     - PDF löschen
```

## Authentication

Alle API-Requests benötigen einen API Key im Header:

```
X-API-Key: your-api-key-here
```

Beispiel:

```bash
curl -H "X-API-Key: your-api-key" \
  http://localhost:3000/v1/screenshots
```

## Rate Limiting

- **Standard**: 100 Requests pro Minute pro API Key
- Rate Limit Info in Response Headers:
  - `X-RateLimit-Limit`: Maximum Requests
  - `X-RateLimit-Remaining`: Verbleibende Requests
  - `X-RateLimit-Reset`: Reset Zeitpunkt (ISO 8601)

## Testing mit Swagger UI

1. Öffne http://localhost:3000/docs
2. Klicke auf "Authorize" Button
3. Gib deinen API Key ein
4. Wähle einen Endpoint
5. Klicke "Try it out"
6. Fülle Request Body aus
7. Klicke "Execute"

## Testing mit cURL

Siehe [docs/examples/curl-examples.md](./docs/examples/curl-examples.md) für vollständige Beispiele.

Basis-Screenshot:

```bash
curl -X POST http://localhost:3000/v1/screenshots \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "url": "https://example.com",
    "format": "png"
  }'
```

## Testing mit Postman

1. Importiere OpenAPI Spezifikation:
   - File > Import > Link
   - URL: http://localhost:3000/openapi.json

2. Setze Environment Variable:
   - Key: `api_key`
   - Value: `your-api-key`

3. Teste Endpoints in Collection

## Testing mit VS Code REST Client

Installiere Extension: "REST Client" (humao.rest-client)

Erstelle `api.http` Datei:

```http
### Variables
@baseUrl = http://localhost:3000
@apiKey = your-api-key

### Health Check
GET {{baseUrl}}/health

### Create Screenshot
POST {{baseUrl}}/v1/screenshots
Content-Type: application/json
X-API-Key: {{apiKey}}

{
  "url": "https://example.com",
  "format": "png"
}

### List Screenshots
GET {{baseUrl}}/v1/screenshots
X-API-Key: {{apiKey}}
```

## Deployment

### Production Build

```bash
npm run build
```

### Environment für Production

```env
NODE_ENV=production
PORT=3000
HOST=0.0.0.0

# Swagger UI wird in Production NICHT geladen
# OpenAPI Endpoints bleiben verfügbar
```

### Docker

```bash
# Build
docker build -t screencraft-api .

# Run
docker run -p 3000:3000 --env-file .env screencraft-api
```

## OpenAPI Integration Tools

### Import in andere Tools

Die OpenAPI Spezifikation kann in viele Tools importiert werden:

1. **Postman**: Import > Link > http://localhost:3000/openapi.json
2. **Insomnia**: Import/Export > From URL > http://localhost:3000/openapi.json
3. **Swagger Editor**: https://editor.swagger.io > Import File
4. **Stoplight Studio**: Import > OpenAPI File
5. **RapidAPI**: Upload OpenAPI Specification

### Code Generation

Generiere Client-Code automatisch:

```bash
# Install OpenAPI Generator
npm install -g @openapitools/openapi-generator-cli

# Generate TypeScript Client
openapi-generator-cli generate \
  -i http://localhost:3000/openapi.json \
  -g typescript-axios \
  -o ./generated-client

# Generate Python Client
openapi-generator-cli generate \
  -i http://localhost:3000/openapi.json \
  -g python \
  -o ./generated-client-python
```

## Troubleshooting

### Swagger UI lädt nicht

- Stelle sicher, dass `NODE_ENV !== 'production'`
- Prüfe Browser Console auf Fehler
- Versuche http://localhost:3000/docs/json

### OpenAPI Spec lädt nicht

- Prüfe, dass `docs/openapi.yaml` existiert
- Validiere YAML Syntax: https://www.yamllint.com
- Prüfe Server Logs

### API Key funktioniert nicht

- Header muss exakt `X-API-Key` heißen (case-sensitive)
- Kein Präfix wie "Bearer" nötig
- Prüfe Rate Limits

## Support & Contribution

### Dokumentation verbessern

1. Fork Repository
2. Bearbeite Dateien in `docs/`
3. Update `docs/openapi.yaml` bei API-Änderungen
4. Submit Pull Request

### Fehler melden

- GitHub Issues: https://github.com/screencraft/api/issues
- Email: support@screencraft.com

## Weitere Ressourcen

- **OpenAPI Specification**: https://spec.openapis.org/oas/v3.0.3
- **Swagger UI**: https://swagger.io/tools/swagger-ui/
- **Fastify Documentation**: https://www.fastify.io/docs/latest/
- **Playwright Documentation**: https://playwright.dev/

## Changelog

### v1.0.0 (2025-12-26)

- Vollständige OpenAPI 3.0 Spezifikation
- Swagger UI Integration
- cURL, Node.js, Python Beispiele
- Interaktive Dokumentation
- JSON/YAML Export Endpoints
