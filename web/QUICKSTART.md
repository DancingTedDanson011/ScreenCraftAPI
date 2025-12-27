# ScreenCraft Landing Page - Quick Start

## Setup (5 Minuten)

### 1. Dependencies installieren
```bash
cd C:\Users\DancingTedDanson\Desktop\Projects\Agents_Project\web
npm install
```

### 2. Development Server starten
```bash
npm run dev
```

Landing Page läuft auf: **http://localhost:4321**

## Was ist neu?

### Live Demo Widget
Vollständig funktionsfähiges Demo-Widget im Code-Example-Abschnitt:

**Features:**
- URL Input mit Validierung
- Format-Auswahl (PNG, JPEG, WebP)
- Viewport-Dimensionen (Width/Height)
- Live Screenshot-Generierung
- Preview mit Download-Funktion
- Error Handling
- Loading States
- Mobile Responsive

**Location:** `src/components/DemoWidget.tsx`

### Neue Assets
- `public/grid.svg` - Subtiles Grid-Pattern für Hero Background

### Style Improvements
- Smooth Animations (fade-in, slide-up)
- Loading Spinner
- Hover Effects mit Glow
- Mobile-First Responsive Design

## Projekt-Struktur

```
web/
├── src/
│   ├── components/
│   │   ├── DemoWidget.tsx        ← Live Demo (React)
│   │   ├── CodeExample.astro     ← Code + Demo Integration
│   │   ├── Hero.astro            ← Hero mit Grid Background
│   │   ├── Features.astro
│   │   ├── Pricing.astro
│   │   ├── FAQ.astro
│   │   └── Footer.astro
│   ├── layouts/
│   │   └── Layout.astro
│   └── pages/
│       └── index.astro
├── public/
│   └── grid.svg                  ← Grid Pattern
├── astro.config.mjs              ← React Integration
├── tailwind.config.mjs           ← Custom Animations
├── package.json                  ← Dependencies
├── API_REQUIREMENTS.md           ← Backend Spec
└── DEMO_WIDGET_SETUP.md          ← Detaillierte Docs
```

## API Integration

Das Demo Widget erwartet einen Backend-Endpoint:

```
GET http://localhost:3000/v1/demo/screenshot
```

**Query Parameters:**
- `url` - Target URL
- `format` - png | jpeg | webp
- `width` - 320-3840
- `height` - 240-2160

**Siehe:** `API_REQUIREMENTS.md` für vollständige Spec

## Development Workflow

### Landing Page ändern
1. Komponenten in `src/components/` editieren
2. Hot-Reload erfolgt automatisch
3. Browser auf localhost:4321 aktualisiert sich

### Demo Widget testen
1. Backend muss auf localhost:3000 laufen
2. Widget verbindet automatisch mit API
3. Falls API nicht läuft: Error-Handling zeigt Meldung

### Build für Production
```bash
npm run build
```

Output in `dist/` folder.

## Browser-Support

- Chrome/Edge: Latest 2 versions
- Firefox: Latest 2 versions
- Safari: Latest 2 versions
- Mobile: iOS Safari, Chrome Mobile

## Nächste Schritte

### Backend Team:
1. Implementiere `/v1/demo/screenshot` endpoint
2. Siehe `API_REQUIREMENTS.md` für Spec
3. CORS konfigurieren für localhost:4321
4. Rate Limiting: 10 req/min pro IP

### Frontend Team:
1. Landing Page ist ready to use
2. Dependencies installieren: `npm install`
3. Server starten: `npm run dev`
4. Test mit Mock-API oder echtem Backend

### DevOps:
1. Docker-Setup vorhanden (Dockerfile)
2. Build: `npm run build`
3. Deploy `dist/` folder
4. Environment Variable: `PUBLIC_API_URL`

## Troubleshooting

### React not found
```bash
npm install react react-dom @astrojs/react
```

### Tailwind styles not loading
```bash
npm install -D @astrojs/tailwind tailwindcss
```

### Port 4321 already in use
```bash
# Kill process or use different port
npm run dev -- --port 3001
```

## Support

- Issues: GitHub Issues
- Docs: `DEMO_WIDGET_SETUP.md`
- API Spec: `API_REQUIREMENTS.md`
