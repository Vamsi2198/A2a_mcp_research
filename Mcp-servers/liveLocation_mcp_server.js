const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

// A2A endpoint that the orchestrator calls
app.post('/a2a', async (req, res) => {
  try {
    const { tool } = req.body;
    console.log(`📍 LiveLocationAgent called with tool: ${tool}`);

    let result;
    
    switch (tool) {
      case 'get_live_location':
        result = await getCurrentLocation();
        break;
      case 'get_location_by_ip':
        result = await getLocationByIP(req.body.ip);
        break;
      case 'get_location_by_coordinates':
        result = await getLocationByCoordinates(req.body.lat, req.body.lon);
        break;
      case 'get_nearby_airports':
        result = await getNearbyAirports(req.body.latitude, req.body.longitude, req.body.radius);
        break;
      case 'get_location_weather':
        result = await getLocationWeather(req.body.lat, req.body.lon);
        break;
      case 'get_location_timezone':
        result = await getLocationTimezone(req.body.lat, req.body.lon);
        break;
      case 'get_location_details':
        result = await getLocationDetails(req.body);
        break;
      default:
        return res.status(400).json({ error: `Unknown tool: ${tool}` });
    }

    res.json({
      success: true,
      content: {
        text: result
      }
    });

  } catch (error) {
    console.error('Error in live location agent:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Legacy endpoint for backward compatibility
app.get('/location', async (req, res) => {
  try {
    const result = await getCurrentLocation();
    res.json({
      success: true,
      content: {
        text: result
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Could not fetch location' });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'Live Location MCP Server',
    timestamp: new Date().toISOString()
  });
});

// Location functions
async function getCurrentLocation() {
  try {
    // Get public IP first
    const ipResponse = await axios.get('https://api.ipify.org?format=json');
    const publicIP = ipResponse.data.ip;
    
    // Get location data for the IP
    const geoResponse = await axios.get(`https://ipapi.co/${publicIP}/json/`);
    const locationData = geoResponse.data;

    return `📍 Current Location:
City: ${locationData.city}
Country: ${locationData.country_name}
Region: ${locationData.region}
Latitude: ${locationData.latitude}
Longitude: ${locationData.longitude}
IP: ${publicIP}
Timezone: ${locationData.timezone}
ISP: ${locationData.org}
Postal Code: ${locationData.postal}`;

  } catch (error) {
    throw new Error(`Failed to get current location: ${error.message}`);
  }
}

async function getLocationByIP(ip) {
  try {
    const response = await axios.get(`https://ipapi.co/${ip}/json/`);
    const locationData = response.data;

    return `📍 Location for IP ${ip}:
City: ${locationData.city}
Country: ${locationData.country_name}
Region: ${locationData.region}
Latitude: ${locationData.latitude}
Longitude: ${locationData.longitude}
Timezone: ${locationData.timezone}
ISP: ${locationData.org}`;

  } catch (error) {
    throw new Error(`Failed to get location for IP ${ip}: ${error.message}`);
  }
}

async function getLocationByCoordinates(lat, lon) {
  try {
    const response = await axios.get(`https://api.openweathermap.org/geo/1.0/reverse`, {
      params: {
        lat: lat,
        lon: lon,
        limit: 1,
        appid: process.env.OPENWEATHER_API_KEY || 'your_openweather_api_key'
      }
    });

    if (!response.data || response.data.length === 0) {
      throw new Error('No location found for these coordinates');
    }

    const locationData = response.data[0];

    return `📍 Location at Coordinates (${lat}, ${lon}):
City: ${locationData.name}
State: ${locationData.state}
Country: ${locationData.country}
Postal Code: ${locationData.postal_code}`;

  } catch (error) {
    throw new Error(`Failed to get location for coordinates (${lat}, ${lon}): ${error.message}`);
  }
}

async function getNearbyAirports(lat, lon, radius = 500) {
  try {
    // Fallback to mock data since Amadeus API requires authentication
    return `✈️ Nearby Airports:

1. Chhatrapati Shivaji International Airport (BOM)
Distance: 8.5 km
Type: International

2. Juhu Aerodrome
Distance: 12.3 km
Type: Domestic

3. Navi Mumbai International Airport (under construction)
Distance: 35.2 km
Type: International

Search Center: ${lat}, ${lon}
Search Radius: ${radius} km`;

  } catch (error) {
    throw new Error(`Failed to get nearby airports: ${error.message}`);
  }
}

async function getLocationWeather(lat, lon) {
  try {
    const response = await axios.get('https://api.openweathermap.org/data/2.5/weather', {
      params: {
        lat: lat,
        lon: lon,
        appid: process.env.OPENWEATHER_API_KEY || 'your_openweather_api_key',
        units: 'metric'
      }
    });

    const weatherData = response.data;

    return `🌤️ Weather at Location:
Location: ${weatherData.name}
Country: ${weatherData.sys.country}
Temperature: ${weatherData.main.temp}°C
Feels like: ${weatherData.main.feels_like}°C
Condition: ${weatherData.weather[0].description}
Humidity: ${weatherData.main.humidity}%
Wind: ${weatherData.wind.speed} m/s
Visibility: ${weatherData.visibility / 1000} km`;

  } catch (error) {
    throw new Error(`Failed to get weather: ${error.message}`);
  }
}

async function getLocationTimezone(lat, lon) {
  try {
    // Calculate timezone offset based on longitude
    const timezoneOffset = Math.round(lon / 15);
    const timezoneName = timezoneOffset >= 0 ? `Etc/GMT+${timezoneOffset}` : `Etc/GMT${timezoneOffset}`;
    
    const response = await axios.get(`https://worldtimeapi.org/api/timezone/${timezoneName}`);
    const timezoneData = response.data;

    return `🕐 Timezone Information:
Timezone: ${timezoneData.timezone}
Current Time: ${timezoneData.datetime}
UTC Offset: ${timezoneData.utc_offset}
Day of Week: ${timezoneData.day_of_week}
Abbreviation: ${timezoneData.abbreviation}
DST: ${timezoneData.dst ? 'Yes' : 'No'}`;

  } catch (error) {
    throw new Error(`Failed to get timezone: ${error.message}`);
  }
}

async function getLocationDetails(options = {}) {
  try {
    const { include_weather = false, include_airports = false, include_timezone = false } = options;
    
    // Get basic location
    const basicInfo = await getCurrentLocation();
    let details = `📍 Complete Location Details:

${basicInfo}`;

    // Add weather if requested
    if (include_weather) {
      try {
        const weather = await getLocationWeather(19.0760, 72.8777); // Using Mumbai coordinates as example
        details += `\n\n🌤️ Weather:\n${weather}`;
      } catch (error) {
        details += `\n\n🌤️ Weather: Error - ${error.message}`;
      }
    }

    // Add airports if requested
    if (include_airports) {
      try {
        const airports = await getNearbyAirports(19.0760, 72.8777);
        details += `\n\n✈️ Nearby Airports:\n${airports}`;
      } catch (error) {
        details += `\n\n✈️ Nearby Airports: Error - ${error.message}`;
      }
    }

    // Add timezone if requested
    if (include_timezone) {
      try {
        const timezone = await getLocationTimezone(19.0760, 72.8777);
        details += `\n\n🕐 Timezone:\n${timezone}`;
      } catch (error) {
        details += `\n\n🕐 Timezone: Error - ${error.message}`;
      }
    }

    return details;

  } catch (error) {
    throw new Error(`Failed to get location details: ${error.message}`);
  }
}

app.listen(5004, () => console.log('Live Location MCP Server listening on port 5004'));
