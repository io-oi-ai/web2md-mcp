# web2md-mcp

MCP Server for [Web2MD](https://web2md.org) — convert webpage URLs to clean Markdown from Claude Desktop, Cursor, or any MCP-compatible AI agent.

## Install

```bash
npm install -g web2md-mcp
```

Or use directly with npx:

```bash
npx web2md-mcp
```

## Setup

### 1. Get an API key

Sign up at [web2md.org](https://web2md.org) and get your API key from the dashboard.

### 2. Configure Claude Desktop

Add to `~/.claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "web2md": {
      "command": "npx",
      "args": ["web2md-mcp"],
      "env": {
        "WEB2MD_API_KEY": "w2m_your_api_key"
      }
    }
  }
}
```

### 3. Configure Cursor

Add to `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "web2md": {
      "command": "npx",
      "args": ["web2md-mcp"],
      "env": {
        "WEB2MD_API_KEY": "w2m_your_api_key"
      }
    }
  }
}
```

## MCP Tools

### `convert_url`

Convert a single webpage URL to Markdown.

```
Input: { url: "https://example.com/article" }
Output: { markdown: "# Article Title\n...", metadata: { title, wordCount, readingTime } }
```

### `batch_convert`

Convert multiple URLs at once (up to 50).

```
Input: { urls: ["https://...", "https://..."] }
Output: [{ url, markdown, metadata }, ...]
```

### `agent_convert` / `agent_batch_convert`

Convert URLs through the Chrome extension's real browser session (requires Agent Bridge setup). Works on Reddit, login-protected sites, and JS-rendered pages.

## Agent Bridge

For full browser-based conversion (bypasses anti-bot), see [Agent Bridge docs](https://web2md.org/docs/advanced/agent-bridge).

## Links

- Website: https://web2md.org
- Chrome Web Store: https://chromewebstore.google.com/detail/web2md/ijmgpkkfgpijifldbjafjiapehppcbcn
- Documentation: https://web2md.org/docs
- Support: support@web2md.org
