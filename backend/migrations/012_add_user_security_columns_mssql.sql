-- Add columns to track authentication security state on users table
BEGIN TRANSACTION;

IF COL_LENGTH('dbo.users', 'failed_login_attempts') IS NULL
BEGIN
  ALTER TABLE dbo.users
    ADD failed_login_attempts INT NOT NULL CONSTRAINT DF_users_failed_login_attempts DEFAULT (0);
END

IF COL_LENGTH('dbo.users', 'lockout_until') IS NULL
BEGIN
  ALTER TABLE dbo.users
    ADD lockout_until DATETIMEOFFSET NULL;
END

IF COL_LENGTH('dbo.users', 'last_failed_login_at') IS NULL
BEGIN
  ALTER TABLE dbo.users
    ADD last_failed_login_at DATETIMEOFFSET NULL;
END

COMMIT TRANSACTION;
