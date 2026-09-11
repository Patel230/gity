import assert from "node:assert/strict";
import test from "node:test";
import { normalizeBaselineGraph } from "./normalize.ts";

function repo(fullName, overrides = {}) {
  const [ownerLogin, name] = fullName.split("/");
  return {
    id: fullName, name, fullName, ownerLogin, ownerAvatarUrl: "", description: null,
    visibility: "private", isPrivate: true, isArchived: false, isFork: false,
    parentFullName: null, primaryLanguage: "TypeScript", primaryLanguageColor: null,
    stars: 0, forks: 0, openPrCount: 0, openIssueCount: 0, defaultBranch: "main",
    pushedAt: "2026-09-11T00:00:00.000Z", updatedAt: "2026-09-11T00:00:00.000Z",
    htmlUrl: `https://github.com/${fullName}`, ciState: "passing", ...overrides,
  };
}

test("normalizes ownership and repository metadata into a baseline graph", () => {
  const graph = normalizeBaselineGraph({ repos: [repo("acme/api"), repo("acme/web")], indexedAt: "2026-09-11T00:00:00.000Z" });
  assert.equal(graph.version, 1);
  assert.equal(graph.nodes.filter((node) => node.type === "organization").length, 1);
  assert.equal(graph.nodes.filter((node) => node.type === "repository").length, 2);
  assert.ok(graph.edges.some((edge) => edge.type === "contains" && edge.targetId === "repository:acme/api"));
  assert.ok(graph.edges.every((edge) => edge.confidence));
});

test("normalizes only verified fork and exact reference relationships", () => {
  const graph = normalizeBaselineGraph({
    repos: [repo("acme/core"), repo("acme/portal", { isFork: true, parentFullName: "acme/core" })],
    references: [{ sourceFullName: "acme/portal", targetFullName: "acme/core", path: "package.json", signal: "scoped-package" }],
    indexedAt: "2026-09-11T00:00:00.000Z",
  });
  assert.ok(graph.edges.some((edge) => edge.type === "depends_on" && edge.confidence === "confirmed"));
  const imports = graph.edges.filter((edge) => edge.type === "imports");
  assert.equal(imports.length, 1);
  assert.equal(imports[0]?.confidence, "high");
  assert.equal(imports[0]?.evidenceIds.length, 1);
  assert.equal(graph.evidence.find((item) => item.id === imports[0]?.evidenceIds[0])?.path, "package.json");
});

test("keeps multiple candidate services independent inside one repository", () => {
  const graph = normalizeBaselineGraph({
    repos: [repo("acme/platform")],
    services: [
      { repositoryFullName: "acme/platform", name: "api", path: "services/api", signal: "service-directory" },
      { repositoryFullName: "acme/platform", name: "worker", path: "services/worker", signal: "service-directory" },
    ],
    indexedAt: "2026-09-11T00:00:00.000Z",
  });
  const services = graph.nodes.filter((node) => node.type === "service");
  assert.deepEqual(services.map((node) => node.name), ["api", "worker"]);
  assert.ok(services.every((node) => node.repositoryIds.length === 1 && node.confidence === "inferred"));
});

test("normalizes contract and infrastructure signals with provenance", () => {
  const graph = normalizeBaselineGraph({
    repos: [repo("acme/platform")],
    signals: [
      { repositoryFullName: "acme/platform", name: "openapi.yaml", path: "openapi.yaml", type: "api", signal: "contract-file" },
      { repositoryFullName: "acme/platform", name: "terraform", path: "terraform", type: "infrastructure", signal: "architecture-directory" },
    ],
    indexedAt: "2026-09-11T00:00:00.000Z",
  });
  assert.equal(graph.nodes.filter((node) => node.type === "api").length, 1);
  assert.equal(graph.nodes.filter((node) => node.type === "infrastructure").length, 1);
  assert.equal(graph.evidence.filter((item) => item.kind === "contract").length, 1);
  assert.ok(graph.edges.some((edge) => edge.type === "contains" && edge.confidence === "inferred"));
});

test("attaches nested architecture signals to the matching service boundary", () => {
  const graph = normalizeBaselineGraph({
    repos: [repo("acme/platform")],
    services: [{ repositoryFullName: "acme/platform", name: "api", path: "services/api", signal: "service-directory" }],
    signals: [{ repositoryFullName: "acme/platform", name: "openapi.yaml", path: "services/api/openapi.yaml", type: "api", signal: "contract-file" }],
    indexedAt: "2026-09-11T00:00:00.000Z",
  });
  const service = graph.nodes.find((node) => node.type === "service");
  const api = graph.nodes.find((node) => node.type === "api");
  assert.ok(service && api);
  assert.ok(graph.edges.some((edge) => edge.sourceId === service.id && edge.targetId === api.id && edge.type === "contains"));
});

test("normalizes explicit connection claims with inferred confidence and provenance", () => {
  const graph = normalizeBaselineGraph({
    repos: [repo("acme/orders")],
    services: [{ repositoryFullName: "acme/orders", name: "orders", path: "services/orders", signal: "service-directory" }],
    connections: [
      { repositoryFullName: "acme/orders", sourcePath: "services/orders/events.ts", sourceServicePath: "services/orders", relation: "publishes", targetName: "project.created", protocol: "kafka" },
      { repositoryFullName: "acme/orders", sourcePath: "services/orders/events.ts", sourceServicePath: "services/orders", relation: "subscribes_to", targetName: "invoice.paid", protocol: "kafka" },
      { repositoryFullName: "acme/orders", sourcePath: "services/orders/client.ts", sourceServicePath: "services/orders", relation: "calls", targetName: "https://billing.example.test", protocol: "http" },
    ],
    indexedAt: "2026-09-11T00:00:00.000Z",
  });
  const connectionEdges = graph.edges.filter((edge) => ["publishes", "subscribes_to", "calls"].includes(edge.type));
  assert.equal(connectionEdges.length, 3);
  assert.ok(connectionEdges.every((edge) => edge.confidence === "inferred" && edge.evidenceIds.length === 1));
  assert.equal(connectionEdges.find((edge) => edge.type === "publishes")?.protocol, "kafka");
  assert.equal(graph.evidence.find((item) => item.path === "services/orders/events.ts")?.kind, "static_analysis");
  assert.ok(connectionEdges.every((edge) => edge.sourceId === "service:acme/orders:services/orders"));
});

test("resolves the same event endpoint across repository boundaries", () => {
  const graph = normalizeBaselineGraph({
    repos: [repo("acme/orders"), repo("acme/invoicing")],
    services: [
      { repositoryFullName: "acme/orders", name: "orders", path: "services/orders", signal: "service-directory" },
      { repositoryFullName: "acme/invoicing", name: "invoicing", path: "services/invoicing", signal: "service-directory" },
    ],
    connections: [
      { repositoryFullName: "acme/orders", sourcePath: "services/orders/events.ts", sourceServicePath: "services/orders", relation: "publishes", targetName: "project.created", protocol: "kafka" },
      { repositoryFullName: "acme/invoicing", sourcePath: "services/invoicing/events.ts", sourceServicePath: "services/invoicing", relation: "subscribes_to", targetName: "project.created", protocol: "kafka" },
    ],
    indexedAt: "2026-09-11T00:00:00.000Z",
  });
  const topics = graph.nodes.filter((node) => node.type === "topic" && node.name === "project.created");
  assert.equal(topics.length, 1);
  assert.equal(topics[0]?.repositoryIds.length, 2);
  assert.equal(graph.edges.filter((edge) => edge.targetId === topics[0]?.id).length, 2);
});
