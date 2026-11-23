import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const tools = ["catalog_example", "compile_catalog", "inspect_feed", "explain_diagnostics", "read_catalog_result"];
async function connect(key) {
  const client = new Client({ name: "catalog-compiler-test", version: "1.0.0" });
  await client.connect(new StdioClientTransport({
    command: process.execPath, args: [process.env.CATALOG_MCP_TEST_ENTRY ?? fileURLToPath(new URL("./server.mjs", import.meta.url))],
    env: { PATH: process.env.PATH, RAPIDAPI_KEY: key }, stderr: "inherit",
  }));
  return client;
}
async function call(client, name, args) {
  const answer = await client.callTool({ name, arguments: args });
  assert.ok(!answer.isError, answer.content[0]?.text);
  return JSON.parse(answer.content[0].text);
}
const offline = await connect("");
let example;
try {
  assert.deepEqual((await offline.listTools()).tools.map(tool => tool.name).sort(), [...tools].sort());
  example = (await call(offline, "catalog_example", {})).example;
  const denied = await offline.callTool({ name: "compile_catalog", arguments: example });
  assert.equal(denied.isError, true);
  assert.match(denied.content[0].text, /RAPIDAPI_KEY/);
  console.log("PASS MCP initialize, list five tools, offline example, and missing key.");
} finally {
  await offline.close();
}
if (process.env.CATALOG_MCP_LIVE_TEST === "1") {
  assert.ok(process.env.RAPIDAPI_KEY, "Set RAPIDAPI_KEY for the optional three-call live test.");
  const live = await connect(process.env.RAPIDAPI_KEY);
  try {
    const invalid = await live.callTool({ name: "compile_catalog", arguments: { ...example, source: { format: "json" } } });
    assert.equal(invalid.isError, true);
    const compiled = await call(live, "compile_catalog", example);
    assert.equal(compiled.targets.length, 3);
    for (const [targetIndex, target] of compiled.targets.entries()) {
      assert.equal(target.valid, 1);
      let offset = 0, text = "";
      do {
        const page = await call(live, "read_catalog_result", { runId: compiled.runId, targetIndex, part: "feed", offset, length: 100 });
        text += page.text;
        offset = page.nextOffset;
      } while (offset !== null);
      assert.match(text, /SHIRT-BLUE-M/);
    }
    const badSource = structuredClone(example.source);
    delete badSource.products[0].image_link;
    const inspected = await call(live, "inspect_feed", { source: badSource, target: example.targets[0] });
    assert.equal(inspected.targets[0].invalid, 1);
    const issues = await call(live, "read_catalog_result", { runId: inspected.runId, part: "issues" });
    assert.ok(JSON.parse(issues.text).some(issue => issue.field === "image_link"));
    const explained = await call(live, "explain_diagnostics", { issues: [{ channel: "google", message: "missing price" }] });
    const diagnoses = await call(live, "read_catalog_result", { runId: explained.runId, part: "diagnoses" });
    assert.equal(JSON.parse(diagnoses.text)[0].likelyField, "price");
    console.log("PASS three live MCP calls, three channel files, pagination, missing image, diagnostic grouping and cached reads.");
  } finally {
    await live.close();
  }
}
