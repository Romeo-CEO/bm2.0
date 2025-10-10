-- Create password_resets table for password recovery flow
BEGIN TRANSACTION;

IF OBJECT_ID('dbo.password_resets', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.password_resets (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    user_id UNIQUEIDENTIFIER NOT NULL,
    token_hash NVARCHAR(256) NOT NULL,
    expires_at DATETIMEOFFSET NOT NULL,
    used_at DATETIMEOFFSET NULL,
    created_at DATETIMEOFFSET NOT NULL DEFAULT GETUTCDATE(),
    FOREIGN KEY (user_id) REFERENCES dbo.users(id) ON DELETE CASCADE
  );

  CREATE UNIQUE INDEX IX_password_resets_token_hash ON dbo.password_resets(token_hash);
  CREATE INDEX IX_password_resets_user_id ON dbo.password_resets(user_id);
  CREATE INDEX IX_password_resets_expires_at ON dbo.password_resets(expires_at);
END

COMMIT TRANSACTION;
