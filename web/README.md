# ScreenCraft Landing Page

Landing Page für die ScreenCraft Screenshot/PDF API, implementiert mit Astro, React und Tailwind CSS.

## Quick Start

```bash
npm install
npm run dev
```

Landing Page: **http://localhost:4321**

Siehe `QUICKSTART.md` für detaillierte Setup-Anleitung.

## Struktur

```
web/
├── src/
│   ├── components/
│   │   ├── DemoWidget.tsx       # ⭐ Live Demo Widget (React)
│   │   ├── Hero.astro           # Hero Section mit Grid Background
│   │   ├── Features.astro       # 4 Feature Cards + Vergleichstabelle
│   │   ├── CodeExample.astro    # Code-Tabs + Live Demo Integration
│   │   ├── Pricing.astro        # 3 Pricing Tiers (Free, Pro, Business)
│   │   ├── FAQ.astro            # Accordion FAQ Section
│   │   └── Footer.astro         # Footer mit Final CTA
│   ├── layouts/
│   │   └── Layout.astro         # Haupt-Layout mit SEO Meta Tags
│   └── pages/
│       └── index.astro          # Landing Page
├── public/
│   └── grid.svg                 # ⭐ Subtiles Grid Pattern
├── astro.config.mjs             # Astro + React Integration
├── tailwind.config.mjs          # Tailwind CSS + Custom Animations
├── API_REQUIREMENTS.md          # ⭐ Backend API Spec
├── DEMO_WIDGET_SETUP.md         # ⭐ Detaillierte Dokumentation
└── QUICKSTART.md                # ⭐ Quick Setup Guide

```

## Design System

### Farben (GitHub Dark Theme)
- Background: `#0D1117`
- Surface: `#161B22`
- Border: `#30363D`
- Text Primary: `#F0F6FC`
- Text Secondary: `#8B949E`
- Accent Primary: `#238636` (Green)
- Accent Secondary: `#1F6FEB` (Blue)

### Typography
- Font Family: Inter (Sans), JetBrains Mono (Code)
- Text Scale: xs (12px) bis 6xl (60px)

### Spacing
- Konsistentes 4px Grid System
- Space-1 (4px) bis Space-24 (96px)

## Installation

```bash
cd web
npm install
```

## Development

```bash
npm run dev
```

Öffne http://localhost:4321 im Browser.

## Build

```bash
npm run build
```

Die statischen Dateien werden in `dist/` generiert.

## Features

- **Live Demo Widget** - Funktionsfähige Screenshot-Demo ohne Login
- Dark Theme (GitHub-inspired)
- Responsive Design (Mobile-First)
- React Integration für Interaktivität
- Interaktive Code-Tabs
- Accordion FAQ
- Smooth Scrolling & Animations
- Grid Background Pattern
- SEO-optimiert
- Performance-optimiert

## Komponenten Details

### DemoWidget.tsx (NEU)
- Live Screenshot-Generierung via API
- URL Input mit Validierung (HTTP/HTTPS)
- Format-Auswahl (PNG, JPEG, WebP)
- Viewport-Dimensionen (320-3840 x 240-2160)
- Loading States mit Spinner
- Live Preview mit Download-Button
- Error Handling & Rate Limit Info
- Vollständig Mobile Responsive

### Hero.astro
- Grid Background Pattern (grid.svg)
- Gradient Overlay für Tiefe
- Headline: "Ship Screenshots. Not Infrastructure."
- Subheadline mit Pain Points
- Primary & Secondary CTA Buttons
- Trust Bar mit Tech-Logos

### Features.astro
- 4 Feature Cards im 2x2 Grid
- SVG Icons (Camera, Document, Lightning, Code)
- Feature Highlights
- Vergleichstabelle (Us vs Others)

### CodeExample.astro
- Tab Navigation (cURL, Node.js, Python)
- Interaktive Tabs mit JavaScript
- Copy-to-Clipboard Button
- **Live Demo Widget Integration** (DemoWidget.tsx)

### Pricing.astro
- 3 Pricing Cards (Free, Pro $29, Business $99)
- Pro Tier als "MOST POPULAR" highlighted
- Feature Listen mit Checkmarks
- CTA Buttons pro Tier

### FAQ.astro
- 7 FAQs mit Accordion-Funktion
- Details/Summary HTML-Elemente
- Smooth expand/collapse Animation

### Footer.astro
- Final CTA Section (Green Gradient)
- 4 Column Footer Links
- Newsletter Signup
- Social Links
- Copyright

## Anpassungen

Design Tokens können in `tailwind.config.js` angepasst werden:
- Farben unter `theme.extend.colors`
- Typography unter `theme.extend.fontSize`
- Spacing unter `theme.extend.spacing`

## API Integration

Das Demo Widget benötigt einen Backend-Endpoint:

```
GET http://localhost:3000/v1/demo/screenshot?url=...&format=...&width=...&height=...
```

**Vollständige Spec:** Siehe `API_REQUIREMENTS.md`

### Backend Setup für andere Agenten:
1. Endpoint: `GET /v1/demo/screenshot`
2. Rate Limit: 10 requests/minute pro IP
3. Kein Auth required
4. CORS für localhost:4321 aktivieren

## Performance

- Astro für statisches HTML (schnell!)
- React nur für interaktive Komponenten (client:load)
- Minimale JavaScript-Bundle-Size
- Optimierte Fonts (Inter, JetBrains Mono)
- Mobile-First Responsive Design
- Lazy Loading für Images

## Deployment

### Development:
```bash
npm run dev  # localhost:4321
```

### Production Build:
```bash
npm run build  # Output: dist/
```

### Environment Variables:
```bash
PUBLIC_API_URL=https://api.screencraft.io  # Optional, default: localhost:3000
```
