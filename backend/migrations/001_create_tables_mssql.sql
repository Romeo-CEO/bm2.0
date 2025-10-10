-- SQL Server Migration: Create Business Manager Tables
-- Converted from PostgreSQL schema for Azure SQL Database

-- Users table
CREATE TABLE users (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    email NVARCHAR(255) UNIQUE NOT NULL,
    password_hash NVARCHAR(255) NOT NULL,
    first_name NVARCHAR(100) NOT NULL,
    last_name NVARCHAR(100) NOT NULL,
    role NVARCHAR(20) DEFAULT 'user' CHECK (role IN ('admin', 'user')),
    company_id UNIQUEIDENTIFIER,
    subscription_tier NVARCHAR(20) DEFAULT 'trial' CHECK (subscription_tier IN ('trial', 'diy', 'diy_accountant')),
    subscription_expiry DATETIMEOFFSET,
    is_active BIT DEFAULT 1,
    created_at DATETIMEOFFSET DEFAULT GETUTCDATE(),
    updated_at DATETIMEOFFSET DEFAULT GETUTCDATE()
);

-- Companies table
CREATE TABLE companies (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    name NVARCHAR(255) NOT NULL,
    domain NVARCHAR(255) NOT NULL,
    owner_id UNIQUEIDENTIFIER NOT NULL,
    is_active BIT DEFAULT 1,
    created_at DATETIMEOFFSET DEFAULT GETUTCDATE(),
    updated_at DATETIMEOFFSET DEFAULT GETUTCDATE(),
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Applications table
CREATE TABLE applications (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    name NVARCHAR(255) NOT NULL,
    description NVARCHAR(MAX),
    category NVARCHAR(100) NOT NULL,
    type NVARCHAR(20) NOT NULL CHECK (type IN ('application', 'template')),
    url NVARCHAR(MAX),
    download_url NVARCHAR(MAX),
    file_name NVARCHAR(255),
    file_size NVARCHAR(50),
    subscription_tiers NVARCHAR(MAX) NOT NULL, -- JSON stored as string
    is_active BIT DEFAULT 1,
    created_at DATETIMEOFFSET DEFAULT GETUTCDATE(),
    updated_at DATETIMEOFFSET DEFAULT GETUTCDATE()
);

-- Templates table (separate from applications)
CREATE TABLE templates (
    id NVARCHAR(64) PRIMARY KEY,
    name NVARCHAR(255) NOT NULL,
    description NVARCHAR(MAX),
    category NVARCHAR(100) NOT NULL,
    download_url NVARCHAR(MAX),
    file_name NVARCHAR(255),
    file_size NVARCHAR(50),
    file_type NVARCHAR(100),
    subscription_tiers NVARCHAR(MAX) NOT NULL, -- JSON stored as string
    is_active BIT DEFAULT 1,
    created_at DATETIMEOFFSET DEFAULT GETUTCDATE(),
    updated_at DATETIMEOFFSET DEFAULT GETUTCDATE()
);

-- Auth tokens table for JWT-like token authentication
CREATE TABLE auth_tokens (
    token NVARCHAR(128) PRIMARY KEY,
    user_id UNIQUEIDENTIFIER NOT NULL,
    expires_at DATETIMEOFFSET NOT NULL,
    created_at DATETIMEOFFSET DEFAULT GETUTCDATE(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- File uploads table (updated for Azure Blob Storage support)
CREATE TABLE file_uploads (
    id NVARCHAR(128) PRIMARY KEY,
    filename NVARCHAR(255) NOT NULL,
    file_type NVARCHAR(100) NOT NULL,
    file_size INT NOT NULL,
    file_data VARBINARY(MAX), -- For database storage (nullable when using blob storage)
    blob_url NVARCHAR(MAX), -- For Azure Blob Storage URLs (nullable when using database storage)
    uploaded_by UNIQUEIDENTIFIER NOT NULL,
    uploaded_at DATETIMEOFFSET DEFAULT GETUTCDATE(),
    FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE CASCADE
);

-- Create indexes for better performance
CREATE INDEX IX_users_email ON users(email);
CREATE INDEX IX_users_company_id ON users(company_id);
CREATE INDEX IX_companies_owner_id ON companies(owner_id);
CREATE INDEX IX_applications_category ON applications(category);
CREATE INDEX IX_applications_type ON applications(type);
CREATE INDEX IX_templates_category ON templates(category);
CREATE INDEX IX_auth_tokens_user_id ON auth_tokens(user_id);
CREATE INDEX IX_auth_tokens_expires_at ON auth_tokens(expires_at);
CREATE INDEX IX_file_uploads_uploaded_by ON file_uploads(uploaded_by);
CREATE INDEX IX_file_uploads_uploaded_at ON file_uploads(uploaded_at);