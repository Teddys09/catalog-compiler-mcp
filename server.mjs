#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const host = "catalog-compiler.p.rapidapi.com";
const price = "Sends one US $0.01 RapidAPI request with your key. A rejected request can count. No automatic retries.";
const example = JSON.parse(await readFile(new URL("./sample.json", import.meta.url), "utf8"));
const result = (value) => ({ content: [{ type: "text", text: JSON.stringify(value) }] });
const failure = (message) => ({ isError: true, content: [{ type: "text", text: message }] });
const server = new McpServer({ name: "catalog-compiler", version: "1.0.0" });
const channel = z.enum(["google", "meta", "tiktok"]);
const target = z.object({
  channel, country: z.enum(["US", "GB", "FR", "DE"]), language: z.string().optional(),
  format: z.enum(["tsv", "csv", "xml", "json"]).optional(),
  catalogEligibilityConfirmed: z.boolean().optional().describe("For TikTok, set true only for an eligible catalog."),
}).strict();
const source = z.object({
  format: z.enum(["json", "csv", "tsv", "xml"]),
  products: z.array(z.record(z.unknown())).min(1).max(250).optional(),
  text: z.string().min(1).optional(),
  template: z.enum(["canonical", "shopify", "woocommerce"]).optional(),
  storeUrl: z.string().url().optional(),
  mapping: z.record(z.string()).optional(),
  defaultCurrency: z.string().regex(/^[A-Za-z]{3}$/).optional(),
  defaultCondition: z.enum(["new", "used", "refurbished"]).optional(),
}).strict();

const cache = new Map();
function remember(parts) {
  const runId = randomUUID();
  cache.set(runId, parts);
  if (cache.size > 3) cache.delete(cache.keys().next().value);
  return runId;
}

async function callGateway(path, input, summarize) {
  const key = process.env.RAPIDAPI_KEY?.trim();
  if (!key) return failure("Set RAPIDAPI_KEY in your MCP client. You can use catalog_example for free without a key.");
  if (input.source) {
    const data = input.source.format === "json" ? JSON.stringify(input.source.products) : input.source.text;
    if (!data) return failure("Provide source.products for JSON, or source.text for CSV, TSV or XML.");
    if (Buffer.byteLength(data) > 1000000) return failure("Split the source into batches under the 1,000,000-byte limit.");
  }
  const body = JSON.stringify(input);
  if (Buffer.byteLength(body) > 1250000) return failure("Split the request into smaller batches.");
  try {
    const response = await fetch("https://" + host + path, {
      method: "POST", headers: { "Content-Type": "application/json", "X-RapidAPI-Key": key, "X-RapidAPI-Host": host },
      redirect: "error", body, signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) {
      const details = await response.json().catch(() => ({}));
      const message = String(details.error?.message ?? details.message ?? response.statusText).slice(0,400);
      return failure("RapidAPI HTTP " + response.status + ". " + message);
    }
    return result(summarize(await response.json()));
  } catch {
    return failure("Could not complete the RapidAPI call. Its billing outcome is unknown. Check usage before retrying.");
  }
}

function summarizeCatalog(data) {
  const runId = remember(data.results.map(entry => ({ feed: entry.feed, issues: JSON.stringify(entry.issues) })));
  return { runId, requestId: data.requestId, products: data.totalProducts, targets: data.results.map((entry, index) => ({
    index, channel: entry.target.channel, country: entry.target.country, language: entry.target.language,
    valid: entry.valid, invalid: entry.invalid, feedAvailable: typeof entry.feed === "string", issueCount: entry.issues.length,
    firstIssues: entry.issues.slice(0, 5).map(issue => ({ sku: issue.productId, severity: issue.severity, field: issue.field, code: issue.code })),
  })) };
}

server.registerTool("catalog_example", {
  description: "Free offline example. Returns a fictional one-product compile input, supported limits and the price of online tools. Use without an API key.",
  inputSchema: {},
}, async () => result({ example, pricePerRequestUSD: 0.01, maxVariants: 250, maxSourceBytes: 1000000, maxTargets: 3,
  instructions: "Use your own product data and confirm TikTok eligibility for real catalogs. Read feed text and all issues locally with read_catalog_result after a call." }));

server.registerTool("compile_catalog", {
  description: "Convert product data into Google Merchant Center, Meta and TikTok feeds. Returns counts, issues and a local run ID. " + price,
  inputSchema: { source, targets: z.array(target).min(1).max(3), correctionPolicy: z.enum(["none", "safe"]).optional() },
}, async (input) => callGateway("/v1/catalog/compile", input, summarizeCatalog));

server.registerTool("inspect_feed", {
  description: "Check one existing product feed for a target and identify affected SKUs and fields. " + price,
  inputSchema: { source, target },
}, async (input) => callGateway("/v1/feed/inspect", input, summarizeCatalog));

server.registerTool("explain_diagnostics", {
  description: "Group supplied channel diagnostics by likely field and suggested action. Reads only the messages supplied. " + price,
  inputSchema: { issues: z.array(z.object({ channel, message: z.string().trim().min(1), productId: z.string().optional(), code: z.string().optional() })).min(1).max(250) },
}, async (input) => callGateway("/v1/diagnostics/explain", input, data => ({
  runId: remember([{ diagnoses: JSON.stringify(data.diagnoses) }]), total: data.total, groups: data.groups,
  firstDiagnosis: data.diagnoses[0] ? { likelyField: data.diagnoses[0].likelyField, action: data.diagnoses[0].action } : null,
})));

server.registerTool("read_catalog_result", {
  description: "Free local read of the last three successful calls in this server session. Select a zero-based target index, or index 0 for diagnoses. Join text pages in order using nextOffset. Issues and diagnoses are JSON text.",
  inputSchema: { runId: z.string(), targetIndex: z.number().int().min(0).default(0),
    part: z.enum(["feed", "issues", "diagnoses"]), offset: z.number().int().min(0).default(0),
    length: z.number().int().min(1).max(24000).default(8000) },
}, async ({runId, targetIndex, part, offset, length}) => {
  const text = cache.get(runId)?.[targetIndex]?.[part];
  if (typeof text !== "string") return failure("That result or part is unavailable in this session.");
  if (offset > text.length) return failure("Offset exceeds the result length.");
  const end = Math.min(offset + length, text.length);
  return result({ text: text.slice(offset, end), totalLength: text.length, nextOffset: end < text.length ? end : null });
});
await server.connect(new StdioServerTransport());
