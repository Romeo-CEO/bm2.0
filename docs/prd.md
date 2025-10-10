# Business Manager (BM) Product Requirements Document (PRD) v1.0

1) Metadata
- Product: Business Manager (multi-tenant B2B SaaS platform and SSO hub)
- Date: 2025-10-09
- Status: Draft for review
- Sources:
  - docs/architecture/system-architecture.md (2025-10-09)
  - docs/analysis/current-state-analysis.md (2025-10-09)
- Authoring role: Requirements Analyst (per bmad-planning/requirements-analyst.md)
- Platform constraints (rules):
  - Frontend: React + TypeScript
  - Backend: Node/Express on Azure App Service
  - Data/services: Azure SQL (single instance, strict multi-tenant isolation), Azure Blob, Azure Redis, Azure Key Vault, Azure App Insights

2) Vision and scope
- Vision: BM is a central authentication and SSO hub with a marketplace of business applications and template assets, providing company-scoped workspaces, subscription control, and single sign-on.
- In-scope (MVP + near-term):
  - Custom JWT auth (primary), multi-tenant isolation, SSO, marketplace, templates, payments/subscriptions, core admin capabilities, API standardization, email integration, basic audit logging and monitoring.
- Out of scope (now):
  - SAML SSO, third-party OAuth providers beyond platform JWT, rich analytics dashboards, notification center, ratings/reviews, template versioning/preview.

3) Objectives and success metrics
- Objectives
  - Enable secure, first-class custom JWT auth and eliminate AAD B2C dependency in production.
  - Guarantee strict tenant isolation across all APIs.
  - Productionize payments with PayFast ITN and complete payment/subscription records.
  - Provide marketplace and templates with subscription-tier enforcement; add template personalization next.
  - Standardize API paths and envelopes to align FE/BE.
- Success metrics (initial)
  - Auth: ≥99.5% successful login rate for valid credentials; <1% auth-related support tickets/month.
  - Isolation: 0 cross-tenant data leakage incidents; 100% pass on isolation test suite.
  - Payments: 100% of captured ITN events verified (signature, IP, post-back), <0.1% reconciliation discrepancy.
  - Performance: p95 API latency <200ms and p99 <500ms under expected load.
  - Availability: ≥99.9% monthly for core APIs.

4) Personas
- Platform Admin: Manages companies, users, subscriptions, apps, templates, settings, and reviews audit logs.
- Company Admin: Manages company profile/branding, users, seats, and launches applications.
- Company User: Uses apps/templates according to subscription tier.
- Application Owner (future): Publishes and maintains apps integrated via SSO.

5) User journeys (high level)
- New company sign-up → register → login → create company → configure branding → browse marketplace → subscribe → launch app via SSO → manage users.
- Existing company user → login → browse apps/templates → launch app via SSO → download templates (tier-checked).
- Company admin → invite user → user accepts invite → user joins company → role/seat enforced.
- Admin → configure PayFast → monitor ITN → review audits → manage apps/templates.

6) Functional Requirements (FR)
Authentication (custom JWT, production primary)
- FR1 [Must]: Email/password login (POST /api/auth/login)
  - Acceptance: Valid credentials return 200 with {success, token, user}; invalid returns 401 generic; rate limit 10/hour/IP and 5/hour/email with 429; lockout after 5 failures for 30 minutes; token expiry 1h configurable; token persisted in auth_tokens.
- FR2 [Must]: Registration (POST /api/auth/register)
  - Acceptance: Creates company and owner user (company_admin=1), bcrypt cost 12; password policy enforced (min 8, upper/lower/number); returns {success, token, user}; audit event recorded.
- FR3 [Must]: Me (GET /api/auth/me)
  - Acceptance: Returns current user profile using JWT + DB token validation; includes id, email, role, companyId, subscriptionTier, companyAdmin.
- FR4 [Must]: Logout (POST /api/auth/logout)
  - Acceptance: Revokes current token (delete from auth_tokens); subsequent use fails; returns success; audit event recorded.
- FR5 [Must]: Forgot password (POST /api/auth/password/forgot)
  - Acceptance: Sends email with single-use token; token expiry ≤1h; does not reveal email existence; audit event recorded.
- FR6 [Must]: Reset password (POST /api/auth/password/reset)
  - Acceptance: Valid token → updates bcrypt hash; invalidates prior tokens; returns success; audit event recorded.
- FR7 [Should]: Optional Azure AD B2C toggle (non-prod only)
  - Acceptance: Feature flag can enable AAD B2C routes for testing; production flag off; when off, custom JWT is the only path.

Multi-tenant isolation and security
- FR8 [Must]: Global company scoping middleware
  - Acceptance: All protected routes enforce req.user.companyId for non-admin users automatically; controllers need no ad-hoc filtering; cross-company attempts return 403 and are audited.
- FR9 [Must]: Role and company_admin enforcement
  - Acceptance: Admin can access cross-company endpoints; company_admin restricted to own company management; tests cover privilege boundaries.
- FR10 [Must]: Isolation test suite
  - Acceptance: Automated tests attempt cross-tenant access across all endpoints; all must fail with 403; reports shipped in CI.

User and company management
- FR11 [Must]: Company profile (GET/PUT /api/company/profile)
  - Acceptance: Authenticated users get/update their company; admin can GET/PUT any company by ID; validations for branding fields present.
- FR12 [Must]: Company users (GET /api/company/users)
  - Acceptance: Lists users in current company with standardized envelope {success, items, page, pageSize, total, totalPages}.
- FR13 [Must]: Admin cross-company users (GET /api/companies/:id/users)
  - Acceptance: Admin can list users for any company; non-admin forbidden; standardized envelope.
- FR14 [Must]: Invitation system (POST /api/company/users/invite, POST /api/company/users/:id/resend-invite)
  - Acceptance: Creates company_invitations record with expiry; email sent via SendGrid; tokens single-use; resend updates token/expiry; seat limits checked before sending.
- FR15 [Must]: Remove company user (DELETE /api/company/users/:id)
  - Acceptance: Company admin can remove user from their company; user remains in platform; audit event logged.
- FR16 [Should]: Create user with temp password (POST /api/users)
  - Acceptance: Admin or company_admin can create user; generates temp password and email; can optionally assign to company; acceptance logged.
- FR17 [Should]: Get user by ID (GET /api/users/:id)
  - Acceptance: Admin can fetch any user; company_admin can fetch within company; 404 for non-existent; 403 for unauthorized.

SSO
- FR18 [Must]: Maintain SSO flow and domain-token issuance
  - Acceptance: Launching an app generates domain-specific token valid ≤1h; app validation with BM required; all events (launch, validate, revoke) audited.
- FR19 [Should]: SSO app registry management
  - Acceptance: Admin CRUD for sso_applications; can toggle sso_enabled and sso_endpoint; validation prevents duplicate domains.

Marketplace
- FR20 [Must]: Public catalog (GET /api/applications/public)
  - Acceptance: Search, category filters, sorting, pagination; standardized envelope.
- FR21 [Must]: Authenticated catalog (GET /api/applications)
  - Acceptance: Returns only apps allowed for user subscriptionTier (admin bypass); standardized envelope.
- FR22 [Must]: App details (GET /api/applications/:id)
  - Acceptance: Returns full metadata; 404 if not found/inactive.
- FR23 [Must]: Launch app (GET /api/applications/:id/launch)
  - Acceptance: Validates tier access (admin bypass) and SSO rules; returns launch URL; audit launch event stored.
- FR24 [Should]: Deployment checklist APIs
  - Acceptance: Provide deployment status and checks (SSL, DNS, listing, launcher, metadata).

Template library
- FR25 [Must]: Public templates catalog (GET /api/templates/public)
  - Acceptance: Search, category filters, sorting, pagination; standardized envelope.
- FR26 [Must]: Authenticated templates (GET /api/templates, GET /api/templates/:id)
  - Acceptance: Tier-filtered list; details endpoint returns metadata; 404 if not found/inactive.
- FR27 [Must]: Template download (GET /api/templates/download/:id)
  - Acceptance: Enforces subscription tier; admin bypass; streams or redirects to download; audit event stored.
- FR28 [Should]: Template personalization engine
  - Acceptance: On download, personalize with company logo/colors/contact where supported; supports docx/xlsx/pdf where feasible; returns branded output.
- FR29 [Could]: Template categories/types admin
  - Acceptance: Admin CRUD for categories/types; FE filters reflect dynamic categories.

File storage
- FR30 [Must]: File upload/download/list (DB or Azure Blob per env)
  - Acceptance: Admin-only upload/delete; authenticated download; file type and size validation; dual storage strategy based on STORAGE_TYPE.
- FR31 [Should]: Azure Blob direct upload via SAS (POST /api/files/sas, POST /api/files/confirm)
  - Acceptance: Returns time-limited SAS for client upload; confirm endpoint persists metadata; validations enforced.
- FR32 [Should]: Company-scoped files
  - Acceptance: file_uploads includes company_id; non-admin access scoped to own company.

Payments and subscriptions (PayFast)
- FR33 [Must]: Initialize checkout (POST /api/payments/payfast/checkout)
  - Acceptance: Generates signed params from platform_settings; sandbox toggle; returns form fields for FE submission.
- FR34 [Must]: ITN verification (POST /api/payments/payfast/itn)
  - Acceptance: Verifies signature, validates IP whitelist, performs server-side post-back, enforces idempotency; updates payment status; logs audit; rejects invalid or replay attacks.
- FR35 [Must]: Payment records (payments table)
  - Acceptance: Persists each transaction with gateway response, invoice number, status timeline; provides list/detail for admin.
- FR36 [Must]: Subscription updates
  - Acceptance: On successful payment, updates users.subscription_tier and subscription_expiry; handles cancellations/expiry flows.
- FR37 [Should]: Subscription tiers configuration (subscription_tiers table)
  - Acceptance: Stores tier pricing/features/seat limits; drives UI/validation; admin CRUD.
- FR38 [Should]: Account lifecycle automation (daily jobs)
  - Acceptance: Warnings, grace period on expiry, retention and deletion windows; configurable windows; notifications sent.

API standardization and integration fixes
- FR39 [Must]: Base path normalization
  - Acceptance: FE default API base is /api/ (no /api/public default); vercel environment logic corrected.
- FR40 [Must]: Templates path normalization
  - Acceptance: FE uses /api/templates (no /api/platform/templates); all endpoints aligned to architecture spec.
- FR41 [Must]: Company users path normalization
  - Acceptance: Admin cross-company list uses /api/companies/:id/users; FE reflects this path.
- FR42 [Must]: Standard envelopes for list responses
  - Acceptance: All list endpoints return {success, items, page, pageSize, total, totalPages}.
- FR43 [Must]: Standard error envelope
  - Acceptance: Errors return {success:false, error, code, details?}; 4xx/5xx codes accurate.
- FR44 [Should]: Rate limit headers
  - Acceptance: Returns X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset on rate-limited endpoints.

Email service
- FR45 [Must]: SendGrid integration
  - Acceptance: Invite and password reset emails delivered via SendGrid; API key in Key Vault; templates versioned; retries and logging present.
- FR46 [Should]: Email templates
  - Acceptance: Branded, localized-ready templates for invites, resets, payment notices; preview artifacts stored.

Admin and settings
- FR47 [Must]: PayFast settings in platform_settings
  - Acceptance: Admin can configure merchantId, merchantKey, passPhrase, sandbox, return/cancel/notify URLs; validation of combinations; secrets in Key Vault.
- FR48 [Should]: Basic audit log viewer (admin)
  - Acceptance: Admin can filter/search recent audit events (auth, payments, SSO, user/company changes).

7) Non-Functional Requirements (NFR)
- NFR1 [Must]: Performance
  - Acceptance: p95 <200ms and p99 <500ms for API under expected load; key endpoints profiled; slow queries indexed.
- NFR2 [Must]: Availability
  - Acceptance: ≥99.9% monthly uptime for core endpoints; health endpoints and readiness/liveness checks implemented.
- NFR3 [Must]: Security
  - Acceptance: OWASP Top 10 mitigations; TLS 1.3; HSTS, CSP, X-Frame-Options, CORS whitelist; bcrypt cost 12; short-lived JWTs; DB token validation; annual pen-test readiness.
- NFR4 [Must]: Privacy and compliance
  - Acceptance: GDPR-aligned data export/deletion processes; PII inventory documented; privacy policy and consent flows implemented.
- NFR5 [Must]: Tenant isolation
  - Acceptance: Isolation test suite passes 100%; no cross-tenant access paths exist.
- NFR6 [Must]: Observability
  - Acceptance: Azure App Insights telemetry (traces, metrics, logs) with correlation IDs; dashboards and alerts for auth failures, ITN errors, and latency.
- NFR7 [Must]: Secrets management
  - Acceptance: All secrets (JWT secret, PayFast keys, SendGrid key) resolved from Azure Key Vault in production; no secrets in code or config files.
- NFR8 [Should]: Scalability
  - Acceptance: Horizontal scaling supported on App Service; DB connection pool limits tuned; Redis caching for tokens/rate limits where appropriate.
- NFR9 [Should]: Backup and recovery
  - Acceptance: Azure SQL PITR enabled (≥35 days); documented restore test at least once per quarter.
- NFR10 [Should]: Operational readiness
  - Acceptance: Runbooks for auth incidents, payment reconciliation, and ITN failures; logging includes enough context for diagnosis.

8) Technical Requirements (TR)
- TR1 [Must]: Database engine and schema
  - Acceptance: Azure SQL (SQL Server) as the only DB engine; schema matches architecture; migrations created for missing tables.
- TR2 [Must]: Backend stack
  - Acceptance: Node 18+/Express with TypeScript; mssql driver; consistent code style and linting; configuration via env and Key Vault.
- TR3 [Must]: Rate limiting and lockout
  - Acceptance: express-rate-limit (or equivalent) plus Redis store for distributed counters; lockout persisted and enforced.
- TR4 [Must]: API versioning policy
  - Acceptance: Current: /api/ without version; plan for /api/v2 when breaking changes; deprecation policy documented (≥6 months).
- TR5 [Should]: Redis integration
  - Acceptance: Azure Redis for sessions, token cache, rate limits; secure TLS connection; credentials in Key Vault.
- TR6 [Should]: Automated tests
  - Acceptance: Unit/integration for auth, isolation, payments; SSO flow tests; CI pipeline blocks on failures.
- TR7 [Should]: Static analysis and formatting
  - Acceptance: ESLint/Prettier enforced in CI; type-checks pass.

9) Integration Requirements (IR)
- IR1 [Must]: PayFast
  - Acceptance: Server-side signature verification; IP whitelist checks; server post-back validation; idempotent ITN handling; sandbox/production switch; retries with backoff.
- IR2 [Must]: SendGrid
  - Acceptance: Template-based transactional emails; error handling and retries; secrets in Key Vault; rate-limiting compliance.
- IR3 [Must]: Azure Blob
  - Acceptance: Direct SAS uploads supported (Should); container lifecycle policies; content-type and antivirus scanning (if feasible).
- IR4 [Must]: Azure App Insights
  - Acceptance: End-to-end tracing with operation IDs; custom events for auth, SSO, payments.

10) Data Requirements (DR)
- DR1 [Must]: Create missing tables
  - Acceptance: company_invitations, password_resets, payments, subscription_tiers exist with appropriate PK/FK, indexes, and expiry semantics.
- DR2 [Must]: Strengthen constraints
  - Acceptance: FKs for company_id fields; unique indexes for domains and tokens; auditing tables as per SSO and auth requirements.
- DR3 [Should]: Update file_uploads
  - Acceptance: Add company_id and appropriate indexes; enforce scoping.

11) API Requirements (AR)
- AR1 [Must]: Standard list envelope
  - Acceptance: All list endpoints return {success, items, page, pageSize, total, totalPages}.
- AR2 [Must]: Error format
  - Acceptance: {success:false, error, code, details?}; consistent HTTP status semantics.
- AR3 [Must]: Paths normalized
  - Acceptance: /api/auth, /api/applications, /api/templates, /api/company, /api/companies/:id/users; FE updated accordingly.
- AR4 [Should]: Rate-limit headers
  - Acceptance: Return limits and reset timestamps on rate-limited endpoints.

12) Assumptions and constraints
- Single Azure SQL instance is used for all tenants; strict application-level isolation enforced.
- Production uses custom JWT as primary auth; AAD B2C routes are disabled in production and only permitted under a feature flag in non-prod.
- Domains/subdomains for applications are provisioned and secured outside of this MVP scope, but registry and SSO endpoints are managed within BM.

13) Risks and mitigations
- R1: Cross-tenant data leakage due to missing filters
  - Mitigation: Mandatory global scoping middleware (FR8) + isolation test suite (FR10) + code reviews.
- R2: Payment fraud or reconciliation errors
  - Mitigation: Full ITN verification (FR34), idempotency keys, audit logs, regular reconciliation reports.
- R3: Auth system inconsistencies (AAD B2C vs custom)
  - Mitigation: Feature flag strategy; production policy enforcement; remove AAD B2C paths from prod routing.
- R4: API instability impacting FE
  - Mitigation: Path normalization (FR39–FR41), envelope standardization (FR42–FR43), contract tests in CI.
- R5: Secrets exposure
  - Mitigation: Strict Key Vault usage (NFR7), secret scanning in CI, no plaintext secrets in repos.

14) Dependencies
- DNS and SSL provisioning for application subdomains (operations).
- SendGrid account and template setup.
- PayFast merchant accounts (sandbox and production).
- Azure resources: App Service, Azure SQL, Key Vault, Redis, Blob Storage, App Insights.

15) Release plan (phased)
- Milestone 1 (P1, 2 weeks)
  - FR1–FR6 (custom auth), FR8–FR10 (isolation), FR33–FR36 (payments ITN + records), FR39–FR43 (API standardization), FR45 (SendGrid), plus essential NFRs (NFR1–NFR3, NFR7).
  - Deliverables: Working custom auth, secured tenant isolation, verified payments, consistent API, reset/invite emails.
- Milestone 2 (P2, 3–4 weeks)
  - FR13–FR17 (invitations + admin users), FR18–FR19 (SSO registry), FR24 (deployment checklist), FR28 (template personalization), FR31–FR32 (SAS + file scoping), FR37–FR38 (tier config + lifecycle), NFR4–NFR6, TR6.
- Milestone 3 (P3, 2–3 weeks)
  - FR29, FR48; notifications and analytics foundations; AR4; polish and documentation.

16) Open questions
- Should we support refresh tokens now or later? If later, add roadmap item and token rotation policy.
- Exact password complexity policy (current: min 8 with upper/lower/number)—do we also require symbols?
- Seat limits per tier (numbers and enforcement behavior)—block or warn when exceeding?
- Template personalization formats MVP: which file types first (docx only vs docx + pdf)?
- Payment invoicing format and numbering policy—do we auto-generate and store PDFs?
- Email branding content and localization requirements.
