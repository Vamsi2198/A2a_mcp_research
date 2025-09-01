const outlookTools = [
    {
      tool: "outlook_send_email",
      name: "outlook_send_email",
      description: "Send an email using Microsoft Outlook/Exchange Online via Microsoft Graph API",
      endpoint: "POST /tools/outlook_send_email",
      parameters: {
        to_email: "array (required) - Array of recipient email addresses",
        subject: "string (required) - Email subject line",
        body: "string (required) - Email body content (supports HTML)",
        cc: "array (optional) - Array of CC recipient email addresses",
        bcc: "array (optional) - Array of BCC recipient email addresses",
        isHtml: "boolean (optional) - Whether the body is HTML format (default: true)",
        flag: "true"
      },
      response_format: {
        success: "boolean - Whether the email was sent successfully",
        messageId: "string - The unique message ID of the sent email",
        sentDateTime: "string - ISO timestamp when the email was sent",
        error: "string (optional) - Error message if sending failed"
      },
      example_request: {
        to_email: ["recipient@example.com"],
        subject: "Test Email from MCP System",
        body: "<h1>Hello!</h1><p>This is a test email sent via the MCP system.</p>",
        cc: ["cc@example.com"],
        isHtml: true,
        flag: "true"
      },
      example_response: {
        success: true,
        messageId: "AAMkAGVmMDEzMTM4LTZmYWUtNDdkNC1hMDZkLGU1ZjBhMjM0NmYaAAAAAABiY2tkCRwbQwIjEjhqKhRBwAAiIsqMbYjsAAABiY2tkCRwbQ==",
        sentDateTime: "2024-01-15T10:30:00.000Z"
      }
    },
    
   
  ];

module.exports = outlookTools;