-- Migration: Tag applications with appropriate subscription tiers
-- Based on pricing page promises:
-- FREE: Invoicing, Quotes, Receipts, Basic Calculators
-- DIY: Most apps (70% coverage)
-- DIY+Accountant: All apps (100% coverage)

-- Step 1: Update core FREE apps (available to all tiers)
-- Invoicing, Quotes, Receipts
UPDATE applications
SET subscription_tiers = JSON_MODIFY(
    COALESCE(subscription_tiers, '[]'),
    'append $',
    'free'
)
WHERE name IN ('Invoice Generator', 'Quote Generator', 'Receipt Generator', 'Invoicing', 'Quotes', 'Receipts');

-- Step 2: Update calculators (available to FREE tier)
UPDATE applications
SET subscription_tiers = JSON_MODIFY(
    COALESCE(subscription_tiers, '[]'),
    'append $',
    'free'
)
WHERE category = 'Calculators' OR category LIKE '%Calculator%';

-- Step 3: Tag DIY-level apps (Most apps - 70% coverage)
-- These apps require DIY or higher
UPDATE applications
SET subscription_tiers = '["diy", "diy_accountant"]'
WHERE category IN ('HR', 'Human Resources', 'Project Management', 'Sales', 'Marketing', 'Inventory')
AND subscription_tiers NOT LIKE '%free%';

-- Step 4: Tag premium DIY+Accountant apps (100% coverage)
-- Advanced financial tools, compliance, tax tools
UPDATE applications
SET subscription_tiers = '["diy_accountant"]'
WHERE (category IN ('Advanced Finance', 'Tax & Compliance', 'Audit', 'Financial Statements')
   OR name LIKE '%Tax%'
   OR name LIKE '%Compliance%'
   OR name LIKE '%Audit%'
   OR name LIKE '%Financial Statement%')
AND subscription_tiers NOT LIKE '%free%';

-- Step 5: Ensure trial tier can access same as free
-- Trial users get full access for evaluation, so update trial apps
UPDATE applications
SET subscription_tiers = JSON_MODIFY(
    subscription_tiers,
    'append $',
    'trial'
)
WHERE subscription_tiers LIKE '%free%'
AND subscription_tiers NOT LIKE '%trial%';

GO

PRINT 'Applications tagged with subscription tiers successfully';
