# AR.IO MCP Server

A Model Context Protocol (MCP) server for interacting with AR.IO gateways.

## Features

- Fetch raw transaction data with range requests
- Get gateway information
- List all AR.IO gateways across networks (mainnet, testnet)
- Execute GraphQL queries
- Uses STDIO transport for integration with MCP-compatible LLMs

## Installation

```bash
# Clone the repository
git clone https://github.com/your-username/ar-io-mcp.git
cd ar-io-mcp

# Install dependencies
yarn install

# Create .env file
cp .env.example .env
# Edit .env to set your preferred AR.IO gateway URL
```

## Usage

```bash
# Start the server in development mode (with auto-reload)
yarn dev

# Start the server in production mode
yarn start
```

## Configuration

Configure the gateway URL by setting the `AR_IO_GATEWAY_URL` environment variable:

```
AR_IO_GATEWAY_URL=https://arweave.net
```

## Available Endpoints

The server provides the following resources and tools:

### Resources

- `transaction://{txId}` - Retrieve transaction data by transaction ID
- `graphql://{query}` - Execute a GraphQL query
- `gateways://{network}` - List all gateways for a specific network (mainnet, testnet)

### Tools

- `fetch-raw-transaction` - Fetch transaction data by transaction ID
- `get-gateway-info` - Get information about the configured gateway
- `execute-graphql` - Execute a GraphQL query
- `list-gateways` - List all AR.IO gateways for a specified network

## Development

```bash
# Run tests
yarn test

# Run a specific test
yarn test:single "test name pattern"

# Lint code
yarn lint

# Format code
yarn format
```

## License

MIT