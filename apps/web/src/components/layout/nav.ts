import {
  Activity,
  Building2,
  CircleDot,
  Flame,
  GitPullRequest,
  LayoutDashboard,
  Play,
  Database,
  Settings,
  Bot,
  Network,
  Layers3,
} from "lucide-react";

export const NAV = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/organizations", label: "Orgs", icon: Building2 },
  { href: "/graph", label: "Graph", icon: Network },
  { href: "/repositories", label: "Repos", icon: Database },
  { href: "/pull-requests", label: "PRs", icon: GitPullRequest },
  { href: "/issues", label: "Issues", icon: CircleDot },
  { href: "/actions", label: "Actions", icon: Play },
  { href: "/activity", label: "Activity", icon: Activity },
  { href: "/streak", label: "Streak", icon: Flame },
  { href: "/agents", label: "Agents", icon: Bot },
  { href: "/linear", label: "Linear", icon: Layers3 },
] as const;

export const SETTINGS_NAV = { href: "/settings", label: "Settings", icon: Settings };
