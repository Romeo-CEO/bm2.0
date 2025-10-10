-- Fix auth_tokens table token column size for JWT tokens
-- JWT tokens are typically 200-500 characters long, but NVARCHAR(128) is too small
-- Use NVARCHAR(500) instead of NVARCHAR(MAX) so it can still be used as primary key

-- First, let's find and drop the existing primary key constraint
-- We need to find the actual constraint name
DECLARE @ConstraintName NVARCHAR(200)
SELECT @ConstraintName = CONSTRAINT_NAME
FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
WHERE TABLE_NAME = 'auth_tokens' AND CONSTRAINT_TYPE = 'PRIMARY KEY'

-- Drop the constraint if it exists
IF @ConstraintName IS NOT NULL
BEGIN
    EXEC('ALTER TABLE auth_tokens DROP CONSTRAINT ' + @ConstraintName)
END
GO

-- Check if there are any NULL values in the token column
IF EXISTS (SELECT 1 FROM auth_tokens WHERE token IS NULL)
BEGIN
    -- Update NULL values with a placeholder (this shouldn't happen in normal operation)
    UPDATE auth_tokens SET token = 'placeholder-' + LOWER(CONVERT(NVARCHAR(36), NEWID())) WHERE token IS NULL
END
GO

-- Alter the column to the target size AND make it NOT NULL in one step
ALTER TABLE auth_tokens
ALTER COLUMN token NVARCHAR(500) NOT NULL;
GO

-- Recreate the primary key constraint
ALTER TABLE auth_tokens
ADD CONSTRAINT PK_auth_tokens PRIMARY KEY (token);
GO
