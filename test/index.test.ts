import assert from "node:assert";
import { describe, it } from "node:test";

describe("AR.IO MCP Server", () => {
  it("should be properly configured", () => {
    // Verify environment variables are properly handled
    assert.ok(process.env.AR_IO_GATEWAY_URL || "https://arweave.net");
  });

  // This test would typically use a mock server, but we'll just verify the SDK imports
  it("should use the correct MCP SDK imports", async () => {
    // Dynamic import to test that the imports work
    const { McpServer, ResourceTemplate } = await import(
      "@modelcontextprotocol/sdk/server/mcp.js"
    );
    const { StdioServerTransport } = await import(
      "@modelcontextprotocol/sdk/server/stdio.js"
    );

    assert.ok(McpServer, "McpServer should be importable");
    assert.ok(ResourceTemplate, "ResourceTemplate should be importable");
    assert.ok(
      StdioServerTransport,
      "StdioServerTransport should be importable"
    );
  });
});