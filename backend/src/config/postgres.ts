import { Pool, PoolConfig } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// PostgreSQL configuration
const pgConfig: PoolConfig = {
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_DB || 'business_manager',
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'password',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 30000, // Return an error after 2 seconds if connection could not be established
};

// Create PostgreSQL connection pool
export const pgPool = new Pool(pgConfig);

// Test PostgreSQL connection
export const testPostgresConnection = async (): Promise<boolean> => {
  try {
    const client = await pgPool.connect();
    const result = await client.query('SELECT NOW()');
    client.release();
    console.log('✅ PostgreSQL connection successful:', result.rows[0]);
    return true;
  } catch (error) {
    console.error('❌ PostgreSQL connection failed:', error);
    return false;
  }
};

// Graceful shutdown
export const closePostgresPool = async (): Promise<void> => {
  try {
    await pgPool.end();
    console.log('✅ PostgreSQL pool closed');
  } catch (error) {
    console.error('❌ Error closing PostgreSQL pool:', error);
  }
};

// Handle process termination
process.on('SIGINT', closePostgresPool);
process.on('SIGTERM', closePostgresPool);
