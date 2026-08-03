export function SeverityBadge({ s }: { s: string }) {
  const cls =
    {
      critical: "badge-critical",
      high: "badge-high",
      medium: "badge-medium",
      low: "badge-low",
    }[s] ?? "badge-low";
  return <span className={`badge ${cls}`}>{s}</span>;
}
