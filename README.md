# AR.IO MCP Server

A Model Context Protocol (MCP) server for interacting with AR.IO gateways.

## Features

- Fetch raw transaction data with range requests
- Get gateway information 
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