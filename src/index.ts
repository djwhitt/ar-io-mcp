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

// Define template variables interface
interface TemplateVars {
  [key: string]: string | string[] | undefined;
}

// Load environment variables
dotenv.config();

// Get AR.IO Gateway URL from environment variable
const gatewayUrl: string = process.env.AR_IO_GATEWAY_URL || "https://ardrive.net";

// Create the MCP server
const server = new McpServer({
  name: "AR.IO Gateway",
  version: "1.0.0",
});

// Tool: Fetch raw transaction data (full data if under 8KB, error if larger)
server.tool(
  "fetch-raw-transaction",
  {
    txId: z
      .string()
      .regex(/^[a-zA-Z0-9_-]{43}$/, "Invalid transaction ID format"),
  },
  async ({ txId }: { txId: string }) => {
    try {
      // First do a HEAD request to check the size
      const headResponse = await fetch(`${gatewayUrl}/raw/${txId}`, {
        method: "HEAD",
      });

      if (!headResponse.ok) {
        return {
          content: [
            {
              type: "text",
              text: `Error fetching transaction: ${headResponse.status} ${headResponse.statusText}`,
            },
          ],
        };
      }

      // Check Content-Length header
      const contentLength = parseInt(headResponse.headers.get("Content-Length") || "0", 10);
      
      if (contentLength > 8192) { // 8KB limit
        return {
          content: [
            {
              type: "text",
              text: `Error: Transaction data is too large (${contentLength} bytes, limit is 8KB)`,
            },
          ],
        };
      }

      // Fetch the entire transaction data if it's under 8KB
      const response = await fetch(`${gatewayUrl}/raw/${txId}`);

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
            text: `Transaction data (${contentLength} bytes): ${data}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error: ${error instanceof Error ? error.message : String(error)}`,
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
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
    };
  }
});

// Resource: Transaction data resource
server.resource(
  "transaction",
  new ResourceTemplate("transaction://{txId}", { list: undefined }),
  async (uri: URL, variables: Record<string, string | string[]>) => {
    try {
      const txId = variables.txId as string;
      
      if (!txId) {
        return {
          contents: [
            {
              uri: uri.href,
              text: "Error: Missing transaction ID",
            },
          ],
        };
      }
      
      // First do a HEAD request to check the size
      const headResponse = await fetch(`${gatewayUrl}/raw/${txId}`, {
        method: "HEAD",
      });

      if (!headResponse.ok) {
        return {
          contents: [
            {
              uri: uri.href,
              text: `Error fetching transaction: ${headResponse.status} ${headResponse.statusText}`,
            },
          ],
        };
      }

      // Check Content-Length header
      const contentLength = parseInt(headResponse.headers.get("Content-Length") || "0", 10);
      
      if (contentLength > 8192) { // 8KB limit
        return {
          contents: [
            {
              uri: uri.href,
              text: `Error: Transaction data is too large (${contentLength} bytes, limit is 8KB)`,
            },
          ],
        };
      }
      
      // Fetch the entire transaction data if it's under 8KB
      const response = await fetch(`${gatewayUrl}/raw/${txId}`);

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
            text: `Transaction data (${contentLength} bytes): ${data}`,
          },
        ],
      };
    } catch (error) {
      return {
        contents: [
          {
            uri: uri.href,
            text: `Error: ${error instanceof Error ? error.message : String(error)}`,
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
server.connect(transport).catch((error: unknown) => {
  console.error("Error connecting server:", error);
  process.exit(1);
});
