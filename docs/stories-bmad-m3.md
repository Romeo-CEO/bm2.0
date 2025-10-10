# Milestone 3 – BMAD Stories (Create-Story Template)

Note: Stories follow BMAD create-story template (bmm/workflows/4-implementation/create-story/template.md). Epic numbering uses M3.<epic>.<story>.

---
# Story M3.1.1: Template Categories/Types – Admin Management

Status: Draft

## Story
As a Platform Admin,
I want to manage template categories and types,
so that the catalog is organized and filterable.

## Acceptance Criteria
1. Admin CRUD for categories and (optional) template types; FE filters reflect dynamic categories.
2. Backward compatibility: existing templates mapped to default categories when none provided.
3. Validations: unique category names; safe deletes or soft-deletes with reassignment.

## Tasks / Subtasks
- [ ] Implement categories/types storage (table or reuse fields) and admin endpoints
- [ ] Update templatesController list filters and detail payloads
- [ ] FE filters integration guidance; smoke tests

### References
- docs/prd.md FR29

---
# Story M3.2.1: Audit Log Viewer (Admin)

Status: Draft

## Story
As a Platform Admin,
I want to browse and filter audit events (auth, payments, SSO, user/company changes),
so that I can investigate and monitor system activity.

## Acceptance Criteria
1. Admin endpoint(s) list and filter audit events by type, date, actor, outcome.
2. Pagination and sorting supported; response envelope standardized.
3. PII minimized in logs; links to related records provided when safe.

## Tasks / Subtasks
- [ ] Define unified audit query endpoint(s) and filters
- [ ] Implement pagination and indexing for performance
- [ ] Tests for filters and data exposure rules

### References
- docs/prd.md FR48, NFR6

---
# Story M3.3.1: Notifications Foundation (System Skeleton)

Status: Draft

## Story
As a Platform Admin,
I want a basic notifications foundation,
so that we can send critical product notices to users.

## Acceptance Criteria
1. Schema for notifications and notification_preferences created; minimal API for creating and listing notifications.
2. Email dispatch leverages existing SendGrid integration; in-app notifications stored but minimal UI assumed.
3. Rate limiting and deduplication safeguards applied.

## Tasks / Subtasks
- [ ] Create schema and minimal APIs
- [ ] Hook into lifecycle jobs for expiry warnings
- [ ] Tests for delivery and preferences

### References
- docs/analysis/current-state-analysis.md §16.4 (Not implemented)
- docs/prd.md P3 “Notifications foundation”

---
# Story M3.4.1: Analytics Foundations – Usage Metrics

Status: Draft

## Story
As a Product Owner,
I want usage metrics for app launches and template downloads,
so that we can understand adoption and inform roadmap.

## Acceptance Criteria
1. Track app launch counts, unique users, and company-level metrics; template downloads similarly.
2. Events emitted to App Insights with dimensions (companyId, appId/templateId, tier, role).
3. Basic visualization dashboards assembled in App Insights Workbooks.

## Tasks / Subtasks
- [ ] Instrument controllers to emit events with correlation
- [ ] Create dashboards/queries/workbooks
- [ ] Document metrics dictionary

### References
- docs/prd.md NFR6, M3 “analytics foundations”

---
# Story M3.5.1: Rate-Limit Headers Across Endpoints

Status: Draft

## Story
As an API Consumer,
I want consistent X-RateLimit-* headers on rate-limited endpoints,
so that clients can handle backoff gracefully.

## Acceptance Criteria
1. Endpoints with rate limiting return X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset.
2. Works with chosen rate limiter implementation (Redis store in prod); tested under burst.

## Tasks / Subtasks
- [ ] Extend rate limiter middleware to inject headers
- [ ] Tests for headers and reset computations

### References
- docs/prd.md AR4, FR44

---
# Story M3.6.1: Product Polish & Documentation Updates

Status: Draft

## Story
As an Engineering Team,
I want consistent documentation and error semantics,
so that developers and users have a reliable experience.

## Acceptance Criteria
1. Error responses audited and standardized across all controllers (shape and HTTP codes).
2. PRD alignment: docs updated for paths, envelopes, and features; deprecation/versioning notes added.
3. Dev runbooks extended (payments reconciliation, auth incidents) and linked in repo.

## Tasks / Subtasks
- [ ] Review controllers for error shapes/codes and fix inconsistencies
- [ ] Update docs (API, PRD deltas, onboarding)
- [ ] Extend runbooks and link to App Insights dashboards

### References
- docs/prd.md FR43, TR4, NFR10

---
# Story M3.6.2: Post-Release Hardening – Contract Tests and Smoke Packs

Status: Draft

## Story
As a QA Engineer,
I want contract tests and smoke test packs across core flows,
so that we detect breaking changes early post-release.

## Acceptance Criteria
1. Contract tests for FE/BE endpoints covering normalized paths and envelopes pass in CI.
2. Smoke test pack for auth, SSO, payments, templates, and marketplace executes under staging.

## Tasks / Subtasks
- [ ] Implement contract tests and add to CI gating
- [ ] Implement smoke pack and staging harness

### References
- docs/prd.md AR1–AR3, TR6

---
