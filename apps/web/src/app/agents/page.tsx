import { Bot, CheckCircle2, KeyRound, LockKeyhole, Wrench } from "lucide-react";
import { PageHead } from "@/components/layout/page-head";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const tools = [
  ["get_viewer", "Read the GitHub App installation identity."],
  ["list_repositories", "List repositories visible to the installation."],
  ["list_pull_requests", "List pull requests for a repository."],
  ["search_issues", "Search issues and pull requests."],
  ["get_workflow_runs", "Inspect recent Actions workflow runs."],
  ["get_recent_activity", "Read recent public activity for a user."],
] as const;

export default function AgentsPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <PageHead title="Agents" sub="A secure read-only interface for GitHub automation" />

      <Card accent={18}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Bot className="size-4" /> Gity Agent API <Badge variant="success">read-only</Badge></CardTitle>
          <CardDescription>Connect an MCP-compatible agent to Gity without giving it your browser token.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-xs leading-relaxed text-muted-foreground">
          <div className="flex items-start gap-2 rounded-md border border-border bg-background/40 p-3">
            <LockKeyhole className="mt-0.5 size-4 shrink-0 text-[var(--success)]" />
            <p>The agent endpoint is protected by a separate bearer token and uses a server-side GitHub App installation token. Browser credentials never enter the agent flow.</p>
          </div>
          <div className="rounded-md border border-border bg-background/40 p-3 font-mono text-[11px] text-foreground">
            POST /api/agent<br />
            Authorization: Bearer &lt;GITY_AGENT_TOKEN&gt;<br />
            Content-Type: application/json
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card accent={19}>
          <CardHeader><CardTitle className="flex items-center gap-2 text-sm"><Wrench className="size-4" /> Available tools</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {tools.map(([name, description]) => <div key={name} className="flex items-start gap-2 text-xs"><CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-[var(--success)]" /><span><code className="font-mono text-foreground">{name}</code><span className="text-muted-foreground"> — {description}</span></span></div>)}
          </CardContent>
        </Card>
        <Card accent={20}>
          <CardHeader><CardTitle className="flex items-center gap-2 text-sm"><KeyRound className="size-4" /> Cloudflare setup</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-xs text-muted-foreground">
            <p>Add these as Pages production variables/secrets:</p>
            <ul className="space-y-1 font-mono text-[11px] text-foreground">
              <li>GITY_AGENT_TOKEN</li>
              <li>GITHUB_APP_ID</li>
              <li>GITHUB_APP_PRIVATE_KEY</li>
              <li>GITHUB_INSTALLATION_ID</li>
            </ul>
            <p className="pt-1">The endpoint intentionally stays unavailable until all required credentials are present.</p>
          </CardContent>
        </Card>
      </div>

      <Card accent={1}>
        <CardHeader><CardTitle className="text-sm">Example agent request</CardTitle><CardDescription>Read-only tool calls use JSON-RPC and return bounded JSON data.</CardDescription></CardHeader>
        <CardContent><pre className="overflow-auto rounded-md border border-border bg-background/50 p-3 font-mono text-[11px] leading-relaxed text-foreground">{`{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"list_repositories","arguments":{"per_page":30}}}`}</pre></CardContent>
      </Card>
    </div>
  );
}
