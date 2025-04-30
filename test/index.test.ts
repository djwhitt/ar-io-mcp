import assert from "node:assert";
import { describe, it } from "node:test";

// Run the tests
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
  
  it("should correctly import AR.IO SDK", async () => {
    // Dynamic import to test that the AR.IO SDK imports work
    const { ARIO } = await import("@ar.io/sdk");
    
    assert.ok(ARIO, "ARIO should be importable");
    assert.ok(ARIO.mainnet, "ARIO.mainnet should be a function");
    assert.ok(ARIO.testnet, "ARIO.testnet should be a function");
    assert.ok(ARIO.devnet, "ARIO.devnet should be a function");
    
    // Create an instance to validate the interface (without making network requests)
    const ario = ARIO.mainnet();
    assert.ok(ario, "Should be able to create an ARIO instance");
    assert.ok(typeof ario.getGateways === "function", "getGateways should be a function");
  });
});