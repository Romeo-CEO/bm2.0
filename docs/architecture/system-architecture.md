# Business Manager - System Architecture Document

**Document Version:** 1.0
**Date:** 2025-10-09
**Status:** Draft
**Author:** System Architecture Team

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [System Overview](#2-system-overview)
3. [Authentication Architecture](#3-authentication-architecture)
4. [Multi-Tenant Architecture](#4-multi-tenant-architecture)
5. [Database Architecture](#5-database-architecture)
6. [API Architecture](#6-api-architecture)
7. [Security Architecture](#7-security-architecture)
8. [SSO Architecture](#8-sso-architecture)
9. [Frontend Architecture](#9-frontend-architecture)
10. [Deployment Architecture](#10-deployment-architecture)
11. [Data Flow Diagrams](#11-data-flow-diagrams)
12. [Integration Points](#12-integration-points)
13. [Scalability & Performance](#13-scalability--performance)
14. [Monitoring & Observability](#14-monitoring--observability)

---

## 1. Executive Summary

Business Manager is a **multi-tenant B2B SaaS platform** that serves as a central authentication hub and application marketplace for business tools. It is NOT the applications themselves - it's the gateway that manages users, companies, subscriptions, and provides SSO to separately-hosted applications.

### 1.1 Core Capabilities

1. **Central Company Account Management** - Multi-user company workspaces with admin controls
2. **Application Marketplace** - Browse and launch business applications via SSO
3. **Template Library** - Downloadable business templates with company branding
4. **Single Sign-On Hub** - Seamless authentication across multiple business applications
5. **Subscription Management** - Tiered access control (Trial, DIY, DIY+Accountant)

### 1.2 Key Architectural Principles

- **Multi-Tenancy First** - Complete data isolation between companies
- **Security by Default** - Every layer includes security controls
- **API-First Design** - Clean REST API contracts
- **Cloud-Native** - Designed for Azure infrastructure
- **Provider-Agnostic SSO** - Authentication provider independence
- **Performance** - Sub-200ms API response times
- **Scalability** - Horizontal scaling for high availability

---

## 2. System Overview

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT TIER                               │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐   │
│  │  Web Browser   │  │  Mobile App    │  │  Desktop App   │   │
│  │  (React SPA)   │  │  (Future)      │  │  (Future)      │   │
│  └────────┬───────┘  └────────┬───────┘  └────────┬───────┘   │
└───────────┼──────────────────┼──────────────────┼─────────────┘
            │                  │                  │
            └──────────────────┴──────────────────┘
                               │
                    HTTPS (TLS 1.3)
                               │
┌──────────────────────────────┼───────────────────────────────────┐
│                    APPLICATION TIER                               │
│                               │                                   │
│  ┌────────────────────────────▼─────────────────────────────┐   │
│  │           API Gateway / Load Balancer                     │   │
│  │           (Azure App Service / Azure Front Door)          │   │
│  └────────────────────────────┬─────────────────────────────┘   │
│                               │                                   │
│  ┌────────────────────────────▼─────────────────────────────┐   │
│  │           Express.js API Server (Node.js)                 │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │   │
│  │  │  Auth        │  │  User Mgmt   │  │  Company     │   │   │
│  │  │  Controllers │  │  Controllers │  │  Controllers │   │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘   │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │   │
│  │  │  SSO Service │  │  File Svc    │  │  Payment Svc │   │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘   │   │
│  └────────────────────────────┬─────────────────────────────┘   │
└───────────────────────────────┼───────────────────────────────────┘
                                │
┌───────────────────────────────┼───────────────────────────────────┐
│                      DATA TIER                                    │
│                                │                                   │
│  ┌─────────────────────────────▼────────────────────────────┐    │
│  │           Azure SQL Database (Primary)                    │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐  │    │
│  │  │  users   │  │companies │  │auth_tokens│  │sso_*    │  │    │
│  │  └──────────┘  └──────────┘  └──────────┘  └─────────┘  │    │
│  └───────────────────────────────────────────────────────────┘    │
│                                                                    │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │           Azure Blob Storage (Files)                        │  │
│  │  - Company logos  - Template files  - User uploads         │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │           Azure Redis Cache (Sessions, Tokens)              │  │
│  │  - Token validation cache  - Rate limiting  - Sessions     │  │
│  └────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────┐
│                    EXTERNAL SERVICES                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐            │
│  │  PayFast     │  │  SendGrid    │  │  App Insights│            │
│  │  (Payments)  │  │  (Email)     │  │  (Monitoring)│            │
│  └──────────────┘  └──────────────┘  └──────────────┘            │
└────────────────────────────────────────────────────────────────────┘
```

### 2.2 Technology Stack

**Frontend:**
- React 18 (UI framework)
- TypeScript (type safety)
- Vite (build tool)
- Tailwind CSS (styling)
- shadcn/ui (component library)

**Backend:**
- Node.js 18+ (runtime)
- Express.js (web framework)
- TypeScript (type safety)
- mssql (SQL Server driver)

**Database:**
- Azure SQL Database (production)
- SQL Server Express (local development)

**Storage:**
- Azure Blob Storage (production files)
- Database VARBINARY (development files)

**Infrastructure:**
- Azure App Service (hosting)
- Azure SQL Database (database)
- Azure Blob Storage (files)
- Azure Key Vault (secrets)
- Azure Front Door (CDN)
- Azure Application Insights (monitoring)

**External Services:**
- PayFast (payment gateway - South African market)
- SendGrid (email delivery)

---

## 3. Authentication Architecture

### 3.1 Authentication Strategy

**Primary Method:** Custom JWT (JSON Web Tokens)
**Provider:** Platform-native (not Azure AD B2C)
**Storage:** Database-backed token validation
**Security:** bcrypt password hashing, rate limiting, account lockout

### 3.2 Authentication Flow

#### 3.2.1 User Registration Flow

```
┌─────────┐                                              ┌─────────┐
│ Browser │                                              │  API    │
└────┬────┘                                              └────┬────┘
     │                                                        │
     │  POST /api/auth/register                              │
     │  { email, password, firstName, lastName,              │
     │    companyName, subscriptionTier }                    │
     ├───────────────────────────────────────────────────────>│
     │                                                        │
     │                                          ┌─────────────┴──────────┐
     │                                          │ 1. Validate input      │
     │                                          │ 2. Check email unique  │
     │                                          │ 3. Hash password       │
     │                                          │    (bcrypt cost 12)    │
     │                                          │ 4. Create company      │
     │                                          │ 5. Create user         │
     │                                          │    (role='user',       │
     │                                          │     company_admin=true)│
     │                                          │ 6. Generate JWT        │
     │                                          │ 7. Store in auth_tokens│
     │                                          │ 8. Log audit event     │
     │                                          └─────────────┬──────────┘
     │                                                        │
     │  { success: true, token: "jwt...", user: {...} }      │
     │<───────────────────────────────────────────────────────┤
     │                                                        │
     │  Store token in localStorage                           │
     │  Store user in localStorage                            │
     │                                                        │
```

**Security Controls:**
- Email format validation
- Password complexity requirements (min 8 chars, 1 upper, 1 lower, 1 number)
- Rate limiting: 5 registration attempts per hour per IP
- Email uniqueness check
- Password hashing with bcrypt cost factor 12
- Audit logging of registration events

#### 3.2.2 User Login Flow

```
┌─────────┐                                              ┌─────────┐
│ Browser │                                              │  API    │
└────┬────┘                                              └────┬────┘
     │                                                        │
     │  POST /api/auth/login                                 │
     │  { email, password }                                  │
     ├───────────────────────────────────────────────────────>│
     │                                                        │
     │                                          ┌─────────────┴──────────┐
     │                                          │ 1. Validate input      │
     │                                          │ 2. Load user by email  │
     │                                          │ 3. Check is_active=1   │
     │                                          │ 4. Check failed_logins │
     │                                          │    < 5 (account lock)  │
     │                                          │ 5. Verify password     │
     │                                          │    (bcrypt.compare)    │
     │                                          │ 6. Reset failed_logins │
     │                                          │ 7. Generate JWT        │
     │                                          │    (exp: 1h)           │
     │                                          │ 8. Store in auth_tokens│
     │                                          │ 9. Update last_login   │
     │                                          │10. Log audit event     │
     │                                          └─────────────┬──────────┘
     │                                                        │
     │  { success: true, token: "jwt...", user: {...} }      │
     │<───────────────────────────────────────────────────────┤
     │                                                        │
     │  Store token in localStorage                           │
     │  Store user in localStorage                            │
     │                                                        │
```

**Security Controls:**
- Rate limiting: 10 login attempts per hour per IP, 5 per email
- Account lockout: 5 failed attempts = 30 minute lock
- Generic error messages (prevent user enumeration)
- Audit logging of all login attempts (success and failure)
- Failed login counter tracking
- Active status check

#### 3.2.3 Authenticated Request Flow

```
┌─────────┐                                              ┌─────────┐
│ Browser │                                              │  API    │
└────┬────┘                                              └────┬────┘
     │                                                        │
     │  GET /api/company/profile                             │
     │  Authorization: Bearer eyJhbGc...                     │
     ├───────────────────────────────────────────────────────>│
     │                                                        │
     │                                          ┌─────────────┴──────────┐
     │                                          │ authenticateToken      │
     │                                          │ Middleware:            │
     │                                          │                        │
     │                                          │ 1. Extract token from  │
     │                                          │    Authorization header│
     │                                          │ 2. Verify JWT signature│
     │                                          │    (jwt.verify)        │
     │                                          │ 3. Check expiry        │
     │                                          │ 4. Check token exists  │
     │                                          │    in auth_tokens table│
     │                                          │ 5. Load user from DB   │
     │                                          │    (include company_id)│
     │                                          │ 6. Check is_active=1   │
     │                                          │ 7. Populate req.user   │
     │                                          │ 8. Call next()         │
     │                                          └─────────────┬──────────┘
     │                                                        │
     │                                          ┌─────────────┴──────────┐
     │                                          │ Controller:            │
     │                                          │                        │
     │                                          │ 1. Access req.user     │
     │                                          │ 2. Filter by companyId │
     │                                          │ 3. Execute query       │
     │                                          │ 4. Return scoped data  │
     │                                          └─────────────┬──────────┘
     │                                                        │
     │  { success: true, data: {...} }                       │
     │<───────────────────────────────────────────────────────┤
     │                                                        │
```

**Security Controls:**
- JWT signature verification
- Database token validation (prevents reuse after logout)
- Token expiry enforcement
- User active status check
- Company-scoped data filtering

#### 3.2.4 Logout Flow

```
┌─────────┐                                              ┌─────────┐
│ Browser │                                              │  API    │
└────┬────┘                                              └────┬────┘
     │                                                        │
     │  POST /api/auth/logout                                │
     │  Authorization: Bearer eyJhbGc...                     │
     ├───────────────────────────────────────────────────────>│
     │                                                        │
     │                                          ┌─────────────┴──────────┐
     │                                          │ 1. Authenticate token  │
     │                                          │ 2. Delete from         │
     │                                          │    auth_tokens table   │
     │                                          │ 3. Log audit event     │
     │                                          └─────────────┬──────────┘
     │                                                        │
     │  { success: true }                                    │
     │<───────────────────────────────────────────────────────┤
     │                                                        │
     │  Remove token from localStorage                        │
     │  Remove user from localStorage                         │
     │  Redirect to login                                     │
     │                                                        │
```

### 3.3 Password Reset Flow

```
┌─────────┐                                              ┌─────────┐
│ Browser │                                              │  API    │
└────┬────┘                                              └────┬────┘
     │                                                        │
     │  POST /api/auth/password/forgot                       │
     │  { email }                                            │
     ├───────────────────────────────────────────────────────>│
     │                                                        │
     │                                          ┌─────────────┴──────────┐
     │                                          │ 1. Find user by email  │
     │                                          │ 2. Generate reset token│
     │                                          │    (crypto.randomUUID) │
     │                                          │ 3. Store in            │
     │                                          │    password_resets     │
     │                                          │    (expires: 1h)       │
     │                                          │ 4. Send email with link│
     │                                          │    (SendGrid)          │
     │                                          │ 5. Log audit event     │
     │                                          └─────────────┬──────────┘
     │                                                        │
     │  { success: true }                                    │
     │<───────────────────────────────────────────────────────┤
     │                                                        │
     │  [User receives email]                                 │
     │                                                        │
     │  User clicks link in email                             │
     │  https://app.com/reset-password?token=...             │
     │                                                        │
     │  POST /api/auth/password/reset                        │
     │  { token, newPassword }                               │
     ├───────────────────────────────────────────────────────>│
     │                                                        │
     │                                          ┌─────────────┴──────────┐
     │                                          │ 1. Validate token      │
     │                                          │ 2. Check expiry        │
     │                                          │ 3. Check not used      │
     │                                          │ 4. Validate password   │
     │                                          │ 5. Hash password       │
     │                                          │ 6. Update user         │
     │                                          │ 7. Mark token as used  │
     │                                          │ 8. Invalidate all      │
     │                                          │    auth_tokens         │
     │                                          │ 9. Log audit event     │
     │                                          └─────────────┬──────────┘
     │                                                        │
     │  { success: true }                                    │
     │<───────────────────────────────────────────────────────┤
     │                                                        │
```

### 3.4 JWT Token Structure

```json
{
  "userId": "uuid-here",
  "email": "user@company.com",
  "role": "user",
  "companyId": "uuid-here",
  "contextType": "platform",
  "iat": 1672531200,
  "exp": 1672534800
}
```

**Token Properties:**
- **Algorithm:** HS256 (HMAC with SHA-256)
- **Expiry:** 1 hour (configurable via `JWT_EXPIRES_IN`)
- **Secret:** Stored in Azure Key Vault (production) or `.env` (development)
- **Storage:** Database-backed (`auth_tokens` table) for validation and revocation

### 3.5 Security Features

**Password Security:**
- bcrypt hashing with cost factor 12
- Minimum 8 characters
- Must contain uppercase, lowercase, and number
- Password history (prevent reuse of last 3 passwords)

**Account Protection:**
- Rate limiting on login endpoint
- Account lockout after 5 failed attempts
- 30-minute lockout duration
- Email notification on account lockout

**Token Security:**
- Short-lived access tokens (1 hour)
- Database-backed validation
- Revocation on logout
- Invalid tokens deleted on expiry (cleanup job)

**Audit Logging:**
- All authentication events logged
- Failed login attempts tracked
- Password reset requests logged
- Account lockouts logged

---

## 4. Multi-Tenant Architecture

### 4.1 Tenancy Model

**Tenant = Company**
- Each company is a separate tenant
- Complete data isolation between companies
- Company admins manage their company's users
- Platform admins manage all companies

### 4.2 Data Isolation Strategy

#### 4.2.1 Database-Level Isolation

**Strategy:** Shared SQL Server row-level security enforced through `SESSION_CONTEXT`.

- **Single Azure SQL database.** Biz Manager continues to use the `dbo` schema while every application (e.g. ABC Costing) owns a dedicated schema such as `abc`.
- **Unified tenant identifier.** Application tables include `tenant_id UNIQUEIDENTIFIER NOT NULL` and reuse the Biz Manager `companies.id` value without additional mapping tables.
- **Session context from SSO.** When a user launches an application, the backend sets `SESSION_CONTEXT('tenant_id', @companyId)` on the SQL connection; the optional flag `SESSION_CONTEXT('allow_cross_tenant') = '1'` enables platform-admin overrides.

**Reusable predicate (`dbo.fn_tenant_rls_predicate`):**
```sql
CREATE FUNCTION dbo.fn_tenant_rls_predicate (@tenant_id UNIQUEIDENTIFIER)
RETURNS TABLE
WITH SCHEMABINDING
AS
RETURN
SELECT 1 AS fn_result
FROM (
    SELECT
        TRY_CONVERT(UNIQUEIDENTIFIER, SESSION_CONTEXT(N'tenant_id')) AS tenant_context,
        LOWER(CONVERT(NVARCHAR(10), SESSION_CONTEXT(N'allow_cross_tenant'))) AS admin_flag
) AS ctx
WHERE
    (ctx.tenant_context IS NOT NULL AND @tenant_id = ctx.tenant_context)
    OR (ctx.admin_flag IN (N'1', N'true', N'yes'));
```

**Security policy example (ABC Costing schema):**
```sql
ALTER SECURITY POLICY dbo.tenant_isolation_policy
  ADD FILTER PREDICATE dbo.fn_tenant_rls_predicate(tenant_id) ON abc.costing_projects,
  ADD BLOCK PREDICATE dbo.fn_tenant_rls_predicate(tenant_id) ON abc.costing_projects AFTER INSERT,
  ADD BLOCK PREDICATE dbo.fn_tenant_rls_predicate(tenant_id) ON abc.costing_projects AFTER UPDATE;
```

**Connection bootstrap:**
```sql
EXEC sp_set_session_context @key = N'tenant_id', @value = @companyId;
```

#### 4.2.2 Application-Level Isolation

**Middleware-Based Scoping:**

```typescript
// Global middleware: companyScopingMiddleware.ts
export const enforceCompanyScoping = (req, res, next) => {
  // Skip for platform admins
  if (req.user.role === 'admin') {
    return next();
  }

  // Ensure user has company_id
  if (!req.user.companyId) {
    return res.status(403).json({ error: 'No company association' });
  }

  // Inject company filter into request
  req.companyFilter = { company_id: req.user.companyId };
  next();
};
```

**Query-Level Enforcement:**

```typescript
// Example: Get company users
async getCompanyUsers(req, res) {
  const companyId = req.user.role === 'admin'
    ? req.params.companyId  // Admin can specify
    : req.user.companyId;   // Non-admin uses their own

  const users = await db.query(
    'SELECT * FROM users WHERE company_id = @companyId',
    { companyId }
  );

  res.json({ success: true, items: users });
}
```

### 4.3 Company Hierarchy

```
┌────────────────────────────────────┐
│          Platform Admin            │
│  (role='admin')                    │
│  - Manages all companies           │
│  - Full system access              │
└────────────┬───────────────────────┘
             │
             │ manages
             ▼
┌────────────────────────────────────┐
│          Company                   │
│  - Company profile                 │
│  - Subscription tier               │
│  - Branding settings               │
└────────────┬───────────────────────┘
             │
             │ contains
             ▼
┌────────────────────────────────────┐
│        Company Users               │
│  ┌──────────────┐                 │
│  │ Company Admin│ (company_admin=1)│
│  │ - Manage users                 │
│  │ - Company settings             │
│  └──────────────┘                 │
│  ┌──────────────┐                 │
│  │ Regular User │ (company_admin=0)│
│  │ - View/use resources           │
│  └──────────────┘                 │
└────────────────────────────────────┘
```

### 4.4 Multi-Tenant Security Controls

**1. Middleware Enforcement:**
```typescript
// Applied to all routes automatically
app.use('/api', authenticateToken);
app.use('/api', enforceCompanyScoping);
```

**2. Controller Validation:**
```typescript
// Double-check in sensitive operations
if (req.user.role !== 'admin' && req.user.companyId !== targetCompanyId) {
  return res.status(403).json({ error: 'Access denied' });
}
```

**3. Database Constraints:**
```sql
-- Foreign key ensures valid company reference
ALTER TABLE users
ADD CONSTRAINT FK_users_company
FOREIGN KEY (company_id) REFERENCES companies(id);
```

**4. Query Auditing:**
```typescript
// Log all cross-company access attempts
if (requestedCompanyId !== req.user.companyId) {
  auditLog.warn('Cross-company access attempt', {
    userId: req.user.id,
    userCompany: req.user.companyId,
    requestedCompany: requestedCompanyId
  });
}
```

**5. SQL Server RLS Enforcement:**
```sql
-- Enforced for every application schema (see Section 4.2.1)
ALTER SECURITY POLICY dbo.tenant_isolation_policy WITH (STATE = ON);
```

**6. Session Context Middleware (application backends):**
```typescript
// Express middleware inside each application service
await db.query(
  "EXEC sp_set_session_context @key=N'tenant_id', @value=@companyId",
  [companyId]
);
```

### 4.5 Multi-Tenant Data Access Patterns

**Pattern 1: Current User's Company Data**
```typescript
// Implicit scoping - uses req.user.companyId
GET /api/company/profile
GET /api/company/users
```

**Pattern 2: Specific Company Data (Admin Only)**
```typescript
// Explicit company ID - requires admin role
GET /api/companies/:companyId
GET /api/companies/:companyId/users
```

**Pattern 3: Cross-Company Operations (Platform Admin Only)**
```typescript
// No company filter - platform-wide view
GET /api/users  // All users across all companies
GET /api/companies  // All companies
```

---

## 5. Database Architecture

### 5.1 Database Schema Overview

**Database Engine:** SQL Server (Azure SQL Database)
**Schema Design:** Normalized relational model
**Isolation:** Company-scoped via foreign keys

### 5.2 Core Tables

#### 5.2.1 Users Table

```sql
CREATE TABLE users (
  -- Identity
  id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
  email NVARCHAR(255) UNIQUE NOT NULL,
  password_hash NVARCHAR(255) NOT NULL,

  -- Profile
  first_name NVARCHAR(100) NOT NULL,
  last_name NVARCHAR(100) NOT NULL,

  -- Authorization
  role NVARCHAR(20) DEFAULT 'user'
    CHECK (role IN ('admin', 'user')),
  company_id UNIQUEIDENTIFIER,
  company_admin BIT DEFAULT 0,

  -- Subscription
  subscription_tier NVARCHAR(20) DEFAULT 'trial'
    CHECK (subscription_tier IN ('trial', 'diy', 'diy_accountant')),
  subscription_expiry DATETIMEOFFSET,

  -- Status
  is_active BIT DEFAULT 1,
  failed_login_attempts INT DEFAULT 0,
  locked_until DATETIMEOFFSET NULL,
  last_login DATETIMEOFFSET NULL,

  -- Audit
  created_at DATETIMEOFFSET DEFAULT GETUTCDATE(),
  updated_at DATETIMEOFFSET DEFAULT GETUTCDATE(),

  -- Constraints
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL
);

-- Indexes
CREATE INDEX IX_users_email ON users(email);
CREATE INDEX IX_users_company_id ON users(company_id);
CREATE INDEX IX_users_subscription_tier ON users(subscription_tier);
CREATE INDEX IX_users_active ON users(is_active, subscription_expiry);
```

#### 5.2.2 Companies Table

```sql
CREATE TABLE companies (
  -- Identity
  id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
  name NVARCHAR(255) NOT NULL,
  domain NVARCHAR(255) NOT NULL,
  owner_id UNIQUEIDENTIFIER NOT NULL,

  -- Business Info
  industry NVARCHAR(100),
  size NVARCHAR(50),
  description NVARCHAR(MAX),
  tagline NVARCHAR(500),

  -- Contact
  website NVARCHAR(500),
  email NVARCHAR(255),
  phone NVARCHAR(50),
  address NVARCHAR(500),

  -- Branding
  logo_url NVARCHAR(MAX),
  primary_color NVARCHAR(20) DEFAULT '#173c5f',  -- Indigo Dye
  secondary_color NVARCHAR(20) DEFAULT '#32baec',  -- Process Cyan

  -- Status
  is_active BIT DEFAULT 1,

  -- Audit
  created_at DATETIMEOFFSET DEFAULT GETUTCDATE(),
  updated_at DATETIMEOFFSET DEFAULT GETUTCDATE(),

  -- Constraints
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE NO ACTION
);

-- Indexes
CREATE INDEX IX_companies_owner_id ON companies(owner_id);
CREATE INDEX IX_companies_domain ON companies(domain);
CREATE INDEX IX_companies_active ON companies(is_active);
```

#### 5.2.3 Auth Tokens Table

```sql
CREATE TABLE auth_tokens (
  -- Token
  token NVARCHAR(512) PRIMARY KEY,
  user_id UNIQUEIDENTIFIER NOT NULL,

  -- Metadata
  token_type NVARCHAR(20) DEFAULT 'access'
    CHECK (token_type IN ('access', 'refresh')),
  expires_at DATETIMEOFFSET NOT NULL,

  -- Context
  ip_address NVARCHAR(45),
  user_agent NVARCHAR(500),

  -- Audit
  created_at DATETIMEOFFSET DEFAULT GETUTCDATE(),
  last_used DATETIMEOFFSET DEFAULT GETUTCDATE(),

  -- Constraints
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX IX_auth_tokens_user_id ON auth_tokens(user_id);
CREATE INDEX IX_auth_tokens_expires ON auth_tokens(expires_at);
CREATE INDEX IX_auth_tokens_type ON auth_tokens(token_type);
```

#### 5.2.4 Company Invitations Table

```sql
CREATE TABLE company_invitations (
  -- Identity
  id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
  company_id UNIQUEIDENTIFIER NOT NULL,
  email NVARCHAR(255) NOT NULL,
  invited_by UNIQUEIDENTIFIER NOT NULL,

  -- Invitation
  token NVARCHAR(128) UNIQUE NOT NULL,
  make_company_admin BIT DEFAULT 0,

  -- Status
  status NVARCHAR(20) DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled')),

  -- Lifecycle
  expires_at DATETIMEOFFSET NOT NULL,
  accepted_at DATETIMEOFFSET NULL,

  -- Audit
  created_at DATETIMEOFFSET DEFAULT GETUTCDATE(),

  -- Constraints
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (invited_by) REFERENCES users(id) ON DELETE NO ACTION
);

-- Indexes
CREATE INDEX IX_invitations_company ON company_invitations(company_id);
CREATE INDEX IX_invitations_email ON company_invitations(email);
CREATE INDEX IX_invitations_token ON company_invitations(token);
CREATE INDEX IX_invitations_status ON company_invitations(status, expires_at);
```

#### 5.2.5 Password Resets Table

```sql
CREATE TABLE password_resets (
  -- Identity
  id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
  user_id UNIQUEIDENTIFIER NOT NULL,

  -- Reset Token
  token NVARCHAR(128) UNIQUE NOT NULL,

  -- Lifecycle
  expires_at DATETIMEOFFSET NOT NULL,
  used_at DATETIMEOFFSET NULL,

  -- Context
  ip_address NVARCHAR(45),

  -- Audit
  created_at DATETIMEOFFSET DEFAULT GETUTCDATE(),

  -- Constraints
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX IX_password_resets_user ON password_resets(user_id);
CREATE INDEX IX_password_resets_token ON password_resets(token);
CREATE INDEX IX_password_resets_expires ON password_resets(expires_at);
```

### 5.3 SSO Tables

(See [Section 8: SSO Architecture](#8-sso-architecture) for detailed SSO table schemas)

### 5.4 Applications & Templates Tables

```sql
CREATE TABLE applications (
  id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
  name NVARCHAR(255) NOT NULL,
  description NVARCHAR(MAX),
  category NVARCHAR(100) NOT NULL,
  type NVARCHAR(20) NOT NULL CHECK (type IN ('application', 'template')),
  url NVARCHAR(MAX),
  download_url NVARCHAR(MAX),

  -- Subscription Control
  subscription_tiers NVARCHAR(MAX) NOT NULL,  -- JSON array

  -- Status
  is_active BIT DEFAULT 1,

  -- Audit
  created_at DATETIMEOFFSET DEFAULT GETUTCDATE(),
  updated_at DATETIMEOFFSET DEFAULT GETUTCDATE()
);

CREATE TABLE templates (
  id NVARCHAR(64) PRIMARY KEY,
  name NVARCHAR(255) NOT NULL,
  description NVARCHAR(MAX),
  category NVARCHAR(100) NOT NULL,
  download_url NVARCHAR(MAX),
  file_name NVARCHAR(255),
  file_size NVARCHAR(50),
  file_type NVARCHAR(100),

  -- Subscription Control
  subscription_tiers NVARCHAR(MAX) NOT NULL,  -- JSON array

  -- Status
  is_active BIT DEFAULT 1,

  -- Audit
  created_at DATETIMEOFFSET DEFAULT GETUTCDATE(),
  updated_at DATETIMEOFFSET DEFAULT GETUTCDATE()
);
```

### 5.5 Entity Relationship Diagram

```
┌─────────────────┐
│    companies    │
│                 │
│  id (PK)        │
│  name           │◄────┐
│  owner_id (FK)  │     │
│  domain         │     │
│  ...            │     │
└────────┬────────┘     │
         │              │
         │ 1            │
         │              │
         │              │
         │ *            │
         ▼              │
┌─────────────────┐     │
│     users       │     │
│                 │     │
│  id (PK)        ├─────┘ owner
│  email          │
│  password_hash  │
│  company_id(FK) │
│  company_admin  │
│  role           │
│  ...            │
└────────┬────────┘
         │
         │ 1
         │
         │
         │ *
         ▼
┌─────────────────┐     ┌─────────────────┐
│  auth_tokens    │     │company_invites  │
│                 │     │                 │
│  token (PK)     │     │  id (PK)        │
│  user_id (FK)   │     │  company_id(FK) │
│  expires_at     │     │  invited_by(FK) │
│  ...            │     │  email          │
└─────────────────┘     │  token          │
                        │  status         │
                        │  ...            │
                        └─────────────────┘

┌─────────────────┐     ┌─────────────────┐
│ password_resets │     │ sso_sessions    │
│                 │     │                 │
│  id (PK)        │     │  id (PK)        │
│  user_id (FK)   │     │  user_id (FK)   │
│  token          │     │  master_token   │
│  expires_at     │     │  domain_sessions│
│  used_at        │     │  expires_at     │
│  ...            │     │  ...            │
└─────────────────┘     └─────────────────┘
```

### 5.6 Database Security

**1. Connection Security:**
- TLS 1.3 encryption for all connections
- Certificate validation
- Connection pooling with max connections limit

**2. Access Control:**
- Principle of least privilege
- Dedicated service account for application
- Read-only accounts for reporting
- Admin access via Azure AD authentication only

**3. Data Protection:**
- Passwords: bcrypt hashed (never plaintext)
- Sensitive fields: Application-level encryption
- PII: Identified and protected
- Audit logs: Immutable, append-only

**4. Backup & Recovery:**
- Automated daily backups (Azure SQL)
- Point-in-time restore (35 days)
- Geo-redundant storage
- Regular restore testing

---

## 6. API Architecture

### 6.1 API Design Principles

- **REST** API design
- **JSON** request/response format
- **Standard HTTP** methods and status codes
- **Versioning** via URL prefix (future: `/api/v2/`)
- **Consistent** response format
- **Paginated** list responses
- **Rate limited** to prevent abuse

### 6.2 API Response Format Standards

**Success Response (Single Resource):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Example"
  }
}
```

**Success Response (List - Paginated):**
```json
{
  "success": true,
  "items": [...],
  "page": 1,
  "pageSize": 20,
  "total": 100,
  "totalPages": 5
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Human-readable error message",
  "code": "ERROR_CODE",
  "details": {} // Optional additional context
}
```

### 6.3 API Endpoints Summary

#### Authentication Endpoints (`/api/auth`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/auth/register` | Public | Register new company + owner user |
| POST | `/auth/login` | Public | Login with email + password |
| POST | `/auth/logout` | Required | Logout and invalidate token |
| GET  | `/auth/me` | Required | Get current user profile |
| POST | `/auth/password/forgot` | Public | Request password reset |
| POST | `/auth/password/reset` | Public | Reset password with token |

#### User Management Endpoints (`/api/users`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/users` | Admin | List all users (paginated) |
| GET | `/users/:id` | Admin | Get single user |
| POST | `/users` | Admin | Create user (returns temp password) |
| PUT | `/users/:id` | Admin | Update user |
| DELETE | `/users/:id` | Admin | Delete user |
| POST | `/users/:id/assign-company` | Admin or Company Admin | Assign user to company |
| POST | `/users/:id/set-company-admin` | Admin or Company Admin | Set company admin flag |

#### Company Management Endpoints (`/api/company`, `/api/companies`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/company/profile` | Required | Get current user's company profile |
| PUT | `/company/profile` | Company Admin | Update current company profile |
| GET | `/company/users` | Required | List users in current company |
| POST | `/company/users/invite` | Company Admin | Invite user via email |
| POST | `/company/users/:id/resend-invite` | Company Admin | Resend invitation |
| DELETE | `/company/users/:id` | Company Admin | Remove user from company |
| GET | `/companies` | Admin | List all companies (paginated) |
| GET | `/companies/:id` | Admin or Same Company Admin | Get company by ID |
| PUT | `/companies/:id` | Admin or Same Company Admin | Update company |
| DELETE | `/companies/:id` | Admin | Delete company |
| GET | `/companies/:id/users` | Admin or Same Company Admin | List company users |

#### Application Endpoints (`/api/applications`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/applications` | Required | List applications (filtered by tier) |
| GET | `/applications/:id` | Required | Get application details |
| GET | `/applications/:id/launch` | Required | SSO handoff to application |
| GET | `/applications/public` | Public | Public application catalog |
| POST | `/applications` | Admin | Create application |
| PUT | `/applications/:id` | Admin | Update application |
| DELETE | `/applications/:id` | Admin | Delete application |

#### Template Endpoints (`/api/templates`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/templates` | Required | List templates (filtered by tier) |
| GET | `/templates/:id` | Required | Get template details |
| GET | `/templates/download/:id` | Required | Download template (enforces tier) |
| GET | `/templates/public` | Public | Public template catalog |
| POST | `/templates` | Admin | Create template |
| PUT | `/templates/:id` | Admin | Update template |
| DELETE | `/templates/:id` | Admin | Delete template |

#### File Management Endpoints (`/api/files`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/files/upload` | Required | Upload file (database storage) |
| GET | `/files/download` | Required | Download file by ID |
| POST | `/files/sas` | Required | Get Azure Blob SAS URL for upload |
| POST | `/files/confirm` | Required | Confirm upload and persist metadata |

### 6.4 Rate Limiting

**Per-IP Limits:**
- `/auth/register`: 5 requests/hour
- `/auth/login`: 10 requests/hour
- `/auth/password/forgot`: 3 requests/hour
- All other endpoints: 1000 requests/hour

**Per-User Limits:**
- Authenticated endpoints: 5000 requests/hour

**Headers:**
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1672531200
```

### 6.5 API Versioning Strategy

**Current:** No version prefix (`/api/`)
**Future:** Version prefix (`/api/v2/`) when breaking changes required
**Deprecation:** 6-month notice period for deprecated endpoints

---

## 7. Security Architecture

### 7.1 Security Layers

```
┌──────────────────────────────────────────┐
│       Layer 1: Network Security          │
│  - Azure Front Door (WAF)                │
│  - DDoS protection                       │
│  - TLS 1.3 encryption                    │
└────────────┬─────────────────────────────┘
             │
┌────────────▼─────────────────────────────┐
│    Layer 2: Application Security         │
│  - Authentication (JWT)                  │
│  - Authorization (RBAC + company scope)  │
│  - Rate limiting                         │
│  - Input validation                      │
└────────────┬─────────────────────────────┘
             │
┌────────────▼─────────────────────────────┐
│       Layer 3: Data Security             │
│  - Encryption at rest (Azure SQL TDE)    │
│  - Encryption in transit (TLS)           │
│  - Database access control               │
│  - Audit logging                         │
└──────────────────────────────────────────┘
```

### 7.2 Threat Model

**Threat Categories:**

1. **Authentication Threats**
   - Credential stuffing
   - Brute force attacks
   - Session hijacking
   - Token theft

2. **Authorization Threats**
   - Privilege escalation
   - Cross-company data access
   - IDOR (Insecure Direct Object Reference)

3. **Data Threats**
   - SQL injection
   - XSS (Cross-Site Scripting)
   - Data exfiltration
   - CSRF (Cross-Site Request Forgery)

4. **Infrastructure Threats**
   - DDoS attacks
   - Man-in-the-middle
   - Server compromise

### 7.3 Security Controls

**1. Authentication Controls:**
- bcrypt password hashing (cost 12)
- JWT with short expiry (1 hour)
- Database-backed token validation
- Rate limiting on auth endpoints
- Account lockout (5 failed attempts)
- Password reset via email token

**2. Authorization Controls:**
- Role-based access control (admin, user)
- Company-scoped data filtering
- Middleware enforcement
- Double-check in controllers
- Audit logging of authorization failures

**3. Input Validation:**
- Schema validation (Joi/Zod)
- SQL parameterization (prevents injection)
- XSS prevention (React escaping)
- CSRF tokens (for state-changing operations)
- File upload validation (type, size, content)

**4. Output Encoding:**
- JSON serialization
- HTML escaping (React automatic)
- SQL result sanitization

**5. Network Security:**
- HTTPS only (TLS 1.3)
- HSTS headers
- Security headers (CSP, X-Frame-Options)
- CORS whitelisting

**6. Monitoring & Logging:**
- All auth events logged
- Failed access attempts logged
- Cross-company access attempts flagged
- Real-time alerting (critical events)

### 7.4 Compliance

**Data Protection:**
- GDPR compliance (data export, deletion)
- Data residency (Azure region selection)
- Privacy policy enforcement
- Cookie consent

**Security Standards:**
- OWASP Top 10 mitigation
- PCI DSS (if handling payments directly)
- Regular security audits
- Penetration testing (annual)

---

## 8. SSO Architecture

### 8.1 SSO Overview

Business Manager acts as the **central authentication hub** for multiple business applications. Users authenticate once on Business Manager, then seamlessly access other applications without re-authenticating.

**SSO Flow (query-parameter bootstrap):**

1. User signs in to Biz Manager and receives a platform JWT.
2. Biz Manager requests/refreshes an SSO session via `POST /api/sso/authenticate` (response contains `sessionId`).
3. Immediately before opening an app, Biz Manager requests a domain-scoped token via `POST /api/sso/validate/:domain` and opens `https://{app-domain}/sso?token={domainToken}`.
4. The application backend calls `POST /api/sso/token/validate` with `{ token, domain }`, trusts the response, and sets `SESSION_CONTEXT('tenant_id', companyId)` for all SQL activity.
5. Row-Level Security policies enforce tenant isolation inside the shared Azure SQL database.

> Domain tokens are short-lived (1 hour), domain-bound, and always validated server-to-server—clients never trust them directly.

### 8.2 SSO Database Schema

**`sso_sessions` Table:**
```sql
CREATE TABLE sso_sessions (
  id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
  user_id UNIQUEIDENTIFIER NOT NULL,
  master_token_signature NVARCHAR(MAX),
  platform_session_id UNIQUEIDENTIFIER,
  domain_sessions NVARCHAR(MAX) DEFAULT '{}',  -- JSON
  created_at DATETIMEOFFSET DEFAULT GETUTCDATE(),
  expires_at DATETIMEOFFSET,
  last_activity DATETIMEOFFSET DEFAULT GETUTCDATE(),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

**`sso_applications` Table:**
```sql
CREATE TABLE sso_applications (
  id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
  name NVARCHAR(255) UNIQUE NOT NULL,
  domain NVARCHAR(255) UNIQUE NOT NULL,
  public_key NVARCHAR(MAX),
  status NVARCHAR(20) DEFAULT 'ACTIVE',
  sso_enabled BIT DEFAULT 0,
  sso_endpoint NVARCHAR(MAX),
  created_at DATETIMEOFFSET DEFAULT GETUTCDATE(),
  updated_at DATETIMEOFFSET DEFAULT GETUTCDATE()
);
```

**`sso_audit` Table:**
```sql
CREATE TABLE sso_audit (
  id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
  event_type NVARCHAR(50) NOT NULL,
  user_id UNIQUEIDENTIFIER,
  application_id UNIQUEIDENTIFIER,
  source_domain NVARCHAR(MAX),
  target_domain NVARCHAR(MAX),
  success BIT DEFAULT 1,
  error_message NVARCHAR(MAX),
  event_data NVARCHAR(MAX) DEFAULT '{}',
  created_at DATETIMEOFFSET DEFAULT GETUTCDATE()
);
```

### 8.3 SSO Token Types

**1. Master Token (Platform-Level):**
```json
{
  "userId": "uuid",
  "email": "user@company.com",
  "role": "user",
  "companyId": "uuid",
  "contextType": "platform",
  "iat": 1672531200,
  "exp": 1672534800
}
```

**2. Domain Token (Application-Specific):**
```json
{
  "userId": "uuid",
  "email": "user@company.com",
  "companyId": "uuid",
  "contextType": "domain",
  "domain": "inventory.business-suite.com",
  "iat": 1672531200,
  "exp": 1672534800
}
```

### 8.4 SSO Launch Flow

```
┌─────────┐      ┌────────────────────┐      ┌────────────────────┐      ┌──────────────┐
│ Browser │      │ Biz Manager API    │      │ Application API    │      │ Azure SQL DB │
└───┬─────┘      └─────────┬──────────┘      └─────────┬──────────┘      └──────┬───────┘
    │ (1) POST /api/sso/authenticate (JWT)              │                         │
    │───────────────────────────────>│                  │                         │
    │<──────── sessionId ───────────│                  │                         │
    │ (2) POST /api/sso/validate/:domain (sessionId)    │                         │
    │───────────────────────────────>│                  │                         │
    │<──────── domain token ────────│                  │                         │
    │ (3) GET https://app/sso?token=…                  │                         │
    │──────────────────────────────────────────────────>│                         │
    │                                                 │ (4) POST /api/sso/token/validate
    │                                                 │───────────────────────────────>│
    │                                                 │<──────── user + companyId ───│
    │                                                 │ (5) EXEC sp_set_session_context
    │                                                 │────────────────────────────────>│
    │                                                 │<──────── tenant-scoped data ─│
```

Biz Manager caches the `sessionId` in local storage (`bizmanager.sso.session`) to avoid redundant `/authenticate` calls while honoring short-lived domain tokens.

### 8.5 SSO Security

**Token Security:**
- Domain tokens valid for 1 hour
- Domain-specific (cannot reuse across apps)
- Signed with platform secret
- Database validation required

**Session Security:**
- Session expiry tracked
- Last activity timestamp
- Automatic cleanup of expired sessions
- Revocation on logout
- Application backends must set `SESSION_CONTEXT('tenant_id', companyId)` prior to executing SQL so that RLS applies automatically

**Audit Trail:**
- All SSO events logged
- Failed validation attempts tracked
- Cross-domain transitions logged
- Performance metrics recorded

---

## 9. Application Marketplace Architecture

### 9.1 Marketplace Overview

The Application Marketplace is a catalog of business applications that users can browse and launch via SSO. Each application:
- Runs on its own subdomain (e.g., `inventory.businessmanager.com`)
- Requires specific subscription tiers
- Integrates with Business Manager via SSO
- Example: **ABC Costing Pro** lives in the `abc` schema, includes `tenant_id` on every table, and enforces access exclusively through the shared RLS predicate.

### 9.2 Application Lifecycle

```
Admin Creates Application
     ↓
Application Configuration
  - Name, description, category
  - Subdomain assignment
  - Icon and screenshots
  - Subscription tier requirements
     ↓
Deployment Checklist
  - SSL certificate provisioning
  - DNS subdomain configuration
  - Marketplace catalog listing
  - Application launcher setup
     ↓
Application Deployed
     ↓
Users Browse Marketplace
     ↓
User Clicks "Launch Application"
     ↓
SSO Handoff to Application
     ↓
User Authenticated in Application
```

### 9.3 Application Data Model

**Database Schema (`applications` table):**
```sql
CREATE TABLE applications (
  id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
  name NVARCHAR(255) NOT NULL,
  description NVARCHAR(MAX),
  category NVARCHAR(100) NOT NULL,
  type NVARCHAR(20) NOT NULL CHECK (type IN ('application', 'template')),

  -- Deployment
  subdomain NVARCHAR(255),
  app_url NVARCHAR(MAX),

  -- Presentation
  icon_url NVARCHAR(MAX),
  screenshots NVARCHAR(MAX), -- JSON array

  -- Access Control
  subscription_tiers NVARCHAR(MAX) NOT NULL,  -- JSON: ["trial", "diy", "diy_accountant"]

  -- Metadata
  developer NVARCHAR(255),
  version NVARCHAR(50),
  status NVARCHAR(50) DEFAULT 'active', -- active, deployed, inactive
  is_active BIT DEFAULT 1,
  deployed_at DATETIMEOFFSET,

  -- Audit
  created_at DATETIMEOFFSET DEFAULT GETUTCDATE(),
  updated_at DATETIMEOFFSET DEFAULT GETUTCDATE()
);

CREATE INDEX IX_applications_category ON applications(category);
CREATE INDEX IX_applications_subscription_tiers ON applications(subscription_tiers);
CREATE INDEX IX_applications_status ON applications(status, is_active);
```

### 9.4 Application Launch Flow

```
┌─────────┐              ┌──────────────┐           ┌─────────────┐
│ User    │              │  Business    │           │ Application │
│ Browser │              │  Manager     │           │  (External) │
└────┬────┘              └──────┬───────┘           └──────┬──────┘
     │                          │                          │
     │ Browse /applications     │                          │
     ├─────────────────────────>│                          │
     │                          │                          │
     │ List of applications     │                          │
     │ (filtered by tier)       │                          │
     │<─────────────────────────┤                          │
     │                          │                          │
     │ Click "Launch App"       │                          │
     ├─────────────────────────>│                          │
     │                          │                          │
     │                          │ 1. Check user tier       │
     │                          │ 2. Verify access         │
     │                          │ 3. Generate SSO token    │
     │                          │ 4. Create session        │
     │                          │ 5. Log launch event      │
     │                          │                          │
     │ Redirect: app_url?token  │                          │
     │<─────────────────────────┤                          │
     │                          │                          │
     │ GET app_url?token=...                               │
     ├─────────────────────────────────────────────────────>│
     │                          │                          │
     │                          │                          │ 1. Extract token
     │                          │                          │ 2. Validate with
     │                          │     <─────────────────── │    Business Manager
     │                          │     ──────────────────>  │ 3. Create session
     │                          │                          │ 4. Log user in
     │                          │                          │
     │ Application Dashboard                               │
     │<─────────────────────────────────────────────────────┤
     │                          │                          │
```

### 9.5 Subscription Tier Enforcement

**Tier Validation Logic:**
```typescript
async function canLaunchApplication(user: User, app: Application): Promise<boolean> {
  // Platform admins can launch anything
  if (user.role === 'admin') {
    return true;
  }

  // Parse subscription tiers from JSON
  const requiredTiers = JSON.parse(app.subscription_tiers);

  // Check if user's tier is in the allowed list
  return requiredTiers.includes(user.subscriptionTier);
}
```

**Tier Hierarchy:**
- `trial` → Limited access (trial period only)
- `diy` → Access to DIY-tier applications
- `diy_accountant` → Access to all applications

### 9.6 Application Categories

**Standard Categories:**
- Inventory Management
- Accounting & Finance
- HR & Payroll
- Project Management
- CRM & Sales
- Reports & Analytics
- Tools & Utilities

**Category Filtering:**
- Users can filter marketplace by category
- Each application belongs to exactly one category
- Dynamic category list (fetched from database)

### 9.7 Application Deployment Checklist

**Deployment Requirements:**

1. **SSL Certificate** (Automated):
   - Provision SSL certificate for subdomain
   - Store in Azure Key Vault
   - Configure Azure App Service binding

2. **Subdomain Configuration** (Automated):
   - Create DNS CNAME record
   - Point to Azure App Service
   - Verify DNS propagation

3. **Marketplace Catalog** (Manual Approval):
   - Application reviewed by platform admin
   - Metadata completeness verified
   - Added to public catalog

4. **Application Launcher** (Configuration):
   - SSO endpoint configured
   - Launch URL tested
   - Error handling verified

5. **Metadata Completeness** (Content):
   - Description written
   - Icon uploaded (recommended: 512x512px)
   - Screenshots added (min 3, max 6)

---

## 10. Template Library Architecture

### 10.1 Template System Overview

The Template Library provides downloadable business documents (invoices, reports, contracts) that are **personalized with company branding** before download.

**Key Feature:** Templates are NOT static files - they are dynamically personalized with:
- Company logo
- Company colors (primary/secondary)
- Company contact information
- Company name and details

### 10.2 Template Personalization Architecture

#### 10.2.1 Template Structure

**Template File Formats:**
- `.docx` - Microsoft Word (Office Open XML)
- `.xlsx` - Microsoft Excel
- `.pdf` - PDF (via template rendering)

**Template Placeholders:**
```
Document templates contain placeholders that are replaced:

{{company.name}} → Acme Corporation
{{company.logo}} → <embedded logo image>
{{company.primaryColor}} → #173c5f
{{company.email}} → contact@acme.com
{{company.phone}} → +27 11 123 4567
{{company.address}} → 123 Main St, Johannesburg
```

#### 10.2.2 Personalization Flow

```
┌─────────┐              ┌──────────────┐         ┌──────────────┐
│ User    │              │  Business    │         │ Template     │
│ Browser │              │  Manager     │         │ Engine       │
└────┬────┘              └──────┬───────┘         └──────┬───────┘
     │                          │                        │
     │ Click "Download Template"│                        │
     ├─────────────────────────>│                        │
     │                          │                        │
     │                          │ 1. Validate user tier  │
     │                          │ 2. Load company data   │
     │                          │ 3. Load template file  │
     │                          │                        │
     │                          │ Request personalization│
     │                          ├───────────────────────>│
     │                          │                        │
     │                          │                        │ 1. Parse template
     │                          │                        │ 2. Replace placeholders
     │                          │                        │ 3. Embed company logo
     │                          │                        │ 4. Apply color scheme
     │                          │                        │ 5. Generate PDF/DOCX
     │                          │                        │
     │                          │ Personalized file      │
     │                          │<───────────────────────┤
     │                          │                        │
     │ Download personalized file│                       │
     │<─────────────────────────┤                        │
     │                          │                        │
```

#### 10.2.3 Template Personalization Service

**Service Architecture:**
```typescript
class TemplatePersonalizationService {
  async personalizeTemplate(
    templateId: string,
    companyId: string
  ): Promise<Buffer> {
    // 1. Load template file
    const template = await this.loadTemplate(templateId);

    // 2. Load company branding
    const company = await this.loadCompany(companyId);

    // 3. Determine template type
    switch (template.fileType) {
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        return await this.personalizeDocx(template, company);
      case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
        return await this.personalizeXlsx(template, company);
      case 'application/pdf':
        return await this.personalizePdf(template, company);
      default:
        throw new Error('Unsupported template format');
    }
  }

  private async personalizeDocx(template: Template, company: Company): Promise<Buffer> {
    // Use docx library to replace placeholders
    const doc = await this.parseDocx(template.fileData);

    // Replace text placeholders
    doc.replaceText('{{company.name}}', company.name);
    doc.replaceText('{{company.email}}', company.email);
    doc.replaceText('{{company.phone}}', company.phone);
    doc.replaceText('{{company.address}}', company.address);

    // Embed logo
    if (company.logoUrl) {
      const logoBuffer = await this.downloadLogo(company.logoUrl);
      doc.replaceImage('{{company.logo}}', logoBuffer);
    }

    // Apply color scheme
    doc.applyColorTheme({
      primary: company.primaryColor,
      secondary: company.secondaryColor
    });

    return doc.toBuffer();
  }
}
```

**Required Libraries:**
- `docxtemplater` - DOCX template processing
- `xlsx` - Excel file manipulation
- `pdfkit` or `pdf-lib` - PDF generation
- `sharp` - Image processing (logo resizing)

### 10.3 Template Data Model

**Database Schema (`templates` table):**
```sql
CREATE TABLE templates (
  id NVARCHAR(64) PRIMARY KEY, -- Custom ID (e.g., "invoice-basic-01")
  name NVARCHAR(255) NOT NULL,
  description NVARCHAR(MAX),
  category NVARCHAR(100) NOT NULL,

  -- File Storage
  download_url NVARCHAR(MAX), -- Azure Blob URL or file ID
  file_name NVARCHAR(255),
  file_size NVARCHAR(50),
  file_type NVARCHAR(100), -- MIME type

  -- Personalization
  supports_personalization BIT DEFAULT 1,
  placeholder_fields NVARCHAR(MAX), -- JSON array of available placeholders

  -- Access Control
  subscription_tiers NVARCHAR(MAX) NOT NULL, -- JSON: ["trial", "diy"]

  -- Metadata
  template_type NVARCHAR(50), -- invoice, report, contract, proposal
  tags NVARCHAR(MAX), -- JSON array
  preview_url NVARCHAR(MAX),

  -- Status
  is_active BIT DEFAULT 1,

  -- Audit
  created_at DATETIMEOFFSET DEFAULT GETUTCDATE(),
  updated_at DATETIMEOFFSET DEFAULT GETUTCDATE()
);

CREATE INDEX IX_templates_category ON templates(category);
CREATE INDEX IX_templates_type ON templates(template_type);
CREATE INDEX IX_templates_subscription_tiers ON templates(subscription_tiers);
```

### 10.4 Template Categories & Types

**Categories:**
- Financial (Invoices, Quotes, Statements)
- Contracts (Employment, Service Agreements)
- Reports (Monthly, Quarterly, Annual)
- HR Documents (Offer Letters, Policies)
- Marketing (Proposals, Presentations)

**Template Types:**
- `invoice` - Sales invoices
- `quote` - Price quotations
- `contract` - Legal contracts
- `report` - Business reports
- `letter` - Business correspondence
- `form` - Data collection forms

### 10.5 Template Download API

**Endpoint:** `GET /api/templates/download/:id`

**Request Flow:**
1. Authenticate user
2. Load template from database
3. Check subscription tier access
4. Load user's company data
5. Personalize template with company branding
6. Stream personalized file to user
7. Log download event
8. Track usage analytics

**Response:**
- Content-Type: Based on template file type
- Content-Disposition: `attachment; filename="personalized-invoice.docx"`
- Streaming response with personalized file

---

## 11. Payment & Subscription Architecture

### 11.1 Subscription Model

**Subscription Tiers:**

| Tier | Name | Price (ZAR/month) | Max Users | Features |
|------|------|-------------------|-----------|----------|
| `trial` | Free Trial | R0 | 1 | 7-day trial, limited apps |
| `diy` | DIY | R299 | 5 | Core business apps |
| `diy_accountant` | DIY + Accountant | R499 | 10 | All apps + accountant tools |

**Tier Configuration Table:**
```sql
CREATE TABLE subscription_tiers (
  id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
  slug NVARCHAR(50) UNIQUE NOT NULL, -- 'trial', 'diy', 'diy_accountant'
  name NVARCHAR(100) NOT NULL,
  description NVARCHAR(MAX),

  -- Pricing
  price_monthly DECIMAL(10,2) NOT NULL,
  price_annual DECIMAL(10,2),
  currency NVARCHAR(3) DEFAULT 'ZAR',

  -- Limits
  max_users INT NOT NULL,
  max_storage_gb INT,

  -- Features (JSON)
  features NVARCHAR(MAX), -- ["feature1", "feature2"]
  applications_included NVARCHAR(MAX), -- ["app-id-1", "app-id-2"]
  templates_included NVARCHAR(MAX), -- ["template-id-1"]

  -- Display
  is_popular BIT DEFAULT 0,
  display_order INT DEFAULT 0,
  is_active BIT DEFAULT 1,

  -- Audit
  created_at DATETIMEOFFSET DEFAULT GETUTCDATE(),
  updated_at DATETIMEOFFSET DEFAULT GETUTCDATE()
);
```

### 11.2 Payment Flow (PayFast Integration)

#### 11.2.1 Subscription Checkout Flow

```
┌─────────┐         ┌──────────────┐         ┌──────────────┐
│ User    │         │  Business    │         │   PayFast    │
│ Browser │         │  Manager     │         │   Gateway    │
└────┬────┘         └──────┬───────┘         └──────┬───────┘
     │                     │                        │
     │ Select Tier         │                        │
     ├────────────────────>│                        │
     │                     │                        │
     │                     │ 1. Load PayFast config │
     │                     │ 2. Generate signature  │
     │                     │ 3. Create payment form │
     │                     │                        │
     │ PayFast Form Fields │                        │
     │<────────────────────┤                        │
     │                     │                        │
     │ Submit to PayFast                            │
     ├──────────────────────────────────────────────>│
     │                     │                        │
     │                     │                        │ 1. Display form
     │                     │                        │ 2. Collect payment
     │                     │                        │ 3. Process card
     │                     │                        │
     │                     │   ITN Notification     │
     │                     │<───────────────────────┤
     │                     │                        │
     │                     │ 1. Verify signature    │
     │                     │ 2. Validate IP         │
     │                     │ 3. Post-back to PayFast│
     │                     │ 4. Update subscription │
     │                     │ 5. Send confirmation   │
     │                     │                        │
     │ Redirect to Success │                        │
     │<────────────────────┤                        │
     │                     │                        │
```

#### 11.2.2 PayFast ITN (Instant Transaction Notification)

**Security Requirements:**
1. **Signature Verification:**
   ```typescript
   function verifyPayFastSignature(data: any, passPhrase: string): boolean {
     const params = Object.keys(data)
       .filter(key => key !== 'signature')
       .sort()
       .map(key => `${key}=${encodeURIComponent(data[key])}`)
       .join('&');

     const toSign = `${params}&passphrase=${passPhrase}`;
     const expectedSignature = md5(toSign);

     return expectedSignature === data.signature;
   }
   ```

2. **IP Whitelist:**
   ```typescript
   const PAYFAST_IPS = [
     '197.97.145.144',
     '197.97.145.145',
     '197.97.145.146',
     '197.97.145.147'
   ];

   function isPayFastRequest(req: Request): boolean {
     const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
     return PAYFAST_IPS.includes(ip);
   }
   ```

3. **Post-back Validation:**
   ```typescript
   async function validateWithPayFast(data: any): Promise<boolean> {
     const response = await fetch('https://www.payfast.co.za/eng/query/validate', {
       method: 'POST',
       headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
       body: new URLSearchParams(data).toString()
     });

     const result = await response.text();
     return result === 'VALID';
   }
   ```

### 11.3 Subscription Lifecycle Management

#### 11.3.1 Account Lifecycle States

```
New Signup (Trial)
     ↓
Trial Active (7 days)
     ↓
Trial Expiring (2 days warning)
     ↓
     ├─> Payment Received → Paid Subscription Active
     │
     └─> No Payment → Trial Expired
              ↓
         Grace Period (7 days)
              ↓
              ├─> Payment Received → Reactivate
              │
              └─> No Payment → Account Deactivated
                       ↓
                  Retention Period (30 days)
                       ↓
                       ├─> Payment Received → Reactivate
                       │
                       └─> No Payment → Account Deleted (Permanent)
```

#### 11.3.2 Automated Lifecycle Jobs

**Daily Cron Jobs:**

1. **Expiry Warning Notifications:**
   ```sql
   -- Find subscriptions expiring in 2 days
   SELECT * FROM users
   WHERE subscription_expiry BETWEEN GETDATE() AND DATEADD(day, 2, GETDATE())
   AND is_active = 1;
   ```

2. **Grace Period Start:**
   ```sql
   -- Deactivate expired accounts (start grace period)
   UPDATE users
   SET is_active = 0, deactivated_at = GETDATE()
   WHERE subscription_expiry < GETDATE()
   AND is_active = 1;
   ```

3. **Account Deletion:**
   ```sql
   -- Delete accounts after retention period
   DELETE FROM users
   WHERE deactivated_at < DATEADD(day, -30, GETDATE());
   ```

### 11.4 Payment History & Invoicing

**Payments Table:**
```sql
CREATE TABLE payments (
  id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
  user_id UNIQUEIDENTIFIER NOT NULL,
  company_id UNIQUEIDENTIFIER NOT NULL,

  -- Payment Details
  payment_id NVARCHAR(255) NOT NULL, -- PayFast m_payment_id
  amount DECIMAL(10,2) NOT NULL,
  currency NVARCHAR(3) DEFAULT 'ZAR',
  payment_status NVARCHAR(50), -- COMPLETE, FAILED, PENDING

  -- Subscription
  subscription_tier NVARCHAR(50),
  billing_period NVARCHAR(20), -- monthly, annual
  period_start DATETIMEOFFSET,
  period_end DATETIMEOFFSET,

  -- Gateway
  gateway NVARCHAR(50) DEFAULT 'payfast',
  gateway_transaction_id NVARCHAR(255),
  gateway_response NVARCHAR(MAX), -- JSON

  -- Invoice
  invoice_number NVARCHAR(50) UNIQUE,
  invoice_url NVARCHAR(MAX),

  -- Audit
  created_at DATETIMEOFFSET DEFAULT GETUTCDATE(),
  updated_at DATETIMEOFFSET DEFAULT GETUTCDATE(),

  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (company_id) REFERENCES companies(id)
);

CREATE INDEX IX_payments_user ON payments(user_id);
CREATE INDEX IX_payments_company ON payments(company_id);
CREATE INDEX IX_payments_status ON payments(payment_status);
CREATE INDEX IX_payments_created ON payments(created_at DESC);
```

---

## 12. File Storage Architecture

### 12.1 Dual Storage Strategy

**Storage Modes:**

1. **Database Storage** (Development):
   - Files stored as `VARBINARY(MAX)` in SQL Server
   - Simple setup, no external dependencies
   - Suitable for local development
   - Max file size: 10MB

2. **Azure Blob Storage** (Production):
   - Files stored in Azure Blob containers
   - Scalable, cost-effective
   - CDN integration available
   - Max file size: 50MB+

**Configuration:**
```typescript
// Determined by environment variable
const STORAGE_TYPE = process.env.STORAGE_TYPE || 'database';

if (STORAGE_TYPE === 'azure_blob') {
  storageService = new AzureBlobStorageService();
} else {
  storageService = new DatabaseStorageService();
}
```

### 12.2 File Upload Flow

#### 12.2.1 Database Storage Upload

```
┌─────────┐              ┌──────────────┐         ┌──────────────┐
│ User    │              │  Business    │         │  SQL Server  │
│ Browser │              │  Manager     │         │              │
└────┬────┘              └──────┬───────┘         └──────┬───────┘
     │                          │                        │
     │ POST /api/files/upload   │                        │
     │ (multipart/form-data)    │                        │
     ├─────────────────────────>│                        │
     │                          │                        │
     │                          │ 1. Validate file type  │
     │                          │ 2. Check size limit    │
     │                          │ 3. Generate file ID    │
     │                          │                        │
     │                          │ INSERT INTO file_uploads│
     │                          │ (file_data as VARBINARY)│
     │                          ├───────────────────────>│
     │                          │                        │
     │                          │ Success                │
     │                          │<───────────────────────┤
     │                          │                        │
     │ { fileId, url }          │                        │
     │<─────────────────────────┤                        │
     │                          │                        │
```

#### 12.2.2 Azure Blob Storage Upload (Direct SAS)

```
┌─────────┐      ┌──────────────┐      ┌──────────────┐
│ User    │      │  Business    │      │  Azure Blob  │
│ Browser │      │  Manager     │      │  Storage     │
└────┬────┘      └──────┬───────┘      └──────┬───────┘
     │                  │                     │
     │ Request SAS URL  │                     │
     ├─────────────────>│                     │
     │                  │                     │
     │                  │ Generate SAS token  │
     │                  │────────────────────>│
     │                  │                     │
     │                  │ SAS URL (1h expiry) │
     │                  │<────────────────────┤
     │                  │                     │
     │ { uploadUrl }    │                     │
     │<─────────────────┤                     │
     │                  │                     │
     │ PUT uploadUrl                          │
     │ (direct upload)                        │
     ├────────────────────────────────────────>│
     │                  │                     │
     │                  │                     │ Upload complete
     │<────────────────────────────────────────┤
     │                  │                     │
     │ POST /api/files/confirm                │
     ├─────────────────>│                     │
     │                  │                     │
     │                  │ Store metadata in DB│
     │                  │ (blob_url, size)    │
     │                  │                     │
     │ { fileId }       │                     │
     │<─────────────────┤                     │
     │                  │                     │
```

### 12.3 File Storage Tables

```sql
CREATE TABLE file_uploads (
  id NVARCHAR(255) PRIMARY KEY, -- "file_xxx-uuid"
  filename NVARCHAR(500) NOT NULL,
  file_type NVARCHAR(100) NOT NULL,
  file_size BIGINT NOT NULL,

  -- Storage Strategy
  file_data VARBINARY(MAX) NULL, -- Database storage
  blob_url NVARCHAR(MAX) NULL, -- Azure Blob storage

  -- Metadata
  uploaded_by UNIQUEIDENTIFIER NOT NULL,
  company_id UNIQUEIDENTIFIER, -- Company-scoped files

  -- Categorization
  category NVARCHAR(100), -- logo, template, document
  tags NVARCHAR(MAX), -- JSON array

  -- Status
  is_active BIT DEFAULT 1,

  -- Audit
  uploaded_at DATETIMEOFFSET DEFAULT GETUTCDATE(),
  last_accessed DATETIMEOFFSET,
  access_count INT DEFAULT 0,

  FOREIGN KEY (uploaded_by) REFERENCES users(id),
  FOREIGN KEY (company_id) REFERENCES companies(id)
);

CREATE INDEX IX_files_uploaded_by ON file_uploads(uploaded_by);
CREATE INDEX IX_files_company ON file_uploads(company_id);
CREATE INDEX IX_files_category ON file_uploads(category);
CREATE INDEX IX_files_uploaded_at ON file_uploads(uploaded_at DESC);
```

### 12.4 File Type Validation

**Allowed File Types:**
- Documents: PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX
- Text: TXT, CSV
- Images: JPEG, PNG, GIF
- Archives: ZIP

**Validation:**
```typescript
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg',
  'image/png',
  'image/gif',
  'text/plain',
  'text/csv',
  'application/zip'
];

function validateFile(file: File): boolean {
  // Check MIME type
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return false;
  }

  // Check file extension
  const ext = path.extname(file.originalname).toLowerCase();
  const allowedExtensions = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.jpg', '.png', '.txt', '.csv', '.zip'];

  return allowedExtensions.includes(ext);
}
```

### 12.5 Company Logo Upload

**Special Case:** Company logos have specific requirements

```typescript
async function uploadCompanyLogo(logoFile: File, companyId: string): Promise<string> {
  // 1. Validate image type
  if (!['image/jpeg', 'image/png'].includes(logoFile.mimetype)) {
    throw new Error('Logo must be JPEG or PNG');
  }

  // 2. Resize to standard dimensions
  const resized = await sharp(logoFile.buffer)
    .resize(512, 512, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .toBuffer();

  // 3. Upload to storage
  const fileId = await storageService.uploadFile(resized, 'logo.png', 'image/png', companyId);

  // 4. Update company profile
  await db.query(
    'UPDATE companies SET logo_url = ? WHERE id = ?',
    [`/api/files/download?id=${fileId}`, companyId]
  );

  return fileId;
}
```

---

## 13. Frontend Architecture

### 9.1 Frontend Structure

```
frontend/
├── src/
│   ├── components/          # Reusable UI components
│   │   ├── admin/           # Admin panel components
│   │   ├── auth/            # Auth forms (login, register)
│   │   ├── billing/         # Payment/subscription UI
│   │   ├── company/         # Company profile management
│   │   └── layout/          # Layout components (nav, sidebar)
│   ├── contexts/            # React contexts
│   │   ├── AuthContext.tsx  # Authentication state
│   │   └── DataContext.tsx  # Global data cache
│   ├── hooks/               # Custom React hooks
│   ├── lib/                 # Utilities
│   │   ├── api.ts           # API client
│   │   └── utils.ts         # Helper functions
│   ├── pages/               # Route pages
│   │   ├── Dashboard.tsx
│   │   ├── Login.tsx
│   │   └── ...
│   ├── types/               # TypeScript types
│   └── App.tsx              # Root component
```

### 9.2 State Management

**AuthContext** - Authentication state
```typescript
interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isBootstrapping: boolean;
  login: (email, password) => Promise<Result>;
  register: (userData, password) => Promise<Result>;
  logout: () => void;
  refresh: () => Promise<void>;
}
```

**Local Storage:**
- `token` - JWT access token
- `user` - Cached user profile
- `postAuthIntent` - Redirect after login

### 9.3 API Client

**Base URL Resolution:**
1. `VITE_API_BASE` environment variable
2. Query parameter (`?apiBase=...`)
3. localStorage override
4. Default: `/api/`

**Authentication:**
```typescript
headers: {
  'Authorization': `Bearer ${localStorage.getItem('token')}`,
  'Content-Type': 'application/json'
}
```

### 9.4 Routing

**Public Routes:**
- `/` - Landing page
- `/login` - Login page
- `/register` - Registration page
- `/reset-password` - Password reset

**Protected Routes (require authentication):**
- `/dashboard` - User dashboard
- `/applications` - Application catalog
- `/templates` - Template library
- `/company` - Company profile
- `/admin` - Admin panel (admin role only)

---

## 10. Deployment Architecture

### 10.1 Azure Infrastructure

```
┌────────────────────────────────────────────────────┐
│                Azure Front Door                     │
│  - Global CDN                                      │
│  - WAF (Web Application Firewall)                 │
│  - SSL termination                                 │
└────────────┬───────────────────────────────────────┘
             │
┌────────────▼───────────────────────────────────────┐
│             Azure App Service                      │
│  - Node.js runtime                                 │
│  - Auto-scaling (2-10 instances)                   │
│  - Health checks                                   │
│  - Deployment slots (staging/production)           │
└────────────┬───────────────────────────────────────┘
             │
        ┌────┴────┬────────────────┬──────────────┐
        │         │                │              │
┌───────▼──┐  ┌───▼──────┐  ┌─────▼──────┐  ┌───▼────────┐
│ Azure    │  │  Azure   │  │ Azure Key  │  │  Azure App │
│ SQL DB   │  │  Blob    │  │ Vault      │  │  Insights  │
│ (Primary)│  │ Storage  │  │ (Secrets)  │  │ (Monitor)  │
└──────────┘  └──────────┘  └────────────┘  └────────────┘
```

### 10.2 Environment Configuration

**Local Development:**
- SQL Server Express
- Database file storage
- Mock payment gateway
- `NODE_ENV=development`

**Staging:**
- Azure SQL Database (smaller tier)
- Azure Blob Storage
- PayFast sandbox
- `NODE_ENV=staging`

**Production:**
- Azure SQL Database (production tier)
- Azure Blob Storage with CDN
- PayFast live
- `NODE_ENV=production`

### 10.3 CI/CD Pipeline

**GitHub Actions Workflow:**
1. **Build** - Compile TypeScript, run tests
2. **Test** - Unit tests, integration tests
3. **Security Scan** - npm audit, SAST
4. **Deploy to Staging** - Automatic on `develop` branch
5. **Integration Tests** - Run against staging
6. **Deploy to Production** - Manual approval on `main` branch
7. **Smoke Tests** - Verify production deployment

---

## 11. Data Flow Diagrams

### 11.1 User Registration Flow

(Comprehensive flow covered in Section 3.2.1)

### 11.2 Company Invitation Flow

```
Company Admin → Invite User
     ↓
API creates invitation record
     ↓
Email sent with invitation link
     ↓
User clicks link → Registration page pre-filled
     ↓
User completes registration
     ↓
API validates invitation token
     ↓
User created and assigned to company
     ↓
Invitation marked as accepted
```

### 11.3 Template Download Flow

```
User browses templates
     ↓
Clicks download
     ↓
API checks subscription tier
     ↓
If authorized → Generate download URL
     ↓
Personalize with company branding
     ↓
Stream file to user
```

---

## 12. Integration Points

### 12.1 External Service Integration

**PayFast (Payment Gateway):**
- Subscription checkout
- Payment verification
- Webhook notifications
- South African market focus

**SendGrid (Email Delivery):**
- User invitations
- Password reset emails
- Account notifications
- Transactional emails

**Azure Application Insights:**
- Application monitoring
- Performance metrics
- Error tracking
- Custom events

### 12.2 Integration Security

**API Keys:**
- Stored in Azure Key Vault
- Rotated every 90 days
- Never committed to code
- Accessed via environment variables

**Webhooks:**
- Signature verification (PayFast ITN)
- IP whitelist (when available)
- Retry logic with exponential backoff
- Idempotency handling

---

## 13. Scalability & Performance

### 13.1 Scalability Strategy

**Horizontal Scaling:**
- Azure App Service auto-scaling
- 2-10 instances based on CPU/memory
- Stateless application design
- Session data in database/Redis

**Database Scaling:**
- Azure SQL elastic pool
- Read replicas for reporting
- Connection pooling
- Query optimization

**File Storage Scaling:**
- Azure Blob Storage (99.99% SLA)
- CDN for static assets
- Blob lifecycle management

### 13.2 Performance Targets

**API Response Times:**
- p50: <100ms
- p95: <200ms
- p99: <500ms

**Page Load Times:**
- First Contentful Paint: <1.5s
- Time to Interactive: <3s
- Largest Contentful Paint: <2.5s

**Database Query Performance:**
- Simple queries: <10ms
- Complex queries: <100ms
- Indexed lookups: <5ms

### 13.3 Caching Strategy

**Application Cache (Redis):**
- Token validation results
- Rate limiting counters
- Session data
- TTL: 1 hour

**CDN Cache:**
- Static assets
- Public catalog data
- TTL: 24 hours

**Browser Cache:**
- JavaScript bundles: 1 year
- CSS files: 1 year
- Images: 30 days

---

## 14. Monitoring & Observability

### 14.1 Logging Strategy

**Application Logs:**
- Structured logging (JSON format)
- Log levels: ERROR, WARN, INFO, DEBUG
- Correlation IDs for request tracing
- Shipped to Azure Application Insights

**Audit Logs:**
- All authentication events
- User management operations
- Company profile changes
- Cross-company access attempts
- Stored in database (immutable)

### 14.2 Metrics

**Application Metrics:**
- Request rate
- Error rate
- Response time (p50, p95, p99)
- Active users
- Authentication success rate

**Business Metrics:**
- Daily active companies
- Application launches
- Template downloads
- Subscription conversions
- Churn rate

### 14.3 Alerting

**Critical Alerts (PagerDuty):**
- Application down
- Database connection failure
- Error rate >5%
- Response time p95 >1s

**Warning Alerts (Email):**
- Error rate >1%
- Response time p95 >500ms
- Failed login spike
- Low disk space

**Health Checks:**
- `/health` endpoint
- Database connectivity
- External service status
- Checked every 30 seconds

---

## Appendix

### A. Glossary

- **Tenant**: A company account with multiple users
- **Company Admin**: User who can manage company settings and users
- **Platform Admin**: Internal admin who manages all companies
- **Master Token**: Platform-wide authentication token
- **Domain Token**: Application-specific SSO token
- **Subscription Tier**: Access level (Trial, DIY, DIY+Accountant)

### B. Related Documents

- Current State Analysis: `/docs/analysis/current-state-analysis.md`
- Database Migrations: `/backend/migrations/`
- API Documentation: `/docs/api/`
- Deployment Guide: `/docs/deployment/`

### C. Change Log

| Date | Version | Changes | Author |
|------|---------|---------|--------|
| 2025-10-09 | 1.0 | Initial architecture document | System Architecture Team |

---

**End of Architecture Document**