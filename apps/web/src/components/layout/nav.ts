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
  UserRound,
} from "lucide-react";

export const NAV = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/profile", label: "Profile", icon: UserRound },
  { href: "/organizations", label: "Orgs", icon: Building2 },
  { href: "/repositories", label: "Repos", icon: Database },
  { href: "/pull-requests", label: "PRs", icon: GitPullRequest },
  { href: "/issues", label: "Issues", icon: CircleDot },
  { href: "/actions", label: "Actions", icon: Play },
  { href: "/activity", label: "Activity", icon: Activity },
  { href: "/streak", label: "Streak", icon: Flame },
] as const;

export const SETTINGS_NAV = { href: "/settings", label: "Settings", icon: Settings };
