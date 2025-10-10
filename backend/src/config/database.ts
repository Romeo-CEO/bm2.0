import { Pool, PoolConfig } from 'pg';
import mysql, { Pool as MySQLPool, PoolOptions } from 'mysql2/promise';
import * as mssql from 'mssql';
import dotenv from 'dotenv';

dotenv.config();

// Database type enum
export enum DatabaseType {
  MYSQL = 'mysql',
  POSTGRESQL = 'postgresql',
  MSSQL = 'mssql'
}

// Get database type from environment (robust to casing/whitespace)
export const DB_TYPE = ((process.env.DB_TYPE ?? 'mysql').trim().toLowerCase()) as DatabaseType;

// PostgreSQL configuration
const pgConfig: PoolConfig = {
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_DB || 'business_manager',
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'password',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 30000,
};

// MySQL configuration
const mysqlConfig: PoolOptions = {
  host: process.env.MYSQL_HOST || 'localhost',
  port: parseInt(process.env.MYSQL_PORT || '3306'),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DB || 'saas_platform',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

// SQL Server configuration
const mssqlConfig: mssql.config = {
  server: process.env.MSSQL_HOST || 'localhost',
  port: parseInt(process.env.MSSQL_PORT || '1433'),
  user: process.env.MSSQL_USER || 'sa',
  password: process.env.MSSQL_PASSWORD || '',
  database: process.env.MSSQL_DB || 'business_manager',
  options: {
    encrypt: process.env.MSSQL_ENCRYPT === 'true',
    trustServerCertificate: process.env.MSSQL_TRUST_CERT === 'true',
    enableArithAbort: true,
    requestTimeout: 60000
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 60000
  },
  connectionTimeout: 60000,
  requestTimeout: 60000
};

// Create database pools
export const pgPool = new Pool(pgConfig);
export const mysqlPool = mysql.createPool(mysqlConfig);
export let mssqlPool: mssql.ConnectionPool;

// Database abstraction interface
export interface DatabaseConnection {
  query: (sql: string, params?: any[]) => Promise<any>;
  release?: () => void;
}

// Get the appropriate database connection
export const getDatabaseConnection = async (): Promise<DatabaseConnection> => {
  if (DB_TYPE === DatabaseType.POSTGRESQL) {
    const client = await pgPool.connect();
    // Replace MySQL-style placeholders (?) with PostgreSQL-style ($1, $2, ...)
    const toPostgresQuery = (sql: string, params?: any[]) => {
      if (!params || params.length === 0) return { text: sql, values: params };
      // Normalize common MySQL boolean patterns to PostgreSQL
      let normalized = sql
        .replace(/is_active\s*=\s*1/gi, 'is_active = TRUE')
        .replace(/is_active\s*=\s*0/gi, 'is_active = FALSE');
      // Convert positional placeholders
      let index = 0;
      const text = normalized.replace(/\?/g, () => `$${++index}`);
      return { text, values: params };
    };
    return {
      query: async (sql: string, params?: any[]) => {
        const { text, values } = toPostgresQuery(sql, params);
        const result = await client.query(text, values);
        return { rows: result.rows, rowCount: result.rowCount };
      },
      release: () => client.release()
    };
  } else if (DB_TYPE === DatabaseType.MSSQL) {
    // Initialize pool if not already done
    if (!mssqlPool || !mssqlPool.connected) {
      mssqlPool = await new mssql.ConnectionPool(mssqlConfig).connect();
    }

    const toMssqlQuery = (sql: string, params?: any[]) => {
    let processedSql = sql;
    let processedParams = params || [];

    // Normalize common functions and syntax to SQL Server
    processedSql = processedSql
      // NOW() (MySQL/Postgres) -> GETDATE() (SQL Server)
      .replace(/\bNOW\(\)/gi, 'GETDATE()')
    // CURRENT_TIMESTAMP works on SQL Server but unify anyway
    .replace(/\bCURRENT_TIMESTAMP\b/gi, 'GETDATE()');

        // Convert LIMIT/OFFSET to SQL Server syntax
    // Pattern: LIMIT ? OFFSET ? (MySQL/PostgreSQL) -> ORDER BY ... OFFSET ? ROWS FETCH NEXT ? ROWS ONLY (SQL Server)
    const limitOffsetRegex = /\s+LIMIT\s+\?\s+OFFSET\s+\?$/i;
    if (limitOffsetRegex.test(processedSql)) {
          // Extract the limit and offset parameter values
    const limitValue = processedParams[processedParams.length - 2];
    const offsetValue = processedParams[processedParams.length - 1];

          // Remove LIMIT ? OFFSET ? and the corresponding parameters
      processedSql = processedSql.replace(limitOffsetRegex, '');
      processedParams = processedParams.slice(0, -2);

      // Add SQL Server pagination syntax
    processedSql += ` OFFSET ${offsetValue} ROWS FETCH NEXT ${limitValue} ROWS ONLY`;
    }

        // Handle standalone LIMIT without OFFSET
    const limitOnlyRegex = /\s+LIMIT\s+(\d+)$/i;
    const limitMatch = processedSql.match(limitOnlyRegex);
    if (limitMatch) {
          const limitValue = limitMatch[1];
      processedSql = processedSql.replace(limitOnlyRegex, ` OFFSET 0 ROWS FETCH NEXT ${limitValue} ROWS ONLY`);
      }

        // Convert MySQL-style placeholders (?) to SQL Server style (@param0, @param1, ...)
        let index = 0;
        processedSql = processedSql.replace(/\?/g, () => `@param${index++}`);

        return { sql: processedSql, params: processedParams };
      };

    return {
      query: async (sql: string, params?: any[]) => {
        const { sql: processedSql, params: processedParams } = toMssqlQuery(sql, params);
        const request = mssqlPool.request();

        // Add parameters to the request
        if (processedParams) {
          processedParams.forEach((param, index) => {
            request.input(`param${index}`, param);
          });
        }

        const result = await request.query(processedSql);
        return { rows: result.recordset, rowCount: result.rowsAffected[0] || 0 };
      },
      release: () => {} // Connection pool handles this
    };
  } else {
    const connection = await mysqlPool.getConnection();
    return {
      query: async (sql: string, params?: any[]) => {
        const [rows] = await connection.execute(sql, params);
        return { rows, rowCount: Array.isArray(rows) ? rows.length : 0 };
      },
      release: () => connection.release()
    };
  }
};

// Legacy export for backward compatibility
export const getConnection = getDatabaseConnection;

// Test database connection
export const testConnection = async (): Promise<boolean> => {
  try {
    if (DB_TYPE === DatabaseType.POSTGRESQL) {
      const client = await pgPool.connect();
      const result = await client.query('SELECT NOW()');
      client.release();
      console.log('✅ PostgreSQL connection successful:', result.rows[0]);
      return true;
    } else if (DB_TYPE === DatabaseType.MSSQL) {
      if (!mssqlPool || !mssqlPool.connected) {
        mssqlPool = await new mssql.ConnectionPool(mssqlConfig).connect();
      }
      const result = await mssqlPool.request().query('SELECT GETDATE() as now');
      console.log('✅ SQL Server connection successful:', result.recordset[0]);
      return true;
    } else {
      const connection = await mysqlPool.getConnection();
      const [rows] = await connection.execute('SELECT NOW() as now');
      connection.release();
      console.log('✅ MySQL connection successful:', rows);
      return true;
    }
  } catch (error) {
    console.error(`❌ ${DB_TYPE.toUpperCase()} connection failed:`, error);
    return false;
  }
};

// Graceful shutdown
let poolsClosed = false;
export const closeDatabasePools = async (): Promise<void> => {
  if (poolsClosed) {
    return;
  }
  try {
    if (DB_TYPE === DatabaseType.POSTGRESQL) {
      await pgPool.end();
      console.log('✅ PostgreSQL pool closed');
    } else if (DB_TYPE === DatabaseType.MSSQL) {
      if (mssqlPool && mssqlPool.connected) {
        await mssqlPool.close();
        console.log('✅ SQL Server pool closed');
      }
    } else {
      await mysqlPool.end();
      console.log('✅ MySQL pool closed');
    }
  } catch (error) {
    // Swallow double-close errors gracefully
    // console.error('❌ Error closing database pools:', error);
  } finally {
    poolsClosed = true;
  }
};

// Handle process termination (register once)
if (!(process as any).__dbPoolHandlersRegistered) {
  process.on('SIGINT', closeDatabasePools);
  process.on('SIGTERM', closeDatabasePools);
  (process as any).__dbPoolHandlersRegistered = true;
}