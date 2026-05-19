# MCP Servers Configuration

MCP (Model Context Protocol) servers extend Claude Code with external tool integrations — payment APIs, documentation lookup, design tools, etc.

## How MCP Servers Work

MCP servers are background processes that Claude Code launches and communicates with. They expose tools that Claude can call just like built-in tools.

**Global config:** `~/.claude/settings.json` under `mcpServers`
**Project config:** `.mcp.json` in the project root

## Example MCP Servers

### Shopify Dev MCP (Global)

**Location:** `~/.claude/settings.json`

```json
{
  "mcpServers": {
    "shopify-dev-mcp": {
      "command": "npx",
      "args": ["-y", "@shopify/dev-mcp@latest"]
    }
  }
}
```

Provides access to Shopify development documentation and APIs.

### Paddle Billing MCP (Project)

**Location:** `.mcp.json` in project root

```json
{
  "mcpServers": {
    "paddle": {
      "command": "npx",
      "args": [
        "-y",
        "@paddle/paddle-mcp",
        "--api-key=YOUR_PADDLE_API_KEY",
        "--environment=production",
        "--tools=all"
      ]
    }
  }
}
```

Full Paddle billing API access — products, prices, subscriptions, customers, transactions.

**Approve in project settings** (`.claude/settings.local.json`):
```json
{
  "enableAllProjectMcpServers": true,
  "enabledMcpjsonServers": ["paddle"]
}
```

### Context7 (Documentation Lookup)

Available as a built-in MCP server. Retrieves up-to-date documentation and code examples for any library.

## How to Set Up

### Adding a Global MCP Server

1. Edit `~/.claude/settings.json`
2. Add to the `mcpServers` object:
   ```json
   {
     "mcpServers": {
       "server-name": {
         "command": "npx",
         "args": ["-y", "@package/name", "--flag=value"]
       }
     }
   }
   ```
3. Restart Claude Code

### Adding a Project MCP Server

1. Create `.mcp.json` in the project root:
   ```json
   {
     "mcpServers": {
       "server-name": {
         "command": "npx",
         "args": ["-y", "@package/name"]
       }
     }
   }
   ```
2. Approve the server when Claude Code prompts, or pre-approve in `.claude/settings.local.json`:
   ```json
   {
     "enabledMcpjsonServers": ["server-name"]
   }
   ```

### Security Notes

- MCP server configs can contain API keys — keep `.mcp.json` in `.gitignore` if it has secrets
- Use `.claude/settings.local.json` (gitignored) for project-level MCP approvals
- Global MCP servers in `~/.claude/settings.json` are trusted by default
