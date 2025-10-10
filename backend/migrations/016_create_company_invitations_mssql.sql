-- Create company_invitations table for company user invite workflow
BEGIN TRANSACTION;

IF OBJECT_ID('dbo.company_invitations', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.company_invitations (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    company_id UNIQUEIDENTIFIER NOT NULL,
    email NVARCHAR(255) NOT NULL,
    token_hash NVARCHAR(256) NOT NULL,
    status NVARCHAR(20) NOT NULL DEFAULT 'pending',
    expires_at DATETIMEOFFSET NOT NULL,
    invited_by UNIQUEIDENTIFIER NULL,
    accepted_at DATETIMEOFFSET NULL,
    created_at DATETIMEOFFSET NOT NULL DEFAULT GETUTCDATE(),
    updated_at DATETIMEOFFSET NOT NULL DEFAULT GETUTCDATE(),
    FOREIGN KEY (company_id) REFERENCES dbo.companies(id) ON DELETE CASCADE,
    FOREIGN KEY (invited_by) REFERENCES dbo.users(id) ON DELETE NO ACTION
  );

  CREATE UNIQUE INDEX IX_company_invitations_token_hash ON dbo.company_invitations(token_hash);
  CREATE INDEX IX_company_invitations_company_id ON dbo.company_invitations(company_id);
  CREATE INDEX IX_company_invitations_email ON dbo.company_invitations(email);
  CREATE INDEX IX_company_invitations_status_expires_at ON dbo.company_invitations(status, expires_at);
END

COMMIT TRANSACTION;
