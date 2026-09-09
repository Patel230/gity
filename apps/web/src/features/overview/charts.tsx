"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const tooltipStyle = {
  backgroundColor: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 12,
} as const;

export function PrActivityChart({ data }: { data: { date: string; count: number }[] }) {
  return (
    <div className="h-44">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} interval={2} />
          <YAxis tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "var(--foreground)" }} />
          <Area type="monotone" dataKey="count" name="PRs opened" stroke="var(--primary)" fill="var(--primary)" fillOpacity={0.25} strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function IssueActivityChart({
  opened,
  closed,
}: {
  opened: { date: string; count: number }[];
  closed: { date: string; count: number }[];
}) {
  const data = opened.map((o, i) => ({
    date: o.date,
    opened: o.count,
    closed: closed[i]?.count ?? 0,
  }));
  return (
    <div className="h-44">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -18 }} barGap={1}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} interval={2} />
          <YAxis tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "var(--foreground)" }} />
          <Bar dataKey="opened" name="Opened" fill="var(--success)" radius={[2, 2, 0, 0]} />
          <Bar dataKey="closed" name="Closed" fill="var(--primary)" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
