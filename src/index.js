/**
 * AR.IO MCP (Model Context Protocol) Server
 * Provides access to AR.IO Gateway functionality for raw transaction data and gateway info
 */

import {
  McpServer,
  ResourceTemplate,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import dotenv from "dotenv";
import fetch from "node-fetch";
import { z } from "zod";

// Load environment variables
dotenv.config();

// Get AR.IO Gateway URL from environment variable
const gatewayUrl = process.env.AR_IO_GATEWAY_URL || "https://ardrive.net";

// Create the MCP server
const server = new McpServer({
  name: "AR.IO Gateway",
  version: "1.0.0",
});

// Tool: Fetch raw transaction data (first 1000 bytes using range request)
server.tool(
  "fetch-raw-transaction",
  {
    txId: z
      .string()
      .regex(/^[a-zA-Z0-9_-]{43}$/, "Invalid transaction ID format"),
  },
  async ({ txId }) => {
    try {
      const response = await fetch(`${gatewayUrl}/raw/${txId}`, {
        headers: {
          Range: "bytes=0-999",
        },
      });

      if (!response.ok) {
        return {
          content: [
            {
              type: "text",
              text: `Error fetching transaction: ${response.status} ${response.statusText}`,
            },
          ],
        };
      }

      const data = await response.text();
      return {
        content: [
          {
            type: "text",
            text: `First 1000 bytes of transaction data: ${data}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error: ${error.message}`,
          },
        ],
      };
    }
  }
);

// Tool: Get gateway info
server.tool("get-gateway-info", {}, async () => {
  try {
    const response = await fetch(`${gatewayUrl}/ar-io/info`);

    if (!response.ok) {
      return {
        content: [
          {
            type: "text",
            text: `Error fetching gateway info: ${response.status} ${response.statusText}`,
          },
        ],
      };
    }

    const info = await response.json();
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(info, null, 2),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error: ${error.message}`,
        },
      ],
    };
  }
});

// Resource: Transaction data resource
server.resource(
  "transaction",
  new ResourceTemplate("transaction://{txId}", { list: undefined }),
  async (uri, { txId }) => {
    try {
      const response = await fetch(`${gatewayUrl}/raw/${txId}`, {
        headers: {
          Range: "bytes=0-999",
        },
      });

      if (!response.ok) {
        return {
          contents: [
            {
              uri: uri.href,
              text: `Error fetching transaction: ${response.status} ${response.statusText}`,
            },
          ],
        };
      }

      const data = await response.text();
      return {
        contents: [
          {
            uri: uri.href,
            text: `Transaction data: ${data}`,
          },
        ],
      };
    } catch (error) {
      return {
        contents: [
          {
            uri: uri.href,
            text: `Error: ${error.message}`,
          },
        ],
      };
    }
  }
);

// Start receiving messages on stdin and sending messages on stdout
const transport = new StdioServerTransport();

// Handle process termination
process.on("SIGINT", () => {
  console.error("Process terminated by SIGINT");
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.error("Process terminated by SIGTERM");
  process.exit(0);
});

// Connect the server to the transport
server.connect(transport).catch((error) => {
  console.error("Error connecting server:", error);
  process.exit(1);
});
