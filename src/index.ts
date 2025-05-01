/**
 * AR.IO MCP (Model Context Protocol) Server
 * Provides access to AR.IO Gateway functionality for raw transaction data and gateway info
 */

import { ANT, AOProcess, ARIO } from "@ar.io/sdk";
import { connect } from '@permaweb/aoconnect';
import {
  McpServer,
  ResourceTemplate,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as duckdbAsync from "duckdb-async";
import dotenv from "dotenv";
import fetch from "node-fetch";
import path from "path";
import { z } from "zod";

// Define template variables interface
interface TemplateVars {
  [key: string]: string | string[] | undefined;
}

// Load environment variables
dotenv.config();

// Get AR.IO Gateway URL from environment variable
const gatewayUrl: string = process.env.AR_IO_GATEWAY_URL || "https://ardrive.net";

// Configure DuckDB
const duckdbConfig = {
  path: ':memory:', // In-memory database
  parquetDirectory: process.env.PARQUET_DIRECTORY || path.join(process.cwd(), '/data/parquet/tags'),
};

// Custom JSON serializer that handles BigInt values by converting them to strings
function safeStringify(obj: any, indent: number = 2): string {
  return JSON.stringify(obj, (_, value) => {
    if (typeof value === 'bigint') {
      return value.toString();
    }
    return value;
  }, indent);
}

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

// Tool: Get default gateway info
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

// Tool: Get gateway info by hostname
server.tool(
  "get-gateway-info-by-hostname",
  {
    hostname: z.string().min(1, "Hostname is required"),
  },
  async ({ hostname }: { hostname: string }) => {
    try {
      // Clean the hostname (remove protocol if present)
      const cleanHostname = hostname.replace(/^https?:\/\//, "");
      
      // Construct the gateway info URL
      const gatewayInfoUrl = `https://${cleanHostname}/ar-io/info`;
      
      // Fetch info directly from the gateway
      const response = await fetch(gatewayInfoUrl);

      if (!response.ok) {
        return {
          content: [
            {
              type: "text",
              text: `Error fetching gateway info from ${cleanHostname}: ${response.status} ${response.statusText}`,
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
  }
);

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
        ? ARIO.mainnet()
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

// Tool: Retrieve ArNS records
server.tool(
  "get-arns-records",
  {
    cursor: z.string().optional(),
    limit: z.number().positive().optional(),
    sortBy: z.enum(["name", "type", "processId", "startTimestamp", "undernameLimit", "purchasePrice", "endTimestamp"]).optional(),
    sortOrder: z.enum(["asc", "desc"]).optional(),
  },
  async ({
    cursor,
    limit,
    sortBy,
    sortOrder,
  }: {
    cursor?: string;
    limit?: number;
    sortBy?: "name" | "type" | "processId" | "startTimestamp" | "undernameLimit" | "purchasePrice" | "endTimestamp";
    sortOrder?: "asc" | "desc";
  }) => {
    try {
      // Initialize AR.IO SDK with mainnet (assuming ArNS is primarily on mainnet)
      const ario = ARIO.mainnet();
      
      // Get ArNS records with provided parameters
      const arnsRecordsResult = await ario.getArNSRecords({
        cursor,
        limit: limit || 100, // Use specified limit or default to 100
        sortBy,
        sortOrder,
      });
      
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(arnsRecordsResult, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error retrieving ArNS records: ${error instanceof Error ? error.message : String(error)}`,
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

// Helper function to initialize DuckDB and run a query
async function runDuckDBQuery(query: string): Promise<any[]> {
  try {
    // Create database connection
    const db = await duckdbAsync.Database.create(duckdbConfig.path);

    // Prepare the database
    const conn = await db.connect();
    
    // Execute the query
    const result = await conn.all(query);
    
    // Close the connection
    await conn.close();
    await db.close();
    
    return result;
  } catch (error) {
    console.error("DuckDB query error:", error);
    throw error;
  }
}

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

// Resource: Specific gateway info resource
server.resource(
  "gateway",
  new ResourceTemplate("gateway://{hostname}", { list: undefined }),
  async (uri: URL, variables: Record<string, string | string[]>) => {
    try {
      const hostname = variables.hostname as string;
      
      if (!hostname) {
        return {
          contents: [
            {
              uri: uri.href,
              text: "Error: Missing hostname",
            },
          ],
        };
      }
      
      // Clean the hostname (remove protocol if present)
      const cleanHostname = hostname.replace(/^https?:\/\//, "");
      
      // Construct the gateway info URL
      const gatewayInfoUrl = `https://${cleanHostname}/ar-io/info`;
      
      // Fetch info directly from the gateway
      const response = await fetch(gatewayInfoUrl);

      if (!response.ok) {
        return {
          contents: [
            {
              uri: uri.href,
              text: `Error fetching gateway info from ${cleanHostname}: ${response.status} ${response.statusText}`,
            },
          ],
        };
      }

      const info = await response.json();
      return {
        contents: [
          {
            uri: uri.href,
            text: JSON.stringify(info, null, 2),
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

// Resource: ArNS records resource
server.resource(
  "arns",
  new ResourceTemplate("arns://{network}", { list: undefined }),
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
      
      // Extract parameters from search params
      const searchParams = new URLSearchParams(uri.search);
      const cursor = searchParams.get("cursor") || undefined;
      const limitParam = searchParams.get("limit");
      const limit = limitParam ? parseInt(limitParam, 10) : undefined;
      const sortBy = searchParams.get("sortBy") as "name" | "type" | "processId" | "startTimestamp" | "undernameLimit" | "purchasePrice" | "endTimestamp" | undefined;
      const sortOrder = searchParams.get("sortOrder") as "asc" | "desc" | undefined;
      
      // Validate parameters
      const validLimit = (limit && !isNaN(limit) && limit > 0) ? limit : 100;
      
      if (sortBy && !["height", "nameHeight", "lastUpdateHeight"].includes(sortBy)) {
        return {
          contents: [
            {
              uri: uri.href,
              text: "Error: Invalid sortBy parameter. Must be one of: height, nameHeight, lastUpdateHeight",
            },
          ],
        };
      }
      
      if (sortOrder && !["asc", "desc"].includes(sortOrder)) {
        return {
          contents: [
            {
              uri: uri.href,
              text: "Error: Invalid sortOrder parameter. Must be one of: asc, desc",
            },
          ],
        };
      }
      
      // Get ArNS records with pagination and sorting
      const arnsRecordsResult = await ario.getArNSRecords({
        cursor,
        limit: validLimit,
        sortBy,
        sortOrder,
      });
      
      return {
        contents: [
          {
            uri: uri.href,
            text: JSON.stringify(arnsRecordsResult, null, 2),
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

// Tool: Get ANT information
server.tool(
  "get-ant-info",
  {
    processId: z.string().min(43, "Process ID must be an Arweave transaction ID"),
  },
  async ({ processId }: { processId: string }) => {
    try {
      // Initialize ANT client with the provided process ID
      const ant = ANT.init({ processId });
      
      // Fetch ANT info
      const info = await ant.getInfo();
      
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
            text: `Error fetching ANT info: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }
);

// Tool: Get ANT state (full state including records)
server.tool(
  "get-ant-state",
  {
    processId: z.string().min(43, "Process ID must be an Arweave transaction ID"),
  },
  async ({ processId }: { processId: string }) => {
    try {
      // Initialize ANT client with the provided process ID
      const ant = ANT.init({ processId });
      
      // Fetch ANT state
      const state = await ant.getState();
      
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(state, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error fetching ANT state: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }
);

// Tool: Get ANT records
server.tool(
  "get-ant-records",
  {
    processId: z.string().min(43, "Process ID must be an Arweave transaction ID"),
  },
  async ({ processId }: { processId: string }) => {
    try {
      // Initialize ANT client with the provided process ID
      const ant = ANT.init({ processId });
      
      // Fetch ANT records
      const records = await ant.getRecords();
      
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(records, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error fetching ANT records: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }
);

// Tool: Get specific ANT record
server.tool(
  "get-ant-record",
  {
    processId: z.string().min(43, "Process ID must be an Arweave transaction ID"),
    undername: z.string().min(1, "Undername is required"),
  },
  async ({ processId, undername }: { processId: string; undername: string }) => {
    try {
      // Initialize ANT client with the provided process ID
      const ant = ANT.init({ processId });
      
      // Fetch ANT record for the specified undername
      const record = await ant.getRecord({ undername });
      
      if (!record) {
        return {
          content: [
            {
              type: "text",
              text: `No record found for undername "${undername}"`,
            },
          ],
        };
      }
      
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(record, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error fetching ANT record: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }
);

// Tool: Get ANT versions
server.tool(
  "get-ant-versions",
  {},
  async () => {
    try {
      // Use the static ANT.versions to get all available ANT versions
      const versions = await ANT.versions.getANTVersions();
      
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(versions, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error fetching ANT versions: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }
);

// Tool: Get latest ANT version
server.tool(
  "get-latest-ant-version",
  {},
  async () => {
    try {
      // Use the static ANT.versions to get the latest ANT version
      const latestVersion = await ANT.versions.getLatestANTVersion();
      
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(latestVersion, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error fetching latest ANT version: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }
);

// Resource: ANT resource
server.resource(
  "ant",
  new ResourceTemplate("ant://{processId}/{action}", { list: undefined }),
  async (uri: URL, variables: Record<string, string | string[]>) => {
    try {
      const processId = variables.processId as string;
      const action = variables.action as string || "info";
      
      if (!processId) {
        return {
          contents: [
            {
              uri: uri.href,
              text: "Error: Missing ANT process ID",
            },
          ],
        };
      }
      
      // Initialize ANT client with the provided process ID
      const ant = ANT.init({ processId });
      
      // Extract any additional parameters from the URI search params
      const searchParams = new URLSearchParams(uri.search);
      const undername = searchParams.get("undername") || undefined;
      
      let result;
      
      // Handle different actions
      switch (action) {
        case "info":
          result = await ant.getInfo();
          break;
        case "state":
          result = await ant.getState();
          break;
        case "records":
          result = await ant.getRecords();
          break;
        case "record":
          if (!undername) {
            return {
              contents: [
                {
                  uri: uri.href,
                  text: "Error: Missing undername parameter for record action",
                },
              ],
            };
          }
          result = await ant.getRecord({ undername });
          if (!result) {
            return {
              contents: [
                {
                  uri: uri.href,
                  text: `No record found for undername "${undername}"`,
                },
              ],
            };
          }
          break;
        case "owner":
          result = await ant.getOwner();
          break;
        case "controllers":
          result = await ant.getControllers();
          break;
        case "name":
          result = await ant.getName();
          break;
        case "ticker":
          result = await ant.getTicker();
          break;
        case "balances":
          result = await ant.getBalances();
          break;
        case "logo":
          result = await ant.getLogo();
          break;
        default:
          return {
            contents: [
              {
                uri: uri.href,
                text: `Error: Invalid action "${action}". Valid actions are: info, state, records, record, owner, controllers, name, ticker, balances, logo`,
              },
            ],
          };
      }
      
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

// Resource: ANT versions resource
server.resource(
  "ant-versions",
  new ResourceTemplate("ant://versions", { list: undefined }),
  async (uri: URL) => {
    try {
      // Handle GET requests for ANT versions
      const versions = await ANT.versions.getANTVersions();
      
      return {
        contents: [
          {
            uri: uri.href,
            text: JSON.stringify(versions, null, 2),
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

// Resource: ANT latest version resource
server.resource(
  "ant-latest-version",
  new ResourceTemplate("ant://latest-version", { list: undefined }),
  async (uri: URL) => {
    try {
      // Handle GET requests for latest ANT version
      const latestVersion = await ANT.versions.getLatestANTVersion();
      
      return {
        contents: [
          {
            uri: uri.href,
            text: JSON.stringify(latestVersion, null, 2),
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

// Tool: Query Parquet files using DuckDB
server.tool(
  "query-parquet",
  {
    query: z.string().min(1, "SQL query is required"),
    limit: z.number().positive().optional(),
  },
  async ({ query, limit = 100 }: { query: string; limit?: number }) => {
    try {
      // Create a database connection
      const db = await duckdbAsync.Database.create(duckdbConfig.path);
      
      // Connect to the database
      const conn = await db.connect();
      
      // Register the Parquet files directory
      await conn.exec(`
        CREATE VIEW IF NOT EXISTS tags AS 
        SELECT * FROM read_parquet('${duckdbConfig.parquetDirectory}/*.parquet');
      `);
      
      // Add a LIMIT clause if not already present in the query
      let queryWithLimit = query.trim();
      if (!queryWithLimit.toLowerCase().includes("limit ")) {
        queryWithLimit += ` LIMIT ${limit}`;
      }
      
      // Execute the query
      const result = await conn.all(queryWithLimit);
      
      // Close the connection
      await conn.close();
      await db.close();
      
      return {
        content: [
          {
            type: "text",
            text: safeStringify({
              result,
              rowCount: result.length,
              query: queryWithLimit,
            }),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error executing Parquet query: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }
);

// Tool: Get Parquet schema information
server.tool(
  "get-parquet-schema",
  {},
  async () => {
    try {
      // Create a database connection
      const db = await duckdbAsync.Database.create(duckdbConfig.path);
      
      // Connect to the database
      const conn = await db.connect();
      
      // Register the Parquet files directory and get schema
      await conn.exec(`
        CREATE VIEW IF NOT EXISTS tags AS 
        SELECT * FROM read_parquet('${duckdbConfig.parquetDirectory}/*.parquet');
      `);
      
      // Get schema information
      const schema = await conn.all(`
        DESCRIBE tags;
      `);
      
      // Get sample data
      const sample = await conn.all(`
        SELECT * FROM tags LIMIT 5;
      `);
      
      // Get count
      const countResult = await conn.all(`
        SELECT COUNT(*) as total FROM tags;
      `);
      
      // Close the connection
      await conn.close();
      await db.close();
      
      return {
        content: [
          {
            type: "text",
            text: safeStringify({
              schema,
              sampleData: sample,
              totalRows: countResult[0]?.total || 0,
              parquetDirectory: duckdbConfig.parquetDirectory,
            }),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error getting Parquet schema: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }
);

// Resource: Parquet data access
server.resource(
  "parquet",
  new ResourceTemplate("parquet://{query}", { list: undefined }),
  async (uri: URL, variables: Record<string, string | string[]>) => {
    try {
      const query = variables.query as string;
      
      if (!query) {
        return {
          contents: [
            {
              uri: uri.href,
              text: "Error: Missing SQL query",
            },
          ],
        };
      }
      
      // Extract limit from search params if it exists
      const searchParams = new URLSearchParams(uri.search);
      const limitParam = searchParams.get("limit");
      const limit = limitParam ? parseInt(limitParam, 10) : 100;
      
      // Create a database connection
      const db = await duckdbAsync.Database.create(duckdbConfig.path);
      
      // Connect to the database
      const conn = await db.connect();
      
      // Register the Parquet files directory
      await conn.exec(`
        CREATE VIEW IF NOT EXISTS tags AS 
        SELECT * FROM read_parquet('${duckdbConfig.parquetDirectory}/*.parquet');
      `);
      
      // Add a LIMIT clause if not already present in the query
      let queryWithLimit = query.trim();
      if (!queryWithLimit.toLowerCase().includes("limit ")) {
        queryWithLimit += ` LIMIT ${limit}`;
      }
      
      // Execute the query
      const result = await conn.all(queryWithLimit);
      
      // Close the connection
      await conn.close();
      await db.close();
      
      return {
        contents: [
          {
            uri: uri.href,
            text: safeStringify({
              result,
              rowCount: result.length,
              query: queryWithLimit,
            }),
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
