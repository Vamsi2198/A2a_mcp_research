
const express = require('express');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');

const app = express();
app.use(bodyParser.json());

const transporter = nodemailer.createTransport({
  host: 'smtp.office365.com',
  port: 587,
  secure: false,
  auth: {
    user: 'support.1platform@polestarllp.com',
    pass: 'jvzrxhlqfcjgnmxj',
  },
  tls: {
    ciphers: 'SSLv3'
  }
});

// Function to parse table data
const parseTableData = (text) => {
  const lines = text.split('\n');
  let tableStartIndex = -1;
  let tableEndIndex = -1;
  let isTabSeparated = false;

  // Find table boundaries and check format
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.includes('\t')) {
      isTabSeparated = true;
      if (tableStartIndex === -1) tableStartIndex = i;
      tableEndIndex = i;
    } else if (line.includes('|')) {
      if (tableStartIndex === -1) tableStartIndex = i;
      tableEndIndex = i;
    } else if (tableStartIndex !== -1 && !line.includes('|') && !line.includes('\t')) {
      break;
    }
  }

  if (tableStartIndex === -1) return null;

  // Extract table lines
  const tableLines = lines.slice(tableStartIndex, tableEndIndex + 1);
  
  let headers, rows;
  
  if (isTabSeparated) {
    // Parse tab-separated format
    headers = tableLines[0]
      .split('\t')
      .map(cell => cell.trim());

    rows = tableLines.slice(1).map(line =>
      line
        .split('\t')
        .map(cell => cell.trim())
    );
  } else {
    // Parse markdown format
    headers = tableLines[0]
      .split('|')
      .filter(cell => cell.trim())
      .map(cell => cell.trim());

    // Skip the separator line (second line)
    rows = tableLines.slice(2).map(line =>
      line
        .split('|')
        .filter(cell => cell.trim())
        .map(cell => cell.trim())
    );
  }

  return {
    headers,
    rows,
    beforeTable: lines.slice(0, tableStartIndex).join('\n'),
    afterTable: lines.slice(tableEndIndex + 1).join('\n')
  };
};

// Function to format email content
const formatEmailContent = (text) => {
  // Split content into sections
  const sections = text.split('\n\n');
  let formattedContent = '';

  sections.forEach((section, index) => {
    // Skip empty sections
    if (!section.trim()) return;

    // Replace all single newlines with <br> for line breaks
    const htmlSection = section.replace(/\n/g, '<br>');

    // Handle greeting
    if (section.toLowerCase().startsWith('dear')) {
      formattedContent += `
        <div style="
          margin-bottom: 25px;
          font-size: 18px;
          color: #1a365d;
          font-weight: 500;
          border-left: 4px solid #4299e1;
          padding-left: 15px;
        ">${htmlSection}</div>
      `;
    }
    // Handle closing
    else if (section.toLowerCase().includes('best regards') || 
             section.toLowerCase().includes('regards') || 
             section.toLowerCase().includes('sincerely')) {
      formattedContent += `
        <div style="
          margin-top: 35px;
          margin-bottom: 15px;
          font-size: 16px;
          color: #2d3748;
          font-weight: 500;
        ">${htmlSection}</div>
      `;
    }
    // Handle signature
    else if (section.includes('[Your Name]')) {
      formattedContent += `
        <div style="
          margin-top: 15px;
          font-size: 16px;
          color: #2d3748;
          font-weight: 500;
          padding-bottom: 20px;
          border-bottom: 1px solid #e2e8f0;
        ">${htmlSection}</div>
      `;
    }
    // Handle regular paragraphs
    else {
      formattedContent += `
        <div style="
          margin-bottom: 25px;
          font-size: 16px;
          line-height: 1.8;
          color: #4a5568;
          text-align: justify;
          background: linear-gradient(to right, #ffffff, #f7fafc);
          padding: 20px;
          border-radius: 8px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.05);
        ">${htmlSection}</div>
      `;
    }
  });

  return formattedContent;
};

// Function to render markdown content as HTML
const renderMarkdownContent = (text) => {
  const tableData = parseTableData(text);
  
  if (!tableData) {
    return formatEmailContent(text);
  }

  let html = `
    <div style="
      font-family: 'Segoe UI', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      padding: 20px;
      max-width: 800px;
      margin: 0 auto;
      background-color: #ffffff;
    ">
  `;
  
  if (tableData.beforeTable) {
    html += formatEmailContent(tableData.beforeTable);
  }

  html += `
    <div style="
      margin: 25px 0;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      background: linear-gradient(to right, #ffffff, #f8fafc);
    ">
      <div style="overflow-x: auto; width: 100%;">
        <table style="
          border-collapse: collapse;
          width: 100%;
          min-width: 600px;
        ">
  `;
  
  // Add headers with enhanced visibility
  html += `
    <thead>
      <tr style="background: linear-gradient(to right, #2c5282, #2b6cb0);">
  `;
  tableData.headers.forEach(header => {
    html += `
      <th style="
        border: none;
        padding: 15px 20px;
        text-align: left;
        font-weight: 700;
        color: #1a202c;
        font-size: 16px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        white-space: normal;
        word-break: break-word;
        min-width: 120px;
        max-width: 300px;
      ">${header}</th>
    `;
  });
  html += '</tr></thead>';

  // Add rows with enhanced contrast
  html += '<tbody>';
  tableData.rows.forEach((row, index) => {
    html += `
      <tr style="
        background-color: ${index % 2 === 0 ? '#ffffff' : '#f7fafc'};
        transition: all 0.3s ease;
      ">
    `;
    row.forEach(cell => {
      // Format numbers if they contain currency symbols or commas
      const formattedCell = cell.replace(/(\d+),(\d+)/g, '$1,$2');
      html += `
        <td style="
          border: 1px solid #e2e8f0;
          padding: 15px 20px;
          font-size: 14px;
          color: #2d3748;
          line-height: 1.5;
          word-break: break-word;
          white-space: normal;
          min-width: 120px;
          max-width: 300px;
          ${cell.includes('$') ? 'text-align: right;' : ''}
        ">${formattedCell}</td>
      `;
    });
    html += '</tr>';
  });
  html += '</tbody></table></div></div>';

  if (tableData.afterTable) {
    html += formatEmailContent(tableData.afterTable);
  }

  html += '</div>';

  return html;
};

// Function to format flight results as HTML table
const formatFlightResultsAsHtml = (flightResultsText) => {
  try {
    // Convert all literal \n to real newlines
    const normalizedText = flightResultsText.replace(/\\n/g, '\n').replace(/\n/g, '\n');
    const lines = normalizedText.split('\n');
    console.log('🔧 Formatting flight results as HTML...');
    console.log('🔧 Input text:', normalizedText.substring(0, 200) + '...');
    console.log('🔧 Split into', lines.length, 'lines');
    
    const flightLines = lines.filter(line => line.match(/^\d+\. [A-Z]+ \d+/));
    console.log('🔧 Found', flightLines.length, 'flight lines');
    
    if (flightLines.length === 0) {
      // If no flight lines found, return the original text as HTML
      return `<div style="font-family: 'Segoe UI', Arial, sans-serif; padding: 20px;">
        <pre style="white-space: pre-wrap; font-family: inherit;">${flightResultsText}</pre>
      </div>`;
    }
    
    let html = `
      <div style="
        font-family: 'Segoe UI', Arial, sans-serif;
        line-height: 1.6;
        color: #333;
        padding: 20px;
        max-width: 1000px;
        margin: 0 auto;
        background-color: #ffffff;
      ">
        <h2 style="color: #2c5282; margin-bottom: 20px; border-bottom: 3px solid #4299e1; padding-bottom: 10px;">
          ✈️ Flight Search Results
        </h2>
    `;
    
    // Add the introduction text (before the flights)
    const introLines = lines.filter(line => !line.match(/^\d+\. [A-Z]+ \d+/) && line.trim() !== '');
    if (introLines.length > 0) {
      html += `<p style="font-size: 16px; color: #4a5568; margin-bottom: 20px;">${introLines.join(' ')}</p>`;
    }
    
    // Create the flight table
    html += `
      <div style="
        margin: 25px 0;
        border-radius: 12px;
        overflow: hidden;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        background: linear-gradient(to right, #ffffff, #f8fafc);
      ">
        <div style="overflow-x: auto; width: 100%;">
          <table style="
            border-collapse: collapse;
            width: 100%;
            min-width: 800px;
            font-size: 14px;
          ">
            <thead>
              <tr style="background: linear-gradient(to right, #2c5282, #2b6cb0);">
                <th style="border: none; padding: 12px 15px; text-align: center; font-weight: 700; color: white; font-size: 14px; min-width: 40px;">#</th>
                <th style="border: none; padding: 12px 15px; text-align: left; font-weight: 700; color: white; font-size: 14px; min-width: 100px;">Flight</th>
                <th style="border: none; padding: 12px 15px; text-align: center; font-weight: 700; color: white; font-size: 14px; min-width: 80px;">From</th>
                <th style="border: none; padding: 12px 15px; text-align: center; font-weight: 700; color: white; font-size: 14px; min-width: 80px;">To</th>
                <th style="border: none; padding: 12px 15px; text-align: center; font-weight: 700; color: white; font-size: 14px; min-width: 140px;">Departure</th>
                <th style="border: none; padding: 12px 15px; text-align: center; font-weight: 700; color: white; font-size: 14px; min-width: 140px;">Arrival</th>
                <th style="border: none; padding: 12px 15px; text-align: center; font-weight: 700; color: white; font-size: 14px; min-width: 80px;">Duration</th>
                <th style="border: none; padding: 12px 15px; text-align: right; font-weight: 700; color: white; font-size: 14px; min-width: 100px;">Price</th>
              </tr>
            </thead>
            <tbody>
    `;
    
    // Process each flight line
    flightLines.forEach((line, index) => {
      console.log(`🔧 Processing flight line ${index + 1}:`, line);
      
      // Parse flight information
      // Example: "1. AI 2986 | BOM → DEL\nDeparture: 2025-07-20T22:50:00 | Arrival: 2025-07-21T01:00:00\nDuration: PT2H10M\nPrice: $61.45 EUR"
      
      // Extract flight number and route
      const flightMatch = line.match(/^(\d+)\. ([A-Z]+ \d+) \| ([A-Z]+) → ([A-Z]+)/);
      if (!flightMatch) {
        console.log(`❌ Could not parse flight line:`, line);
        return;
      }
      
      const [, flightNum, flightCode, from, to] = flightMatch;
      
      // Find the next few lines for departure, arrival, duration, and price
      const lineIndex = lines.indexOf(line);
      const nextLines = lines.slice(lineIndex + 1, lineIndex + 4);
      
      let departure = '', arrival = '', duration = '', price = '';
      
      nextLines.forEach(nextLine => {
        if (nextLine.includes('Departure:')) {
          const depMatch = nextLine.match(/Departure: ([^|]+) \| Arrival: ([^\\n]+)/);
          if (depMatch) {
            departure = depMatch[1].trim();
            arrival = depMatch[2].trim();
          }
        } else if (nextLine.includes('Duration:')) {
          const durMatch = nextLine.match(/Duration: ([^\\n]+)/);
          if (durMatch) duration = durMatch[1].trim();
        } else if (nextLine.includes('Price:')) {
          const priceMatch = nextLine.match(/Price: \$([0-9.]+) ([A-Z]+)/);
          if (priceMatch) price = `$${priceMatch[1]} ${priceMatch[2]}`;
        }
      });
      
      // Format dates for better readability
      const formatDateTime = (dateTimeStr) => {
        try {
          const date = new Date(dateTimeStr);
          return date.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
          });
        } catch (e) {
          return dateTimeStr;
        }
      };
      
      const formattedDeparture = formatDateTime(departure);
      const formattedArrival = formatDateTime(arrival);
      
      // Format duration (remove PT prefix)
      const formattedDuration = duration.replace('PT', '').replace('H', 'h ').replace('M', 'm');
      
      html += `
        <tr style="background-color: ${index % 2 === 0 ? '#ffffff' : '#f7fafc'};">
          <td style="border: 1px solid #e2e8f0; padding: 10px 15px; text-align: center; font-weight: 600; color: #2d3748;">${flightNum}</td>
          <td style="border: 1px solid #e2e8f0; padding: 10px 15px; text-align: left; font-weight: 600; color: #2d3748;">${flightCode}</td>
          <td style="border: 1px solid #e2e8f0; padding: 10px 15px; text-align: center; font-weight: 600; color: #2d3748; background-color: #ebf8ff;">${from}</td>
          <td style="border: 1px solid #e2e8f0; padding: 10px 15px; text-align: center; font-weight: 600; color: #2d3748; background-color: #f0fff4;">${to}</td>
          <td style="border: 1px solid #e2e8f0; padding: 10px 15px; text-align: center; color: #2d3748;">${formattedDeparture}</td>
          <td style="border: 1px solid #e2e8f0; padding: 10px 15px; text-align: center; color: #2d3748;">${formattedArrival}</td>
          <td style="border: 1px solid #e2e8f0; padding: 10px 15px; text-align: center; color: #2d3748;">${formattedDuration}</td>
          <td style="border: 1px solid #e2e8f0; padding: 10px 15px; text-align: right; font-weight: 600; color: #2d3748; background-color: #faf5ff;">${price}</td>
        </tr>
      `;
    });
    
    html += `
            </tbody>
          </table>
        </div>
      </div>
    `;
    
    // Add location details if present
    const locationSection = lines.find(line => line.includes('Location details:'));
    if (locationSection) {
      const locationIndex = lines.indexOf(locationSection);
      const locationLines = lines.slice(locationIndex + 1);
      
      html += `
        <h3 style="color: #2c5282; margin-top: 30px; margin-bottom: 15px; border-bottom: 2px solid #4299e1; padding-bottom: 5px;">
          📍 Location Details
        </h3>
        <div style="
          background: linear-gradient(to right, #f7fafc, #edf2f7);
          padding: 20px;
          border-radius: 8px;
          border-left: 4px solid #4299e1;
        ">
      `;
      
      locationLines.forEach(line => {
        if (line.trim() && !line.includes('Location details:')) {
          html += `<p style="margin: 5px 0; color: #4a5568; font-size: 14px;">${line.trim()}</p>`;
        }
      });
      
      html += `</div>`;
    }
    
    html += `</div>`;
    
    return html;
  } catch (error) {
    console.error('Error formatting flight results as HTML:', error);
    // Fallback to simple HTML formatting
    return `<div style="font-family: 'Segoe UI', Arial, sans-serif; padding: 20px;">
      <pre style="white-space: pre-wrap; font-family: inherit;">${flightResultsText}</pre>
    </div>`;
  }
};

// Function to validate mail options
const validateMailOptions = (options) => {
  const requiredFields = ['from', 'to', 'subject'];
  const missingFields = requiredFields.filter(field => !options[field]);
  
  if (missingFields.length > 0) {
    throw new Error(`Missing required email fields: ${missingFields.join(', ')}`);
  }

  // Validate email addresses
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  // Extract email from formatted sender address
  const fromEmail = options.from.match(/<([^>]+)>/)?.[1] || options.from;
  if (!emailRegex.test(fromEmail)) {
    throw new Error('Invalid sender email address');
  }
  
  // Validate all to email addresses
  const toEmails = Array.isArray(options.to) ? options.to : [options.to];
  for (const email of toEmails) {
    if (!emailRegex.test(email)) {
      throw new Error(`Invalid recipient email address: ${email}`);
    }
  }

  // Validate all cc email addresses if present
  if (options.cc) {
    const ccEmails = Array.isArray(options.cc) ? options.cc : [options.cc];
    for (const email of ccEmails) {
      if (!emailRegex.test(email)) {
        throw new Error(`Invalid CC email address: ${email}`);
      }
    }
  }

  // Validate content
  if (!options.text && !options.html) {
    throw new Error('Email must have either text or html content');
  }

  return true;
};

transporter.verify((error, success) => {
  if (error) {
    console.error('Transporter verification failed:', error);
  } else {
    console.log('Server is ready to send emails');
  }
});

// POST /tools/outlook_send_email endpoint
app.post('/tools/outlook_send_email', async (req, res) => {
  try {
    console.log("outlookEmail23", req.body);
    const { to_email, subject, body, cc, bcc, isHtml } = req.body;
    if (!to_email || !subject || !body) {
      return res.status(400).json({ error: 'Missing required fields: to_email, subject, body' });
    }
    
    // Check if this is a flight results email and format it as HTML
    let formattedBody = body;
    let shouldUseHtml = isHtml !== false; // Default to HTML unless explicitly set to false
    
    console.log('📧 Checking if this is a flight results email...');
    console.log('📧 Body contains "Found":', body.includes('Found'));
    console.log('📧 Body contains "flights":', body.includes('flights'));
    console.log('📧 Body contains "Departure:":', body.includes('Departure:'));
    console.log('📧 Body contains "Price:":', body.includes('Price:'));
    
    if (body.includes('Found') && body.includes('flights') && (body.includes('Departure:') || body.includes('Price:'))) {
      console.log('📧 Detected flight results email, formatting as HTML table...');
      formattedBody = formatFlightResultsAsHtml(body);
      shouldUseHtml = true;
      console.log('📧 HTML formatting completed, body length:', formattedBody.length);
    } else {
      console.log('📧 Not a flight results email, using original body');
    }
    
    const mailOptions = {
      from: 'support.1platform@polestarllp.com',
      to: Array.isArray(to_email) ? to_email.join(',') : to_email,
      cc: cc ? (Array.isArray(cc) ? cc.join(',') : cc) : undefined,
      bcc: bcc ? (Array.isArray(bcc) ? bcc.join(',') : bcc) : undefined,
      subject,
      html: shouldUseHtml ? formattedBody : undefined,
      text: shouldUseHtml ? undefined : formattedBody
    };
    
    console.log('📧 Sending email with HTML formatting:', shouldUseHtml);
    const info = await transporter.sendMail(mailOptions);
    res.json({ success: true, info });
  } catch (err) {
    console.error('❌ Email sending failed:', err);
    res.status(500).json({ error: err.message || 'Failed to send email' });
  }
});

const PORT = process.env.PORT || 5005;
app.listen(PORT, () => {
  console.log(`Outlook MCP server running at http://localhost:${PORT}`);
});
