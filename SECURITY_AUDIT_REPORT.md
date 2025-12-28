# ScreenCraft Security Audit Report

**Project:** ScreenCraft API (Screenshot/PDF Generation Service)
**Audit Date:** 2025-12-28
**Auditor:** Multi-Agent Security Assessment (10 Specialized Agents)
**Classification:** CONFIDENTIAL

---

## Executive Summary

A comprehensive security audit of the ScreenCraft project identified **47 findings** across 10 security domains. The assessment revealed **8 CRITICAL**, **19 HIGH**, **15 MEDIUM**, and **5 LOW** severity vulnerabilities that require immediate attention.

### Critical Issues Requiring Immediate Action:

1. **Broken Object Level Authorization (BOLA)** - Screenshot/PDF endpoints allow access to resources without ownership verification
2. **Missing Authentication Middleware** - Core API routes registered without auth preHandler
3. **Missing Brute-Force Protection** - User login endpoint lacks rate limiting
4. **Hardcoded Credentials** - Production secrets in docker-compose.yml and seed scripts
5. **Insecure Default JWT Secrets** - Fallback to weak defaults in production
6. **Container Security Gaps** - Docker socket exposed, no seccomp/capabilities constraints
7. **Docker Image Tag Pinning** - Using `minio:latest` allows supply chain attacks
8. **XSS Vulnerabilities** - innerHTML injection in dashboard pages

### Risk Distribution:

| Severity | Count | Percentage |
|----------|-------|------------|
| CRITICAL | 8 | 17% |
| HIGH | 19 | 40% |
| MEDIUM | 15 | 32% |
| LOW | 5 | 11% |

---

## Threat Model Snapshot

### Architecture Overview

```
                    EXTERNAL ZONE
    ┌─────────────────────────────────────────┐
    │  Users / API Consumers / Third Parties   │
    └─────────────────────────────────────────┘
                        │
                        ▼
                    EDGE ZONE
    ┌─────────────────────────────────────────┐
    │         Traefik (Reverse Proxy)          │
    │    - TLS Termination                     │
    │    - Rate Limiting                       │
    └─────────────────────────────────────────┘
                        │
        ┌───────────────┼───────────────┐
        ▼               ▼               ▼
                APPLICATION ZONE
    ┌─────────┐   ┌─────────┐   ┌─────────┐
    │   Web   │   │   API   │   │ Worker  │
    │ (Astro) │   │(Fastify)│   │  Queue  │
    └─────────┘   └─────────┘   └─────────┘
                        │
                        ▼
                    DATA ZONE
    ┌─────────┐   ┌─────────┐   ┌─────────┐
    │ Postgres│   │  Redis  │   │  MinIO  │
    └─────────┘   └─────────┘   └─────────┘
```

### Trust Boundaries Identified

| Boundary | Risk Level | Key Concerns |
|----------|------------|--------------|
| External → Traefik | HIGH | DDoS, TLS attacks |
| Traefik → API | MEDIUM | Auth bypass, header injection |
| API → Database | CRITICAL | SQL injection, BOLA |
| API → Worker | MEDIUM | Job tampering |
| API → MinIO | HIGH | SSRF, path traversal |

### High-Value Flows

1. **Authentication Flow** - Password login, OAuth, session management
2. **Screenshot/PDF Generation** - URL fetching, browser rendering, storage
3. **Payment Flow** - Stripe checkout, webhooks, subscription management
4. **Admin Operations** - User management, API key generation
5. **Webhook Delivery** - External callback with user data

---

## Findings Register (Prioritized)

### CRITICAL Severity

#### C-01: BOLA - Screenshot/PDF Access Without Ownership Check

| Attribute | Value |
|-----------|-------|
| OWASP | A01:2021, API1:2023 |
| Files | `api/src/controllers/screenshot.controller.ts:230-255`, `pdf.controller.ts` |
| Impact | Unauthorized access to any user's screenshots/PDFs |
| Exploitability | Easy - Predictable UUIDs |

**Evidence:**
```typescript
// screenshot.controller.ts:230-255
const screenshot = await screenshotRepository.findById(id);
// MISSING: screenshot.accountId === request.auth?.accountId check
```

**Fix:** Add ownership verification to all resource access methods:
```typescript
const screenshot = await screenshotRepository.findByIdAndAccount(id, request.auth.accountId);
if (!screenshot) return reply.status(404).send({ error: 'Not found' });
```

---

#### C-02: Missing Auth Middleware on Core Routes

| Attribute | Value |
|-----------|-------|
| OWASP | A01:2021 |
| Files | `api/src/app.ts:190-198` |
| Impact | Unauthenticated access to screenshot/PDF endpoints |
| Exploitability | Easy - Direct API calls |

**Evidence:**
```typescript
// app.ts:190-198 - Routes registered WITHOUT auth preHandler
await instance.register(screenshotRoutes);
await instance.register(pdfRoutes);
```

**Fix:** Add authMiddleware as preHandler:
```typescript
instance.addHook('preHandler', authMiddleware);
await instance.register(screenshotRoutes);
```

---

#### C-03: Missing Brute-Force Protection on Login

| Attribute | Value |
|-----------|-------|
| OWASP | A07:2021, API2:2023 |
| Files | `api/src/routes/auth.routes.ts:155-209` |
| Impact | Credential stuffing, account compromise |
| Exploitability | Easy - Automated attacks |

**Evidence:**
```typescript
// No rate limiting on login endpoint
fastify.post('/auth/login', async (request, reply) => {
  const user = await passwordService.login(email, password);
  // Unlimited attempts allowed
});
```

**Fix:** Implement progressive delays and account lockout:
```typescript
const loginLimiter = new RateLimiterRedis({
  keyPrefix: 'login_fail:',
  points: 5,
  duration: 15 * 60,
  blockDuration: 30 * 60,
});
```

---

#### C-04: Hardcoded Credentials in Docker Compose

| Attribute | Value |
|-----------|-------|
| OWASP | A07:2021 |
| Files | `docker-compose.yml:13,52-53`, `api/prisma/seed.ts:71` |
| Impact | Database/storage compromise if files leaked |
| Exploitability | Easy - Git history exposure |

**Evidence:**
```yaml
# docker-compose.yml
POSTGRES_PASSWORD: screencraft_dev_password
MINIO_ROOT_PASSWORD: minioadmin123
```

```typescript
// seed.ts:71
const adminPassword = 'admin123'; // Logged to console!
```

**Fix:** Use environment variables and secrets management:
```yaml
POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
```

---

#### C-05: Insecure Default JWT Secret with Fallback

| Attribute | Value |
|-----------|-------|
| OWASP | A02:2021 |
| Files | `api/src/config/index.ts:41` |
| Impact | JWT forgery, admin impersonation |
| Exploitability | Easy - Default secret known |

**Evidence:**
```typescript
ADMIN_JWT_SECRET: z.string().default('change-this-in-production-admin-secret-key'),
```

**Fix:** Remove default, fail on startup if missing:
```typescript
ADMIN_JWT_SECRET: z.string().min(32), // No default!
```

---

#### C-06: Docker Socket Exposed to Traefik

| Attribute | Value |
|-----------|-------|
| OWASP | A01:2021 |
| Files | `docker-compose.yml:199` |
| Impact | Container escape, host compromise |
| Exploitability | Medium - Requires container compromise |

**Evidence:**
```yaml
volumes:
  - /var/run/docker.sock:/var/run/docker.sock:ro
```

**Fix:** Use Docker Socket Proxy:
```yaml
docker-socket-proxy:
  image: tecnativa/docker-socket-proxy
  environment:
    CONTAINERS: 1
    SERVICES: 0
```

---

#### C-07: Docker Images Without Digest Pinning

| Attribute | Value |
|-----------|-------|
| OWASP | A08:2021 |
| Files | `docker-compose.yml:48,70` |
| Impact | Supply chain attack via malicious image |
| Exploitability | Medium - Requires registry compromise |

**Evidence:**
```yaml
image: minio/minio:latest
image: minio/mc:latest
```

**Fix:** Pin to SHA256 digest:
```yaml
image: minio/minio@sha256:<specific-digest>
```

---

#### C-08: Containers Without Security Constraints

| Attribute | Value |
|-----------|-------|
| OWASP | A05:2021 |
| Files | `docker-compose.yml` (all services) |
| Impact | Privilege escalation, container escape |
| Exploitability | Medium |

**Fix:** Add security constraints:
```yaml
security_opt:
  - no-new-privileges:true
cap_drop:
  - ALL
read_only: true
```

---

### HIGH Severity

| ID | Title | OWASP | File:Line | Fix Priority |
|----|-------|-------|-----------|--------------|
| H-01 | XSS via innerHTML in Dashboard | A03 | `settings.astro:327`, `usage.astro:257` | Week 1 |
| H-02 | Payment Controller Wrong Auth Attribute | A01 | `payment.controller.ts:34-36` | Week 1 |
| H-03 | Fallback to 'default' accountId | A01 | `screenshot.controller.ts:60` | Week 1 |
| H-04 | User Enumeration via Error Messages | A07 | `password.service.ts:80-93` | Week 1 |
| H-05 | Session Cookie SameSite=Lax | A07 | `auth.routes.ts:79-85` | Week 1 |
| H-06 | Missing CSRF Protection | A07 | `auth.routes.ts:216-256` | Week 2 |
| H-07 | Incomplete SSRF Protection | A10 | `url-validator.ts:7-37` | Week 2 |
| H-08 | HTML Injection in PDF Generation | A03 | `pdf.service.ts:308-320` | Week 2 |
| H-09 | OAuth Tokens Without Encryption | A02 | `schema.prisma:282-287` | Week 2 |
| H-10 | Webhook Secrets Without Encryption | A02 | `schema.prisma:454` | Week 2 |
| H-11 | Missing HSTS Header | A05 | `nginx.conf:40-44` | Week 1 |
| H-12 | Traefik Dashboard Without Auth | A05 | `docker-compose.yml:191` | Week 1 |
| H-13 | CORS Wildcard in Development | A05 | `app.ts:50` | Week 1 |
| H-14 | Missing Dependabot Configuration | A06 | `.github/` (missing) | Week 1 |
| H-15 | No npm audit in CI/CD | A06 | `.github/workflows/test.yml` | Week 1 |
| H-16 | Missing Security Audit Logs | A09 | `auth.routes.ts:103-150` | Week 2 |
| H-17 | Verbose Error Messages | A09 | `app.ts:217-236` | Week 2 |
| H-18 | Database Ports Exposed to Host | A05 | `docker-compose.yml:12-13` | Week 1 |
| H-19 | Chromium --no-sandbox | A05 | `browser.config.ts:34,44` | Week 3 |

---

### MEDIUM Severity

| ID | Title | OWASP | File:Line |
|----|-------|-------|-----------|
| M-01 | Session Revoke Ownership Check | A01 | `auth.routes.ts:412-437` |
| M-02 | Admin Logout Without Token Blacklist | A01 | `admin-auth.middleware.ts:56-118` |
| M-03 | Unvalidated Dynamic orderBy | A03 | `admin-*.service.ts` |
| M-04 | Template Injection in PDF Headers | A03 | `pdf.service.ts:348-354` |
| M-05 | Missing webhookUrl SSRF Check | A10 | `screenshot.schema.ts:54` |
| M-06 | SHA256 for API Keys (no HMAC pepper) | A02 | `api-key.service.ts:31-33` |
| M-07 | JWT Without Algorithm Constraint | A02 | `admin-auth.middleware.ts:58` |
| M-08 | OAuth State Parameter Validation | A07 | `auth.routes.ts:22-35` |
| M-09 | Admin Rate Limit In-Memory | A07 | `admin/rate-limit.middleware.ts:8-16` |
| M-10 | No MFA/2FA Support | A07 | N/A |
| M-11 | CSP Disabled in Development | A05 | `server.ts:32-34` |
| M-12 | Default Admin Credentials in Seed | A05 | `seed.ts:71` |
| M-13 | Redis Without Authentication | A07 | `docker-compose.yml:32` |
| M-14 | IP Address Stored (DSGVO) | Privacy | `schema.prisma:303-304` |
| M-15 | Missing Data Export/Delete (DSGVO) | Privacy | N/A |

---

### LOW Severity

| ID | Title | OWASP | File:Line |
|----|-------|-------|-----------|
| L-01 | Cookie Injection Potential | A03 | `screenshot.schema.ts:41-50` |
| L-02 | Email Not Verified on Registration | A07 | `password.service.ts:54-67` |
| L-03 | PII in Audit Logs (Email) | A09 | `admin/routes/index.ts:60-68` |
| L-04 | Missing SBOM Generation | A06 | CI/CD |
| L-05 | Missing Container Image Signing | A08 | CI/CD |

---

## Top 10 Priority Actions

| Priority | Action | Effort | Impact |
|----------|--------|--------|--------|
| **P0** | Add auth middleware to screenshot/PDF routes | 2h | CRITICAL |
| **P0** | Implement BOLA ownership checks | 4h | CRITICAL |
| **P0** | Add brute-force protection to login | 4h | CRITICAL |
| **P0** | Remove hardcoded credentials | 2h | CRITICAL |
| **P0** | Remove JWT secret defaults | 1h | CRITICAL |
| **P1** | Fix XSS in dashboard (escapeHtml) | 2h | HIGH |
| **P1** | Add HSTS and security headers | 2h | HIGH |
| **P1** | Pin Docker images to SHA256 | 2h | HIGH |
| **P1** | Add npm audit to CI/CD | 1h | HIGH |
| **P1** | Create Dependabot configuration | 1h | HIGH |

---

## Hardening Roadmap

### Quick Wins (Week 1)

- [ ] Remove 'default' accountId fallbacks
- [ ] Fix payment controller auth attribute
- [ ] Add HSTS header to nginx.conf
- [ ] Bind database ports to 127.0.0.1
- [ ] Create `.github/dependabot.yml`
- [ ] Add `npm audit` step to CI/CD
- [ ] Disable Traefik dashboard in development

### Sprint 1 (Weeks 2-3)

- [ ] Implement comprehensive auth middleware
- [ ] Add BOLA checks to all repository methods
- [ ] Implement rate limiting on auth endpoints
- [ ] Fix XSS vulnerabilities with escapeHtml()
- [ ] Add CSRF protection
- [ ] Implement security audit logging
- [ ] Sanitize error messages

### Structural Changes (Month 1-2)

- [ ] Implement Row-Level Security in PostgreSQL
- [ ] Add field-level encryption for OAuth tokens
- [ ] Use Docker Socket Proxy for Traefik
- [ ] Add container security constraints
- [ ] Implement MFA support
- [ ] Add DSGVO data export/delete endpoints
- [ ] Implement password reset flow

### Ongoing

- [ ] Regular dependency updates via Dependabot
- [ ] Container image scanning in CI/CD
- [ ] Security header monitoring
- [ ] Penetration testing (quarterly)
- [ ] Security awareness training

---

## Appendix

### A. Assumptions

1. Production deployment uses `docker-compose.prod.yml`
2. Environment variables are properly configured in production
3. HTTPS is enforced via Traefik in production
4. No direct database access from external networks

### B. Open Questions

1. Is there a WAF in front of the application?
2. What is the backup and disaster recovery strategy?
3. Are there any compliance requirements (SOC2, HIPAA)?
4. Is there a bug bounty program planned?

### C. Tools Used

- Manual code review
- Grep/Glob pattern matching
- Prisma schema analysis
- Docker configuration review
- CI/CD pipeline analysis

### D. OWASP Reference

- **OWASP Top 10:2021**: https://owasp.org/Top10/
- **OWASP API Security Top 10:2023**: https://owasp.org/API-Security/

---

*Report generated by multi-agent security assessment*
*Confidentiality: This report contains sensitive security information*
