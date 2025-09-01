// src/orchestrator/agentTools.js

const { flightSearchTools } = require('./flighSearchTools');
const outlookTools = require('./outlookTool');
const zoomTools = require('./zoomTool');
const teamsTools = require('./teamsTool');
const { postgresAgent } = require('./postgressTools');

const agentTools = [
  {
    name: "FlightSearchAgent",
    description: "Flight search and booking agent with Amadeus API integration, Outlook, and Zoom tools",
    server_url: "http://localhost:5002",
    endpoints: {
      main: "/a2a",
      tools: "/tools",
      prompt_template: "/prompt-template"
    },
    capabilities: [
      ...flightSearchTools,
      ...outlookTools,
      ...zoomTools,
      ...teamsTools
    ]
  },
  {
    name: "TeamsAgent",
    description: "Microsoft Teams integration agent for sending messages, alerts, and reports",
    server_url: "http://localhost:7000",
    endpoints: {
      main: "/a2a",
      tools: "/tools",
      prompt_template: "/prompt-template"
    },
    capabilities: [
      ...teamsTools
    ]
  },
  {
    name: "WeatherAgent",
    description: "Weather information agent with OpenWeatherMap API integration",
    server_url: "http://localhost:5003",
    endpoints: {
      main: "/a2a",
      tools: "/tools",
      prompt_template: "/prompt-template"
    },
    capabilities: [
      {
        tool: "get_current_weather_by_city",
        name: "get_current_weather_by_city",
        description: "Get current weather information for a specific city using OpenWeatherMap API.",
        endpoint: "POST /a2a",
        api_url: "https://api.openweathermap.org/data/2.5/weather",
        parameters: {
          city: "string (required) - City name to get weather for"
        },
        schema: {
          type: "object",
          properties: {
            city: { type: "string", description: "City name to get weather for" }
          },
          required: ["city"]
        },
        example_request: {
          city: "Mumbai"
        },
        example_response: {
          text: "🌤️ Current Weather in Mumbai:\nTemperature: 28°C\nFeels like: 30°C\nHumidity: 75%\nWeather: scattered clouds\nWind: 3.5 m/s"
        }
      },
      {
        tool: "get_weather_forecast_by_city",
        name: "get_weather_forecast_by_city",
        description: "Get 5-day weather forecast for a specific city using OpenWeatherMap API.",
        endpoint: "POST /a2a",
        api_url: "https://api.openweathermap.org/data/2.5/forecast",
        parameters: {
          city: "string (required) - City name to get forecast for"
        },
        schema: {
          type: "object",
          properties: {
            city: { type: "string", description: "City name to get forecast for" }
          },
          required: ["city"]
        },
        example_request: {
          city: "Delhi"
        },
        example_response: {
          text: "📅 5-Day Weather Forecast for Delhi:\n\n1. 09:00 AM - 32°C, clear sky\n2. 12:00 PM - 35°C, scattered clouds\n..."
        }
      },
      {
        tool: "get_current_weather_by_coordinates",
        name: "get_current_weather_by_coordinates",
        description: "Get current weather information for specific coordinates using OpenWeatherMap API.",
        endpoint: "POST /a2a",
        api_url: "https://api.openweathermap.org/data/2.5/weather",
        parameters: {
          lat: "number (required) - Latitude coordinate",
          lon: "number (required) - Longitude coordinate"
        },
        schema: {
          type: "object",
          properties: {
            lat: { type: "number", description: "Latitude coordinate" },
            lon: { type: "number", description: "Longitude coordinate" }
          },
          required: ["lat", "lon"]
        },
        example_request: {
          lat: 19.0760,
          lon: 72.8777
        },
        example_response: {
          text: "🌍 Weather at Coordinates (19.0760, 72.8777):\nLocation: Mumbai\nTemperature: 28°C\nCondition: scattered clouds\nHumidity: 75%"
        }
      }
    ]
  },
  {
    name: "LiveLocationAgent",
    description: "Live location and geolocation services agent with comprehensive location-based capabilities",
    server_url: "http://localhost:5004",
    endpoints: {
      main: "/a2a",
      tools: "/tools",
      prompt_template: "/prompt-template",
      location: "/location"
    },
    capabilities: [
      {
        tool: "get_live_location",
        name: "get_live_location",
        description: "Get current location information based on IP address using geolocation services.",
        endpoint: "POST /a2a",
        api_url: "https://ipapi.co/json/",
        parameters: {},
        schema: {
          type: "object",
          properties: {},
          required: []
        },
        example_request: {},
        example_response: {
          text: "📍 Current Location:\nCity: Mumbai\nCountry: India\nLatitude: 19.0760\nLongitude: 72.8777\nIP: 203.xxx.xxx.xxx\nTimezone: Asia/Kolkata\nISP: Reliance Jio"
        }
      },
      {
        tool: "get_location_by_ip",
        name: "get_location_by_ip",
        description: "Get location information for a specific IP address using geolocation services.",
        endpoint: "POST /a2a",
        api_url: "https://ipapi.co/{ip}/json/",
        parameters: {
          ip: "string (optional) - IP address to get location for. If not provided, uses current IP."
        },
        schema: {
          type: "object",
          properties: {
            ip: { type: "string", description: "IP address to get location for" }
          },
          required: []
        },
        example_request: {
          ip: "8.8.8.8"
        },
        example_response: {
          text: "📍 Location for IP 8.8.8.8:\nCity: Mountain View\nCountry: United States\nLatitude: 37.4056\nLongitude: -122.0775\nTimezone: America/Los_Angeles\nISP: Google LLC"
        }
      },
      {
        tool: "get_location_by_coordinates",
        name: "get_location_by_coordinates",
        description: "Get location information for specific latitude and longitude coordinates using reverse geocoding.",
        endpoint: "POST /a2a",
        api_url: "https://api.openweathermap.org/geo/1.0/reverse",
        parameters: {
          lat: "number (required) - Latitude coordinate",
          lon: "number (required) - Longitude coordinate"
        },
        schema: {
          type: "object",
          properties: {
            lat: { type: "number", description: "Latitude coordinate" },
            lon: { type: "number", description: "Longitude coordinate" }
          },
          required: ["lat", "lon"]
        },
        example_request: {
          lat: 19.0760,
          lon: 72.8777
        },
        example_response: {
          text: "📍 Location at Coordinates (19.0760, 72.8777):\nCity: Mumbai\nState: Maharashtra\nCountry: India\nPostal Code: 400001\nTimezone: Asia/Kolkata"
        }
      },
      {
        tool: "get_nearby_airports",
        name: "get_nearby_airports",
        description: "Find nearby airports based on current location or provided coordinates.",
        endpoint: "POST /a2a",
        api_url: "https://test.api.amadeus.com/v1/reference-data/locations/airports",
        parameters: {
          latitude: "number (required) - Latitude coordinate",
          longitude: "number (required) - Longitude coordinate",
          radius: "number (optional) - Search radius in kilometers (default: 500)"
        },
        schema: {
          type: "object",
          properties: {
            latitude: { type: "number", description: "Latitude coordinate" },
            longitude: { type: "number", description: "Longitude coordinate" },
            radius: { type: "number", description: "Search radius in kilometers" }
          },
          required: ["latitude", "longitude"]
        },
        example_request: {
          latitude: 19.0760,
          longitude: 72.8777,
          radius: 100
        },
        example_response: {
          text: "✈️ Nearby Airports:\n\n1. Chhatrapati Shivaji International Airport (BOM)\nDistance: 8.5 km\nType: International\n\n2. Juhu Aerodrome\nDistance: 12.3 km\nType: Domestic\n\n3. Navi Mumbai International Airport (under construction)\nDistance: 35.2 km\nType: International"
        }
      },
      {
        tool: "get_location_weather",
        name: "get_location_weather",
        description: "Get current weather information for the user's current location.",
        endpoint: "POST /a2a",
        api_url: "https://api.openweathermap.org/data/2.5/weather",
        parameters: {},
        schema: {
          type: "object",
          properties: {},
          required: []
        },
        example_request: {},
        example_response: {
          text: "🌤️ Weather at Your Location:\nLocation: Mumbai, India\nTemperature: 28°C\nFeels like: 30°C\nCondition: scattered clouds\nHumidity: 75%\nWind: 3.5 m/s\nVisibility: 10 km"
        }
      },
      {
        tool: "get_location_timezone",
        name: "get_location_timezone",
        description: "Get timezone information for the current location or specified coordinates.",
        endpoint: "POST /a2a",
        api_url: "https://worldtimeapi.org/api/timezone",
        parameters: {
          lat: "number (optional) - Latitude coordinate",
          lon: "number (optional) - Longitude coordinate"
        },
        schema: {
          type: "object",
          properties: {
            lat: { type: "number", description: "Latitude coordinate" },
            lon: { type: "number", description: "Longitude coordinate" }
          },
          required: []
        },
        example_request: {
          lat: 19.0760,
          lon: 72.8777
        },
        example_response: {
          text: "🕐 Timezone Information:\nTimezone: Asia/Kolkata\nCurrent Time: 2025-07-14 22:00:00\nUTC Offset: +05:30\nDaylight Saving: No\nAbbreviation: IST"
        }
      },
      {
        tool: "get_location_details",
        name: "get_location_details",
        description: "Get comprehensive location details including city, country, coordinates, timezone, and nearby points of interest.",
        endpoint: "POST /a2a",
        api_url: "https://ipapi.co/json/",
        parameters: {
          include_weather: "boolean (optional) - Include current weather information",
          include_airports: "boolean (optional) - Include nearby airports",
          include_timezone: "boolean (optional) - Include timezone information"
        },
        schema: {
          type: "object",
          properties: {
            include_weather: { type: "boolean", description: "Include current weather information" },
            include_airports: { type: "boolean", description: "Include nearby airports" },
            include_timezone: { type: "boolean", description: "Include timezone information" }
          },
          required: []
        },
        example_request: {
          include_weather: true,
          include_airports: true,
          include_timezone: true
        },
        example_response: {
          text: "📍 Complete Location Details:\n\n🌍 Basic Information:\nCity: Mumbai\nState: Maharashtra\nCountry: India\nCoordinates: 19.0760, 72.8777\nIP: 203.xxx.xxx.xxx\n\n🕐 Timezone:\nTimezone: Asia/Kolkata\nCurrent Time: 2025-07-14 22:00:00\nUTC Offset: +05:30\n\n🌤️ Weather:\nTemperature: 28°C\nCondition: scattered clouds\nHumidity: 75%\n\n✈️ Nearby Airports:\n1. Chhatrapati Shivaji International Airport (BOM) - 8.5 km\n2. Juhu Aerodrome - 12.3 km"
        }
      }
    ]
  },
  postgresAgent
];

module.exports = { agentTools };
