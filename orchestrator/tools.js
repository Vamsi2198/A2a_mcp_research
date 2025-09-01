// tools.js - Single source for all agent information
const { getWeather } = require("../agents/weatherAgent");
const { getLiveLocation } = require("../agents/liveLocationAgent");

const tools = [
  {
    name: "FlightSearchAgent",
    description: "Handles flight search queries, finds flights between cities/airports on specific dates.",
    capabilities: [
      {
        tool: "search_flights",
        description: "Search flights between two cities/airports on a specific date.",
        parameters: ["source", "destination", "date"],
        schema: {
          type: "object",
          properties: {
            source: { type: "string", description: "Departure city/airport code" },
            destination: { type: "string", description: "Arrival city/airport code" },
            date: { type: "string", description: "Travel date (YYYY-MM-DD)" },
          },
          required: ["source", "destination", "date"],
        },
        call: {
          type: "http",
          endpoint: "http://localhost:5002/a2a"
        },
        example: {
          input: "Find flights from HYD to DEL on 2025-07-18",
          output: "List of available flights with times and prices"
        }
      },
      {
        tool: "book_flight",
        description: "Book a flight using flight offer data and traveler information.",
        parameters: ["flightOffer", "travelerInfo"],
        schema: {
          type: "object",
          properties: {
            flightOffer: { type: "object", description: "Complete flight offer object from search results" },
            travelerInfo: { type: "array", description: "Array of traveler objects with personal information" },
          },
          required: ["flightOffer", "travelerInfo"],
        },
        call: {
          type: "http",
          endpoint: "http://localhost:6002/book_flight"
        },
        example: {
          input: "Book flight offer with traveler details",
          output: "Flight booking confirmation with booking ID and details"
        }
      }
    ]
  },
  {
    name: "WeatherAgent",
    description: "Handles all weather-related queries using OpenWeatherMap API.",
    capabilities: [
      {
        tool: "get_current_weather_by_city",
        name: "get_current_weather_by_city",
        description: "Get current weather data for a specific city using OpenWeatherMap API. Use for queries like 'current weather', 'weather now', 'temperature today'.",
        endpoint: "POST /weather/current",
        api_url: "https://api.openweathermap.org/data/2.5/weather?q={city}&appid={api_key}",
        parameters: { city: "string (required) - Name of the city to get weather for" },
        schema: {
          type: "object",
          properties: {
            city: { type: "string", description: "Name of the city to get weather for" }
          },
          required: ["city"]
        },
        call: { type: "function", func: getWeather },
        response_format: {
          success: "boolean",
          data: {
            name: "string - City name",
            main: {
              temp: "number - Temperature in Celsius",
              humidity: "number - Humidity percentage",
              pressure: "number - Atmospheric pressure",
              feels_like: "number - Feels like temperature"
            },
            weather: [{
              description: "string - Weather description",
              main: "string - Weather condition",
              icon: "string - Weather icon code"
            }],
            wind: {
              speed: "number - Wind speed in m/s",
              deg: "number - Wind direction in degrees"
            }
          },
          source: "string - 'api' or 'mock'"
        },
        example_request: { city: "London" },
        example_response: {
          success: true,
          data: {
            name: "London",
            main: { temp: 22, humidity: 65, pressure: 1013, feels_like: 24 },
            weather: [{ description: "partly cloudy", main: "Clouds", icon: "02d" }],
            wind: { speed: 5.2, deg: 180 }
          },
          source: "api"
        }
      },
      {
        tool: "get_weather_forecast_by_city",
        name: "get_weather_forecast_by_city",
        description: "Get 5-day weather forecast for a specific city using OpenWeatherMap API. Use for queries like 'weather forecast', 'next rainy day', 'future weather', 'will it rain tomorrow', etc.",
        endpoint: "POST /weather/forecast",
        api_url: "https://api.openweathermap.org/data/2.5/forecast?q={city}&appid={api_key}",
        parameters: { city: "string (required) - Name of the city to get forecast for" },
        schema: {
          type: "object",
          properties: {
            city: { type: "string", description: "Name of the city to get forecast for" }
          },
          required: ["city"]
        },
        call: { type: "function", func: getWeather },
        response_format: {
          success: "boolean",
          data: {
            city: {
              name: "string - City name",
              country: "string - Country code",
              coord: { lat: "number - Latitude", lon: "number - Longitude" }
            },
            list: [{
              dt: "number - Timestamp",
              main: {
                temp: "number - Temperature in Celsius",
                humidity: "number - Humidity percentage",
                pressure: "number - Atmospheric pressure"
              },
              weather: [{
                description: "string - Weather description",
                main: "string - Weather condition",
                icon: "string - Weather icon code"
              }],
              wind: { speed: "number - Wind speed in m/s", deg: "number - Wind direction in degrees" },
              dt_txt: "string - Date and time in ISO format"
            }]
          },
          source: "string - 'api' or 'mock'"
        },
        example_request: { city: "New York" },
        example_response: {
          success: true,
          data: {
            city: {
              name: "New York",
              country: "US",
              coord: { lat: 40.7128, lon: -74.0060 }
            },
            list: [{
              dt: 1640995200,
              main: { temp: 22, humidity: 65, pressure: 1013 },
              weather: [{ description: "partly cloudy", main: "Clouds", icon: "02d" }],
              wind: { speed: 5.2, deg: 180 },
              dt_txt: "2022-01-01 12:00:00"
            }]
          },
          source: "api"
        }
      },
      {
        tool: "get_current_weather_by_coordinates",
        name: "get_current_weather_by_coordinates",
        description: "Get current weather data using latitude and longitude coordinates using OpenWeatherMap API. Use for queries like 'weather at my coordinates', 'weather at lat/lon', etc.",
        endpoint: "POST /weather/coordinates",
        api_url: "https://api.openweathermap.org/data/2.5/weather?lat={lat}&lon={lon}&appid={api_key}",
        parameters: { lat: "number (required) - Latitude between -90 and 90", lon: "number (required) - Longitude between -180 and 180" },
        schema: {
          type: "object",
          properties: {
            lat: { type: "number", description: "Latitude between -90 and 90" },
            lon: { type: "number", description: "Longitude between -180 and 180" }
          },
          required: ["lat", "lon"]
        },
        call: { type: "function", func: getWeather },
        response_format: {
          success: "boolean",
          data: {
            name: "string - Location name",
            main: {
              temp: "number - Temperature in Celsius",
              humidity: "number - Humidity percentage",
              pressure: "number - Atmospheric pressure",
              feels_like: "number - Feels like temperature"
            },
            weather: [{
              description: "string - Weather description",
              main: "string - Weather condition",
              icon: "string - Weather icon code"
            }],
            wind: { speed: "number - Wind speed in m/s", deg: "number - Wind direction in degrees" },
            coord: { lat: "number - Latitude", lon: "number - Longitude" }
          },
          source: "string - 'api' or 'mock'"
        },
        example_request: { lat: 40.7128, lon: -74.0060 },
        example_response: {
          success: true,
          data: {
            name: "New York",
            main: { temp: 20, humidity: 70, pressure: 1015, feels_like: 22 },
            weather: [{ description: "clear sky", main: "Clear", icon: "01d" }],
            wind: { speed: 4.0, deg: 200 },
            coord: { lat: 40.7128, lon: -74.0060 }
          },
          source: "api"
        }
      },
      {
        tool: "get_weather_server_health",
        name: "get_weather_server_health",
        description: "Check the health status of the weather MCP server.",
        endpoint: "GET /health",
        parameters: {},
        schema: {
          type: "object",
          properties: {},
          required: []
        },
        call: { type: "function", func: getWeather },
        response_format: {
          status: "string - Server status",
          service: "string - Service name",
          timestamp: "string - Current timestamp in ISO format",
          endpoints: ["string - List of available endpoints"]
        },
        example_response: {
          status: "healthy",
          service: "Weather MCP Server",
          timestamp: "2024-01-01T12:00:00.000Z",
          endpoints: [
            "POST /weather/current - Get current weather by city",
            "POST /weather/forecast - Get 5-day forecast by city",
            "POST /weather/coordinates - Get current weather by coordinates"
          ]
        }
      },
      {
        tool: "get_weather_server_info",
        name: "get_weather_server_info",
        description: "Get information about the weather MCP server and available endpoints.",
        endpoint: "GET /",
        parameters: {},
        schema: {
          type: "object",
          properties: {},
          required: []
        },
        call: { type: "function", func: getWeather },
        response_format: {
          message: "string - Server message",
          version: "string - Server version",
          endpoints: {
            current: "string - Current weather endpoint",
            forecast: "string - Forecast endpoint",
            coordinates: "string - Coordinates endpoint",
            health: "string - Health check endpoint"
          },
          usage: {
            current: { city: "string" },
            forecast: { city: "string" },
            coordinates: { lat: "number", lon: "number" }
          }
        },
        example_response: {
          message: "Weather MCP Server is running!",
          version: "1.0.0",
          endpoints: {
            current: "POST /weather/current",
            forecast: "POST /weather/forecast",
            coordinates: "POST /weather/coordinates",
            health: "GET /health"
          },
          usage: {
            current: { city: "string" },
            forecast: { city: "string" },
            coordinates: { lat: "number", lon: "number" }
          }
        }
      }
    ]
  },
  {
    name: "EmailAgent",
    description: "Handles email sending functionality.",
    capabilities: [
      {
        tool: "outlook_send_email",
        description: "Send an email via Outlook.",
        parameters: ["to_email", "subject", "body"],
        schema: {
          type: "object",
          properties: {
            to_email: { type: "array", description: "Array of recipient email addresses" },
            subject: { type: "string", description: "Email subject" },
            body: { type: "string", description: "Email content" },
          },
          required: ["to_email", "subject", "body"],
        },
        call: {
          type: "http",
          endpoint: "http://localhost:5002/a2a"
        },
        example: {
          input: "Send email to john@example.com about the meeting",
          output: "Email sent successfully"
        }
      }
    ]
  },
  {
    name: "LocationAgent",
    description: "Handles location and geolocation queries.",
    capabilities: [
      {
        tool: "search_locations",
        description: "Find IATA airport/city codes for a given city name.",
        parameters: ["keyword"],
        schema: {
          type: "object",
          properties: {
            keyword: { type: "string", description: "City name" }
          },
          required: ["keyword"]
        },
        call: {
          type: "http",
          endpoint: "http://localhost:6002/search_locations"
        },
        example: {
          input: "Search for London airport codes",
          output: "List of airports in London with IATA codes"
        }
      }
    ]
  },
  {
    name: "LiveLocationAgent",
    description: "Handles live location queries using IP geolocation.",
    capabilities: [
      {
        tool: "get_live_location",
        description: "Get user's live location (current city/country) by IP address. Use for queries like 'where am I', 'what is my live location', 'current location', 'my location', etc.",
        parameters: [],
        schema: {
          type: "object",
          properties: {},
          required: []
        },
        call: {
          type: "function",
          func: getLiveLocation
        },
        example: {
          input: "Where am I right now?",
          output: "Your current city is Hyderabad, India."
        }
      }
    ]
  }
];

module.exports = { tools };
