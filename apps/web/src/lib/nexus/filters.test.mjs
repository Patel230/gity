import assert from "node:assert/strict";
import test from "node:test";
import { filterNexusNodes } from "./filters.ts";
import { normalizeBaselineGraph } from "./normalize.ts";

const base = (fullName, language) => {
  const [ownerLogin, name] = fullName.split("/");
  return {
    id: fullName, name, fullName, ownerLogin, ownerAvatarUrl: "", description: `${name} service`,
    visibility: "public", isPrivate: false, isArchived: false, isFork: false, parentFullName: null,
    primaryLanguage: language, primaryLanguageColor: null, stars: 0, forks: 0, openPrCount: 0,
    openIssueCount: 0, defaultBranch: "main", pushedAt: null, updatedAt: null,
    htmlUrl: `https://github.com/${fullName}`, ciState: "unknown",
  };
};

test("filters normalized nodes by type, organization, and query", () => {
  const graph = normalizeBaselineGraph({ repos: [base("acme/api", "Go"), base("other/web", "TypeScript")] });
  assert.deepEqual(filterNexusNodes(graph, { types: ["repository"], organizationId: "organization:acme" }).map((node) => node.name), ["api"]);
  assert.deepEqual(filterNexusNodes(graph, { query: "web" }).map((node) => node.name), ["web"]);
});
