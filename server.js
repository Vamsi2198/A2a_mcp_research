// src/server.js
const express = require("express");
const cors = require("cors");
const { runUnifiedOrchestration } = require("./unifiedOrchestrator");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors()); // Enable CORS for all origins
app.use(express.json());

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "OK", message: "Orchestrator is running" });
});

// Main orchestration endpoint
app.post("/orchestrate", async (req, res) => {
  try {
    const { userInput, useA2A } = req.body;
    console.log("🔍 Received request:", { userInput, useA2A });
    
    if (!userInput) {
      return res.status(400).json({
        error: "Missing required field: userInput",
        example: {
          userInput: "I need to find flights from New York to London on 2025-01-15 and check the weather in London"
        }
      });
    }

    console.log("📥 Received request:", { userInput, useA2A });
    
    // Use the unified orchestrator
    const result = await runUnifiedOrchestration(userInput);
    
    console.log("📤 Sending response:", { result });
    
    res.json({
      success: true,
      userInput,
      result,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error("❌ Error in orchestration:", error);
    res.status(500).json({
      error: "Internal server error",
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Chat endpoint (same as /api/chat for convenience)
app.post("/chat", async (req, res) => {
  try {
    const { message, query, prompt, useA2A } = req.body;
    
    // Accept different field names for flexibility
    const userInput = message || query || prompt;
    
    if (!userInput) {
      return res.status(400).json({
        error: "Missing required field. Use 'message', 'query', or 'prompt'",
        example: {
          message: "I need to find flights from New York to London on 2025-01-15"
        }
      });
    }

    console.log("📥 Received chat request:", { userInput, useA2A });
    
    // Use the unified orchestrator
    const result = await runUnifiedOrchestration(userInput);
    
    res.json(result);
    
  } catch (error) {
    console.error("❌ Error in chat:", error);
    res.status(500).json({
      error: "Internal server error",
      message: error.message
    });
  }
});

// Alternative endpoint with different name
app.post("/api/chat", async (req, res) => {
  try {
    const { message, query, prompt, useA2A } = req.body;
    
    // Accept different field names for flexibility
    const userInput = message || query || prompt;
    
    if (!userInput) {
      return res.status(400).json({
        error: "Missing required field. Use 'message', 'query', or 'prompt'",
        example: {
          message: "I need to find flights from New York to London on 2025-01-15"
        }
      });
    }

    console.log("📥 Received chat request:", { userInput, useA2A });
    
    // Use the unified orchestrator
    const result = await runUnifiedOrchestration(userInput);
    
    res.json({
      success: true,
      message: result,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error("❌ Error in chat:", error);
    res.status(500).json({
      error: "Internal server error",
      message: error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Orchestrator server running on http://localhost:${PORT}`);
  console.log(`📋 Available endpoints:`);
  console.log(`   GET  /health - Health check`);
  console.log(`   POST /orchestrate - Main orchestration endpoint`);
  console.log(`   POST /api/chat - Alternative chat endpoint`);
  console.log(`\n💡 Example usage:`);
  console.log(`   curl -X POST http://localhost:${PORT}/orchestrate \\`);
  console.log(`        -H "Content-Type: application/json" \\`);
  console.log(`        -d '{"userInput": "Find flights from NYC to London on 2025-01-15"}'`);
});

module.exports = app; 