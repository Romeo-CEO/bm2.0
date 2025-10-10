-- SQL Server migration: add company_admin flag to users
-- Idempotent addition of company_admin column used for company-level admin rights

IF COL_LENGTH('dbo.users', 'company_admin') IS NULL
BEGIN
  ALTER TABLE dbo.users
    ADD company_admin BIT NOT NULL CONSTRAINT DF_users_company_admin DEFAULT (0);
END

-- Optional: backfill owner as company_admin for existing companies
-- This safely sets company_admin = 1 for users who are owners of a company
IF COL_LENGTH('dbo.users', 'company_admin') IS NOT NULL
BEGIN
  EXEC(
    'UPDATE u
      SET u.company_admin = 1
      FROM dbo.users u
      INNER JOIN dbo.companies c ON c.owner_id = u.id
      WHERE u.company_admin = 0;'
  );
END
