# web2md-mcp

[![npm version](https://img.shields.io/npm/v/web2md-mcp.svg)](https://www.npmjs.com/package/web2md-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![MCP](https://img.shields.io/badge/Model%20Context%20Protocol-compatible-blue)](https://modelcontextprotocol.io)

**Convert any webpage to clean Markdown from Claude Desktop, Cursor, or any MCP-compatible AI agent.**

`web2md-mcp` is the official [Model Context Protocol](https://modelcontextprotocol.io) server for [Web2MD](https://web2md.org). Give your AI agent a `convert_url` tool and it can turn any webpage — articles, docs, Reddit threads, GitHub READMEs — into clean, token-efficient Markdown without copy-pasting.

> Unlike server-side readers, the optional **Agent Bridge** mode routes conversion through your real browser session — so it works on Reddit, X, paywalled Substack, and other pages that block datacenter scrapers.

---

## Why use this?

The honest version: most webpage-to-Markdown tools convert HTML well. The thing
they differ on is **whether they can reach the page at all**.

| | web2md-mcp | Jina Reader / Firecrawl | MarkDownload / SingleFile | Turndown |
|---|---|---|---|---|
| Clean Markdown built for LLM context | ✅ | ✅ | ✅ | ✅ (library only) |
| Callable by an AI agent (MCP) | ✅ | via HTTP API | ❌ manual click | ❌ |
| Works on Reddit / X / paywalled pages | ✅ (Agent Bridge) | ❌ blocked by anti-bot | ✅ (you click it) | n/a |
| Uses *your* authenticated session | ✅ (Agent Bridge) | ❌ datacenter fetch | ✅ | n/a |
| Batch convert many URLs unattended | ✅ up to 50 | ✅ | ❌ one at a time | ❌ |
| Token counting + metadata | ✅ | ⚠️ varies | ❌ | ❌ |

**Where each one is the right answer:**

- **Jina Reader / Firecrawl** — public pages at scale, no browser needed. If your
  URLs are public docs or blogs, these are simpler than running an extension.
- **MarkDownload / SingleFile / Obsidian Web Clipper** — you're reading a page and
  want to save it yourself. Great at that; they need a human to click.
- **Turndown** — an HTML→Markdown library, not a fetcher. Use it inside your own code.
- **web2md-mcp** — an *agent* needs the page, and the page is behind a login, a
  bot wall, or heavy JS. That's the gap this fills: conversion happens in your
  real browser session, so the page sees you, not a datacenter IP.

If you've hit "I can't access that URL" in Claude or Cursor when pasting a
Reddit/X/Substack link, this is the fix.

---

## Install

```bash
npm install -g web2md-mcp
```

Or run directly with npx (no install):

```bash
npx web2md-mcp
```

## Setup

### 1. Get an API key

Sign up at [web2md.org](https://web2md.org) and copy your API key (`w2m_...`) from the dashboard.

### 2. Add to Claude Desktop

`~/.claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "web2md": {
      "command": "npx",
      "args": ["web2md-mcp"],
      "env": { "WEB2MD_API_KEY": "w2m_your_api_key" }
    }
  }
}
```

### 3. Add to Cursor

`~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "web2md": {
      "command": "npx",
      "args": ["web2md-mcp"],
      "env": { "WEB2MD_API_KEY": "w2m_your_api_key" }
    }
  }
}
```

Restart your client. The agent now has `convert_url` and `batch_convert` tools available.

---

## Tools

### `convert_url`

Convert a single webpage URL to Markdown.

```jsonc
// Input
{ "url": "https://example.com/article" }
// Output
{ "markdown": "# Article Title\n...", "metadata": { "title": "...", "wordCount": 1240, "readingTime": "6 min" } }
```

### `batch_convert`

Convert up to 50 URLs in one call — ideal for filling a research context window or building a RAG corpus.

```jsonc
// Input
{ "urls": ["https://...", "https://..."] }
// Output
[ { "url": "...", "markdown": "...", "metadata": { ... } }, ... ]
```

### `agent_convert` / `agent_batch_convert`

Convert through the Web2MD Chrome extension's **real browser session** (requires [Agent Bridge](https://web2md.org/docs/advanced/agent-bridge) setup). This is what bypasses anti-bot blocking on Reddit, X, and login-protected pages.

---

## Example prompts

Once configured, just ask your agent:

- *"Convert this Reddit thread to markdown and summarize the top arguments."*
- *"Fetch these 10 blog URLs as markdown and build a comparison table."*
- *"Read this GitHub README as clean markdown and explain the setup steps."*

---

## Agent Bridge (browser-based conversion)

Server-side fetching fails on Reddit, X, paywalled Substack/Medium, and JS-heavy SPAs — datacenter IPs get blocked and client-side-rendered content never loads. Agent Bridge solves this by routing the conversion through the Web2MD Chrome extension running in **your** logged-in browser. Setup guide: [web2md.org/docs/advanced/agent-bridge](https://web2md.org/docs/advanced/agent-bridge).

---

## Links

- 🌐 Website: [web2md.org](https://web2md.org)
- 🧩 Chrome Web Store: [Web2MD — Web to Markdown](https://chromewebstore.google.com/detail/web2md-web-to-markdown/ijmgpkkfgpijifldbjafjiapehppcbcn)
- 📖 Docs: [web2md.org/docs](https://web2md.org/docs)
- 🔌 MCP spec: [modelcontextprotocol.io](https://modelcontextprotocol.io)
- ✉️ Support: support@web2md.org

## License

MIT © [Web2MD](https://web2md.org)
