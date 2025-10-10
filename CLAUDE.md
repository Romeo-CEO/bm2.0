# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Business Manager is a **multi-tenant B2B SaaS platform** that serves as a central authentication hub and application marketplace for business tools. It is NOT the applications themselves - it's the gateway that manages users, companies, subscriptions, and provides SSO to separately-hosted applications.

### What Business Manager Does

1. **Central Company Account Management**: Each account represents a **company** (not individuals). Companies can:
   - Add multiple users to their company workspace
   - Designate company admins (`company_admin` flag) to manage company settings
   - Customize their company profile with branding (logo, colors, contact details)

2. **Application Marketplace & Catalog**: Browse three types of resources:
   - **Applications**: Full applications hosted on separate subdomains (e.g., `inventory.yourdomain.com`)
   - **Templates**: Downloadable documents (invoices, reports, etc.) that get **personalized with company branding** before download
   - **Calculators**: Business calculation tools

3. **Single Sign-On (SSO) Hub**: When users click "Use" on an application:
   - They're redirected to the actual application on its subdomain
   - SSO automatically authenticates them without another login
   - Applications verify users via SSO tokens issued by Business Manager

4. **Subscription Tiers**: Companies subscribe to one of two paid tiers (DIY or DIY + Accountant) that control access to different applications and templates. New signups get a 7-day free trial.

### Technical Stack

**Database**: SQL Server only (local SQL Server for development/testing, Azure SQL Database for production)
**File Storage**: Database storage for development, Azure Blob Storage for production
**Authentication**: Custom JWT only (Azure AD B2C disabled by project decision)
**Deployment**: Designed for Azure (Azure SQL Database, Azure Blob Storage, Azure App Service)
**Frontend**: React 18 + Vite + TypeScript + Tailwind CSS + shadcn/ui components

### Brand Color Palette

The platform uses a custom blue/cyan color scheme:

- **Ghost White** `#edf0f9` - Light backgrounds, UI surfaces
- **Cool Gray** `#8789a0` - Muted text, borders
- **Process Cyan** `#32baec` - Accent color, interactive elements, CTAs
- **Indigo Dye** `#173c5f` - Primary brand color, sidebar backgrounds
- **Oxford Blue** `#0c0c24` - Dark backgrounds, headings

**Usage in code**:
- Tailwind utilities: `bg-ghost-white`, `text-process-cyan`, `bg-indigo-dye`
- Semantic tokens: `bg-primary` (Indigo Dye), `text-accent` (Process Cyan), `bg-sidebar` (Indigo Dye)
- CSS variables: `hsl(var(--process-cyan))` for custom styles

Color configuration in [frontend/src/index.css](frontend/src/index.css) and [frontend/tailwind.config.ts](frontend/tailwind.config.ts)

## Current Decisions

- Authentication: Custom JWT only (Azure AD B2C disabled)

## Implementation Plan: Align Codebase to Custom JWT Only

Scope: Documentation of agreed changes only. No code changes yet. This section lists exactly what will be changed and where.

### 1) Backend Authentication

- backend/src/controllers/authController.ts
  - Implement POST /api/auth/login: email+password with bcrypt, issue JWT (JWT_EXPIRES_IN), insert row into auth_tokens with expiry, return { token, user }.
  - Implement POST /api/auth/register: create user with hashed password, role='user', is_active=1. For company owner signup, create company and set company_admin=true (see Company flows below).
  - Add POST /api/auth/logout: delete current token from auth_tokens.
  - Add password reset endpoints: POST /api/auth/password/forgot, POST /api/auth/password/reset.
- backend/src/routes/auth.ts
  - Ensure routes expose login, register, logout, password flows.
  - Keep Azure callback alias but mount only when AUTH_TYPE=azure_ad_b2c.
- backend/src/index.ts
  - Conditionally mount Azure AD B2C routes only if AUTH_TYPE=azure_ad_b2c (default is custom).
- backend/src/utils/jwt.ts
  - Confirm/extend helpers: generateToken, verifyToken, (optional) generateRefreshToken; standardize durations from env.
- backend/src/middleware/auth.ts
  - Keep current behavior: verify JWT and require token to exist in auth_tokens; add room for rate limiting on login (via express-rate-limit) later.

### 2) Database & Migrations (SQL Server)

- New migration: 012_create_user_invites_mssql.sql
  - company_invitations(id, company_id, email, invited_by, token, expires_at, status, created_at).
- New migration: 013_create_password_resets_mssql.sql
  - password_resets(id, user_id, token, expires_at, created_at, used_at NULL).
- Optional seed update in 006_seed_users_mssql.sql
  - Seed a platform admin and one example company admin with hashed passwords.

### 3) Company-Scoped User Management

- backend/src/routes/company.ts (or new route file companyUsers.ts)
  - GET /api/company/users: list users in my company (company_admin or admin).
  - POST /api/company/users/invite: create invite and email link (dev: log invite URL, prod: email service).
  - POST /api/company/users/:id/resend-invite: reissue token.
  - DELETE /api/company/users/:id: remove user from company (enforce seat policy and self-protect owner).
- backend/src/controllers/usersController.ts
  - Centralize seat-limit enforcement by subscription_tier when adding users.
  - Reuse existing assignCompany and setCompanyAdmin endpoints; ensure same-company checks remain.

### 4) SSO (No Functional Change)

- backend/src/services/ssoCentralService.ts
  - Confirm master token validation uses JWT from platform; no dependency on Azure claims.
  - Keep domain token issuance unchanged.

### 5) Configuration & Secrets

- Default .env
  - AUTH_TYPE=custom (decision), DB_TYPE=mssql, STORAGE_TYPE=database for dev, PAYMENTS_ENABLE_MOCK=true.
  - Ensure JWT_SECRET set; in production retrieve from Azure Key Vault.
- Production
  - Keep Azure App Service + Azure SQL + Azure Blob. No Azure AD B2C required.

### 6) Frontend Alignment (later; no code now)

- frontend/src/contexts/AuthContext.tsx
  - Switch to POST /api/auth/login, /api/auth/register, /api/auth/me.
  - Store JWT in localStorage and send Authorization: Bearer header; handle 401 to logout.
- Pages
  - Build Login, Register, Forgot/Reset Password pages.
  - Company Admin UI for invites and user list.

### 7) Security & Compliance

- Password hashing: bcrypt with reasonable cost (e.g., 10–12).
- Login protection: rate limiting, generic error messages, lockout after repeated failures (configurable).
- JWT: short-lived access token (e.g., 15–60 min) + optional refresh token rotation.
- Auditing: continue audit logs for auth/SSO events (App Insights in prod).
- Email verification (optional, later): verification_tokens table like invites.

### 8) Testing Plan

- Unit tests: auth controller (login/register), middleware, invite acceptance.
- Integration tests: migration from empty DB, end-to-end login → SSO domain token issuance.
- Manual checklist: admin login, company admin invite, accept invite, SSO to app.

### 9) Deprecation/Toggle

- Azure AD B2C code remains in repo but disabled by config (AUTH_TYPE=custom).
- Conditionally mount /api/azure-ad-b2c routes only when explicitly enabled.

## Frontend–Backend Integration Audit: Findings and Decisions

Purpose: Identify integration mismatches and define the contract we will standardize on. These are decisions; implementation will follow in code changes later.

### A) API Base URL and Public Routes
- Decision: Base API is /api/ (no global /api/public prefix)
- Public catalogs remain resource-scoped: /api/applications/public and /api/templates/public
- Frontend default base: set VITE_API_BASE to http://localhost:3001/api/ in dev; fallback should default to /api/
- Remove legacy cPanel/premwebs and /api/public/ logic from frontend base builder

### B) Authentication Contract (Custom JWT)
- Endpoints
  - POST /api/auth/login -> { success, token, user }
  - POST /api/auth/register -> { success, token, user }
  - GET  /api/auth/me -> { success, user }
  - POST /api/auth/logout -> { success } (optional)
- Notes
  - Token also persisted in auth_tokens with expiry
  - Frontend stores token in localStorage and sends Authorization: Bearer

### C) Users API
- Standardize list responses to a single shape: { success, items, page, pageSize, total, totalPages }
- Provide missing endpoints to match frontend needs:
  - GET  /api/users/:id -> user details (admin only)
  - POST /api/users -> create user (admin only), returns { userId, tempPassword }
- Keep existing:
  - GET  /api/users (admin only)
  - PUT  /api/users/:id (admin only)
  - DELETE /api/users/:id (admin only)
  - POST /api/users/:id/assign-company
  - POST /api/users/:id/set-company-admin

### D) Companies API
- Standardize list response to { success, items, page, pageSize, total, totalPages }
- Endpoints used by frontend and available in backend:
  - GET  /api/companies (admin only)
  - GET  /api/companies/:id (admin or same-company company_admin)
  - PUT  /api/companies/:id (admin or same-company company_admin)
  - DELETE /api/companies/:id (admin only)
- Company users listing
  - Decision: Use /api/companies/:id/users for arbitrary company (admin or same-company company_admin)
  - Frontend should use /api/companies/:id/users (not /api/company/users/:id)
- Current-user company profile
  - GET  /api/company/profile
  - PUT  /api/company/profile

### E) Applications API
- Authenticated catalog
  - GET  /api/applications with filters -> return { success, items, page, pageSize, total, totalPages }
  - GET  /api/applications/:id
  - POST /api/applications (admin)
  - PUT  /api/applications/:id (admin)
  - DELETE /api/applications/:id (admin)
  - GET  /api/applications/:id/launch (SSO handoff)
- Public catalog
  - GET  /api/applications/public with q, category, type, sortBy, sortDir, pagination

### F) Templates API
- Decision: Remove platform prefix; unify under /api/templates
- Endpoints
  - GET  /api/templates (auth)
  - GET  /api/templates/:id (auth)
  - GET  /api/templates/public (no auth) with pagination and filters
  - GET  /api/templates/download/:id (auth; may 302 to downloadUrl; enforces subscription)
  - POST /api/templates (admin)
  - PUT  /api/templates/:id (admin)
  - DELETE /api/templates/:id (admin)

### G) Files API
- Decision: Support both development and production storage flows
  - Development database storage (current):
    - POST /api/files/upload (multipart) -> stores in DB
    - GET  /api/files/download?id=... -> binary or redirect
  - Production Azure Blob via SAS (to add):
    - POST /api/files/sas -> returns { uploadUrl, blobName, blobUrl, expiresAt }
    - POST /api/files/confirm -> persists metadata and returns file record
- Company branding update
  - Decision: Frontend should update via PUT /api/company/profile with { logoUrl, primaryColor, secondaryColor }
  - Optional admin variant: PUT /api/companies/:id/branding

### H) Payments and Settings
- Settings: /api/settings/payfast GET/POST (admin) — matches frontend
- Payments: /api/payments/payfast/checkout, /verify (auth), /status (public) — matches frontend

### I) Response Shape and Field Naming
- Lists: always { success, items, page, pageSize, total, totalPages }
- Single resources: { success, data } or direct object when clearly documented; prefer { success, data }
- Field names exposed to frontend should be camelCase; where stored as snake_case, controllers should alias
  - Examples: createdAt, updatedAt, isActive, subscriptionTiers (array)

### J) CORS and Origins
- Allow http://localhost:5173 and env FRONTEND_URL; keep credentials true.

### K) Environment Defaults for Integration
- Backend: AUTH_TYPE=custom, DB_TYPE=mssql, STORAGE_TYPE=database (dev), PAYMENTS_ENABLE_MOCK=true
- Frontend: VITE_API_BASE=http://localhost:3001/api/

Outcome: With the above decisions, the frontend calls in src/lib/api.ts will align with backend routes, and both sides will follow a single consistent contract and response shape.

Implementation Work Items (to be scheduled):
- Frontend
  - Update API base builder to default to /api/ and remove /api/public and premwebs logic
  - Switch templates admin calls from /api/platform/templates to /api/templates
  - Change company users admin view to fetch /api/companies/:id/users
  - Change branding update to use PUT /api/company/profile
- Backend
  - Add GET /api/users/:id and POST /api/users
  - Standardize paginated responses to { success, items, page, pageSize, total, totalPages } for companies and users
  - Add /api/files/sas and /api/files/confirm endpoints when STORAGE_TYPE=azure_blob
  - Ensure applications/templates controllers alias snake_case -> camelCase in responses
  - Implement Custom JWT login/register/logout per Authentication Contract

## Repository Structure

```
bizmanager/
├── backend/          # Node.js/Express API server
│   ├── src/
│   │   ├── config/       # Database, Azure, authentication configurations
│   │   ├── controllers/  # Route handlers
│   │   ├── middleware/   # Auth, SSO middleware
│   │   ├── routes/       # API routes
│   │   ├── services/     # Business logic (file storage, SSO, Azure AD B2C)
│   │   ├── sdk/          # SSO Integration SDK
│   │   ├── types/        # TypeScript type definitions
│   │   └── utils/        # JWT utilities
│   ├── migrations/   # SQL migration files (SQL Server `*_mssql.sql`)
│   └── scripts/      # Setup and migration scripts
└── frontend/         # React + Vite + shadcn/ui
    └── src/
        ├── components/   # UI components (admin, auth, billing, etc.)
        ├── contexts/     # AuthContext, DataContext
        ├── hooks/        # Custom React hooks
        ├── lib/          # API client, utilities
        └── pages/        # Route pages
```

## Local Development Setup

### Prerequisites

**Required Software:**
- Node.js 18+ with npm
- SQL Server (one of the following):
  - **SQL Server Express** (free, full-featured, recommended for development)
  - **SQL Server Developer Edition** (free, enterprise features)
  - **LocalDB** (lightweight, file-based SQL Server)
  - **Docker SQL Server container** (cross-platform option)

**SQL Server Setup Options:**

1. **SQL Server Express (Recommended)**:
   ```bash
   # Download and install SQL Server 2022 Express
   # Enable SQL Server Authentication (mixed mode)
   # Create login: sa with strong password
   # Enable TCP/IP protocol in SQL Server Configuration Manager
   ```

2. **Docker Container (Cross-platform)**:
   ```bash
   # Run SQL Server 2022 in Docker
   docker run -e "ACCEPT_EULA=Y" -e "SA_PASSWORD=YourStrong@Passw0rd" -p 1433:1433 --name sqlserver2022 -d mcr.microsoft.com/mssql/server:2022-latest
   ```

3. **LocalDB (Windows only)**:
   ```bash
   # Install with Visual Studio or as standalone
   # Connection string uses (localdb)\MSSQLLocalDB
   ```

### Local Development Workflow

**Step 1: Database Setup**
1. Install and configure local SQL Server instance
2. Create database `business_manager` (or use auto-creation via migrations)
3. Ensure SQL Server is running and accessible on port 1433
4. Test connection with SQL Server Management Studio (SSMS) or Azure Data Studio

**Step 2: Backend Configuration**
1. Copy `backend/env.example` to `backend/.env`
2. Configure local development settings:
   ```env
   NODE_ENV=development
   DB_TYPE=mssql
   
   # Local SQL Server Configuration
   MSSQL_HOST=localhost
   MSSQL_PORT=1433
   MSSQL_USER=sa
   MSSQL_PASSWORD=YourStrong@Passw0rd
   MSSQL_DB=business_manager
   MSSQL_ENCRYPT=false
   MSSQL_TRUST_CERT=true
   
   # Local Development Settings
   AUTH_TYPE=custom
   STORAGE_TYPE=database
   PAYMENTS_ENABLE_MOCK=true
   
   # JWT Configuration
   JWT_SECRET=your-local-development-secret-key-here
   JWT_EXPIRES_IN=24h
   ```

**Step 3: Database Migration**
1. Install backend dependencies: `cd backend && npm install`
2. Build TypeScript: `npm run build`
3. Run migrations: `npm run migrate`
   - Creates all database tables using `*_mssql.sql` migration files
   - Seeds initial data (admin user, applications, templates)
   - Tracks migration history in `migrations` table

**Step 4: Development Server**
```bash
cd backend
npm run dev  # Starts with nodemon for auto-reload
```

**Step 5: Frontend Setup**
```bash
cd frontend
pnpm install
pnpm dev     # Starts on http://localhost:5173
```

**Step 6: Testing the Complete Stack**
- Backend API: http://localhost:3001/api/
- Frontend: http://localhost:5173
- Default admin login: Check migration files for seeded credentials
- Test authentication, file upload, SSO token generation

### Migration Management

**Running Migrations:**
- `npm run migrate` - Runs all pending migrations for configured database type
- Migration files: `backend/migrations/*_mssql.sql` (SQL Server specific)
- Migration tracking: Automatic via `migrations` table
- Migration script: `backend/scripts/run-migrations-universal.js`

**Migration Features:**
- **Database-specific**: Only `*_mssql.sql` files are executed when `DB_TYPE=mssql`
- **Idempotent**: Skips already-executed migrations (tracked in `migrations` table)
- **Sequential**: Executes in filename order (001_, 002_, etc.)
- **Error handling**: Stops on first error, safe to re-run

**Adding New Migrations:**
1. Create file: `backend/migrations/###_description_mssql.sql`
2. Use SQL Server T-SQL syntax (not MySQL/PostgreSQL)
3. Include rollback instructions in comments
4. Test locally before committing

### Local Development Benefits

**Why Develop Locally First:**
- **Cost**: No Azure charges during development
- **Speed**: No network latency, instant feedback
- **Isolation**: Your changes don't affect production or team members
- **Debugging**: Full access to database logs, connection pooling, etc.
- **Offline**: Work without internet connection
- **Data Control**: Reset/seed database as needed for testing

**Test-Driven Development Workflow:**
1. **Local Development**: Build and test features locally
2. **Local Testing**: Comprehensive testing with local SQL Server
3. **Database Migration Testing**: Ensure migrations work on fresh database
4. **Integration Testing**: Test multi-tenant scenarios, SSO, file uploads
5. **Production Deployment**: Deploy to Azure with confidence

### Troubleshooting Local Setup

**Common Issues:**

1. **SQL Server Connection Failed**
   - Check if SQL Server service is running
   - Verify TCP/IP protocol is enabled
   - Confirm port 1433 is open
   - Test connection with SSMS first

2. **Migration Errors**
   - Check database permissions (sa user should have full access)
   - Verify `business_manager` database exists or can be auto-created
   - Review migration SQL syntax for SQL Server compatibility

3. **Authentication Issues**
   - Ensure `JWT_SECRET` is set in `.env`
   - Verify `AUTH_TYPE=custom` for local development
   - Check seeded admin user credentials in migration files

4. **File Upload Issues**
   - Confirm `STORAGE_TYPE=database` for local development
   - Check SQL Server has sufficient disk space for file storage

5. **TypeScript Build Errors**
   - Run `npm run build` before starting migrations
   - Check Node.js version compatibility (18+)
   - Verify all dependencies are installed

## Development Commands

### Backend

```bash
cd backend

# Development with auto-reload
npm run dev

# Build TypeScript
npm run build

# Production
npm start

# Database migrations
npm run migrate

# Setup scripts
npm run setup-azure-storage
npm run setup-azure-ad-b2c
```

### Frontend

```bash
cd frontend

# Development server (default: http://localhost:5173)
pnpm dev

# Build for production
pnpm build

# Lint
pnpm lint

# Preview production build
pnpm preview
```

## Configuration

Backend uses `.env` file (see [backend/env.example](backend/env.example) for template).

**Environment Configuration Philosophy:**
- **Local First**: Develop and test locally with SQL Server before deploying to Azure
- **Environment Parity**: Same database engine (SQL Server) in both local and production
- **Simplified Dependencies**: Local development avoids Azure services for faster iteration
- **Production Ready**: Easy migration to Azure services when ready to deploy

**Key Configuration Switches:**
- `DB_TYPE`: Must be set to `mssql` (SQL Server only - both local and Azure)
- `AUTH_TYPE`: `custom` (simple JWT; project decision — Azure AD B2C disabled)
- `STORAGE_TYPE`: `database` (local development) | `azure_blob` (production)
- `PAYMENTS_ENABLE_MOCK`: `true` (local/testing) | `false` (production)

**Local Development Configuration:**
```env
# Database - Local SQL Server
DB_TYPE=mssql
MSSQL_HOST=localhost
MSSQL_PORT=1433
MSSQL_USER=sa
MSSQL_PASSWORD=YourStrong@Passw0rd
MSSQL_DB=business_manager
MSSQL_ENCRYPT=false
MSSQL_TRUST_CERT=true

# Authentication - Simple JWT
AUTH_TYPE=custom
JWT_SECRET=your-local-development-secret-key

# Storage - Database blobs
STORAGE_TYPE=database

# Payments - Mock gateway
PAYMENTS_ENABLE_MOCK=true
```

**Production Configuration (Azure):**
```env
# Database - Azure SQL Database
DB_TYPE=mssql
MSSQL_HOST=your-server.database.windows.net
MSSQL_PORT=1433
MSSQL_USER=your-admin-user
MSSQL_PASSWORD=YourAzurePassword
MSSQL_DB=business_manager
MSSQL_ENCRYPT=true
MSSQL_TRUST_CERT=false

# Authentication - Custom JWT (project decision)
AUTH_TYPE=custom
# Azure AD B2C disabled

# Storage - Azure Blob Storage
STORAGE_TYPE=azure_blob
AZURE_STORAGE_CONNECTION_STRING=your-connection-string

# Payments - Real PayFast
PAYMENTS_ENABLE_MOCK=false
```

## Architecture Highlights

### Database Layer (SQL Server)

The platform uses **SQL Server exclusively** via [backend/src/config/database.ts](backend/src/config/database.ts). The `getDatabaseConnection()` function provides a consistent interface using the `mssql` package and automatically handles:
- Placeholder syntax conversion (`?` to `@param0, @param1...`)
- SQL functions (`NOW()` to `GETDATE()`)
- Pagination (`LIMIT/OFFSET` to `OFFSET...FETCH NEXT` SQL Server syntax)

**Note**: The codebase contains legacy MySQL/PostgreSQL abstraction code in [backend/src/config/database.ts](backend/src/config/database.ts) that should be ignored. Only the SQL Server code paths are used.

**Migration files**: All files in [backend/migrations/](backend/migrations/) directory are SQL Server migrations (named `*_mssql.sql`). Legacy MySQL/PostgreSQL migration files have been removed.

### Multi-Tenant SSO System

[backend/src/services/ssoCentralService.ts](backend/src/services/ssoCentralService.ts) implements cross-domain SSO:
- Master tokens for platform-wide authentication
- Domain-specific tokens for individual applications
- Session management across multiple subdomains
- SSO metrics tracking (logins, session duration, errors)

### User Roles & Permissions

The platform has **three distinct user types** with different access levels:

#### 1. Platform Admin (`role = 'admin'`)
**Who they are**: Internal team members who manage the entire platform

**Permissions**:
- Manage the application marketplace (add/edit/delete applications and templates)
- View and manage all companies on the platform
- Monitor company subscriptions and enforce subscription limits
- **Account lifecycle management**:
  - Manually deactivate accounts (`users.is_active = 0`) for non-payment or policy violations
  - Manually delete accounts permanently (removes all data)
  - Reactivate deactivated accounts if payment is received
  - Monitor grace periods and retention periods
- Access platform-wide analytics and metrics
- Full CRUD access to all platform resources

**Access**: Platform admin panel at `/admin` route (see [frontend/src/components/admin/](frontend/src/components/admin/))

#### 2. Company Admin (`role = 'user'` + `company_admin = true`)
**Who they are**: Designated administrators within a company account

**Permissions**:
- Manage company profile: logo, colors, contact details, branding
- Add/remove users to their company (subject to subscription tier limits)
- View company subscription status and manage renewals
- Access all applications/templates available to their subscription tier
- Download and customize templates with company branding

**Restrictions**:
- Cannot edit platform-level settings or other companies
- User additions limited by subscription tier
- Cannot access applications beyond their subscription tier
- Account locked after 7-day trial expires without paid subscription

#### 3. Company User (`role = 'user'` + `company_admin = false`)
**Who they are**: Regular users added to a company by a Company Admin

**Permissions**:
- View and browse applications/templates catalog
- Use applications (via SSO) available to their company's subscription tier
- Download and customize templates with their company's branding
- Inherit all access rights from their company's subscription

**Restrictions**:
- Cannot modify company profile or branding
- Cannot add/remove users
- Cannot manage subscriptions or billing
- Access limited to company's subscription tier

### Authentication (Decision)

We use Custom JWT authentication across all environments.

- Decision: `AUTH_TYPE=custom`
- Azure AD B2C: disabled (not used)
- Login/Register: custom email/password endpoints (to be enabled in code)
- Token storage: JWT + `auth_tokens` table
- SSO: unchanged; central SSO issues domain tokens using the platform session

### Current Authentication Implementation

Active flow (project decision):
1. Custom JWT authentication (Azure AD B2C disabled)
2. Token storage: JWT format + `auth_tokens` database table
3. Middleware: [backend/src/middleware/auth.ts](backend/src/middleware/auth.ts) validates tokens and populates `req.user`

---

## Company-Scoped User Management (without Azure AD B2C)

You can fully manage users per company using the built-in custom JWT approach. Azure AD B2C is optional and not required for company user management.

### Core Model
- Each user has a `company_id` and a `company_admin` flag (see migrations)  
- Roles: `admin` (Platform Admin), `user` (Company user). Company admins are `user` + `company_admin = true`  
- Subscription seat limits enforced at company level (by `subscription_tier`)

### Access Control Enforcement
- Auth middleware loads `req.user` with `companyId` and `companyAdmin`  
- Platform Admin endpoints require `requireAdmin`  
- Company Admin actions verify same `company_id` and `company_admin = true`

### Existing Endpoints (usable without AD B2C)
- Assign user to a company (admin or company admin):  
  `POST /api/users/:id/assign-company`  
  Sets `company_id`, inherits tier, optionally promotes first admin
- Toggle company admin flag (admin or company admin if same company):  
  `POST /api/users/:id/set-company-admin`
- Platform-wide user operations (Platform Admin only):  
  `GET /api/users`, `PUT /api/users/:id`, `DELETE /api/users/:id`

### Planned Company Admin Endpoints (to add)
- List my company users: `GET /api/company/users`  
- Invite user by email (sends invite token): `POST /api/company/users/invite`  
- Resend invite: `POST /api/company/users/:id/resend-invite`  
- Remove user from my company: `DELETE /api/company/users/:id`  
- Set seat limits per tier (enforced on add): backend check on `subscription_tier`

Example invite payload:
```json path=null start=null
{
  "email": "new.user@acme.com",
  "firstName": "New",
  "lastName": "User",
  "makeCompanyAdmin": false
}
```

### Authentication Provider Independence
- With `AUTH_TYPE=custom`, login/register use email + password (JWT)  
- With `AUTH_TYPE=azure_ad_b2c`, the identity comes from Microsoft  
- In both cases, the SSO system issues domain tokens and enforces company scoping  
- SSO is provider-agnostic: it uses `req.user` context (role, company_id, tier)

Minimal local config for company-scoped management using custom JWT:
```env path=null start=null
AUTH_TYPE=custom
DB_TYPE=mssql
STORAGE_TYPE=database
PAYMENTS_ENABLE_MOCK=true
JWT_SECRET=your-local-development-secret
```

Notes:
- The current `authController` disables username/password while AD B2C is primary.  
- Action item (when ready): re-enable the custom JWT login/register handlers under `AUTH_TYPE=custom` for local dev and simple production use.

Frontend authentication managed by [frontend/src/contexts/AuthContext.tsx](frontend/src/contexts/AuthContext.tsx):
- Token stored in localStorage
- User profile hydration via `/api/auth/me`
- Retry logic for token validation on app bootstrap
- Post-auth intent redirection (for subscribe-then-login flows)

### File Storage Abstraction

[backend/src/services/fileStorageService.ts](backend/src/services/fileStorageService.ts) provides unified interface:
- `STORAGE_TYPE=database`: Files stored as BLOBs in SQL Server `files` table (recommended for development)
- `STORAGE_TYPE=azure_blob`: Files stored in Azure Blob Storage (recommended for production)

### API Client

Frontend API client in [frontend/src/lib/api.ts](frontend/src/lib/api.ts) supports flexible API base URL:
1. `VITE_API_BASE` environment variable
2. Query parameter override (`?apiBase=` or `?api=`)
3. localStorage persistence
4. Defaults to current domain + `/api/`

### Multi-Tenant Company Architecture

**Company-centric design**: The platform is organized around companies, not individual users:
- `companies` table stores company profiles with branding fields:
  - `logo_url`: Company logo
  - `primary_color`, `secondary_color`: Brand colors (defaults: #3B82F6, #1E40AF)
  - Contact info: `address`, `phone`, `email`, `website`
  - Business info: `description`, `industry`, `size`, `tagline`
- `users` table links to companies via `company_id` foreign key
- `company_admin` flag on users controls who can manage company settings
- **Template personalization**: When users download templates, they are pre-filled with the company's branding and details

### Subscription System

**Two paid subscription tiers**:

1. **DIY** (`subscription_tier = 'diy'`)
   - Self-service business management tools
   - Access to core applications and templates
   - Limited user seats per company

2. **DIY + Accountant** (`subscription_tier = 'diy_accountant'`)
   - All DIY features plus accountant collaboration tools
   - Access to advanced applications and templates
   - More user seats per company
   - Accountant-specific features and integrations

**Trial period**:
- New signups get `subscription_tier = 'trial'` with 7-day access to their chosen tier's features
- Trial expiry tracked in `users.subscription_expiry` field
- After trial expires without payment, users must upgrade to a paid tier to regain access

**Account lifecycle and payment enforcement**:

1. **Payment Due**: When `subscription_expiry` date passes without renewal
   - System sends payment reminder notifications to Company Admin
   - Grace period begins (duration TBD)
   - Account remains active during grace period

2. **Account Deactivation** (two triggers):
   - **Automatic**: After grace period expires with no payment, system sets `users.is_active = 0`
   - **Manual**: Platform Admin can manually deactivate account anytime via `users.is_active = 0`
   - When deactivated: Users cannot login, but data is retained in database
   - Deactivation starts a retention countdown (duration TBD)

3. **Account Deletion** (permanent removal):
   - **Automatic**: After retention period expires, account and all associated data is permanently deleted from database
   - **Manual**: Platform Admin can manually delete account before retention period expires (e.g., user requests deletion)
   - Deletion is **irreversible** - removes user, company data, and all associated records

**Platform Admin responsibilities**:
- Monitor accounts approaching payment due dates
- Send payment reminders during grace period
- Manually deactivate accounts for policy violations or upon request
- Manually delete accounts upon user request or after retention period
- Reactivate accounts if payment is received during deactivation period

**Technical implementation**:
- Subscription data stored at user level: `users.subscription_tier` and `users.subscription_expiry`
- Applications and templates tagged by minimum required tier in `subscription_tiers` JSON field
- User limits per tier enforced when Company Admins add users
- PayFast payment gateway for South African market
- `PAYMENTS_ENABLE_MOCK=true` for development/testing without real payments

## Important Notes

- **TypeScript**: Both frontend and backend use TypeScript with strict mode enabled
- **API Routes**: All backend routes prefixed with `/api/` (e.g., `/api/auth/login`, `/api/files/upload`)
- **CORS**: Backend configured for `localhost:5173`, `localhost:3000`, `localhost:5174` and `FRONTEND_URL` env var
- **Role-Based Access**: Three-tier permission system:
  - Platform Admin: `role = 'admin'` (full platform access)
  - Company Admin: `role = 'user'` + `company_admin = true` (manage company)
  - Company User: `role = 'user'` + `company_admin = false` (view/use only)
- **Bootstrap Gate**: [frontend/src/components/layout/BootstrapGate.tsx](frontend/src/components/layout/BootstrapGate.tsx) blocks render until auth state resolved
- **Data Scoping**: Company Users and Company Admins should only see data scoped to their `company_id`; Platform Admins see all data

## Database Migrations

Run migrations with `npm run migrate` in backend directory. Migrations are applied sequentially based on filename prefix (001_, 002_, etc.).

**Important**: All migration files are SQL Server specific and named `*_mssql.sql`. When creating new migrations, always use SQL Server-specific syntax (T-SQL) and follow the naming convention `###_description_mssql.sql`.
