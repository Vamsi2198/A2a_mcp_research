// src/orchestrator/liveLocationTool.js

const liveLocationTools = [
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
  }
];

// LiveLocationAgent configuration
const liveLocationAgent = {
  name: "LiveLocationAgent",
  description: "Live location and geolocation services agent with comprehensive location-based capabilities",
  server_url: "http://localhost:5004",
  endpoints: {
    main: "/a2a",
    tools: "/tools",
    prompt_template: "/prompt-template",
    location: "/location"
  },
  capabilities: liveLocationTools,
  features: [
    "IP-based geolocation",
    "Coordinate-based location lookup",
    "Nearby airport discovery",
    "Location-based weather",
    "Timezone information",
    "Comprehensive location details"
  ],
  api_services: [
    {
      name: "ipapi.co",
      description: "IP geolocation service",
      url: "https://ipapi.co/json/",
      features: ["IP to location", "Timezone", "ISP information"]
    },
    {
      name: "OpenWeatherMap Geocoding",
      description: "Reverse geocoding service",
      url: "https://api.openweathermap.org/geo/1.0/reverse",
      features: ["Coordinates to location", "Address lookup"]
    },
    {
      name: "Amadeus Airport Search",
      description: "Airport discovery service",
      url: "https://test.api.amadeus.com/v1/reference-data/locations/airports",
      features: ["Nearby airports", "Airport details"]
    },
    {
      name: "World Time API",
      description: "Timezone service",
      url: "https://worldtimeapi.org/api/timezone",
      features: ["Timezone lookup", "Current time"]
    }
  ],
  use_cases: [
    "Get user's current location for personalized services",
    "Find nearby airports for flight planning",
    "Get location-based weather information",
    "Determine timezone for scheduling",
    "Provide location context for travel planning",
    "Support location-aware applications"
  ]
};

module.exports = { 
  liveLocationTools, 
  liveLocationAgent 
};
