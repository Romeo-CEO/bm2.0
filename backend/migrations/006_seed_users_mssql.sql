-- SQL Server Migration: Seed Users Data
-- Creates default admin and test users

-- Insert default admin user
IF NOT EXISTS (SELECT 1 FROM users WHERE email = 'admin@businessmanager.com')
BEGIN
    INSERT INTO users (
        id,
        email,
        password_hash,
        first_name,
        last_name,
        role,
        subscription_tier,
        subscription_expiry,
        is_active,
        created_at,
        updated_at
    ) VALUES (
        NEWID(),
        'admin@businessmanager.com',
        '$2b$10$8KcKJzGJjGJzGJzGJzGJzOXZGJzGJzGJzGJzGJzGJzGJzGJzGJzGJz', -- Default password: admin123
        'Admin',
        'User',
        'admin',
        'diy_accountant',
        DATEADD(YEAR, 1, GETUTCDATE()),
        1,
        GETUTCDATE(),
        GETUTCDATE()
    );
END

-- Insert default test user
IF NOT EXISTS (SELECT 1 FROM users WHERE email = 'test@businessmanager.com')
BEGIN
    INSERT INTO users (
        id,
        email,
        password_hash,
        first_name,
        last_name,
        role,
        subscription_tier,
        subscription_expiry,
        is_active,
        created_at,
        updated_at
    ) VALUES (
        NEWID(),
        'test@businessmanager.com',
        '$2b$10$8KcKJzGJjGJzGJzGJzGJzOXZGJzGJzGJzGJzGJzGJzGJzGJzGJzGJz', -- Default password: test123
        'Test',
        'User',
        'user',
        'trial',
        DATEADD(DAY, 30, GETUTCDATE()),
        1,
        GETUTCDATE(),
        GETUTCDATE()
    );
END

-- Insert demo company for admin user
IF NOT EXISTS (SELECT 1 FROM companies WHERE name = 'Demo Company')
BEGIN
    DECLARE @AdminUserId UNIQUEIDENTIFIER = (SELECT TOP 1 id FROM users WHERE email = 'admin@businessmanager.com');

    INSERT INTO companies (
        id,
        name,
        domain,
        owner_id,
        is_active,
        created_at,
        updated_at
    ) VALUES (
        NEWID(),
        'Demo Company',
        'demo.businessmanager.com',
        @AdminUserId,
        1,
        GETUTCDATE(),
        GETUTCDATE()
    );
END

-- Update admin user with company_id
UPDATE users
SET company_id = (SELECT TOP 1 id FROM companies WHERE name = 'Demo Company')
WHERE email = 'admin@businessmanager.com' AND company_id IS NULL;