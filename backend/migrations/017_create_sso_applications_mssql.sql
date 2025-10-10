IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[sso_applications]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[sso_applications] (
        [id] UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        [name] NVARCHAR(255) NOT NULL,
        [domain] NVARCHAR(255) NOT NULL,
        [sso_enabled] BIT NOT NULL DEFAULT 0,
        [metadata] NVARCHAR(MAX) NULL,
        [created_at] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        [updated_at] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );

    CREATE UNIQUE INDEX IX_sso_applications_name ON [dbo].[sso_applications] (name);
    CREATE UNIQUE INDEX IX_sso_applications_domain ON [dbo].[sso_applications] (domain);
END;
GO
