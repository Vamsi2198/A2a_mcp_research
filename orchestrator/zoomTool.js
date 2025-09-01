const zoomTools = [
    {
      tool: "zoom_list_meetings",
      name: "zoom_list_meetings",
      description: "List all meetings for the authenticated Zoom user.",
      endpoint: "POST /tools/zoom_list_meetings",
      parameters: {},
      schema: {
        type: "object",
        properties: {},
        required: []
      },
      example_request: {},
      example_response: {
        page_count: 1,
        page_number: 1,
        page_size: 30,
        total_records: 1,
        meetings: [
          {
            uuid: "string",
            id: 123456789,
            host_id: "string",
            topic: "API Created Meeting",
            type: 2,
            start_time: "2025-06-30T15:00:00",
            duration: 30,
            timezone: "Asia/Kolkata",
            agenda: "Discuss Q3 goals"
          }
        ]
      }
    },
    {
      tool: "zoom_list_today_meetings",
      name: "zoom_list_today_meetings",
      description: "List meetings for today and tomorrow with metrics data and date range information. Uses metrics API and filters meetings by date range.",
      endpoint: "POST /tools/zoom_list_today_meetings",
      parameters: {},
      schema: {
        type: "object",
        properties: {},
        required: []
      },
      example_request: {},
      example_response: {
        page_size: 100,
        total_records: 3,
        next_page_token: "",
        meetings: [
          {
            uuid: "string",
            id: 123456789,
            host_id: "string",
            topic: "Today's Meeting",
            type: 2,
            start_time: "2025-07-24T10:00:00Z",
            duration: 60,
            timezone: "Asia/Kolkata",
            agenda: "Daily standup",
            join_url: "https://zoom.us/j/123456789"
          }
        ],
        metrics: {
          from: "2025-07-24",
          to: "2025-07-24",
          meetings: []
        },
        date_range: {
          from: "2025-07-24",
          to: "2025-07-25",
          today: "2025-07-24",
          tomorrow: "2025-07-25"
        },
        summary: {
          total_meetings: 3,
          today_meetings: 2,
          tomorrow_meetings: 1
        }
      }
    },
    {
      tool: "zoom_get_meeting_details",
      name: "zoom_get_meeting_details",
      description: "Get details for a specific Zoom meeting by meetingId.",
      endpoint: "POST /tools/zoom_get_meeting_details",
      parameters: { meetingId: "string (required) - The Zoom meeting ID" },
      schema: {
        type: "object",
        properties: {
          meetingId: { type: "string", description: "The Zoom meeting ID" }
        },
        required: ["meetingId"]
      },
      example_request: { meetingId: "123456789" },
      example_response: {
        id: 123456789,
        topic: "API Created Meeting",
        type: 2,
        start_time: "2025-06-30T15:00:00",
        duration: 30,
        timezone: "Asia/Kolkata",
        agenda: "Discuss Q3 goals",
        settings: { host_video: true, participant_video: true }
      }
    },
    {
      tool: "zoom_create_meeting",
      name: "zoom_create_meeting",
      description: "Create a new Zoom meeting for the authenticated user.",
      endpoint: "POST /tools/zoom_create_meeting",
      parameters: {
        topic: "string (required)",
        type: "number (required) - 2 for scheduled meeting",
        start_time: "string (required) - ISO format",
        duration: "number (required) - Duration in minutes",
        timezone: "string (required)",
        agenda: "string (required)",
        password: "string (optional) - Meeting password",
        host_email: "string (optional) - Host's Zoom email",
        settings: "object (optional) - Meeting settings"
      },
      schema: {
        type: "object",
        properties: {
          topic: { type: "string", description: "Meeting topic/title" },
          type: { type: "number", description: "Meeting type (2 for scheduled meeting)" },
          start_time: { type: "string", description: "Start time in ISO format" },
          duration: { type: "number", description: "Duration in minutes" },
          timezone: { type: "string", description: "Timezone (e.g., Asia/Kolkata)" },
          agenda: { type: "string", description: "Meeting agenda" },
          password: { type: "string", description: "Meeting password (optional)" },
          host_email: { type: "string", description: "Host's Zoom email (optional)" },
          settings: { type: "object", description: "Meeting settings (optional)" }
        },
        required: ["topic", "type", "start_time", "duration", "timezone", "agenda"]
      },
      example_request: {
        topic: "API Created Meeting",
        type: 2,
        start_time: "2025-06-28T4:30:00",
        duration: 60,
        timezone: "Asia/Kolkata",
        agenda: "Discussion on quarterly results and strategic planning",
        password: "mySecret123",
        host_email: "host@example.com",
        settings: {}
      },
      example_response: {
        id: 987654321,
        join_url: "https://zoom.us/j/987654321",
        start_url: "https://zoom.us/s/987654321?zak=...",
        topic: "API Created Meeting"
      }
    },
    {
      tool: "zoom_delete_meeting",
      name: "zoom_delete_meeting",
      description: "Delete a Zoom meeting by meetingId.",
      endpoint: "POST /tools/zoom_delete_meeting",
      parameters: { meetingId: "string (required) - The Zoom meeting ID" },
      schema: {
        type: "object",
        properties: {
          meetingId: { type: "string", description: "The Zoom meeting ID" }
        },
        required: ["meetingId"]
      },
      example_request: { meetingId: "123456789" },
      example_response: { success: true }
    },
    {
      tool: "zoom_list_past_meeting_participants",
      name: "zoom_list_past_meeting_participants",
      description: "List participants of a past Zoom meeting by meetingUUID.",
      endpoint: "POST /tools/zoom_list_past_meeting_participants",
      parameters: { meetingUUID: "string (required) - The UUID of the past meeting" },
      schema: {
        type: "object",
        properties: {
          meetingUUID: { type: "string", description: "The UUID of the past meeting" }
        },
        required: ["meetingUUID"]
      },
      example_request: { meetingUUID: "abc123xyz==" },
      example_response: {
        participants: [
          { id: "user1", name: "Alice", email: "alice@example.com", join_time: "2025-06-30T15:00:00Z" },
          { id: "user2", name: "Bob", email: "bob@example.com", join_time: "2025-06-30T15:01:00Z" }
        ]
      }
    }
  ];

module.exports = zoomTools;