# Live Demo Widget - Setup Guide

## Installation

1. **Install Dependencies:**
   ```bash
   cd C:\Users\DancingTedDanson\Desktop\Projects\Agents_Project\web
   npm install
   ```

2. **Start Development Server:**
   ```bash
   npm run dev
   ```
   Landing Page läuft auf: http://localhost:4321

## Architektur

### Components
- **DemoWidget.tsx** - React component mit Live-Demo-Logik
  - Location: `src/components/DemoWidget.tsx`
  - Features: URL input, format selector, dimension controls, live preview, download

- **CodeExample.astro** - Integration des Demo Widgets
  - Location: `src/components/CodeExample.astro`
  - Zeigt Code-Beispiele + Live Demo

### Assets
- **grid.svg** - Subtiles Grid-Pattern für Hero Background
  - Location: `public/grid.svg`
  - Used in: Hero component

## API Integration

Das Widget verbindet sich mit:
```
http://localhost:3000/v1/demo/screenshot
```

### Environment Variables (optional)
Falls API auf anderer URL läuft:

Erstelle `.env`:
```
PUBLIC_API_URL=https://api.screencraft.io
```

Update DemoWidget usage in CodeExample.astro:
```astro
<DemoWidget client:load apiEndpoint={import.meta.env.PUBLIC_API_URL || 'http://localhost:3000'} />
```

## Features

### User Flow
1. User gibt URL ein (z.B. https://github.com)
2. Wählt Format (PNG/JPEG/WebP)
3. Setzt Viewport-Dimensionen
4. Klickt "Generate Screenshot"
5. Loading state mit Spinner
6. Preview + Metadata anzeigen
7. Download-Button für Screenshot

### Error Handling
- URL Validierung (nur http/https)
- Dimension Limits (320-3840 width, 240-2160 height)
- Rate Limit Warning
- Network Error Messages
- User-friendly error display

### Mobile Responsive
- Single column layout auf Mobile
- Touch-friendly buttons
- Responsive image preview
- Grid layout für Inputs

## Styling

### Theme Colors (GitHub Dark)
- Background: `#0D1117`, `#161B22`
- Borders: `#30363D`
- Text: `#F0F6FC` (primary), `#8B949E` (secondary)
- Accent: `#238636` (green), `#1F6FEB` (blue)
- Error: `#F85149`

### Animations
- Smooth transitions (200ms)
- Hover effects with glow
- Loading spinner
- Scale effect on image hover

## Testing

### Manual Testing Checklist
- [ ] Valid URL generates screenshot
- [ ] Invalid URL shows error
- [ ] Format selection works (PNG, JPEG, WebP)
- [ ] Dimension inputs validate correctly
- [ ] Loading state appears during generation
- [ ] Preview displays correctly
- [ ] Download button works
- [ ] Rate limit warning shows
- [ ] Mobile responsive
- [ ] Error messages clear and helpful

### Test URLs
```
https://github.com
https://tailwindcss.com
https://astro.build
https://react.dev
```

## Troubleshooting

### Widget not loading
- Check if React integration is installed: `@astrojs/react`
- Verify `client:load` directive in CodeExample.astro
- Check browser console for errors

### API connection fails
- Ensure backend is running on localhost:3000
- Check CORS configuration
- Verify endpoint path: `/v1/demo/screenshot`

### Images not displaying
- Check response format (JSON vs binary)
- Verify Content-Type headers
- Check browser Network tab for response

## Next Steps

1. Backend team implementiert `/v1/demo/screenshot` endpoint
2. Deploy Landing Page + API
3. Configure production API URL
4. Add analytics tracking
5. A/B test verschiedene default URLs
