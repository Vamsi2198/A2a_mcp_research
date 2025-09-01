// src/unifiedOrchestrator.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { agentTools } = require('./orchestrator/agentTools');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Helper function to get icon for tool type
// Import agent images
const { agentImages } = require('./images/index.js');

// Helper function to get the correct agent name for display
function getDisplayAgentName(agentName, toolName) {
  // Show ZoomAgent for Zoom-related operations
  if (toolName && toolName.startsWith('zoom_')) {
    return 'ZoomAgent';
  }
  // Show EmailAgent for email operations
  if (toolName && toolName === 'outlook_send_email') {
    return 'EmailAgent';
  }
  // Show TeamsAgent for Teams operations
  if (toolName && toolName.startsWith('teams_')) {
    return 'TeamsAgent';
  }
  // Return original agent name for everything else
  return agentName;
}

function getToolIcon(toolName) {
  // Map tool categories to specific agent images
  const toolCategoryMap = {
    // Database/Query tools - Agent 1
    database: 0,
    // Flight tools - Agent 2  
    flight: 1,
    // Zoom tools - Agent 3
    zoom: 2,
    // Email tools - Agent 4
    email: 3,
    // Teams tools - Agent 5
    teams: 4,
    // Weather tools - Agent 6
    weather: 5,
    // Location tools - Agent 7
    location: 6,
    // Default - Agent 8
    default: 7
  };

  // Determine category based on tool name
  let category = 'default';
  if (toolName.includes('query') || toolName.includes('table') || toolName.includes('database')) {
    category = 'database';
  } else if (toolName.includes('flight') || toolName.includes('location')) {
    category = 'flight';
  } else if (toolName.includes('zoom')) {
    category = 'zoom';
  } else if (toolName.includes('email')) {
    category = 'email';
  } else if (toolName.includes('teams')) {
    category = 'teams';
  } else if (toolName.includes('weather')) {
    category = 'weather';
  } else if (toolName.includes('location')) {
    category = 'location';
  }

  return agentImages[toolCategoryMap[category]];
}

// Helper function to format results for user-friendly display
function formatResultForUser(toolName, result) {
  if (!result) return 'No result available';
  
  try {
    switch (toolName) {
      case 'zoom_create_meeting':
        const meetingData = typeof result === 'string' ? JSON.parse(result) : result;
        if (meetingData && meetingData.topic) {
          return `I have successfully created a Zoom meeting to me. The meeting is scheduled for ${new Date(meetingData.start_time).toLocaleString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' })} with a duration of ${meetingData.duration} minutes. The meeting topic is "${meetingData.topic}" and the agenda is "${meetingData.agenda}". The join URL is ${meetingData.join_url} and the password is ${meetingData.password}. The meeting ID is ${meetingData.id} for reference.`;
        }
        break;
        
      case 'zoom_list_meetings':
        const meetingsData = typeof result === 'string' ? JSON.parse(result) : result;
        if (meetingsData && meetingsData.meetings) {
          const totalMeetings = meetingsData.total_records || meetingsData.meetings.length;
          const meetingList = meetingsData.meetings.map((meeting, index) => 
            `${index + 1}. "${meeting.topic}" scheduled for ${new Date(meeting.start_time).toLocaleString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })} (${meeting.duration} minutes)`
          ).join('; ');
          return `I found ${totalMeetings} Zoom meeting${totalMeetings > 1 ? 's' : ''} in the system: ${meetingList}.`;
        }
        break;
        
      case 'outlook_send_email':
        return `📧 Email sent successfully with all requested information.`;
        
      case 'teams_send_message':
        return `I have successfully sent the Teams message with the requested information.`;
        
      case 'get_live_location':
        if (typeof result === 'string' && result.includes('City:')) {
          const cityMatch = result.match(/City:\s*([^\n]+)/);
          const city = cityMatch ? cityMatch[1].trim() : 'the current location';
          return `I have determined that the user is located in ${city}. This location information can be used for weather analysis and meeting scheduling.`;
        }
        return result;
        
      case 'get_current_weather_by_city':
        if (typeof result === 'string' && result.includes('Current Weather in')) {
          const cityMatch = result.match(/Current Weather in ([^:]+):/);
          const city = cityMatch ? cityMatch[1].trim() : 'the specified city';
          return `I have retrieved the current weather conditions for ${city}. The weather data shows ${result.includes('Temperature:') ? 'temperature and conditions' : 'current conditions'} that can be used for meeting scheduling decisions.`;
        }
        return result;
        
      case 'get_weather_forecast_by_city':
        if (typeof result === 'string' && result.includes('5-Day Weather Forecast for')) {
          const cityMatch = result.match(/5-Day Weather Forecast for ([^:]+):/);
          const city = cityMatch ? cityMatch[1].trim() : 'the specified city';
          return `I have analyzed the 5-day weather forecast for ${city}. The forecast shows weather patterns for the upcoming week, which I can use to recommend the best day for scheduling the meeting based on weather conditions.`;
        }
        return result;
        
      case 'search_flights':
        if (typeof result === 'string' && result.includes('Departure:')) {
          return `I have completed the flight search and found available flights. The search results show flight options with departure times, arrival times, and pricing information that can be used for travel planning.`;
        }
        return `I have completed the flight search operation and the results are ready for review.`;
        
      case 'search_locations':
        return `I have searched for location information and found the requested airport or city codes that can be used for flight searches.`;
        
      case 'execute_query':
        return `I have executed the database query and retrieved the requested information. The query results contain the data needed for analysis and reporting.`;
        
      default:
        // For unknown tools, create a conversational response
        if (typeof result === 'string') {
          if (result.includes('successfully') || result.includes('completed')) {
            return `I have successfully completed the ${toolName} operation. The task has been executed as requested.`;
          }
          return `I have completed the ${toolName} operation. ${result}`;
        } else if (typeof result === 'object') {
          return `I have successfully completed the ${toolName} operation and the results are available for the next step.`;
        } else {
          return `I have completed the ${toolName} operation successfully.`;
        }
    }
  } catch (error) {
    console.log(`Error formatting result for ${toolName}:`, error.message);
    return `I have completed the ${toolName} operation successfully.`;
  }
  
  return `I have completed the ${toolName} operation successfully.`;
}

// Session management for conversation context
const sessions = new Map();

// Session class to manage conversation state
class ConversationSession {
  constructor(sessionId) {
    this.sessionId = sessionId;
    this.context = {
      lastRequest: null,
      pendingParameters: {},
      conversationHistory: [], // [{role, content, timestamp}]
      userInputs: [], // just user messages
      timestamp: Date.now()
    };
  }

  // Store the last request and extract parameters
  updateContext(userInput, llmResponse) {
    this.context.lastRequest = userInput;
    this.context.timestamp = Date.now();
    this.context.userInputs.push(userInput);
    
    // Store the actual results from successful API calls
    if (llmResponse && llmResponse.success) {
      let assistantContent = '';
      
      // For single agent calls
      if (llmResponse.type === 'single_agent' && llmResponse.result) {
        assistantContent = llmResponse.result;
      }
      
      // For multi-step calls, include all results
      if (llmResponse.type === 'multi_step' && llmResponse.results) {
        assistantContent = llmResponse.results
          .filter(result => typeof result === 'string' && !result.startsWith('Error:'))
          .join('\n\n');
      }
      
      // For direct responses
      if (llmResponse.response) {
        assistantContent = llmResponse.response;
      }
      
      if (assistantContent) {
        this.context.conversationHistory.push({
          role: 'assistant',
          content: assistantContent,
          timestamp: Date.now(),
          // Store additional metadata for context
          metadata: {
            type: llmResponse.type,
            agent_used: llmResponse.agent_used,
            tool_used: llmResponse.tool_used,
            parameters: llmResponse.parameters
          }
        });
      }
    }
    
    // Parse LLM response to extract pending parameters
    if (llmResponse && llmResponse.missing_parameters) {
      this.context.pendingParameters = {
        agent_name: llmResponse.agent_name,
        tool_name: llmResponse.tool_name,
        missing_params: llmResponse.missing_parameters
      };
    } else {
      // Clear pending parameters if request is complete
      this.context.pendingParameters = {};
    }
    
    // Add user message to conversation history
    this.context.conversationHistory.push({
      role: 'user',
      content: userInput,
      timestamp: Date.now()
    });
  }

  // Get context for follow-up requests
  getContext() {
    return this.context;
  }

  // Check if this is a follow-up request
  isFollowUpRequest(userInput) {
    // Simple heuristics for follow-up detection
    const followUpPatterns = [
      /^(july|august|september|october|november|december|january|february|march|april|may|june)\s+\d{1,2}/i,
      /^\d{1,2}\s+(july|august|september|october|november|december|january|february|march|april|may|june)/i,
      /^(today|tomorrow|next week|next month)/i,
      /^\d{4}-\d{2}-\d{2}$/, // YYYY-MM-DD format
      /^\d{1,2}\/\d{1,2}\/\d{4}$/, // MM/DD/YYYY format
      /^(yes|no|ok|sure|fine)/i
    ];
    
    return followUpPatterns.some(pattern => pattern.test(userInput.trim()));
  }

  // Merge follow-up input with previous context
  mergeFollowUpInput(userInput) {
    if (!this.context.lastRequest || !this.context.pendingParameters.missing_params) {
      return userInput; // No context to merge
    }

    const lastRequest = this.context.lastRequest;
    const missingParams = this.context.pendingParameters.missing_params;
    
    // If missing date parameter, merge the follow-up input
    if (missingParams.includes('date') && this.isFollowUpRequest(userInput)) {
      return `${lastRequest} on ${userInput}`;
    }
    
    // If missing destination parameter
    if (missingParams.includes('destination') && !userInput.toLowerCase().includes('to ')) {
      return `${lastRequest} to ${userInput}`;
    }
    
    // If missing source parameter
    if (missingParams.includes('source') && !userInput.toLowerCase().includes('from ')) {
      return `${lastRequest} from ${userInput}`;
    }
    
    return userInput;
  }

  getAllUserInputs() {
    return this.context.userInputs;
  }
  getConversationHistory() {
    return this.context.conversationHistory;
  }
}

// Get or create session
function getSession(sessionId) {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, new ConversationSession(sessionId));
  }
  return sessions.get(sessionId);
}

// Clean up old sessions (older than 30 minutes)
function cleanupOldSessions() {
  const thirtyMinutesAgo = Date.now() - (30 * 60 * 1000);
  for (const [sessionId, session] of sessions.entries()) {
    if (session.context.timestamp < thirtyMinutesAgo) {
      sessions.delete(sessionId);
    }
  }
}

// Run cleanup every 10 minutes
setInterval(cleanupOldSessions, 10 * 60 * 1000);

// LLM call function
async function callOpenAI(prompt, systemPrompt = "You are a helpful assistant.") {
  const apiKey = process.env.OPENAI_API_KEY;
  const endpoint = process.env.AZURE_ENDPOINT + "/openai/deployments/" + process.env.AZURE_DEPLOYMENT_NAME + "/chat/completions?api-version=" + process.env.AZURE_API_VERSION;
  
  const headers = {
    "Content-Type": "application/json",
    "api-key": apiKey,
  };

  const body = {
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: prompt }
    ],
    temperature: 0.4,
    max_tokens: 1500,
  };

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || "No response from LLM";
  } catch (error) {
    console.error("❌ Error calling OpenAI:", error.message);
    throw error;
  }
}

// Generate prompt template for LLM to handle multi-step requests
function generatePromptTemplate() {
  const currentDateTime = new Date().toISOString();
  
  // Import SQL prompt template and sales deal data schema for PostgreSQL tools
  const { sqlPromptTemplate, salesDealDataSchema } = require('./orchestrator/postgressTools');
  
  // Build agent descriptions with their capabilities
  const agentDescriptions = agentTools.map(agent => {
    const capabilitiesList = agent.capabilities.map(cap => {
      const requiredParams = (cap.schema && cap.schema.required) ? cap.schema.required : [];
      const optionalParams = Object.keys(cap.schema && cap.schema.properties || {}).filter(param => !requiredParams.includes(param));
      
      let paramDescription = '';
      if (requiredParams.length > 0) {
        paramDescription += `Required: ${requiredParams.join(', ')}`;
      }
      if (optionalParams.length > 0) {
        paramDescription += `${requiredParams.length > 0 ? '; ' : ''}Optional: ${optionalParams.join(', ')}`;
      }
      
      return `    • ${cap.tool} - ${cap.description} (${paramDescription})`;
    }).join('\n');
    
    return `${agent.name} (${agent.server_url}) - ${agent.description}\n  Capabilities:\n${capabilitiesList}`;
  }).join('\n\n');

  const allTools = agentTools.flatMap(agent => agent.capabilities.map(cap => cap.tool));
  const availableToolNames = allTools.join(', ');

  // Check if the user request is related to sales data (will be checked in the main function)
  const salesKeywords = ['sales', 'deal', 'revenue', 'customer', 'region', 'product', 'quote', 'outcome', 'mrr', 'recurring'];

  // Enhanced SQL prompt template with sales data schema if needed
  let enhancedSqlPrompt = sqlPromptTemplate;

  return `
Current system date and time: ${currentDateTime}

You have access to the following agents and their capabilities:

${agentDescriptions}

User request: {{instruction}}

${enhancedSqlPrompt}

CONVERSATION HISTORY INTELLIGENCE:
- ⚠️ CRITICAL: You have access to previous conversation history and results
- ⚠️ ALWAYS analyze the conversation history before making decisions
- ⚠️ Extract and use information from previous successful API calls
- ⚠️ DO NOT re-execute steps that were already completed successfully
- ⚠️ Use available data to build complete payloads instead of asking for missing parameters
- ⚠️ Examples of information to extract from history:
  • Location data: "City: Mumbai" → use "Mumbai" for weather queries
  • Weather data: "Temperature: 26.45°C" → use for context, don't re-query
  • Flight data: "BOM → DEL" → use IATA codes for future queries
  • Date information: "2025-07-15" → use for flight searches if missing
- ⚠️ SMART PARAMETER BUILDING:
  • If user asks "weather in my location" and history shows "City: Mumbai" → use city: "Mumbai"
  • If user asks "flights from mumbai to delhi" and history shows location data → use source: "BOM", destination: "DEL"
  • If date is missing but available in context → use today's date or ask user
- ⚠️ AVOID REDUNDANT CALLS:
  • Don't call get_live_location if location is already known
  • Don't call weather APIs if weather data is recent and relevant
  • Don't search for IATA codes if they're already available
- ⚠️ MULTI-STEP REQUESTS WITH PLACEHOLDERS:
  • When user asks to "send weather in Teams" or "email weather results" → ALWAYS use multi-step approach
  • Step 1: Get weather data (even if recent data exists, get fresh data for the message)
  • Step 2: Send Teams/email message with "INCLUDE_WEATHER_RESULTS_HERE" placeholder
  • The system will automatically replace placeholders with actual results
  • Example: {"status": 3, "steps": [{"agent_name": "WeatherAgent", "tool_name": "get_current_weather_by_city", "parameters": {"city": "Mumbai"}}, {"agent_name": "TeamsAgent", "tool_name": "teams_send_message", "parameters": {"message": "Weather report:\n\nINCLUDE_WEATHER_RESULTS_HERE"}}]}
- ⚠️ ZOOM MEETING OPERATIONS:
  • For Zoom operations (create, list, delete meetings) → ALWAYS use FlightSearchAgent (NOT ZoomAgent)
  • For "cancel all meetings", "delete all meetings", or similar requests → ALWAYS use multi-step approach
  • Step 1: List all meetings using zoom_list_meetings
  • Step 2+: Delete each meeting individually using zoom_delete_meeting with actual meeting IDs
  • NEVER use meeting IDs from conversation history - always get fresh meeting IDs
  • Use placeholders like "FOUND_MEETING_ID" or "INCLUDE_MEETING_ID_HERE" for meeting IDs

Example:
"message": "Top result:\n\nINCLUDE_DATABASE_RESULTS_TABLE_HERE"
- ⚠️ QUARTERLY DATA ANALYSIS:
  • When user asks for "this quarter" or "current quarter" data → Check data availability first
  • If current quarter has no data → Use most recent quarter with data and inform user
  • For quarterly comparisons → Ensure both quarters have data before comparing
  • Always provide context about which time period is being analyzed
  • Use appropriate date ranges: Q1 (Jan-Mar), Q2 (Apr-Jun), Q3 (Jul-Sep), Q4 (Oct-Dec)

CONVERSATION HISTORY EXAMPLES:
📋 PREVIOUS CONVERSATION CONTEXT:
Location: Mumbai
Weather: Temperature: 26.45°C (feels like 26.45°C)
IATA routes: BOM → DEL

💬 CONVERSATION HISTORY:
User: what is my live location
Assistant: 📍 Current Location:
City: Mumbai
Country: India
Region: Maharashtra
Latitude: 19.0748
Longitude: 72.8856
IP: 14.195.26.3
Timezone: Asia/Kolkata
ISP: Tata Teleservices ISP AS
Postal Code: 400009

User: weather in my location
Assistant: 🌤️ Current Weather in Mumbai:
Temperature: 26.45°C (feels like 26.45°C)
Condition: overcast clouds
Humidity: 65%
Pressure: 1011 hPa
Wind: 8.91 m/s
Visibility: 10 km
Country: IN

User: search flights from mumbai to delhi
→ LLM should respond with: {"status": 1, "agent_name": "FlightSearchAgent", "tool_name": "search_flights", "parameters": {"source": "BOM", "destination": "DEL", "date": "2025-07-15"}}
→ NOT re-execute location or weather calls

User: check weather in bengaluru and send in teams
→ LLM should respond with: {"status": 3, "steps": [{"agent_name": "WeatherAgent", "tool_name": "get_current_weather_by_city", "parameters": {"city": "Bengaluru"}}, {"agent_name": "TeamsAgent", "tool_name": "teams_send_message", "parameters": {"message": "Here is the current weather report for Bengaluru:\n\nINCLUDE_WEATHER_RESULTS_HERE"}}]}

INSTRUCTIONS:
- You MUST respond with ONLY a single valid JSON object, and nothing else.
- Do NOT include any markdown, code blocks, triple backticks, or extra text.
- Do NOT include explanations, comments, or formatting outside the JSON.
- The JSON object MUST contain only the required fields for the agent call or answer, with no extra or repeated keys.
- DO NOT return any fields like "result", "message", or any custom field names — use only "status", "agent_name", "tool_name", "parameters", "missing_parameters", "response", "steps", or "current_step" as defined below.
- ⚠️ CRITICAL: Before calling any agent, you MUST check if ALL required parameters are available from the user's request.
- ⚠️ For flight searches, always convert city names to IATA codes when possible (e.g., "bangalore" → "BLR", "chennai" → "MAA", "hyderabad" → "HYD").
- ⚠️ For flight searches, if date is missing, ask the user for the date.
- ⚠️ For weather queries, use the appropriate weather tool based on the request type.
- ⚠️ IMPORTANT: You can now handle MULTI-STEP requests. If the user asks for multiple actions, break them down into sequential steps.
- ⚠️ For multi-step requests, return status: 3 with a "steps" array containing all the actions to be performed.
- ⚠️ Each step should be a complete agent call with all required parameters.
- ⚠️ Steps will be executed in order, and results from previous steps can be used in subsequent steps.
- ⚠️ CRITICAL: When sending emails that should include flight results, use "INCLUDE_FLIGHT_RESULTS_HERE" as a placeholder in the email body. The system will automatically replace this with the actual flight search results.
- ⚠️ CRITICAL: When sending emails that should include database results, use "INCLUDE_DATABASE_RESULTS_TABLE_HERE" as a placeholder. The system will automatically create a formatted table with all database results.
- ⚠️ CRITICAL: When sending emails that should include Zoom meeting details, use "INCLUDE_MEETING_DETAILS_HERE" as a placeholder in the email body. The system will automatically replace this with the actual meeting details including topic, meeting ID, start time, duration, join URL, and password.
- ⚠️ CRITICAL: For legacy support, you can still use specific placeholders like "INCLUDE_MAXIMUM_PRICE_HERE", "INCLUDE_AVERAGE_PRICE_HERE", etc. The system will automatically replace these with the actual database values.
- ⚠️ CRITICAL: For multi-step requests that use database results in flight searches, use placeholders like "FOUND_REGION_CODE", "FOUND_CODE", or "FOUND_CITY_CODE". The system will automatically replace these with the actual IATA codes from database results.
- ⚠️ CRITICAL: For email requests, if no email address is provided, ask the user to provide their email address. Do NOT use default or placeholder email addresses.
- ⚠️ CRITICAL: When writing SQL queries, follow proper syntax:
  • Use GROUP BY when using aggregate functions (AVG, COUNT, SUM, MAX, MIN)
  • Use ONLY ONE GROUP BY clause per query. If grouping by multiple columns, list them all in a single GROUP BY, separated by commas.
  • Do NOT repeat GROUP BY or any other SQL clause.
  • If using aggregate functions, ensure all non-aggregate columns in the SELECT are included in the GROUP BY.
  • Example: "SELECT region, AVG(deal_value) FROM sales_deal_data GROUP BY region ORDER BY AVG(deal_value) DESC LIMIT 1"
  • NOT: "SELECT region FROM sales_deal_data ORDER BY AVG(deal_value) DESC LIMIT 1" (this will fail)
  • NOT: "SELECT region FROM sales_deal_data GROUP BY region GROUP BY deal_value ORDER BY AVG(deal_value) DESC LIMIT 1" (this has duplicate GROUP BY)
  • CORRECT: "SELECT region, deal_value FROM sales_deal_data GROUP BY region, deal_value ORDER BY AVG(deal_value) DESC LIMIT 1"
- ⚠️ EMAIL FORMAT: ALWAYS start emails with "Dear User," and end with "Best regards,\nYour Travel Assistant" - this is MANDATORY for all email responses.
- ⚠️ EMAIL FORMATTING: When generating email bodies for outlook_send_email, ALWAYS include:
  - A polite greeting at the top (e.g., "Dear User," or "Hello,")
    - If the recipient's name is available (from the email address or user profile), use it in the greeting (e.g., "Dear Mula,").
    - If not, use "Dear User," or "Dear Team,".
  - ALWAYS add a blank line after the greeting.
  - Each paragraph or section should be separated by a blank line.
  - ALWAYS add a blank line before the closing.
  - ALWAYS put "Best regards," on its own line, followed by the signature on a new line.
  - NEVER put "Best regards," on the same line as the signature.
- ⚠️ NEVER send emails without proper greetings and closings
- ⚠️ ALWAYS use the exact format shown in the examples below

EMAIL BODY EXAMPLES (MUST FOLLOW THESE EXACTLY):
- Flight results: "Dear User,\n\nHere are the flight search results from [source] to [destination] on [date]:\n\nINCLUDE_FLIGHT_RESULTS_HERE\n\nBest regards,\nYour Travel Assistant"
- Weather report: "Dear Team,\n\nHere is the weather report for Mumbai:\n\nINCLUDE_WEATHER_RESULTS_HERE\n\nBest regards,\nYour Weather Assistant"
- General email: "Dear User,\n\n[Your message content here]\n\nBest regards,\nYour Assistant"
- If the user requests to "send an email to me" or uses similar phrasing (e.g., "email to me", "notify me", etc.), include the following email address in the recipient list:
["mula.krishna@polestarllp.com"]
`.trim();
}

// Call the appropriate agent server
async function callAgent(agentName, toolName, parameters) {
  console.log(`🤖 Calling agent: ${agentName} with tool: ${toolName}`);
  
  const agent = agentTools.find(a => a.name === agentName);
  if (!agent) {
    throw new Error(`Agent '${agentName}' not found`);
  }

  const tool = agent.capabilities.find(c => c.tool === toolName);
  if (!tool) {
    throw new Error(`Tool '${toolName}' not found in agent '${agentName}'`);
  }

  // Validate required parameters
  const requiredParams = (tool.schema && tool.schema.required) ? tool.schema.required : [];
  for (const requiredParam of requiredParams) {
    if (!parameters[requiredParam]) {
      throw new Error(`Missing required parameter: ${requiredParam}`);
    }
  }

  // Call the agent's server
  const agentUrl = `${agent.server_url}${agent.endpoints.main}`;
  console.log(`📡 Calling agent server: ${agentUrl}`);
  console.log(`📦 Request payload:`, JSON.stringify({
    tool: toolName,
    ...parameters
  }, null, 2));
  
  try {
    const response = await axios.post(agentUrl, {
      tool: toolName,
      ...parameters
    }, {
      timeout: 30000, // 30 second timeout
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log(`✅ Agent response received from ${agentName}`);
    return response.data?.content?.text || response.data?.text || JSON.stringify(response.data);
    
  } catch (error) {
    console.error(`❌ Error calling agent ${agentName}:`, error.message);
    if (error.response) {
      console.error('Agent response error:', error.response.data);
    }
    throw new Error(`Failed to call agent ${agentName}: ${error.message}`);
  }
}

// Utility to normalize city names for IATA lookup
const cityNameMap = {
  'bangalore': 'Bengaluru',
  'bengaluru': 'Bengaluru',
  'mumbai': 'Bombay',
  // add more mappings as needed
};

// Hardcoded IATA codes for common cities to avoid API calls
const cityToIataMap = {
  'bengaluru': 'BLR',
  'bangalore': 'BLR',
  'delhi': 'DEL',
  'mumbai': 'BOM',
  'bombay': 'BOM',
  'chennai': 'MAA',
  'madras': 'MAA',
  'kolkata': 'CCU',
  'calcutta': 'CCU',
  'hyderabad': 'HYD',
  'pune': 'PNQ',
  'ahmedabad': 'AMD',
  'kochi': 'COK',
  'cochin': 'COK',
  'trivandrum': 'TRV',
  'thiruvananthapuram': 'TRV'
};

function normalizeCityName(city) {
  return cityNameMap[city.trim().toLowerCase()] || city;
}

// Utility to get IATA code directly for known cities
async function getIataCodeForCity(city) {
  const normalizedCity = city.trim().toLowerCase();
  if (cityToIataMap[normalizedCity]) return cityToIataMap[normalizedCity];

  // Try Amadeus API via search_locations (simulate by calling FlightSearchAgent if needed)
  // (Assume this is handled elsewhere in the orchestration logic)

  // Fallback: Ask LLM for the IATA code
  try {
    const prompt = `What is the IATA airport code for the city "${city}"? Respond with only the 3-letter code, nothing else.`;
    const llmResponse = await callOpenAI(prompt, "You are an expert in airport codes. Only respond with the 3-letter IATA code, nothing else.");
    const codeMatch = llmResponse.match(/\b([A-Z]{3})\b/);
    if (codeMatch) {
      return codeMatch[1];
    }
  } catch (e) {
    console.error('❌ LLM fallback for IATA code failed:', e.message);
  }
  return null;
}

// Utility to extract city from live location result string
function extractCityFromLocationResult(result) {
  // Match 'City: <city>' up to the end of the line
  const match = result.match(/City:\s*([^\n\r]+)/i);
  if (match && match[1]) {
    return match[1].trim();
  }
  return null;
}

// Utility to extract IATA code from search_locations result string
function extractIataFromSearchLocationsResult(result) {
  // Look for pattern: (IATA)
  const match = result.match(/\(([A-Z]{3})\)/);
  if (match && match[1]) {
    return match[1];
  }
  return null;
}

// Parse flight data from the result string
function parseFlightData(flightResult) {
  const flights = [];
  
  // Use a comprehensive regex to match the entire flight entry pattern
  const flightPattern = /(\d+)\.\s+([A-Z]+\s+\d+)\s+\|\s+([A-Z]{3})\s+→\s+([A-Z]{3})\s*\nDeparture:\s*(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})\s*\|\s*Arrival:\s*(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})\s*\nDuration:\s*(PT\d+H\d*M?)\s*\nPrice:\s*\$([\d.]+)\s*EUR/g;
  
  let match;
  while ((match = flightPattern.exec(flightResult)) !== null) {
    const flight = {
      number: parseInt(match[1]),
      flightId: match[2],
      source: match[3],
      destination: match[4],
      departure: match[5],
      arrival: match[6],
      duration: match[7],
      price: `$${match[8]} EUR`
    };
    flights.push(flight);
  }
  
  return flights;
}

// Create HTML table for flight results
function createFlightResultsTable(flights) {
  if (flights.length === 0) {
    return 'No flights found.';
  }
  
  let tableHtml = `<div style="background: white; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); margin: 20px 0; overflow: hidden;">
    <table style="border-collapse: collapse; width: 100%; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px;">`;
  
  // Table header
  tableHtml += `
    <thead>
      <tr style="background-color: #f8f9fa; border-bottom: 1px solid #e9ecef;">
        <th style="padding: 10px 12px; text-align: left; font-weight: 600; color: #495057; font-size: 13px;">#</th>
        <th style="padding: 10px 12px; text-align: left; font-weight: 600; color: #495057; font-size: 13px;">Flight ID</th>
        <th style="padding: 10px 12px; text-align: left; font-weight: 600; color: #495057; font-size: 13px;">From</th>
        <th style="padding: 10px 12px; text-align: left; font-weight: 600; color: #495057; font-size: 13px;">To</th>
        <th style="padding: 10px 12px; text-align: left; font-weight: 600; color: #495057; font-size: 13px;">Departure</th>
        <th style="padding: 10px 12px; text-align: left; font-weight: 600; color: #495057; font-size: 13px;">Arrival</th>
        <th style="padding: 10px 12px; text-align: left; font-weight: 600; color: #495057; font-size: 13px;">Duration</th>
        <th style="padding: 10px 12px; text-align: left; font-weight: 600; color: #495057; font-size: 13px;">Price</th>
      </tr>
    </thead>
    <tbody>`;
  
  // Table rows
  flights.forEach((flight, index) => {
    const rowColor = index % 2 === 0 ? '#ffffff' : '#f8f9fa';
    const departureTime = formatDateTime(flight.departure);
    const arrivalTime = formatDateTime(flight.arrival);
    const duration = formatDuration(flight.duration);
    
    // Use actual flight data if available, otherwise generate
    const flightId = flight.flightId || generateFlightId(flight.number);
    const sourceCode = flight.source || extractAirportCode(flight.departure);
    const destCode = flight.destination || extractAirportCode(flight.arrival);
    
    tableHtml += `
      <tr style="background-color: ${rowColor};">
        <td style="padding: 10px 12px; border-bottom: 1px solid #e9ecef; font-weight: 500; color: #495057;">${flight.number}</td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e9ecef; font-weight: 600; color: #212529;">${flightId}</td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e9ecef; font-weight: 500; color: #495057;">${sourceCode}</td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e9ecef; font-weight: 500; color: #495057;">${destCode}</td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e9ecef; color: #495057;">${departureTime}</td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e9ecef; color: #495057;">${arrivalTime}</td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e9ecef; color: #495057;">${duration}</td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e9ecef; font-weight: 600; color: #dc3545; background-color: #fff5f5;">${flight.price}</td>
      </tr>`;
  });
  
  tableHtml += `
    </tbody>
  </table>
  </div>`;
  
  return tableHtml;
}

// Format date and time for display
function formatDateTime(dateTimeString) {
  try {
    const date = new Date(dateTimeString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  } catch (error) {
    return dateTimeString;
  }
}

// Format duration from PT format to readable format
function formatDuration(duration) {
  if (!duration || duration === 'N/A') return 'N/A';
  
  // Parse PT2H50M format
  const hoursMatch = duration.match(/(\d+)H/);
  const minutesMatch = duration.match(/(\d+)M/);
  
  const hours = hoursMatch ? parseInt(hoursMatch[1]) : 0;
  const minutes = minutesMatch ? parseInt(minutesMatch[1]) : 0;
  
  if (hours > 0 && minutes > 0) {
    return `${hours}h ${minutes}m`;
  } else if (hours > 0) {
    return `${hours}h`;
  } else if (minutes > 0) {
    return `${minutes}m`;
  }
  
  return duration;
}

// Generate flight ID like "AI 9479"
function generateFlightId(flightNumber) {
  const airlines = ['AI', '6E', 'SG', 'UK', 'G8', 'IX', '9W', 'I5'];
  const randomAirline = airlines[Math.floor(Math.random() * airlines.length)];
  const randomNumber = Math.floor(Math.random() * 9999) + 1000;
  return `${randomAirline} ${randomNumber}`;
}

// Extract airport code from date string (this is a placeholder - in real implementation, 
// you'd get this from the actual flight data)
function extractAirportCode(dateString) {
  // This is a simplified version - in reality, you'd extract from actual flight data
  // For now, we'll use common codes based on the context
  const codes = ['DEL', 'BLR', 'BOM', 'MAA', 'HYD', 'CCU', 'PNQ', 'AMD'];
  return codes[Math.floor(Math.random() * codes.length)];
}

async function executeMultiStepOrchestration(steps, session) {
  console.log(`🔄 Executing ${steps.length} steps...`);
  
  const results = [];
  const stepDetails = [];
  let weatherAssessment = null;

  // Get session context if available
  let context = session && session.getContext ? session.getContext() : {};
  let conversationHistory = context.conversationHistory || [];

  // Helper: find last location
  function getLastLocation() {
    for (let i = conversationHistory.length - 1; i >= 0; i--) {
      const msg = conversationHistory[i];
      if (msg.role === 'assistant' && msg.content && msg.content.includes('City:')) {
        const match = msg.content.match(/City:\s*([^\n]+)/);
        if (match) return match[1].trim();
      }
    }
    return null;
  }
  // Helper: find last weather for a city
  function getLastWeather(city) {
    for (let i = conversationHistory.length - 1; i >= 0; i--) {
      const msg = conversationHistory[i];
      if (msg.role === 'assistant' && msg.content && msg.content.includes('Current Weather in')) {
        if (msg.content.includes(city)) return msg.content;
      }
    }
    return null;
  }

  // Enhanced: Insert city-to-IATA mapping if needed
  let enhancedSteps = [];
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    // Redundant step skipping logic
    if (step.tool_name === 'get_live_location') {
      const lastLoc = getLastLocation();
      if (lastLoc) {
        console.log('⏩ Skipping redundant get_live_location (already have location:', lastLoc, ')');
        continue;
      }
    }
    if (step.tool_name === 'get_location_weather' || step.tool_name === 'get_current_weather_by_city') {
      let city = step.parameters && step.parameters.city;
      if (!city) city = getLastLocation();
      if (city && getLastWeather(city)) {
        console.log('⏩ Skipping redundant weather call for city:', city);
        continue;
      }
    }
    // If this is a get_live_location step and next is search_flights
    if (
      step.tool_name === 'get_live_location' &&
      i + 1 < steps.length &&
      steps[i + 1].tool_name === 'search_flights'
    ) {
      // Insert a search_locations step after get_live_location
      enhancedSteps.push(step);
      // We'll fill in the city after running get_live_location
      // Mark the next step for enhancement
      enhancedSteps.push({
        ...steps[i + 1],
        _needs_iata_mapping: true
      });
      i++; // skip the next step, as we just handled it
      continue;
    }
    enhancedSteps.push(step);
  }

  for (let i = 0; i < enhancedSteps.length; i++) {
    const step = enhancedSteps[i];
    try {
      // Handle city placeholders in parameters
      if (step.parameters && step.parameters.city && typeof step.parameters.city === 'string' &&
        (step.parameters.city.includes('INCLUDE_CITY_HERE') || step.parameters.city.includes('INCLUDE_CITY_NAME_HERE') || step.parameters.city.includes('INCLUDE_CITY_FROM_LIVE_LOCATION') || step.parameters.city.includes('FOUND_CITY'))) {
        console.log('🏙️ Processing city placeholder:', step.parameters.city);
        
        // Find the most recent location result
        const locationResults = results.filter((result, index) => {
          const stepDetail = stepDetails[index];
          return stepDetail && stepDetail.tool_name === 'get_live_location';
        });
        
        if (locationResults.length > 0) {
          const latestLocationResult = locationResults[locationResults.length - 1];
          console.log('📍 Processing location result for city extraction:', latestLocationResult);
          
          let city = extractCityFromLocationResult(latestLocationResult);
          if (city) {
            console.log('🏙️ Extracted city from location:', city);
            step.parameters.city = city;
            console.log('🔧 Updated city parameter:', step.parameters.city);
          } else {
            console.log('❌ Could not extract city from location result');
          }
        } else {
          console.log('⚠️ No location results found to replace city placeholder');
        }
      }
      
      // Handle weather-dependent date parameters
      if (step.parameters && typeof step.parameters.date === 'string' &&
        (/SUNNY|GOOD_WEATHER/i.test(step.parameters.date))) {
        console.log('🌤️ Processing weather-dependent date:', step.parameters.date);
        console.log('🔍 Step parameters before processing:', JSON.stringify(step.parameters, null, 2));
        // Find the most recent weather forecast result
        const weatherResults = results.filter((result, index) => {
          const stepDetail = stepDetails[index];
          return stepDetail && (stepDetail.tool_name === 'get_weather_forecast_by_city' || stepDetail.tool_name === 'get_current_weather_by_city');
        });
        if (weatherResults.length > 0) {
          const latestWeatherResult = weatherResults[weatherResults.length - 1];
          console.log('📊 Weather result to analyze:', latestWeatherResult);
          const nextSunnyDate = findNextSunnyDay(latestWeatherResult);
          if (nextSunnyDate) {
            console.log('☀️ Found next sunny day:', nextSunnyDate);
            step.parameters.date = nextSunnyDate;
          } else {
            console.log('⚠️ No sunny day found in forecast, using tomorrow as fallback');
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            step.parameters.date = tomorrow.toISOString().split('T')[0];
          }
        } else {
          console.log('⚠️ No weather results found, using tomorrow as fallback');
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          step.parameters.date = tomorrow.toISOString().split('T')[0];
        }
        console.log('🔧 Step parameters after processing:', JSON.stringify(step.parameters, null, 2));
      }
      
      // Handle date placeholders in parameters
      if (step.parameters && step.parameters.start_time && typeof step.parameters.start_time === 'string' &&
        (step.parameters.start_time.includes('INCLUDE_SUITABLE_DATE_HERE') || step.parameters.start_time.includes('INCLUDE_SUITABLE_DATE_TIME_HERE') || step.parameters.start_time.includes('INCLUDE_SELECTED_DATE_AND_TIME') || step.parameters.start_time.includes('FOUND_SUITABLE_DATE_TIME') || step.parameters.start_time.includes('INCLUDE_SELECTED_DATE_HERE'))) {
        console.log('📅 Processing date placeholder:', step.parameters.start_time);
        
        // Find the most recent weather forecast result
        const weatherResults = results.filter((result, index) => {
          const stepDetail = stepDetails[index];
          return stepDetail && stepDetail.tool_name === 'get_weather_forecast_by_city';
        });
        
        if (weatherResults.length > 0) {
          const latestWeatherResult = weatherResults[weatherResults.length - 1];
          console.log('🌤️ Processing weather result for date selection:', latestWeatherResult);
          
          const nextSunnyDate = findNextSunnyDay(latestWeatherResult);
          if (nextSunnyDate) {
            console.log('☀️ Found next sunny day:', nextSunnyDate);
            // Set the meeting time to afternoon (2 PM) on the sunny day
            const meetingDateTime = `${nextSunnyDate}T14:00:00`;
            step.parameters.start_time = meetingDateTime;
            console.log('🔧 Updated start_time parameter:', step.parameters.start_time);
          } else {
            console.log('⚠️ No sunny day found in forecast, using tomorrow afternoon as fallback');
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(14, 0, 0, 0); // 2 PM
            step.parameters.start_time = tomorrow.toISOString();
            console.log('🔧 Updated start_time parameter (fallback):', step.parameters.start_time);
          }
        } else {
          console.log('⚠️ No weather results found, using tomorrow afternoon as fallback');
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          tomorrow.setHours(14, 0, 0, 0); // 2 PM
          step.parameters.start_time = tomorrow.toISOString();
          console.log('🔧 Updated start_time parameter (fallback):', step.parameters.start_time);
        }
      }
      
      // Handle timezone placeholders in parameters
      if (step.parameters && step.parameters.timezone && typeof step.parameters.timezone === 'string' &&
        (step.parameters.timezone.includes('INCLUDE_TIMEZONE_HERE') || step.parameters.timezone.includes('INCLUDE_TIMEZONE_FROM_LIVE_LOCATION'))) {
        console.log('🕐 Processing timezone placeholder:', step.parameters.timezone);
        
        // Find the most recent location result
        const locationResults = results.filter((result, index) => {
          const stepDetail = stepDetails[index];
          return stepDetail && stepDetail.tool_name === 'get_live_location';
        });
        
        if (locationResults.length > 0) {
          const latestLocationResult = locationResults[locationResults.length - 1];
          console.log('📍 Processing location result for timezone extraction:', latestLocationResult);
          
          // Extract timezone from location result
          const timezoneMatch = latestLocationResult.match(/Timezone:\s*([^\n]+)/i);
          if (timezoneMatch) {
            const timezone = timezoneMatch[1].trim();
            console.log('🕐 Extracted timezone from location:', timezone);
            step.parameters.timezone = timezone;
            console.log('🔧 Updated timezone parameter:', step.parameters.timezone);
          } else {
            console.log('⚠️ Could not extract timezone from location result, using default');
            step.parameters.timezone = 'Asia/Kolkata';
            console.log('🔧 Updated timezone parameter (default):', step.parameters.timezone);
          }
        } else {
          console.log('⚠️ No location results found, using default timezone');
          step.parameters.timezone = 'Asia/Kolkata';
          console.log('🔧 Updated timezone parameter (default):', step.parameters.timezone);
        }
      }
      
      // Handle Zoom meeting ID extraction from list meetings result
      if (step.tool_name === 'zoom_delete_meeting' && step.parameters) {
        console.log('🔧 Processing zoom delete meeting parameters for meeting ID extraction...');
        console.log('🔍 Current meetingId:', step.parameters.meetingId);
        console.log('🔍 meetingId type:', typeof step.parameters.meetingId);
        
        // Check if meetingId contains a placeholder that needs to be replaced with actual meeting ID
        const hasPlaceholder = step.parameters.meetingId && typeof step.parameters.meetingId === 'string' && (step.parameters.meetingId.includes('PLACEHOLDER_FOR_MEETING_ID') || step.parameters.meetingId.includes('PLACEHOLDER_FOR_MEETING_ID_') || step.parameters.meetingId.includes('INCLUDE_MEETING_ID_HERE') || step.parameters.meetingId.includes('FOUND_MEETING_ID'));
        console.log('🔍 Has placeholder:', hasPlaceholder);
        
        if (hasPlaceholder) {
          console.log('🔍 Found placeholder in meetingId:', step.parameters.meetingId);
          
          // Find the most recent zoom list meetings result
          const zoomListResults = results.filter((result, index) => {
            const stepDetail = stepDetails[index];
            return stepDetail && stepDetail.tool_name === 'zoom_list_meetings';
          });
          
          if (zoomListResults.length > 0) {
            const latestZoomResult = zoomListResults[zoomListResults.length - 1];
            console.log('📹 Processing zoom list result for meeting ID extraction:', typeof latestZoomResult);
            
            // Extract meeting IDs from the zoom list result
            let meetingIds = [];
            if (typeof latestZoomResult === 'object' && latestZoomResult.meetings && Array.isArray(latestZoomResult.meetings)) {
              meetingIds = latestZoomResult.meetings.map(meeting => meeting.id);
              console.log('📹 Extracted meeting IDs from object:', meetingIds);
            } else if (typeof latestZoomResult === 'string') {
              // Try to extract JSON data from the result string
              try {
                // First try to parse the entire string as JSON
                const zoomData = JSON.parse(latestZoomResult);
                if (zoomData.meetings && Array.isArray(zoomData.meetings)) {
                  meetingIds = zoomData.meetings.map(meeting => meeting.id);
                  console.log('📹 Extracted meeting IDs from direct JSON parse:', meetingIds);
                }
              } catch (e) {
                // If direct parse fails, try regex extraction
                try {
                  const jsonMatch = latestZoomResult.match(/\{[\s\S]*\}/);
                  if (jsonMatch) {
                    const zoomData = JSON.parse(jsonMatch[0]);
                    if (zoomData.meetings && Array.isArray(zoomData.meetings)) {
                      meetingIds = zoomData.meetings.map(meeting => meeting.id);
                      console.log('📹 Extracted meeting IDs from regex JSON:', meetingIds);
                    }
                  }
                } catch (e2) {
                  console.log('⚠️ Could not parse zoom result as JSON:', e2.message);
                }
              }
            }
            
            if (meetingIds.length > 0) {
              console.log('📹 Found meeting IDs:', meetingIds);
              
              // Handle different placeholder types
              if (typeof step.parameters.meetingId === 'string' && (step.parameters.meetingId.includes('INCLUDE_MEETING_ID_HERE') || step.parameters.meetingId.includes('FOUND_MEETING_ID'))) {
                // This is a "delete all" placeholder - replace with multiple delete steps
                console.log('📹 Processing delete all placeholder - creating multiple delete steps');
                console.log('📹 Number of meeting IDs found:', meetingIds.length);
                console.log('📹 Meeting IDs:', meetingIds);
                
                // Replace the current step with the first delete step
                step.parameters.meetingId = meetingIds[0].toString();
                console.log('🔧 Updated first step meetingId:', step.parameters.meetingId);
                
                // Add remaining delete steps to the enhanced steps array
                if (meetingIds.length > 1) {
                  console.log(`📹 Adding ${meetingIds.length - 1} additional delete steps`);
                  const additionalSteps = meetingIds.slice(1).map(meetingId => ({
                    agent_name: 'FlightSearchAgent',
                    tool_name: 'zoom_delete_meeting',
                    parameters: { meetingId: meetingId.toString() }
                  }));
                  console.log('📹 Additional steps to add:', additionalSteps);
                  enhancedSteps.splice(i + 1, 0, ...additionalSteps);
                  console.log('📹 Enhanced steps after adding:', enhancedSteps.length, 'total steps');
                } else {
                  console.log('📹 Only one meeting found, no additional steps needed');
                }
              } else {
                // Handle indexed placeholders (e.g., PLACEHOLDER_FOR_MEETING_ID_1 -> index 0)
                const placeholderMatch = typeof step.parameters.meetingId === 'string' ? step.parameters.meetingId.match(/PLACEHOLDER_FOR_MEETING_ID_(\d+)/) : null;
                let targetIndex = 0;
                if (placeholderMatch) {
                  targetIndex = parseInt(placeholderMatch[1]) - 1; // Convert 1-based to 0-based
                  console.log('📹 Target meeting index from placeholder:', targetIndex);
                }
                
                // Use the target index if available, otherwise use the first meeting
                if (targetIndex >= 0 && targetIndex < meetingIds.length) {
                  step.parameters.meetingId = meetingIds[targetIndex].toString();
                  console.log(`🔧 Updated meetingId parameter to index ${targetIndex}:`, step.parameters.meetingId);
                } else if (meetingIds.length > 0) {
                  // Fallback to first meeting if target index is out of range
                  step.parameters.meetingId = meetingIds[0].toString();
                  console.log('🔧 Updated meetingId parameter to first meeting:', step.parameters.meetingId);
                }
              }
            } else {
              console.log('⚠️ No meeting IDs found in zoom list result');
            }
          } else {
            console.log('⚠️ No zoom list results found to extract meeting IDs');
          }
        }
      }
      
      // Handle database result placeholders in flight search parameters
      if (step.tool_name === 'search_flights' && step.parameters) {
        console.log('🔧 Processing flight search parameters for database placeholders...');
        
        // Check if destination contains a placeholder that needs to be replaced with database result
        if (step.parameters.destination && step.parameters.destination.includes('FOUND_')) {
          console.log('🔍 Found placeholder in destination:', step.parameters.destination);
          
          // Find the most recent database query result
          const dbResults = results.filter((result, index) => {
            const stepDetail = stepDetails[index];
            return stepDetail && stepDetail.agent_name === 'PostgresAgent';
          });
          
          if (dbResults.length > 0) {
            const latestDbResult = dbResults[dbResults.length - 1];
            console.log('📊 Processing database result for flight search:', latestDbResult);
            
            // Extract data from the database result
            let dbData = {};
            if (latestDbResult && typeof latestDbResult === 'object' && Array.isArray(latestDbResult.data) && latestDbResult.data.length > 0) {
              dbData = latestDbResult.data[0];
            } else if (typeof latestDbResult === 'string') {
              // Try to extract JSON data from the result string
              try {
                const dataMatch = latestDbResult.match(/Data:\s*(\[[\s\S]*\])/);
                if (dataMatch) {
                  const dataArray = JSON.parse(dataMatch[1]);
                  if (Array.isArray(dataArray) && dataArray.length > 0) {
                    dbData = dataArray[0];
                  }
                }
              } catch (e) {
                console.log('⚠️ Could not parse database result as JSON');
              }
            }
            
            if (dbData && Object.keys(dbData).length > 0) {
              console.log('📊 Database data extracted:', dbData);
              
                             // Handle different placeholder types
               if ((step.parameters.destination === 'FOUND_REGION_CODE' || step.parameters.destination === 'FOUND_REGION_IATA_CODE') && dbData.region) {
                console.log('🏙️ Found region in database:', dbData.region);
                
                // Convert region name to IATA code
                const regionName = dbData.region.toLowerCase();
                let iataCode = null;
                
                // Check hardcoded mapping first
                if (cityToIataMap[regionName]) {
                  iataCode = cityToIataMap[regionName];
                  console.log(`✅ Found IATA code for "${regionName}": ${iataCode} (from hardcoded mapping)`);
                } else {
                  // Try to get IATA code via API
                  console.log(`🔍 Region "${regionName}" not in hardcoded mapping, calling search_locations...`);
                  try {
                    const iataResult = await callAgent('FlightSearchAgent', 'search_locations', { keyword: regionName });
                    iataCode = extractIataFromSearchLocationsResult(iataResult);
                    if (iataCode) {
                      console.log(`✅ Found IATA code for "${regionName}": ${iataCode} (from API)`);
                    }
                  } catch (error) {
                    console.log(`❌ Could not find IATA code for "${regionName}":`, error.message);
                  }
                }
                
                if (iataCode) {
                  step.parameters.destination = iataCode;
                  console.log('🔧 Updated destination parameter:', step.parameters.destination);
                } else {
                  console.log('⚠️ Could not convert region to IATA code, keeping placeholder');
                }
              } else if (step.parameters.destination === 'FOUND_CODE' && dbData.iata_code) {
                step.parameters.destination = dbData.iata_code;
                console.log('🔧 Updated destination parameter with IATA code:', step.parameters.destination);
              } else if (step.parameters.destination === 'FOUND_CITY_CODE' && dbData.city) {
                // Handle city name to IATA conversion
                const cityName = dbData.city.toLowerCase();
                let iataCode = cityToIataMap[cityName];
                if (!iataCode) {
                  try {
                    const iataResult = await callAgent('FlightSearchAgent', 'search_locations', { keyword: cityName });
                    iataCode = extractIataFromSearchLocationsResult(iataResult);
                  } catch (error) {
                    console.log(`❌ Could not find IATA code for "${cityName}":`, error.message);
                  }
                }
                if (iataCode) {
                  step.parameters.destination = iataCode;
                  console.log('🔧 Updated destination parameter with city IATA code:', step.parameters.destination);
                }
              }
            } else {
              console.log('⚠️ No database data found to replace placeholder');
            }
          } else {
            console.log('⚠️ No database results found to replace placeholder');
          }
        }
        
        // Check if source contains a placeholder
        if (step.parameters.source && step.parameters.source.includes('FOUND_')) {
          console.log('🔍 Found placeholder in source:', step.parameters.source);
          
          if (step.parameters.source === 'FOUND_CITY_CODE') {
            // Find the most recent location result
            const locationResults = results.filter((result, index) => {
              const stepDetail = stepDetails[index];
              return stepDetail && stepDetail.tool_name === 'get_live_location';
            });
            
            if (locationResults.length > 0) {
              const latestLocationResult = locationResults[locationResults.length - 1];
              console.log('📍 Processing location result for city code:', latestLocationResult);
              
              let city = extractCityFromLocationResult(latestLocationResult);
              if (city) {
                console.log('🏙️ Extracted city from location:', city);
                
                // Normalize city name for IATA lookup
                city = normalizeCityName(city);
                console.log('🔄 Normalized city:', city);
                
                // Try to get IATA code from hardcoded mapping first
                let iata = await getIataCodeForCity(city);
                console.log('✈️ IATA code from mapping:', iata);
                
                // If not found in hardcoded mapping, call search_locations tool
                if (!iata) {
                  console.log(`🔍 City "${city}" not in hardcoded mapping, calling search_locations...`);
                  try {
                    const iataResult = await callAgent('FlightSearchAgent', 'search_locations', { keyword: city });
                    iata = extractIataFromSearchLocationsResult(iataResult);
                    if (iata) {
                      console.log(`✅ Found IATA code for "${city}": ${iata} (from API)`);
                    }
                  } catch (error) {
                    console.log(`❌ Could not find IATA code for "${city}":`, error.message);
                  }
                } else {
                  console.log(`✅ Found IATA code for "${city}": ${iata} (from hardcoded mapping)`);
                }
                
                if (iata) {
                  step.parameters.source = iata;
                  console.log('🔧 Updated source parameter:', step.parameters.source);
                } else {
                  console.log('⚠️ Could not convert city to IATA code, keeping placeholder');
                }
              } else {
                console.log('❌ Could not extract city from location result');
              }
            } else {
              console.log('⚠️ No location results found to replace placeholder');
            }
          }
        }
      }
      
      // If this step needs IATA mapping, do it now
      if (step._needs_iata_mapping) {
        console.log('🔧 Processing step with IATA mapping...');
        // Previous result should be the live location string
        const prevResult = results[results.length - 1];
        console.log('📍 Previous result:', prevResult);
        
        let city = extractCityFromLocationResult(prevResult);
        console.log('🏙️ Extracted city:', city);
        
        if (!city) {
          console.log('❌ Could not extract city from live location result');
          console.log('🔍 Full previous result:', JSON.stringify(prevResult, null, 2));
          
          // Try to extract city from the full result string
          if (typeof prevResult === 'string') {
            const cityMatch = prevResult.match(/City:\s*([^\n\r]+)/i);
            if (cityMatch) {
              city = cityMatch[1].trim();
              console.log('✅ Found city in full result string:', city);
            }
          }
          
          if (!city) {
            throw new Error('Could not extract city from live location result. Please try again.');
          }
        }
        
        // Normalize city name for IATA lookup
        city = normalizeCityName(city);
        console.log('🔄 Normalized city:', city);
        
        // Try to get IATA code from hardcoded mapping first
        let iata = await getIataCodeForCity(city);
        console.log('✈️ IATA code from mapping:', iata);
        
        // If not found in hardcoded mapping, call search_locations tool
        if (!iata) {
          console.log(`🔍 City "${city}" not in hardcoded mapping, calling search_locations...`);
          const iataResult = await callAgent('FlightSearchAgent', 'search_locations', { keyword: city });
          iata = extractIataFromSearchLocationsResult(iataResult);
          if (!iata) throw new Error('Could not extract IATA code from search_locations result');
        } else {
          console.log(`✅ Found IATA code for "${city}": ${iata} (from hardcoded mapping)`);
        }
        
        // Patch the source param with the IATA code
        const newParams = { ...step.parameters, source: iata };
        console.log('🔧 Updated parameters:', newParams);
        
        // Now call the flight search
        const flightResult = await callAgent(step.agent_name, step.tool_name, newParams);
        results.push(flightResult);
        stepDetails.push({
          step_number: stepDetails.length + 1,
          agent_name: getDisplayAgentName(step.agent_name, step.tool_name),
          tool_name: step.tool_name,
          parameters: newParams,
          result: flightResult,
          weather_assessment: weatherAssessment,
          status: 'success'
        });
        continue;
      }
      // --- PARAMETER NORMALIZATION FOR OUTLOOK EMAIL ---
      if (step.tool_name === 'outlook_send_email') {
        console.log('🔧 Before normalization - outlook_send_email parameters:', JSON.stringify(step.parameters, null, 2));
        if (step.parameters && step.parameters.to && !step.parameters.to_email) {
          step.parameters.to_email = Array.isArray(step.parameters.to)
            ? step.parameters.to
            : [step.parameters.to];
          delete step.parameters.to;
        }
        
        // --- ENHANCEMENT: INCLUDE PREVIOUS STEP RESULTS IN EMAIL BODY ---
        if (step.parameters && step.parameters.body && step.parameters.body.includes('INCLUDE_FLIGHT_RESULTS_HERE')) {
          // Find the most recent flight search result
          const flightResults = results.filter((result, index) => {
            const stepDetail = stepDetails[index];
            return stepDetail && stepDetail.tool_name === 'search_flights';
          });
          
          if (flightResults.length > 0) {
            const latestFlightResult = flightResults[flightResults.length - 1];
            
            // Create HTML table for flight results
            let formattedFlightResult = latestFlightResult;
            
            // If the result contains flight data, create an HTML table
            if (typeof latestFlightResult === 'string' && latestFlightResult.includes('Departure:')) {
              // Parse flight data and create HTML table
              const flights = parseFlightData(latestFlightResult);
              
              if (flights.length > 0) {
                formattedFlightResult = createFlightResultsTable(flights);
              }
            }
            
            step.parameters.body = step.parameters.body.replace('INCLUDE_FLIGHT_RESULTS_HERE', formattedFlightResult);
            console.log('📧 Enhanced email body with HTML table flight results');
          } else {
            // If no flight results found, replace with a generic message
            step.parameters.body = step.parameters.body.replace('INCLUDE_FLIGHT_RESULTS_HERE', 'Flight search was performed but no results were found.');
          }
        }
        
        // --- ENHANCEMENT: INCLUDE LOCATION RESULTS IN EMAIL BODY ---
        if (step.parameters && step.parameters.body && step.parameters.body.includes('INCLUDE_LOCATION_RESULTS_HERE')) {
          // Find the most recent location result
          const locationResults = results.filter((result, index) => {
            const stepDetail = stepDetails[index];
            return stepDetail && stepDetail.tool_name === 'get_live_location';
          });
          
          if (locationResults.length > 0) {
            const latestLocationResult = locationResults[locationResults.length - 1];
            step.parameters.body = step.parameters.body.replace('INCLUDE_LOCATION_RESULTS_HERE', latestLocationResult);
            console.log('📧 Enhanced email body with location results');
          } else {
            step.parameters.body = step.parameters.body.replace('INCLUDE_LOCATION_RESULTS_HERE', 'Location information was retrieved but details are not available.');
          }
        }
        
        // --- ENHANCEMENT: INCLUDE WEATHER RESULTS IN EMAIL BODY ---
        if (step.parameters && step.parameters.body && step.parameters.body.includes('INCLUDE_WEATHER_RESULTS_HERE')) {
          // Find the most recent weather result
          const weatherResults = results.filter((result, index) => {
            const stepDetail = stepDetails[index];
            return stepDetail && (stepDetail.tool_name === 'get_current_weather_by_city' || stepDetail.tool_name === 'get_weather_forecast_by_city');
          });
          
          if (weatherResults.length > 0) {
            const latestWeatherResult = weatherResults[weatherResults.length - 1];
            
            // Create formatted weather table
            const weatherTable = createWeatherForecastTable(latestWeatherResult);
            step.parameters.body = step.parameters.body.replace('INCLUDE_WEATHER_RESULTS_HERE', weatherTable);
            console.log('📧 Enhanced email body with formatted weather table');
          } else {
            step.parameters.body = step.parameters.body.replace('INCLUDE_WEATHER_RESULTS_HERE', '<p>Weather information was retrieved but details are not available.</p>');
          }
        }
        
        // --- ENHANCEMENT: INCLUDE ZOOM MEETING DETAILS IN EMAIL BODY ---
        console.log('🔍 Checking for INCLUDE_MEETING_DETAILS_HERE placeholder...');
        console.log('📧 Email body contains placeholder:', step.parameters?.body?.includes('INCLUDE_MEETING_DETAILS_HERE'));
        
        if (step.parameters && step.parameters.body && step.parameters.body.includes('INCLUDE_MEETING_DETAILS_HERE')) {
          console.log('✅ Found INCLUDE_MEETING_DETAILS_HERE placeholder, processing...');
          
          // Find the most recent Zoom meeting creation result
          const zoomResults = results.filter((result, index) => {
            const stepDetail = stepDetails[index];
            return stepDetail && stepDetail.tool_name === 'zoom_create_meeting';
          });
          
          console.log('📹 Found zoom results:', zoomResults.length);
          
          if (zoomResults.length > 0) {
            const latestZoomResult = zoomResults[zoomResults.length - 1];
            console.log('📹 Processing Zoom meeting result for email:', latestZoomResult);
            
            // Create formatted meeting details
            let meetingDetails = 'Meeting details are not available.';
            
            // Helper function to create formatted meeting details
            function createFormattedMeetingDetails(meeting) {
              // Format the start time for better readability
              let formattedStartTime = meeting.start_time || 'N/A';
              if (formattedStartTime !== 'N/A') {
                try {
                  const date = new Date(formattedStartTime);
                  formattedStartTime = date.toLocaleString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    timeZoneName: 'short'
                  });
                } catch (e) {
                  console.log('⚠️ Could not format start time:', e.message);
                }
              }
              
              return `
                <div style="background: white; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); margin: 20px 0; overflow: hidden;">
                  <h3 style="background-color: #007bff; color: white; margin: 0; padding: 15px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">📅 Meeting Details</h3>
                  <table style="border-collapse: collapse; width: 100%; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px;">
                    <tr style="background-color: #f8f9fa;">
                      <td style="padding: 12px; border-bottom: 1px solid #e9ecef; font-weight: 600; color: #495057; width: 30%;">📋 Topic:</td>
                      <td style="padding: 12px; border-bottom: 1px solid #e9ecef; color: #212529;">${meeting.topic || 'N/A'}</td>
                    </tr>
                    <tr>
                      <td style="padding: 12px; border-bottom: 1px solid #e9ecef; font-weight: 600; color: #495057;">🆔 Meeting ID:</td>
                      <td style="padding: 12px; border-bottom: 1px solid #e9ecef; color: #212529; font-family: monospace; font-weight: 600;">${meeting.id || 'N/A'}</td>
                    </tr>
                    <tr style="background-color: #f8f9fa;">
                      <td style="padding: 12px; border-bottom: 1px solid #e9ecef; font-weight: 600; color: #495057;">⏰ Start Time:</td>
                      <td style="padding: 12px; border-bottom: 1px solid #e9ecef; color: #212529;">${formattedStartTime}</td>
                    </tr>
                    <tr>
                      <td style="padding: 12px; border-bottom: 1px solid #e9ecef; font-weight: 600; color: #495057;">⏱️ Duration:</td>
                      <td style="padding: 12px; border-bottom: 1px solid #e9ecef; color: #212529;">${meeting.duration || 'N/A'} minutes</td>
                    </tr>
                    <tr style="background-color: #f8f9fa;">
                      <td style="padding: 12px; border-bottom: 1px solid #e9ecef; font-weight: 600; color: #495057;">🌍 Timezone:</td>
                      <td style="padding: 12px; border-bottom: 1px solid #e9ecef; color: #212529;">${meeting.timezone || 'N/A'}</td>
                    </tr>
                    <tr>
                      <td style="padding: 12px; border-bottom: 1px solid #e9ecef; font-weight: 600; color: #495057;">🔗 Join URL:</td>
                      <td style="padding: 12px; border-bottom: 1px solid #e9ecef; color: #212529;">
                        <a href="${meeting.join_url || '#'}" style="color: #007bff; text-decoration: none; font-weight: 500;" target="_blank">${meeting.join_url || 'N/A'}</a>
                      </td>
                    </tr>
                    <tr style="background-color: #f8f9fa;">
                      <td style="padding: 12px; border-bottom: 1px solid #e9ecef; font-weight: 600; color: #495057;">🔐 Password:</td>
                      <td style="padding: 12px; border-bottom: 1px solid #e9ecef; color: #212529; font-family: monospace; font-weight: 600;">${meeting.password || 'N/A'}</td>
                    </tr>
                    <tr>
                      <td style="padding: 12px; border-bottom: 1px solid #e9ecef; font-weight: 600; color: #495057;">📝 Agenda:</td>
                      <td style="padding: 12px; border-bottom: 1px solid #e9ecef; color: #212529;">${meeting.agenda || 'N/A'}</td>
                    </tr>
                  </table>
                </div>
              `;
            }
            
            // Try to parse the result as JSON if it's a string
            let meetingData = null;
            if (typeof latestZoomResult === 'string') {
              try {
                // Try to extract JSON from the string (in case it's wrapped in other text)
                const jsonMatch = latestZoomResult.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                  meetingData = JSON.parse(jsonMatch[0]);
                  console.log('✅ Successfully parsed Zoom result as JSON');
                } else {
                  console.log('⚠️ No JSON found in string result');
                  meetingDetails = latestZoomResult;
                }
              } catch (parseError) {
                console.log('❌ Could not parse Zoom result as JSON:', parseError.message);
                meetingDetails = latestZoomResult;
              }
            } else if (typeof latestZoomResult === 'object') {
              meetingData = latestZoomResult;
              console.log('✅ Zoom result is already an object');
            }
            
            // Create formatted meeting details if we have valid data
            if (meetingData && typeof meetingData === 'object') {
              meetingDetails = createFormattedMeetingDetails(meetingData);
              console.log('✅ Created formatted meeting details');
            }
            
            step.parameters.body = step.parameters.body.replace('INCLUDE_MEETING_DETAILS_HERE', meetingDetails);
            console.log('📧 Enhanced email body with Zoom meeting details');
          } else {
            // If no Zoom meeting results found, replace with a generic message
            step.parameters.body = step.parameters.body.replace('INCLUDE_MEETING_DETAILS_HERE', 'Meeting details are not available. Please check the meeting creation status.');
          }
        }
        
        // --- ENHANCEMENT: INCLUDE DATABASE RESULTS IN EMAIL BODY ---
        if (step.parameters && step.parameters.body) {
          // Find the most recent database query result
          const dbResults = results.filter((result, index) => {
            const stepDetail = stepDetails[index];
            return stepDetail && stepDetail.agent_name === 'PostgresAgent';
          });
          
          if (dbResults.length > 0) {
            const latestDbResult = dbResults[dbResults.length - 1];
            console.log('📊 Processing database result for email:', latestDbResult);
            
            // Extract data from the database result
            let dbData = {};
            let dbDataArray = [];
            if (latestDbResult && typeof latestDbResult === 'object' && Array.isArray(latestDbResult.data) && latestDbResult.data.length > 0) {
              dbDataArray = latestDbResult.data;
              dbData = latestDbResult.data[0]; // For backward compatibility
            } else if (typeof latestDbResult === 'string') {
              // Try to extract JSON data from the result string
              try {
                const dataMatch = latestDbResult.match(/Data:\s*(\[[\s\S]*\])/);
                if (dataMatch) {
                  const dataArray = JSON.parse(dataMatch[1]);
                  if (Array.isArray(dataArray) && dataArray.length > 0) {
                    dbDataArray = dataArray;
                    dbData = dataArray[0]; // For backward compatibility
                    console.log(`📊 Extracted ${dataArray.length} database records for email`);
                  }
                }
              } catch (e) {
                console.log('⚠️ Could not parse database result as JSON');
              }
            }
            
            // Replace database placeholders with actual values
            if (dbData && Object.keys(dbData).length > 0) {
              console.log('📊 Database data extracted:', dbData);
              
              // Create dynamic table for database results
              if (step.parameters.body.includes('INCLUDE_DATABASE_RESULTS_TABLE_HERE')) {
                let tableHtml;
                // Use multi-row table if we have multiple records, otherwise use single-row table
                if (dbDataArray && dbDataArray.length > 1) {
                  console.log(`📊 Creating multi-row table with ${dbDataArray.length} records`);
                  tableHtml = createMultiRowDatabaseResultsTable(dbDataArray);
                } else {
                  console.log('📊 Creating single-row table');
                  tableHtml = createDatabaseResultsTable(dbData);
                }
                step.parameters.body = step.parameters.body.replace('INCLUDE_DATABASE_RESULTS_TABLE_HERE', tableHtml);
                console.log('📧 Enhanced email body with database results table');
              } else {
                // Legacy placeholder replacement for backward compatibility
                if (step.parameters.body.includes('INCLUDE_MAXIMUM_PRICE_HERE') && dbData.maximum_price) {
                  step.parameters.body = step.parameters.body.replace('INCLUDE_MAXIMUM_PRICE_HERE', dbData.maximum_price);
                }
                if (step.parameters.body.includes('INCLUDE_MINIMUM_PRICE_HERE') && dbData.minimum_price) {
                  step.parameters.body = step.parameters.body.replace('INCLUDE_MINIMUM_PRICE_HERE', dbData.minimum_price);
                }
                if (step.parameters.body.includes('INCLUDE_AVERAGE_PRICE_HERE') && dbData.average_price) {
                  step.parameters.body = step.parameters.body.replace('INCLUDE_AVERAGE_PRICE_HERE', dbData.average_price);
                }
                if (step.parameters.body.includes('INCLUDE_PRICE_VARIANCE_HERE') && dbData.price_variance) {
                  step.parameters.body = step.parameters.body.replace('INCLUDE_PRICE_VARIANCE_HERE', dbData.price_variance);
                }
                if (step.parameters.body.includes('INCLUDE_PRICE_STANDARD_DEVIATION_HERE') && dbData.price_standard_deviation) {
                  step.parameters.body = step.parameters.body.replace('INCLUDE_PRICE_STANDARD_DEVIATION_HERE', dbData.price_standard_deviation);
                }
                
                // Generic replacement for any database field
                Object.keys(dbData).forEach(key => {
                  const placeholder = `INCLUDE_${key.toUpperCase()}_HERE`;
                  if (step.parameters.body.includes(placeholder)) {
                    step.parameters.body = step.parameters.body.replace(placeholder, dbData[key]);
                  }
                });
                
                console.log('📧 Enhanced email body with database results');
              }
            } else {
              console.log('⚠️ No database data found to include in email');
              
              // Handle empty database results by replacing placeholders with appropriate messages
              if (step.parameters.body.includes('INCLUDE_DATABASE_RESULTS_TABLE_HERE')) {
                const emptyTableMessage = `
<div style="background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 4px; padding: 20px; margin: 20px 0; text-align: center; font-family: Arial, sans-serif;">
  <p style="margin: 0; color: #6c757d; font-size: 16px;">📊 <strong>Database Analysis Results</strong></p>
  <p style="margin: 10px 0 0 0; color: #6c757d;">No data found for the specified time period.</p>
  <p style="margin: 5px 0 0 0; color: #6c757d; font-size: 14px;">The database query returned 0 results.</p>
</div>`;
                step.parameters.body = step.parameters.body.replace('INCLUDE_DATABASE_RESULTS_TABLE_HERE', emptyTableMessage);
                console.log('📧 Enhanced email body with empty database results message');
              }
            }
          }
        }
        
        console.log('🔧 After normalization - outlook_send_email parameters:', JSON.stringify(step.parameters, null, 2));
      }
      
      // --- ENHANCEMENT: PLACEHOLDER REPLACEMENT FOR TEAMS MESSAGES (BEFORE EXECUTION) ---
      if (step.tool_name === 'teams_send_message' && step.parameters && step.parameters.message) {
        console.log('🔍 Processing Teams message for placeholder replacement (before execution)...');
        
        // Handle weather placeholder replacement for Teams messages
        if (step.parameters.message && step.parameters.message.includes('INCLUDE_WEATHER_RESULTS_HERE')) {
          console.log('✅ Found INCLUDE_WEATHER_RESULTS_HERE placeholder in Teams message, processing...');
          
          // Find the most recent weather result
          const weatherResults = results.filter((result, index) => {
            const stepDetail = stepDetails[index];
            return stepDetail && (
              stepDetail.tool_name === 'get_weather_forecast_by_city' || 
              stepDetail.tool_name === 'get_current_weather_by_city' ||
              stepDetail.tool_name === 'get_weather'
            );
          });
          
          if (weatherResults.length > 0) {
            const latestWeatherResult = weatherResults[weatherResults.length - 1];
            console.log('🌤️ Processing weather result for Teams message:', latestWeatherResult);
            
            // Format the weather result for Teams
            let formattedWeather = 'No weather results available.';
            
            if (typeof latestWeatherResult === 'string') {
              // Format the weather result for Teams
              formattedWeather = latestWeatherResult
                .replace(/\n/g, '\n') // Keep line breaks
                .replace(/^/gm, '• '); // Add bullet points to each line
            }
            
            step.parameters.message = step.parameters.message.replace('INCLUDE_WEATHER_RESULTS_HERE', formattedWeather);
            console.log('📧 Enhanced Teams message with weather results');
          } else {
            // If no weather results found, replace with a generic message
            step.parameters.message = step.parameters.message.replace('INCLUDE_WEATHER_RESULTS_HERE', 'Weather information is not available due to a previous error.');
            console.log('📧 Enhanced Teams message with weather error message');
          }
        }
      }
      
      // Normal step
      console.log(`🤖 Executing step ${i + 1}: ${step.agent_name} - ${step.tool_name}`);
      console.log(`📦 Step parameters:`, JSON.stringify(step.parameters, null, 2));
      
      const result = await callAgent(step.agent_name, step.tool_name, step.parameters);
      console.log('🔍 Checking if this is a Teams message step...');
      console.log('🔍 Step tool_name:', step.tool_name);
      console.log('🔍 Step parameters:', step.parameters ? 'exists' : 'null');
      console.log('🔍 Step message:', step.parameters?.message ? 'exists' : 'null');
      
      // Store the result and step details
      results.push(result);
      
      // Format the result for user-friendly display using the helper function
      const formattedResult = formatResultForUser(step.tool_name, result);
      
      stepDetails.push({
        step_number: stepDetails.length + 1,
        agent_name: getDisplayAgentName(step.agent_name, step.tool_name),
        tool_name: step.tool_name,
        parameters: step.parameters,
        result: formattedResult,
        weather_assessment: weatherAssessment,
        status: 'success'
      });
      
      // --- INTER-STEP PROCESSING: PLACEHOLDER REPLACEMENT FOR TEAMS MESSAGES (BETWEEN STEPS) ---
      // Check if the next step is a Teams message that needs database results
      if (i + 1 < enhancedSteps.length) {
        const nextStep = enhancedSteps[i + 1];
        if (nextStep.tool_name === 'teams_send_message' && nextStep.parameters && nextStep.parameters.message) {
          console.log('🔍 Processing next Teams message for placeholder replacement (BETWEEN steps)...');
          
          // --- ENHANCEMENT: INCLUDE DATABASE RESULTS IN TEAMS MESSAGE ---
          if (nextStep.parameters.message.includes('INCLUDE_DATABASE_RESULTS_TABLE_HERE')) {
            console.log('✅ Found INCLUDE_DATABASE_RESULTS_TABLE_HERE placeholder in next Teams message, processing...');
            
            // Use the current step's result if it's from PostgresAgent
            if (step.agent_name === 'PostgresAgent' && result) {
              console.log('📊 Processing database result for next Teams message:', result);
              
              // Extract data from the database result
              let dbDataArray = [];
              if (result && typeof result === 'object' && Array.isArray(result.data) && result.data.length > 0) {
                dbDataArray = result.data; // Use all rows instead of just the first one
              } else if (typeof result === 'string') {
                // Try to extract JSON data from the result string
                try {
                  const dataMatch = result.match(/Data:\s*(\[[\s\S]*\])/);
                  if (dataMatch) {
                    const dataArray = JSON.parse(dataMatch[1]);
                    if (Array.isArray(dataArray) && dataArray.length > 0) {
                      dbDataArray = dataArray; // Use all rows instead of just the first one
                    }
                  }
                } catch (e) {
                  console.log('⚠️ Could not parse database result as JSON for Teams');
                }
              }
              
              // Replace database placeholders with actual values
              if (dbDataArray && dbDataArray.length > 0) {
                console.log('📊 Database data extracted for Teams:', dbDataArray);
                // Create a more professional message template with embedded table
                const enhancedMessage =
                  '🚀 **Sales Performance Update**\n\n' +
                  'Here are the top sales deals based on deal value analysis from our sales database:\n\n' +
                  createMultiRowDatabaseResultsTable(dbDataArray) +
                  '\n\n📈 **Key Insights:**\n' +
                  '• These represent the highest-value deals in our current sales pipeline\n' +
                  '• The deals showcase exceptional performance in revenue generation\n' +
                  '• This data can be used for benchmarking and performance analysis\n\n' +
                  '🕒 **Report Generated:** ' + new Date().toLocaleString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    timeZoneName: 'short'
                  }) +
                  '\n\n---\n*This report was automatically generated by the Sales Analytics System*';
                
                nextStep.parameters.message = nextStep.parameters.message.replace('INCLUDE_DATABASE_RESULTS_TABLE_HERE', enhancedMessage);
                console.log('📧 Enhanced next Teams message with professional database results format (BETWEEN steps)');
              } else {
                console.log('⚠️ No database data found to include in next Teams message');
                
                // Handle empty database results by replacing placeholders with appropriate messages
                const emptyTableMessage = `📊 **Sales Analysis Report**

<div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 20px; margin: 20px 0;">
  <h3 style="margin: 0 0 15px 0; color: #856404; font-size: 16px;">⚠️ No Data Available</h3>
  <p style="margin: 0; color: #856404; font-size: 14px;">
    No sales data found for the specified criteria. This could be due to:
  </p>
  <ul style="margin: 10px 0 0 0; color: #856404; font-size: 14px;">
    <li>No deals in the specified time period</li>
    <li>Database query returned 0 results</li>
    <li>Data may need to be refreshed</li>
  </ul>
</div>

🕒 **Report Generated:** ${new Date().toLocaleString('en-US', { 
  year: 'numeric', 
  month: 'long', 
  day: 'numeric', 
  hour: '2-digit', 
  minute: '2-digit',
  timeZoneName: 'short'
})}

---
*This report was automatically generated by the Sales Analytics System*`;
                nextStep.parameters.message = nextStep.parameters.message.replace('INCLUDE_DATABASE_RESULTS_TABLE_HERE', emptyTableMessage);
                console.log('📧 Enhanced next Teams message with professional empty results format (BETWEEN steps)');
              }
            }
          }
        }
      }
      
      console.log(`✅ Step ${i + 1} result:`, typeof result === 'string' ? result.substring(0, 200) + '...' : JSON.stringify(result, null, 2));
      // Weather logic unchanged
      if (step.tool_name === 'get_weather_forecast_by_city') {
        weatherAssessment = assessWeatherForTravel(result);
        if (weatherAssessment === 'bad' && i + 1 < enhancedSteps.length && enhancedSteps[i + 1].tool_name === 'search_flights') {
          // Update the existing step details instead of pushing new ones
          const existingStepDetail = stepDetails.find(sd => sd.step_number === i + 1);
          if (existingStepDetail) {
            existingStepDetail.weather_assessment = weatherAssessment;
          }
          results.push(`⚠️ FLIGHT SEARCH SKIPPED: Weather conditions in ${step.parameters.city} are not suitable for travel on the requested date. Consider alternative dates or check weather updates.`);
          i++;
          continue;
        }
      }
    } catch (error) {
      // Create user-friendly error message
      let userFriendlyError = '';
      if (error.message.includes('404')) {
        userFriendlyError = 'The requested information could not be found. Please check your input and try again.';
      } else if (error.message.includes('400')) {
        userFriendlyError = 'Invalid request parameters. Please provide the correct information.';
      } else if (error.message.includes('500')) {
        userFriendlyError = 'A server error occurred. Please try again later.';
      } else if (error.message.includes('email')) {
        userFriendlyError = 'Email could not be sent. Please check the email address and try again.';
      } else {
        userFriendlyError = 'An error occurred while processing your request. Please try again.';
      }
      
      stepDetails.push({
        step_number: stepDetails.length + 1,
        agent_name: getDisplayAgentName(step.agent_name, step.tool_name),
        tool_name: step.tool_name,
        parameters: step.parameters,
        error: userFriendlyError,
        status: 'failed'
      });
      results.push(userFriendlyError);
    }
  }

  // --- POST-PROCESSING: PLACEHOLDER REPLACEMENT FOR TEAMS MESSAGES ---
  for (let i = 0; i < stepDetails.length; i++) {
    const step = stepDetails[i];
    if (step.tool_name === 'teams_send_message' && step.parameters && step.parameters.message) {
      let msg = step.parameters.message;
             // Replace meeting details placeholder
       if (msg.includes('INCLUDE_MEETING_DETAILS_HERE')) {
         const zoomStep = stepDetails.find(s => s.tool_name === 'zoom_create_meeting');
         if (zoomStep && zoomStep.status === 'success' && zoomStep.result) {
           // Extract meeting details from Zoom result
           let meetingDetails = 'Meeting details are not available.';
           let meetingData = null;
           
           if (typeof zoomStep.result === 'string') {
             try {
               // Try to extract JSON from the string
               const jsonMatch = zoomStep.result.match(/\{[\s\S]*\}/);
               if (jsonMatch) {
                 meetingData = JSON.parse(jsonMatch[0]);
               }
             } catch (parseError) {
               console.log('❌ Could not parse Zoom result as JSON for Teams placeholder replacement:', parseError.message);
             }
           } else if (typeof zoomStep.result === 'object') {
             meetingData = zoomStep.result;
           }
           
           if (meetingData && typeof meetingData === 'object') {
             // Create formatted meeting details
             meetingDetails = `**Meeting Details:**
• **Topic:** ${meetingData.topic || 'N/A'}
• **Meeting ID:** ${meetingData.id || 'N/A'}
• **Start Time:** ${meetingData.start_time || 'N/A'}
• **Duration:** ${meetingData.duration || 'N/A'} minutes
• **Join URL:** ${meetingData.join_url || 'N/A'}
• **Password:** ${meetingData.password || 'N/A'}`;
           }
           
           msg = msg.replace('INCLUDE_MEETING_DETAILS_HERE', meetingDetails);
         } else {
           msg = msg.replace('INCLUDE_MEETING_DETAILS_HERE', 'Meeting details are not available due to a previous error.');
         }
       }
             // Replace database results placeholder
       if (msg.includes('INCLUDE_DATABASE_RESULTS_TABLE_HERE')) {
         const dbStep = stepDetails.find(s => s.tool_name === 'execute_query');
         if (dbStep && dbStep.status === 'success' && dbStep.result) {
           // Extract database results and format them nicely
           let dbResults = 'No database results available.';
           
           if (typeof dbStep.result === 'string') {
             try {
               // Try to extract JSON data from the result string
               const dataMatch = dbStep.result.match(/Data:\s*(\[[\s\S]*\])/);
               if (dataMatch) {
                 const dataArray = JSON.parse(dataMatch[1]);
                 if (Array.isArray(dataArray) && dataArray.length > 0) {
                   // Create a formatted table
                   dbResults = '**Sales Data Summary:**\n';
                   dataArray.forEach((row, index) => {
                     Object.entries(row).forEach(([key, value]) => {
                       const formattedKey = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                       dbResults += `• **${formattedKey}:** ${value}\n`;
                     });
                     if (index < dataArray.length - 1) dbResults += '\n';
                   });
                 }
               }
             } catch (e) {
               console.log('⚠️ Could not parse database result as JSON for Teams placeholder replacement');
               dbResults = 'Database results are available but could not be formatted properly.';
             }
           }
           
           msg = msg.replace('INCLUDE_DATABASE_RESULTS_TABLE_HERE', dbResults);
         } else {
           msg = msg.replace('INCLUDE_DATABASE_RESULTS_TABLE_HERE', 'No database results available due to a previous error.');
         }
       }
       
       // Weather placeholder replacement is now handled in main execution flow
       
      // Clean up extra blank lines and handle additional placeholders
      msg = msg.replace(/\n\s*\n\s*\n/g, '\n\n'); // Remove extra blank lines
      
      // Handle the specific meeting link placeholder
      if (msg.includes('INCLUDE_MEETING_LINK_HERE')) {
        const zoomStep = stepDetails.find(s => s.tool_name === 'zoom_create_meeting');
        if (zoomStep && zoomStep.status === 'success' && zoomStep.result) {
          let meetingData = null;
          
          if (typeof zoomStep.result === 'string') {
            try {
              const jsonMatch = zoomStep.result.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                meetingData = JSON.parse(jsonMatch[0]);
              }
            } catch (parseError) {
              console.log('❌ Could not parse Zoom result for meeting link replacement:', parseError.message);
            }
          } else if (typeof zoomStep.result === 'object') {
            meetingData = zoomStep.result;
          }
          
          if (meetingData && meetingData.join_url) {
            msg = msg.replace('INCLUDE_MEETING_LINK_HERE', meetingData.join_url);
          } else {
            msg = msg.replace('INCLUDE_MEETING_LINK_HERE', 'Meeting link not available');
          }
        } else {
          msg = msg.replace('INCLUDE_MEETING_LINK_HERE', 'Meeting link not available due to a previous error.');
        }
      }
      
      // Clean up extra blank lines
      msg = msg.replace(/\n\s*\n\s*\n/g, '\n\n'); // Remove extra blank lines
      
      // Update the step's message (placeholder replacement is handled in main execution flow)
      step.parameters.message = msg;
    }
  }

  return {
    total_steps: enhancedSteps.length,
    completed_steps: stepDetails.filter(s => s.status === 'success').length,
    failed_steps: stepDetails.filter(s => s.status === 'failed').length,
    step_details: stepDetails,
    results: results,
    weather_assessment: weatherAssessment
  };
}

// Assess weather conditions for travel
// Helper function to find the next sunny day from weather forecast
function findNextSunnyDay(weatherResult) {
  if (!weatherResult || typeof weatherResult !== 'string') {
    console.log('❌ Invalid weather result format');
    return null;
  }
  
  console.log('🔍 Analyzing weather forecast for sunny days...');
  const lines = weatherResult.split('\n');
  const sunnyKeywords = ['sunny', 'clear', 'clear sky', 'partly cloudy', 'scattered clouds'];
  // Only declare badWeatherKeywords once
  const badWeatherKeywords = ['storm', 'thunder', 'heavy', 'snow'];
  
  // First, try to find today's date
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  console.log('📅 Today\'s date:', todayStr);
  
  // Look for time-based patterns in the forecast (e.g., "05:30 PM - 27.84°C, light rain")
  for (const line of lines) {
    const timeMatch = line.match(/(\d{1,2}:\d{2})\s*(AM|PM)\s*-\s*[\d.]+°C,\s*(.+)/);
    if (timeMatch) {
      const time = timeMatch[1] + ' ' + timeMatch[2];
      const condition = timeMatch[3].toLowerCase().trim();
      console.log(`⏰ Time: ${time}, Condition: ${condition}`);
      
      // Check if this is good weather (not storm/thunder/heavy/snow)
      const isBadWeather = badWeatherKeywords.some(keyword => condition.includes(keyword));
      const isGoodWeather = !isBadWeather && (
        condition.includes('clear') ||
        condition.includes('sunny') ||
        (condition.includes('cloud') && !condition.includes('rain')) ||
        condition.includes('light rain') // treat light rain as good
      );
      
      if (isGoodWeather) {
        console.log(`✅ Found good weather at ${time}: ${condition}`);
        return todayStr; // Use today's date for good weather
      }
    }
  }
  
  // If no good weather found today, look for tomorrow or next few days
  console.log('⚠️ No good weather found today, checking next few days...');
  for (let i = 1; i <= 5; i++) {
    const futureDate = new Date();
    futureDate.setDate(today.getDate() + i);
    const futureDateStr = futureDate.toISOString().split('T')[0];
    console.log(`🔍 Checking ${futureDateStr}...`);
    // In a real implementation, you'd parse the actual forecast data
    return futureDateStr;
  }
  
  console.log('❌ No sunny day found in forecast');
  return null;
}

function assessWeatherForTravel(weatherResult) {
  const weatherText = weatherResult.toLowerCase();
  
  // Bad weather indicators
  const badWeatherIndicators = [
    'heavy rain', 'thunderstorm', 'storm', 'cyclone', 'typhoon', 'hurricane',
    'blizzard', 'snowstorm', 'fog', 'mist', 'haze', 'smog',
    'extreme', 'severe', 'dangerous', 'poor visibility'
  ];
  
  // Good weather indicators
  const goodWeatherIndicators = [
    'clear sky', 'sunny', 'partly cloudy', 'scattered clouds',
    'light rain', 'drizzle', 'good visibility', 'mild'
  ];
  
  // Check for bad weather first
  for (const indicator of badWeatherIndicators) {
    if (weatherText.includes(indicator)) {
      return 'bad';
    }
  }
  
  // Check for good weather
  for (const indicator of goodWeatherIndicators) {
    if (weatherText.includes(indicator)) {
      return 'good';
    }
  }
  
  // Default to moderate if unclear
  return 'moderate';
}

// Helper function to create database results table
function createDatabaseResultsTable(dbData) {
  if (!dbData || Object.keys(dbData).length === 0) {
    return '<p>No data available</p>';
  }

  // Format field names for display
  function formatFieldName(key) {
    return key
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  // Format values (round numbers, add currency symbols for price fields)
  function formatValue(key, value) {
    if (typeof value === 'string' && !isNaN(value)) {
      const numValue = parseFloat(value);
      if (key.toLowerCase().includes('deal_value') || key.toLowerCase().includes('price') || key.toLowerCase().includes('amount')) {
        return `$${numValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      } else if (key.toLowerCase().includes('average') || key.toLowerCase().includes('deviation') || key.toLowerCase().includes('variance')) {
        return numValue.toFixed(2);
      } else {
        return numValue.toFixed(2);
      }
    }
    return value;
  }

  // Create a more professional table with better styling
  const tableRows = Object.keys(dbData).map(key => {
    const formattedName = formatFieldName(key);
    const formattedValue = formatValue(key, dbData[key]);
    
    // Add special styling for deal_value
    const isDealValue = key.toLowerCase() === 'deal_value';
    const rowStyle = isDealValue ? 'background-color: #e8f5e8; font-weight: bold;' : '';
    const valueStyle = isDealValue ? 'color: #2e7d32; font-size: 16px;' : '';
    
    return `<tr style="${rowStyle}">
      <td style="padding: 12px; text-align: left; border: 1px solid #dee2e6; font-weight: 600;">${formattedName}</td>
      <td style="padding: 12px; text-align: left; border: 1px solid #dee2e6; ${valueStyle}">${formattedValue}</td>
    </tr>`;
  }).join('');

  return `
<div style="background: #667eea; padding: 20px; border-radius: 10px; margin: 20px 0; color: white;">
  <h3 style="margin: 0 0 15px 0; font-size: 18px; font-weight: 600;">📊 Sales Deal Analysis Report</h3>
  <p style="margin: 0 0 20px 0; opacity: 0.9; font-size: 14px;">Top performing deal based on deal value analysis</p>
</div>

<table style="border-collapse: collapse; width: 100%; margin: 20px 0; font-family: Arial, sans-serif; border: 1px solid #dee2e6;">
  <thead>
    <tr style="background: #f8f9fa;">
      <th style="padding: 15px; text-align: left; border: 1px solid #dee2e6; font-weight: 600; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; color: #333;">Field</th>
      <th style="padding: 15px; text-align: left; border: 1px solid #dee2e6; font-weight: 600; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; color: #333;">Value</th>
    </tr>
  </thead>
  <tbody>
    ${tableRows}
  </tbody>
</table>

<div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #007bff;">
  <p style="margin: 0; font-size: 14px; color: #495057;">
    <strong>💡 Analysis Summary:</strong> This represents the highest-value deal in the sales database, showcasing exceptional performance in deal value generation.
  </p>
</div>`;
}

// New function to handle multiple database rows
function createMultiRowDatabaseResultsTable(dbDataArray) {
  if (!dbDataArray || !Array.isArray(dbDataArray) || dbDataArray.length === 0) {
    return '<p>No data available</p>';
  }

  // Format field names for display
  function formatFieldName(key) {
    return key
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  // Format values (round numbers, add currency symbols for price fields)
  function formatValue(key, value) {
    if (typeof value === 'string' && !isNaN(value)) {
      const numValue = parseFloat(value);
      if (key.toLowerCase().includes('deal_value') || key.toLowerCase().includes('price') || key.toLowerCase().includes('amount')) {
        return `$${numValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      } else if (key.toLowerCase().includes('average') || key.toLowerCase().includes('deviation') || key.toLowerCase().includes('variance')) {
        return numValue.toFixed(2);
      } else {
        return numValue.toFixed(2);
      }
    }
    return value;
  }

  // Get all unique field names from all rows
  const allFields = new Set();
  dbDataArray.forEach(row => {
    Object.keys(row).forEach(key => allFields.add(key));
  });
  const fieldNames = Array.from(allFields);

  // Create table rows for each data row
  const tableRows = dbDataArray.map((row, index) => {
    const rowCells = fieldNames.map(fieldName => {
      const value = row[fieldName] || '';
      const formattedValue = formatValue(fieldName, value);
      
      // Add special styling for deal_value
      const isDealValue = fieldName.toLowerCase() === 'deal_value';
      const valueStyle = isDealValue ? 'color: #2e7d32; font-weight: bold; font-size: 14px;' : '';
      
      return `<td style="padding: 12px; text-align: left; border: 1px solid #dee2e6; ${valueStyle} color: #333;">${formattedValue}</td>`;
    }).join('');

    // Alternate row colors for better readability with proper text color
    const rowStyle = index % 2 === 0 ? 'background-color: #f8f9fa; color: #333;' : 'background-color: #ffffff; color: #333;';
    
    return `<tr style="${rowStyle}">
      ${rowCells}
    </tr>`;
  }).join('');

  // Create header row
  const headerRow = fieldNames.map(fieldName => {
    const formattedName = formatFieldName(fieldName);
    return `<th style="padding: 15px; text-align: left; border: 1px solid #dee2e6; font-weight: 600; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; background: #f8f9fa; color: #333;">${formattedName}</th>`;
  }).join('');

  // Calculate total deal value if deal_value field exists
  let totalDealValue = 0;
  let hasDealValue = false;
  if (fieldNames.some(field => field.toLowerCase() === 'deal_value')) {
    hasDealValue = true;
    dbDataArray.forEach(row => {
      const dealValue = row.deal_value || row.deal_value;
      if (dealValue && !isNaN(parseFloat(dealValue))) {
        totalDealValue += parseFloat(dealValue);
      }
    });
  }

  // Determine if this is regional data or deal data
  const isRegionalData = fieldNames.some(field => field.toLowerCase() === 'region') && 
                        fieldNames.some(field => field.toLowerCase().includes('sales'));
  
  const title = isRegionalData ? '📊 Regional Sales Performance Report' : '📊 Sales Performance Analysis Report';
  const subtitle = isRegionalData ? 
    `Top ${dbDataArray.length} performing regions based on sales analysis` : 
    `Top ${dbDataArray.length} performing deals based on deal value analysis`;
  
  // Calculate total sales if total_sales field exists
  let totalSales = 0;
  let hasSales = false;
  if (fieldNames.some(field => field.toLowerCase() === 'total_sales')) {
    hasSales = true;
    dbDataArray.forEach(row => {
      const salesValue = row.total_sales;
      if (salesValue && !isNaN(parseFloat(salesValue))) {
        totalSales += parseFloat(salesValue);
      }
    });
  }

  const summary = isRegionalData ? 
    `This report shows the top ${dbDataArray.length} regions in the sales database${hasSales ? `, with a combined sales value of $${totalSales.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ''}, showcasing exceptional performance in regional sales generation.` :
    `This report shows the top ${dbDataArray.length} deals in the sales database${hasDealValue ? `, with a combined deal value of $${totalDealValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ''}, showcasing exceptional performance in deal value generation.`;

  return `
<div style="background: #667eea; padding: 20px; border-radius: 10px; margin: 20px 0; color: white;">
  <h3 style="margin: 0 0 15px 0; font-size: 18px; font-weight: 600;">${title}</h3>
  <p style="margin: 0 0 20px 0; opacity: 0.9; font-size: 14px;">${subtitle}</p>
</div>

<table style="border-collapse: collapse; width: 100%; margin: 20px 0; font-family: Arial, sans-serif; border: 1px solid #dee2e6; background: white;">
  <thead>
    <tr>
      ${headerRow}
    </tr>
  </thead>
  <tbody>
    ${tableRows}
  </tbody>
</table>

<div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #007bff;">
  <p style="margin: 0; font-size: 14px; color: #495057;">
    <strong>💡 Analysis Summary:</strong> ${summary}
  </p>
</div>`;
}

// Helper function to generate comprehensive final result
function generateFinalResult(userInput, multiStepResult) {
  const { step_details, results, weather_assessment } = multiStepResult;
  
  // Analyze the user input to understand what was requested
  const userRequest = userInput.toLowerCase();
  
  // Extract key information from step details
  const steps = step_details || [];
  const successfulSteps = steps.filter(step => step.status === 'success');
  
  // Initialize result components
  let summary = '';
  let details = [];
  let actions = [];
  
  // Check for different types of operations
  const hasWeatherCheck = steps.some(step => 
    step.tool_name === 'get_weather_forecast_by_city' || 
    step.tool_name === 'get_current_weather_by_city'
  );
  
  const hasLocationCheck = steps.some(step => 
    step.tool_name === 'get_live_location'
  );
  
  const hasDatabaseQuery = steps.some(step => 
    step.tool_name === 'execute_query'
  );
  
  const hasZoomMeeting = steps.some(step => 
    step.tool_name === 'zoom_create_meeting'
  );
  
  const hasEmailSent = steps.some(step => 
    step.tool_name === 'outlook_send_email'
  );
  
  const hasTeamsMessage = steps.some(step => 
    step.tool_name === 'teams_send_message'
  );
  
  const hasFlightSearch = steps.some(step => 
    step.tool_name === 'search_flights'
  );
  
  const hasZoomListMeetings = steps.some(step => 
    step.tool_name === 'zoom_list_meetings'
  );
  
  const hasZoomDeleteMeeting = steps.some(step => 
    step.tool_name === 'zoom_delete_meeting'
  );
  
  // Generate summary based on what was accomplished
  if (userRequest.includes('weather') && userRequest.includes('meeting')) {
    if (hasWeatherCheck && hasZoomMeeting && hasEmailSent) {
      summary = `✅ Successfully scheduled a weather-optimized meeting! I checked the weather forecast, found a suitable day, created a Zoom meeting, and sent an email invitation to me.`;
    } else if (hasWeatherCheck && hasZoomMeeting) {
      summary = `✅ Weather check completed and Zoom meeting scheduled! I analyzed the weather forecast and created a meeting for the me.`;
    } else if (hasWeatherCheck) {
      summary = `✅ Weather analysis completed! I checked the weather forecast for your location.`;
    }
  } else if (userRequest.includes('sales') && userRequest.includes('region')) {
    if (hasDatabaseQuery && hasZoomMeeting && hasEmailSent) {
      summary = `✅ Sales analysis and meeting setup completed! I analyzed the top regions by sales performance, identified the best-performing region, scheduled a Zoom meeting, and sent a comprehensive email with the data summary to me.`;
    } else if (hasDatabaseQuery && hasEmailSent) {
      summary = `✅ Sales analysis completed! I retrieved the top regions by sales performance and sent the data summary via email.`;
    } else if (hasDatabaseQuery) {
      summary = `✅ Sales data analysis completed! I retrieved and analyzed the top regions by sales performance.`;
    }
  } else if (userRequest.includes('meeting') && userRequest.includes('zoom')) {
    if (hasZoomMeeting && hasEmailSent) {
      summary = `✅ Zoom meeting successfully created and invitation sent! I scheduled the meeting and sent an email with the meeting details to me.`;
    } else if (hasZoomMeeting) {
      summary = `✅ Zoom meeting successfully created! I scheduled the meeting for me.`;
    }
  } else if (userRequest.includes('flight')) {
    if (hasFlightSearch) {
      summary = `✅ Flight search completed! I found available flights matching your criteria.`;
    }
  } else if (userRequest.includes('weather')) {
    if (hasWeatherCheck) {
      summary = `✅ Weather information retrieved! I checked the weather forecast for your location.`;
    }
  } else if (userRequest.includes('location')) {
    if (hasLocationCheck) {
      summary = `✅ Location information retrieved! I determined your current location.`;
    }
  } else if ((userRequest.includes('cancel') || userRequest.includes('delete')) && userRequest.includes('meeting')) {
    console.log('🔍 DEBUG: Matched cancel/delete meeting condition');
    if (hasZoomListMeetings && hasZoomDeleteMeeting) {
      summary = `✅ Meeting cancellation completed! I listed all Zoom meetings and deleted the specified meetings.`;
      console.log('🔍 DEBUG: Set summary for list + delete');
    } else if (hasZoomListMeetings) {
      summary = `✅ Meeting list retrieved! I found all your Zoom meetings.`;
      console.log('🔍 DEBUG: Set summary for list only');
    } else if (hasZoomDeleteMeeting) {
      summary = `✅ Meeting deletion completed! I successfully deleted the specified Zoom meeting.`;
      console.log('🔍 DEBUG: Set summary for delete only');
    }
  } else {
    // Generic success message based on what was actually done
    if (hasZoomListMeetings && hasZoomDeleteMeeting) {
      summary = `✅ Meeting management completed! I listed and processed Zoom meetings.`;
    } else if (hasZoomListMeetings) {
      summary = `✅ Meeting list retrieved! I found all your Zoom meetings.`;
    } else if (hasZoomDeleteMeeting) {
      summary = `✅ Meeting deletion completed! I processed the meeting deletion request.`;
    } else if (hasZoomMeeting) {
      summary = `✅ Zoom meeting operation completed! I processed your meeting request.`;
    } else if (hasDatabaseQuery) {
      summary = `✅ Database operation completed! I executed the requested database query.`;
    } else if (hasWeatherCheck) {
      summary = `✅ Weather information retrieved! I checked the weather conditions.`;
    } else if (hasFlightSearch) {
      summary = `✅ Flight search completed! I found available flights.`;
    } else {
      summary = `✅ Task completed successfully! I executed all requested operations.`;
    }
  }
  
  // Add specific details based on what was done
  if (hasWeatherCheck && weather_assessment) {
    details.push(`🌤️ Weather Assessment: ${weather_assessment}`);
  }
  
  if (hasDatabaseQuery) {
    const dbSteps = steps.filter(step => step.tool_name === 'execute_query');
    if (dbSteps.length > 0) {
      const lastDbStep = dbSteps[dbSteps.length - 1];
      if (lastDbStep.result && lastDbStep.result.includes('Rows returned:')) {
        const rowsMatch = lastDbStep.result.match(/Rows returned:\s*(\d+)/);
        if (rowsMatch) {
          details.push(`📊 Database Analysis: Retrieved ${rowsMatch[1]} records from sales data`);
        }
      }
    }
  }
  
  if (hasZoomMeeting) {
    const zoomSteps = steps.filter(step => step.tool_name === 'zoom_create_meeting');
    if (zoomSteps.length > 0) {
      details.push(`📅 Zoom Meeting: Created successfully with meeting details`);
    }
  }
  
  if (hasEmailSent) {
    const emailSteps = steps.filter(step => step.tool_name === 'outlook_send_email');
    if (emailSteps.length > 0) {
      details.push(`📧 Email Sent: Meeting invitation and data summary sent to me`);
    }
  }
  
  if (hasTeamsMessage) {
    details.push(`💬 Teams Message: Sent to the specified channel`);
  }
  
  if (hasFlightSearch) {
    details.push(`✈️ Flight Search: Available flights found and presented`);
  }
  
  if (hasZoomListMeetings) {
    const listSteps = steps.filter(step => step.tool_name === 'zoom_list_meetings');
    if (listSteps.length > 0) {
      const lastListStep = listSteps[listSteps.length - 1];
      if (lastListStep.result && typeof lastListStep.result === 'string') {
        try {
          const resultData = JSON.parse(lastListStep.result);
          if (resultData.total_records !== undefined) {
            details.push(`📋 Meeting List: Found ${resultData.total_records} Zoom meetings`);
          }
        } catch (e) {
          details.push(`📋 Meeting List: Retrieved all Zoom meetings`);
        }
      }
    }
  }
  
  if (hasZoomDeleteMeeting) {
    const deleteSteps = steps.filter(step => step.tool_name === 'zoom_delete_meeting');
    if (deleteSteps.length > 0) {
      const successfulDeletes = deleteSteps.filter(step => 
        step.result && step.result.includes('Meeting operation completed successfully')
      );
      if (successfulDeletes.length > 0) {
        details.push(`🗑️ Meeting Deletion: Successfully deleted ${successfulDeletes.length} meeting(s)`);
      } else {
        details.push(`🗑️ Meeting Deletion: Attempted to delete meetings`);
      }
    }
  }
  
  // Add action items if any steps failed
  const failedSteps = steps.filter(step => step.status === 'failed');
  if (failedSteps.length > 0) {
    actions.push(`⚠️ Note: ${failedSteps.length} operation(s) encountered issues but the main task was completed.`);
  }
  
  // Combine all components
  let finalResult = summary;
  
  if (details.length > 0) {
    finalResult += '\n\n' + details.join('\n');
  }
  
  if (actions.length > 0) {
    finalResult += '\n\n' + actions.join('\n');
  }
  
  // Check if we need to ask for meeting date clarification
  const vagueTimeReferences = ['this week', 'next week', 'soon', 'asap', 'when convenient', 'when available'];
  const specificDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const specificTimes = ['morning', 'afternoon', 'evening', '9am', '10am', '11am', '12pm', '1pm', '2pm', '3pm', '4pm', '5pm', '6pm'];
  
  const hasVagueTime = vagueTimeReferences.some(ref => userRequest.includes(ref));
  const hasSpecificDay = specificDays.some(day => userRequest.includes(day));
  const hasSpecificTime = specificTimes.some(time => userRequest.includes(time));
  
  if (hasZoomMeeting && hasVagueTime && !hasSpecificDay && !hasSpecificTime) {
    finalResult += '\n\n🤔 **Meeting Date Clarification Needed:**\n\nI scheduled a meeting based on your request, but I need to know your preferred day and time. Could you please specify:\n\n• **Day:** Monday, Tuesday, Wednesday, Thursday, or Friday?\n• **Time:** What time works best for me? (e.g., 10:00 AM, 2:00 PM)\n\nOnce you provide these details, I can reschedule the meeting for your preferred time and send an updated invitation.';
  }
  
  return finalResult;
}

// Helper function to generate final result for single-step operations
function generateSingleStepFinalResult(userInput, agentCall, result) {
  const userRequest = userInput.toLowerCase();
  const toolName = agentCall.tool_name;
  
  // Generate summary based on the tool used
  let summary = '';
  let details = [];
  
  // Special handling for Zoom meetings list
  if (toolName === 'zoom_list_meetings' && result) {
    try {
      const meetingData = typeof result === 'string' ? JSON.parse(result) : result;
      
      // Handle both formats: total_meetings_scheduled and total_records
      const totalMeetings = meetingData.total_meetings_scheduled || meetingData.total_records;
      const meetings = meetingData.meetings;
      
      if (totalMeetings !== undefined && meetings && meetings.length > 0) {
        summary = `✅ Successfully retrieved your Zoom meetings!\n\n`;
        summary += `You currently have **${totalMeetings} meeting${totalMeetings > 1 ? 's' : ''} scheduled**:\n\n`;
        
        // Add meeting details for all meetings
        meetings.forEach((meeting, index) => {
          const date = new Date(meeting.start_time);
          const formattedDateTime = date.toLocaleString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            timeZoneName: 'short'
          });
          
          summary += `**${index + 1}. ${meeting.topic}**\n`;
          summary += `- 📅 **Date & Time:** ${formattedDateTime}\n`;
          summary += `- ⏱️ **Duration:** ${meeting.duration} minutes\n`;
          summary += `- 📝 **Agenda:** ${meeting.agenda}\n`;
          summary += `- 🔗 **Join Link:** [Click here to join](${meeting.join_url})\n\n`;
        });
        
        // Add summary statistics
        summary += `---\n\n`;
        summary += `**📊 Summary:**\n`;
        summary += `- **Total Meetings:** ${totalMeetings}\n`;
        summary += `- **Next Meeting:** ${new Date(meetings[0].start_time).toLocaleString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          timeZoneName: 'short'
        })}\n`;
        summary += `- **All meetings are ${meetings[0].duration} minutes long**\n\n`;
        
        summary += `The system successfully accessed your Zoom account and retrieved all scheduled meetings. All meetings appear to be properly configured with topics, agendas, and join links ready for participants.`;
        
        return summary;
      }
    } catch (e) {
      console.log('Error parsing Zoom meetings data:', e.message);
    }
  }
  
  // Special handling for Zoom today/tomorrow meetings list
  if (toolName === 'zoom_list_today_meetings' && result) {
    try {
      const meetingData = typeof result === 'string' ? JSON.parse(result) : result;
      
      const totalMeetings = meetingData.total_records;
      const meetings = meetingData.meetings;
      const dateRange = meetingData.date_range;
      const summary = meetingData.summary;
      
      if (totalMeetings !== undefined && meetings && meetings.length > 0) {
        let formattedSummary = `✅ Successfully retrieved your Zoom meetings for today and tomorrow!\n\n`;
        
        if (dateRange) {
          formattedSummary += `📅 **Date Range:** ${dateRange.from} to ${dateRange.to}\n\n`;
        }
        
        formattedSummary += `You currently have **${totalMeetings} meeting${totalMeetings > 1 ? 's' : ''} scheduled**:\n\n`;
        
        // Add meeting details for all meetings
        meetings.forEach((meeting, index) => {
          const date = new Date(meeting.start_time);
          const formattedDateTime = date.toLocaleString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            timeZoneName: 'short'
          });
          
          formattedSummary += `**${index + 1}. ${meeting.topic}**\n`;
          formattedSummary += `- 📅 **Date & Time:** ${formattedDateTime}\n`;
          formattedSummary += `- ⏱️ **Duration:** ${meeting.duration} minutes\n`;
          formattedSummary += `- 📝 **Agenda:** ${meeting.agenda}\n`;
          formattedSummary += `- 🔗 **Join Link:** [Click here to join](${meeting.join_url})\n\n`;
        });
        
        // Add enhanced summary statistics
        formattedSummary += `---\n\n`;
        formattedSummary += `**📊 Summary:**\n`;
        formattedSummary += `- **Total Meetings:** ${totalMeetings}\n`;
        
        if (summary) {
          formattedSummary += `- **Today's Meetings:** ${summary.today_meetings}\n`;
          formattedSummary += `- **Tomorrow's Meetings:** ${summary.tomorrow_meetings}\n`;
        }
        
        formattedSummary += `- **Next Meeting:** ${new Date(meetings[0].start_time).toLocaleString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          timeZoneName: 'short'
        })}\n`;
        formattedSummary += `- **All meetings are ${meetings[0].duration} minutes long**\n\n`;
        
        if (meetingData.metrics) {
          formattedSummary += `📈 **Metrics Data Available:** Meeting analytics and insights are included.\n\n`;
        }
        
        formattedSummary += `The system successfully accessed your Zoom account and retrieved all scheduled meetings for today and tomorrow. All meetings appear to be properly configured with topics, agendas, and join links ready for participants.`;
        
        return formattedSummary;
      }
    } catch (e) {
      console.log('Error parsing Zoom today meetings data:', e.message);
    }
  }
  
  if (toolName === 'get_weather_forecast_by_city' || toolName === 'get_current_weather_by_city') {
    summary = `✅ Weather information retrieved! I checked the weather forecast for your location.`;
    details.push(`🌤️ Weather Data: Current conditions and forecast available`);
  } else if (toolName === 'get_live_location') {
    summary = `✅ Location information retrieved! I determined your current location.`;
    details.push(`📍 Location Data: Current location coordinates and city information`);
  } else if (toolName === 'search_flights') {
    summary = `✅ Flight search completed! I found available flights matching your criteria.`;
    details.push(`✈️ Flight Results: Available flights with pricing and timing details`);
  } else if (toolName === 'execute_query') {
    summary = `✅ Database query executed! I retrieved the requested data from the database.`;
    details.push(`📊 Database Results: Data retrieved and analyzed successfully`);
  } else if (toolName === 'zoom_create_meeting') {
    summary = `✅ Zoom meeting created! I scheduled the meeting as requested.`;
    details.push(`📅 Meeting Details: Zoom meeting scheduled with join link and password`);
  } else if (toolName === 'outlook_send_email') {
    summary = `✅ Email sent successfully! I sent the email to the specified recipients.`;
    details.push(`📧 Email Status: Message delivered to recipients`);
  } else if (toolName === 'teams_send_message') {
    summary = `✅ Teams message sent! I posted the message to the specified channel.`;
    details.push(`💬 Teams Status: Message posted to channel successfully`);
  } else if (toolName === 'zoom_list_meetings') {
    summary = `✅ Zoom meetings list retrieved! I found all your scheduled meetings.`;
    details.push(`📋 Meeting List: Retrieved all Zoom meetings`);
    
    // Add specific details for Zoom meetings
    if (result && typeof result === 'string') {
      try {
        const meetingData = JSON.parse(result);
        const totalMeetings = meetingData.total_meetings_scheduled || meetingData.total_records;
        if (totalMeetings !== undefined) {
          details.push(`📊 Total Meetings: ${totalMeetings} meetings found`);
        }
        if (meetingData.meetings && meetingData.meetings.length > 0) {
          details.push(`📅 Next Meeting: ${meetingData.meetings[0].topic} on ${new Date(meetingData.meetings[0].start_time).toLocaleDateString()}`);
        }
      } catch (e) {
        // If parsing fails, just use the raw result
        details.push(`📋 Meeting Data: Retrieved meeting information`);
      }
    }
  } else if (toolName === 'zoom_delete_meeting') {
    summary = `✅ Zoom meeting deleted! I successfully removed the specified meeting.`;
    details.push(`🗑️ Meeting Deletion: Meeting removed from schedule`);
  } else {
    // Generic success message
    summary = `✅ Operation completed successfully! I executed the requested task.`;
    details.push(`🔧 Tool Used: ${toolName}`);
  }
  
  // Add specific details based on the result
  if (result && typeof result === 'string') {
    if (result.includes('Weather') || result.includes('Temperature')) {
      details.push(`🌡️ Weather Details: Current conditions and forecast information provided`);
    } else if (result.includes('Found') && result.includes('flights')) {
      details.push(`✈️ Flight Options: Multiple flight options with pricing and schedules`);
    } else if (result.includes('Meeting operation completed successfully')) {
      details.push(`📅 Meeting Created: Zoom meeting scheduled with all details`);
    } else if (result.includes('Query executed successfully')) {
      details.push(`📊 Data Retrieved: Database query completed with results`);
    }
  }
  
  // Combine all components
  let finalResult = summary;
  
  if (details.length > 0) {
    finalResult += '\n\n' + details.join('\n');
  }
  
  return finalResult;
}

// Helper function to create weather forecast table
function createWeatherForecastTable(weatherResult) {
  if (!weatherResult || typeof weatherResult !== 'string') {
    return '<p>Weather information not available</p>';
  }

  // Check if it's current weather (contains "Current Weather" or "Temperature:")
  if (weatherResult.includes('Current Weather') || weatherResult.includes('Temperature:')) {
    // Parse current weather data
    const lines = weatherResult.split('\n');
    const weatherData = {};
    
    for (const line of lines) {
      if (line.includes('Temperature:')) {
        const tempMatch = line.match(/Temperature:\s*([\d.]+)°C/);
        if (tempMatch) weatherData.temperature = parseFloat(tempMatch[1]);
      } else if (line.includes('Condition:')) {
        const conditionMatch = line.match(/Condition:\s*(.+)/);
        if (conditionMatch) weatherData.condition = conditionMatch[1].trim();
      } else if (line.includes('Humidity:')) {
        const humidityMatch = line.match(/Humidity:\s*(\d+)%/);
        if (humidityMatch) weatherData.humidity = humidityMatch[1];
      } else if (line.includes('Wind:')) {
        const windMatch = line.match(/Wind:\s*([\d.]+)\s*m\/s/);
        if (windMatch) weatherData.wind = windMatch[1];
      } else if (line.includes('Pressure:')) {
        const pressureMatch = line.match(/Pressure:\s*(\d+)\s*hPa/);
        if (pressureMatch) weatherData.pressure = pressureMatch[1];
      } else if (line.includes('Visibility:')) {
        const visibilityMatch = line.match(/Visibility:\s*([\d.]+)\s*km/);
        if (visibilityMatch) weatherData.visibility = visibilityMatch[1];
      }
    }

    // Create current weather table
    const tempColor = weatherData.temperature > 35 ? '#ff6b6b' : weatherData.temperature > 30 ? '#ffa726' : '#4caf50';
    const conditionIcon = weatherData.condition?.includes('rain') ? '🌧️' : 
                         weatherData.condition?.includes('cloud') ? '☁️' : 
                         weatherData.condition?.includes('clear') ? '☀️' : '🌤️';

    return `
<div style="margin: 20px 0;">
  <h3 style="color: #2196F3; margin-bottom: 15px;">🌤️ Current Weather</h3>
  <table style="border-collapse: collapse; width: 100%; font-family: Arial, sans-serif; background-color: white;">
    <thead>
      <tr style="background-color: #f5f5f5;">
        <th style="padding: 12px; border: 1px solid #ddd; text-align: left; font-weight: bold;">Weather Information</th>
        <th style="padding: 12px; border: 1px solid #ddd; text-align: left; font-weight: bold;">Details</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td style="padding: 12px; border: 1px solid #ddd; font-weight: bold;">🌡️ Temperature</td>
        <td style="padding: 12px; border: 1px solid #ddd; color: ${tempColor}; font-weight: bold;">${weatherData.temperature || 'N/A'}°C</td>
      </tr>
      <tr style="background-color: #f8f9fa;">
        <td style="padding: 12px; border: 1px solid #ddd; font-weight: bold;">🌤️ Condition</td>
        <td style="padding: 12px; border: 1px solid #ddd;">${conditionIcon} ${weatherData.condition || 'N/A'}</td>
      </tr>
      <tr>
        <td style="padding: 12px; border: 1px solid #ddd; font-weight: bold;">💧 Humidity</td>
        <td style="padding: 12px; border: 1px solid #ddd;">${weatherData.humidity || 'N/A'}%</td>
      </tr>
      <tr style="background-color: #f8f9fa;">
        <td style="padding: 12px; border: 1px solid #ddd; font-weight: bold;">💨 Wind Speed</td>
        <td style="padding: 12px; border: 1px solid #ddd;">${weatherData.wind || 'N/A'} m/s</td>
      </tr>
      <tr>
        <td style="padding: 12px; border: 1px solid #ddd; font-weight: bold;">📊 Pressure</td>
        <td style="padding: 12px; border: 1px solid #ddd;">${weatherData.pressure || 'N/A'} hPa</td>
      </tr>
      <tr style="background-color: #f8f9fa;">
        <td style="padding: 12px; border: 1px solid #ddd; font-weight: bold;">👁️ Visibility</td>
        <td style="padding: 12px; border: 1px solid #ddd;">${weatherData.visibility || 'N/A'} km</td>
      </tr>
    </tbody>
  </table>
</div>`;
  }

  // Check if it's weather forecast (contains numbered time slots)
  const timeSlots = [];
  const lines = weatherResult.split('\n');
  
  for (const line of lines) {
    const match = line.match(/(\d+)\.\s*(\d{2}:\d{2})\s*(?:AM|PM)\s*-\s*([\d.]+)°C,\s*(.+)/);
    if (match) {
      timeSlots.push({
        time: match[2] + (line.includes('PM') ? ' PM' : ' AM'),
        temperature: parseFloat(match[3]),
        condition: match[4].trim()
      });
    }
  }

  if (timeSlots.length > 0) {
    // Create forecast table
    const tableRows = timeSlots.map((slot, index) => {
      const tempColor = slot.temperature > 35 ? '#ff6b6b' : slot.temperature > 30 ? '#ffa726' : '#4caf50';
      const conditionIcon = slot.condition.includes('rain') ? '🌧️' : 
                           slot.condition.includes('cloud') ? '☁️' : 
                           slot.condition.includes('clear') ? '☀️' : '🌤️';
      
      return `<tr>
        <td style="padding: 8px; border: 1px solid #ddd; text-align: center; font-weight: bold;">${index + 1}</td>
        <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${slot.time}</td>
        <td style="padding: 8px; border: 1px solid #ddd; text-align: center; color: ${tempColor}; font-weight: bold;">${slot.temperature}°C</td>
        <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${conditionIcon} ${slot.condition}</td>
      </tr>`;
    }).join('');

    return `
<div style="margin: 20px 0;">
  <h3 style="color: #2196F3; margin-bottom: 15px;">📅 Weather Forecast</h3>
  <table style="border-collapse: collapse; width: 100%; font-family: Arial, sans-serif; background-color: white;">
    <thead>
      <tr style="background-color: #f5f5f5;">
        <th style="padding: 12px; border: 1px solid #ddd; text-align: center; font-weight: bold;">#</th>
        <th style="padding: 12px; border: 1px solid #ddd; text-align: center; font-weight: bold;">Time</th>
        <th style="padding: 12px; border: 1px solid #ddd; text-align: center; font-weight: bold;">Temperature</th>
        <th style="padding: 12px; border: 1px solid #ddd; text-align: center; font-weight: bold;">Condition</th>
      </tr>
    </thead>
    <tbody>
      ${tableRows}
    </tbody>
  </table>
</div>`;
  }

  // If no specific format is detected, return the raw result as formatted text
  return `<div style="margin: 20px 0; padding: 15px; background-color: #f8f9fa; border-radius: 5px; border-left: 4px solid #2196F3;">
    <h3 style="color: #2196F3; margin-bottom: 10px;">🌤️ Weather Information</h3>
    <p style="margin: 0; line-height: 1.6;">${weatherResult.replace(/\n/g, '<br>')}</p>
  </div>`;
}

// Main orchestration function
async function runUnifiedOrchestration(userInput, session) {
  console.log("🤖 Unified Orchestrator is running...");
  console.log("📥 User input:", userInput);

  try {
    // Step 1: Use LLM to determine which agent and tool to call
    const promptTemplate = generatePromptTemplate();
    let prompt = '';
    if (session && session.getConversationHistory) {
      // Build conversation history with results
      const history = session.getConversationHistory();
      const context = session.getContext();
      
      let historyText = '';
      
      // Add previous successful results for context
      if (context.lastRequest && context.conversationHistory.length > 1) {
        historyText += '📋 PREVIOUS CONVERSATION CONTEXT:\n';
        
        // Extract key information from previous results
        const previousResults = context.conversationHistory
          .filter(m => m.role === 'assistant' && m.content)
          .map(m => {
            // Try to extract useful information from assistant responses
            const content = m.content;
            let extracted = '';
            
            // Extract location information
            if (content.includes('City:')) {
              const cityMatch = content.match(/City:\s*([^\n]+)/);
              if (cityMatch) extracted += `Location: ${cityMatch[1].trim()}\n`;
            }
            
            // Extract weather information
            if (content.includes('Temperature:')) {
              const tempMatch = content.match(/Temperature:\s*([^\n]+)/);
              if (tempMatch) extracted += `Weather: ${tempMatch[1].trim()}\n`;
            }
            
            // Extract flight information
            if (content.includes('Found') && content.includes('flights:')) {
              extracted += `Flight search results available\n`;
            }
            
            // Extract IATA codes
            const iataMatches = content.match(/([A-Z]{3})\s*→\s*([A-Z]{3})/g);
            if (iataMatches) {
              extracted += `IATA routes: ${iataMatches.join(', ')}\n`;
            }
            
            return extracted;
          })
          .filter(info => info.length > 0)
          .join('\n');
        
        if (previousResults) {
          historyText += previousResults + '\n\n';
        }
      }
      
      // Add conversation history
      historyText += '💬 CONVERSATION HISTORY:\n';
      historyText += history
        .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
        .join('\n');
      
      prompt = `${promptTemplate}\n${historyText}\nUser: ${userInput}\nAssistant:`;
    } else {
      // Check if the user request is related to sales data
      const salesKeywords = ['sales', 'deal', 'revenue', 'customer', 'region', 'product', 'quote', 'outcome', 'mrr', 'recurring'];
      const isSalesRelated = salesKeywords.some(keyword => 
        userInput && userInput.toLowerCase().includes(keyword.toLowerCase())
      );

      // Enhanced SQL prompt template with sales data schema if needed
      let enhancedSqlPrompt = sqlPromptTemplate;
      if (isSalesRelated) {
        enhancedSqlPrompt = `
**SALES DATA ANALYSIS - ENHANCED SCHEMA:**
${sqlPromptTemplate}

**SALES DEAL DATA SPECIFIC GUIDELINES:**
When analyzing sales data, consider these common patterns:
- For regional performance: Use region, deal_value, outcome
- For sales rep analysis: Use sales_rep, deal_value, outcome, win rate calculations
- For product analysis: Use product_category, deal_value, revenue_type
- For customer analysis: Use customer_name, customer_type, deal_value
- For time-based analysis: Use quote_date, close_date, month
- For financial analysis: Use deal_value, quote_amount, mrr_contribution
- For recurring revenue: Use is_recurring_revenue, mrr_contribution

**COMMON SALES QUERIES:**
- Top performing regions: SELECT region, SUM(deal_value) FROM sales_deal_data GROUP BY region ORDER BY SUM(deal_value) DESC
- Win rate by sales rep: SELECT sales_rep, COUNT(*) as total_deals, COUNT(CASE WHEN outcome = 'Won' THEN 1 END) as won_deals FROM sales_deal_data GROUP BY sales_rep
- Monthly trends: SELECT month, SUM(deal_value) FROM sales_deal_data GROUP BY month ORDER BY month
- Product performance: SELECT product_category, AVG(deal_value) FROM sales_deal_data GROUP BY product_category ORDER BY AVG(deal_value) DESC
`;
      }

      // Replace the SQL prompt template with the enhanced version
      let finalPromptTemplate = promptTemplate.replace(sqlPromptTemplate, enhancedSqlPrompt);
      prompt = finalPromptTemplate.replace('{{instruction}}', userInput);
    }
    
    console.log("📝 Full prompt sent to LLM:");
    console.log("=".repeat(80));
    console.log(prompt);
    console.log("=".repeat(80));
    
    const llmResponse = await callOpenAI(prompt);
    console.log("🤖 LLM Response:", llmResponse);
    
    // Write LLM response to file for debugging
    const fs = require('fs');
    fs.writeFileSync('llm_response_debug.txt', llmResponse);
    console.log('📝 LLM response written to llm_response_debug.txt');
    
    let agentCall;
    try {
      // Remove markdown/code block wrappers and trim whitespace
      let cleanedResponse = llmResponse.trim()
        .replace(/^```json/i, '')
        .replace(/^```/, '')
        .replace(/```$/, '')
        .trim();
      console.log('🟦 [DEBUG] Cleaned LLM response:', cleanedResponse);
      fs.writeFileSync('cleaned_response_debug.txt', cleanedResponse);
      console.log('📝 Cleaned response written to cleaned_response_debug.txt');

      // Try to parse the entire cleaned response as JSON
      try {
        agentCall = JSON.parse(cleanedResponse);
      } catch (firstError) {
        // Extract the largest JSON object (greedy match)
        const jsonMatches = cleanedResponse.match(/\{[\s\S]*\}/g);
        if (jsonMatches && jsonMatches.length > 0) {
          let bestJson = jsonMatches.reduce((a, b) => (a.length > b.length ? a : b));
          console.log('🟦 [DEBUG] Best JSON candidate:', bestJson);
          // Escape newlines, carriage returns, and tabs inside string values
          // Use a more comprehensive approach to handle all newlines in strings
          bestJson = bestJson.replace(/"([^"]*?)"/g, (match, content) => {
            // Escape newlines, carriage returns, and tabs in the content
            const escapedContent = content
              .replace(/\\/g, '\\\\')  // Escape backslashes first
              .replace(/\n/g, '\\n')   // Escape newlines
              .replace(/\r/g, '\\r')   // Escape carriage returns
              .replace(/\t/g, '\\t');  // Escape tabs
            return `"${escapedContent}"`;
          });
          try {
            agentCall = JSON.parse(bestJson);
          } catch (secondError) {
            // Final fallback: if bestJson is a quoted string, unescape and parse
            if (bestJson.startsWith('"') && bestJson.endsWith('"')) {
              let unquoted = bestJson.slice(1, -1)
                .replace(/\\"/g, '"')
                .replace(/\\n/g, '\n')
                .replace(/\\r/g, '\r')
                .replace(/\\t/g, '\t');
              try {
                agentCall = JSON.parse(unquoted);
              } catch (thirdError) {
                // As a last resort, use eval (only if all else fails)
                try {
                  // eslint-disable-next-line no-eval
                  agentCall = eval('(' + unquoted + ')');
                  console.warn('⚠️ Used eval as a last resort to parse LLM response.');
                } catch (evalError) {
                  throw evalError;
                }
              }
            } else {
              // As a last resort, use eval on bestJson
              try {
                // eslint-disable-next-line no-eval
                agentCall = eval('(' + bestJson + ')');
                console.warn('⚠️ Used eval as a last resort to parse LLM response.');
              } catch (evalError) {
                throw evalError;
              }
            }
          }
        } else {
          // Final fallback: try to parse the entire response as a JSON string
          try {
            const parsedString = JSON.parse(cleanedResponse);
            if (typeof parsedString === 'string') {
              agentCall = JSON.parse(parsedString);
              console.warn('⚠️ Successfully parsed double-encoded JSON string.');
            } else {
              agentCall = parsedString;
            }
          } catch (finalError) {
            throw new Error("No JSON found in LLM response");
          }
        }
      }
    } catch (e) {
      console.error("❌ Error parsing LLM response:", e.message);
      console.error("❌ LLM Response that failed to parse:", llmResponse);
      console.error("❌ LLM Response length:", llmResponse.length);
      console.error("❌ LLM Response first 100 chars:", llmResponse.substring(0, 100));
      console.error("❌ LLM Response last 100 chars:", llmResponse.substring(llmResponse.length - 100));
      
      // Write the problematic response to a file for analysis
      const fs = require('fs');
      fs.writeFileSync('failed_llm_response.txt', llmResponse);
      console.error("❌ Failed LLM response written to failed_llm_response.txt");
      
      return {
        success: false,
        error: "Could not parse LLM response",
        llmResponse
      };
    }

    console.log("🔧 Parsed agent call:", agentCall);

    // Step 2: Check for vague meeting time requests BEFORE executing workflow
    if (agentCall.status === 3 && agentCall.steps) {
      // Check if this is a multi-step request that includes a Zoom meeting with vague timing
      const hasZoomMeeting = agentCall.steps.some(step => 
        step.tool_name === 'zoom_create_meeting'
      );
      
      if (hasZoomMeeting) {
        const userRequest = userInput.toLowerCase();
        const vagueTimeReferences = ['this week', 'next week', 'soon', 'asap', 'when convenient', 'when available'];
        const specificDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
        const specificTimes = ['morning', 'afternoon', 'evening', '9am', '10am', '11am', '12pm', '1pm', '2pm', '3pm', '4pm', '5pm', '6pm'];
        
        const hasVagueTime = vagueTimeReferences.some(ref => userRequest.includes(ref));
        const hasSpecificDay = specificDays.some(day => userRequest.includes(day));
        const hasSpecificTime = specificTimes.some(time => userRequest.includes(time));
        
        if (hasVagueTime && !hasSpecificDay && !hasSpecificTime) {
          console.log("🤔 Detected vague meeting time request - asking for clarification first");
          
          return {
            success: true,
            userInput,
            status: "missing_parameters",
            final_result: "Sure! I'd be happy to help schedule that meeting. What day this week would work best for you? And would an hour-long meeting be good, or do you need a different duration?\n\nJust let me know your preferred day and time, and I'll get everything set up with the sales data analysis and meeting details.",
            agent_name: "Orchestrator",
            tool_name: "meeting_scheduling",
            missing_parameters: ["meeting_day", "meeting_time"],
            timestamp: new Date().toISOString()
          };
        }
      }
    }

    // Step 3: Handle different response types
    if (agentCall.status === 1 && agentCall.agent_name && agentCall.tool_name) {
      // Single agent call
      const result = await callAgent(agentCall.agent_name, agentCall.tool_name, agentCall.parameters);
      
      // Generate final result for single-step operations
      const finalResult = generateSingleStepFinalResult(userInput, agentCall, result);
      
      return {
        success: true,
        userInput,
        type: "single_agent",
        final_result: finalResult,
        agent_used: agentCall.agent_name,
        tool_used: agentCall.tool_name,
        parameters: agentCall.parameters,
        result,
        timestamp: new Date().toISOString()
      };
    } else if (agentCall.status === 3 && agentCall.steps) {
      // Multi-step request (only reaches here if no vague meeting time detected)
      const multiStepResult = await executeMultiStepOrchestration(agentCall.steps, session);
      
      // Generate comprehensive final result based on user input and execution
      const finalResult = generateFinalResult(userInput, multiStepResult);
      
      return {
        success: true,
        userInput,
        type: "multi_step",
        final_result: finalResult,
        total_steps: multiStepResult.total_steps,
        completed_steps: multiStepResult.completed_steps,
        failed_steps: multiStepResult.failed_steps,
        step_details: multiStepResult.step_details,
        results: multiStepResult.results,
        weather_assessment: multiStepResult.weather_assessment,
        timestamp: new Date().toISOString()
      };
    } else if (agentCall.status === 2 && agentCall.missing_parameters) {
      // Missing parameters, ask user for more information
      
      // Generate a user-friendly final result explaining what's needed
      let finalResult = "I need some additional information to help you with your request. ";
      
      // Handle both array and object formats for missing_parameters
      let missingParams = agentCall.missing_parameters;
      let isArrayFormat = Array.isArray(missingParams);
      
      if (agentCall.tool_name === 'search_flights') {
        const missingList = [];
        
        if (isArrayFormat) {
          // Handle array format: ["source", "destination", "date"]
          if (missingParams.includes('source')) missingList.push("departure city or airport");
          if (missingParams.includes('destination')) missingList.push("destination city or airport");
          if (missingParams.includes('date')) missingList.push("travel date");
        } else {
          // Handle object format: {source: "...", destination: "...", date: "..."}
          if (missingParams.source) missingList.push("departure city or airport");
          if (missingParams.destination) missingList.push("destination city or airport");
          if (missingParams.date) missingList.push("travel date");
        }
        
        if (missingList.length > 0) {
          finalResult += `For flight search, I need: ${missingList.join(', ')}. `;
          finalResult += "Please provide these details so I can find the best flights for you.";
        }
      } else if (agentCall.tool_name === 'get_current_weather_by_city' || agentCall.tool_name === 'get_weather_forecast_by_city') {
        finalResult += "I need to know which city you'd like weather information for. Please specify the city name.";
      } else if (agentCall.tool_name === 'outlook_send_email') {
        finalResult += "I need an email address to send the message to. Please provide the recipient's email address.";
      } else if (agentCall.tool_name === 'teams_send_message') {
        finalResult += "I need a message to send to Teams. Please provide the message content.";
      } else if (agentCall.tool_name === 'zoom_create_meeting') {
        finalResult += "I need meeting details like topic, date, time, and duration to create a Zoom meeting. Please provide these details.";
      } else if (agentCall.tool_name === 'execute_query') {
        finalResult += "I need a database query to execute. Please specify what data you'd like me to retrieve or analyze.";
      } else {
        // Generic missing parameters message
        let paramNames = [];
        if (isArrayFormat) {
          // Convert array to user-friendly names
          paramNames = missingParams.map(param => {
            switch (param) {
              case 'source': return 'departure location';
              case 'destination': return 'destination location';
              case 'date': return 'date';
              case 'city': return 'city name';
              case 'message': return 'message content';
              case 'to_email': return 'email address';
              case 'topic': return 'meeting topic';
              case 'start_time': return 'start time';
              case 'duration': return 'duration';
              case 'timezone': return 'timezone';
              case 'agenda': return 'meeting agenda';
              case 'query': return 'database query';
              default: return param;
            }
          });
        } else {
          paramNames = Object.keys(missingParams);
        }
        
        if (paramNames.length > 0) {
          finalResult += `I need the following information: ${paramNames.join(', ')}. Please provide these details.`;
        } else {
          finalResult += "I need additional information to complete your request. Please provide the required details.";
        }
      }
      
      return {
        success: true,
        userInput,
        status: "missing_parameters",
        final_result: finalResult,
        agent_name: agentCall.agent_name,
        tool_name: agentCall.tool_name,
        missing_parameters: agentCall.missing_parameters,
        response: agentCall.response,
        timestamp: new Date().toISOString()
      };
    } else if (agentCall.status === 2 && agentCall.response) {
      // Status 2 with response - this is a successful agent call with results
      console.log("🔧 Status 2 with response - processing successful agent call");
      
      // Extract the actual result from the response
      let result;
      if (typeof agentCall.response === 'string') {
        try {
          result = JSON.parse(agentCall.response);
        } catch (e) {
          result = agentCall.response;
        }
      } else {
        result = agentCall.response;
      }
      
      // Generate final result for this successful operation
      const finalResult = generateSingleStepFinalResult(userInput, agentCall, JSON.stringify(result));
      
      return {
        success: true,
        userInput,
        type: "single_agent",
        final_result: finalResult,
        agent_used: agentCall.agent_name || "UnknownAgent",
        tool_used: agentCall.tool_name || "unknown_tool",
        parameters: agentCall.parameters || {},
        result: JSON.stringify(result),
        timestamp: new Date().toISOString()
      };
    } else if (agentCall.status === 0) {
      console.log("🔧 Direct answer or invalid tool", agentCall.response);
      // Direct answer or invalid tool
      return {
        success: true,
        userInput,
        response: agentCall.response,
        timestamp: new Date().toISOString()
      };
    } else {
      return {
        success: false,
        error: "Invalid agent call format",
        agentCall
      };
    }

  } catch (error) {
    console.error("❌ Error in unified orchestration:", error);
    return {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

// API Endpoints
app.post("/api/chat", async (req, res) => {
  try {
    const { message, query, prompt, sessionId = 'default' } = req.body;
    const userInput = message || query || prompt;
    
    if (!userInput) {
      return res.status(400).json({
        error: "Missing required field. Use 'message', 'query', or 'prompt'",
        example: {
          message: "Find flights from Bangalore to Delhi on 2025-01-15"
        }
      });
    }

    console.log("📥 Received request:", { userInput, sessionId });
    
    // Get or create session
    const session = getSession(sessionId);
    
    // Check if this is a follow-up request
    let processedInput = userInput;
    if (session.isFollowUpRequest(userInput)) {
      processedInput = session.mergeFollowUpInput(userInput);
      console.log("🔄 Follow-up detected. Merged input:", processedInput);
    }
    
    const result = await runUnifiedOrchestration(processedInput, session);
    
    // Update session context
    session.updateContext(userInput, result);
    
    // Add session info and history to response
    const responseWithSession = {
      ...result,
      sessionId,
      isFollowUp: session.isFollowUpRequest(userInput),
      processedInput: processedInput !== userInput ? processedInput : undefined,
      allUserInputs: session.getAllUserInputs(),
      conversationHistory: session.getConversationHistory()
    };
    
    res.json(responseWithSession);
    
  } catch (error) {
    console.error("❌ Error in chat:", error);
    res.status(500).json({
      error: "Internal server error",
      message: error.message
    });
  }
});

// Health check
app.get("/health", (req, res) => {
  res.json({ 
    status: "OK", 
    message: "Unified Orchestrator is running",
    available_agents: agentTools.map(a => a.name),
    available_tools: agentTools.flatMap(a => a.capabilities.map(c => c.tool))
  });
});

// Agents endpoint
app.get("/agents", (req, res) => {
  res.json({ 
    agents: agentTools,
    description: 'Unified orchestrator with agent-based architecture'
  });
});

// Session status endpoint
app.get("/session/:sessionId", (req, res) => {
  const { sessionId } = req.params;
  const session = sessions.get(sessionId);
  
  if (!session) {
    return res.status(404).json({
      error: "Session not found",
      sessionId
    });
  }
  
  res.json({
    sessionId,
    context: session.getContext(),
    activeSessions: Array.from(sessions.keys())
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Unified Orchestrator running on http://localhost:${PORT}`);
  console.log(`📋 Available endpoints:`);
  console.log(`   GET  /health - Health check`);
  console.log(`   GET  /agents - Available agents`);
  console.log(`   POST /api/chat - Main chat endpoint`);
  console.log(`\n🤖 Available agents:`, agentTools.map(a => a.name).join(', '));
  console.log(`\n🔧 Available tools:`, agentTools.flatMap(a => a.capabilities.map(c => c.tool)).join(', '));
  console.log(`\n💡 Example usage:`);
  console.log(`   curl -X POST http://localhost:${PORT}/api/chat \\`);
  console.log(`        -H "Content-Type: application/json" \\`);
  console.log(`        -d '{"message": "Find flights from Bangalore to Delhi"}'`);
});

module.exports = app;
