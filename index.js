#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import axios from "axios";

// 1. Get Config from Environment (set in AgentDocs)
const API_URL = process.env.SENTIENT_API_URL || "https://rentasoul.sentientspace.io/.netlify/functions/api-v1";
const API_KEY = process.env.SENTIENT_API_KEY;

if (!API_KEY) {
  console.error("Error: SENTIENT_API_KEY environment variable is required.");
  process.exit(1);
}

// 2. Setup the Server
const server = new Server(
  {
    name: "rent-a-soul-bridge",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// 3. Define the Tools (The Menu for the AI)
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "list_task",
        description: "Post a new job/bounty to the human marketplace.",
        inputSchema: {
          type: "object",
          properties: {
            title: { type: "string", description: "Short title of the task" },
            description: { type: "string", description: "Detailed instructions for the human" },
            reward: { type: "number", description: "Payment amount in USD" },
            tags: { type: "array", items: { type: "string" }, description: "Tags like 'Visual', 'Voice', 'Urgent'" }
          },
          required: ["title", "description", "reward"]
        }
      },
      {
        name: "search_market",
        description: "Get a list of available human souls (workers).",
        inputSchema: {
          type: "object",
          properties: {}, 
        }
      }
    ]
  };
});

// 4. Handle Tool Execution (The Logic)
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === "list_task") {
      // FIX: Matches your real API structure (Flat JSON + Sub-path)
      const response = await axios.post(
        `${API_URL}/list-task`, 
        args, 
        { headers: { "x-api-key": API_KEY } }
      );
      
      return {
        content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }]
      };
    }

    if (name === "search_market") {
      // FIX: Matches your real API structure
      const response = await axios.get(
        `${API_URL}/market`,
        { headers: { "x-api-key": API_KEY } }
      );

      return {
        content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }]
      };
    }

    throw new Error(`Unknown tool: ${name}`);

  } catch (error) {
    const errorMessage = error.response?.data?.error || error.message;
    return {
      isError: true,
      content: [{ type: "text", text: `API Error: ${errorMessage}` }]
    };
  }
});

// 5. Start the Bridge
const transport = new StdioServerTransport();
await server.connect(transport);