# Milestone 2 – BMAD Stories (Create-Story Template)

Note: Stories follow BMAD create-story template (bmm/workflows/4-implementation/create-story/template.md). Epic numbering uses M2.<epic>.<story>.

---
# Story M2.1.1: Company User Invitation – Create and Send

Status: Draft

## Story
As a Company Admin,
I want to invite a user by email to join my company,
so that we can collaborate within our tenant.

## Acceptance Criteria
1. POST /api/company/users/invite creates company_invitations record with token, expiry (≤7 days), status=pending.
2. Seat limit check runs before generating token; if exceeded, returns 409 with error code SEAT_LIMIT_EXCEEDED.
3. SendGrid email sent with acceptance link; retries with logging.
4. API returns {success:true} and does not leak internal token.
5. Audit event stored with invited_by, email, company_id.

## Tasks / Subtasks
- [ ] Migration for company_invitations (if missing): indexes on (company_id), (email), (status, expires_at)
- [ ] Implement endpoint: validation, seat check, token creation, email dispatch
- [ ] Configure templates and links for acceptance
- [ ] Tests: happy path, seat exceeded, invalid email, email send failure retry

## Dev Notes
- Token should be single-use and cryptographically strong; store hashed token if feasible.

### Project Structure Notes
- backend/src/controllers/companyUsersController.ts (or companyProfileController.ts)
- backend/src/services/emailService.ts (SendGrid)
- backend/src/db/migrations

### References
- docs/prd.md FR14, FR37, FR45, DR1
- docs/analysis/current-state-analysis.md §2.2, §16.1

## Dev Agent Record

---
# Story M2.1.2: Invitation Acceptance Flow

Status: Draft

## Story
As an Invited User,
I want to accept an invitation securely,
so that I can join the company and sign in.

## Acceptance Criteria
1. GET /api/company/users/invite/validate?token returns status (valid/expired/used) without revealing company details.
2. POST /api/company/users/invite/accept with token + password creates user if not existing, assigns to company, marks invitation accepted.
3. Password policy enforced; JWT issued on success; audit logged.
4. Token single-use; subsequent attempts return 400/410.

## Tasks / Subtasks
- [ ] Implement validate endpoint and accept endpoint
- [ ] Enforce password complexity and hashing; mark invitation accepted_at
- [ ] Auto-assign company_admin=0
- [ ] Tests: valid, expired, used token; existing email path

### References
- docs/prd.md FR14, FR2, DR1

---
# Story M2.1.3: Invitation Resend/Cancel

Status: Draft

## Story
As a Company Admin,
I want to resend or cancel a pending invitation,
so that I can manage invites effectively.

## Acceptance Criteria
1. POST /api/company/users/:id/resend-invite regenerates token, resets expiry, sends email (if pending), audits.
2. POST /api/company/users/invite/:inviteId/cancel sets status=cancelled; cannot be accepted afterward; audits.
3. Only company_admin for the same company or platform admin may perform actions.

## Tasks / Subtasks
- [ ] Implement endpoints and permission checks
- [ ] Update email dispatch
- [ ] Tests for permission boundaries and statuses

### References
- docs/prd.md FR14

---
# Story M2.1.4: Remove User from Company

Status: Draft

## Story
As a Company Admin,
I want to remove a user from my company,
so that I can manage seats and access.

## Acceptance Criteria
1. DELETE /api/company/users/:id removes company association (sets company_id=NULL or removes junction as per schema).
2. Self-removal blocked if last company_admin; must transfer admin role.
3. Audit recorded with actor and target user.

## Tasks / Subtasks
- [ ] Implement endpoint with safety checks
- [ ] Tests: last admin case, permission checks, audit

### References
- docs/prd.md FR15

---
# Story M2.1.5: Create User with Temporary Password

Status: Draft

## Story
As a Company Admin,
I want to create a user with a temporary password,
so that I can onboard users who don’t accept email invites.

## Acceptance Criteria
1. POST /api/users creates user with temp password and optional company assignment; emails temp password via SendGrid.
2. Enforces seat limit and password policy.
3. Audit recorded; response hides temp password for security.

## Tasks / Subtasks
- [ ] Implement endpoint and email notification
- [ ] Tests: seat limit, permission checks, email send

### References
- docs/prd.md FR16, FR37, FR45

---
# Story M2.1.6: Get User by ID (Role-Scoped)

Status: Draft

## Story
As an Admin or Company Admin,
I want to fetch a user by ID with proper scoping,
so that I can view and manage user details.

## Acceptance Criteria
1. GET /api/users/:id returns user for admin; company_admin restricted to own company users.
2. 404 for non-existent; 403 for unauthorized.

## Tasks / Subtasks
- [ ] Implement endpoint with scoping checks
- [ ] Tests for role boundaries and not-found

### References
- docs/prd.md FR17, FR9

---
# Story M2.2.1: SSO Application Registry – Admin CRUD

Status: Draft

## Story
As a Platform Admin,
I want to manage the registry of SSO applications,
so that I can enable, disable, or configure app SSO endpoints.

## Acceptance Criteria
1. Admin CRUD for sso_applications with unique domain validation and sso_enabled toggle.
2. Validation prevents duplicate names/domains; updates audited.
3. Read APIs available for FE admin UI.

## Tasks / Subtasks
- [ ] Implement CRUD endpoints and validations
- [ ] Tests: duplicates, toggling, permissions

### References
- docs/prd.md FR19

---
# Story M2.3.1: Marketplace Deployment Checklist APIs

Status: Draft

## Story
As a Platform Admin,
I want to query deployment readiness for an application,
so that I can verify SSL, DNS, catalog, and launcher before going live.

## Acceptance Criteria
1. GET /api/applications/:id/deployment-checklist returns statuses: SSL cert, DNS CNAME, catalog listing, launcher configured, metadata completeness.
2. POST /api/applications/:id/deploy validates readiness and sets status accordingly; audits action.

## Tasks / Subtasks
- [ ] Implement checklist computation and underlying checks
- [ ] Implement deploy endpoint state transitions
- [ ] Tests for each checklist item

### References
- docs/analysis/current-state-analysis.md §11.1 (Deployment System)
- docs/prd.md FR24

---
# Story M2.4.1: Template Personalization – DOCX Engine (Phase 1)

Status: Draft

## Story
As a Company User,
I want downloaded DOCX templates personalized with my company branding,
so that they are ready to use.

## Acceptance Criteria
1. GET /api/templates/download/:id returns DOCX with placeholders replaced: {{company.name}}, {{company.email}}, {{company.phone}}, {{company.address}}.
2. Company logo embedded when available; color theme applied (primary/secondary).
3. Tier access enforced; admin bypass; audit download event.

## Tasks / Subtasks
- [ ] Integrate docxtemplater (or library of choice) and placeholder mapping
- [ ] Logo retrieval and image processing (sharp)
- [ ] Color theme application strategy
- [ ] Tests: sample templates, branding fields present, fallbacks

### References
- docs/architecture/system-architecture.md §10.2
- docs/prd.md FR28

---
# Story M2.4.2: Template Personalization – PDF/XLSX Support (Phase 2)

Status: Draft

## Story
As a Company User,
I want PDF/XLSX templates personalized similarly to DOCX,
so that all supported formats carry branding.

## Acceptance Criteria
1. For supported PDFs, apply text and image placeholders; or generate PDF from DOCX pipeline when feasible.
2. For XLSX, implement placeholder replacement and color theming.
3. Audit for each download; unsupported formats return 415.

## Tasks / Subtasks
- [ ] Implement pdf-lib/pdfkit pipeline
- [ ] Implement xlsx replacement paths
- [ ] Tests for both formats

### References
- docs/architecture/system-architecture.md §10.2.3
- docs/prd.md FR28

---
# Story M2.5.1: Azure Blob Direct Upload via SAS

Status: Draft

## Story
As a Frontend User,
I want to upload files directly to Azure Blob via SAS,
so that uploads are fast and scalable.

## Acceptance Criteria
1. POST /api/files/sas returns time-limited SAS URL with required permissions for a specific blob name.
2. POST /api/files/confirm persists metadata (file name/type/size, blob url, checksum) after successful upload.
3. Validations enforce file type/size limits; audit created.

## Tasks / Subtasks
- [ ] Implement SAS generation with least privileges
- [ ] Implement confirm endpoint and metadata persistence
- [ ] Tests: expiry, permissions, invalid confirm

### References
- docs/architecture/system-architecture.md §12.2.2
- docs/prd.md FR31

---
# Story M2.5.2: Company-Scoped Files

Status: Draft

## Story
As a Company Admin,
I want files to be scoped to my company,
so that users from other companies cannot access them.

## Acceptance Criteria
1. file_uploads table includes company_id; non-admin access limited to own company.
2. Backfill or migration plan documented for existing files.
3. Tests ensure scoping applied in list/download/delete.

## Tasks / Subtasks
- [ ] Schema update to add company_id and indexes
- [ ] Controller scoping enforcement
- [ ] Tests for scoping and backfill plan

### References
- docs/prd.md FR32, DR3

---
# Story M2.6.1: Subscription Tiers Configuration

Status: Draft

## Story
As a Platform Admin,
I want to configure subscription tiers with pricing, features, and seat limits,
so that enforcement and UI reflect product packaging.

## Acceptance Criteria
1. subscription_tiers table stores slug, pricing, currency, max_users, features, applications_included, templates_included.
2. Admin CRUD endpoints and validations exist; FE reads for pricing pages.
3. Enforcement hooks for seat limit called by invites/user creation.

## Tasks / Subtasks
- [ ] Migration for subscription_tiers and data access
- [ ] Admin CRUD endpoints
- [ ] Wire seat limit checks in invite/create-user flows
- [ ] Tests for validation and enforcement

### References
- docs/analysis/current-state-analysis.md §13.3
- docs/prd.md FR37

---
# Story M2.6.2: Account Lifecycle Automation (Jobs)

Status: Draft

## Story
As a Platform Admin,
I want automated lifecycle jobs for trials and expiries,
so that account states remain consistent and users receive notices.

## Acceptance Criteria
1. Daily jobs compute expiring trials, start grace period on expiry, and finalize retention deletions per configured windows.
2. Notices queued via email service (at least warnings and expiry notices).
3. Audit events recorded; idempotent job runs.

## Tasks / Subtasks
- [ ] Implement scheduled job runners (App Service WebJobs/Timer)
- [ ] Queries for expiring/expired/deletion candidates
- [ ] Email notifications
- [ ] Tests with fixed clocks

### References
- docs/architecture/system-architecture.md §11.3.2
- docs/prd.md FR38

---
# Story M2.7.1: Privacy and Compliance – Data Export/Delete

Status: Draft

## Story
As a Data Subject (through Admin requests),
I want data export and deletion capabilities,
so that the platform aligns with privacy requirements.

## Acceptance Criteria
1. Admin-initiated export for a user and company produces machine-readable archive of PII where applicable.
2. Admin-initiated delete respects retention policies; soft-delete or redaction patterns documented.
3. Actions audited; protected roles/data exempted as required.

## Tasks / Subtasks
- [ ] Identify PII fields and data map
- [ ] Implement export generator and secure download
- [ ] Implement delete/redaction workflow with safeguards
- [ ] Tests and documentation

### References
- docs/prd.md NFR4

---
# Story M2.7.2: Observability Enhancements – Tracing, Dashboards, Alerts

Status: Draft

## Story
As an SRE,
I want end-to-end tracing and dashboards for auth, SSO, and payments,
so that we can detect and respond to issues quickly.

## Acceptance Criteria
1. Correlation IDs propagate across requests; App Insights collects traces/metrics/logs.
2. Dashboards for auth success/failure, ITN outcomes, SSO flows; alerts for error thresholds and latency.
3. Runbooks documented.

## Tasks / Subtasks
- [ ] Add middleware to assign/propagate correlation IDs
- [ ] Instrument key flows and custom metrics
- [ ] Create dashboards and alerts; write runbooks

### References
- docs/prd.md NFR6, NFR10

---
# Story M2.7.3: Automated Tests Coverage for M2 Features

Status: Draft

## Story
As a QA Engineer,
I want automated unit/integration tests for M2,
so that regressions are caught in CI.

## Acceptance Criteria
1. Tests cover invitations, SSO registry, checklist APIs, personalization, SAS flows, tiers config, lifecycle jobs.
2. CI blocks on failures; reports generated.

## Tasks / Subtasks
- [ ] Implement test suites and data fixtures
- [ ] CI integration and reporting

### References
- docs/prd.md TR6

---
