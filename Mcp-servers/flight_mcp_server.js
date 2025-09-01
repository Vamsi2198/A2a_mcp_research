// src/Mcp-servers/flight_mcp_server.js
require('dotenv').config();
const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json());

class AmadeusFlightAPI {
  constructor() {
    this.baseURL = 'https://test.api.amadeus.com';
    this.accessToken = null;
    this.tokenExpiry = null;
  }

  async getAccessToken() {
    try {
      if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
        return this.accessToken;
      }
      console.log('🔐 Getting new access token...');
      const params = new URLSearchParams();
      params.append('grant_type', 'client_credentials');
      params.append('client_id', process.env.FLIGHTS_API_KEY);
      params.append('client_secret', process.env.FLIGHTS_API_SECRET);
      const response = await axios.post(`${this.baseURL}/v1/security/oauth2/token`, params, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
      this.accessToken = response.data.access_token;
      this.tokenExpiry = Date.now() + (25 * 60 * 1000);
      console.log('✅ Access token obtained');
      return this.accessToken;
    } catch (error) {
      console.error('❌ Error getting access token:', error.response?.data || error.message);
      throw new Error('Failed to authenticate with Amadeus API');
    }
  }

  async makeRequest(endpoint, params = {}) {
    try {
      const token = await this.getAccessToken();
      console.log('🔍 Token23:', params);
      console.log('🔍 Token22:', token);
      const response = await axios.get(`${this.baseURL}${endpoint}`, {
        params,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      return response.data;
    } catch (error) {
      console.error('❌ API request failed:', error.response?.data || error.message);
      throw error;
    }
  }

  async searchFlights(origin, destination, departureDate, adults = 1, max = 5) {
    console.log(`🛫 Searching flights: ${origin} → ${destination} on ${departureDate}`);
    const params = {
      originLocationCode: origin,
      destinationLocationCode: destination,
      departureDate,
      adults,
      max
    };
    return await this.makeRequest('/v2/shopping/flight-offers', params);
  }

  async getFlightPricing(flightOffers) {
    console.log('💰 Getting flight pricing...');
    const response = await axios.post(`${this.baseURL}/v1/shopping/flight-offers/pricing`, {
      data: {
        type: 'flight-offers-pricing',
        flightOffers
      }
    }, {
      headers: {
        'Authorization': `Bearer ${await this.getAccessToken()}`,
        'Content-Type': 'application/json'
      }
    });
    return response.data;
  }

  async searchLocations(keyword, subType = 'CITY') {
    console.log(`🔍 Searching locations for: ${keyword}`);
    const params = { keyword, subType };
    return await this.makeRequest('/v1/reference-data/locations', params);
  }

  async getFlightDestinations(origin, departureDate, max = 5) {
    console.log(`🌍 Getting flight destinations from: ${origin}`);
    const params = { origin, departureDate, max };
    return await this.makeRequest('/v1/shopping/flight-destinations', params);
  }

  async bookFlight(flightOffer, travelerInfo) {
    console.log('✈️ Booking flight...');
    const response = await axios.post(`${this.baseURL}/v1/booking/flight-orders`, {
      data: {
        type: 'flight-order',
        flightOffers: [flightOffer],
        travelers: travelerInfo
      }
    }, {
      headers: {
        'Authorization': `Bearer ${await this.getAccessToken()}`,
        'Content-Type': 'application/json'
      }
    });
    return response.data;
  }
}

const amadeusAPI = new AmadeusFlightAPI();

// A2A endpoint that the orchestrator calls
app.post('/a2a', async (req, res) => {
  try {
    const { tool, ...parameters } = req.body;
    console.log(`🛫 FlightSearchAgent called with tool: ${tool}`);

    let result;
    
    switch (tool) {
      case 'search_flights':
        const { source, destination, date, adults = 1, max = 5 } = parameters;
        const flightResult = await amadeusAPI.searchFlights(source, destination, date, adults, max);
        if (!flightResult.data || flightResult.data.length === 0) {
          result = 'No flights found for the specified criteria.';
        } else {
          const flights = flightResult.data.map((flight, index) => {
            const segment = flight.itineraries[0].segments[0];
            const airline = segment.carrierCode;
            const departure = segment.departure;
            const arrival = segment.arrival;
            return `${index + 1}. ${airline} ${segment.number} | ${departure.iataCode} → ${arrival.iataCode}\nDeparture: ${departure.at} | Arrival: ${arrival.at}\nDuration: ${flight.itineraries[0].duration}\nPrice: $${flight.price.total} ${flight.price.currency}`;
          });
          result = `Found ${flightResult.data.length} flights:\n\n${flights.join('\n\n')}`;
        }
        break;

      case 'search_locations':
        const { keyword, subType = 'CITY' } = parameters;
        const locationResult = await amadeusAPI.searchLocations(keyword, subType);
        if (!locationResult.data || locationResult.data.length === 0) {
          result = 'No locations found for the specified keyword.';
        } else {
          const locations = locationResult.data.map((location, index) => {
            return `${index + 1}. ${location.name} (${location.iataCode})\nType: ${location.subType}\nCountry: ${location.address.countryName}\nCity: ${location.address.cityName}`;
          });
          result = `Found ${locationResult.data.length} locations:\n\n${locations.join('\n\n')}`;
        }
        break;

      case 'book_flight':
        const { flightOffer, travelerInfo } = parameters;
        if (!flightOffer || !travelerInfo) {
          result = 'Missing required parameters: flightOffer and travelerInfo are required.';
        } else {
          const bookingResult = await amadeusAPI.bookFlight(flightOffer, travelerInfo);
          if (bookingResult.data && bookingResult.data.id) {
            const booking = bookingResult.data;
            const flight = booking.flightOffers[0];
            const segment = flight.itineraries[0].segments[0];
            result = `✅ Flight booked successfully!\n\n📋 Booking Details:\nBooking ID: ${booking.id}\nStatus: ${booking.status}\n\n✈️ Flight Information:\nAirline: ${segment.carrierCode} ${segment.number}\nRoute: ${segment.departure.iataCode} → ${segment.arrival.iataCode}\nDeparture: ${segment.departure.at}\nArrival: ${segment.arrival.at}\nDuration: ${flight.itineraries[0].duration}\n\n💰 Pricing:\nTotal Price: $${flight.price.total} ${flight.price.currency}\n\n👥 Travelers: ${booking.travelers.length} passenger(s)`;
          } else {
            result = 'Flight booking completed but no booking details received.';
          }
        }
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
    console.error('Error in flight search agent:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Legacy endpoints for backward compatibility
app.post('/search_flights', async (req, res) => {
  const { origin, destination, departureDate, adults = 1, max = 5 } = req.body;
  try {
    const result = await amadeusAPI.searchFlights(origin, destination, departureDate, adults, max);
    if (!result.data || result.data.length === 0) {
      return res.json({ text: 'No flights found for the specified criteria.' });
    }
    const flights = result.data.map((flight, index) => {
      const segment = flight.itineraries[0].segments[0];
      const airline = segment.carrierCode;
      const departure = segment.departure;
      const arrival = segment.arrival;
      return `${index + 1}. ${airline} ${segment.number} | ${departure.iataCode} → ${arrival.iataCode}\nDeparture: ${departure.at} | Arrival: ${arrival.at}\nDuration: ${flight.itineraries[0].duration}\nPrice: $${flight.price.total} ${flight.price.currency}\nStops: ${flight.itineraries[0].segments.length - 1}`;
    });
    res.json({ text: `Found ${result.data.length} flights:\n\n${flights.join('\n\n')}` });
  } catch (error) {
    res.json({ text: `Error searching flights: ${error.message}` });
  }
});

// Get Flight Pricing
app.post('/get_flight_pricing', async (req, res) => {
  const { flightOffers } = req.body;
  try {
    const result = await amadeusAPI.getFlightPricing(flightOffers);
    if (!result.data || result.data.length === 0) {
      return res.json({ text: 'No pricing information available.' });
    }
    const pricing = result.data.map((offer, index) => {
      return `${index + 1}. ${offer.itineraries[0].segments[0].carrierCode} ${offer.itineraries[0].segments[0].number}\nPrice: $${offer.price.total} ${offer.price.currency}\nStatus: ${offer.pricingOptions.fareType}\nIncluded: ${offer.pricingOptions.includedCheckedBags.weight}kg checked baggage`;
    });
    res.json({ text: `Pricing information:\n\n${pricing.join('\n\n')}` });
  } catch (error) {
    res.json({ text: `Error getting pricing: ${error.message}` });
  }
});

// Search Locations
app.post('/search_locations', async (req, res) => {
  const { keyword, subType = 'CITY' } = req.body;
  try {
    const result = await amadeusAPI.searchLocations(keyword, subType);
    if (!result.data || result.data.length === 0) {
      return res.json({ text: 'No locations found for the specified keyword.' });
    }
    const locations = result.data.map((location, index) => {
      return `${index + 1}. ${location.name} (${location.iataCode})\nType: ${location.subType}\nCountry: ${location.address.countryName}\nCity: ${location.address.cityName}`;
    });
    res.json({ text: `Found ${result.data.length} locations:\n\n${locations.join('\n\n')}` });
  } catch (error) {
    res.json({ text: `Error searching locations: ${error.message}` });
  }
});

// Get Flight Destinations
app.post('/get_flight_destinations', async (req, res) => {
  const { origin, departureDate, max = 5 } = req.body;
  try {
    const result = await amadeusAPI.getFlightDestinations(origin, departureDate, max);
    if (!result.data || result.data.length === 0) {
      return res.json({ text: 'No destinations found from the specified origin.' });
    }
    const destinations = result.data.map((dest, index) => {
      return `${index + 1}. ${dest.destination} (${dest.destinationCode})\nPrice: $${dest.price.total} ${dest.price.currency}\nDeparture: ${dest.departureDate}\nReturn: ${dest.returnDate || 'One-way'}`;
    });
    res.json({ text: `Found ${result.data.length} destinations:\n\n${destinations.join('\n\n')}` });
  } catch (error) {
    res.json({ text: `Error getting destinations: ${error.message}` });
  }
});

// Book Flight
app.post('/book_flight', async (req, res) => {
  const { flightOffer, travelerInfo } = req.body;
  try {
    if (!flightOffer || !travelerInfo) {
      return res.json({ text: 'Missing required parameters: flightOffer and travelerInfo are required.' });
    }
    
    const result = await amadeusAPI.bookFlight(flightOffer, travelerInfo);
    
    if (result.data && result.data.id) {
      const booking = result.data;
      const flight = booking.flightOffers[0];
      const segment = flight.itineraries[0].segments[0];
      
      const bookingSummary = `✅ Flight booked successfully!\n\n📋 Booking Details:\nBooking ID: ${booking.id}\nStatus: ${booking.status}\n\n✈️ Flight Information:\nAirline: ${segment.carrierCode} ${segment.number}\nRoute: ${segment.departure.iataCode} → ${segment.arrival.iataCode}\nDeparture: ${segment.departure.at}\nArrival: ${segment.arrival.at}\nDuration: ${flight.itineraries[0].duration}\n\n💰 Pricing:\nTotal Price: $${flight.price.total} ${flight.price.currency}\n\n👥 Travelers: ${booking.travelers.length} passenger(s)`;
      
      res.json({ text: bookingSummary });
    } else {
      res.json({ text: 'Flight booking completed but no booking details received.' });
    }
  } catch (error) {
    console.error('❌ Booking error:', error.response?.data || error.message);
    res.json({ text: `Error booking flight: ${error.response?.data?.errors?.[0]?.detail || error.message}` });
  }
});

// Health check
app.get('/health', async (req, res) => {
  try {
    await amadeusAPI.getAccessToken();
    res.json({ status: 'OK', message: 'Flight MCP Server is healthy and connected to Amadeus API' });
  } catch (error) {
    res.json({ status: 'ERROR', message: `Health check failed: ${error.message}` });
  }
});

app.listen(5002, () => {
  console.log('🚀 Flight MCP Server running on http://localhost:5002');
});
