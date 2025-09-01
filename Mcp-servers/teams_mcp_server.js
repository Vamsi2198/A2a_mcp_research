const express = require('express');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(express.json());

// Replace this with your actual webhook URL
const TEAMS_WEBHOOK_URL = process.env.TEAMS_WEBHOOK_URL;

// Teams message sender function
async function sendTeamsMessage(payload) {
  if (!TEAMS_WEBHOOK_URL) {
    console.log('⚠️ TEAMS_WEBHOOK_URL not configured - using mock response for testing');
    console.log('📤 Mock Teams message payload:', JSON.stringify(payload, null, 2));
    // Return mock response for testing
    return { 
      success: true, 
      message: 'Mock Teams response - webhook not configured',
      timestamp: new Date().toISOString()
    };
  }
  
  try {
    const response = await axios.post(TEAMS_WEBHOOK_URL, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000
    });
    return response.data;
  } catch (error) {
    console.error('Error sending message to Teams:', error.message);
    throw new Error(`Failed to send message to Teams: ${error.message}`);
  }
}

// Basic message endpoint
app.post('/send-message', async (req, res) => {
  const { message } = req.body;

  if (!message) {
    return res.status(400).send({ error: 'Message is required' });
  }

  const payload = {
    text: message
  };

  try {
    await sendTeamsMessage(payload);
    res.send({ 
      success: true,
      status: 'Message sent to Teams channel!',
      sentDateTime: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).send({ 
      success: false,
      error: error.message 
    });
  }
});

// Teams tool endpoints
app.post('/tools/teams_send_message', async (req, res) => {
  try {
    const { message, channel, priority, attachments } = req.body;

    if (!message) {
      return res.status(400).json({ 
        success: false,
        error: 'Message is required' 
      });
    }

    // Create Teams message payload
    let payload = {
      text: message
    };

    // Add priority indicator if specified
    if (priority && priority !== 'normal') {
      const priorityEmoji = priority === 'high' ? '🔴' : '🚨';
      payload.text = `${priorityEmoji} **${priority.toUpperCase()}**\n\n${payload.text}`;
    }

    // Add channel info if specified
    if (channel) {
      payload.text = `📢 **Channel:** ${channel}\n\n${payload.text}`;
    }

    await sendTeamsMessage(payload);
    
    res.json({
      success: true,
      messageId: `msg_${Date.now()}`,
      sentDateTime: new Date().toISOString(),
      channel: channel || 'default',
      messageContent: payload.text // Include the actual message content for verification
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/tools/teams_send_alert', async (req, res) => {
  try {
    const { title, message, severity, channel, actions, data } = req.body;

    if (!title || !message || !severity) {
      return res.status(400).json({ 
        success: false,
        error: 'Title, message, and severity are required' 
      });
    }

    // Create alert payload with severity indicators
    const severityEmoji = {
      info: 'ℹ️',
      warning: '⚠️',
      error: '❌',
      critical: '🚨'
    };

    let alertText = `${severityEmoji[severity]} **${severity.toUpperCase()} ALERT**\n\n`;
    alertText += `**${title}**\n\n`;
    alertText += message;

    // Add channel info if specified
    if (channel) {
      alertText = `📢 **Channel:** ${channel}\n\n${alertText}`;
    }

    // Add action buttons if provided
    if (actions && actions.length > 0) {
      alertText += '\n\n**Actions:**\n';
      actions.forEach((action, index) => {
        alertText += `${index + 1}. [${action.text}](${action.url})\n`;
      });
    }

    // Add data summary if provided
    if (data) {
      alertText += '\n\n**Data Summary:**\n';
      Object.entries(data).forEach(([key, value]) => {
        alertText += `• ${key}: ${value}\n`;
      });
    }

    const payload = { text: alertText };
    await sendTeamsMessage(payload);
    
    res.json({
      success: true,
      alertId: `alert_${Date.now()}`,
      sentDateTime: new Date().toISOString(),
      channel: channel || 'default'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/tools/teams_send_report', async (req, res) => {
  try {
    const { reportType, title, content, channel, format, includeCharts } = req.body;

    if (!reportType || !title || !content) {
      return res.status(400).json({ 
        success: false,
        error: 'Report type, title, and content are required' 
      });
    }

    // Create report payload
    let reportText = `📊 **${reportType.toUpperCase()} REPORT**\n\n`;
    reportText += `**${title}**\n\n`;

    // Add content sections
    if (content.summary) {
      reportText += '📈 **SUMMARY**\n';
      Object.entries(content.summary).forEach(([key, value]) => {
        const formattedKey = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
        reportText += `• ${formattedKey}: ${typeof value === 'number' ? value.toLocaleString() : value}\n`;
      });
      reportText += '\n';
    }

    if (content.regions) {
      reportText += '🏆 **REGIONAL PERFORMANCE**\n';
      content.regions.forEach(region => {
        reportText += `${region.rank}. ${region.name}: $${region.sales.toLocaleString()} (${region.percentage}%)\n`;
      });
      reportText += '\n';
    }

    if (content.insights) {
      reportText += '💡 **KEY INSIGHTS**\n';
      content.insights.forEach(insight => {
        reportText += `• ${insight}\n`;
      });
      reportText += '\n';
    }

    if (content.recommendations) {
      reportText += '🎯 **RECOMMENDATIONS**\n';
      content.recommendations.forEach(rec => {
        reportText += `• ${rec}\n`;
      });
      reportText += '\n';
    }

    // Add format indicator
    if (format && format !== 'simple') {
      reportText += `📋 **Format:** ${format.toUpperCase()}\n`;
    }

    // Add chart suggestion if requested
    if (includeCharts) {
      reportText += '\n📊 **Chart Suggestions:**\n';
      reportText += '• Regional performance bar chart\n';
      reportText += '• Sales trend line chart\n';
      reportText += '• Performance distribution pie chart\n';
    }

    // Add channel info if specified
    if (channel) {
      reportText = `📢 **Channel:** ${channel}\n\n${reportText}`;
    }

    const payload = { text: reportText };
    await sendTeamsMessage(payload);
    
    const sections = Object.keys(content).length;
    
    res.json({
      success: true,
      reportId: `report_${Date.now()}`,
      sentDateTime: new Date().toISOString(),
      channel: channel || 'default',
      sections: sections
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Teams MCP Server is running',
    webhook_configured: !!TEAMS_WEBHOOK_URL,
    available_endpoints: [
      'POST /send-message',
      'POST /tools/teams_send_message',
      'POST /tools/teams_send_alert',
      'POST /tools/teams_send_report'
    ]
  });
});

// A2A endpoint for orchestrator compatibility
app.post('/a2a', async (req, res) => {
  try {
    const { tool, message, title, severity, reportType, content, channel, priority, actions, data, format, includeCharts } = req.body;
    
    console.log('🤖 Teams MCP Server received request:', { tool, message, title, severity, reportType });
    
    let result;
    
    switch (tool) {
      case 'teams_send_message':
        if (!message) {
          return res.status(400).json({ 
            content: { text: '❌ Missing required parameter: message' }
          });
        }
        
        // Create Teams message payload
        let payload = { text: message };
        
        // Add priority indicator if specified
        if (priority && priority !== 'normal') {
          const priorityEmoji = priority === 'high' ? '🔴' : '🚨';
          payload.text = `${priorityEmoji} **${priority.toUpperCase()}**\n\n${payload.text}`;
        }
        
        // Add channel info if specified
        if (channel) {
          payload.text = `📢 **Channel:** ${channel}\n\n${payload.text}`;
        }
        
        await sendTeamsMessage(payload);
        const messageId = `msg_${Date.now()}`;
        result = `✅ Message sent to Teams successfully!\n\n📧 **Message Details:**\n• Channel: ${channel || 'default'}\n• Message ID: ${messageId}\n• Sent: ${new Date().toISOString()}\n\n💬 **Content:**\n${payload.text}`;
        break;
        
      case 'teams_send_alert':
        if (!title || !message || !severity) {
          return res.status(400).json({ 
            content: { text: '❌ Missing required parameters: title, message, and severity' }
          });
        }
        
        // Create alert payload
        let alertPayload = {
          text: `🚨 **${title}**\n\n**Severity:** ${severity.toUpperCase()}\n\n${message}`
        };
        
        if (channel) {
          alertPayload.text = `📢 **Channel:** ${channel}\n\n${alertPayload.text}`;
        }
        
        await sendTeamsMessage(alertPayload);
        const alertId = `alert_${Date.now()}`;
        result = `🚨 Alert sent to Teams successfully!\n\n📢 **Alert Details:**\n• Title: ${title}\n• Severity: ${severity.toUpperCase()}\n• Channel: ${channel || 'default'}\n• Alert ID: ${alertId}\n• Sent: ${new Date().toISOString()}\n\n📋 **Content:**\n${message}`;
        break;
        
      case 'teams_send_report':
        if (!reportType || !title || !content) {
          return res.status(400).json({ 
            content: { text: '❌ Missing required parameters: reportType, title, and content' }
          });
        }
        
        // Create report payload
        let reportPayload = {
          text: `📊 **${title}**\n\n**Report Type:** ${reportType.toUpperCase()}\n\n${JSON.stringify(content, null, 2)}`
        };
        
        if (channel) {
          reportPayload.text = `📢 **Channel:** ${channel}\n\n${reportPayload.text}`;
        }
        
        await sendTeamsMessage(reportPayload);
        const reportId = `report_${Date.now()}`;
        result = `📊 Report sent to Teams successfully!\n\n📈 **Report Details:**\n• Type: ${reportType.toUpperCase()}\n• Title: ${title}\n• Channel: ${channel || 'default'}\n• Report ID: ${reportId}\n• Sent: ${new Date().toISOString()}\n\n📋 **Content Summary:**\n${JSON.stringify(content, null, 2)}`;
        break;
        
      default:
        return res.status(400).json({ 
          content: { text: `❌ Unknown tool: ${tool}. Available tools: teams_send_message, teams_send_alert, teams_send_report` }
        });
    }
    
    res.json({
      content: { text: result }
    });
    
  } catch (error) {
    console.error('❌ Error in Teams A2A endpoint:', error.message);
    res.status(500).json({
      content: { text: `❌ Error sending to Teams: ${error.message}` }
    });
  }
});

// Tools endpoint for agent discovery
app.get('/tools', (req, res) => {
  res.json({
    tools: [
      {
        tool: "teams_send_message",
        name: "teams_send_message",
        description: "Send a message to Microsoft Teams channel"
      },
      {
        tool: "teams_send_alert",
        name: "teams_send_alert", 
        description: "Send an alert notification to Microsoft Teams"
      },
      {
        tool: "teams_send_report",
        name: "teams_send_report",
        description: "Send a formatted report to Microsoft Teams"
      }
    ],
    agent_type: 'teams',
    description: 'Microsoft Teams integration for sending messages, alerts, and reports'
  });
});

const PORT = process.env.PORT || 7000;
app.listen(PORT, () => {
  console.log(`🤖 Teams MCP Server running on http://localhost:${PORT}`);
  console.log(`📋 Available endpoints:`);
  console.log(`   POST /send-message - Basic message sending`);
  console.log(`   POST /tools/teams_send_message - Send formatted message`);
  console.log(`   POST /tools/teams_send_alert - Send alert notification`);
  console.log(`   POST /tools/teams_send_report - Send formatted report`);
  console.log(`   GET  /health - Health check`);
  console.log(`   GET  /tools - Available tools`);
  console.log(`🔧 Webhook configured: ${TEAMS_WEBHOOK_URL ? '✅ Yes' : '❌ No'}`);
});
