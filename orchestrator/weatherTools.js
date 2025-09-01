// src/orchestrator/weatherTools.js

const weatherTools = [
  {
    tool: "get_current_weather_by_city",
    name: "get_current_weather_by_city",
    description: "Get current w eather data for a specific city using OpenWeatherMap API. Use for queries like 'current weather', 'weather now', 'temperature today'.",
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
    call: { type: "function", funcName: "getWeather" },
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
    call: { type: "function", funcName: "getWeather" },
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
    call: { type: "function", funcName: "getWeather" },
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
  }
];

module.exports = { weatherTools };
