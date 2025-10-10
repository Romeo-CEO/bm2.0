-- Migration: Tag templates with appropriate subscription tiers
-- Based on pricing page promises:
-- FREE: Basic templates only
-- DIY: All templates
-- DIY+Accountant: All templates

-- Step 1: Tag basic/essential templates as FREE
-- Basic invoices, quotes, receipts, simple contracts
UPDATE templates
SET subscription_tiers = '["free", "trial", "diy", "diy_accountant"]'
WHERE (
    name LIKE '%Basic%'
    OR name LIKE '%Simple%'
    OR name LIKE '%Invoice%'
    OR name LIKE '%Quote%'
    OR name LIKE '%Receipt%'
    OR category = 'Basic'
);

-- Step 2: Tag advanced templates as DIY+ only
UPDATE templates
SET subscription_tiers = '["diy", "diy_accountant"]'
WHERE subscription_tiers NOT LIKE '%free%';

-- Step 3: Ensure at least 5-10 templates are available to FREE users
-- Get the most commonly used templates
UPDATE TOP (10) templates
SET subscription_tiers = '["free", "trial", "diy", "diy_accountant"]'
WHERE category IN ('Accounting & Finance', 'General')
ORDER BY created_at DESC;

GO

PRINT 'Templates tagged with subscription tiers successfully';
