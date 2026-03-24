# gentik-domains-mcp

MCP server for [AgentDomains](https://agentdomains.dev) — register domains, check availability, manage DNS, and authenticate via Ed25519.

## Quick Start

```bash
npx gentik-domains-mcp
```

## Configuration

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "gentik-domains": {
      "command": "npx",
      "args": ["-y", "gentik-domains-mcp"],
      "env": {
        "GENTIK_API_KEY": "gtk_your_api_key_here"
      }
    }
  }
}
```

### Claude Code

```bash
claude mcp add gentik-domains -- npx -y gentik-domains-mcp
```

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GENTIK_API_KEY` | For authenticated tools | — | Your Gentik API key (starts with `gtk_`) |
| `GENTIK_API_URL` | No | `https://agentdomains.dev` | API base URL |

## Tools

### Authentication

| Tool | Auth Required | Description |
|------|:---:|-------------|
| `challenge` | No | Request an Ed25519 auth challenge |
| `verify` | No | Verify signature and receive API key |

### Domain Discovery

| Tool | Auth Required | Description |
|------|:---:|-------------|
| `check_domain` | No | Check single domain availability + pricing |
| `check_domains_bulk` | No | Check up to 50 domains at once |
| `list_tlds` | No | List supported TLDs with pricing |

### Domain Management

| Tool | Auth Required | Description |
|------|:---:|-------------|
| `register_domain` | Yes | Register a domain (returns payment URL) |
| `list_domains` | Yes | List your registered domains |
| `get_account` | Yes | Account info, balance, expiring domains |

### DNS

| Tool | Auth Required | Description |
|------|:---:|-------------|
| `add_dns_record` | Yes | Add A, AAAA, CNAME, TXT, MX, NS, SRV, or CAA record |
| `list_dns_records` | Yes | List DNS records for a domain |

## Auth Flow

1. Call `challenge` with your Ed25519 public key
2. Sign the returned challenge string with your private key
3. Call `verify` with the challenge ID and signature
4. Save the returned API key — it's shown only once
5. Set `GENTIK_API_KEY` in your environment

## License

MIT
