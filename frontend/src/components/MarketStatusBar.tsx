import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";

export function MarketStatusBar() {
  const { data } = useQuery({
    queryKey: ["market-status"],
    queryFn:  api.marketStatus,
    refetchInterval: 30_000,
  });

  if (!data) return <div style={{ width: 120 }} />;

  const isOpen = data.label === "OPEN";

  return (
    <div className="flex items-center gap-2">
      <span
        style={{
          width: 6, height: 6, borderRadius: "50%",
          background: isOpen ? "var(--color-profit)" : "var(--color-dim)",
          boxShadow: isOpen ? "0 0 6px var(--color-profit)" : "none",
          flexShrink: 0,
        }}
      />
      <span className="num-sm" style={{ color: isOpen ? "var(--color-profit)" : "var(--color-muted)" }}>
        {data.label}
      </span>
      <span className="num-sm dim">{data.time}</span>
      <span className="dim" style={{ fontSize: 10 }}>{data.detail}</span>
    </div>
  );
}
