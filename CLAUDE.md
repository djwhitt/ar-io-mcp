# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build/Run/Test Commands
- Install: `yarn install`
- Run development server: `yarn dev`
- Run production: `yarn start`
- Lint: `yarn lint`
- Format code: `yarn format`
- Run all tests: `yarn test`
- Run a specific test: `yarn test:single "test name pattern"`

## Code Style Guidelines
- JavaScript with ESM modules (import/export)
- Format with Biome (2-space indentation)
- Double quotes for strings
- Semicolons required
- Follow Biome linting configuration
- Organize imports (dependencies first, then internal modules)
- Naming: camelCase for variables/functions, PascalCase for classes
- Prefer async/await over promise chains
- Use explicit error handling with try/catch blocks
- Implement proper error logging
- Write test cases using Node.js built-in test runner
- Use MCP SDK properly: tools with proper schemas, resources with templates
- Use URIs like "transaction://{txId}" for resource templates
- Return proper MCP response formats (content vs contents arrays)