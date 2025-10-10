-- SQL Server: Create marketplace_applications table
BEGIN TRAN;

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[marketplace_applications]') AND type in (N'U'))
BEGIN
  CREATE TABLE marketplace_applications (
    id NVARCHAR(128) NOT NULL PRIMARY KEY,
    name NVARCHAR(MAX) NOT NULL,
    slug NVARCHAR(256),
    short_description NVARCHAR(MAX),
    category NVARCHAR(256),
    subcategory NVARCHAR(256),
    developer NVARCHAR(256),
    subscription_tiers NVARCHAR(MAX),
    starting_price DECIMAL(12,2) DEFAULT 0,
    pricing_model NVARCHAR(64),
    trial_available BIT DEFAULT 0,
    icon_url NVARCHAR(MAX),
    screenshots NVARCHAR(MAX),
    is_featured BIT DEFAULT 0,
    is_new BIT DEFAULT 1,
    rating DECIMAL(3,2) DEFAULT 0,
    total_reviews INT DEFAULT 0,
    order_priority INT DEFAULT 100,
    required_subscription_tier NVARCHAR(64),
    target_platforms NVARCHAR(MAX),
    app_url NVARCHAR(MAX),
    webhook_url NVARCHAR(MAX),
    created_at DATETIME2 DEFAULT SYSUTCDATETIME(),
    updated_at DATETIME2 DEFAULT SYSUTCDATETIME()
  );
END

IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = 'idx_marketplace_category')
  CREATE INDEX idx_marketplace_category ON marketplace_applications(category);
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = 'idx_marketplace_priority')
  CREATE INDEX idx_marketplace_priority ON marketplace_applications(order_priority);

COMMIT TRAN;
