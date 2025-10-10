#!/usr/bin/env node

/**
 * Universal Migration Runner Script
 * Runs migrations for the configured database type (MySQL, PostgreSQL, or MSSQL)
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Import the database connection utility
const { getDatabaseConnection, DB_TYPE, DatabaseType } = require('../dist/config/database');

async function runMigrations() {
  let connection;

  try {
    console.log(`🔄 Starting ${DB_TYPE.toUpperCase()} migrations...`);

    connection = await getDatabaseConnection();
    console.log(`✅ Connected to ${DB_TYPE.toUpperCase()}`);

    // Create migrations table if it doesn't exist (database-specific syntax)
    let createMigrationsTableSQL;
    if (DB_TYPE === DatabaseType.POSTGRESQL) {
      createMigrationsTableSQL = `
        CREATE TABLE IF NOT EXISTS migrations (
          id SERIAL PRIMARY KEY,
          filename VARCHAR(255) UNIQUE NOT NULL,
          executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
      `;
    } else if (DB_TYPE === DatabaseType.MSSQL) {
      createMigrationsTableSQL = `
        IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='migrations' AND xtype='U')
        CREATE TABLE migrations (
          id INT IDENTITY(1,1) PRIMARY KEY,
          filename NVARCHAR(255) UNIQUE NOT NULL,
          executed_at DATETIMEOFFSET DEFAULT GETUTCDATE()
        )
      `;
    } else {
      // MySQL
      createMigrationsTableSQL = `
        CREATE TABLE IF NOT EXISTS migrations (
          id INT AUTO_INCREMENT PRIMARY KEY,
          filename VARCHAR(255) UNIQUE NOT NULL,
          executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;
    }

    await connection.query(createMigrationsTableSQL);

    // Get list of migration files based on database type
    const migrationsDir = path.join(__dirname, '..', 'migrations');
    let migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => {
        if (DB_TYPE === DatabaseType.MSSQL) {
          return file.endsWith('_mssql.sql');
        } else if (DB_TYPE === DatabaseType.POSTGRESQL) {
          return file.endsWith('.sql') && !file.includes('_mssql') && !file.includes('_mysql');
        } else {
          return file.endsWith('_mysql.sql') || (file.endsWith('.sql') && !file.includes('_mssql') && !file.includes('_postgres'));
        }
      })
      .sort();

    console.log(`📁 Found ${migrationFiles.length} migration files for ${DB_TYPE}`);

    // Run each migration
    for (const filename of migrationFiles) {
      // Check if migration already ran
      const result = await connection.query(
        'SELECT id FROM migrations WHERE filename = ?',
        [filename]
      );

      if (result.rows && result.rows.length > 0) {
        console.log(`⏭️  Skipping ${filename} (already executed)`);
        continue;
      }

      console.log(`🔄 Running migration: ${filename}`);

      const migrationPath = path.join(migrationsDir, filename);
      const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

      // Execute migration
      await connection.query(migrationSQL);

      // Record migration as executed
      await connection.query(
        'INSERT INTO migrations (filename) VALUES (?)',
        [filename]
      );

      console.log(`✅ Completed migration: ${filename}`);
    }

    console.log('🎉 All migrations completed successfully!');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    if (connection && connection.release) {
      connection.release();
    }
  }
}

// Run migrations if called directly
if (require.main === module) {
  runMigrations();
}

module.exports = { runMigrations };