const express = require('express');
const dotenv = require('dotenv');
const axios = require('axios');

dotenv.config();
const app = express();
app.use(express.json());

// --- Zoom API Functions ---
async function getAccessToken() {
  const { ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET, ZOOM_ACCOUNT_ID } = process.env;
  const tokenUrl = `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${ZOOM_ACCOUNT_ID}`;
  try {
    const response = await axios.post(tokenUrl, null, {
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${ZOOM_CLIENT_ID}:${ZOOM_CLIENT_SECRET}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    return response.data.access_token;
  } catch (error) {
    console.error('Error fetching access token:', error.response?.data || error.message);
    throw error;
  }
}

async function listMeetings() {
  const accessToken = await getAccessToken();
  
  const response = await axios.get('https://api.zoom.us/v2/users/me/meetings', {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  console.log("🔍 Zoom MCP Server - List meetings response:", JSON.stringify(response.data, null, 2));
  return response.data;
}

async function listTodayMeetings() {
  const accessToken = await getAccessToken();
  
  // Get today's and tomorrow's dates in YYYY-MM-DD format
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const todayStr = today.toISOString().split('T')[0];
  const tomorrowStr = tomorrow.toISOString().split('T')[0];
  
  console.log(`🔍 Zoom MCP Server - Fetching meetings from ${todayStr} to ${tomorrowStr}`);
  
  try {
    // First, get upcoming meetings to include today's and tomorrow's meetings
    const upcomingResponse = await axios.get('https://api.zoom.us/v2/users/me/meetings?type=upcoming&page_size=100', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    
    // Filter meetings for today and tomorrow
    const allMeetings = upcomingResponse.data.meetings || [];
    const todayTomorrowMeetings = allMeetings.filter(meeting => {
      const meetingDate = new Date(meeting.start_time);
      const meetingDateStr = meetingDate.toISOString().split('T')[0];
      return meetingDateStr === todayStr || meetingDateStr === tomorrowStr;
    });
    
    // Also try to get metrics data for additional information
    let metricsData = null;
    try {
      const metricsResponse = await axios.get(`https://api.zoom.us/v2/metrics/meetings?from=${todayStr}&to=${todayStr}`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      metricsData = metricsResponse.data;
      console.log("🔍 Zoom MCP Server - Metrics data:", JSON.stringify(metricsData, null, 2));
    } catch (metricsError) {
      console.log("⚠️ Could not fetch metrics data:", metricsError.message);
    }
    
    // Combine the data
    const result = {
      page_size: upcomingResponse.data.page_size,
      total_records: todayTomorrowMeetings.length,
      next_page_token: upcomingResponse.data.next_page_token,
      meetings: todayTomorrowMeetings,
      metrics: metricsData,
      date_range: {
        from: todayStr,
        to: tomorrowStr,
        today: todayStr,
        tomorrow: tomorrowStr
      },
      summary: {
        total_meetings: todayTomorrowMeetings.length,
        today_meetings: todayTomorrowMeetings.filter(m => {
          const meetingDate = new Date(m.start_time);
          return meetingDate.toISOString().split('T')[0] === todayStr;
        }).length,
        tomorrow_meetings: todayTomorrowMeetings.filter(m => {
          const meetingDate = new Date(m.start_time);
          return meetingDate.toISOString().split('T')[0] === tomorrowStr;
        }).length
      }
    };
    
    console.log("🔍 Zoom MCP Server - List today/tomorrow meetings response:", JSON.stringify(result, null, 2));
    return result;
    
  } catch (error) {
    console.error("❌ Error fetching today's meetings:", error.response?.data || error.message);
    throw error;
  }
}

async function getMeetingDetails(meetingId) {
  const accessToken = await getAccessToken();
  const response = await axios.get(`https://api.zoom.us/v2/meetings/${meetingId}`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  return response.data;
}

async function createMeeting(meetingData) {
  const accessToken = await getAccessToken();
  console.log("🔍 Zoom MCP Server - Received meeting data:", JSON.stringify(meetingData, null, 2));
  console.log("🔍 Zoom MCP Server - Access token:", accessToken ? "Present" : "Missing");

  // Only send allowed fields to Zoom
  const allowedFields = [
    'topic', 'type', 'start_time', 'duration', 'timezone', 'agenda', 'password', 'settings', 'host_email'
  ];
  const filteredMeetingData = {};
  for (const key of allowedFields) {
    if (meetingData[key] !== undefined) filteredMeetingData[key] = meetingData[key];
  }
  console.log('🔍 Filtered meeting data sent to Zoom:', JSON.stringify(filteredMeetingData, null, 2));

  const response = await axios.post('https://api.zoom.us/v2/users/me/meetings', filteredMeetingData, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  });

  console.log("🔍 Zoom MCP Server - Zoom API response:", JSON.stringify(response.data, null, 2));
  return response.data;
}

async function deleteMeeting(meetingId) {
  const accessToken = await getAccessToken();
  const response = await axios.delete(`https://api.zoom.us/v2/meetings/${meetingId}`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  return response.status === 204;
}

async function listPastMeetingParticipants(meetingUUID) {
  const accessToken = await getAccessToken();
  const encodedUUID = encodeURIComponent(meetingUUID);
  const response = await axios.get(`https://api.zoom.us/v2/past_meetings/${encodedUUID}/participants`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  return response.data;
}

// --- Express Endpoints ---
app.post('/tools/zoom_list_meetings', async (req, res) => {
  try {
    const data = await listMeetings();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.response?.data || error.message });
  }
});

app.post('/tools/zoom_list_today_meetings', async (req, res) => {
  try {
    const data = await listTodayMeetings();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.response?.data || error.message });
  }
});

app.post('/tools/zoom_get_meeting_details', async (req, res) => {
  try {
    const { meetingId } = req.body;
    const data = await getMeetingDetails(meetingId);
    console.log("data22 ", data);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.response?.data || error.message });
  }
});

app.post('/tools/zoom_create_meeting', async (req, res) => {
  try {
    const meetingData = req.body;
    console.log("data23 ", meetingData);
    const data = await createMeeting(meetingData);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.response?.data || error.message });
  }
});

app.post('/tools/zoom_delete_meeting', async (req, res) => {
  try {
    const { meetingId } = req.body;
    const success = await deleteMeeting(meetingId);
    res.json({ success });
  } catch (error) {
    // Handle Zoom API errors properly
    if (error.response && error.response.data) {
      // Zoom API returned an error (like meeting not found)
      res.status(400).json({ error: error.response.data });
    } else {
      // Other server errors
      res.status(500).json({ error: error.message });
    }
  }
});

app.post('/tools/zoom_list_past_meeting_participants', async (req, res) => {
  try {
    const { meetingUUID } = req.body;
    const data = await listPastMeetingParticipants(meetingUUID);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.response?.data || error.message });
  }
});

// Unified tool call endpoint
app.post('/tools/call', async (req, res) => {
  const { tool_name, parameters } = req.body;
  try {
    if (tool_name === 'zoom_list_meetings') {
      return res.json(await listMeetings());
    }
    if (tool_name === 'zoom_list_today_meetings') {
      return res.json(await listTodayMeetings());
    }
    if (tool_name === 'zoom_get_meeting_details') {
      return res.json(await getMeetingDetails(parameters.meetingId));
    }
    if (tool_name === 'zoom_create_meeting') {
      return res.json(await createMeeting(parameters));
    }
    if (tool_name === 'zoom_delete_meeting') {
      return res.json({ success: await deleteMeeting(parameters.meetingId) });
    }
    if (tool_name === 'zoom_list_past_meeting_participants') {
      return res.json(await listPastMeetingParticipants(parameters.meetingUUID));
    }
    return res.status(400).json({ error: 'Unknown tool' });
  } catch (error) {
    return res.status(500).json({ error: error.response?.data || error.message });
  }
});

// Tool manifest endpoint
app.get('/.well-known/ai-plugin.json', (req, res) => {
  res.json({
    schema_version: 'v1',
    name: 'Zoom MCP Server',
    tools: [
      {
        name: 'zoom_list_meetings',
        description: 'List all meetings for the authenticated Zoom user',
        parameters: {}
      },
      {
        name: 'zoom_list_today_meetings',
        description: 'List meetings for today and tomorrow with metrics data and date range information',
        parameters: {}
      },
      {
        name: 'zoom_get_meeting_details',
        description: 'Get details for a specific Zoom meeting by meetingId',
        parameters: { meetingId: 'string' }
      },
      {
        name: 'zoom_create_meeting',
        description: 'Create a new Zoom meeting for the authenticated user',
        parameters: { /* meetingData object */ }
      },
      {
        name: 'zoom_delete_meeting',
        description: 'Delete a Zoom meeting by meetingId',
        parameters: { meetingId: 'string' }
      },
      {
        name: 'zoom_list_past_meeting_participants',
        description: 'List participants of a past Zoom meeting by meetingUUID',
        parameters: { meetingUUID: 'string' }
      }
    ]
  });
});

const PORT = process.env.PORT || 3008;
app.listen(PORT, () => {
  console.log(`🟢 Zoom MCP server running at http://localhost:${PORT}`);
});
