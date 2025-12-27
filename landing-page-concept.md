# Screenshot/PDF API - Landing Page Konzept
## FunnelArchitect Blueprint v1.0

---

# PERSONA DEEP DIVE

## Primary Target: "The Pragmatic Builder"

**Demographics:**
- Age: 25-40
- Role: Full-Stack Developer, Technical Founder, Agency Tech Lead
- Company: Startup (5-50 employees) oder Freelance
- Income: $60k-150k/year
- Location: Global, English-speaking markets

**Psychographics:**
- Hasst es, das Rad neu zu erfinden
- Will fertige Loesungen, die "just work"
- Misstraut Marketing-Sprache zutiefst
- Entscheidet basierend auf: Dokumentation, Preis, Zuverlaessigkeit
- Liest Code-Beispiele BEVOR er Text liest

**Pain Points:**
1. "Puppeteer selbst hosten ist ein Alptraum"
2. "Headless Chrome frisst Server-Ressourcen"
3. "PDF-Generierung ist immer buggy"
4. "Bestehende APIs sind zu teuer oder zu langsam"

**Desires:**
1. API aufrufen, Screenshot bekommen - fertig
2. Keine Infrastruktur-Sorgen
3. Preisvorhersagbarkeit
4. Schnelle Integration (< 30 Minuten)

**Objections:**
1. "Ist das zuverlaessig genug fuer Production?"
2. "Was passiert bei Traffic-Spikes?"
3. "Wie ist der Support?"
4. "Kann ich das nicht selbst bauen?"

**Transformation Statement:**
"Von 'Ich muss schon wieder eine Screenshot-Loesung bauen' zu 'Ein API-Call und fertig'"

---

# SECTION 1: HERO

## Layout
Full-width, dark background, split layout (60% Text, 40% Visual)

## Headline (H1)
```
Ship Screenshots. Not Infrastructure.
```

**Psychology:**
- "Ship" = Developer-Sprache (sie shippen Features)
- Direkter Kontrast zwischen was sie WOLLEN (Screenshots) und was sie NICHT wollen (Infrastructure)
- Keine Buzzwords, pure Klarheit

## Subheadline (H2)
```
Pixel-perfect screenshots and PDFs via simple REST API.
No Puppeteer. No headless browsers. No DevOps headaches.
```

**Psychology:**
- Nennt die Pain Points direkt (Puppeteer, headless browsers)
- "DevOps headaches" = emotionale Resonanz
- "Pixel-perfect" = Qualitaetsversprechen

## CTA Buttons

**Primary CTA:**
```
[Get Free API Key]
```
- Color: Bright accent (Electric Blue #0066FF)
- Size: Large, prominent
- Psychology: "Free" eliminiert Risiko, "API Key" ist Developer-Sprache

**Secondary CTA:**
```
[View Documentation]
```
- Color: Ghost button (outline only)
- Psychology: Developer wollen IMMER erst die Docs sehen

## Hero Visual Concept

**Option A: Live Demo Widget**
```
+------------------------------------------+
|  URL: [https://example.com          ]    |
|                                          |
|  [Generate Screenshot]                   |
|                                          |
|  +----------------------------------+    |
|  |                                  |    |
|  |   [Live Preview erscheint hier] |    |
|  |                                  |    |
|  +----------------------------------+    |
|                                          |
|  Generated in 1.2s | 1920x1080 | PNG     |
+------------------------------------------+
```

**Option B: Code-to-Result Animation**
- Links: curl-Befehl wird getippt (Typewriter-Effekt)
- Rechts: Screenshot erscheint als Ergebnis
- Zeigt die Einfachheit in 3 Sekunden

**Empfehlung:** Option A (Interactive Demo) - hoechste Engagement-Rate

## Micro-Copy unter Hero
```
No credit card required | 100 free screenshots/month | Setup in 2 minutes
```

---

# SECTION 2: SOCIAL PROOF

## Strategie fuer Pre-Launch (ohne echte Kunden)

### 2.1 Technology Trust Bar
```
Built with technologies you trust:
[Node.js] [Puppeteer] [Chrome] [AWS] [Cloudflare]
```
**Psychology:** Zeigt technische Kompetenz ohne Kunden zu benoetigen

### 2.2 Integration Badges
```
Available on:
[RapidAPI] [Postman] [GitHub]
```
**Psychology:** Etablierte Plattformen = implizite Validierung

### 2.3 Stats Counter (Real-Time)
```
+------------------+------------------+------------------+
|    247,893       |      99.9%       |     <2s          |
| Screenshots      |    Uptime        |  Avg Response    |
|   generated      |   (30 days)      |    Time          |
+------------------+------------------+------------------+
```
**Psychology:** Echte Metriken, keine erfundenen Kundenzahlen

### 2.4 Security & Compliance
```
[SOC2 Ready] [GDPR Compliant] [SSL/TLS Encrypted] [No Data Storage]
```
**Psychology:** Enterprise-Bedenken praventiv adressieren

### 2.5 "As Seen In" Alternative
```
"Used by developers building:"
[SaaS Dashboards] [E-Commerce Reports] [Social Media Tools] [Testing Suites]
```
**Psychology:** Use-Cases statt Logos - funktioniert ohne Kunden

---

# SECTION 3: FEATURES

## Section Headline
```
Everything you need. Nothing you don't.
```

## Feature Grid (2x2)

### Feature 1: Screenshot Capture
**Icon:** Camera/Viewport Icon
**Title:** `Full-Page & Viewport Screenshots`
**Description:**
```
Capture any URL as PNG, JPEG, or WebP.
Full-page scrolling, custom viewports, or mobile emulation.
One endpoint. Infinite possibilities.
```
**Key Differentiator:** `Supports lazy-loaded content`

---

### Feature 2: PDF Generation
**Icon:** Document Icon
**Title:** `Print-Quality PDFs`
**Description:**
```
Generate PDFs from any URL or raw HTML.
Custom headers, footers, page sizes, and margins.
Perfect for invoices, reports, and documents.
```
**Key Differentiator:** `A4, Letter, Legal, or custom sizes`

---

### Feature 3: Speed & Reliability
**Icon:** Lightning Bolt
**Title:** `Sub-2-Second Response Times`
**Description:**
```
Global edge network with smart caching.
Auto-scaling infrastructure handles your traffic spikes.
99.9% uptime SLA on paid plans.
```
**Key Differentiator:** `No cold starts. Ever.`

---

### Feature 4: Developer Experience
**Icon:** Code Brackets
**Title:** `Built for Developers`
**Description:**
```
RESTful API with comprehensive documentation.
SDKs for Node.js, Python, PHP, and cURL.
Webhook support for async processing.
```
**Key Differentiator:** `Postman collection included`

---

## Feature Comparison Mini-Table
```
+---------------------------+--------+--------+
|                           |  Us    | Others |
+---------------------------+--------+--------+
| Free tier included        |   Yes  |  Maybe |
| No rate limiting on Pro   |   Yes  |   No   |
| Custom headers/cookies    |   Yes  |  $$$   |
| Priority support          |   Yes  |  Extra |
+---------------------------+--------+--------+
```

---

# SECTION 4: CODE EXAMPLE (Critical Section)

## Section Headline
```
From zero to screenshot in 3 lines of code
```

## Tab Navigation
```
[cURL] [Node.js] [Python] [PHP]
```

### cURL Example
```bash
curl -X POST "https://api.screencraft.io/v1/screenshot" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "format": "png",
    "viewport": { "width": 1920, "height": 1080 }
  }'
```

### Node.js Example
```javascript
const screenshot = await fetch('https://api.screencraft.io/v1/screenshot', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    url: 'https://example.com',
    format: 'png',
    viewport: { width: 1920, height: 1080 }
  })
});

const image = await screenshot.blob();
```

### Python Example
```python
import requests

response = requests.post(
    'https://api.screencraft.io/v1/screenshot',
    headers={'Authorization': 'Bearer YOUR_API_KEY'},
    json={
        'url': 'https://example.com',
        'format': 'png',
        'viewport': {'width': 1920, 'height': 1080}
    }
)

image = response.content
```

## Interactive Demo Box
```
+--------------------------------------------------+
|  TRY IT NOW (No signup required)                 |
|                                                  |
|  URL: [https://github.com                   ]    |
|                                                  |
|  Format: [PNG v]  Width: [1920]  Height: [1080] |
|                                                  |
|  [Generate Screenshot]                           |
|                                                  |
|  +--------------------------------------------+  |
|  |                                            |  |
|  |         [Preview appears here]             |  |
|  |                                            |  |
|  +--------------------------------------------+  |
|                                                  |
|  Response: 200 OK | Time: 1.34s | Size: 847KB   |
|  [Download PNG] [Copy cURL] [Get API Key]        |
+--------------------------------------------------+
```

**Psychology:**
- Kein Signup = Zero Friction
- Echtes Ergebnis = Vertrauen
- "Copy cURL" = Sofortige Integration moeglich

---

# SECTION 5: PRICING

## Section Headline
```
Simple pricing. No surprises.
```

## Subheadline
```
Start free. Scale when you're ready.
```

## Pricing Grid

### Free Tier
```
+--------------------------------+
|            FREE                |
|            $0/mo               |
|                                |
|  - 100 screenshots/month       |
|  - 50 PDFs/month               |
|  - Basic viewport sizes        |
|  - PNG & JPEG formats          |
|  - Community support           |
|  - 5 requests/minute           |
|                                |
|  [Get Started Free]            |
|                                |
|  No credit card required       |
+--------------------------------+
```

### Pro Tier (RECOMMENDED)
```
+--------------------------------+
|     MOST POPULAR               |
|            PRO                 |
|          $29/mo                |
|                                |
|  Everything in Free, plus:     |
|                                |
|  - 5,000 screenshots/month     |
|  - 2,500 PDFs/month            |
|  - All viewport sizes          |
|  - WebP format                 |
|  - Custom headers & cookies    |
|  - Webhook callbacks           |
|  - Email support (24h)         |
|  - 60 requests/minute          |
|                                |
|  [Start Pro Trial]             |
|                                |
|  14-day free trial             |
+--------------------------------+
```
**Visual:** Highlighted border, "MOST POPULAR" badge

### Business Tier
```
+--------------------------------+
|          BUSINESS              |
|           $99/mo               |
|                                |
|  Everything in Pro, plus:      |
|                                |
|  - 25,000 screenshots/month    |
|  - 10,000 PDFs/month           |
|  - Custom CSS injection        |
|  - JavaScript execution        |
|  - Block ads & popups          |
|  - Priority rendering queue    |
|  - Slack support (4h)          |
|  - 99.9% uptime SLA            |
|  - 200 requests/minute         |
|                                |
|  [Contact Sales]               |
|                                |
|  Volume discounts available    |
+--------------------------------+
```

## Pricing Psychology Elements

**Anchor:** Business tier zeigt hoechsten Wert, macht Pro attraktiver
**Decoy:** Free tier ist bewusst limitiert (100/mo ist schnell erreicht)
**Social Proof:** "MOST POPULAR" Badge auf Pro

## Below Pricing
```
Need more? Enterprise plans with custom limits and dedicated support.
[Talk to us]
```

## FAQ Link
```
Questions about pricing? [See FAQ below]
```

---

# SECTION 6: FAQ

## Section Headline
```
Frequently Asked Questions
```

### Q1: How does the free tier work?
```
A: Sign up with just your email - no credit card required.
You get 100 screenshots and 50 PDFs every month, forever.
When you're ready to scale, upgrade to Pro with one click.
```

### Q2: What happens if I exceed my monthly limit?
```
A: We'll send you an email when you hit 80% of your limit.
If you exceed it, API calls return a 429 status code.
No surprise charges, ever. Upgrade anytime to continue.
```

### Q3: Can I capture pages that require authentication?
```
A: Yes! Pro and Business plans support custom headers,
cookies, and even JavaScript execution. You can capture
logged-in dashboards, admin panels, or any protected content.
```

### Q4: How fast are the screenshots generated?
```
A: Average response time is under 2 seconds. Complex pages
with heavy JavaScript might take 3-4 seconds. We use a global
edge network to ensure consistent performance worldwide.
```

### Q5: Do you store the screenshots or page content?
```
A: No. Screenshots are generated on-demand and streamed
directly to you. We don't store any captured content.
Your data never touches our servers beyond processing.
```

### Q6: Can I use this for automated testing?
```
A: Absolutely. Many customers use our API for visual
regression testing, E2E screenshot capture, and CI/CD
pipelines. We offer bulk endpoints for test suites.
```

### Q7: What's your uptime guarantee?
```
A: Free tier has no SLA. Pro tier targets 99.5% uptime.
Business tier guarantees 99.9% uptime with credits for
any downtime. Check status.screencraft.io for live metrics.
```

---

# SECTION 7: FINAL CTA

## Layout
Full-width, contrasting background (gradient or solid accent)

## Headline
```
Stop wrestling with Puppeteer.
Start shipping screenshots.
```

## Subheadline
```
Join 2,000+ developers who chose the easy path.
```

## CTA Button
```
[Get Your Free API Key]
```

## Trust Reminder
```
Free forever tier | No credit card | Setup in 2 minutes
```

## Alternative Action
```
or [View Documentation] to explore the API first
```

---

# SECTION 8: FOOTER

## Footer Layout
```
+------------------------------------------------------------------+
|                                                                  |
|  [LOGO] ScreenCraft API                                          |
|  Simple screenshot & PDF generation for developers.              |
|                                                                  |
|  PRODUCT          DEVELOPERS        COMPANY        LEGAL         |
|  Pricing          Documentation     About          Privacy       |
|  Features         API Reference     Blog           Terms         |
|  Changelog        SDKs              Contact        DPA           |
|  Status           Postman           Twitter                      |
|                                                                  |
|  +------------------------------------------------------------+  |
|  |  Subscribe to our changelog                                |  |
|  |  [email@example.com                    ] [Subscribe]       |  |
|  +------------------------------------------------------------+  |
|                                                                  |
|  (c) 2024 ScreenCraft. Made with care for developers.            |
|                                                                  |
+------------------------------------------------------------------+
```

---

# DESIGN TOKENS

## Color Palette

### Primary Colors
```css
--color-background: #0D1117;      /* GitHub-dark inspired */
--color-surface: #161B22;         /* Card backgrounds */
--color-surface-hover: #21262D;   /* Hover states */
--color-border: #30363D;          /* Subtle borders */
```

### Text Colors
```css
--color-text-primary: #F0F6FC;    /* Headlines, important text */
--color-text-secondary: #8B949E;  /* Body text, descriptions */
--color-text-muted: #6E7681;      /* Captions, metadata */
```

### Accent Colors
```css
--color-accent-primary: #238636;  /* Success, primary CTAs */
--color-accent-secondary: #1F6FEB;/* Links, secondary actions */
--color-accent-warning: #D29922;  /* Warnings, highlights */
--color-accent-error: #F85149;    /* Errors, destructive */
```

### Gradient
```css
--gradient-hero: linear-gradient(135deg, #0D1117 0%, #161B22 100%);
--gradient-cta: linear-gradient(90deg, #238636 0%, #2EA043 100%);
```

## Typography

### Font Stack
```css
/* Headlines & UI */
--font-sans: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;

/* Code blocks */
--font-mono: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
```

### Type Scale
```css
--text-xs: 0.75rem;     /* 12px - Labels, badges */
--text-sm: 0.875rem;    /* 14px - Body small */
--text-base: 1rem;      /* 16px - Body */
--text-lg: 1.125rem;    /* 18px - Lead text */
--text-xl: 1.25rem;     /* 20px - Section intros */
--text-2xl: 1.5rem;     /* 24px - Card titles */
--text-3xl: 1.875rem;   /* 30px - Section headlines */
--text-4xl: 2.25rem;    /* 36px - Hero subheadline */
--text-5xl: 3rem;       /* 48px - Hero headline mobile */
--text-6xl: 3.75rem;    /* 60px - Hero headline desktop */
```

### Font Weights
```css
--font-normal: 400;
--font-medium: 500;
--font-semibold: 600;
--font-bold: 700;
```

## Spacing System

```css
--space-1: 0.25rem;   /* 4px */
--space-2: 0.5rem;    /* 8px */
--space-3: 0.75rem;   /* 12px */
--space-4: 1rem;      /* 16px */
--space-5: 1.25rem;   /* 20px */
--space-6: 1.5rem;    /* 24px */
--space-8: 2rem;      /* 32px */
--space-10: 2.5rem;   /* 40px */
--space-12: 3rem;     /* 48px */
--space-16: 4rem;     /* 64px */
--space-20: 5rem;     /* 80px */
--space-24: 6rem;     /* 96px */
```

## Border Radius
```css
--radius-sm: 0.25rem;   /* 4px - Buttons, inputs */
--radius-md: 0.5rem;    /* 8px - Cards */
--radius-lg: 0.75rem;   /* 12px - Modals */
--radius-xl: 1rem;      /* 16px - Large cards */
--radius-full: 9999px;  /* Pills, badges */
```

## Shadows
```css
--shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);
--shadow-md: 0 4px 6px rgba(0, 0, 0, 0.4);
--shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.5);
--shadow-glow: 0 0 20px rgba(35, 134, 54, 0.3);  /* CTA glow */
```

## Animation
```css
--transition-fast: 150ms ease;
--transition-base: 200ms ease;
--transition-slow: 300ms ease;
```

---

# A/B TEST VARIATIONS

## Headline Variations
```
A: "Ship Screenshots. Not Infrastructure." (Current)
B: "Screenshots in Seconds. Not Hours of Setup."
C: "The Screenshot API That Just Works."
D: "Puppeteer-as-a-Service for Busy Developers"
```

## CTA Button Variations
```
A: "Get Free API Key" (Current)
B: "Start Building Free"
C: "Try It Now - No Signup"
D: "Get 100 Free Screenshots"
```

## Subheadline Variations
```
A: "Pixel-perfect screenshots and PDFs via simple REST API." (Current)
B: "One API call. Any URL. Perfect screenshots every time."
C: "The fastest way to add screenshots to your app."
```

## Pricing CTA Variations
```
A: "Start Pro Trial" (Current)
B: "Upgrade to Pro"
C: "Go Pro - 14 Days Free"
D: "Unlock Pro Features"
```

---

# IMPLEMENTATION NOTES

## Technical Requirements
- [ ] Static site generator (Next.js, Astro recommended)
- [ ] Code syntax highlighting (Prism.js or Shiki)
- [ ] Analytics (Plausible or Fathom for privacy)
- [ ] Form handling (Newsletter signup)
- [ ] Live demo API endpoint (rate-limited, no auth required)

## Tracking Setup
```javascript
// Key events to track
- hero_cta_click
- demo_try_click
- demo_screenshot_generated
- pricing_tier_click
- docs_link_click
- code_tab_switch
- faq_expand
- footer_cta_click
```

## SEO Considerations
- Title: "Screenshot API - Capture Any URL as PNG, PDF | ScreenCraft"
- Meta: "Generate pixel-perfect screenshots and PDFs with a simple REST API. No Puppeteer setup. Free tier available."
- H1: Only one (Hero headline)
- Schema markup: SoftwareApplication, Offer

## Performance Targets
- LCP: < 2.5s
- FID: < 100ms
- CLS: < 0.1
- Total page weight: < 500KB

## Mobile Considerations
- Hero: Stack vertically, demo below fold
- Pricing: Single column, swipeable
- Code: Horizontal scroll with visual indicator
- FAQ: Accordion format

---

# NEXT STEPS

1. **Design Phase**: Create Figma mockups based on this blueprint
2. **Copy Review**: A/B test headlines with target audience
3. **Demo Build**: Create rate-limited public demo endpoint
4. **Development**: Implement with chosen stack
5. **Launch**: Soft launch to developer communities (HN, Reddit, Twitter)

---

*Generated by FunnelArchitect | Conversion-Optimized Blueprint v1.0*
