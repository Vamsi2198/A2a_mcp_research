const express = require('express');
const axios = require('axios');
const dotenv = require('dotenv');
const cors = require('cors');

dotenv.config();

const app = express();
const PORT = 3002;

app.use(express.json());
app.use(cors());

// Get Current Weather by City Name
app.post('/weather/current', async (req, res) => {
  const { city } = req.body;

  if (!city) {
    return res.status(400).json({ error: 'City name is required' });
  }

  try {
    const apiKey = process.env.OPENWEATHER_API_KEY;
    
    if (!apiKey) {
      // Mock response for testing
      const mockWeather = {
        name: city,
        main: { temp: 22, humidity: 65, pressure: 1013, feels_like: 24 },
        weather: [{ description: "partly cloudy", main: "Clouds", icon: "02d" }],
        wind: { speed: 5.2, deg: 180 },
        clouds: { all: 40 },
        visibility: 10000,
        sys: { country: "US", sunrise: Date.now() / 1000, sunset: Date.now() / 1000 + 43200 }
      };
      
      console.log("Using mock weather data for current weather");
      return res.json({ success: true, data: mockWeather, source: "mock" });
    }
    
    const weatherRes = await axios.get(
      `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&units=metric&appid=${apiKey}`
    );
    
    console.log("Current weather fetched for:", city);
    res.json({ success: true, data: weatherRes.data, source: "api" });
    
  } catch (err) {
    console.error("Error fetching current weather:", err.message);
    res.status(err.response?.status || 500).json({ 
      success: false,
      error: err.response?.data?.message || 'Failed to fetch current weather',
      details: err.message
    });
  }
});

// Get 5-Day Weather Forecast by City Name
app.post('/weather/forecast', async (req, res) => {
  const { city } = req.body;

  if (!city) {
    return res.status(400).json({ error: 'City name is required' });
  }

  try {
    const apiKey = process.env.OPENWEATHER_API_KEY;
    
    if (!apiKey) {
      // Mock 5-day forecast response
      const mockForecast = {
        city: {
          name: city,
          country: "US",
          coord: { lat: 40.7128, lon: -74.0060 }
        },
        list: [
          {
            dt: Date.now() / 1000,
            main: { temp: 22, humidity: 65, pressure: 1013 },
            weather: [{ description: "partly cloudy", main: "Clouds", icon: "02d" }],
            wind: { speed: 5.2, deg: 180 },
            clouds: { all: 40 },
            dt_txt: new Date().toISOString()
          },
          {
            dt: Date.now() / 1000 + 86400,
            main: { temp: 25, humidity: 60, pressure: 1012 },
            weather: [{ description: "sunny", main: "Clear", icon: "01d" }],
            wind: { speed: 3.1, deg: 150 },
            clouds: { all: 20 },
            dt_txt: new Date(Date.now() + 86400000).toISOString()
          }
        ]
      };
      
      console.log("Using mock forecast data");
      return res.json({ success: true, data: mockForecast, source: "mock" });
    }
    
    const forecastRes = await axios.get(
      `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(city)}&units=metric&appid=${apiKey}`
    );
    
    console.log("5-day forecast fetched for:", city);
    res.json({ success: true, data: forecastRes.data, source: "api" });
    
  } catch (err) {
    console.error("Error fetching forecast2:", err.message);
    res.status(err.response?.status || 500).json({ 
      success: false,
      error: err.response?.data?.message || 'Failed to fetch weather forecast',
      details: err.message
    });
  }
});

// Get Current Weather by Coordinates (latitude, longitude)
app.post('/weather/coordinates', async (req, res) => {
  const { lat, lon } = req.body;

  if (!lat || !lon) {
    return res.status(400).json({ error: 'Both latitude (lat) and longitude (lon) are required' });
  }

  // Validate coordinates
  if (lat < -90 || lat > 90) {
    return res.status(400).json({ error: 'Latitude must be between -90 and 90' });
  }
  if (lon < -180 || lon > 180) {
    return res.status(400).json({ error: 'Longitude must be between -180 and 180' });
  }

  try {
    const apiKey = process.env.OPENWEATHER_API_KEY;
    
    if (!apiKey) {
      // Mock response for coordinates
      const mockWeather = {
        name: "Unknown Location",
        main: { temp: 20, humidity: 70, pressure: 1015, feels_like: 22 },
        weather: [{ description: "clear sky", main: "Clear", icon: "01d" }],
        wind: { speed: 4.0, deg: 200 },
        clouds: { all: 10 },
        visibility: 10000,
        coord: { lat: parseFloat(lat), lon: parseFloat(lon) },
        sys: { country: "Unknown", sunrise: Date.now() / 1000, sunset: Date.now() / 1000 + 43200 }
      };
      
      console.log("Using mock weather data for coordinates");
      return res.json({ success: true, data: mockWeather, source: "mock" });
    }
    
    const weatherRes = await axios.get(
      `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${apiKey}`
    );
    
    console.log("Weather fetched for coordinates:", lat, lon);
    res.json({ success: true, data: weatherRes.data, source: "api" });
    
  } catch (err) {
    console.error("Error fetching weather by coordinates:", err.message);
    res.status(err.response?.status || 500).json({ 
      success: false,
      error: err.response?.data?.message || 'Failed to fetch weather by coordinates',
      details: err.message
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'Weather MCP Server',
    timestamp: new Date().toISOString(),
    endpoints: [
      'POST /weather/current - Get current weather by city',
      'POST /weather/forecast - Get 5-day forecast by city', 
      'POST /weather/coordinates - Get current weather by coordinates'
    ]
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Weather MCP Server is running!',
    version: '1.0.0',
    endpoints: {
      current: 'POST /weather/current',
      forecast: 'POST /weather/forecast',
      coordinates: 'POST /weather/coordinates',
      health: 'GET /health'
    },
    usage: {
      current: { city: 'string' },
      forecast: { city: 'string' },
      coordinates: { lat: 'number', lon: 'number' }
    }
  });
});

// Weather function exports for direct use
async function getCurrentWeatherByCity({ city }) {
  if (!city) {
    throw new Error('City name is required');
  }

  try {
    const apiKey = process.env.OPENWEATHER_API_KEY;
    
    if (!apiKey) {
      // Mock response for testing
      const mockWeather = {
        name: city,
        main: { temp: 22, humidity: 65, pressure: 1013, feels_like: 24 },
        weather: [{ description: "partly cloudy", main: "Clouds", icon: "02d" }],
        wind: { speed: 5.2, deg: 180 },
        clouds: { all: 40 },
        visibility: 10000,
        sys: { country: "US", sunrise: Date.now() / 1000, sunset: Date.now() / 1000 + 43200 }
      };
      
      console.log("Using mock weather data for current weather");
      return { success: true, data: mockWeather, source: "mock" };
    }
    
    const weatherRes = await axios.get(
      `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&units=metric&appid=${apiKey}`
    );
    
    console.log("Current weather fetched for:", city);
    return { success: true, data: weatherRes.data, source: "api" };
    
  } catch (err) {
    console.error("Error fetching current weather:", err.message);
    throw new Error(err.response?.data?.message || 'Failed to fetch current weather');
  }
}

async function getWeatherForecastByCity({ city }) {
  if (!city) {
    throw new Error('City name is required');
  }

  try {
    const apiKey = process.env.OPENWEATHER_API_KEY;
    
    if (!apiKey) {
      // Mock 5-day forecast response
      const mockForecast = {
        city: {
          name: city,
          country: "US",
          coord: { lat: 40.7128, lon: -74.0060 }
        },
        list: [
          {
            dt: Date.now() / 1000,
            main: { temp: 22, humidity: 65, pressure: 1013 },
            weather: [{ description: "partly cloudy", main: "Clouds", icon: "02d" }],
            wind: { speed: 5.2, deg: 180 },
            clouds: { all: 40 },
            dt_txt: new Date().toISOString()
          },
          {
            dt: Date.now() / 1000 + 86400,
            main: { temp: 25, humidity: 60, pressure: 1012 },
            weather: [{ description: "sunny", main: "Clear", icon: "01d" }],
            wind: { speed: 3.1, deg: 150 },
            clouds: { all: 20 },
            dt_txt: new Date(Date.now() + 86400000).toISOString()
          }
        ]
      };
      
      console.log("Using mock forecast data");
      return { success: true, data: mockForecast, source: "mock" };
    }
    
    const forecastRes = await axios.get(
      `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(city)}&units=metric&appid=${apiKey}`
    );
    
    console.log("5-day forecast fetched for:", city);
    return { success: true, data: forecastRes.data, source: "api" };
    
  } catch (err) {
    console.error("Error fetching forecast:", err.message);
    throw new Error(err.response?.data?.message || 'Failed to fetch weather forecast');
  }
}

async function getCurrentWeatherByCoordinates({ lat, lon }) {
  if (!lat || !lon) {
    throw new Error('Both latitude (lat) and longitude (lon) are required');
  }

  // Validate coordinates
  if (lat < -90 || lat > 90) {
    throw new Error('Latitude must be between -90 and 90');
  }
  if (lon < -180 || lon > 180) {
    throw new Error('Longitude must be between -180 and 180');
  }

  try {
    const apiKey = process.env.OPENWEATHER_API_KEY;
    
    if (!apiKey) {
      // Mock response for coordinates
      const mockWeather = {
        name: "Unknown Location",
        main: { temp: 20, humidity: 70, pressure: 1015, feels_like: 22 },
        weather: [{ description: "clear sky", main: "Clear", icon: "01d" }],
        wind: { speed: 4.0, deg: 200 },
        clouds: { all: 10 },
        visibility: 10000,
        coord: { lat: parseFloat(lat), lon: parseFloat(lon) },
        sys: { country: "Unknown", sunrise: Date.now() / 1000, sunset: Date.now() / 1000 + 43200 }
      };
      
      console.log("Using mock weather data for coordinates");
      return { success: true, data: mockWeather, source: "mock" };
    }
    
    const weatherRes = await axios.get(
      `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${apiKey}`
    );
    
    console.log("Weather fetched for coordinates:", lat, lon);
    return { success: true, data: weatherRes.data, source: "api" };
    
  } catch (err) {
    console.error("Error fetching weather by coordinates:", err.message);
    throw new Error(err.response?.data?.message || 'Failed to fetch weather by coordinates');
  }
}

function getWeatherServerHealth() {
  return { 
    status: 'healthy', 
    service: 'Weather MCP Server',
    timestamp: new Date().toISOString(),
    endpoints: [
      'POST /weather/current - Get current weather by city',
      'POST /weather/forecast - Get 5-day forecast by city', 
      'POST /weather/coordinates - Get current weather by coordinates'
    ]
  };
}

function getWeatherServerInfo() {
  return {
    message: 'Weather MCP Server is running!',
    version: '1.0.0',
    endpoints: {
      current: 'POST /weather/current',
      forecast: 'POST /weather/forecast',
      coordinates: 'POST /weather/coordinates',
      health: 'GET /health'
    },
    usage: {
      current: { city: 'string' },
      forecast: { city: 'string' },
      coordinates: { lat: 'number', lon: 'number' }
    }
  };
}

app.listen(PORT, () => {
//   console.log(`🌤️ Weather server is running on http://localhost:${PORT}`);
//   console.log(`📋 Available endpoints:`);
//   console.log(`   POST /weather/current - Get current weather by city`);
//   console.log(`   POST /weather/forecast - Get 5-day forecast by city`);
//   console.log(`   POST /weather/coordinates - Get current weather by coordinates`);
//   console.log(`   GET /health - Health check`);
//   console.log(`   GET / - Server info`);
  
  if (!process.env.OPENWEATHER_API_KEY) {
    console.log(`⚠️  No OPENWEATHER_API_KEY found in environment variables. Using mock data.`);
  } else {
    console.log(`✅ OpenWeatherMap API key configured.`);
  }
});

// Export functions for direct use
module.exports = {
  app,
  getCurrentWeatherByCity,
  getWeatherForecastByCity,
  getCurrentWeatherByCoordinates,
  getWeatherServerHealth,
  getWeatherServerInfo
}; 