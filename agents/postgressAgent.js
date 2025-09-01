// src/agents/postgressAgent.js

const express = require('express');
const { postgresTools } = require('../orchestrator/postgressTools');

const app = express();
app.use(express.json());

// Initialize database connection flag
let dbInitialized = false;
let postgresFunctions = null;

// Try to initialize database functions
async function initializeDatabaseFunctions() {
  if (dbInitialized) return;
  
  try {
    // Try to import the PostgreSQL functions
    postgresFunctions = require('../Mcp-servers/posthgress_mcp_server');
    dbInitialized = true;
    console.log('✅ PostgreSQL functions loaded successfully');
  } catch (error) {
    console.log('⚠️ PostgreSQL functions not available:', error.message);
    console.log('💡 Database operations will return configuration info instead');
    dbInitialized = false;
  }
}

// Generic parameter extraction for any tool
function extractParametersFromInput(input, toolSchema) {
  const parameters = {};
  
  // Try to parse as JSON first
  try {
    const jsonMatch = input.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      Object.keys(parsed).forEach(key => {
        if (toolSchema.properties[key]) {
          parameters[key] = parsed[key];
        }
      });
    }
  } catch (e) {}
  
  // Use regex patterns for PostgreSQL parameters
  if (toolSchema.properties.query && !parameters.query) {
    const queryMatch = input.match(/(?:query|sql|select|insert|update|delete)\s*[:=]\s*["']([^"']+)["']/i);
    if (queryMatch) parameters.query = queryMatch[1];
  }
  
  if (toolSchema.properties.tableName && !parameters.tableName) {
    const tableMatch = input.match(/(?:table|from|into)\s+([a-zA-Z_][a-zA-Z0-9_]*)/i);
    if (tableMatch) parameters.tableName = tableMatch[1];
  }
  
  if (toolSchema.properties.data && !parameters.data) {
    const dataMatch = input.match(/(?:data|values)\s*[:=]\s*(\{[^}]+\})/i);
    if (dataMatch) {
      try {
        parameters.data = JSON.parse(dataMatch[1]);
      } catch (e) {}
    }
  }
  
  if (toolSchema.properties.whereCondition && !parameters.whereCondition) {
    const whereMatch = input.match(/(?:where|condition)\s*[:=]\s*["']([^"']+)["']/i);
    if (whereMatch) parameters.whereCondition = whereMatch[1];
  }
  
  if (toolSchema.properties.params && !parameters.params) {
    const paramsMatch = input.match(/(?:params|parameters)\s*[:=]\s*(\[[^\]]+\])/i);
    if (paramsMatch) {
      try {
        parameters.params = JSON.parse(paramsMatch[1]);
      } catch (e) {}
    }
  }
  
  if (toolSchema.properties.limit && !parameters.limit) {
    const limitMatch = input.match(/(?:limit)\s*[:=]\s*(\d+)/i);
    if (limitMatch) parameters.limit = parseInt(limitMatch[1]);
  }
  
  if (toolSchema.properties.offset && !parameters.offset) {
    const offsetMatch = input.match(/(?:offset)\s*[:=]\s*(\d+)/i);
    if (offsetMatch) parameters.offset = parseInt(offsetMatch[1]);
  }
  
  return parameters;
}

// Generic parameter validation and enrichment
async function validateAndEnrichParameters(parameters, toolSchema) {
  const enriched = { ...parameters };
  const missing = [];
  const suggestions = [];
  
  // Check each required parameter
  for (const requiredParam of toolSchema.required) {
    if (!enriched[requiredParam]) {
      missing.push(requiredParam);
      const paramDesc = toolSchema.properties[requiredParam]?.description || requiredParam;
      suggestions.push(`Please specify ${paramDesc}`);
    } else {
      // Validate parameter types
      if (['limit', 'offset'].includes(requiredParam)) {
        const value = parseInt(enriched[requiredParam]);
        if (isNaN(value)) {
          missing.push(requiredParam);
          suggestions.push(`Please provide a valid ${requiredParam} value`);
        } else {
          enriched[requiredParam] = value;
        }
      }
    }
  }
  
  return {
    isValid: missing.length === 0,
    missing,
    suggestions,
    enriched
  };
}

// Mock database response when database is not available
function getMockResponse(toolName, parameters) {
  switch (toolName) {
    case 'execute_query':
      return `📊 Query would be executed:\nQuery: ${parameters.query}\nParameters: ${JSON.stringify(parameters.params || [])}\n\n💡 Database connection not configured. Please set up PostgreSQL connection in src/Mcp-servers/db/index.js`;
      
    case 'get_table_info':
      return `📋 Table Information for '${parameters.tableName}':\n\n💡 Database connection not configured. Please set up PostgreSQL connection in src/Mcp-servers/db/index.js`;
      
    case 'get_all_tables':
      return `📚 Database Tables:\n\n💡 Database connection not configured. Please set up PostgreSQL connection in src/Mcp-servers/db/index.js`;
      
    case 'execute_select_query':
      return `🔍 SELECT Query would be executed:\nQuery: ${parameters.query}\nParameters: ${JSON.stringify(parameters.params || [])}\nLimit: ${parameters.limit || 100}\nOffset: ${parameters.offset || 0}\n\n💡 Database connection not configured. Please set up PostgreSQL connection in src/Mcp-servers/db/index.js`;
      
    case 'execute_insert_query':
      return `✅ Row would be inserted:\nTable: ${parameters.tableName}\nData: ${JSON.stringify(parameters.data, null, 2)}\n\n💡 Database connection not configured. Please set up PostgreSQL connection in src/Mcp-servers/db/index.js`;
      
    case 'execute_update_query':
      return `🔄 Rows would be updated:\nTable: ${parameters.tableName}\nData: ${JSON.stringify(parameters.data, null, 2)}\nWhere: ${parameters.whereCondition}\nParameters: ${JSON.stringify(parameters.whereParams || [])}\n\n💡 Database connection not configured. Please set up PostgreSQL connection in src/Mcp-servers/db/index.js`;
      
    case 'execute_delete_query':
      return `🗑️ Rows would be deleted:\nTable: ${parameters.tableName}\nWhere: ${parameters.whereCondition}\nParameters: ${JSON.stringify(parameters.whereParams || [])}\n\n💡 Database connection not configured. Please set up PostgreSQL connection in src/Mcp-servers/db/index.js`;
      
    case 'get_database_health':
      return `💚 Database Health:\nStatus: Not Connected\nMessage: Database connection not configured\nTimestamp: ${new Date().toISOString()}\n\n💡 Please set up PostgreSQL connection in src/Mcp-servers/db/index.js`;
      
    case 'get_database_stats':
      return `📈 Database Statistics:\nStatus: Not Available\nMessage: Database connection not configured\nTimestamp: ${new Date().toISOString()}\n\n💡 Please set up PostgreSQL connection in src/Mcp-servers/db/index.js`;
      
    default:
      return `❓ Unknown tool: ${toolName}\n\n💡 Database connection not configured. Please set up PostgreSQL connection in src/Mcp-servers/db/index.js`;
  }
}

// Generate intelligent data summary based on query and results
function generateDataSummary(query, data, rowCount) {
  let summary = '';
  
  try {
    // Analyze the query to understand what was requested
    const queryLower = query.toLowerCase();
    const isQuarterly = queryLower.includes('quarter') || queryLower.includes('2025-04-01') || queryLower.includes('2025-01-01');
    const isRegional = queryLower.includes('region') && queryLower.includes('group by region');
    const isTopPerformers = queryLower.includes('order by') && queryLower.includes('desc') && queryLower.includes('limit');
    const isSalesAnalysis = queryLower.includes('deal_value') || queryLower.includes('total_sales');
    const isComparison = queryLower.includes('2025-01-01') && queryLower.includes('2025-03-31');
    
    // Generate comprehensive context-aware summary
    if (isQuarterly && isRegional && isSalesAnalysis) {
      if (rowCount === 0) {
        summary = `📈 **DETAILED QUARTERLY SALES ANALYSIS**\n\n`;
        summary += `🔍 **DATA STATUS:** No sales data found for the requested time period.\n\n`;
        summary += `📊 **ANALYSIS INSIGHTS:**\n`;
        summary += `• This quarter shows zero sales activity across all regions\n`;
        summary += `• This could indicate a seasonal downturn or data entry gap\n`;
        summary += `• Consider comparing with previous quarters for trend analysis\n\n`;
        summary += `💡 **RECOMMENDATIONS:**\n`;
        summary += `• Check data entry for this time period\n`;
        summary += `• Analyze previous quarter performance for comparison\n`;
        summary += `• Review sales team activities during this period\n`;
      } else {
        summary = `📈 **DETAILED QUARTERLY SALES ANALYSIS**\n\n`;
        summary += `📊 **OVERVIEW:** Found ${rowCount} active regions with sales data for this period.\n\n`;
        
        if (data.length > 0) {
          // Calculate comprehensive metrics
          const totalSales = data.reduce((sum, row) => {
            return sum + parseFloat(row.total_sales || row.deal_value || 0);
          }, 0);
          
          const avgSales = totalSales / data.length;
          const topRegion = data[0];
          const topSales = parseFloat(topRegion.total_sales || topRegion.deal_value || 0);
          const bottomRegion = data[data.length - 1];
          const bottomSales = parseFloat(bottomRegion.total_sales || bottomRegion.deal_value || 0);
          
          summary += `💰 **FINANCIAL METRICS:**\n`;
          summary += `• Total Sales: $${totalSales.toLocaleString()}\n`;
          summary += `• Average Sales per Region: $${avgSales.toLocaleString()}\n`;
          summary += `• Sales Range: $${bottomSales.toLocaleString()} - $${topSales.toLocaleString()}\n`;
          summary += `• Sales Variance: $${(topSales - bottomSales).toLocaleString()}\n\n`;
          
          summary += `🏆 **TOP PERFORMERS:**\n`;
          summary += `• #1: ${topRegion.region} - $${topSales.toLocaleString()} (${((topSales/totalSales)*100).toFixed(1)}% of total)\n`;
          
          if (data.length > 1) {
            const secondRegion = data[1];
            const secondSales = parseFloat(secondRegion.total_sales || secondRegion.deal_value || 0);
            summary += `• #2: ${secondRegion.region} - $${secondSales.toLocaleString()} (${((secondSales/totalSales)*100).toFixed(1)}% of total)\n`;
          }
          
          if (data.length > 2) {
            const thirdRegion = data[2];
            const thirdSales = parseFloat(thirdRegion.total_sales || thirdRegion.deal_value || 0);
            summary += `• #3: ${thirdRegion.region} - $${thirdSales.toLocaleString()} (${((thirdSales/totalSales)*100).toFixed(1)}% of total)\n`;
          }
          
          summary += `\n⚠️ **PERFORMANCE ANALYSIS:**\n`;
          
          // Identify underperformers (regions below average)
          const underperformers = data.filter(row => {
            const sales = parseFloat(row.total_sales || row.deal_value || 0);
            return sales < avgSales;
          });
          
          if (underperformers.length > 0) {
            summary += `• Regions Below Average: ${underperformers.map(r => r.region).join(', ')}\n`;
            summary += `• Underperforming regions represent ${((underperformers.length/data.length)*100).toFixed(1)}% of total regions\n`;
          }
          
          // Performance distribution
          const highPerformers = data.filter(row => {
            const sales = parseFloat(row.total_sales || row.deal_value || 0);
            return sales > avgSales * 1.5;
          });
          
          if (highPerformers.length > 0) {
            summary += `• High Performers (>150% of average): ${highPerformers.map(r => r.region).join(', ')}\n`;
          }
          
          summary += `\n📊 **REGIONAL BREAKDOWN:**\n`;
          data.forEach((row, index) => {
            const sales = parseFloat(row.total_sales || row.deal_value || 0);
            const percentage = ((sales/totalSales)*100).toFixed(1);
            const rank = index + 1;
            summary += `• ${rank}. ${row.region}: $${sales.toLocaleString()} (${percentage}%)\n`;
          });
        }
        
        // Add time period context
        summary += `\n📅 **TIME PERIOD CONTEXT:**\n`;
        if (queryLower.includes('2025-04-01') && queryLower.includes('2025-06-30')) {
          summary += `• Quarter: Q2 2025 (April - June)\n`;
          summary += `• This is the second quarter of 2025\n`;
        } else if (queryLower.includes('2025-01-01') && queryLower.includes('2025-03-31')) {
          summary += `• Quarter: Q1 2025 (January - March)\n`;
          summary += `• This is the first quarter of 2025\n`;
        } else if (queryLower.includes('2025-07-01') && queryLower.includes('2025-09-30')) {
          summary += `• Quarter: Q3 2025 (July - September)\n`;
          summary += `• This is the third quarter of 2025\n`;
        } else if (queryLower.includes('2025-10-01') && queryLower.includes('2025-12-31')) {
          summary += `• Quarter: Q4 2025 (October - December)\n`;
          summary += `• This is the fourth quarter of 2025\n`;
        }
      }
    } else if (isRegional && isSalesAnalysis) {
      summary = `📊 **COMPREHENSIVE REGIONAL SALES ANALYSIS**\n\n`;
      summary += `📈 **OVERVIEW:** Analyzed sales performance across ${rowCount} regions.\n\n`;
      
      if (data.length > 0) {
        const totalSales = data.reduce((sum, row) => {
          return sum + parseFloat(row.total_sales || row.deal_value || 0);
        }, 0);
        
        const avgSales = totalSales / data.length;
        const topRegion = data[0];
        const topSales = parseFloat(topRegion.total_sales || topRegion.deal_value || 0);
        
        summary += `💰 **FINANCIAL OVERVIEW:**\n`;
        summary += `• Total Sales Across All Regions: $${totalSales.toLocaleString()}\n`;
        summary += `• Average Sales per Region: $${avgSales.toLocaleString()}\n`;
        summary += `• Top Region Contribution: ${((topSales/totalSales)*100).toFixed(1)}% of total sales\n\n`;
        
        summary += `🏆 **REGIONAL RANKINGS:**\n`;
        data.forEach((row, index) => {
          const sales = parseFloat(row.total_sales || row.deal_value || 0);
          const percentage = ((sales/totalSales)*100).toFixed(1);
          const rank = index + 1;
          summary += `• ${rank}. ${row.region}: $${sales.toLocaleString()} (${percentage}%)\n`;
        });
        
        summary += `\n📊 **PERFORMANCE INSIGHTS:**\n`;
        const highPerformers = data.filter(row => {
          const sales = parseFloat(row.total_sales || row.deal_value || 0);
          return sales > avgSales;
        });
        
        const underperformers = data.filter(row => {
          const sales = parseFloat(row.total_sales || row.deal_value || 0);
          return sales < avgSales;
        });
        
        summary += `• High Performing Regions: ${highPerformers.map(r => r.region).join(', ')}\n`;
        summary += `• Underperforming Regions: ${underperformers.map(r => r.region).join(', ')}\n`;
        summary += `• Performance Distribution: ${highPerformers.length} above average, ${underperformers.length} below average\n`;
      }
    } else if (queryLower.includes('count') && queryLower.includes('group by')) {
      summary = `📊 **DETAILED DATA DISTRIBUTION ANALYSIS**\n\n`;
      summary += `📈 **OVERVIEW:** Analyzed data distribution across ${rowCount} different categories.\n\n`;
      
      if (data.length > 0) {
        const totalCount = data.reduce((sum, row) => {
          return sum + parseInt(row.count || row.deal_count || 0);
        }, 0);
        
        const avgCount = totalCount / data.length;
        const topCategory = data[0];
        const topCount = parseInt(topCategory.count || topCategory.deal_count || 0);
        
        summary += `📊 **DISTRIBUTION METRICS:**\n`;
        summary += `• Total Records: ${totalCount.toLocaleString()}\n`;
        summary += `• Average Records per Category: ${avgCount.toFixed(1)}\n`;
        summary += `• Most Common Category: ${topCategory[Object.keys(topCategory)[0]]} (${topCount} records)\n`;
        summary += `• Top Category Share: ${((topCount/totalCount)*100).toFixed(1)}% of total records\n\n`;
        
        summary += `🏆 **CATEGORY RANKINGS:**\n`;
        data.forEach((row, index) => {
          const count = parseInt(row.count || row.deal_count || 0);
          const percentage = ((count/totalCount)*100).toFixed(1);
          const rank = index + 1;
          const categoryName = row[Object.keys(row)[0]];
          summary += `• ${rank}. ${categoryName}: ${count} records (${percentage}%)\n`;
        });
        
        summary += `\n📈 **DISTRIBUTION INSIGHTS:**\n`;
        const highVolume = data.filter(row => {
          const count = parseInt(row.count || row.deal_count || 0);
          return count > avgCount;
        });
        
        const lowVolume = data.filter(row => {
          const count = parseInt(row.count || row.deal_count || 0);
          return count < avgCount;
        });
        
        summary += `• High Volume Categories: ${highVolume.map(r => r[Object.keys(r)[0]]).join(', ')}\n`;
        summary += `• Low Volume Categories: ${lowVolume.map(r => r[Object.keys(r)[0]]).join(', ')}\n`;
        summary += `• Distribution: ${highVolume.length} above average, ${lowVolume.length} below average\n`;
      }
    } else {
      // Enhanced generic summary for other queries
      summary = `📊 **COMPREHENSIVE QUERY RESULTS ANALYSIS**\n\n`;
      summary += `📈 **OVERVIEW:** Successfully retrieved ${rowCount} records from the database.\n\n`;
      
      if (data.length > 0) {
        const sampleRow = data[0];
        const columns = Object.keys(sampleRow);
        
        summary += `📋 **DATA STRUCTURE:**\n`;
        summary += `• Available Columns: ${columns.join(', ')}\n`;
        summary += `• Data Types: ${columns.map(col => typeof sampleRow[col]).join(', ')}\n`;
        
        if (rowCount > 1) {
          summary += `• Sample Size: ${Math.min(rowCount, 10)} records shown (${rowCount} total)\n`;
        }
        
        summary += `\n📊 **SAMPLE DATA PREVIEW:**\n`;
        const previewRows = data.slice(0, 3);
        previewRows.forEach((row, index) => {
          summary += `• Record ${index + 1}: ${JSON.stringify(row)}\n`;
        });
        
        if (rowCount > 3) {
          summary += `• ... and ${rowCount - 3} more records\n`;
        }
        
        summary += `\n💡 **ANALYSIS TIPS:**\n`;
        summary += `• Use specific filters to narrow down results\n`;
        summary += `• Consider grouping by key columns for better insights\n`;
        summary += `• Add ORDER BY clauses to identify top performers\n`;
      }
    }
    
    // Enhanced data quality insights
    summary += `\n🔍 **DATA QUALITY ASSESSMENT:**\n`;
    if (rowCount === 0) {
      summary += `⚠️ **ISSUE:** No data found for the specified criteria.\n`;
      summary += `💡 **POSSIBLE CAUSES:**\n`;
      summary += `• Time period has no sales activity\n`;
      summary += `• Data hasn't been entered for this period\n`;
      summary += `• Query filters are too restrictive\n`;
      summary += `• Database connection issues\n`;
      summary += `💡 **RECOMMENDATIONS:**\n`;
      summary += `• Verify the time period has data\n`;
      summary += `• Check data entry completeness\n`;
      summary += `• Relax query filters\n`;
      summary += `• Test with broader date ranges\n`;
    } else if (rowCount === 1) {
      summary += `⚠️ **LIMITATION:** Only single record found.\n`;
      summary += `💡 **RECOMMENDATIONS:**\n`;
      summary += `• Expand time range for better analysis\n`;
      summary += `• Remove restrictive filters\n`;
      summary += `• Consider different grouping criteria\n`;
    } else if (rowCount > 10) {
      summary += `✅ **GOOD:** Large dataset available for analysis.\n`;
      summary += `💡 **PERFORMANCE TIPS:**\n`;
      summary += `• Add LIMIT clauses for faster queries\n`;
      summary += `• Use specific date ranges\n`;
      summary += `• Consider pagination for large results\n`;
    } else {
      summary += `✅ **GOOD:** Appropriate dataset size for analysis.\n`;
    }
    
    summary += `\n📅 **QUERY EXECUTION INFO:**\n`;
    summary += `• Query Type: ${isQuarterly ? 'Quarterly Analysis' : isRegional ? 'Regional Analysis' : 'General Query'}\n`;
    summary += `• Data Source: sales_deal_data table\n`;
    summary += `• Execution Time: ${new Date().toLocaleTimeString()}\n`;
    
  } catch (error) {
    summary = `📊 **DATA SUMMARY:** Successfully retrieved ${rowCount} records.\n`;
    summary += `⚠️ **NOTE:** Error occurred while generating detailed analysis: ${error.message}\n`;
    console.log('Error generating summary:', error.message);
  }
  
  return summary;
}

// SQL query validation and correction
function validateAndFixQuery(query) {
  let fixedQuery = query;
  
  console.log('🔍 Validating query:', query);
  
  // Priority 1: Fix missing aggregate in SELECT when used in ORDER BY
  const aggregateOrderByMatch = fixedQuery.match(/ORDER BY\s+(AVG|SUM|COUNT|MAX|MIN)\(([^)]+)\)/i);
  if (aggregateOrderByMatch) {
    const aggFunc = aggregateOrderByMatch[1];
    const aggCol = aggregateOrderByMatch[2];
    // Check if SELECT already includes the aggregate
    const selectMatch = fixedQuery.match(/SELECT\s+(.+?)\s+FROM/i);
    if (selectMatch) {
      const selectClause = selectMatch[1];
      const aggExpr = `${aggFunc}(${aggCol})`;
      if (!selectClause.includes(aggExpr)) {
        // Add the aggregate to the SELECT clause
        const newSelect = selectClause.trim().endsWith(',')
          ? `${selectClause} ${aggExpr}`
          : `${selectClause}, ${aggExpr}`;
        fixedQuery = fixedQuery.replace(/SELECT\s+(.+?)\s+FROM/i, `SELECT ${newSelect} FROM`);
        console.log('🔧 Fixed SQL query - added missing aggregate to SELECT:', fixedQuery);
      }
    }
  }
  
  // Priority 2: Fix duplicate GROUP BY clauses (but preserve CTE queries)
  const groupByMatches = fixedQuery.match(/GROUP BY/g);
  if (groupByMatches && groupByMatches.length > 1) {
    // Check if this is a CTE query (starts with WITH)
    const isCTEQuery = fixedQuery.trim().toUpperCase().startsWith('WITH');
    
    if (isCTEQuery) {
      console.log('🔍 CTE query detected - preserving GROUP BY clauses in CTEs');
      // For CTE queries, don't modify GROUP BY clauses as they're valid in each CTE
    } else {
      // Extract all GROUP BY clauses
      const groupByRegex = /GROUP BY\s+([^,\s]+(?:\s*,\s*[^,\s]+)*)/gi;
      const groupByClauses = [];
      let match;
      
      while ((match = groupByRegex.exec(fixedQuery)) !== null) {
        groupByClauses.push(match[1].trim());
      }
      
      // Combine all GROUP BY clauses into one
      if (groupByClauses.length > 1) {
        const combinedGroupBy = groupByClauses.join(', ');
        // Replace all GROUP BY clauses with a single one
        fixedQuery = fixedQuery.replace(/GROUP BY\s+[^,\s]+(?:\s*,\s*[^,\s]+)*/gi, '');
        // Clean up extra spaces
        fixedQuery = fixedQuery.replace(/\s+/g, ' ').trim();
        // Add the combined GROUP BY before ORDER BY
        if (fixedQuery.includes('ORDER BY')) {
          fixedQuery = fixedQuery.replace(/ORDER BY/, `GROUP BY ${combinedGroupBy} ORDER BY`);
        } else if (fixedQuery.includes('LIMIT')) {
          fixedQuery = fixedQuery.replace(/LIMIT/, `GROUP BY ${combinedGroupBy} LIMIT`);
        } else {
          fixedQuery = fixedQuery + ` GROUP BY ${combinedGroupBy}`;
        }
        console.log('🔧 Fixed SQL query - combined duplicate GROUP BY clauses:', fixedQuery);
      }
    }
  }
  
  // Priority 3: Fix missing GROUP BY for aggregate functions in SELECT (but preserve CTE queries)
  // Only add GROUP BY if there are non-aggregate columns in SELECT
  const isCTEQuery = fixedQuery.trim().toUpperCase().startsWith('WITH');
  
  if (!isCTEQuery) {
    const selectMatch = fixedQuery.match(/SELECT\s+(.+?)\s+FROM/i);
    if (selectMatch) {
      const selectClause = selectMatch[1];
      const hasAggregate = selectClause.includes('AVG(') || selectClause.includes('COUNT(') || 
                          selectClause.includes('SUM(') || selectClause.includes('MAX(') || selectClause.includes('MIN(');
      
      if (hasAggregate && !fixedQuery.includes('GROUP BY')) {
        // Extract non-aggregate columns (columns that are not aggregate functions)
        const nonAggregateColumns = selectClause.split(',').map(col => col.trim()).filter(col => {
          const cleanCol = col.replace(/\s+AS\s+\w+/i, '').trim(); // Remove alias
          return !cleanCol.includes('AVG(') && !cleanCol.includes('COUNT(') && !cleanCol.includes('SUM(') && 
                 !cleanCol.includes('MAX(') && !cleanCol.includes('MIN(') && !cleanCol.includes('STDDEV(');
        });
        
        // Only add GROUP BY if there are actual non-aggregate columns
        if (nonAggregateColumns.length > 0 && nonAggregateColumns.some(col => !col.includes('('))) {
          const groupByClause = nonAggregateColumns.join(', ');
          if (fixedQuery.includes('ORDER BY')) {
            fixedQuery = fixedQuery.replace(/ORDER BY/, `GROUP BY ${groupByClause} ORDER BY`);
          } else if (fixedQuery.includes('LIMIT')) {
            fixedQuery = fixedQuery.replace(/LIMIT/, `GROUP BY ${groupByClause} LIMIT`);
          } else {
            fixedQuery = fixedQuery + ` GROUP BY ${groupByClause}`;
          }
          console.log('🔧 Fixed SQL query - added GROUP BY for aggregate functions:', fixedQuery);
        } else {
          console.log('🔍 Query has only aggregate functions - no GROUP BY needed');
        }
      }
    }
  } else {
    console.log('🔍 CTE query detected - skipping automatic GROUP BY addition');
  }
  
  console.log('✅ Final fixed query:', fixedQuery);
  return fixedQuery;
}

// Generic API caller based on tool configuration
async function callAPI(toolName, parameters) {
  let tool = postgresTools.find(t => t.tool === toolName);
  if (!tool) {
    throw new Error(`Tool '${toolName}' not found in configuration`);
  }
  
  // If database is not initialized, return mock response
  if (!dbInitialized || !postgresFunctions) {
    return getMockResponse(toolName, parameters);
  }
  
  // Call the appropriate PostgreSQL API based on tool name
  try {
    switch (toolName) {
      case 'execute_query':
        // Validate and fix the query before execution
        const fixedQuery = validateAndFixQuery(parameters.query);
        console.log('🔍 Original query:', parameters.query);
        console.log('🔧 Fixed query:', fixedQuery);
        console.log('🔍 Query type:', typeof fixedQuery);
        console.log('🔍 Query length:', fixedQuery.length);
        
        // Additional validation - check for common syntax issues
        if (fixedQuery.includes('GROUP BY') && fixedQuery.includes('ORDER BY')) {
          const groupByIndex = fixedQuery.indexOf('GROUP BY');
          const orderByIndex = fixedQuery.indexOf('ORDER BY');
          if (groupByIndex > orderByIndex) {
            console.log('⚠️ WARNING: GROUP BY appears after ORDER BY - this is invalid SQL');
          }
        }
        
        const queryResult = await postgresFunctions.executeQuery(fixedQuery, parameters.params);
        if (!queryResult.success) {
          throw new Error(`Query execution failed: ${queryResult.error}`);
        }
        
        // Generate intelligent summary based on the query and data
        const summary = generateDataSummary(fixedQuery, queryResult.data, queryResult.rowCount);
        
        return `📊 Query executed successfully:\nRows returned: ${queryResult.rowCount}\nData: ${JSON.stringify(queryResult.data, null, 2)}\n\n${summary}`;
        
      case 'get_table_info':
        const tableInfo = await postgresFunctions.getTableInfo(parameters.tableName);
        if (!tableInfo.success) {
          throw new Error(`Failed to get table info: ${tableInfo.error}`);
        }
        return `📋 Table Information for '${parameters.tableName}':\nColumns: ${tableInfo.columnCount}\nSchema: ${JSON.stringify(tableInfo.columns, null, 2)}`;
        
      case 'get_all_tables':
        const tables = await postgresFunctions.getAllTables();
        if (!tables.success) {
          throw new Error(`Failed to get tables: ${tables.error}`);
        }
        return `📚 Database Tables (${tables.tableCount}):\n${tables.tables.map(t => `• ${t.table_name} (${t.table_type})`).join('\n')}`;
        
      case 'execute_select_query':
        const selectResult = await postgresFunctions.executeSelectQuery(
          parameters.query, 
          parameters.params, 
          parameters.limit || 100, 
          parameters.offset || 0
        );
        if (!selectResult.success) {
          throw new Error(`SELECT query failed: ${selectResult.error}`);
        }
        return `🔍 SELECT Query Results:\nRows: ${selectResult.rowCount} (Limit: ${selectResult.limit}, Offset: ${selectResult.offset})\nData: ${JSON.stringify(selectResult.data, null, 2)}`;
        
      case 'execute_insert_query':
        const insertResult = await postgresFunctions.executeInsertQuery(parameters.tableName, parameters.data);
        if (!insertResult.success) {
          throw new Error(`INSERT query failed: ${insertResult.error}`);
        }
        return `✅ Row inserted successfully:\nInserted: ${JSON.stringify(insertResult.insertedRow, null, 2)}`;
        
      case 'execute_update_query':
        const updateResult = await postgresFunctions.executeUpdateQuery(
          parameters.tableName, 
          parameters.data, 
          parameters.whereCondition, 
          parameters.whereParams || []
        );
        if (!updateResult.success) {
          throw new Error(`UPDATE query failed: ${updateResult.error}`);
        }
        return `🔄 Rows updated successfully:\nUpdated: ${updateResult.rowCount} rows\nData: ${JSON.stringify(updateResult.updatedRows, null, 2)}`;
        
      case 'execute_delete_query':
        const deleteResult = await postgresFunctions.executeDeleteQuery(
          parameters.tableName, 
          parameters.whereCondition, 
          parameters.whereParams || []
        );
        if (!deleteResult.success) {
          throw new Error(`DELETE query failed: ${deleteResult.error}`);
        }
        return `🗑️ Rows deleted successfully:\nDeleted: ${deleteResult.rowCount} rows\nData: ${JSON.stringify(deleteResult.deletedRows, null, 2)}`;
        
      case 'get_database_health':
        const health = await postgresFunctions.getDatabaseHealth();
        if (!health.success) {
          throw new Error(`Health check failed: ${health.error}`);
        }
        return `💚 Database Health:\nStatus: ${health.status}\nMessage: ${health.message}\nTimestamp: ${health.timestamp}`;
        
      case 'get_database_stats':
        const stats = await postgresFunctions.getDatabaseStats();
        if (!stats.success) {
          throw new Error(`Stats retrieval failed: ${stats.error}`);
        }
        return `📈 Database Statistics:\nTotal Tables: ${stats.stats.totalTables?.count || 'N/A'}\nTotal Rows: ${stats.stats.totalRows?.count || 'N/A'}\nDatabase Size: ${stats.stats.databaseSize?.size || 'N/A'}\nActive Connections: ${stats.stats.activeConnections?.count || 'N/A'}\nTimestamp: ${stats.timestamp}`;
        
      default:
        throw new Error(`PostgreSQL tool '${toolName}' not supported`);
    }
  } catch (error) {
    return `❌ Database operation failed: ${error.message}\n\n💡 Please check your database connection configuration in src/Mcp-servers/db/index.js`;
  }
}

app.post('/a2a', async (req, res) => {
  try {
    const input = req.body.message || req.body.input || '';
    const toolName = req.body.tool || 'execute_query'; // Default to execute_query if not specified
    
    // Find the tool configuration
    let tool = postgresTools.find(t => t.tool === toolName);
    if (!tool) {
      return res.json({ 
        content: { 
          text: `❌ Tool '${toolName}' not found in configuration. Available tools: ${postgresTools.map(t => t.tool).join(', ')}` 
        } 
      });
    }
    
    // Extract parameters from input
    let parameters = {};
    if (req.body.query || req.body.tableName || req.body.data || req.body.whereCondition) {
      // Direct parameter call from orchestrator
      parameters = { ...req.body };
    } else {
      // Natural language input
      parameters = extractParametersFromInput(input, tool.schema);
    }
    
    // Validate and enrich parameters
    const validation = await validateAndEnrichParameters(parameters, tool.schema);
    
    if (!validation.isValid) {
      const missingList = validation.missing.map(param => `• ${param}`).join('\n');
      const suggestionsList = validation.suggestions.join('\n');
      
      const response = `❌ **Incomplete Request for ${tool.name}**\n\n**Missing Information:**\n${missingList}\n\n**Suggestions:**\n${suggestionsList}`;
      
      return res.json({ content: { text: response } });
    }
    
    // Call the appropriate API
    const result = await callAPI(toolName, validation.enriched);
    
    return res.json({ content: { text: result } });
    
  } catch (error) {
    const errorResponse = `❌ **PostgreSQL Error**\n\nAn error occurred: ${error.message}`;
    return res.json({ content: { text: errorResponse } });
  }
});

// Expose tool definitions for LLM/orchestrator
app.get('/tools', (req, res) => {
  res.json({ 
    tools: postgresTools,
    agent_type: 'postgresql',
    description: 'PostgreSQL database agent with comprehensive CRUD operations and query execution',
    db_status: dbInitialized ? 'connected' : 'not_configured'
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: "OK", 
    message: "PostgreSQL Agent is running",
    available_tools: postgresTools.map(t => t.tool),
    db_status: dbInitialized ? 'connected' : 'not_configured'
  });
});

// Database health endpoint
app.get('/db-health', async (req, res) => {
  try {
    if (!dbInitialized || !postgresFunctions) {
      return res.json({
        success: false,
        status: 'not_configured',
        message: 'Database connection not configured',
        timestamp: new Date().toISOString()
      });
    }
    
    const health = await postgresFunctions.getDatabaseHealth();
    res.json(health);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Database stats endpoint
app.get('/db-stats', async (req, res) => {
  try {
    if (!dbInitialized || !postgresFunctions) {
      return res.json({
        success: false,
        status: 'not_configured',
        message: 'Database connection not configured',
        timestamp: new Date().toISOString()
      });
    }
    
    const stats = await postgresFunctions.getDatabaseStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Initialize database functions on startup
initializeDatabaseFunctions().then(() => {
  app.listen(5008, () => {
    console.log('🗄️ PostgreSQL Agent running on http://localhost:5008/a2a');
    console.log('📋 Available tools:', postgresTools.map(t => t.tool).join(', '));
    console.log('🔧 Tool definitions available at: http://localhost:5008/tools');
    console.log('💚 Health check available at: http://localhost:5008/health');
    console.log('📊 Database health available at: http://localhost:5008/db-health');
    console.log('📈 Database stats available at: http://localhost:5008/db-stats');
    console.log(`🗄️ Database status: ${dbInitialized ? '✅ Connected' : '⚠️ Not configured'}`);
  });
}).catch(error => {
  console.error('❌ Failed to initialize PostgreSQL agent:', error.message);
  process.exit(1);
});

module.exports = {
  app,
  validateAndFixQuery
};
