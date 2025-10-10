-- Migration: Add 'free' subscription tier option
-- This adds 'free' as a valid subscription tier alongside 'trial', 'diy', and 'diy_accountant'

-- For MSSQL, we need to:
-- 1. Remove the existing CHECK constraint on subscription_tier
-- 2. Add a new CHECK constraint that includes 'free'

-- First, find and drop the existing constraint (name may vary)
-- We'll use a dynamic approach

DECLARE @ConstraintName nvarchar(200)
SELECT @ConstraintName = Name
FROM sys.check_constraints
WHERE parent_object_id = OBJECT_ID('users')
AND COL_NAME(parent_object_id, parent_column_id) = 'subscription_tier'

IF @ConstraintName IS NOT NULL
    EXEC('ALTER TABLE users DROP CONSTRAINT ' + @ConstraintName)
GO

-- Add new constraint with 'free' tier
ALTER TABLE users
ADD CONSTRAINT CK_users_subscription_tier
CHECK (subscription_tier IN ('free', 'trial', 'diy', 'diy_accountant'));
GO

-- Update any existing 'trial' users who should be 'free' (optional - can be done later)
-- UPDATE users SET subscription_tier = 'free' WHERE subscription_tier = 'trial' AND subscription_expiry IS NULL;
