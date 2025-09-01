// src/agents/flightSearchAgent.js
require('dotenv').config();
const express = require('express');
const axios = require('axios');
const { flightSearchTools } = require('../orchestrator/flighSearchTools');
const outlookTools = require('../orchestrator/outlookTool');
const zoomTools = require('../orchestrator/zoomTool');
const teamsTools = require('../orchestrator/teamsTool');

// Merge all tools for the agent
const allTools = [
  ...flightSearchTools,
  ...outlookTools,
  ...zoomTools,
  ...teamsTools
];

const app = express();
app.use(express.json());

class AmadeusFlightAPI {
  constructor() {
    this.baseURL = 'https://test.api.amadeus.com';
    this.accessToken = null;
    this.tokenExpiry = null;
  }

  async getAccessToken() {
    try {
      if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
        return this.accessToken;
      }
      console.log('🔐 Getting new access token...');
      const params = new URLSearchParams();
      params.append('grant_type', 'client_credentials');
      params.append('client_id', process.env.FLIGHTS_API_KEY);
      params.append('client_secret', process.env.FLIGHTS_API_SECRET);
      const response = await axios.post(`${this.baseURL}/v1/security/oauth2/token`, params, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
      this.accessToken = response.data.access_token;
      this.tokenExpiry = Date.now() + (25 * 60 * 1000);
      console.log('✅ Access token obtained');
      return this.accessToken;
    } catch (error) {
      console.error('❌ Error getting access token:', error.response?.data || error.message);
      throw new Error('Failed to authenticate with Amadeus API');
    }
  }

  async makeRequest(endpoint, params = {}) {
    try {
      const token = await this.getAccessToken();
      console.log("🔍 Amadeus API - Token:", token);
      console.log("🔍 Amadeus API - Endpoint:", `${this.baseURL}${endpoint}`);
      console.log("🔍 Amadeus API - Params:", params);
      const response = await axios.get(`${this.baseURL}${endpoint}`, {
        params,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      return response.data;
    } catch (error) {
      console.error('❌ API request failed:', error.response?.data || error.message);
      
      // Provide user-friendly error messages for common API issues
      if (error.response?.status === 500) {
        throw new Error('The flight search service is currently experiencing technical difficulties. Please try again later.');
      } else if (error.response?.status === 429) {
        throw new Error('Too many requests. Please wait a moment and try again.');
      } else if (error.response?.status === 401) {
        throw new Error('Authentication failed. Please check API credentials.');
      } else {
        throw error;
      }
    }
  }

  async searchFlights(origin, destination, departureDate, adults = 1, max = 5) {
    console.log(`🛫 Searching flights: ${origin} → ${destination} on ${departureDate}`);
    const params = {
      originLocationCode: origin,
      destinationLocationCode: destination,
      departureDate,
      adults,
      max
    };
    return await this.makeRequest('/v2/shopping/flight-offers', params);
  }

  async searchLocations(keyword, subType = 'CITY') {
    console.log(`🔍 Searching locations for: ${keyword}`);
    const params = { keyword, subType };
    try {
      return await this.makeRequest('/v1/reference-data/locations', params);
    } catch (error) {
      console.error('❌ Location search failed:', error.message);
      throw new Error(`Unable to search for location "${keyword}". The location service is currently experiencing technical difficulties. Please try again later.`);
    }
  }
}

const amadeusAPI = new AmadeusFlightAPI();

const cityToIata = {
  "bangalore": "BLR",
  "bengaluru": "BLR",
  "banglore": "BLR",
  "chennai": "MAA",
  "madras": "MAA",
  "delhi": "DEL",
  "mumbai": "BOM",
  "bombay": "BOM",
  "kolkata": "CCU",
  "calcutta": "CCU",
  "hyderabad": "HYD",
  "pune": "PNQ",
  "ahmedabad": "AMD",
  "kochi": "COK",
  "cochin": "COK",
  "trivandrum": "TRV",
  "thiruvananthapuram": "TRV"
};

function convertRelativeDate(dateStr) {
  const today = new Date();
  const input = dateStr.toLowerCase().trim();
  if (input === 'today') {
    return today.toISOString().split('T')[0];
  }
  if (input === 'tomorrow') {
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  }
  const nextDayMatch = input.match(/next\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i);
  if (nextDayMatch) {
    const dayName = nextDayMatch[1].toLowerCase();
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const targetDay = days.indexOf(dayName);
    const currentDay = today.getDay();
    let daysToAdd = targetDay - currentDay;
    if (daysToAdd <= 0) daysToAdd += 7;
    const nextDate = new Date(today);
    nextDate.setDate(today.getDate() + daysToAdd);
    return nextDate.toISOString().split('T')[0];
  }
  const daysMatch = input.match(/in\s+(\d+)\s+days?/i);
  if (daysMatch) {
    const days = parseInt(daysMatch[1]);
    const futureDate = new Date(today);
    futureDate.setDate(today.getDate() + days);
    return futureDate.toISOString().split('T')[0];
  }
  return dateStr;
}

async function resolveCityToIata(cityName) {
  if (!cityName) return null;
  const key = cityName.trim().toLowerCase();
  if (cityToIata[key]) {
    return cityToIata[key];
  }
  try {
    const result = await amadeusAPI.searchLocations(cityName, 'CITY');
    console.log("🔍 Amadeus API result:", result);
    if (result.data && result.data.length > 0) {
      return result.data[0].iataCode;
    }
  } catch (error) {
    console.log(`Could not resolve city ${cityName} via Amadeus API:`, error.message);
  }
  return cityName;
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
        if (toolSchema && toolSchema.properties && toolSchema.properties[key]) {
          parameters[key] = parsed[key];
        }
      });
    }
  } catch (e) {}
  
  // Use regex patterns for common parameter types
  if (toolSchema && toolSchema.properties && toolSchema.properties.source && !parameters.source) {
    const fromMatch = input.match(/(?:from|departing)\s+([a-zA-Z\s]+?)(?:\s+to|\s+for|$)/i);
    if (fromMatch) parameters.source = fromMatch[1].trim();
  }
  
  if (toolSchema && toolSchema.properties && toolSchema.properties.destination && !parameters.destination) {
    const toMatch = input.match(/(?:to|for|destination)\s+([a-zA-Z\s]+?)(?:\s+on|\s+date|\s+when|$)/i);
    if (toMatch) parameters.destination = toMatch[1].trim();
  }
  
  if (toolSchema && toolSchema.properties && toolSchema.properties.date && !parameters.date) {
    const dateMatch = input.match(/(?:on|date|when)\s+([\d\w\/\s-]+)/i);
    if (dateMatch) parameters.date = dateMatch[1].trim();
  }
  
  if (toolSchema && toolSchema.properties && toolSchema.properties.city && !parameters.city) {
    const cityMatch = input.match(/(?:in|for|at)\s+([a-zA-Z\s]+?)(?:\s|$|today|tomorrow)/i);
    if (cityMatch) parameters.city = cityMatch[1].trim();
  }
  
  if (toolSchema && toolSchema.properties && toolSchema.properties.keyword && !parameters.keyword) {
    const keywordMatch = input.match(/(?:search|find|lookup)\s+(?:for\s+)?([a-zA-Z\s]+)/i);
    if (keywordMatch) parameters.keyword = keywordMatch[1].trim();
  }
  
  return parameters;
}

// Generic parameter validation and enrichment
async function validateAndEnrichParameters(parameters, toolSchema) {
  const enriched = { ...parameters };
  const missing = [];
  const suggestions = [];
  const requiredParams = (toolSchema && toolSchema.required) ? toolSchema.required : [];
  // Check each required parameter
  for (const requiredParam of requiredParams) {
    if (!enriched[requiredParam]) {
      missing.push(requiredParam);
      // Generate helpful suggestions based on parameter type
      const paramDesc = toolSchema.properties[requiredParam]?.description || requiredParam;
      suggestions.push(`Please specify ${paramDesc}`);
    } else {
      // Enrich the parameter based on its type
      if (['source', 'destination'].includes(requiredParam)) {
        enriched[requiredParam] = await resolveCityToIata(enriched[requiredParam]);
      } else if (requiredParam === 'date') {
        enriched[requiredParam] = convertRelativeDate(enriched[requiredParam]);
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(enriched[requiredParam])) {
          missing.push(requiredParam);
          suggestions.push('Please specify a valid date (e.g., "on 2025-07-15", "next Monday")');
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

// Generic API caller based on tool configuration
async function callAPI(toolName, parameters) {
  let tool = allTools.find(t => t.tool === toolName);
  if (!tool) {
    throw new Error(`Tool '${toolName}' not found in configuration`);
  }
  // Validate required parameters
  const requiredParams = (tool.schema && tool.schema.required) ? tool.schema.required : [];
  for (const requiredParam of requiredParams) {
    if (!parameters[requiredParam]) {
      throw new Error(`Missing required parameter: ${requiredParam}`);
    }
  }
  
  // Call the appropriate API based on tool name
  switch (toolName) {
    case 'search_flights':
      const result = await amadeusAPI.searchFlights(
        parameters.source,
        parameters.destination,
        parameters.date
      );
      
      if (!result.data || result.data.length === 0) {
        return `No flights found from ${parameters.source} to ${parameters.destination} on ${parameters.date}.`;
      }
      
      const flights = result.data.map((flight, index) => {
        const segment = flight.itineraries[0].segments[0];
        const airline = segment.carrierCode;
        const departure = segment.departure;
        const arrival = segment.arrival;
        return `${index + 1}. ${airline} ${segment.number} | ${departure.iataCode} → ${arrival.iataCode}\nDeparture: ${departure.at} | Arrival: ${arrival.at}\nDuration: ${flight.itineraries[0].duration}\nPrice: $${flight.price.total} ${flight.price.currency}`;
      });
      
      return `Found ${result.data.length} flights:\n\n${flights.join('\n\n')}`;
      
    case 'search_locations':
      const locationResult = await amadeusAPI.searchLocations(parameters.keyword, 'CITY');
      if (!locationResult.data || locationResult.data.length === 0) {
        return `No locations found for "${parameters.keyword}".`;
      }
      
      const locations = locationResult.data.map((location, index) => {
        return `${index + 1}. ${location.name} (${location.iataCode})\nType: ${location.subType}\nCountry: ${location.address.countryName}`;
      });
      
      return `Found ${locationResult.data.length} locations:\n\n${locations.join('\n\n')}`;
      
    default:
      // For other tools, make HTTP request to their endpoint
      let fullUrl;
      if (tool.endpoint.startsWith('http')) {
        fullUrl = tool.endpoint;
      } else {
        // Construct full URL based on tool type
        if (tool.tool && tool.tool.startsWith('outlook_')) {
          fullUrl = `http://localhost:5005${tool.endpoint.replace('POST ', '')}`;
        } else if (tool.tool && tool.tool.startsWith('zoom_')) {
          fullUrl = `http://localhost:3008${tool.endpoint.replace('POST ', '')}`;
        } else if (tool.tool && tool.tool.startsWith('teams_')) {
          fullUrl = `http://localhost:7000${tool.endpoint.replace('POST ', '')}`;
        } else {
          fullUrl = `http://localhost:5002${tool.endpoint.replace('POST ', '')}`;
        }
      }
      console.log('🔧 FlightSearchAgent calling URL:', fullUrl);
      console.log('🔧 FlightSearchAgent parameters:', parameters);
      
      try {
        console.log('🔧 FlightSearchAgent making request to:', fullUrl);
        console.log('🔧 FlightSearchAgent parameters:', parameters);
        
        const response = await axios.post(fullUrl, parameters, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 10000 // 10 second timeout
        });
        
        console.log('🔧 FlightSearchAgent response status:', response.status);
        console.log('🔧 FlightSearchAgent response data:', response.data);
        
        // Handle different response formats
        if (response.data?.content?.text) {
          return response.data.content.text;
        } else if (response.data?.text) {
          return response.data.text;
        } else if (response.data?.success !== undefined) {
          // Handle Zoom API responses that return { success: true/false }
          return response.data.success ? 'Meeting operation completed successfully.' : 'Meeting operation failed.';
        } else {
          return JSON.stringify(response.data);
        }
      } catch (error) {
        console.error('❌ FlightSearchAgent API call failed:', error.message);
        
        // Create user-friendly error message
        let userFriendlyError = '';
        if (error.code === 'ECONNREFUSED') {
          userFriendlyError = 'The email service is currently unavailable. Please try again later.';
        } else if (error.response) {
          // Server responded with error status
          const errorData = error.response.data;
          const errorMessage = errorData?.error || errorData?.message || JSON.stringify(errorData);
          
          // Handle specific email errors
          if (typeof errorMessage === 'string' && (errorMessage.includes('501 5.1.5') || errorMessage.includes('RFC 2606'))) {
            userFriendlyError = 'The email address provided is not valid. Please provide a valid email address.';
          } else if (typeof errorMessage === 'string' && errorMessage.includes('recipients were rejected')) {
            userFriendlyError = 'The email could not be sent because the recipient address is invalid. Please check the email address and try again.';
          } else if (error.response.status === 404) {
            userFriendlyError = 'The requested service is not available. Please try again later.';
          } else if (error.response.status === 400) {
            // For Zoom API errors, show the specific error message
            if (errorData?.error?.message) {
              userFriendlyError = `Zoom API Error: ${errorData.error.message}`;
            } else {
              userFriendlyError = 'Invalid request parameters. Please check your input and try again.';
            }
          } else if (error.response.status === 500) {
            userFriendlyError = 'A server error occurred. Please try again later.';
          } else {
            userFriendlyError = `Request failed with status ${error.response.status}. Please try again.`;
          }
        } else if (error.request) {
          // Request was made but no response received
          userFriendlyError = 'No response received from the service. Please check if the server is running.';
        } else {
          // Something else happened
          userFriendlyError = 'An error occurred while processing your request. Please try again.';
        }
        
        throw new Error(userFriendlyError);
      }
  }
}

app.post('/a2a', async (req, res) => {
  try {
    const input = req.body.message || req.body.input || '';
    const toolName = req.body.tool || 'search_flights'; // Default to search_flights if not specified
    
    console.log('🤖 FlightSearchAgent received request:', {
      tool: toolName,
      body: req.body
    });
    
    // Find the tool configuration
    let tool = allTools.find(t => t.tool === toolName);
    if (!tool) {
      return res.json({ 
        content: { 
          text: `❌ Tool '${toolName}' not found in configuration. Available tools: ${allTools.map(t => t.tool).join(', ')}` 
        } 
      });
    }
    
    // Extract parameters from input
    let parameters = {};
    if (req.body.source || req.body.destination || req.body.date || req.body.city || req.body.keyword || 
        req.body.to_email || req.body.subject || req.body.body || req.body.to ||
        req.body.topic || req.body.agenda || req.body.start_time || req.body.duration || req.body.type || req.body.timezone ||
        req.body.meetingId || req.body.meetingUUID ||
        req.body.message || req.body.channel || req.body.priority || req.body.title || req.body.severity || req.body.reportType || req.body.content) {
      // Direct parameter call from orchestrator
      parameters = { ...req.body };
    } else {
      // Natural language input
      parameters = extractParametersFromInput(input, tool.schema);
    }
    
    // Validate required parameters
    const requiredParams = (tool.schema && tool.schema.required) ? tool.schema.required : [];
    for (const requiredParam of requiredParams) {
      if (!parameters[requiredParam]) {
        return res.json({ content: { text: `❌ Missing required parameter: ${requiredParam}` } });
      }
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
    // Ensure meetingId is a string for Zoom operations
    if (toolName === 'zoom_delete_meeting' && validation.enriched.meetingId) {
      validation.enriched.meetingId = validation.enriched.meetingId.toString();
    }
    
    const result = await callAPI(toolName, validation.enriched);
    
    return res.json({ content: { text: result } });
    
  } catch (error) {
    const errorResponse = `❌ **Error**\n\nAn error occurred: ${error.message}`;
    return res.json({ content: { text: errorResponse } });
  }
});

// Expose tool definitions for LLM/orchestrator
app.get('/tools', (req, res) => {
  res.json({ 
    tools: allTools,
    agent_type: 'flight_search',
    description: 'Flight search and booking agent with Amadeus API integration'
  });
});

// Generate prompt template for LLM tool selection
function generatePromptTemplate() {
  const currentDateTime = new Date().toISOString();
  const toolDescriptions = allTools.map(tool => {
    const requiredParams = (tool.schema && tool.schema.required) ? tool.schema.required : [];
    const optionalParams = Object.keys(tool.schema && tool.schema.properties || {}).filter(param => !requiredParams.includes(param));
    let paramDescription = '';
    if (requiredParams.length > 0) {
      paramDescription += `Required: ${requiredParams.join(', ')}`;
    }
    if (optionalParams.length > 0) {
      paramDescription += `${requiredParams.length > 0 ? '; ' : ''}Optional: ${optionalParams.join(', ')}`;
    }
    return `  • ${tool.tool || tool.name} - ${tool.description} (${paramDescription})`;
  }).join('\n');

  const fullToolsJson = JSON.stringify(allTools, null, 2);
  const availableToolNames = allTools.map(t => t.tool || t.name).join(', ');

  // Custom example for outlook_send_email with proper formatting
  const outlookExample = `  - outlook_send_email: {\n    \"to_email\": [\"recipient@example.com\"],\n    \"subject\": \"Flight Search Results\",\n    \"body\": \"Dear User,\\n\\nHere are the flight search results from BLR to DEL on 2025-07-20:\\n\\nINCLUDE_FLIGHT_RESULTS_HERE\\n\\nBest regards,\\nYour Travel Assistant\"\n  }`;
  // Custom example for zoom_create_meeting
  const zoomExample = `  - zoom_create_meeting: {\n    \"topic\": \"Flight Discussion\",\n    \"type\": 2,\n    \"start_time\": \"2025-07-20T10:00:00Z\",\n    \"duration\": 30,\n    \"timezone\": \"Asia/Kolkata\",\n    \"agenda\": \"Discussing the details of the flight from BLR to DEL.\"\n  }`;

  const toolCallExamples = allTools.map(tool => {
    if ((tool.tool || tool.name) === 'outlook_send_email') return outlookExample;
    if ((tool.tool || tool.name) === 'zoom_create_meeting') return zoomExample;
    const example = tool.example_request ? JSON.stringify(tool.example_request, null, 2) : '{}';
    return `  - ${tool.tool || tool.name}: ${example}`;
  }).join('\n');

  return `
Current system date and time: ${currentDateTime}

You have access to the following tools:
${toolDescriptions}

Full tool manifest for reference:
${fullToolsJson}

User request: {{instruction}}

INSTRUCTIONS:
- You MUST use FlightSearchAgent for all flight, Zoom, and Outlook tool calls.
- For sending email, use 'outlook_send_email' with 'to_email' as an array of recipients.
- For Zoom meetings, use 'zoom_create_meeting' with all required parameters.
- Use the exact tool names as listed below: ${availableToolNames}

EMAIL FORMATTING REQUIREMENTS:
- ⚠️ CRITICAL: When generating email bodies for outlook_send_email, you MUST ALWAYS include:
  - A polite greeting at the top (e.g., "Dear [Recipient Name]," or "Hello,")
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
- Flight results: "Dear Mula,\n\nHere are the flight search results from [source] to [destination] on [date]:\n\nINCLUDE_FLIGHT_RESULTS_HERE\n\nBest regards,\nYour Travel Assistant"
- Weather report: "Dear Team,\n\nHere is the weather report for Mumbai:\n\nINCLUDE_WEATHER_RESULTS_HERE\n\nBest regards,\nYour Weather Assistant"
- General email: "Dear User,\n\n[Your message content here]\n\nBest regards,\nYour Assistant"

Example tool calls:
${toolCallExamples}

Specific examples for common requests:
- For "search flights from X to Y": Use search_flights with source, destination, and date
- For "find IATA code for X": Use search_locations with keyword
- For "book flight": Use book_flight with flightOffer and travelerInfo
- For "flights from bangalore to delhi": Use search_flights with source: "BLR", destination: "DEL"

2. DIRECT ANSWER (if the request does not require any flight search tool):
{
  "status": 0,
  "response": "<Natural language answer to the user's request>"
}
- The "response" must contain the actual answer, not a placeholder like "Direct answer to the user's request."

3. INVALID TOOL/SYSTEM (if the user mentions a system/tool that is not listed above):
{
  "status": 0,
  "response": "No valid flight search tool found for the requested operation. Available tools: ${availableToolNames}"
}

⚠️ IMPORTANT:
- Your output MUST be a single valid JSON object.
- NEVER include anything outside the JSON object.
- NEVER use invalid or custom field names like "result", "message", "answer", etc.
- Use ONLY the tool names listed above: ${availableToolNames}
`.trim();
}

// Expose prompt template for LLM/orchestrator
app.get('/prompt-template', (req, res) => {
  res.json({ 
    prompt_template: generatePromptTemplate(),
    agent_type: 'flight_search',
    description: 'Flight search and booking agent with Amadeus API integration'
  });
});

app.listen(5002, () => {
  console.log('🤖 Flight Search Agent running on http://localhost:5002/a2a');
  console.log('�� Available tools:', allTools.map(t => t.tool).join(', '));
  console.log('🔧 Tool definitions available at: http://localhost:5002/tools');
  console.log('📝 Prompt template available at: http://localhost:5002/prompt-template');
});
