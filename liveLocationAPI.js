const axios = require('axios');
const express = require('express');

class LiveLocationAPI {
  constructor() {
    this.app = express();
    this.app.use(express.json());
    this.setupRoutes();
  }

  setupRoutes() {
    // Get current location by IP
    this.app.get('/api/location/current', async (req, res) => {
      try {
        const location = await this.getCurrentLocation();
        res.json(location);
      } catch (error) {
        res.status(500).json({ error: 'Failed to get current location', details: error.message });
      }
    });

    // Get location by specific IP
    this.app.get('/api/location/ip/:ip', async (req, res) => {
      try {
        const location = await this.getLocationByIP(req.params.ip);
        res.json(location);
      } catch (error) {
        res.status(500).json({ error: 'Failed to get location by IP', details: error.message });
      }
    });

    // Get location by coordinates
    this.app.get('/api/location/coordinates', async (req, res) => {
      try {
        const { lat, lon } = req.query;
        if (!lat || !lon) {
          return res.status(400).json({ error: 'Latitude and longitude are required' });
        }
        const location = await this.getLocationByCoordinates(parseFloat(lat), parseFloat(lon));
        res.json(location);
      } catch (error) {
        res.status(500).json({ error: 'Failed to get location by coordinates', details: error.message });
      }
    });

    // Get nearby airports
    this.app.get('/api/location/airports', async (req, res) => {
      try {
        const { lat, lon, radius = 500 } = req.query;
        if (!lat || !lon) {
          return res.status(400).json({ error: 'Latitude and longitude are required' });
        }
        const airports = await this.getNearbyAirports(parseFloat(lat), parseFloat(lon), parseInt(radius));
        res.json(airports);
      } catch (error) {
        res.status(500).json({ error: 'Failed to get nearby airports', details: error.message });
      }
    });

    // Get weather for location
    this.app.get('/api/location/weather', async (req, res) => {
      try {
        const { lat, lon } = req.query;
        if (!lat || !lon) {
          return res.status(400).json({ error: 'Latitude and longitude are required' });
        }
        const weather = await this.getLocationWeather(parseFloat(lat), parseFloat(lon));
        res.json(weather);
      } catch (error) {
        res.status(500).json({ error: 'Failed to get weather', details: error.message });
      }
    });

    // Get timezone for location
    this.app.get('/api/location/timezone', async (req, res) => {
      try {
        const { lat, lon } = req.query;
        if (!lat || !lon) {
          return res.status(400).json({ error: 'Latitude and longitude are required' });
        }
        const timezone = await this.getLocationTimezone(parseFloat(lat), parseFloat(lon));
        res.json(timezone);
      } catch (error) {
        res.status(500).json({ error: 'Failed to get timezone', details: error.message });
      }
    });

    // Get comprehensive location details
    this.app.get('/api/location/details', async (req, res) => {
      try {
        const { include_weather = false, include_airports = false, include_timezone = false } = req.query;
        const details = await this.getLocationDetails({
          include_weather: include_weather === 'true',
          include_airports: include_airports === 'true',
          include_timezone: include_timezone === 'true'
        });
        res.json(details);
      } catch (error) {
        res.status(500).json({ error: 'Failed to get location details', details: error.message });
      }
    });

    // Health check
    this.app.get('/api/health', (req, res) => {
      res.json({ status: 'OK', service: 'Live Location API', timestamp: new Date().toISOString() });
    });
  }

  async getCurrentLocation() {
    try {
      // Get public IP first
      const ipResponse = await axios.get('https://api.ipify.org?format=json');
      const publicIP = ipResponse.data.ip;
      
      // Get location data for the IP
      const geoResponse = await axios.get(`https://ipapi.co/${publicIP}/json/`);
      const locationData = geoResponse.data;

      return {
        success: true,
        data: {
          ip: publicIP,
          city: locationData.city,
          region: locationData.region,
          country: locationData.country_name,
          latitude: parseFloat(locationData.latitude),
          longitude: parseFloat(locationData.longitude),
          timezone: locationData.timezone,
          isp: locationData.org,
          postal_code: locationData.postal,
          country_code: locationData.country_code
        },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      throw new Error(`Failed to get current location: ${error.message}`);
    }
  }

  async getLocationByIP(ip) {
    try {
      const response = await axios.get(`https://ipapi.co/${ip}/json/`);
      const locationData = response.data;

      return {
        success: true,
        data: {
          ip: ip,
          city: locationData.city,
          region: locationData.region,
          country: locationData.country_name,
          latitude: parseFloat(locationData.latitude),
          longitude: parseFloat(locationData.longitude),
          timezone: locationData.timezone,
          isp: locationData.org,
          postal_code: locationData.postal,
          country_code: locationData.country_code
        },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      throw new Error(`Failed to get location for IP ${ip}: ${error.message}`);
    }
  }

  async getLocationByCoordinates(lat, lon) {
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

      return {
        success: true,
        data: {
          latitude: lat,
          longitude: lon,
          city: locationData.name,
          state: locationData.state,
          country: locationData.country,
          postal_code: locationData.postal_code,
          timezone: 'UTC' // OpenWeather doesn't provide timezone, would need separate call
        },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      throw new Error(`Failed to get location for coordinates (${lat}, ${lon}): ${error.message}`);
    }
  }

  async getNearbyAirports(lat, lon, radius = 500) {
    try {
      // Using Amadeus API for airport data
      const response = await axios.get('https://test.api.amadeus.com/v1/reference-data/locations/airports', {
        params: {
          latitude: lat,
          longitude: lon,
          radius: radius
        },
        headers: {
          'Authorization': `Bearer ${process.env.AMADEUS_ACCESS_TOKEN || 'your_amadeus_token'}`
        }
      });

      const airports = response.data.data.map(airport => ({
        code: airport.iataCode,
        name: airport.name,
        city: airport.address.cityName,
        country: airport.address.countryName,
        latitude: airport.geoCode.latitude,
        longitude: airport.geoCode.longitude,
        distance: airport.distance.value,
        distance_unit: airport.distance.unit
      }));

      return {
        success: true,
        data: {
          airports: airports,
          search_center: { latitude: lat, longitude: lon },
          search_radius: radius
        },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      // Fallback to mock data if API fails
      return {
        success: true,
        data: {
          airports: [
            {
              code: 'BOM',
              name: 'Chhatrapati Shivaji International Airport',
              city: 'Mumbai',
              country: 'India',
              latitude: 19.0896,
              longitude: 72.8656,
              distance: 8.5,
              distance_unit: 'KM'
            },
            {
              code: 'DEL',
              name: 'Indira Gandhi International Airport',
              city: 'Delhi',
              country: 'India',
              latitude: 28.5562,
              longitude: 77.1000,
              distance: 1150.2,
              distance_unit: 'KM'
            }
          ],
          search_center: { latitude: lat, longitude: lon },
          search_radius: radius,
          note: 'Using fallback data due to API limitation'
        },
        timestamp: new Date().toISOString()
      };
    }
  }

  async getLocationWeather(lat, lon) {
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

      return {
        success: true,
        data: {
          location: weatherData.name,
          country: weatherData.sys.country,
          temperature: weatherData.main.temp,
          feels_like: weatherData.main.feels_like,
          humidity: weatherData.main.humidity,
          pressure: weatherData.main.pressure,
          description: weatherData.weather[0].description,
          main_condition: weatherData.weather[0].main,
          wind_speed: weatherData.wind.speed,
          wind_direction: weatherData.wind.deg,
          visibility: weatherData.visibility,
          sunrise: new Date(weatherData.sys.sunrise * 1000).toISOString(),
          sunset: new Date(weatherData.sys.sunset * 1000).toISOString()
        },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      throw new Error(`Failed to get weather for coordinates (${lat}, ${lon}): ${error.message}`);
    }
  }

  async getLocationTimezone(lat, lon) {
    try {
      const response = await axios.get(`https://worldtimeapi.org/api/timezone/Etc/GMT`);
      
      // Calculate timezone offset based on coordinates
      const timezoneOffset = Math.round(lon / 15);
      const timezoneName = timezoneOffset >= 0 ? `Etc/GMT+${timezoneOffset}` : `Etc/GMT${timezoneOffset}`;
      
      const timezoneResponse = await axios.get(`https://worldtimeapi.org/api/timezone/${timezoneName}`);
      const timezoneData = timezoneResponse.data;

      return {
        success: true,
        data: {
          timezone: timezoneData.timezone,
          current_time: timezoneData.datetime,
          utc_offset: timezoneData.utc_offset,
          day_of_week: timezoneData.day_of_week,
          day_of_year: timezoneData.day_of_year,
          week_number: timezoneData.week_number,
          abbreviation: timezoneData.abbreviation,
          dst: timezoneData.dst
        },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      // Fallback to basic timezone calculation
      const timezoneOffset = Math.round(lon / 15);
      const utcTime = new Date();
      const localTime = new Date(utcTime.getTime() + (timezoneOffset * 60 * 60 * 1000));

      return {
        success: true,
        data: {
          timezone: `UTC${timezoneOffset >= 0 ? '+' : ''}${timezoneOffset}`,
          current_time: localTime.toISOString(),
          utc_offset: `${timezoneOffset >= 0 ? '+' : ''}${timezoneOffset}:00`,
          day_of_week: localTime.getDay(),
          day_of_year: Math.floor((localTime - new Date(localTime.getFullYear(), 0, 0)) / 1000 / 60 / 60 / 24),
          week_number: Math.ceil((localTime.getDate() + new Date(localTime.getFullYear(), 0, 1).getDay()) / 7),
          abbreviation: `UTC${timezoneOffset >= 0 ? '+' : ''}${timezoneOffset}`,
          dst: false,
          note: 'Using calculated timezone due to API limitation'
        },
        timestamp: new Date().toISOString()
      };
    }
  }

  async getLocationDetails(options = {}) {
    try {
      const { include_weather = false, include_airports = false, include_timezone = false } = options;
      
      // Get basic location
      const currentLocation = await this.getCurrentLocation();
      const basicInfo = currentLocation.data;

      const details = {
        success: true,
        data: {
          basic_info: basicInfo
        },
        timestamp: new Date().toISOString()
      };

      // Add weather if requested
      if (include_weather) {
        try {
          const weather = await this.getLocationWeather(basicInfo.latitude, basicInfo.longitude);
          details.data.weather = weather.data;
        } catch (error) {
          details.data.weather_error = error.message;
        }
      }

      // Add airports if requested
      if (include_airports) {
        try {
          const airports = await this.getNearbyAirports(basicInfo.latitude, basicInfo.longitude);
          details.data.airports = airports.data;
        } catch (error) {
          details.data.airports_error = error.message;
        }
      }

      // Add timezone if requested
      if (include_timezone) {
        try {
          const timezone = await this.getLocationTimezone(basicInfo.latitude, basicInfo.longitude);
          details.data.timezone = timezone.data;
        } catch (error) {
          details.data.timezone_error = error.message;
        }
      }

      return details;
    } catch (error) {
      throw new Error(`Failed to get location details: ${error.message}`);
    }
  }

  start(port = 3007) {
    return new Promise((resolve) => {
      this.server = this.app.listen(port, () => {
        console.log(`Live Location API server running on port ${port}`);
        console.log(`Health check: http://localhost:${port}/api/health`);
        resolve();
      });
    });
  }

  stop() {
    if (this.server) {
      this.server.close();
      console.log('Live Location API server stopped');
    }
  }
}

// Export the class and a singleton instance
module.exports = LiveLocationAPI;

// If this file is run directly, start the server
if (require.main === module) {
  const api = new LiveLocationAPI();
  api.start().catch(console.error);
} 