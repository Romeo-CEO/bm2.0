# Milestone 1 – BMAD Stories (Create-Story Template)

Note: Stories follow BMAD create-story template (bmm/workflows/4-implementation/create-story/template.md). Epic numbering uses M1.<epic>.<story>.

---
# Story M1.1.1: Enable Email/Password Login with Rate Limiting and Lockout

Status: Draft

## Story
As a Company User,
I want to sign in with email and password,
so that I can securely access the platform and my company resources.

## Acceptance Criteria
1. Valid credentials return 200 with {success, token, user} where token expires in ~1h (configurable) and is persisted in auth_tokens.
2. Invalid credentials return 401 with generic error; no user enumeration.
3. Rate limit: 10 login attempts/hour per IP and 5/hour per email; exceeding returns 429 with rate limit headers.
4. Lockout after 5 failed attempts for 30 minutes; attempts reset on successful login.
5. Token is signed (HS256) and validated against DB presence on subsequent requests.
6. Audit event recorded for success/failure and lockout events.

## Tasks / Subtasks
- [ ] Implement POST /api/auth/login controller (AC: 1,2,6)
  - [ ] Validate inputs and sanitize
  - [ ] bcrypt.compare against password_hash
  - [ ] Generate JWT and persist in auth_tokens with expiry
- [ ] Add rate limiting middleware (per-IP and per-email) (AC: 3)
- [ ] Implement account lockout with counters and expiry (AC: 4)
- [ ] Add audit logging for login attempts and outcomes (AC: 6)
- [ ] Tests: happy path, invalid creds, rate limit, lockout, audit entries (AC: 1–6)

## Dev Notes
- Use JWT_EXPIRES_IN ~1h (Key Vault in prod). Align with Architecture §3.5.
- Store tokens in auth_tokens as per Architecture §3.2/5.2.3.
- Prefer Redis-backed rate limiter in prod (Azure Redis). Dev may use memory store.

### Project Structure Notes
- Backend: backend/src/controllers/authController.ts, middleware/auth.ts, utils/jwt.ts
- Add rate limiting middleware centrally in backend/src/app.ts

### References
- docs/architecture/system-architecture.md#3-authentication-architecture
- docs/analysis/current-state-analysis.md#1-authentication-system-current-state

## Dev Agent Record
### Context Reference
### Agent Model Used
### Debug Log References
### Completion Notes List
### File List

---
# Story M1.1.2: Registration – Create Company + Owner User

Status: Draft

## Story
As a new customer (Owner),
I want to register and create my company workspace,
so that I can start using the platform immediately.

## Acceptance Criteria
1. POST /api/auth/register creates company and owner user with company_admin=1.
2. Password policy enforced: min 8, upper/lower/number; bcrypt cost=12.
3. Returns {success, token, user} and audit event recorded.
4. Email uniqueness enforced; generic errors on conflicts.

## Tasks / Subtasks
- [ ] Implement registration flow and transaction handling (AC: 1)
- [ ] Enforce password complexity and bcrypt hashing (AC: 2)
- [ ] Generate JWT, persist token, and return user (AC: 3)
- [ ] Tests: uniqueness, validation, audit (AC: 2–4)

## Dev Notes
- Company owner becomes platform “user” with role=user and company_admin=1.

### Project Structure Notes
- backend/src/controllers/authController.ts
- backend/src/db/migrations if schema touches are needed

### References
- docs/architecture/system-architecture.md#3-Authentication-Architecture
- docs/analysis/current-state-analysis.md#1-Authentication-System

## Dev Agent Record

---
# Story M1.1.3: Password Reset (Forgot + Reset)

Status: Draft

## Story
As a Company User,
I want to reset my password securely,
so that I can regain access without exposing my account.

## Acceptance Criteria
1. POST /api/auth/password/forgot creates single-use token (≤1h) and sends email via SendGrid; response does not reveal email existence.
2. POST /api/auth/password/reset validates token, updates bcrypt hash, invalidates existing tokens, records audit.
3. All operations are audited; rate-limited to 3/hour/IP for forgot.

## Tasks / Subtasks
- [ ] Create password_resets table and migration (AC: 1)
- [ ] Implement forgot endpoint + email send via SendGrid (AC: 1)
- [ ] Implement reset endpoint + token validation + revoke tokens (AC: 2)
- [ ] Add audits and rate limits (AC: 3)
- [ ] Tests: token lifecycle, invalid/expired paths, email dispatch (AC: 1–3)

## Dev Notes
- Store tokens with expiry; ensure single-use and idempotency.

### References
- docs/architecture/system-architecture.md#3.3-Password-Reset-Flow
- docs/analysis/current-state-analysis.md#1.2-Authentication-Database-Schema

---
# Story M1.1.4: Logout and Token Revocation

Status: Draft

## Story
As a Company User,
I want to log out from my session,
so that my token cannot be reused and my account stays secure.

## Acceptance Criteria
1. POST /api/auth/logout deletes current token from auth_tokens and returns success.
2. Subsequent request with revoked token fails with 401.
3. Audit event recorded.

## Tasks / Subtasks
- [ ] Implement logout endpoint (AC: 1)
- [ ] Add token check path to middleware (AC: 2)
- [ ] Audit logging (AC: 3)
- [ ] Tests for revoke and post-revoke behavior (AC: 1–2)

### References
- docs/architecture/system-architecture.md#3.2.4-Logout-Flow

---
# Story M1.1.5: Auth Middleware and /auth/me

Status: Draft

## Story
As a Frontend Application,
I want a reliable /auth/me endpoint and middleware validation,
so that I can bootstrap sessions and fetch profiles securely.

## Acceptance Criteria
1. Middleware validates JWT signature and DB presence; loads user including companyId and role.
2. GET /api/auth/me returns user profile with required fields; 401 if invalid/expired.
3. Audit success/fail events where relevant.

## Tasks / Subtasks
- [ ] Ensure middleware enforces DB token validation (AC: 1)
- [ ] Implement /auth/me payload structure (AC: 2)
- [ ] Tests for valid/invalid, expiry paths (AC: 1–2)

### References
- docs/architecture/system-architecture.md#3.2.3-Authenticated-Request-Flow

---
# Story M1.2.1: Global Company-Scoping Middleware

Status: Draft

## Story
As a Security Engineer,
I want automatic company scoping for all requests,
so that cross-tenant data leakage risk is eliminated.

## Acceptance Criteria
1. For all protected routes, non-admin requests are auto-scoped to req.user.companyId; controllers require no ad-hoc WHERE company_id.
2. Cross-company attempts return 403 and are audited.
3. Admin users bypass scoping.

## Tasks / Subtasks
- [ ] Implement enforceCompanyScoping middleware and apply under /api (AC: 1)
- [ ] Controller review to remove duplicate checks and ensure non-admins never pass unscoped IDs (AC: 1)
- [ ] Audit attempts and 403s (AC: 2)
- [ ] Tests: scoping across core endpoints (AC: 1–3)

### References
- docs/architecture/system-architecture.md#4-multi-tenant-architecture
- docs/analysis/current-state-analysis.md#2.3-Multi-Tenant-Isolation

---
# Story M1.2.2: Isolation Test Suite in CI

Status: Draft

## Story
As a Platform Admin,
I want automated tests proving tenant isolation,
so that regressions are caught before release.

## Acceptance Criteria
1. Cross-tenant access attempts for all core endpoints return 403.
2. Test suite runs in CI and blocks on failure.
3. Reports are generated per endpoint group.

## Tasks / Subtasks
- [ ] Define tenant fixtures and seed data
- [ ] Write tests for users, companies, apps, templates, files (AC: 1)
- [ ] Integrate into CI pipeline (AC: 2)
- [ ] Publish test reports (AC: 3)

### References
- docs/architecture/system-architecture.md#4.4-Multi-Tenant-Security-Controls

---
# Story M1.2.3: Role and Company Admin Enforcement

Status: Draft

## Story
As a Company Admin,
I want role-aware access controls,
so that admins can manage platform-wide and company_admins only manage their own company.

## Acceptance Criteria
1. Admin can access cross-company endpoints; company_admin limited to own company.
2. Access denials (403) are audited.
3. Tests cover privilege boundaries.

## Tasks / Subtasks
- [ ] Implement requireAdmin middleware and company_admin checks (AC: 1)
- [ ] Add audits for denials (AC: 2)
- [ ] Tests for role boundaries (AC: 3)

### References
- docs/architecture/system-architecture.md#4.3-Company-Hierarchy

---
# Story M1.3.1: PayFast ITN Verification Endpoint

Status: Draft

## Story
As a Billing System,
I want to verify PayFast ITN callbacks securely,
so that subscriptions are updated only on valid, verified payments.

## Acceptance Criteria
1. ITN endpoint verifies signature using passphrase and params ordering.
2. IP whitelist check passes only known PayFast IPs.
3. Server-side post-back to PayFast returns VALID; otherwise reject.
4. Idempotency enforced to avoid double-processing.
5. Audit all events and errors; return 200 OK to PayFast when processed.

## Tasks / Subtasks
- [ ] Implement ITN controller with signature, IP, and post-back verification (AC: 1–3)
- [ ] Add idempotency keys and processing state (AC: 4)
- [ ] Audit logging, App Insights metrics (AC: 5)
- [ ] Tests: signature mismatch, IP mismatch, replay, valid flow

### References
- docs/architecture/system-architecture.md#11.2-PayFast-ITN
- docs/analysis/current-state-analysis.md#13.1-Backend-Implementation

---
# Story M1.3.2: Payment Records Persistence

Status: Draft

## Story
As a Platform Admin,
I want all payment transactions stored with details,
so that I can reconcile and audit billing.

## Acceptance Criteria
1. payments table persists gateway response, invoice_number, status timeline, user/company, amounts.
2. Admin can list and view payment records.
3. Records linked to subscription actions.

## Tasks / Subtasks
- [ ] Create payments table migration and data access (AC: 1)
- [ ] Implement admin list/detail endpoints (AC: 2)
- [ ] Link to subscription updates (AC: 3)
- [ ] Tests for persistence and queries

### References
- docs/architecture/system-architecture.md#11.4-Payment-History-\u0026-Invoicing

---
# Story M1.3.3: Subscription Updates on Payment Events

Status: Draft

## Story
As a Company Admin,
I want subscription tier and expiry updated on payment success,
so that access is granted appropriately.

## Acceptance Criteria
1. On COMPLETE payment, users.subscription_tier and subscription_expiry updated correctly.
2. Handle cancellation/expiry flows and grace periods (minimal for M1).
3. Audit subscription changes.

## Tasks / Subtasks
- [ ] Update subscription state transitions in ITN handler (AC: 1)
- [ ] Implement minimal grace/expiry logic (AC: 2)
- [ ] Audit events and tests (AC: 3)

### References
- docs/architecture/system-architecture.md#11.3-Subscription-Lifecycle-Management

---
# Story M1.4.1: FE/BE API Base Path Normalization

Status: Draft

## Story
As a Frontend Engineer,
I want a consistent API base of /api/,
so that authenticated routes work reliably in all environments.

## Acceptance Criteria
1. FE defaults to /api/ as base (no /api/public default); Vercel logic corrected.
2. All FE calls updated to normalized base.
3. Regression tests pass.

## Tasks / Subtasks
- [ ] Update frontend src/lib/api.ts base builder (AC: 1)
- [ ] Search/replace any hardcoded /api/public (AC: 2)
- [ ] FE integration tests

### References
- docs/analysis/current-state-analysis.md#4.1-API-Base-URL-Mismatch

---
# Story M1.4.2: Templates and Company Users Path Normalization

Status: Draft

## Story
As a Frontend Engineer,
I want correct endpoint paths for templates and company users,
so that FE contracts match BE and docs.

## Acceptance Criteria
1. Templates API uses /api/templates (no /api/platform/templates).
2. Admin cross-company users uses /api/companies/:id/users (not /api/company/users/:id).
3. All affected FE calls updated; smoke tests pass.

## Tasks / Subtasks
- [ ] Update FE template paths (AC: 1)
- [ ] Update FE company users paths (AC: 2)
- [ ] Tests and minimal controller adjustments if necessary

### References
- docs/analysis/current-state-analysis.md#4.2-Template-API-Path-Mismatch
- docs/analysis/current-state-analysis.md#4.3-Company-Users-API-Mismatch

---
# Story M1.4.3: Standard Response Envelopes and Error Format

Status: Draft

## Story
As a Consumer of the API,
I want standardized response envelopes and errors,
so that clients handle results consistently.

## Acceptance Criteria
1. All list endpoints return {success, items, page, pageSize, total, totalPages}.
2. Error responses return {success:false, error, code, details?} with correct HTTP codes.
3. Users controller updated (was returning {users: [...]}) and other inconsistencies fixed.

## Tasks / Subtasks
- [ ] Update controllers for standardized envelopes (AC: 1)
- [ ] Update error handling middleware for error shape (AC: 2)
- [ ] FE adapters updated if needed; contract tests added (AC: 1–2)

### References
- docs/architecture/system-architecture.md#6.2-API-Response-Format-Standards
- docs/analysis/current-state-analysis.md#4.4-Response-Format-Inconsistencies

---
# Story M1.5.1: SendGrid Integration for Invites and Resets

Status: Draft

## Story
As a Platform Admin,
I want transactional emails for invites and password resets,
so that user onboarding and account recovery work reliably.

## Acceptance Criteria
1. SendGrid API key loaded from Key Vault in prod; local via env.
2. Invite and reset emails send successfully; retries and logging included.
3. Email templates versioned and referenced.

## Tasks / Subtasks
- [ ] Configure SendGrid client and Key Vault secret resolution (AC: 1)
- [ ] Implement invite and reset email senders (AC: 2)
- [ ] Add email templates and references (AC: 3)
- [ ] Tests with mock provider

### References
- docs/analysis/current-state-analysis.md#16.1-Email-Service-Integration

---

Backlog (Non-blocking follow-ups captured separately in Engineering Backlog template):
- Refresh tokens (rotation policy) and extended sessions
- Audit log viewer UI (admin) and query filters
- Rate limit headers (X-RateLimit-*) across endpoints
- Subscription_tiers table and account lifecycle automation expansion
- Template personalization engine (promoted to M2 if needed)
