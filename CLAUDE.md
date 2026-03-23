# gentik-domains-mcp

MCP server for the Gentik Domains API. Wraps the REST API as 10 MCP tools for AI agent consumption.

## Commands

```bash
npm install        # install deps
npm run build      # compile TypeScript → build/
npm run typecheck   # type-check without emitting
npm start          # run the server (stdio transport)
```

## Structure

- `src/index.ts` — entry point, creates McpServer + StdioServerTransport
- `src/tools.ts` — all 10 tool registrations with zod schemas
- `src/client.ts` — lightweight HTTP client for the Gentik Domains API

## Environment Variables

- `GENTIK_API_KEY` — API key for authenticated endpoints (starts with `gtk_`)
- `GENTIK_API_URL` — API base URL (default: `https://agentdomains.dev`)

## Testing

```bash
# Test server initialization
printf '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}\n' | node build/index.js

# Test a tool call
printf '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}\n{"jsonrpc":"2.0","method":"notifications/initialized"}\n{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"check_domain","arguments":{"domain":"example.com"}}}\n' | node build/index.js
```
