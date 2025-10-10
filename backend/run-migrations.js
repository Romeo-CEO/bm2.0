const mssql = require('mssql');
const fs = require('fs');
const path = require('path');

const config = {
  server: 'business-manager.database.windows.net',
  port: 1433,
  user: 'manager',
  password: 'bizmanag3r$',
  database: 'business-manager',
  options: {
    encrypt: true,
    trustServerCertificate: false,
    enableArithAbort: true,
  },
  connectionTimeout: 30000,
  requestTimeout: 60000
};

async function runMigrations() {
  let pool;
  try {
    console.log('🔌 Connecting to Azure SQL Database...');
    pool = await new mssql.ConnectionPool(config).connect();
    console.log('✅ Connected successfully');

    const migrations = [
      '001_create_tables_mssql.sql',
      '002_update_applications_table_mssql.sql',
      '003_create_platform_settings_mssql.sql',
      '005_create_sso_tables_mssql.sql'
    ];

    for (const migration of migrations) {
      const migrationPath = path.join(__dirname, 'migrations', migration);
      console.log(`\n📄 Running migration: ${migration}`);

      try {
        const sql = fs.readFileSync(migrationPath, 'utf8');

        // Split by transaction blocks and execute separately for better error handling
        const statements = sql.split(/BEGIN TRANSACTION|COMMIT TRANSACTION/);

        for (let i = 0; i < statements.length; i++) {
          const statement = statements[i].trim();
          if (statement && !statement.startsWith('--')) {
            await pool.request().query(statement);
          }
        }

        console.log(`✅ Migration completed: ${migration}`);
      } catch (error) {
        console.error(`❌ Migration failed: ${migration}`);
        console.error('Error:', error.message);
        if (error.message.includes('already exists')) {
          console.log('⚠️  Table already exists, continuing...');
        } else {
          throw error;
        }
      }
    }

    console.log('\n🎉 All migrations completed successfully!');
  } catch (error) {
    console.error('❌ Migration process failed:', error.message);
    process.exit(1);
  } finally {
    if (pool) {
      await pool.close();
      console.log('🔚 Database connection closed');
    }
  }
}

runMigrations();