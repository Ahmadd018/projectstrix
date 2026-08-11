export function SeverityBadge({ s }: { s: string }) {
  const cls =
    {
      critical: "badge-critical",
      high: "badge-high",
      medium: "badge-medium",
      low: "badge-low",
      informative: "badge-informative",
    }[s] ?? "badge-informative";
  return <span className={`badge ${cls}`}>{s}</span>;
}
