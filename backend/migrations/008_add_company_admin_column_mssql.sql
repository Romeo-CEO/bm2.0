-- No-op for MSSQL; company_admin column already managed by earlier migration
-- This ensures migration numbering stays in sync across database targets.
BEGIN TRANSACTION;
COMMIT TRANSACTION;
