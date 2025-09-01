const axios = require('axios');

/**
 * Live Location Functions - Standalone utility functions
 * These can be used directly without running a server
 */

/**
 * Get current location by IP address
 * @returns {Promise<Object>} Location data
 */
async function getCurrentLocation() {
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

/**
 * Get location information for a specific IP address
 * @param {string} ip - IP address to get location for
 * @returns {Promise<Object>} Location data
 */
async function getLocationByIP(ip) {
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

/**
 * Get location information for specific coordinates
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @returns {Promise<Object>} Location data
 */
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

    return {
      success: true,
      data: {
        latitude: lat,
        longitude: lon,
        city: locationData.name,
        state: locationData.state,
        country: locationData.country,
        postal_code: locationData.postal_code,
        timezone: 'UTC' // OpenWeather doesn't provide timezone
      },
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    throw new Error(`Failed to get location for coordinates (${lat}, ${lon}): ${error.message}`);
  }
}

/**
 * Get nearby airports for given coordinates
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @param {number} radius - Search radius in kilometers (default: 500)
 * @returns {Promise<Object>} Airport data
 */
async function getNearbyAirports(lat, lon, radius = 500) {
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

/**
 * Get weather information for given coordinates
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @returns {Promise<Object>} Weather data
 */
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

/**
 * Get timezone information for given coordinates
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @returns {Promise<Object>} Timezone data
 */
async function getLocationTimezone(lat, lon) {
  try {
    // Calculate timezone offset based on longitude
    const timezoneOffset = Math.round(lon / 15);
    const timezoneName = timezoneOffset >= 0 ? `Etc/GMT+${timezoneOffset}` : `Etc/GMT${timezoneOffset}`;
    
    const response = await axios.get(`https://worldtimeapi.org/api/timezone/${timezoneName}`);
    const timezoneData = response.data;

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

/**
 * Get comprehensive location details
 * @param {Object} options - Options for what to include
 * @param {boolean} options.include_weather - Include weather information
 * @param {boolean} options.include_airports - Include nearby airports
 * @param {boolean} options.include_timezone - Include timezone information
 * @returns {Promise<Object>} Comprehensive location data
 */
async function getLocationDetails(options = {}) {
  try {
    const { include_weather = false, include_airports = false, include_timezone = false } = options;
    
    // Get basic location
    const currentLocation = await getCurrentLocation();
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
        const weather = await getLocationWeather(basicInfo.latitude, basicInfo.longitude);
        details.data.weather = weather.data;
      } catch (error) {
        details.data.weather_error = error.message;
      }
    }

    // Add airports if requested
    if (include_airports) {
      try {
        const airports = await getNearbyAirports(basicInfo.latitude, basicInfo.longitude);
        details.data.airports = airports.data;
      } catch (error) {
        details.data.airports_error = error.message;
      }
    }

    // Add timezone if requested
    if (include_timezone) {
      try {
        const timezone = await getLocationTimezone(basicInfo.latitude, basicInfo.longitude);
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

// Export all functions
module.exports = {
  getCurrentLocation,
  getLocationByIP,
  getLocationByCoordinates,
  getNearbyAirports,
  getLocationWeather,
  getLocationTimezone,
  getLocationDetails
}; 