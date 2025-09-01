// src/orchestrator/postgressTools.js

const postgresTools = [
  {
    tool: "execute_query",
    name: "execute_query",
    description: "Execute any SQL query and return results. Use for complex queries, stored procedures, or custom operations.",
    endpoint: "POST /a2a",
    api_url: "http://localhost:5008/execute",
    parameters: {
      query: "string (required) - SQL query to execute",
      params: "array (optional) - Query parameters for prepared statements"
    },
    schema: {
      type: "object",
      properties: {
        query: { 
          type: "string", 
          description: "SQL query to execute (e.g., 'SELECT * FROM users WHERE id = $1')" 
        },
        params: { 
          type: "array", 
          description: "Query parameters for prepared statements (e.g., [1, 'John'])",
          items: { type: "string" }
        }
      },
      required: ["query"]
    },
    example_request: { 
      query: "SELECT * FROM users WHERE status = $1", 
      params: ["active"] 
    },
    example_response: {
      success: true,
      data: [
        { id: 1, name: "John Doe", email: "john@example.com", status: "active" },
        { id: 2, name: "Jane Smith", email: "jane@example.com", status: "active" }
      ],
      rowCount: 2,
      fields: [
        { name: "id", dataType: 23 },
        { name: "name", dataType: 25 },
        { name: "email", dataType: 25 },
        { name: "status", dataType: 25 }
      ]
    }
  },
  {
    tool: "get_table_info",
    name: "get_table_info",
    description: "Get detailed information about a specific table including column names, data types, and constraints.",
    endpoint: "POST /a2a",
    api_url: "http://localhost:5008/table-info",
    parameters: {
      tableName: "string (required) - Name of the table to get information about"
    },
    schema: {
      type: "object",
      properties: {
        tableName: { 
          type: "string", 
          description: "Name of the table (e.g., 'users', 'orders', 'products')" 
        }
      },
      required: ["tableName"]
    },
    example_request: { tableName: "users" },
    example_response: {
      success: true,
      tableName: "users",
      columns: [
        { column_name: "id", data_type: "integer", is_nullable: "NO", column_default: "nextval('users_id_seq'::regclass)" },
        { column_name: "name", data_type: "character varying", is_nullable: "NO", column_default: null },
        { column_name: "email", data_type: "character varying", is_nullable: "NO", column_default: null },
        { column_name: "created_at", data_type: "timestamp", is_nullable: "NO", column_default: "now()" }
      ],
      columnCount: 4
    }
  },
  {
    tool: "get_all_tables",
    name: "get_all_tables",
    description: "Get a list of all tables in the database with their types and basic information.",
    endpoint: "POST /a2a",
    api_url: "http://localhost:5008/tables",
    parameters: {},
    schema: {
      type: "object",
      properties: {},
      required: []
    },
    example_request: {},
    example_response: {
      success: true,
      tables: [
        { table_name: "users", table_type: "BASE TABLE" },
        { table_name: "orders", table_type: "BASE TABLE" },
        { table_name: "products", table_type: "BASE TABLE" },
        { table_name: "categories", table_type: "BASE TABLE" }
      ],
      tableCount: 4
    }
  },
  {
    tool: "execute_select_query",
    name: "execute_select_query",
    description: "Execute a SELECT query with pagination support. Use for retrieving data with limit and offset.",
    endpoint: "POST /a2a",
    api_url: "http://localhost:5008/select",
    parameters: {
      query: "string (required) - SELECT query to execute",
      params: "array (optional) - Query parameters",
      limit: "number (optional) - Maximum number of rows to return (default: 100)",
      offset: "number (optional) - Number of rows to skip (default: 0)"
    },
    schema: {
      type: "object",
      properties: {
        query: { 
          type: "string", 
          description: "SELECT query (e.g., 'SELECT * FROM users WHERE status = $1')" 
        },
        params: { 
          type: "array", 
          description: "Query parameters",
          items: { type: "string" }
        },
        limit: { 
          type: "number", 
          description: "Maximum number of rows to return (default: 100)",
          default: 100
        },
        offset: { 
          type: "number", 
          description: "Number of rows to skip (default: 0)",
          default: 0
        }
      },
      required: ["query"]
    },
    example_request: { 
      query: "SELECT * FROM users WHERE status = $1", 
      params: ["active"],
      limit: 50,
      offset: 0
    },
    example_response: {
      success: true,
      data: [
        { id: 1, name: "John Doe", email: "john@example.com", status: "active" },
        { id: 2, name: "Jane Smith", email: "jane@example.com", status: "active" }
      ],
      rowCount: 2,
      limit: 50,
      offset: 0
    }
  },
  {
    tool: "execute_insert_query",
    name: "execute_insert_query",
    description: "Insert a new row into a table. Returns the inserted row with generated values.",
    endpoint: "POST /a2a",
    api_url: "http://localhost:5008/insert",
    parameters: {
      tableName: "string (required) - Name of the table to insert into",
      data: "object (required) - Column names and values to insert"
    },
    schema: {
      type: "object",
      properties: {
        tableName: { 
          type: "string", 
          description: "Name of the table (e.g., 'users', 'orders')" 
        },
        data: { 
          type: "object", 
          description: "Column names and values (e.g., {name: 'John', email: 'john@example.com'})" 
        }
      },
      required: ["tableName", "data"]
    },
    example_request: { 
      tableName: "users",
      data: {
        name: "John Doe",
        email: "john@example.com",
        status: "active"
      }
    },
    example_response: {
      success: true,
      insertedRow: {
        id: 3,
        name: "John Doe",
        email: "john@example.com",
        status: "active",
        created_at: "2025-07-15T06:30:00.000Z"
      },
      rowCount: 1
    }
  },
  {
    tool: "execute_update_query",
    name: "execute_update_query",
    description: "Update existing rows in a table based on a WHERE condition. Returns the updated rows.",
    endpoint: "POST /a2a",
    api_url: "http://localhost:5008/update",
    parameters: {
      tableName: "string (required) - Name of the table to update",
      data: "object (required) - Column names and new values",
      whereCondition: "string (required) - WHERE condition (e.g., 'id = $1')",
      whereParams: "array (optional) - Parameters for WHERE condition"
    },
    schema: {
      type: "object",
      properties: {
        tableName: { 
          type: "string", 
          description: "Name of the table (e.g., 'users', 'orders')" 
        },
        data: { 
          type: "object", 
          description: "Column names and new values (e.g., {status: 'inactive'})" 
        },
        whereCondition: { 
          type: "string", 
          description: "WHERE condition with placeholders (e.g., 'id = $1 AND status = $2')" 
        },
        whereParams: { 
          type: "array", 
          description: "Parameters for WHERE condition",
          items: { type: "string" }
        }
      },
      required: ["tableName", "data", "whereCondition"]
    },
    example_request: { 
      tableName: "users",
      data: { status: "inactive" },
      whereCondition: "id = $1",
      whereParams: ["1"]
    },
    example_response: {
      success: true,
      updatedRows: [
        {
          id: 1,
          name: "John Doe",
          email: "john@example.com",
          status: "inactive",
          created_at: "2025-07-15T06:30:00.000Z"
        }
      ],
      rowCount: 1
    }
  },
  {
    tool: "execute_delete_query",
    name: "execute_delete_query",
    description: "Delete rows from a table based on a WHERE condition. Returns the deleted rows.",
    endpoint: "POST /a2a",
    api_url: "http://localhost:5008/delete",
    parameters: {
      tableName: "string (required) - Name of the table to delete from",
      whereCondition: "string (required) - WHERE condition (e.g., 'id = $1')",
      whereParams: "array (optional) - Parameters for WHERE condition"
    },
    schema: {
      type: "object",
      properties: {
        tableName: { 
          type: "string", 
          description: "Name of the table (e.g., 'users', 'orders')" 
        },
        whereCondition: { 
          type: "string", 
          description: "WHERE condition with placeholders (e.g., 'id = $1 AND status = $2')" 
        },
        whereParams: { 
          type: "array", 
          description: "Parameters for WHERE condition",
          items: { type: "string" }
        }
      },
      required: ["tableName", "whereCondition"]
    },
    example_request: { 
      tableName: "users",
      whereCondition: "id = $1",
      whereParams: ["1"]
    },
    example_response: {
      success: true,
      deletedRows: [
        {
          id: 1,
          name: "John Doe",
          email: "john@example.com",
          status: "inactive",
          created_at: "2025-07-15T06:30:00.000Z"
        }
      ],
      rowCount: 1
    }
  },
  {
    tool: "get_database_health",
    name: "get_database_health",
    description: "Check the health and status of the PostgreSQL database connection.",
    endpoint: "POST /a2a",
    api_url: "http://localhost:5008/health",
    parameters: {},
    schema: {
      type: "object",
      properties: {},
      required: []
    },
    example_request: {},
    example_response: {
      success: true,
      status: "healthy",
      message: "Database connection is active and responsive",
      timestamp: "2025-07-15T06:30:00.000Z"
    }
  },
  {
    tool: "get_database_stats",
    name: "get_database_stats",
    description: "Get comprehensive database statistics including table counts, row counts, database size, and active connections.",
    endpoint: "POST /a2a",
    api_url: "http://localhost:5008/stats",
    parameters: {},
    schema: {
      type: "object",
      properties: {},
      required: []
    },
    example_request: {},
    example_response: {
      success: true,
      stats: {
        totalTables: { count: "4" },
        totalRows: { count: "1250" },
        databaseSize: { size: "2.5 MB" },
        activeConnections: { count: "3" }
      },
      timestamp: "2025-07-15T06:30:00.000Z"
    }
  }
];

// SALES DEAL DATA TABLE SCHEMA
const salesDealDataSchema = {
  tableName: "sales_deal_data",
  description: "Contains information about sales deals. Each row represents a unique sales deal.",
  columns: [
    {
      name: "deal_id",
      type: "integer",
      description: "Unique identifier for each deal",
      usage: "Primary key, use for identifying specific deals"
    },
    {
      name: "customer_name",
      type: "varchar",
      description: "Name of the customer organization",
      usage: "Use for customer analysis, filtering by customer"
    },
    {
      name: "sales_rep",
      type: "varchar",
      description: "Sales representative handling the deal",
      usage: "Use for sales rep performance analysis, filtering by rep"
    },
    {
      name: "deal_value",
      type: "numeric",
      description: "Value of the deal in currency",
      usage: "Use for financial analysis, aggregations (SUM, AVG, MAX, MIN)"
    },
    {
      name: "discount_applied",
      type: "numeric",
      description: "Percentage discount applied to the quote",
      usage: "Use for discount analysis, filtering deals with/without discounts"
    },
    {
      name: "quote_date",
      type: "date",
      description: "Date when the quote was provided",
      usage: "Use for time-based analysis, date filtering, trend analysis"
    },
    {
      name: "month",
      type: "varchar",
      description: "Month when the quote was issued",
      usage: "Use for monthly analysis, grouping by month"
    },
    {
      name: "product_category",
      type: "varchar",
      description: "Category of the product or service quoted",
      usage: "Use for product analysis, filtering by category"
    },
    {
      name: "region",
      type: "varchar",
      description: "Geographic region (e.g., 'delhi')",
      usage: "Use for regional analysis, filtering by region"
    },
    {
      name: "revenue_type",
      type: "varchar",
      description: "Type of revenue, e.g., 'One Time'",
      usage: "Use for revenue type analysis, filtering by revenue type"
    },
    {
      name: "customer_type",
      type: "varchar",
      description: "Type of customer (e.g., 'Existing')",
      usage: "Use for customer type analysis, filtering by customer type"
    },
    {
      name: "quote_amount",
      type: "numeric",
      description: "Total quoted amount before discounts",
      usage: "Use for quote analysis, financial calculations"
    },
    {
      name: "outcome",
      type: "varchar",
      description: "Status of the deal (e.g., 'Won', 'Lost', 'Pending')",
      usage: "Use for deal outcome analysis, win/loss analysis"
    },
    {
      name: "close_date",
      type: "date",
      description: "Date the deal was closed (if applicable)",
      usage: "Use for closed deal analysis, time to close calculations"
    },
    {
      name: "mrr_contribution",
      type: "numeric",
      description: "Monthly recurring revenue contribution",
      usage: "Use for MRR analysis, recurring revenue calculations"
    },
    {
      name: "is_recurring_revenue",
      type: "varchar",
      description: "Indicates if the revenue is recurring ('Yes' or 'No')",
      usage: "Use for recurring vs one-time revenue analysis"
    }
  ],
  commonQueries: [
    {
      description: "Find top performing regions by deal value",
      query: "SELECT region, SUM(deal_value) as total_deal_value FROM sales_deal_data GROUP BY region ORDER BY total_deal_value DESC"
    },
    {
      description: "Analyze win rate by sales representative",
      query: "SELECT sales_rep, COUNT(*) as total_deals, COUNT(CASE WHEN outcome = 'Won' THEN 1 END) as won_deals, ROUND(COUNT(CASE WHEN outcome = 'Won' THEN 1 END) * 100.0 / COUNT(*), 2) as win_rate FROM sales_deal_data GROUP BY sales_rep ORDER BY win_rate DESC"
    },
    {
      description: "Monthly deal value trends",
      query: "SELECT month, SUM(deal_value) as monthly_deal_value FROM sales_deal_data GROUP BY month ORDER BY month"
    },
    {
      description: "Product category performance",
      query: "SELECT product_category, COUNT(*) as deal_count, AVG(deal_value) as avg_deal_value FROM sales_deal_data GROUP BY product_category ORDER BY avg_deal_value DESC"
    },
    {
      description: "Customer type analysis",
      query: "SELECT customer_type, COUNT(*) as deal_count, SUM(deal_value) as total_value FROM sales_deal_data GROUP BY customer_type ORDER BY total_value DESC"
    }
  ]
};

// SQL GENERATION PROMPT TEMPLATE FOR LLMs
const sqlPromptTemplate = `
**DATABASE SCHEMA - SALES DEAL DATA TABLE:**
Table: sales_deal_data
Description: Contains information about sales deals. Each row represents a unique sales deal.

**Available Columns:**
${salesDealDataSchema.columns.map(col => `- ${col.name} (${col.type}): ${col.description} - Use for: ${col.usage}`).join('\n')}

**Common Analysis Patterns:**
${salesDealDataSchema.commonQueries.map(q => `- ${q.description}: ${q.query}`).join('\n')}

**When generating SQL queries for PostgreSQL:**
- Use only one GROUP BY clause per query. If grouping by multiple columns, list them all in a single GROUP BY, separated by commas.
- Do not repeat GROUP BY or any other SQL clause.
- If using aggregate functions (AVG, SUM, COUNT, etc.), ensure all non-aggregate columns in the SELECT are included in the GROUP BY.
- CRITICAL: If you use an aggregate function in ORDER BY, you MUST also include it in the SELECT clause.
- Carefully review the query for syntax correctness.

**Good Examples:**
SELECT region, AVG(deal_value) FROM sales_deal_data GROUP BY region ORDER BY AVG(deal_value) DESC;
SELECT region, MAX(deal_value) FROM sales_deal_data GROUP BY region ORDER BY MAX(deal_value) DESC;
SELECT region, COUNT(*) FROM sales_deal_data GROUP BY region ORDER BY COUNT(*) DESC;

**Bad Examples (do NOT do this):**
SELECT region FROM sales_deal_data GROUP BY region GROUP BY deal_value ORDER BY AVG(deal_value) DESC;
SELECT region FROM sales_deal_data GROUP BY region ORDER BY AVG(deal_value) DESC;  // Missing AVG(deal_value) in SELECT
SELECT region FROM sales_deal_data GROUP BY region ORDER BY MAX(deal_value) DESC;  // Missing MAX(deal_value) in SELECT

**CRITICAL RULE:** When using aggregate functions in ORDER BY, ALWAYS include the same aggregate function in the SELECT clause.

**QUARTERLY DATA HANDLING:**
- When analyzing "this quarter" or "current quarter", first check if data exists for the current quarter
- If no data exists for the current quarter, use the most recent quarter with data
- For quarterly comparisons, ensure both quarters have data before comparing
- Use EXTRACT(QUARTER FROM quote_date::date) for quarter extraction
- Use EXTRACT(YEAR FROM quote_date::date) for year extraction
- Current date: 2025-07-22
- Current quarter: Q3 2025

**Quarterly Query Examples:**
-- Current quarter (Q3 2025: April 1 - June 30)
SELECT region, SUM(deal_value) as total_sales FROM sales_deal_data 
WHERE quote_date >= '2025-04-01' AND quote_date <= '2025-06-30' 
GROUP BY region ORDER BY SUM(deal_value) DESC;

-- Previous quarter (Q1 2025: January 1 - March 31)  
SELECT region, SUM(deal_value) as total_sales FROM sales_deal_data 
WHERE quote_date >= '2025-01-01' AND quote_date <= '2025-03-31' 
GROUP BY region ORDER BY SUM(deal_value) DESC;

-- Most recent quarter with data (if current quarter is empty)
SELECT region, SUM(deal_value) as total_sales FROM sales_deal_data 
WHERE quote_date >= '2025-01-01' AND quote_date <= '2025-03-31' 
GROUP BY region ORDER BY SUM(deal_value) DESC;

**IMPORTANT: Available Columns Only:**
- Use deal_value (numeric) for sales amounts - NOT total_sales
- Use quote_date (timestamp) for date filtering - NOT quarter
- Use region (text) for grouping by region
- Calculate totals using SUM(deal_value) and alias as total_sales
- Filter by date ranges using quote_date >= 'YYYY-MM-DD' AND quote_date <= 'YYYY-MM-DD'

**Column Selection Guidelines:**
- For financial analysis: Use deal_value, quote_amount, mrr_contribution
- For performance analysis: Use sales_rep, outcome, region
- For time-based analysis: Use quote_date, close_date, month
- For customer analysis: Use customer_name, customer_type
- For product analysis: Use product_category, revenue_type

Checklist before returning a query:
- Only one GROUP BY clause per query
- All non-aggregate columns are listed in GROUP BY, separated by commas
- If using aggregate functions in ORDER BY, include them in SELECT clause
- No duplicate GROUP BY or other SQL keywords
- Select appropriate columns based on the analysis type
- For quarterly analysis, check data availability and use appropriate time periods

**DATA SUMMARY REQUIREMENTS:**
- The system will automatically generate COMPREHENSIVE summaries for query results
- Summaries include detailed financial metrics, performance rankings, and business insights
- For quarterly analysis: Shows financial metrics, top performers, performance analysis, regional breakdown, and time context
- For regional analysis: Shows financial overview, regional rankings, and performance insights
- For count queries: Shows distribution metrics, category rankings, and distribution insights
- Enhanced data quality assessment with specific recommendations
- Query execution information and analysis tips
- All summaries are designed to provide actionable business intelligence
`;

// PostgreSQL Agent configuration
const postgresAgent = {
  name: "PostgresAgent",
  description: "PostgreSQL database agent with comprehensive CRUD operations, query execution, and database management capabilities",
  server_url: "http://localhost:5008",
  endpoints: {
    main: "/a2a",
    tools: "/tools",
    prompt_template: "/prompt-template",
    health: "/health",
    stats: "/stats"
  },
  capabilities: postgresTools,
  features: [
    "SQL query execution",
    "Table information retrieval",
    "CRUD operations (Create, Read, Update, Delete)",
    "Database health monitoring",
    "Database statistics",
    "Pagination support",
    "Prepared statements",
    "Transaction support",
    "Error handling and validation"
  ],
  database_info: {
    type: "PostgreSQL",
    version: "14+",
    connection_pool: true,
    prepared_statements: true,
    transactions: true
  }
};

module.exports = {
  postgresTools,
  postgresAgent,
  sqlPromptTemplate,
  salesDealDataSchema
};
