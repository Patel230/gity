import type { GithubRepoArchitectureConnection } from "../github/types";

const IGNORED_TOKENS = new Set(["json", "utf8", "http", "https", "event", "message", "payload", "topic", "queue", "url", "method", "headers", "body", "options", "name", "type", "get", "post", "put", "patch", "delete"]);

/** Parse only explicit, quoted publish/subscribe/call targets from bounded text. */
export function extractArchitectureConnections(text: string, sourcePath: string, repositoryFullName: string, sourceServicePath: string | null = null): GithubRepoArchitectureConnection[] {
  const connections: GithubRepoArchitectureConnection[] = [];
  for (const line of text.split(/\r?\n/).slice(0, 500)) {
    const lower = line.toLowerCase();
    const relation = /\b(subscrib|consum|listen|receive)\w*/.test(lower) ? "subscribes_to" : /\b(publish|emit|produc|dispatch|send)\w*/.test(lower) ? "publishes" : /\b(fetch|axios|request|grpc|http)\w*/.test(lower) ? "calls" : null;
    if (!relation) continue;
    const target = [...line.matchAll(/["'`]([A-Za-z][A-Za-z0-9_.:/-]{2,80})["'`]/g)].map((match) => match[1]).find((value) => !IGNORED_TOKENS.has(value.toLowerCase()));
    if (!target) continue;
    const protocol = /kafka|redpanda/.test(lower) ? "kafka" : /rabbitmq|amqp/.test(lower) ? "amqp" : /sqs/.test(lower) ? "sqs" : /grpc/.test(lower) ? "grpc" : /https?/.test(lower) ? "http" : null;
    connections.push({ repositoryFullName, sourcePath, sourceServicePath, relation, targetName: target, protocol });
  }
  return [...new Map(connections.map((connection) => [`${connection.relation}:${connection.targetName}:${connection.sourcePath}`, connection])).values()];
}
