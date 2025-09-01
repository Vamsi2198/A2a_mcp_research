const { Pool } = require('pg');
require('dotenv').config();

// Database configuration from environment variables
const dbConfig = {
  user: process.env.POSTGRES_USER,
  host: process.env.POSTGRES_HOST,
  database: process.env.POSTGRES_1PLATFORM_DB,
  password: process.env.POSTGRES_PASSWORD,
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  ssl: {
    rejectUnauthorized: false, // For self-signed or serverless SSL certs
  },
  // Pool configuration
  max: parseInt(process.env.POSTGRES_POOL_MAX || '20'),         // Maximum pool size
  min: parseInt(process.env.POSTGRES_POOL_MIN || '0'),          // Minimum pool size
  idleTimeoutMillis: parseInt(process.env.POSTGRES_IDLE_TIMEOUT || '30000'),
  connectionTimeoutMillis: parseInt(process.env.POSTGRES_CONNECTION_TIMEOUT || '5000'),

  // Application name for monitoring
  application_name: process.env.APP_NAME || 'nodejs-app'
};

class PostgresConnectionManager {
  constructor() {
    this._pool = null;
    this._initialized = false;
    this._retryCount = 0;
    this._maxRetries = parseInt(process.env.POSTGRES_MAX_RETRIES || '3');
  }

  get pool() {
    if (!this._pool) {
      throw new Error('Database connection not initialized. Call connect() first.');
    }
    return this._pool;
  }

  async connect() {
    if (this._initialized) {
      return this.pool;
    }

    try {
      this._pool = new Pool(dbConfig);

      // Test the connection
      const client = await this._pool.connect();
      const result = await client.query('SELECT version()');
      client.release();

      this._initialized = true;
      this._retryCount = 0;

      console.info('Successfully connected to PostgreSQL database', {
        host: dbConfig.host,
        database: dbConfig.database,
        version: result.rows[0].version
      });

      // Handle pool events
      this._setupPoolEvents();

      return this._pool;
    } catch (error) {
      console.error('Failed to connect to PostgreSQL:', {
        error: error.message,
        retryCount: this._retryCount
      });

      if (this._retryCount < this._maxRetries) {
        this._retryCount++;
        const retryDelay = Math.min(1000 * Math.pow(2, this._retryCount), 10000);

        console.info(`Retrying connection in ${retryDelay}ms`, {
          attempt: this._retryCount,
          maxRetries: this._maxRetries
        });

        await new Promise(resolve => setTimeout(resolve, retryDelay));
        return this.connect();
      }

      throw error;
    }
  }

  _setupPoolEvents() {
    this._pool.on('connect', () => {
      console.debug('New client connected to PostgreSQL');
    });

    this._pool.on('error', (err) => {
      console.error('Unexpected error on idle PostgreSQL client', {
        error: err.message,
        stack: err.stack
      });
    });

    this._pool.on('remove', () => {
      console.debug('Client removed from PostgreSQL pool');
    });
  }

  async disconnect() {
    if (this._pool) {
      await this._pool.end();
      this._pool = null;
      this._initialized = false;
      console.info('Disconnected from PostgreSQL database');
    }
  }

  async query(text, params = []) {
    const queryStart = Date.now();
    const client = await this.pool.connect();

    try {
      const result = await client.query(text, params);

      const duration = Date.now() - queryStart;

      return result;
    } catch (error) {
      console.error('Query error:', {
        text,
        params,
        error: error.message,
        stack: error.stack
      });
      throw error;
    } finally {
      client.release();
    }
  }

  async withTransaction(callback) {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Transaction error:', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    } finally {
      client.release();
    }
  }

  // Health check method
  async healthCheck() {
    try {
      await this.query('SELECT 1');
      return { status: 'healthy', message: 'Database connection is working' };
    } catch (error) {
      return { status: 'unhealthy', message: error.message };
    }
  }
}

// Create singleton instance
const postgresConnection = new PostgresConnectionManager();

module.exports = postgresConnection; 