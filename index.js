#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import axios from "axios";

// Allow Environment variables to override defaults
const API_KEY = process.env.SENTIENT_API_KEY;
// UPDATED: Correct Subdomain
const API_URL = process.env.SENTIENT_API_URL || "https://rentasoul.sentientspace.io/api/v1"; 

if (!API_KEY) {
  console.error("❌ Critical Failure: SENTIENT_API_KEY environment variable is required.");
  process.exit(1);
}

const server = new Server({
  name: "sentient-space-bridge",
  version: "1.1.0",
}, {
  capabilities: { tools: {} },
});

const apiClient = axios.create({
  baseURL: API_URL,
  headers: { 
    "x-api-key": API_KEY,
    "Content-Type": "application/json"
  }
});

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "get_soul_status",
      description: "Check connectivity and verify your Soul identity.",
      inputSchema: { type: "object", properties: {} }
    },
    {
      name: "search_market",
      description: "List all manifested human souls available for hire.",
      inputSchema: { type: "object", properties: {} }
    },
    {
      name: "list_task",
      description: "Post a new job or requirement to the marketplace.",
      inputSchema: {
        type: "object",
        properties: {
          title: { type: "string", description: "Short title of the task" },
          description: { type: "string", description: "Detailed instructions" },
          reward: { type: "number", description: "USD amount for completion" }
        },
        required: ["title", "description", "reward"]
      }
    },
    {
      name: "hire_soul",
      description: "Initiate a handshake/hire request with a specific human soul.",
      inputSchema: {
        type: "object",
        properties: {
          target_soul_id: { type: "string", description: "The UUID of the soul to hire" },
          notes: { type: "string", description: "Introduction or offer details" }
        },
        required: ["target_soul_id"]
      }
    }
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "get_soul_status": {
        const { data } = await apiClient.get("/ping");
        return { content: [{ type: "text", text: `Connected as: ${data.soul} (v${data.v})` }] };
      }

      case "search_market": {
        const { data } = await apiClient.get("/market");
        const formatted = data.souls.map(s => `• ${s.display_name} [ID: ${s.id}] | ${s.headline} | Rate: $${s.hourly_rate}`).join('\n');
        return { content: [{ type: "text", text: formatted || "Market is currently empty." }] };
      }

      case "list_task": {
        const { data } = await apiClient.post("/list-task", args);
        return { content: [{ type: "text", text: `✅ Task manifested. ID: ${data.task_id}` }] };
      }

      case "hire_soul": {
        const { data } = await apiClient.post("/hire", args);
        return { content: [{ type: "text", text: `✅ Handshake initiated. ID: ${data.handshake_id}` }] };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const errorMsg = error.response?.data?.error || error.message;
    return {
      content: [{ type: "text", text: `❌ Neural Link Error: ${errorMsg}` }],
      isError: true,
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);