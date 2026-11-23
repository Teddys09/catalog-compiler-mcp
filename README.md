# Catalog Compiler MCP server

Give a local MCP-compatible AI agent the ability to generate and validate Google Merchant Center, Meta and TikTok product feeds from Shopify, WooCommerce or custom catalog exports. The server uses standard MCP over stdio. It runs on your machine and uses your own RapidAPI application key for live calls.

[Installation guide and example prompts](https://feeds.newbsscraping.com/guides/mcp-product-feeds/) · [Download the MCPB extension](https://github.com/Teddys09/catalog-compiler-mcp/releases/download/v1.0.0/catalog-compiler.mcpb) · [RapidAPI pricing](https://rapidapi.com/TeddyStrumilo/api/catalog-compiler/pricing)

## Connect a hosted client

RapidAPI also exposes the REST endpoints as hosted MCP tools. Open **MCP configuration** in the signed-in [RapidAPI playground](https://rapidapi.com/TeddyStrumilo/api/catalog-compiler/playground/%2Fv1%2Fcatalog%2Fcompile). For a streamable HTTP client that supports custom headers, use `https://mcp.rapidapi.com`, set `x-api-host` to `catalog-compiler.p.rapidapi.com` and provide your RapidAPI key in the secret `x-api-key` header. The hosted `v1catalogcompile` tool takes the example request and returns all requested feeds. The local tool table below applies to the desktop extension and stdio package.

## Connect a local client

Install the desktop extension in an MCPB-capable application, or add this entry in a stdio client. The command requires Node.js 22+ and Git.

```json
{
  "mcpServers": {
    "catalog-compiler": {
      "command": "npx",
      "args": ["-y", "github:Teddys09/catalog-compiler-mcp#v1.0.0"]
    }
  }
}
```

For clients using a `servers` section, put the same command and arguments there. The free `catalog_example` tool works immediately. To enable live requests, use your client's secret settings to supply the server environment variable `RAPIDAPI_KEY`, or set the credential when installing the desktop extension. Keep keys out of prompts and shared config files.

Alternatively, clone the repository, run `npm ci --ignore-scripts`, then configure the server command as `node` with the absolute path to `server.mjs`.

| Tool | Behavior | RapidAPI fees |
| --- | --- | --- |
| `catalog_example` | Return a fictional input, batch limits and price | Free, offline |
| `compile_catalog` | Generate up to three feeds and return a summary with SKU-level issues | $0.01 per call |
| `inspect_feed` | Check an existing feed for one target | $0.01 per call |
| `explain_diagnostics` | Explain error messages supplied by the caller | $0.01 per call |
| `read_catalog_result` | Read paginated feed text, issues or diagnoses from a previous call | Free, offline |

**Example prompt:** “Use the offline example. Then make one compile call for Google and Meta and show me the Google TSV using the same run ID.”

One compile request can process up to 250 variants, 1 MB of source data, and three targets. The rate limit is 10 API requests per minute. Rejected requests can count. Live calls send the supplied catalog or diagnostics to the fixed RapidAPI gateway over HTTPS. The MCP server keeps results from the three most recent successful calls in process memory. It never automatically retries a paid call. Generated outputs must be hosted or uploaded by the caller. TikTok requires an eligible account.

## Workflows and samples

See [the example files](examples/README.md), [the n8n workflow](https://feeds.newbsscraping.com/guides/n8n-product-feeds/) and [the free feed preview](https://feeds.newbsscraping.com/preview/) to use the API directly or compare an export with actual outputs.

**Support:** [Catalog Compiler support](https://feeds.newbsscraping.com/support).
