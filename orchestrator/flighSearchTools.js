// src/orchestrator/flighSearchTools.js

const flightSearchTools = [
  {
    tool: "search_flights",
    name: "search_flights",
    description: "Search for available flights between two cities or airports on a specific date using the Amadeus API.",
    endpoint: "POST /flights/search",
    api_url: "https://test.api.amadeus.com/v2/shopping/flight-offers",
    parameters: {
      source: "string (required) - IATA code of the departure city/airport",
      destination: "string (required) - IATA code of the arrival city/airport",
      date: "string (required) - Departure date in YYYY-MM-DD format",
      adults: "number (optional) - Number of adult passengers",
      max: "number (optional) - Maximum number of results"
    },
    schema: {
      type: "object",
      properties: {
        source: { type: "string", description: "IATA code of the departure city/airport" },
        destination: { type: "string", description: "IATA code of the arrival city/airport" },
        date: { type: "string", description: "Departure date in YYYY-MM-DD format" },
        adults: { type: "number", description: "Number of adult passengers" },
        max: { type: "number", description: "Maximum number of results" }
      },
      required: ["source", "destination", "date"]
    },
    call: { type: "http", endpoint: "http://localhost:6002/search_flights" },
    example_request: {
      source: "HYD",
      destination: "DEL",
      date: "2025-07-18",
      adults: 1,
      max: 5
    },
    example_response: {
      text: "Found 5 flights:\n\n1. AI 2888 | HYD → BLR\nDeparture: 2025-07-18T05:30:00 | Arrival: 2025-07-18T06:50:00\nDuration: PT1H20M\nPrice: $43.38 EUR\n..."
    }
  },
  {
    tool: "book_flight",
    name: "book_flight",
    description: "Book a flight using a validated flight offer and traveler information via the Amadeus API.",
    endpoint: "POST /flights/book",
    api_url: "https://test.api.amadeus.com/v1/booking/flight-orders",
    parameters: {
      flightOffer: "object (required) - The flight offer object to book",
      travelerInfo: "array (required) - Array of traveler information objects"
    },
    schema: {
      type: "object",
      properties: {
        flightOffer: { type: "object", description: "The flight offer object to book" },
        travelerInfo: { type: "array", description: "Array of traveler information objects" }
      },
      required: ["flightOffer", "travelerInfo"]
    },
    call: { type: "http", endpoint: "http://localhost:6002/book_flight" },
    example_request: {
      flightOffer: { /* ...flight offer object... */ },
      travelerInfo: [{ /* ...traveler info... */ }]
    },
    example_response: {
      text: "✅ Flight booked successfully!\n\n📋 Booking Details:\nBooking ID: 123456\nStatus: CONFIRMED\n..."
    }
  },
  {
    tool: "search_locations",
    name: "search_locations",
    description: "Find IATA airport/city codes for a given city name using the Amadeus API.",
    endpoint: "POST /flights/locations",
    api_url: "https://test.api.amadeus.com/v1/reference-data/locations",
    parameters: {
      keyword: "string (required) - City name or keyword to search for"
    },
    schema: {
      type: "object",
      properties: {
        keyword: { type: "string", description: "City name or keyword to search for" }
      },
      required: ["keyword"]
    },
    call: { type: "http", endpoint: "http://localhost:6002/search_locations" },
    example_request: {
      keyword: "London"
    },
    example_response: {
      text: "Found 3 locations:\n\n1. LONDON (LON)\nType: CITY\nCountry: UNITED KINGDOM\nCity: LONDON\n..."
    }
  }
];

module.exports = { flightSearchTools };
