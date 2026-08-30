import { useState, useEffect, useRef } from "react";
import { api } from "../lib/api";
import type { StockSuggestion } from "../lib/api";

interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}

export function StockSearch({ value, onChange, placeholder = "Search ticker or company…" }: Props) {
  const [query,   setQuery]   = useState(value || "");
  const [results, setResults] = useState<StockSuggestion[]>([]);
  const [open,    setOpen]    = useState(false);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const wrapRef  = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function handleInput(q: string) {
    setQuery(q);
    clearTimeout(timerRef.current);
    if (q.length < 2) { setResults([]); setOpen(false); return; }
    setLoading(true);
    timerRef.current = setTimeout(async () => {
      try {
        const res = await api.search(q);
        setResults(res);
        setOpen(res.length > 0);
      } catch { /* ignore */ }
      finally { setLoading(false); }
    }, 300);
  }

  function select(s: StockSuggestion) {
    setQuery(s.symbol);
    onChange(s.symbol);
    setOpen(false);
  }

  return (
    <div className="relative" ref={wrapRef}>
      <div className="relative">
        <input
          className="field"
          value={query}
          onChange={e => handleInput(e.target.value)}
          placeholder={placeholder}
          onFocus={() => results.length > 0 && setOpen(true)}
          style={{ paddingRight: 28 }}
        />
        <span
          className="absolute right-2.5 top-1/2 -translate-y-1/2 dim"
          style={{ fontSize: 11, transition: "opacity 0.15s", opacity: loading ? 1 : 0.4 }}
        >
          {loading ? "…" : "⌕"}
        </span>
      </div>

      {open && (
        <div
          className="absolute z-50 w-full mt-1 panel overflow-hidden"
          style={{
            boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
            maxHeight: 220,
            overflowY: "auto",
          }}
        >
          {results.map(r => (
            <button
              key={r.symbol}
              className="w-full text-left row-hover"
              style={{
                padding: "8px 12px",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                gap: 8, cursor: "pointer", border: "none", background: "transparent",
                borderBottom: "1px solid var(--color-border)",
              }}
              onClick={() => select(r)}
            >
              <span className="num-sm" style={{ color: "var(--color-text)", flexShrink: 0 }}>{r.symbol}</span>
              <span className="dim" style={{ fontSize: 11, textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
