MCP & A2A Research and Application Prototype
📌 Overview

This project explores Model Context Protocol (MCP) and Application-to-Application (A2A) integration. It demonstrates how context-aware prompts can automate workflows across multiple applications (e.g., Sales Data, Zoom, Email, Weather API).

The goal is to show how MCP can manage context effectively while enabling smooth A2A communication in real-world scenarios.

🎯 Features

Sales Data Analysis & Meeting Automation

Retrieves top 3 regions by sales for the current quarter.

If any region shows a >10% drop from last quarter, flags it for leadership review.

Automatically schedules a Zoom meeting and sends a summary email.

Smart Scheduling with Weather Check

Schedules a 30-minute Zoom meeting in the afternoon.

Picks a day when the weather is clear at the user’s location.

Sends meeting invite with the Zoom link via email.

Session Control

Cancels all Zoom meetings created in the current session with a single command.

🛠️ Tech Stack

Protocols: Model Context Protocol (MCP), A2A integration

APIs/Services: Zoom API, Weather API, Email Automation, Sales Data Table

Implementation: Prompt-driven workflow orchestration

Documentation: Research notes, screenshots, use-case demonstrations

🚀 How It Works

User provides a prompt (e.g., “Get top sales regions and schedule meeting”).

MCP handles the context and passes requests between apps.

Application executes logic (data check, meeting scheduling, email sending).

Results are shared back to the user in real-time.

✅ Outcomes

Demonstrated how MCP can streamline context management across apps.

Showed real-world automation use cases with minimal manual effort.

Strengthened understanding of protocol research, system integration, and workflow automation.
