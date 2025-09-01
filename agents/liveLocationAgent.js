const axios = require('axios');

async function getLiveLocation() {
  try {
    // The MCP server should be running on localhost:5004/a2a
    const response = await axios.post('http://localhost:5004/a2a', {
      tool: 'get_live_location'
    });
    return response.data.content.text;
  } catch (error) {
    return { error: 'Could not fetch live location', details: error.message };
  }
}

module.exports = { getLiveLocation };
