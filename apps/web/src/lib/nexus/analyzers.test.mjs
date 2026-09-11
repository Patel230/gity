import assert from "node:assert/strict";
import test from "node:test";
import { extractArchitectureConnections } from "./analyzers.ts";

test("extracts explicit message and HTTP connection claims with provenance", () => {
  const connections = extractArchitectureConnections([
    'publish("project.created")',
    'subscribe(`project.created`)',
    'fetch("https://billing.example.test/invoices")',
    'JSON.stringify("payload")',
  ].join("\n"), "services/orders/transport.ts", "acme/orders", "services/orders");

  assert.deepEqual(connections.map((connection) => [connection.relation, connection.targetName, connection.protocol]), [
    ["publishes", "project.created", null],
    ["subscribes_to", "project.created", null],
    ["calls", "https://billing.example.test/invoices", "http"],
  ]);
  assert.ok(connections.every((connection) => connection.sourceServicePath === "services/orders"));
});

test("does not turn generic quoted values into relationships", () => {
  const connections = extractArchitectureConnections('const value = "payload";\nconst format = "utf8";', "src/value.ts", "acme/orders");
  assert.equal(connections.length, 0);
});
