export function SeverityBadge({ s }: { s: string }) {
  const cls =
    {
      critical: "badge-critical",
      high: "badge-high",
      medium: "badge-medium",
      low: "badge-low",
      informative: "badge-informative",
      info: "badge-informative",
    }[s.toLowerCase()] ?? "badge-informative";
  const display = s.toUpperCase() === "INFO" ? "INFO" : s;
  return <span className={`badge ${cls}`}>{display}</span>;
}
