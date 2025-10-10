-- Migration: Create SSO Tables
-- SQL Server version - converted from PostgreSQL
-- Purpose: New tables for cross-domain authentication infrastructure

BEGIN TRANSACTION;

-- Cross-domain session tracking
CREATE TABLE sso_sessions (
  id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
  user_id UNIQUEIDENTIFIER NOT NULL,
  master_token_signature NVARCHAR(MAX), -- Cannot be UNIQUE in SQL Server for NVARCHAR(MAX)
  platform_session_id UNIQUEIDENTIFIER,
  domain_sessions NVARCHAR(MAX) DEFAULT '{}', -- JSON stored as string
  created_at DATETIMEOFFSET DEFAULT GETUTCDATE(),
  expires_at DATETIMEOFFSET,
  last_activity DATETIMEOFFSET DEFAULT GETUTCDATE(),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Application registration for SSO discovery
CREATE TABLE sso_applications (
  id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
  name NVARCHAR(255) UNIQUE NOT NULL, -- Changed from MAX for UNIQUE constraint
  domain NVARCHAR(255) UNIQUE NOT NULL, -- Changed from MAX for UNIQUE constraint
  public_key NVARCHAR(MAX),
  status NVARCHAR(20) DEFAULT 'ACTIVE',
  sso_enabled BIT DEFAULT 0,
  sso_endpoint NVARCHAR(MAX),
  created_at DATETIMEOFFSET DEFAULT GETUTCDATE(),
  updated_at DATETIMEOFFSET DEFAULT GETUTCDATE(),
  CONSTRAINT CK_sso_applications_status CHECK (status IN ('ACTIVE', 'MAINTENANCE', 'DISABLED'))
);

-- Comprehensive SSO audit logging
CREATE TABLE sso_audit (
  id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
  event_type NVARCHAR(50) NOT NULL,
  user_id UNIQUEIDENTIFIER,
  application_id UNIQUEIDENTIFIER,
  source_domain NVARCHAR(MAX),
  target_domain NVARCHAR(MAX),
  success BIT DEFAULT 1,
  error_message NVARCHAR(MAX),
  event_data NVARCHAR(MAX) DEFAULT '{}', -- JSON stored as string
  created_at DATETIMEOFFSET DEFAULT GETUTCDATE(),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (application_id) REFERENCES sso_applications(id),
  CONSTRAINT CK_sso_audit_event_type CHECK (event_type IN ('SSO_LOGIN', 'TOKEN_REFRESH', 'FAILED_CONTEXT', 'SESSION_SYNC', 'DOMAIN_SWITCH'))
);

-- SSO token validation cache (performance optimization)
CREATE TABLE sso_token_cache (
  id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
  token_signature NVARCHAR(MAX), -- Cannot be UNIQUE in SQL Server for NVARCHAR(MAX)
  user_id UNIQUEIDENTIFIER NOT NULL,
  master_token_id NVARCHAR(MAX),
  domain_context NVARCHAR(MAX), -- JSON stored as string
  expires_at DATETIMEOFFSET,
  created_at DATETIMEOFFSET DEFAULT GETUTCDATE(),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Indexes for performance
CREATE INDEX IX_sso_sessions_user_id ON sso_sessions(user_id);
-- Cannot index NVARCHAR(MAX) columns in SQL Server, skipping master_token_signature index
CREATE INDEX IX_sso_sessions_expires ON sso_sessions(expires_at);

CREATE INDEX IX_sso_applications_domain ON sso_applications(domain);
CREATE INDEX IX_sso_applications_name ON sso_applications(name);
CREATE INDEX IX_sso_applications_status ON sso_applications(status, sso_enabled);

CREATE INDEX IX_sso_audit_user_id ON sso_audit(user_id);
CREATE INDEX IX_sso_audit_timestamp ON sso_audit(created_at);
CREATE INDEX IX_sso_audit_event_type ON sso_audit(event_type);

-- Cannot index NVARCHAR(MAX) columns in SQL Server, skipping token_signature index
CREATE INDEX IX_sso_token_cache_expires ON sso_token_cache(expires_at);

-- Initial seed data for development (using MERGE to handle conflicts)
MERGE sso_applications AS target
USING (VALUES
  ('Business Suite Platform', 'platform.business-suite.com', 1),
  ('Accounting Application', 'accounting.business-suite.com', 0),
  ('HR Management', 'hr.business-suite.com', 0),
  ('Client Portal', 'portal.business-suite.com', 0)
) AS source (name, domain, sso_enabled)
ON (target.name = source.name)
WHEN NOT MATCHED THEN
  INSERT (name, domain, sso_enabled)
  VALUES (source.name, source.domain, source.sso_enabled)
WHEN MATCHED THEN
  UPDATE SET
    domain = source.domain,
    sso_enabled = source.sso_enabled,
    updated_at = GETUTCDATE();

COMMIT TRANSACTION;