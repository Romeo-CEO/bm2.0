import { DatabaseType, DB_TYPE, getConnection } from '../config/database';

interface TableDefinition {
  name: string;
  createSql: Partial<Record<DatabaseType, string>>;
}

const TABLE_DEFINITIONS: TableDefinition[] = [
  {
    name: 'template_categories',
    createSql: {
      [DatabaseType.MYSQL]: `
        CREATE TABLE IF NOT EXISTS template_categories (
          id VARCHAR(64) PRIMARY KEY,
          name VARCHAR(255) NOT NULL UNIQUE,
          slug VARCHAR(255) NOT NULL UNIQUE,
          description TEXT NULL,
          is_active TINYINT(1) NOT NULL DEFAULT 1,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `,
      [DatabaseType.POSTGRESQL]: `
        CREATE TABLE IF NOT EXISTS template_categories (
          id VARCHAR(64) PRIMARY KEY,
          name VARCHAR(255) NOT NULL UNIQUE,
          slug VARCHAR(255) NOT NULL UNIQUE,
          description TEXT NULL,
          is_active BOOLEAN NOT NULL DEFAULT TRUE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `,
      [DatabaseType.MSSQL]: `
        IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'template_categories') AND type = 'U')
        BEGIN
          CREATE TABLE template_categories (
            id NVARCHAR(64) NOT NULL PRIMARY KEY,
            name NVARCHAR(255) NOT NULL UNIQUE,
            slug NVARCHAR(255) NOT NULL UNIQUE,
            description NVARCHAR(MAX) NULL,
            is_active BIT NOT NULL DEFAULT 1,
            created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
            updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
          );
        END
      `,
    },
  },
  {
    name: 'template_types',
    createSql: {
      [DatabaseType.MYSQL]: `
        CREATE TABLE IF NOT EXISTS template_types (
          id VARCHAR(64) PRIMARY KEY,
          category_id VARCHAR(64) NOT NULL,
          name VARCHAR(255) NOT NULL,
          slug VARCHAR(255) NOT NULL,
          description TEXT NULL,
          is_active TINYINT(1) NOT NULL DEFAULT 1,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY uniq_template_types_slug (category_id, slug),
          CONSTRAINT fk_template_types_category FOREIGN KEY (category_id) REFERENCES template_categories(id)
        )
      `,
      [DatabaseType.POSTGRESQL]: `
        CREATE TABLE IF NOT EXISTS template_types (
          id VARCHAR(64) PRIMARY KEY,
          category_id VARCHAR(64) NOT NULL REFERENCES template_categories(id) ON DELETE CASCADE,
          name VARCHAR(255) NOT NULL,
          slug VARCHAR(255) NOT NULL,
          description TEXT NULL,
          is_active BOOLEAN NOT NULL DEFAULT TRUE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          CONSTRAINT uniq_template_types_slug UNIQUE (category_id, slug)
        )
      `,
      [DatabaseType.MSSQL]: `
        IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'template_types') AND type = 'U')
        BEGIN
          CREATE TABLE template_types (
            id NVARCHAR(64) NOT NULL PRIMARY KEY,
            category_id NVARCHAR(64) NOT NULL,
            name NVARCHAR(255) NOT NULL,
            slug NVARCHAR(255) NOT NULL,
            description NVARCHAR(MAX) NULL,
            is_active BIT NOT NULL DEFAULT 1,
            created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
            updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
            CONSTRAINT uniq_template_types_slug UNIQUE (category_id, slug),
            CONSTRAINT fk_template_types_category FOREIGN KEY (category_id) REFERENCES template_categories(id) ON DELETE CASCADE
          );
        END
      `,
    },
  },
  {
    name: 'template_category_assignments',
    createSql: {
      [DatabaseType.MYSQL]: `
        CREATE TABLE IF NOT EXISTS template_category_assignments (
          template_id VARCHAR(64) PRIMARY KEY,
          category_id VARCHAR(64) NOT NULL,
          type_id VARCHAR(64) NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          CONSTRAINT fk_template_assignment_category FOREIGN KEY (category_id) REFERENCES template_categories(id),
          CONSTRAINT fk_template_assignment_type FOREIGN KEY (type_id) REFERENCES template_types(id)
        )
      `,
      [DatabaseType.POSTGRESQL]: `
        CREATE TABLE IF NOT EXISTS template_category_assignments (
          template_id VARCHAR(64) PRIMARY KEY,
          category_id VARCHAR(64) NOT NULL REFERENCES template_categories(id) ON DELETE RESTRICT,
          type_id VARCHAR(64) NULL REFERENCES template_types(id) ON DELETE SET NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `,
      [DatabaseType.MSSQL]: `
        IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'template_category_assignments') AND type = 'U')
        BEGIN
          CREATE TABLE template_category_assignments (
            template_id NVARCHAR(64) NOT NULL PRIMARY KEY,
            category_id NVARCHAR(64) NOT NULL,
            type_id NVARCHAR(64) NULL,
            created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
            updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
            CONSTRAINT fk_template_assignment_category FOREIGN KEY (category_id) REFERENCES template_categories(id) ON DELETE NO ACTION,
            CONSTRAINT fk_template_assignment_type FOREIGN KEY (type_id) REFERENCES template_types(id) ON DELETE SET NULL
          );
        END
      `,
    },
  },
  {
    name: 'notifications',
    createSql: {
      [DatabaseType.MYSQL]: `
        CREATE TABLE IF NOT EXISTS notifications (
          id VARCHAR(64) PRIMARY KEY,
          title VARCHAR(255) NOT NULL,
          body TEXT NOT NULL,
          audience VARCHAR(64) NOT NULL,
          audience_filter JSON NULL,
          channels JSON NOT NULL,
          created_by VARCHAR(64) NULL,
          expires_at DATETIME NULL,
          dispatched_at DATETIME NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `,
      [DatabaseType.POSTGRESQL]: `
        CREATE TABLE IF NOT EXISTS notifications (
          id VARCHAR(64) PRIMARY KEY,
          title VARCHAR(255) NOT NULL,
          body TEXT NOT NULL,
          audience VARCHAR(64) NOT NULL,
          audience_filter JSONB NULL,
          channels JSONB NOT NULL,
          created_by VARCHAR(64) NULL,
          expires_at TIMESTAMPTZ NULL,
          dispatched_at TIMESTAMPTZ NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `,
      [DatabaseType.MSSQL]: `
        IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'notifications') AND type = 'U')
        BEGIN
          CREATE TABLE notifications (
            id NVARCHAR(64) NOT NULL PRIMARY KEY,
            title NVARCHAR(255) NOT NULL,
            body NVARCHAR(MAX) NOT NULL,
            audience NVARCHAR(64) NOT NULL,
            audience_filter NVARCHAR(MAX) NULL,
            channels NVARCHAR(MAX) NOT NULL,
            created_by NVARCHAR(64) NULL,
            expires_at DATETIME2 NULL,
            dispatched_at DATETIME2 NULL,
            created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
          );
        END
      `,
    },
  },
  {
    name: 'notification_preferences',
    createSql: {
      [DatabaseType.MYSQL]: `
        CREATE TABLE IF NOT EXISTS notification_preferences (
          id VARCHAR(64) PRIMARY KEY,
          user_id VARCHAR(64) NOT NULL,
          channel VARCHAR(32) NOT NULL,
          is_enabled TINYINT(1) NOT NULL DEFAULT 1,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY uniq_user_channel (user_id, channel)
        )
      `,
      [DatabaseType.POSTGRESQL]: `
        CREATE TABLE IF NOT EXISTS notification_preferences (
          id VARCHAR(64) PRIMARY KEY,
          user_id VARCHAR(64) NOT NULL,
          channel VARCHAR(32) NOT NULL,
          is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          CONSTRAINT uniq_user_channel UNIQUE (user_id, channel)
        )
      `,
      [DatabaseType.MSSQL]: `
        IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'notification_preferences') AND type = 'U')
        BEGIN
          CREATE TABLE notification_preferences (
            id NVARCHAR(64) NOT NULL PRIMARY KEY,
            user_id NVARCHAR(64) NOT NULL,
            channel NVARCHAR(32) NOT NULL,
            is_enabled BIT NOT NULL DEFAULT 1,
            updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
            CONSTRAINT uniq_user_channel UNIQUE (user_id, channel)
          );
        END
      `,
    },
  },
  {
    name: 'usage_metrics',
    createSql: {
      [DatabaseType.MYSQL]: `
        CREATE TABLE IF NOT EXISTS usage_metrics (
          id VARCHAR(64) PRIMARY KEY,
          event_type VARCHAR(64) NOT NULL,
          user_id VARCHAR(64) NULL,
          company_id VARCHAR(64) NULL,
          subject_id VARCHAR(64) NULL,
          subject_type VARCHAR(32) NULL,
          user_role VARCHAR(64) NULL,
          subscription_tier VARCHAR(64) NULL,
          payload JSON NULL,
          occurred_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `,
      [DatabaseType.POSTGRESQL]: `
        CREATE TABLE IF NOT EXISTS usage_metrics (
          id VARCHAR(64) PRIMARY KEY,
          event_type VARCHAR(64) NOT NULL,
          user_id VARCHAR(64) NULL,
          company_id VARCHAR(64) NULL,
          subject_id VARCHAR(64) NULL,
          subject_type VARCHAR(32) NULL,
          user_role VARCHAR(64) NULL,
          subscription_tier VARCHAR(64) NULL,
          payload JSONB NULL,
          occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `,
      [DatabaseType.MSSQL]: `
        IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'usage_metrics') AND type = 'U')
        BEGIN
          CREATE TABLE usage_metrics (
            id NVARCHAR(64) NOT NULL PRIMARY KEY,
            event_type NVARCHAR(64) NOT NULL,
            user_id NVARCHAR(64) NULL,
            company_id NVARCHAR(64) NULL,
            subject_id NVARCHAR(64) NULL,
            subject_type NVARCHAR(32) NULL,
            user_role NVARCHAR(64) NULL,
            subscription_tier NVARCHAR(64) NULL,
            payload NVARCHAR(MAX) NULL,
            occurred_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
          );
        END
      `,
    },
  },
];

export const DEFAULT_CATEGORY_ID = 'default-template-category';
const DEFAULT_CATEGORY = {
  id: DEFAULT_CATEGORY_ID,
  name: 'General',
  slug: 'general',
  description: 'Default category for templates that have not been organised yet.',
};

export const ensureCoreSchema = async (): Promise<void> => {
  const connection = await getConnection();

  try {
    for (const definition of TABLE_DEFINITIONS) {
      const sql = definition.createSql[DB_TYPE];
      if (!sql) {
        console.warn(`No schema creation SQL registered for table ${definition.name} and DB type ${DB_TYPE}`);
        continue;
      }
      await connection.query(sql);
    }

    // Ensure we have at least one default category for backward compatibility
    let existingDefault;
    if (DB_TYPE === DatabaseType.MSSQL) {
      existingDefault = await connection.query(
        'SELECT TOP 1 id FROM template_categories WHERE slug = ? OR name = ?',
        [DEFAULT_CATEGORY.slug, DEFAULT_CATEGORY.name]
      );
    } else {
      existingDefault = await connection.query(
        'SELECT id FROM template_categories WHERE slug = ? OR name = ? LIMIT 1',
        [DEFAULT_CATEGORY.slug, DEFAULT_CATEGORY.name]
      );
    }

    const defaultCategoryId = existingDefault.rows?.[0]?.id || DEFAULT_CATEGORY_ID;

    if (!existingDefault.rows || existingDefault.rows.length === 0) {
      await connection.query(
        `INSERT INTO template_categories (id, name, slug, description, is_active) VALUES (?, ?, ?, ?, 1)`
      , [
        DEFAULT_CATEGORY.id,
        DEFAULT_CATEGORY.name,
        DEFAULT_CATEGORY.slug,
        DEFAULT_CATEGORY.description,
      ]);
    }

    // Backfill existing templates that do not have an assignment
    const unassignedTemplates = await connection.query(
      `SELECT t.id
       FROM templates t
       LEFT JOIN template_category_assignments a ON a.template_id = t.id
       WHERE a.template_id IS NULL`
    );

    for (const template of unassignedTemplates.rows || []) {
      await connection.query(
        `INSERT INTO template_category_assignments (template_id, category_id, type_id)
         VALUES (?, ?, NULL)`
      , [template.id, defaultCategoryId]);
    }
  } catch (error) {
    console.error('Failed to ensure core schema', error);
    throw error;
  } finally {
    connection.release?.();
  }
};

