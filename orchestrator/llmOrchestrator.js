// orchestrator/llmOrchestrator.js
require("dotenv").config();
const fetch = require("node-fetch");
const { tools } = require("./tools");

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
    max_tokens: 1000,
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

async function analyzeUserIntent(userInput) {
  // Import SQL prompt template for PostgreSQL tools
  const { sqlPromptTemplate } = require('./postgressTools');
  
  // Dynamically build the system prompt based on available agents and their capabilities
  const agentList = tools.map((agent, index) => {
    const capabilitiesList = agent.capabilities.map(cap => {
      const requiredParams = cap.schema.required || [];
      const optionalParams = Object.keys(cap.schema.properties || {}).filter(param => !requiredParams.includes(param));
      
      let paramDescription = '';
      if (requiredParams.length > 0) {
        paramDescription += `Required: ${requiredParams.join(', ')}`;
      }
      if (optionalParams.length > 0) {
        paramDescription += `${requiredParams.length > 0 ? '; ' : ''}Optional: ${optionalParams.join(', ')}`;
      }
      
      return `    • ${cap.tool} - ${cap.description} (${paramDescription})`;
    }).join('\n');
    
    return `${index + 1}. ${agent.name} - ${agent.description}\n  Capabilities:\n${capabilitiesList}`;
  }).join('\n\n');

  const systemPrompt = `You are an intelligent assistant that analyzes user requests and determines which agent and tool to use based on the user's phrasing and intent.

Available Agents and their Capabilities:
${agentList}

IMPORTANT: When extracting parameters for flight search, always convert city names to their IATA airport codes (e.g., "bangalore" → "BLR", "chennai" → "MAA", "new york" → "JFK"). If you do not know the code, use the search_locations tool to look it up.

${sqlPromptTemplate}

Your task is to:
1. Analyze the user's input carefully
2. Match their phrasing to the most appropriate agent and tool
3. Extract relevant parameters from their request
4. Provide confidence level based on how well the request matches the tool

Analyze the user input and respond with ONLY a JSON object in this format:
{
  "tool": "tool_name",
  "confidence": 0.9,
  "parameters": {
    "param1": "value1",
    "param2": "value2"
  },
  "reasoning": "brief explanation of why this tool was chosen based on the user's phrasing"
}

Examples of tool matching:
- "What's the weather like in Paris?" → get_weather with city: "Paris"
- "I need flights from NYC to London on January 15th" → search_flights with source: "JFK", destination: "LHR", date: "2025-01-15"
- "Find flights from bangalore to chennai" → search_flights with source: "BLR", destination: "MAA", date: "2025-01-15" (default date)
- "Send an email to john@example.com about the meeting" → outlook_send_email with to_email: ["john@example.com"], subject: "Meeting", body: "About the meeting"
- "Where am I located?" → get_current_location with no parameters
- "Find top performing region" → execute_query with query: "SELECT region, AVG(deal_value) FROM sales_deal_data GROUP BY region ORDER BY AVG(deal_value) DESC LIMIT 1"

If no specific tool is needed or the request is general conversation, respond with:
{
  "tool": "general",
  "confidence": 0.8,
  "parameters": {},
  "reasoning": "general conversation - no specific tool needed"
}

IMPORTANT: Only respond with valid JSON. Do not include any other text.`;

  const response = await callOpenAI(userInput, systemPrompt);
  
  try {
    // Try to parse JSON response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    // Fallback to keyword-based analysis
    return fallbackIntentAnalysis(userInput);
  } catch (error) {
    console.log("⚠️ Could not parse LLM response, using fallback analysis");
    return fallbackIntentAnalysis(userInput);
  }
}

async function extractParametersWithLLM(userInput, toolName, toolSchema) {
  // Find the capability by tool name
  let capability = null;
  for (const agent of tools) {
    capability = agent.capabilities.find(cap => cap.tool === toolName);
    if (capability) break;
  }
  
  if (!capability) {
    console.log(`⚠️ Tool '${toolName}' not found in capabilities`);
    return fallbackParameterExtraction(userInput, toolName);
  }
  
  // Import SQL prompt template for PostgreSQL tools
  const { sqlPromptTemplate } = require('./postgressTools');
  
  // Check if this is a PostgreSQL tool that generates SQL queries
  const isPostgresTool = ['execute_query', 'execute_select_query'].includes(toolName);
  
  let systemPrompt = `You are a parameter extraction assistant. Extract parameters from the user's request for the tool "${toolName}".

Tool Schema:
${JSON.stringify(capability.schema, null, 2)}

User Request: "${userInput}"`;

  // Add SQL-specific instructions for PostgreSQL tools
  if (isPostgresTool) {
    systemPrompt += `

${sqlPromptTemplate}

IMPORTANT: When generating SQL queries, follow the SQL guidelines above to avoid syntax errors like duplicate GROUP BY clauses.`;
  }
  
  systemPrompt += `

Extract the parameters and respond with ONLY a JSON object containing the extracted parameters. Use reasonable defaults if parameters are not explicitly mentioned.

Example:
- If user says "weather in Paris", extract: {"city": "Paris"}
- If user says "flights from NYC to London", extract: {"source": "NYC", "destination": "London", "date": "2025-01-15"}
- If user says "send email to john@example.com", extract: {"to": "john@example.com", "subject": "Email", "body": "Email content"}
- If user says "find top performing region", extract: {"query": "SELECT region, AVG(deal_value) FROM sales_deal_data GROUP BY region ORDER BY AVG(deal_value) DESC LIMIT 1"}

Respond with ONLY valid JSON.`;

  try {
    const response = await callOpenAI(userInput, systemPrompt);
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (error) {
    console.log("⚠️ Could not extract parameters with LLM, using fallback");
  }
  
  // Fallback parameter extraction
  return fallbackParameterExtraction(userInput, toolName);
}

function fallbackParameterExtraction(userInput, toolName) {
  const input = userInput.toLowerCase();
  
  switch (toolName) {
    case "get_weather":
      const cityMatch = input.match(/(?:in|for|at)\s+([a-zA-Z\s]+?)(?:\s|$|today|tomorrow)/);
      return { city: cityMatch ? cityMatch[1].trim() : 'New York' };
      
    case "search_flights":
      const fromMatch = input.match(/(?:from|departing)\s+([a-zA-Z\s]+?)(?:\s+to|\s+for|$)/);
      const toMatch = input.match(/(?:to|for|destination)\s+([a-zA-Z\s]+?)(?:\s+on|\s+date|\s+when|$)/);
      const dateMatch = input.match(/(?:on|date|when)\s+(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4}|\w+\s+\d{1,2})/);
      return {
        source: fromMatch ? fromMatch[1].trim() : 'New York',
        destination: toMatch ? toMatch[1].trim() : 'London',
        date: dateMatch ? dateMatch[1] : '2025-01-15'
      };
      
    case "outlook_send_email":
      const emailMatch = input.match(/(?:to|send\s+to)\s+([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
      return {
        to_email: emailMatch ? [emailMatch[1]] : [],
        subject: 'Email from Orchestrator',
        body: 'This is a test email from the orchestrator.'
      };
      
    case "get_current_location":
      return {};
      
    default:
      return {};
  }
}

function fallbackIntentAnalysis(userInput) {
  const input = userInput.toLowerCase();
  
  // Weather analysis
  if (input.includes('weather') || input.includes('temperature') || input.includes('forecast')) {
    return {
      tool: "get_weather",
      confidence: 0.8,
      parameters: fallbackParameterExtraction(userInput, "get_weather"),
      reasoning: "Weather-related query detected"
    };
  }
  
  // Flight analysis
  if (input.includes('flight') || input.includes('fly') || input.includes('travel') || input.includes('ticket')) {
    const params = fallbackParameterExtraction(userInput, "search_flights");
    // If only source is provided, ask for destination and date
    if (params.source && !params.destination) {
      return {
        tool: "general",
        confidence: 0.9,
        parameters: {},
        reasoning: "Incomplete flight request - need destination and date"
      };
    }
    return {
      tool: "search_flights",
      confidence: 0.8,
      parameters: params,
      reasoning: "Flight-related query detected"
    };
  }
  
  // Email analysis
  if (input.includes('email') || input.includes('send') || input.includes('mail')) {
    return {
      tool: "outlook_send_email",
      confidence: 0.7,
      parameters: fallbackParameterExtraction(userInput, "outlook_send_email"),
      reasoning: "Email-related query detected"
    };
  }
  
  // Location analysis
  if (input.includes('location') || input.includes('where am i') || input.includes('current location')) {
    return {
      tool: "get_current_location",
      confidence: 0.9,
      parameters: {},
      reasoning: "Location request detected"
    };
  }
  
  // General conversation
  return {
    tool: "general",
    confidence: 0.8,
    parameters: {},
    reasoning: "General conversation detected"
  };
}

async function callTool(toolName, parameters) {
  console.log(`🔧 Calling tool: ${toolName} with parameters:`, parameters);
  
  // Find the capability by tool name
  let capability = null;
  let agent = null;
  
  for (const a of tools) {
    capability = a.capabilities.find(cap => cap.tool === toolName);
    if (capability) {
      agent = a;
      break;
    }
  }
  
  if (!capability) {
    throw new Error(`Tool '${toolName}' not found`);
  }
  
  console.log(`🔧 Found capability:`, capability.tool);
  console.log(`🔧 Call type:`, capability.call.type);
  
  try {
    let result;
    
    if (capability.call.type === 'function') {
      // Call the function directly
      console.log(`🔧 Calling function: ${capability.call.func.name}`);
      console.log(`🔧 Function parameters:`, parameters);
      result = await capability.call.func(parameters);
      console.log(`🔧 Function result:`, result);
    } else if (capability.call.type === 'http') {
      // Make HTTP request to endpoint
      console.log(`🔧 Making HTTP request to: ${capability.call.endpoint}`);
      const axios = require('axios');
      
      // Always include the tool name in the request body
      let parsedArgs;
      if (typeof parameters === 'string') {
        try {
          parsedArgs = JSON.parse(parameters);
        } catch {
          parsedArgs = { input: parameters };
        }
      } else {
        parsedArgs = { ...parameters };
      }
      // Add the tool name
      parsedArgs.tool = toolName;
      
      const response = await axios.post(capability.call.endpoint, parsedArgs);
      result = response.data?.content?.text || response.data?.text || JSON.stringify(response.data);
    } else {
      throw new Error(`Unknown call type: ${capability.call.type}`);
    }
    
    console.log(`✅ Tool ${toolName} result:`, result);
    
    // Parse the result if it's a JSON string from the agent
    if (typeof result === 'string') {
      try {
        const parsed = JSON.parse(result);
        // If it's the agent response format with content.text, extract the text
        if (parsed.content && parsed.content.text) {
          return parsed.content.text;
        }
        // If it's just a text field
        if (parsed.text) {
          return parsed.text;
        }
      } catch (e) {
        // If it's not JSON, return as-is
        return result;
      }
    }
    
    return result;
  } catch (error) {
    console.error(`❌ Error calling tool ${toolName}:`, error);
    return `Error calling ${toolName}: ${error.message}`;
  }
}

async function runOrchestration(userInput) {
  console.log("🤖 Orchestrator is running...");
  console.log("📥 User input:", userInput);
  try {
    // Step 1: Analyze user intent
    console.log("🔍 Analyzing user intent...");
    const intent = await analyzeUserIntent(userInput);
    console.log("🎯 Intent analysis:", intent);

    // Step 2: Improve parameter extraction if needed
    let finalParameters = intent.parameters;
    let missingParams = [];
    let capability = null;
    if (intent.tool !== "general") {
      for (const agent of tools) {
        capability = agent.capabilities.find(cap => cap.tool === intent.tool);
        if (capability) break;
      }
      if (capability) {
        // Check for missing required parameters
        const required = capability.schema.required || [];
        missingParams = required.filter(param => !finalParameters || finalParameters[param] === undefined || finalParameters[param] === null || finalParameters[param] === "");
        if (missingParams.length > 0) {
          const prompt = `To use the '${intent.tool}' tool, I need the following information: ${missingParams.map(p => `**${p}**`).join(", ")}. Please provide these details.`;
          return {
            success: false,
            userInput,
            result: prompt,
            missingParams
          };
        }
      }
    }
    if (intent.tool !== "general" && intent.confidence < 0.9) {
      console.log("🔧 Improving parameter extraction...");
      if (capability) {
        finalParameters = await extractParametersWithLLM(userInput, intent.tool, capability.schema);
        console.log("📝 Improved parameters:", finalParameters);
      }
    }
    // Step 3: Call appropriate tool or provide general response
    let result;
    if (intent.tool === "general") {
      // Use OpenAI for general conversation
      console.log("💬 Using OpenAI for general conversation...");
      result = await callOpenAI(userInput);
    } else {
      // Call the specific tool
      console.log(`🛠️ Calling tool: ${intent.tool} with parameters:`, finalParameters);
      result = await callTool(intent.tool, finalParameters);
    }
    // Step 4: Format the response
    const response = {
      success: true,
      userInput,
      result: {
        userInput,
        intent: intent.tool,
        confidence: intent.confidence,
        reasoning: intent.reasoning,
        parameters: finalParameters,
        result,
        timestamp: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    };
    console.log("✅ Final Output:\n", response);
    return response;
  } catch (error) {
    console.error("❌ Error in orchestration:", error);
    throw error;
  }
}

// Multi-step A2A orchestration with flow log
async function runA2AOrchestration(userInput) {
  console.log("🤖 A2A Orchestrator is running...");
  console.log("📥 User input:", userInput);

  // Step 1: Ask LLM for a plan (array of tool calls)
  const agentList = tools.map((agent, index) => {
    const capabilitiesList = agent.capabilities.map(cap => {
      const requiredParams = cap.schema.required || [];
      const optionalParams = Object.keys(cap.schema.properties || {}).filter(param => !requiredParams.includes(param));
      let paramDescription = '';
      if (requiredParams.length > 0) {
        paramDescription += `Required: ${requiredParams.join(', ')}`;
      }
      if (optionalParams.length > 0) {
        paramDescription += `${requiredParams.length > 0 ? '; ' : ''}Optional: ${optionalParams.join(', ')}`;
      }
      return `    • ${cap.tool} - ${cap.description} (${paramDescription})`;
    }).join('\n');
    return `${index + 1}. ${agent.name} - ${agent.description}\n  Capabilities:\n${capabilitiesList}`;
  }).join('\n\n');

  // Import SQL prompt template for PostgreSQL tools
  const { sqlPromptTemplate } = require('./postgressTools');
  
  const planningPrompt = `You are an intelligent orchestrator that creates multi-step plans for agent-to-agent communication. The user may ask for tasks that require multiple agents to work together, where one agent's output affects another agent's execution.

Available tools and agents:
${agentList}

${sqlPromptTemplate}

IMPORTANT: Use ONLY the tool names from the capabilities list below (e.g., get_weather, search_flights, get_current_location, outlook_send_email, etc.). Do NOT use agent names like WeatherAgent or FlightSearchAgent. The "tool" field in each step must be a tool name from the list.

When referencing the result of a previous step, use the exact placeholder names:
- FOUND_CITY for the city name (e.g., from get_live_location)
- FOUND_CODE for the IATA code (e.g., from search_locations)
- FOUND_NEXT_GOOD_WEATHER_DATE for the next sunny/good weather date (e.g., from weather forecast)
- FOUND_SUNNY_DAY for the next sunny day
- FOUND_GOOD_WEATHER_DATE for the next good weather date

IMPORTANT: For email addresses, extract the email from user input if provided (e.g., "send email to john@example.com" → use "john@example.com"). If no email is provided, ask the user to provide their email address. Do NOT use placeholder emails like "FOUND_EMAIL" or reserved domains like "example.com".

When the user asks for a multi-step task, analyze if it requires:
1. **Sequential execution** - steps that must happen in order
2. **Conditional execution** - steps that only happen if previous steps meet certain conditions
3. **Agent-to-agent communication** - where one agent's result determines another agent's action

Create a plan as a JSON array of tool calls. Each step should be an object with:
- tool: the tool name (from the capabilities list)
- parameters: the parameters for the tool
- condition: (optional) a condition that must be met to execute this step, based on previous step results

Examples of conditional execution:
- "if weather is good" - check if previous weather result contains words like "good", "clear", "sunny", "excellent", "scattered clouds", "partly cloudy", "fair"
- "if flights available" - check if previous flight search found results
- "if temperature < 30" - check if previous weather temperature is below 30°C
- "if weather is not bad" - check if previous weather result does not contain "storm", "heavy rain", "snow", "fog"

Example 1 - Weather then Flights:
User: "Check if the weather is good on July 18, and find available flights from Hyderabad (HYD) to Delhi (DEL) on the same day."
Plan:
[
  { "tool": "get_weather", "parameters": { "city": "Delhi", "date": "2025-07-18" } },
  { "tool": "search_flights", "parameters": { "source": "HYD", "destination": "DEL", "date": "2025-07-18" }, "condition": "if weather is good" }
]

Example 2 - Today's weather and flights:
User: "Check the weather for today and show flights from HYD to DEL."
Plan:
[
  { "tool": "get_weather", "parameters": { "city": "Delhi", "date": "2025-07-14" } },
  { "tool": "search_flights", "parameters": { "source": "HYD", "destination": "DEL", "date": "2025-07-14" } }
]

Example 3 - Location then Weather:
User: "Find my current location and then check the weather there"
Plan:
[
  { "tool": "get_live_location", "parameters": {} },
  { "tool": "get_weather", "parameters": { "city": "{{previous_result_city}}" }, "condition": "if location found" }
]

Example 4 - Database Query:
User: "Find the top performing region from sales data"
Plan:
[
  { "tool": "execute_query", "parameters": { "query": "SELECT region, AVG(deal_value) FROM sales_deal_data GROUP BY region ORDER BY AVG(deal_value) DESC LIMIT 1" } }
]

Example 5 - Email with Flight Results:
User: "Send me an email with flight options from my location to Los Angeles"
Plan:
[
  { "tool": "get_live_location", "parameters": {} },
  { "tool": "search_locations", "parameters": { "keyword": "Los Angeles" } },
  { "tool": "search_flights", "parameters": { "source": "FOUND_CODE", "destination": "LAX", "date": "2025-07-17" } }
]
Note: Email step is omitted because no email address was provided. The system should ask the user for their email address.

IMPORTANT: 
- Only output a valid JSON array of steps. Do not include any other text.
- For conditional steps, make the condition specific and checkable.
- Use the exact tool names from the available tools list.
- If the request is simple (single step), return a single-step plan.
- When generating SQL queries, follow the SQL guidelines above to avoid syntax errors.
- For email subjects and bodies, create meaningful, user-friendly content.
- If the user asks for email but doesn't provide an email address, ask them to provide their email address.
- Always provide clear, actionable information in email content.`;

  const planResponse = await callOpenAI(userInput, planningPrompt);
  console.log("🤖 LLM Plan Response:", planResponse);
  
  let plan;
  try {
    const jsonMatch = planResponse.match(/\[.*\]/s);
    if (jsonMatch) {
      plan = JSON.parse(jsonMatch[0]);
      console.log("📋 Parsed Plan:", JSON.stringify(plan, null, 2));
    } else {
      throw new Error("No plan array found in LLM response");
    }
  } catch (e) {
    console.error("❌ Error parsing LLM plan:", e.message);
    console.log("Raw plan response:", planResponse);
    return {
      success: false,
      userInput,
      error: "Could not parse LLM plan: " + e.message,
      planRaw: planResponse
    };
  }

  // Step 2: Execute each step in order, maintaining a flow log
  const flowLog = [];
  let context = {};
  let lastResult = null;
  
  console.log("🚀 Starting A2A execution with", plan.length, "steps");
  
  for (let i = 0; i < plan.length; i++) {
    const step = plan[i];
    console.log(`\n📝 Executing Step ${i + 1}:`, step.tool);
    console.log("Parameters:", step.parameters);
    if (step.condition) console.log("Condition:", step.condition);
    
    // Process parameters to handle placeholders
    let processedParameters = { ...step.parameters };
    
    // Handle date placeholders
    if (processedParameters.date) {
      if (processedParameters.date === '{{today_date}}' || processedParameters.date === 'today') {
        processedParameters.date = new Date().toISOString().split('T')[0];
        console.log("📅 Converted {{today_date}} to:", processedParameters.date);
      } else if (processedParameters.date === '{{tomorrow_date}}' || processedParameters.date === 'tomorrow') {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        processedParameters.date = tomorrow.toISOString().split('T')[0];
        console.log("📅 Converted {{tomorrow_date}} to:", processedParameters.date);
      }
    }

    // Patch placeholders like {{previous_result_city}} with actual values from context or flowLog
    Object.keys(processedParameters).forEach(key => {
      const val = processedParameters[key];
      if (typeof val === 'string' && val.startsWith('{{') && val.endsWith('}}')) {
        const placeholder = val.slice(2, -2).trim();
        // Try context first
        if (context[placeholder]) {
          processedParameters[key] = context[placeholder];
        } else {
          // Fallback: if placeholder contains 'location', try city or iata
          if (placeholder.includes('location')) {
            if (context.previous_result_city) {
              processedParameters[key] = context.previous_result_city;
            } else if (context.previous_result_iata) {
              processedParameters[key] = context.previous_result_iata;
            }
          } else {
            // Try to extract from last flowLog step result
            const lastStep = flowLog[flowLog.length - 1];
            if (lastStep && lastStep.result && typeof lastStep.result === 'object' && lastStep.result[placeholder]) {
              processedParameters[key] = lastStep.result[placeholder];
            } else if (lastStep && lastStep.result && typeof lastStep.result === 'string') {
              // Try to extract from string result using regex
              const match = lastStep.result.match(new RegExp(`${placeholder}:?\\s*([\u4e00-\u9fa5\w\s-]+)`, 'i'));
              if (match && match[1]) {
                processedParameters[key] = match[1].trim();
              }
            }
          }
        }
      }
    });
    
    // Handle special placeholders that the LLM might generate (FOUND_CITY, FOUND_CODE, etc.)
    Object.keys(processedParameters).forEach(key => {
      const val = processedParameters[key];
      if (typeof val === 'string') {
        // Handle FOUND_CITY placeholder
        if (val === 'FOUND_CITY' && context.previous_result_city) {
          processedParameters[key] = context.previous_result_city;
          console.log(`🔧 Replaced FOUND_CITY with: ${context.previous_result_city}`);
        }
        // Handle FOUND_CODE placeholder
        else if (val === 'FOUND_CODE' && context.previous_result_iata) {
          processedParameters[key] = context.previous_result_iata;
          console.log(`🔧 Replaced FOUND_CODE with: ${context.previous_result_iata}`);
        }
        // Handle FOUND_NEXT_GOOD_WEATHER_DATE placeholder
        else if (val === 'FOUND_NEXT_GOOD_WEATHER_DATE' && context.previous_result_next_good_weather_date) {
          processedParameters[key] = context.previous_result_next_good_weather_date;
          console.log(`🔧 Replaced FOUND_NEXT_GOOD_WEATHER_DATE with: ${context.previous_result_next_good_weather_date}`);
        }
        // Handle FOUND_SUNNY_DAY placeholder
        else if (val === 'FOUND_SUNNY_DAY' && context.previous_result_sunny_day) {
          processedParameters[key] = context.previous_result_sunny_day;
          console.log(`🔧 Replaced FOUND_SUNNY_DAY with: ${context.previous_result_sunny_day}`);
        }
        // Handle FOUND_GOOD_WEATHER_DATE placeholder
        else if (val === 'FOUND_GOOD_WEATHER_DATE' && context.previous_result_good_weather_date) {
          processedParameters[key] = context.previous_result_good_weather_date;
          console.log(`🔧 Replaced FOUND_GOOD_WEATHER_DATE with: ${context.previous_result_good_weather_date}`);
        }
      }
    });
    
    // Check condition if present
    if (step.condition) {
      // Simple check: if previous result contains "good" (for weather)
      if (step.condition.includes("weather is good")) {
        // More flexible weather condition checking
        const weatherKeywords = /good|clear|sunny|fine|excellent|scattered clouds|partly cloudy|overcast clouds|fair/i;
        if (!lastResult || !weatherKeywords.test(lastResult)) {
          console.log("⏭️ Skipping step - condition not met");
          console.log("Weather result:", lastResult);
          console.log("Looking for keywords:", weatherKeywords);
          flowLog.push({
            step: i + 1,
            tool: step.tool,
            parameters: processedParameters,
            condition: step.condition,
            skipped: true,
            reason: "Condition not met: weather is not good"
          });
          continue;
        }
      }
      // Add more condition checks as needed
    }
    
    // Check for missing required parameters before calling the tool
    let stepCapability = null;
    for (const agent of tools) {
      stepCapability = agent.capabilities.find(cap => cap.tool === step.tool);
      if (stepCapability) break;
    }
    if (stepCapability) {
      const required = stepCapability.schema.required || [];
      const missingParams = required.filter(param => !processedParameters || processedParameters[param] === undefined || processedParameters[param] === null || processedParameters[param] === "");
      
      // Special handling for email addresses
      if (step.tool === 'outlook_send_email' && missingParams.includes('to_email')) {
        const prompt = `I need your email address to send you the flight information. Please provide your email address (e.g., "my email is john@example.com").`;
        flowLog.push({
          step: i + 1,
          tool: step.tool,
          parameters: processedParameters,
          condition: step.condition,
          result: prompt,
          missingParams: ['to_email']
        });
        return {
          success: false,
          userInput,
          flowLog,
          finalResult: prompt,
          missingParams: ['to_email']
        };
      }
      
      if (missingParams.length > 0) {
        const prompt = `To use the '${step.tool}' tool, I need the following information: ${missingParams.map(p => `**${p}**`).join(", ")}. Please provide these details.`;
        flowLog.push({
          step: i + 1,
          tool: step.tool,
          parameters: processedParameters,
          condition: step.condition,
          result: prompt,
          missingParams
        });
        return {
          success: false,
          userInput,
          flowLog,
          finalResult: prompt,
          missingParams
        };
      }
    }
    
    // Call the tool
    console.log("🔧 Calling tool:", step.tool);
    const result = await callTool(step.tool, processedParameters);
    console.log("✅ Tool result:", typeof result === 'string' ? result.substring(0, 100) + "..." : result);

    flowLog.push({
      step: i + 1,
      tool: step.tool,
      llm_plan: step, // The original LLM plan step
      parameters: processedParameters,
      condition: step.condition,
      tool_response: result, // Raw tool response
      result // Final processed result (may be same as tool_response)
    });
    lastResult = result;
    // Optionally, update context for future steps
    context[step.tool] = result;
    // Patch context with all top-level fields from result for placeholder replacement
    if (result && typeof result === 'object' && !Array.isArray(result)) {
      Object.entries(result).forEach(([k, v]) => {
        context[`previous_result_${k}`] = v;
        context[`previous_result.${k}`] = v;
      });
      // Special handling for live location: patch city
      if (result.city) {
        context.previous_result_city = result.city;
        context['previous_result.city'] = result.city;
      }
    }
    
    // Enhanced context extraction from string results
    if (typeof result === 'string') {
      // Extract city from live location result
      if (step.tool === 'get_live_location') {
        const cityMatch = result.match(/City:\s*([^\n]+)/i);
        if (cityMatch && cityMatch[1]) {
          const city = cityMatch[1].trim();
          context.previous_result_city = city;
          context['previous_result.city'] = city;
          console.log(`🔧 Extracted city from live location: ${city}`);
        }
      }
      
      // Extract IATA code from search_locations result
      if (step.tool === 'search_locations') {
        // Look for pattern: (IATA)
        const match = result.match(/\(([A-Z]{3})\)/);
        if (match && match[1]) {
          context.previous_result_iata = match[1];
          context['previous_result.iata'] = match[1];
          console.log(`🔧 Extracted IATA code: ${match[1]}`);
        }
      }
      
      // Extract weather dates from weather forecast result
      if (step.tool === 'get_weather_forecast_by_city') {
        // Look for sunny/good weather dates
        const sunnyMatch = result.match(/(\d{4}-\d{2}-\d{2}).*?(sunny|clear|good|excellent)/i);
        if (sunnyMatch && sunnyMatch[1]) {
          context.previous_result_sunny_day = sunnyMatch[1];
          context.previous_result_good_weather_date = sunnyMatch[1];
          context.previous_result_next_good_weather_date = sunnyMatch[1];
          console.log(`🔧 Extracted sunny day: ${sunnyMatch[1]}`);
        }
      }
    }

    // --- NEW LOGIC: If user asked for flights but only search_locations was called, prompt for missing info ---
    if (
      step.tool === "search_locations" &&
      userInput.toLowerCase().includes("flight")
    ) {
      // Check if the next logical step is search_flights and if required params are missing
      // We'll use the tools config to get required params for search_flights
      let searchFlightsCap = null;
      for (const agent of tools) {
        searchFlightsCap = agent.capabilities.find(cap => cap.tool === "search_flights");
        if (searchFlightsCap) break;
      }
      if (searchFlightsCap) {
        const required = searchFlightsCap.schema.required || [];
        // Try to extract any params from userInput
        const extracted = fallbackParameterExtraction(userInput, "search_flights");
        const missingParams = required.filter(param => !extracted[param] || extracted[param] === "");
        if (missingParams.length > 0) {
          const prompt = `To search for flights, I need the following information: ${missingParams.map(p => `**${p}**`).join(", ")}. Please provide these details.`;
          flowLog.push({
            step: i + 2,
            tool: "search_flights",
            parameters: extracted,
            result: prompt,
            missingParams
          });
          return {
            success: false,
            userInput,
            flowLog,
            finalResult: prompt,
            missingParams
          };
        }
      }
    }
  }

  console.log("🎉 A2A execution completed. Flow log:", flowLog.length, "steps");
  
  // Step 3: Return the flow log and final result
  return {
    success: true,
    userInput,
    flowLog,
    finalResult: lastResult
  };
}

// Export the new function
module.exports.runA2AOrchestration = runA2AOrchestration;

// Run from CLI if called directly
if (require.main === module) {
  const readline = require("readline").createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  readline.question("💬 Ask something: ", async (question) => {
    await runOrchestration(question);
    readline.close();
  });
}

module.exports = {
  runOrchestration,
  runA2AOrchestration
};
