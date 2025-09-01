// src/orchestrator/AgentDescriptions.js

module.exports = [
  {
    name: "FlightSearchAgent",
    description: "Handles flight search queries, finds flights between cities/airports on specific dates.",
    capabilities: [
      {
        tool: "search_flights",
        description: "Search flights between two cities/airports on a specific date.",
        parameters: ["source", "destination", "date"],
        example: {
          input: "Find flights from HYD to DEL on 2025-07-18",
          output: "List of available flights with times and prices"
        }
      }
    ],
    call: {
      type: "http",
      endpoint: "http://localhost:5002/a2a"
    }
  },
  {
    name: "WeatherAgent",
    description: "Handles weather queries for cities or coordinates.",
    capabilities: [
      {
        tool: "get_weather",
        description: "Get current weather for a city.",
        parameters: ["city"],
        example: {
          input: "What's the weather in London?",
          output: "Current temperature, condition, humidity, etc."
        }
      },
      {
        tool: "get_weather_forecast",
        description: "Get 5-day weather forecast for a city.",
        parameters: ["city"],
        example: {
          input: "Weather forecast for Paris",
          output: "5-day forecast with temperature and conditions"
        }
      },
      {
        tool: "get_weather_by_coordinates",
        description: "Get current weather by latitude and longitude.",
        parameters: ["lat", "lon"],
        example: {
          input: "Weather at lat: 51.5074, lon: -0.1278",
          output: "Current weather for the given coordinates"
        }
      }
    ],
    call: {
      type: "function",
      functionName: "getWeather"
    }
  }
  // Add more agents as needed
];
