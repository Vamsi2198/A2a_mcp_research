const postgresConnection = require('./db/index');

// Initialize database connection
let dbInitialized = false;

async function initializeDatabase() {
  if (!dbInitialized) {
    try {
      await postgresConnection.connect();
      dbInitialized = true;
      console.log('✅ PostgreSQL database connection initialized');
    } catch (error) {
      console.error('❌ Failed to initialize PostgreSQL connection:', error.message);
      throw error;
    }
  }
}

// Execute a SQL query and return results
async function executeQuery(query, params = []) {
  try {
    await initializeDatabase();
    
    // Handle both string and object input formats
    let queryText, queryParams;
    
    if (typeof query === 'string') {
      queryText = query;
      queryParams = params;
    } else if (typeof query === 'object' && query.query) {
      queryText = query.query;
      queryParams = query.values || query.params || params;
    } else {
      throw new Error('Invalid query format. Expected string or object with query property.');
    }
    
    console.log('🔍 Executing query:', queryText);
    console.log('📋 Parameters:', queryParams);
    
    const result = await postgresConnection.query(queryText, queryParams);
    
    console.log('✅ Query executed successfully');
    console.log('📊 Rows returned:', result);
    
    return {
      success: true,
      data: result.rows,
      rowCount: result.rowCount,
      fields: result.fields ? result.fields.map(field => ({
        name: field.name,
        dataType: field.dataTypeID
      })) : []
    };
  } catch (error) {
    console.error('❌ Query execution failed:', error.message);
    return {
      success: false,
      error: error.message,
      details: error.detail || null
    };
  }
}

// Get database health status
async function getDatabaseHealth() {
  try {
    await initializeDatabase();
    const health = await postgresConnection.healthCheck();
    return {
      success: true,
      status: health.status,
      message: health.message,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

// Get table information
async function getTableInfo(tableName) {
  try {
    await initializeDatabase();
    
    const query = `
      SELECT 
        column_name,
        data_type,
        is_nullable,
        column_default,
        character_maximum_length
      FROM information_schema.columns 
      WHERE table_name = $1 
      ORDER BY ordinal_position
    `;
    
    const result = await postgresConnection.query(query, [tableName]);
    
    return {
      success: true,
      tableName: tableName,
      columns: result.rows,
      columnCount: result.rowCount
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      tableName: tableName
    };
  }
}

// Get list of all tables
async function getAllTables() {
  try {
    await initializeDatabase();
    
    const query = `
      SELECT 
        table_name,
        table_type
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;
    
    const result = await postgresConnection.query(query);
    
    return {
      success: true,
      tables: result.rows,
      tableCount: result.rowCount
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

// Execute a SELECT query with pagination
async function executeSelectQuery(query, params = [], limit = 100, offset = 0) {
  try {
    await initializeDatabase();
    
    // Handle both string and object input formats
    let queryText, queryParams;
    
    if (typeof query === 'string') {
      queryText = query;
      queryParams = params;
    } else if (typeof query === 'object' && query.query) {
      queryText = query.query;
      queryParams = query.values || query.params || params;
    } else {
      throw new Error('Invalid query format. Expected string or object with query property.');
    }
    
    // Add LIMIT and OFFSET if not already present
    let finalQuery = queryText;
    if (!queryText.toLowerCase().includes('limit')) {
      finalQuery += ` LIMIT ${limit}`;
    }
    if (!queryText.toLowerCase().includes('offset')) {
      finalQuery += ` OFFSET ${offset}`;
    }
    
    console.log('🔍 Executing SELECT query:', finalQuery);
    console.log('📋 Parameters:', queryParams);
    
    const result = await postgresConnection.query(finalQuery, queryParams);
    
    return {
      success: true,
      data: result.rows,
      rowCount: result.rowCount,
      limit: limit,
      offset: offset,
      fields: result.fields ? result.fields.map(field => ({
        name: field.name,
        dataType: field.dataTypeID
      })) : []
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      query: query
    };
  }
}

// Execute an INSERT query
async function executeInsertQuery(tableName, data) {
  try {
    await initializeDatabase();
    
    const columns = Object.keys(data);
    const values = Object.values(data);
    const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ');
    
    const query = `
      INSERT INTO ${tableName} (${columns.join(', ')})
      VALUES (${placeholders})
      RETURNING *
    `;
    
    console.log('🔍 Executing INSERT query:', query);
    console.log('📋 Data:', data);
    
    const result = await postgresConnection.query(query, values);
    
    return {
      success: true,
      insertedRow: result.rows[0],
      rowCount: result.rowCount
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      tableName: tableName,
      data: data
    };
  }
}

// Execute an UPDATE query
async function executeUpdateQuery(tableName, data, whereCondition, whereParams = []) {
  try {
    await initializeDatabase();
    
    const setColumns = Object.keys(data).map((key, index) => `${key} = $${index + 1}`);
    const setValues = Object.values(data);
    
    // Adjust parameter placeholders for WHERE clause
    const wherePlaceholders = whereParams.map((_, index) => `$${setValues.length + index + 1}`);
    const allParams = [...setValues, ...whereParams];
    
    const query = `
      UPDATE ${tableName}
      SET ${setColumns.join(', ')}
      WHERE ${whereCondition.replace(/\?/g, (_, index) => wherePlaceholders[index])}
      RETURNING *
    `;
    
    console.log('🔍 Executing UPDATE query:', query);
    console.log('📋 Data:', data);
    console.log('📋 Where params:', whereParams);
    
    const result = await postgresConnection.query(query, allParams);
    
    return {
      success: true,
      updatedRows: result.rows,
      rowCount: result.rowCount
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      tableName: tableName,
      data: data
    };
  }
}

// Execute a DELETE query
async function executeDeleteQuery(tableName, whereCondition, whereParams = []) {
  try {
    await initializeDatabase();
    
    const query = `
      DELETE FROM ${tableName}
      WHERE ${whereCondition}
      RETURNING *
    `;
    
    console.log('🔍 Executing DELETE query:', query);
    console.log('📋 Where params:', whereParams);
    
    const result = await postgresConnection.query(query, whereParams);
    
    return {
      success: true,
      deletedRows: result.rows,
      rowCount: result.rowCount
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      tableName: tableName
    };
  }
}

// Get database statistics
async function getDatabaseStats() {
  try {
    await initializeDatabase();
    
    const queries = [
      { name: 'totalTables', query: "SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = 'public'" },
      { name: 'totalRows', query: "SELECT SUM(reltuples) as count FROM pg_class WHERE relkind = 'r'" },
      { name: 'databaseSize', query: "SELECT pg_size_pretty(pg_database_size(current_database())) as size" },
      { name: 'activeConnections', query: "SELECT COUNT(*) as count FROM pg_stat_activity WHERE state = 'active'" }
    ];
    
    const stats = {};
    
    for (const { name, query } of queries) {
      try {
        const result = await postgresConnection.query(query);
        stats[name] = result.rows[0];
      } catch (error) {
        stats[name] = { error: error.message };
      }
    }
    
    return {
      success: true,
      stats: stats,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = {
  executeQuery,
  getDatabaseHealth,
  getTableInfo,
  getAllTables,
  executeSelectQuery,
  executeInsertQuery,
  executeUpdateQuery,
  executeDeleteQuery,
  getDatabaseStats,
  initializeDatabase
};
