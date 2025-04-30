/**
 * AR.IO MCP (Model Context Protocol) Server
 * Provides access to AR.IO Gateway functionality for raw transaction data and gateway info
 */

import { AOProcess, ARIO } from "@ar.io/sdk";
import { connect } from '@permaweb/aoconnect';
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

      // Check content type to handle data appropriately
      const contentType = response.headers.get("Content-Type") || "";
      let data;
      
      if (contentType.includes("text/") || 
          contentType.includes("application/json") || 
          contentType.includes("application/xml") ||
          contentType.includes("application/javascript")) {
        // Handle text-based content types
        data = await response.text();
      } else {
        // Handle binary content types with base64 encoding
        const buffer = await response.arrayBuffer();
        data = `[Binary data encoded as base64]: ${Buffer.from(buffer).toString('base64')}`;
      }
      
      return {
        content: [
          {
            type: "text",
            text: `Transaction data (${contentLength} bytes, ${contentType}): ${data}`,
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

// Tool: Execute GraphQL query
server.tool(
  "execute-graphql",
  {
    query: z.string().min(1, "GraphQL query is required"),
    variables: z.record(z.any()).optional(),
    operationName: z.string().optional(),
  },
  async ({
    query,
    variables,
    operationName,
  }: {
    query: string;
    variables?: Record<string, any>;
    operationName?: string;
  }) => {
    try {
      const response = await fetch(`${gatewayUrl}/graphql`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query,
          variables,
          operationName,
        }),
      });

      if (!response.ok) {
        return {
          content: [
            {
              type: "text",
              text: `Error executing GraphQL query: ${response.status} ${response.statusText}`,
            },
          ],
        };
      }

      const result = await response.json();
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
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

      // Check content type to handle data appropriately
      const contentType = response.headers.get("Content-Type") || "";
      let data;
      
      if (contentType.includes("text/") || 
          contentType.includes("application/json") || 
          contentType.includes("application/xml") ||
          contentType.includes("application/javascript")) {
        // Handle text-based content types
        data = await response.text();
      } else {
        // Handle binary content types with base64 encoding
        const buffer = await response.arrayBuffer();
        data = `[Binary data encoded as base64]: ${Buffer.from(buffer).toString('base64')}`;
      }
      
      return {
        contents: [
          {
            uri: uri.href,
            text: `Transaction data (${contentLength} bytes, ${contentType}): ${data}`,
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

// Tool: List all AR.IO gateways
server.tool(
  "list-gateways",
  {
    network: z.enum(["mainnet", "testnet"]).optional(),
    limit: z.number().positive().optional(),
  },
  async ({
    network = "mainnet",
    limit,
  }: {
    network?: "mainnet" | "testnet";
    limit?: number;
  }) => {
    try {
      // Initialize AR.IO SDK with specified network
      const ario = network === "mainnet" 
        ? ARIO.init({
          process: new AOProcess({
            processId: 'qNvAoz0TgcH7DMg8BCVn8jF32QH5L6T29VjHxhHqqGE',
            ao: connect({
              CU_URL: 'https://cu.ardrive.net'
            }),
          }),
        }) 
        : ARIO.testnet();
      
      // Get gateways with pagination
      const gatewaysResult = await ario.getGateways({
        limit: limit || 100 // Use specified limit or default to 100
      });
      
      // Extract the items array
      const gateways = gatewaysResult.items;
      
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(gateways, null, 2),
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

// Resource: GraphQL resource
server.resource(
  "graphql",
  new ResourceTemplate("graphql://{query}", { list: undefined }),
  async (uri: URL, variables: Record<string, string | string[]>) => {
    try {
      const query = variables.query as string;
      
      if (!query) {
        return {
          contents: [
            {
              uri: uri.href,
              text: "Error: Missing GraphQL query",
            },
          ],
        };
      }

      // Extract any variables and operationName from the URI search params
      const searchParams = new URLSearchParams(uri.search);
      const variablesParam = searchParams.get("variables");
      const operationName = searchParams.get("operationName") || undefined;
      
      // Parse variables if they exist
      let parsedVariables: Record<string, any> | undefined;
      if (variablesParam) {
        try {
          parsedVariables = JSON.parse(variablesParam);
        } catch (err) {
          return {
            contents: [
              {
                uri: uri.href,
                text: "Error: Invalid JSON in variables parameter",
              },
            ],
          };
        }
      }
      
      const response = await fetch(`${gatewayUrl}/graphql`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query,
          variables: parsedVariables,
          operationName,
        }),
      });

      if (!response.ok) {
        return {
          contents: [
            {
              uri: uri.href,
              text: `Error executing GraphQL query: ${response.status} ${response.statusText}`,
            },
          ],
        };
      }

      const result = await response.json();
      return {
        contents: [
          {
            uri: uri.href,
            text: JSON.stringify(result, null, 2),
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

// Resource: Gateway list resource
server.resource(
  "gateways",
  new ResourceTemplate("gateways://{network}", { list: undefined }),
  async (uri: URL, variables: Record<string, string | string[]>) => {
    try {
      const network = (variables.network as string) || "mainnet";
      
      if (!["mainnet", "testnet"].includes(network)) {
        return {
          contents: [
            {
              uri: uri.href,
              text: "Error: Invalid network. Must be one of: mainnet, testnet",
            },
          ],
        };
      }
      
      // Initialize AR.IO SDK with specified network
      const ario = network === "mainnet" 
        ? ARIO.mainnet() 
        : ARIO.testnet();
      
      // Extract limit from search params if it exists
      const searchParams = new URLSearchParams(uri.search);
      const limitParam = searchParams.get("limit");
      const limit = limitParam ? parseInt(limitParam, 10) : undefined;
      
      // Get gateways with pagination
      const validLimit = (limit && !isNaN(limit) && limit > 0) ? limit : 100;
      const gatewaysResult = await ario.getGateways({
        limit: validLimit
      });
      
      // Extract the items array
      const gateways = gatewaysResult.items;
      
      return {
        contents: [
          {
            uri: uri.href,
            text: JSON.stringify(gateways, null, 2),
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

// Connect the server to the transport
server.connect(transport).catch((error: unknown) => {
  console.error("Error connecting server:", error);
  process.exit(1);
});
