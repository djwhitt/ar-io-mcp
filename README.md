# AR.IO Example MCP Server

A Model Context Protocol (MCP) server for interacting with AR.IO gateways.

## Features

- Fetch raw transaction data with range requests
- Get gateway information (for default or any specific gateway by hostname)
- List all AR.IO gateways across networks (mainnet, testnet)
- Execute GraphQL queries
- Retrieve ArNS records with filtering and sorting options
- Query Arweave Name Tokens (ANTs) for various data points
- Query Parquet files using SQL via DuckDB integration
- Uses STDIO transport for integration with MCP-compatible LLMs

## Installation

```bash
# Clone the repository
git clone https://github.com/djwhitt/ar-io-example-mcp.git
cd ar-io-example-mcp

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

Configure the Parquet files location by setting the `PARQUET_DIRECTORY` environment variable:

```
PARQUET_DIRECTORY=/path/to/your/parquet/files
```

By default, the server looks for Parquet files in the `data/parquet/tags` directory relative to the project root.

## Available Endpoints

The server provides the following resources and tools:

### Resources

- `transaction://{txId}` - Retrieve transaction data by transaction ID
- `graphql://{query}` - Execute a GraphQL query
- `gateways://{network}` - List all gateways for a specific network (mainnet, testnet)
- `gateway://{hostname}` - Get information about a specific gateway by hostname
- `arns://{network}` - Retrieve ArNS records for a specific network with optional filtering
- `ant://{processId}/{action}` - Query Arweave Name Token (ANT) data by process ID
- `ant://versions` - Get all available ANT versions
- `ant://latest-version` - Get the latest ANT version
- `parquet://{query}` - Execute SQL queries against Parquet files

### Tools

- `fetch-raw-transaction` - Fetch transaction data by transaction ID
- `get-gateway-info` - Get information about the configured gateway
- `get-gateway-info-by-hostname` - Get information about a specific gateway by hostname
- `execute-graphql` - Execute a GraphQL query
- `list-gateways` - List all AR.IO gateways for a specified network
- `get-arns-records` - Retrieve ArNS records with optional pagination and sorting
- `get-ant-info` - Get ANT information by process ID
- `get-ant-state` - Get ANT state (including records) by process ID
- `get-ant-records` - Get all records for an ANT by process ID
- `get-ant-record` - Get a specific ANT record by undername
- `get-ant-versions` - Get all available ANT versions
- `get-latest-ant-version` - Get the latest ANT version
- `query-parquet` - Execute SQL queries against Parquet files
- `get-parquet-schema` - Get schema information about Parquet files

## DuckDB Parquet Integration

The server integrates with DuckDB to provide SQL query capabilities for Parquet files:

- Query Parquet files using standard SQL via the `query-parquet` tool
- Get schema information and sample data via the `get-parquet-schema` tool
- Access Parquet data through the `parquet://{query}` resource

The Parquet query functionality automatically handles BigInt serialization, ensuring that large numeric values are properly converted to strings in the JSON response.

## Arweave Name Tokens (ANTs)

The server provides comprehensive support for querying ANTs:

- Get basic ANT information like name, ticker, and owner
- Retrieve full ANT state including records
- Query specific records by undername
- Access ANT versions information
- Multiple resources and tools available for different query patterns

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