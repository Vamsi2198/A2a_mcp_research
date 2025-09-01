const teamsTools = [
    {
      tool: "teams_send_message",
      name: "teams_send_message",
      description: "Send a message to a Microsoft Teams channel using webhook integration",
      endpoint: "POST /tools/teams_send_message",
      parameters: {
        message: "string (required) - The message content to send to Teams channel",
        channel: "string (optional) - The specific channel name (if multiple channels configured)",
        priority: "string (optional) - Message priority (normal, high, urgent)",
        attachments: "array (optional) - Array of file attachments or rich content"
      },
      schema: {
        type: "object",
        properties: {
          message: { 
            type: "string", 
            description: "The message content to send to Teams channel (supports markdown)" 
          },
          channel: { 
            type: "string", 
            description: "The specific channel name (if multiple channels configured)" 
          },
          priority: { 
            type: "string", 
            description: "Message priority level",
            enum: ["normal", "high", "urgent"]
          },
          attachments: { 
            type: "array", 
            description: "Array of file attachments or rich content",
            items: { type: "object" }
          }
        },
        required: ["message"]
      },
      response_format: {
        success: "boolean - Whether the message was sent successfully",
        messageId: "string - The unique identifier of the sent message",
        sentDateTime: "string - ISO timestamp when the message was sent",
        channel: "string - The channel where the message was sent",
        error: "string (optional) - Error message if sending failed"
      },
      example_request: {
        message: "🚀 **Sales Update Alert**\n\n📊 **Q1 2025 Sales Summary:**\n• Total Sales: $577,413.84\n• Top Region: Kochi ($250,034.26)\n• Regions: 4 active regions\n\n🏆 **Top Performers:**\n1. Kochi - 43.3% of total\n2. LA - 28.2% of total\n3. Jaipur - 17.7% of total\n\n📅 **Time Period:** Q1 2025 (January - March)",
        channel: "sales-updates",
        priority: "high"
      },
      example_response: {
        success: true,
        messageId: "msg_123456789",
        sentDateTime: "2025-07-22T10:30:00.000Z",
        channel: "sales-updates"
      }
    },
    
    {
      tool: "teams_send_alert",
      name: "teams_send_alert",
      description: "Send an alert notification to Microsoft Teams with enhanced formatting and urgency indicators",
      endpoint: "POST /tools/teams_send_alert",
      parameters: {
        title: "string (required) - Alert title",
        message: "string (required) - Alert message content",
        severity: "string (required) - Alert severity (info, warning, error, critical)",
        channel: "string (optional) - Target channel name",
        actions: "array (optional) - Array of action buttons",
        data: "object (optional) - Additional data to include in the alert"
      },
      schema: {
        type: "object",
        properties: {
          title: { 
            type: "string", 
            description: "Alert title that will be prominently displayed" 
          },
          message: { 
            type: "string", 
            description: "Detailed alert message content (supports markdown)" 
          },
          severity: { 
            type: "string", 
            description: "Alert severity level",
            enum: ["info", "warning", "error", "critical"]
          },
          channel: { 
            type: "string", 
            description: "Target channel name for the alert" 
          },
          actions: { 
            type: "array", 
            description: "Array of action buttons for the alert",
            items: { type: "object" }
          },
          data: { 
            type: "object", 
            description: "Additional data to include in the alert" 
          }
        },
        required: ["title", "message", "severity"]
      },
      response_format: {
        success: "boolean - Whether the alert was sent successfully",
        alertId: "string - The unique identifier of the sent alert",
        sentDateTime: "string - ISO timestamp when the alert was sent",
        channel: "string - The channel where the alert was sent",
        error: "string (optional) - Error message if sending failed"
      },
      example_request: {
        title: "🚨 Sales Performance Alert",
        message: "**Critical:** Delhi region sales dropped below 10% threshold\n\n📊 **Current Performance:**\n• Delhi: $62,744.67 (10.9% of total)\n• Average: $144,353.46\n• Gap: $81,608.79 below average\n\n⚠️ **Action Required:**\n• Immediate leadership review needed\n• Sales team intervention required\n• Performance improvement plan needed",
        severity: "critical",
        channel: "sales-alerts",
        actions: [
          { text: "View Details", url: "https://dashboard.company.com/sales" },
          { text: "Schedule Review", url: "https://calendar.company.com/book" }
        ],
        data: {
          region: "delhi",
          currentSales: 62744.67,
          averageSales: 144353.46,
          percentage: 10.9
        }
      },
      example_response: {
        success: true,
        alertId: "alert_987654321",
        sentDateTime: "2025-07-22T10:35:00.000Z",
        channel: "sales-alerts"
      }
    },
    
    {
      tool: "teams_send_report",
      name: "teams_send_report",
      description: "Send a formatted report to Microsoft Teams with structured data and visual elements",
      endpoint: "POST /tools/teams_send_report",
      parameters: {
        reportType: "string (required) - Type of report (sales, performance, summary, analysis)",
        title: "string (required) - Report title",
        content: "object (required) - Structured report content with sections and data",
        channel: "string (optional) - Target channel name",
        format: "string (optional) - Report format (simple, detailed, executive)",
        includeCharts: "boolean (optional) - Whether to include chart suggestions"
      },
      schema: {
        type: "object",
        properties: {
          reportType: { 
            type: "string", 
            description: "Type of report to generate",
            enum: ["sales", "performance", "summary", "analysis", "quarterly", "monthly"]
          },
          title: { 
            type: "string", 
            description: "Report title" 
          },
          content: { 
            type: "object", 
            description: "Structured report content with sections and data" 
          },
          channel: { 
            type: "string", 
            description: "Target channel name for the report" 
          },
          format: { 
            type: "string", 
            description: "Report format style",
            enum: ["simple", "detailed", "executive"]
          },
          includeCharts: { 
            type: "boolean", 
            description: "Whether to include chart suggestions in the report" 
          }
        },
        required: ["reportType", "title", "content"]
      },
      response_format: {
        success: "boolean - Whether the report was sent successfully",
        reportId: "string - The unique identifier of the sent report",
        sentDateTime: "string - ISO timestamp when the report was sent",
        channel: "string - The channel where the report was sent",
        sections: "number - Number of sections in the report",
        error: "string (optional) - Error message if sending failed"
      },
      example_request: {
        reportType: "quarterly",
        title: "📊 Q1 2025 Sales Performance Report",
        content: {
          summary: {
            totalSales: 577413.84,
            regions: 4,
            topRegion: "kochi",
            topSales: 250034.26
          },
          regions: [
            { name: "kochi", sales: 250034.26, percentage: 43.3, rank: 1 },
            { name: "LA", sales: 162681.64, percentage: 28.2, rank: 2 },
            { name: "jaipur", sales: 101953.27, percentage: 17.7, rank: 3 },
            { name: "delhi", sales: 62744.67, percentage: 10.9, rank: 4 }
          ],
          insights: [
            "Kochi leads with 43.3% of total sales",
            "Delhi needs attention with only 10.9% contribution",
            "LA shows strong performance at 28.2%",
            "Overall sales distribution is uneven across regions"
          ],
          recommendations: [
            "Focus on Delhi region performance improvement",
            "Replicate Kochi's success strategies",
            "Consider regional sales team restructuring",
            "Implement performance-based incentives"
          ]
        },
        channel: "sales-reports",
        format: "executive",
        includeCharts: true
      },
      example_response: {
        success: true,
        reportId: "report_456789123",
        sentDateTime: "2025-07-22T10:40:00.000Z",
        channel: "sales-reports",
        sections: 4
      }
    }
];

module.exports = teamsTools; 