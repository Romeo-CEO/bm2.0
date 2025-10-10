-- Create audit_logs table for platform-wide auditing
BEGIN TRANSACTION;

IF OBJECT_ID('dbo.audit_logs', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.audit_logs (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    user_id UNIQUEIDENTIFIER NULL,
    email NVARCHAR(255) NULL,
    event_type NVARCHAR(100) NOT NULL,
    success BIT NOT NULL,
    ip_address NVARCHAR(45) NULL,
    user_agent NVARCHAR(512) NULL,
    metadata NVARCHAR(MAX) NULL,
    created_at DATETIMEOFFSET NOT NULL DEFAULT GETUTCDATE(),
    FOREIGN KEY (user_id) REFERENCES dbo.users(id) ON DELETE SET NULL
  );

  CREATE INDEX IX_audit_logs_event_type ON dbo.audit_logs(event_type);
  CREATE INDEX IX_audit_logs_created_at ON dbo.audit_logs(created_at);
  CREATE INDEX IX_audit_logs_user_id ON dbo.audit_logs(user_id);
END

COMMIT TRANSACTION;
