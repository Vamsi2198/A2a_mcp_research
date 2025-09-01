// src/agents/weatherAgent.js
require('dotenv').config();
const axios = require('axios');

class OpenWeatherAPI {
  constructor() {
    this.baseURL = 'https://api.openweathermap.org/data/2.5';
    this.apiKey = process.env.OPENWEATHER_API_KEY;
  }

  async makeRequest(endpoint, params = {}) {
    try {
      const response = await axios.get(`${this.baseURL}${endpoint}`, {
        params: {
          ...params,
          appid: this.apiKey,
          units: 'metric'
        }
      });
      return response.data;
    } catch (error) {
      console.error('❌ OpenWeather API request failed:', error.response?.data || error.message);
      throw error;
    }
  }

  async getCurrentWeather(city) {
    console.log(`🌤️ Getting current weather for: ${city}`);
    return await this.makeRequest('/weather', { q: city });
  }

  async getWeatherForecast(city) {
    console.log(`📅 Getting weather forecast for: ${city}`);
    return await this.makeRequest('/forecast', { q: city });
  }

  async getWeatherByCoordinates(lat, lon) {
    console.log(`🌍 Getting weather for coordinates: ${lat}, ${lon}`);
    return await this.makeRequest('/weather', { lat, lon });
  }
}

const weatherAPI = new OpenWeatherAPI();

// Generic parameter extraction for weather tools
function extractWeatherParameters(input, toolSchema) {
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
  
  // Use regex patterns for weather parameters
  if (toolSchema.properties.city && !parameters.city) {
    const cityMatch = input.match(/(?:in|for|at|weather\s+in)\s+([a-zA-Z\s]+?)(?:\s|$|today|tomorrow|forecast)/i);
    if (cityMatch) parameters.city = cityMatch[1].trim();
  }
  
  if (toolSchema.properties.date && !parameters.date) {
    const dateMatch = input.match(/(?:on|date|when|for)\s+([\d\w\/\s-]+)/i);
    if (dateMatch) parameters.date = dateMatch[1].trim();
  }
  
  if (toolSchema.properties.lat && !parameters.lat) {
    const latMatch = input.match(/lat(?:itude)?[:\s]+([-\d.]+)/i);
    if (latMatch) parameters.lat = parseFloat(latMatch[1]);
  }
  
  if (toolSchema.properties.lon && !parameters.lon) {
    const lonMatch = input.match(/lon(?:gitude)?[:\s]+([-\d.]+)/i);
    if (lonMatch) parameters.lon = parseFloat(lonMatch[1]);
  }
  
  return parameters;
}

// Generic parameter validation for weather tools
async function validateWeatherParameters(parameters, toolSchema) {
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
      if (['lat', 'lon'].includes(requiredParam)) {
        const value = parseFloat(enriched[requiredParam]);
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

// Generic weather API caller
async function callWeatherAPI(toolName, parameters) {
  // Call the appropriate weather API based on tool name
  switch (toolName) {
    case 'get_weather':
      const weatherData = await weatherAPI.getCurrentWeather(parameters.city);
      const weather = weatherData.weather[0];
      const main = weatherData.main;
      
      return `🌤️ **Current Weather in ${weatherData.name}**\n\n**Temperature:** ${main.temp}°C (feels like ${main.feels_like}°C)\n**Condition:** ${weather.description}\n**Humidity:** ${main.humidity}%\n**Pressure:** ${main.pressure} hPa\n**Wind:** ${weatherData.wind.speed} m/s\n**Visibility:** ${weatherData.visibility / 1000} km\n**Country:** ${weatherData.sys.country}`;
      
    case 'get_weather_forecast':
      const forecastData = await weatherAPI.getWeatherForecast(parameters.city);
      const forecastList = forecastData.list; // Use all forecast data (5 days)
      
      // Group forecasts by day
      const dailyForecasts = {};
      forecastList.forEach((item) => {
        const date = new Date(item.dt * 1000);
        const dayKey = date.toLocaleDateString('en-US', { 
          weekday: 'long', 
          month: 'short', 
          day: 'numeric' 
        });
        
        if (!dailyForecasts[dayKey]) {
          dailyForecasts[dayKey] = [];
        }
        
        dailyForecasts[dayKey].push({
          time: date.toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: true 
          }),
          temp: item.main.temp,
          description: item.weather[0].description,
          humidity: item.main.humidity,
          wind: item.wind.speed
        });
      });
      
      // Format the forecast output
      let forecastOutput = `📅 **5-Day Weather Forecast for ${forecastData.city.name}**\n\n`;
      
      Object.keys(dailyForecasts).forEach((day, dayIndex) => {
        forecastOutput += `**${day}:**\n`;
        dailyForecasts[day].forEach((forecast, index) => {
          forecastOutput += `${index + 1}. ${forecast.time} - ${forecast.temp}°C, ${forecast.description} (Humidity: ${forecast.humidity}%, Wind: ${forecast.wind} m/s)\n`;
        });
        forecastOutput += '\n';
      });
      
      return forecastOutput;
      
    case 'get_weather_by_coordinates':
      const coordData = await weatherAPI.getWeatherByCoordinates(parameters.lat, parameters.lon);
      const coordWeather = coordData.weather[0];
      const coordMain = coordData.main;
      
      return `🌍 **Weather at Coordinates (${coordData.coord.lat}, ${coordData.coord.lon})**\n\n**Location:** ${coordData.name}\n**Temperature:** ${coordMain.temp}°C (feels like ${coordMain.feels_like}°C)\n**Condition:** ${coordWeather.description}\n**Humidity:** ${coordMain.humidity}%\n**Wind:** ${coordData.wind.speed} m/s`;
      
    default:
      throw new Error(`Weather tool '${toolName}' not supported`);
  }
}

// Main weather function that can be called by the orchestrator
async function getWeather({ city, date, lat, lon, tool = 'get_weather' }) {
  try {
    let parameters = {};
    if (city) parameters.city = city;
    if (lat) parameters.lat = lat;
    if (lon) parameters.lon = lon;
    if (date) parameters.date = date;

    // Use the tool name to select the correct API
    switch (tool) {
      case 'get_current_weather_by_city':
        return await callWeatherAPI('get_weather', parameters);
      case 'get_weather_forecast_by_city':
        return await callWeatherAPI('get_weather_forecast', parameters);
      case 'get_current_weather_by_coordinates':
        return await callWeatherAPI('get_weather_by_coordinates', parameters);
      default:
        return await callWeatherAPI('get_weather', parameters);
    }
  } catch (error) {
    return `❌ **Weather Error**\n\nAn error occurred: ${error.message}`;
  }
}

// Express server setup for weather agent
const express = require('express');
const { weatherTools } = require('../orchestrator/weatherTools');

const app = express();
app.use(express.json());

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
  
  // Use regex patterns for weather parameters
  if (toolSchema.properties.city && !parameters.city) {
    const cityMatch = input.match(/(?:in|for|at|weather\s+in)\s+([a-zA-Z\s]+?)(?:\s|$|today|tomorrow|forecast)/i);
    if (cityMatch) parameters.city = cityMatch[1].trim();
  }
  
  if (toolSchema.properties.date && !parameters.date) {
    const dateMatch = input.match(/(?:on|date|when|for)\s+([\d\w\/\s-]+)/i);
    if (dateMatch) parameters.date = dateMatch[1].trim();
  }
  
  if (toolSchema.properties.lat && !parameters.lat) {
    const latMatch = input.match(/lat(?:itude)?[:\s]+([-\d.]+)/i);
    if (latMatch) parameters.lat = parseFloat(latMatch[1]);
  }
  
  if (toolSchema.properties.lon && !parameters.lon) {
    const lonMatch = input.match(/lon(?:gitude)?[:\s]+([-\d.]+)/i);
    if (lonMatch) parameters.lon = parseFloat(lonMatch[1]);
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
      if (['lat', 'lon'].includes(requiredParam)) {
        const value = parseFloat(enriched[requiredParam]);
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

// Generic API caller based on tool configuration
async function callAPI(toolName, parameters) {
  let tool = weatherTools.find(t => t.tool === toolName);
  if (!tool) {
    throw new Error(`Tool '${toolName}' not found in configuration`);
  }
  
  // Call the appropriate weather API based on tool name
  switch (toolName) {
    case 'get_current_weather_by_city':
      const weatherData = await weatherAPI.getCurrentWeather(parameters.city);
      const weather = weatherData.weather[0];
      const main = weatherData.main;
      
      return `🌤️ Current Weather in ${weatherData.name}:\nTemperature: ${main.temp}°C (feels like ${main.feels_like}°C)\nCondition: ${weather.description}\nHumidity: ${main.humidity}%\nPressure: ${main.pressure} hPa\nWind: ${weatherData.wind.speed} m/s\nVisibility: ${weatherData.visibility / 1000} km\nCountry: ${weatherData.sys.country}`;
      
    case 'get_weather_forecast_by_city':
      const forecastData = await weatherAPI.getWeatherForecast(parameters.city);
      const forecastList = forecastData.list; // Use all forecast data (5 days)
      
      // Group forecasts by day
      const dailyForecasts = {};
      forecastList.forEach((item) => {
        const date = new Date(item.dt * 1000);
        const dayKey = date.toLocaleDateString('en-US', { 
          weekday: 'long', 
          month: 'short', 
          day: 'numeric' 
        });
        
        if (!dailyForecasts[dayKey]) {
          dailyForecasts[dayKey] = [];
        }
        
        dailyForecasts[dayKey].push({
          time: date.toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: true 
          }),
          temp: item.main.temp,
          description: item.weather[0].description,
          humidity: item.main.humidity,
          wind: item.wind.speed
        });
      });
      
      // Format the forecast output
      let forecastOutput = `📅 **5-Day Weather Forecast for ${forecastData.city.name}**\n\n`;
      
      Object.keys(dailyForecasts).forEach((day, dayIndex) => {
        forecastOutput += `**${day}:**\n`;
        dailyForecasts[day].forEach((forecast, index) => {
          forecastOutput += `${index + 1}. ${forecast.time} - ${forecast.temp}°C, ${forecast.description} (Humidity: ${forecast.humidity}%, Wind: ${forecast.wind} m/s)\n`;
        });
        forecastOutput += '\n';
      });
      
      return forecastOutput;
      
    case 'get_current_weather_by_coordinates':
      const coordData = await weatherAPI.getWeatherByCoordinates(parameters.lat, parameters.lon);
      const coordWeather = coordData.weather[0];
      const coordMain = coordData.main;
      
      return `🌍 Weather at Coordinates (${coordData.coord.lat}, ${coordData.coord.lon}):\nLocation: ${coordData.name}\nTemperature: ${coordMain.temp}°C (feels like ${coordMain.feels_like}°C)\nCondition: ${coordWeather.description}\nHumidity: ${coordMain.humidity}%\nWind: ${coordData.wind.speed} m/s`;
      
    default:
      throw new Error(`Weather tool '${toolName}' not supported`);
  }
}

app.post('/a2a', async (req, res) => {
  try {
    const input = req.body.message || req.body.input || '';
    const toolName = req.body.tool || 'get_weather'; // Default to get_weather if not specified
    
    // Find the tool configuration
    let tool = weatherTools.find(t => t.tool === toolName);
    if (!tool) {
      return res.json({ 
        content: { 
          text: `❌ Tool '${toolName}' not found in configuration. Available tools: ${weatherTools.map(t => t.tool).join(', ')}` 
        } 
      });
    }
    
    // Extract parameters from input
    let parameters = {};
    if (req.body.city || req.body.lat || req.body.lon || req.body.date) {
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
    const errorResponse = `❌ **Error**\n\nAn error occurred: ${error.message}`;
    return res.json({ content: { text: errorResponse } });
  }
});

// Expose tool definitions for LLM/orchestrator
app.get('/tools', (req, res) => {
  res.json({ 
    tools: weatherTools,
    agent_type: 'weather',
    description: 'Weather information agent with OpenWeatherMap API integration'
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: "OK", 
    message: "Weather Agent is running",
    available_tools: weatherTools.map(t => t.tool)
  });
});

app.listen(5003, () => {
  console.log('🌤️ Weather Agent running on http://localhost:5003/a2a');
  console.log('📋 Available tools:', weatherTools.map(t => t.tool).join(', '));
  console.log('🔧 Tool definitions available at: http://localhost:5003/tools');
  console.log('💚 Health check available at: http://localhost:5003/health');
});

module.exports = { getWeather };
