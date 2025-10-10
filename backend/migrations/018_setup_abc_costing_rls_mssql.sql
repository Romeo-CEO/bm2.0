-- Configure shared row-level security and ABC Costing schema

IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = 'abc')
BEGIN
    EXEC('CREATE SCHEMA abc AUTHORIZATION dbo;');
END;
GO

IF OBJECT_ID(N'dbo.fn_tenant_rls_predicate', N'IF') IS NULL
BEGIN
    EXEC('CREATE FUNCTION dbo.fn_tenant_rls_predicate (@tenant_id UNIQUEIDENTIFIER)
          RETURNS TABLE
          WITH SCHEMABINDING
          AS
          RETURN
          SELECT 1 AS fn_result
          FROM (SELECT
                    TRY_CONVERT(UNIQUEIDENTIFIER, SESSION_CONTEXT(N''tenant_id'')) AS tenant_context,
                    LOWER(CONVERT(NVARCHAR(10), SESSION_CONTEXT(N''allow_cross_tenant''))) AS admin_flag
                ) AS ctx
          WHERE
            (ctx.tenant_context IS NOT NULL AND @tenant_id = ctx.tenant_context)
            OR (ctx.admin_flag IN (N''1'', N''true'', N''yes''));');
END;
GO

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[abc].[costing_projects]') AND type in (N'U'))
BEGIN
    CREATE TABLE [abc].[costing_projects] (
        [id] UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID() PRIMARY KEY,
        [tenant_id] UNIQUEIDENTIFIER NOT NULL,
        [name] NVARCHAR(255) NOT NULL,
        [description] NVARCHAR(1000) NULL,
        [status] NVARCHAR(50) NOT NULL DEFAULT N'draft',
        [currency_code] NVARCHAR(3) NOT NULL DEFAULT N'USD',
        [created_by] UNIQUEIDENTIFIER NOT NULL,
        [created_at] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        [updated_at] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT [FK_costing_projects_created_by] FOREIGN KEY ([created_by]) REFERENCES [dbo].[users]([id])
    );

    CREATE INDEX [IX_costing_projects_tenant] ON [abc].[costing_projects] ([tenant_id]);
    CREATE INDEX [IX_costing_projects_status] ON [abc].[costing_projects] ([status]);
END;
GO

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[abc].[costing_project_items]') AND type in (N'U'))
BEGIN
    CREATE TABLE [abc].[costing_project_items] (
        [id] UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID() PRIMARY KEY,
        [tenant_id] UNIQUEIDENTIFIER NOT NULL,
        [project_id] UNIQUEIDENTIFIER NOT NULL,
        [name] NVARCHAR(255) NOT NULL,
        [quantity] DECIMAL(18,2) NOT NULL DEFAULT 1,
        [unit_cost] DECIMAL(18,4) NOT NULL DEFAULT 0,
        [markup_percent] DECIMAL(5,2) NOT NULL DEFAULT 0,
        [created_at] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        [updated_at] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT [FK_costing_project_items_project] FOREIGN KEY ([project_id]) REFERENCES [abc].[costing_projects]([id]) ON DELETE CASCADE
    );

    CREATE INDEX [IX_costing_project_items_tenant] ON [abc].[costing_project_items] ([tenant_id]);
    CREATE INDEX [IX_costing_project_items_project] ON [abc].[costing_project_items] ([project_id]);
END;
GO

IF OBJECT_ID(N'dbo.tenant_isolation_policy', N'SP') IS NULL
BEGIN
    EXEC('CREATE SECURITY POLICY dbo.tenant_isolation_policy
        ADD FILTER PREDICATE dbo.fn_tenant_rls_predicate(tenant_id) ON abc.costing_projects,
        ADD BLOCK PREDICATE dbo.fn_tenant_rls_predicate(tenant_id) ON abc.costing_projects AFTER INSERT,
        ADD BLOCK PREDICATE dbo.fn_tenant_rls_predicate(tenant_id) ON abc.costing_projects AFTER UPDATE,
        ADD FILTER PREDICATE dbo.fn_tenant_rls_predicate(tenant_id) ON abc.costing_project_items,
        ADD BLOCK PREDICATE dbo.fn_tenant_rls_predicate(tenant_id) ON abc.costing_project_items AFTER INSERT,
        ADD BLOCK PREDICATE dbo.fn_tenant_rls_predicate(tenant_id) ON abc.costing_project_items AFTER UPDATE
        WITH (STATE = ON);');
END
ELSE
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM sys.security_predicates
        WHERE security_policy_id = OBJECT_ID(N'dbo.tenant_isolation_policy')
          AND target_object_id = OBJECT_ID(N'abc.costing_projects')
          AND type_desc = 'FILTER_PREDICATE'
    )
    BEGIN
        EXEC('ALTER SECURITY POLICY dbo.tenant_isolation_policy
              ADD FILTER PREDICATE dbo.fn_tenant_rls_predicate(tenant_id) ON abc.costing_projects;');
    END;

    IF NOT EXISTS (
        SELECT 1 FROM sys.security_predicates
        WHERE security_policy_id = OBJECT_ID(N'dbo.tenant_isolation_policy')
          AND target_object_id = OBJECT_ID(N'abc.costing_projects')
          AND type_desc = 'BLOCK_PREDICATE'
          AND operation_desc = 'AFTER INSERT'
    )
    BEGIN
        EXEC('ALTER SECURITY POLICY dbo.tenant_isolation_policy
              ADD BLOCK PREDICATE dbo.fn_tenant_rls_predicate(tenant_id) ON abc.costing_projects AFTER INSERT;');
    END;

    IF NOT EXISTS (
        SELECT 1 FROM sys.security_predicates
        WHERE security_policy_id = OBJECT_ID(N'dbo.tenant_isolation_policy')
          AND target_object_id = OBJECT_ID(N'abc.costing_projects')
          AND type_desc = 'BLOCK_PREDICATE'
          AND operation_desc = 'AFTER UPDATE'
    )
    BEGIN
        EXEC('ALTER SECURITY POLICY dbo.tenant_isolation_policy
              ADD BLOCK PREDICATE dbo.fn_tenant_rls_predicate(tenant_id) ON abc.costing_projects AFTER UPDATE;');
    END;

    IF NOT EXISTS (
        SELECT 1 FROM sys.security_predicates
        WHERE security_policy_id = OBJECT_ID(N'dbo.tenant_isolation_policy')
          AND target_object_id = OBJECT_ID(N'abc.costing_project_items')
          AND type_desc = 'FILTER_PREDICATE'
    )
    BEGIN
        EXEC('ALTER SECURITY POLICY dbo.tenant_isolation_policy
              ADD FILTER PREDICATE dbo.fn_tenant_rls_predicate(tenant_id) ON abc.costing_project_items;');
    END;

    IF NOT EXISTS (
        SELECT 1 FROM sys.security_predicates
        WHERE security_policy_id = OBJECT_ID(N'dbo.tenant_isolation_policy')
          AND target_object_id = OBJECT_ID(N'abc.costing_project_items')
          AND type_desc = 'BLOCK_PREDICATE'
          AND operation_desc = 'AFTER INSERT'
    )
    BEGIN
        EXEC('ALTER SECURITY POLICY dbo.tenant_isolation_policy
              ADD BLOCK PREDICATE dbo.fn_tenant_rls_predicate(tenant_id) ON abc.costing_project_items AFTER INSERT;');
    END;

    IF NOT EXISTS (
        SELECT 1 FROM sys.security_predicates
        WHERE security_policy_id = OBJECT_ID(N'dbo.tenant_isolation_policy')
          AND target_object_id = OBJECT_ID(N'abc.costing_project_items')
          AND type_desc = 'BLOCK_PREDICATE'
          AND operation_desc = 'AFTER UPDATE'
    )
    BEGIN
        EXEC('ALTER SECURITY POLICY dbo.tenant_isolation_policy
              ADD BLOCK PREDICATE dbo.fn_tenant_rls_predicate(tenant_id) ON abc.costing_project_items AFTER UPDATE;');
    END;
END;
GO

IF OBJECT_ID(N'dbo.tenant_isolation_policy', N'SP') IS NOT NULL
BEGIN
    EXEC('ALTER SECURITY POLICY dbo.tenant_isolation_policy WITH (STATE = ON);');
END;
GO

IF NOT EXISTS (SELECT 1 FROM applications WHERE name = 'ABC Costing Pro')
BEGIN
    INSERT INTO applications (
        id,
        name,
        description,
        category,
        type,
        url,
        download_url,
        file_name,
        file_size,
        subscription_tiers,
        is_active,
        created_at,
        updated_at,
        subdomain,
        app_url,
        icon_url,
        screenshots,
        developer,
        version,
        status
    )
    VALUES (
        NEWID(),
        N'ABC Costing Pro',
        N'Activity-based costing workflows that reuse Biz Manager tenant identity and enforced SQL row-level security.',
        N'Financial Tools',
        N'application',
        N'https://abc-costing.business-suite.com',
        NULL,
        NULL,
        NULL,
        N'["diy_accountant"]',
        1,
        SYSUTCDATETIME(),
        SYSUTCDATETIME(),
        N'abc-costing',
        N'https://abc-costing.business-suite.com',
        NULL,
        N'[]',
        N'Biz Manager Applications',
        N'1.0.0',
        N'active'
    );
END;
GO

IF OBJECT_ID(N'dbo.sso_applications', N'U') IS NOT NULL
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sso_applications WHERE domain = 'abc-costing.business-suite.com')
    BEGIN
        INSERT INTO sso_applications (id, name, domain, sso_enabled, metadata, created_at, updated_at)
        VALUES (
            NEWID(),
            N'ABC Costing Pro',
            N'abc-costing.business-suite.com',
            1,
            N'{"subscriptionTier":"diy_accountant"}',
            SYSUTCDATETIME(),
            SYSUTCDATETIME()
        );
    END;
END;
GO
