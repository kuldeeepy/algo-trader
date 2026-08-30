import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAdvancedStore } from "../../store/advancedStore";
import { api } from "../../lib/api";

import { Icon } from "../Icon";

// ── Date helpers ─────────────────────────────────────────────────────────────

function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function parseDate(s: string): Date { return new Date(s + "T00:00:00"); }
function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function calDays(month: Date): (Date | null)[] {
  const y = month.getFullYear(), m = month.getMonth();
  const pad = (new Date(y, m, 1).getDay() + 6) % 7; // Mon=0
  const days: (Date | null)[] = Array(pad).fill(null);
  for (let d = 1; d <= new Date(y, m + 1, 0).getDate(); d++) days.push(new Date(y, m, d));
  return days;
}

function getDatePresets() {
  const n  = new Date();
  const t  = fmtDate(n);
  const monStart = new Date(n); monStart.setDate(n.getDate() - ((n.getDay() + 6) % 7));
  return [
    { label: "Today",       from: t,                                          to: t },
    { label: "Yesterday",   from: fmtDate(new Date(n.getFullYear(), n.getMonth(), n.getDate()-1)),
                            to:   fmtDate(new Date(n.getFullYear(), n.getMonth(), n.getDate()-1)) },
    { label: "This Week",   from: fmtDate(monStart),                          to: t },
    { label: "This Month",  from: fmtDate(new Date(n.getFullYear(), n.getMonth(), 1)),         to: t },
    { label: "Last Month",  from: fmtDate(new Date(n.getFullYear(), n.getMonth()-1, 1)),
                            to:   fmtDate(new Date(n.getFullYear(), n.getMonth(), 0)) },
    { label: "Last 30 D",   from: fmtDate(new Date(n.getFullYear(), n.getMonth(), n.getDate()-30)), to: t },
    { label: "Last 60 D",   from: fmtDate(new Date(n.getFullYear(), n.getMonth(), n.getDate()-60)), to: t },
  ];
}

const MO = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const WD = ["M","T","W","T","F","S","S"];
const INTERVALS = [
  { id: "auto", good:    "System picks best interval"            },
  { id: "1m",   warn:    "Noisy — micro-structure dominates"     },
  { id: "5m",   good:    "Optimal for regime detection"          },
  { id: "15m",  neutral: "Slower signals, longer ranges"         },
] as const;

function Divider() { return <div className="divider" />; }
function SectionLabel({ children, accessory }: { children: React.ReactNode; accessory?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6, gap: 8 }}>
      <span className="caps">{children}</span>
      {accessory}
    </div>
  );
}

// ── Stock section (multi stock picker) ───────────────────────────────────────

function StockSection() {
  const { symbol, symbols, addSymbol, removeSymbol, clearSymbols, setSymbol } = useAdvancedStore();
  const [query, setQuery]     = useState("");
  const [open, setOpen]       = useState(false);
  const [results, setResults] = useState<{ symbol: string; name: string }[]>([]);
  const timer  = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function handleInput(q: string) {
    setQuery(q);
    setOpen(true);
    clearTimeout(timer.current);
    if (!q.trim()) { setResults([]); return; }
    timer.current = setTimeout(() => {
      api.search(q).then(res => setResults(res.slice(0, 8))).catch(() => {});
    }, 280);
  }

  function select(sym: string) {
    addSymbol(sym);
    setQuery(""); setOpen(false); setResults([]);
  }

  return (
    <section>
      <SectionLabel accessory={
        symbols.length > 0 ? (
          <button
            className="why-chip"
            onClick={clearSymbols}
            style={{ height: 18, padding: "0 6px", fontSize: 8.5 }}
          >
            CLEAR
          </button>
        ) : null
      }>Stocks</SectionLabel>

      {symbols.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 8 }}>
          {symbols.map(sym => {
            const active = sym === symbol;
            return (
              <div
                key={sym}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "7px 9px",
                  background: active ? "var(--accent-bg)" : "var(--surface-2)",
                  border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
                  borderRadius: 4,
                  gap: 8,
                }}
              >
                <button
                  onClick={() => setSymbol(sym)}
                  style={{
                    minWidth: 0, flex: 1, background: "transparent", border: "none",
                    padding: 0, cursor: "pointer", textAlign: "left", fontFamily: "inherit",
                  }}
                >
                  <span className="num" style={{ fontSize: 12, fontWeight: 700, color: active ? "var(--accent-hi)" : "var(--text)" }}>
                    {sym.replace(".NS", "")}
                  </span>
                  <span style={{ display: "block", fontSize: 9, color: "var(--text-dim)", marginTop: 1 }}>
                    {active ? "selected for chart" : "included in backtest"}
                  </span>
                </button>
                <button
                  onClick={() => removeSymbol(sym)}
                  style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-dim)", padding: 2, display: "flex", alignItems: "center" }}
                  onMouseEnter={e => (e.currentTarget.style.color = "var(--text)")}
                  onMouseLeave={e => (e.currentTarget.style.color = "var(--text-dim)")}
                >
                  <Icon name="x" size={12} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div ref={wrapRef} style={{ position: "relative" }}>
          <span style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "var(--text-dim)", pointerEvents: "none" }}>
            <Icon name="search" size={12} />
          </span>
          <input
            className="field"
            placeholder="Search NSE symbol…"
            value={query}
            onChange={e => handleInput(e.target.value)}
            onFocus={() => { if (query) setOpen(true); }}
            style={{ paddingLeft: 28, fontSize: 11.5 }}
            autoComplete="off"
          />
          {open && results.length > 0 && (
            <div style={{
              position: "absolute", top: "calc(100% + 3px)", left: 0, right: 0,
              background: "var(--surface-2)", border: "1px solid var(--border-strong)",
              borderRadius: 4, boxShadow: "var(--shadow-pop)", zIndex: 30,
              maxHeight: 200, overflowY: "auto",
            }}>
              {results.map(r => (
                <button
                  key={r.symbol}
                  onMouseDown={e => { e.preventDefault(); select(r.symbol); }}
                  style={{
                    display: "flex", width: "100%", alignItems: "center", justifyContent: "space-between",
                    padding: "7px 10px", background: "transparent", border: "none",
                    borderBottom: "1px solid var(--border-soft)", color: "var(--text)",
                    cursor: "pointer", textAlign: "left", fontFamily: "inherit",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = "var(--surface-3)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                >
                  <span className="num" style={{ fontSize: 11, fontWeight: 600 }}>{r.symbol.replace(".NS", "")}</span>
                  <span style={{ fontSize: 10, color: "var(--text-dim)", marginLeft: 8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
    </section>
  );
}

// ── Universe scan section ─────────────────────────────────────────────────────

function ScanSection() {
  const { scanUniverse, maxPositions, setScanUniverse, setMaxPositions } = useAdvancedStore();
  return (
    <section>
      <SectionLabel accessory={
        <button
          onClick={() => setScanUniverse(!scanUniverse)}
          style={{
            width: 36, height: 20, borderRadius: 10, border: "none",
            background: scanUniverse ? "var(--accent)" : "var(--surface-4)",
            cursor: "pointer", position: "relative", transition: "background 0.2s", flexShrink: 0,
          }}
        >
          <span style={{
            position: "absolute", top: 2, left: scanUniverse ? 18 : 2,
            width: 16, height: 16, borderRadius: 8,
            background: scanUniverse ? "#1A1308" : "var(--text-dim)",
            transition: "left 0.15s",
          }} />
        </button>
      }>Universe Scan</SectionLabel>

      <div className="inner" style={{ padding: "8px 10px", display: "flex", alignItems: "flex-start", gap: 7 }}>
        <Icon name="search" size={12} color={scanUniverse ? "var(--accent)" : "var(--text-dim)"} />
        <div style={{ fontSize: 10.5, color: "var(--text-muted)", lineHeight: 1.5 }}>
          Scans ~110 NSE F&O stocks at 9:45 and trades only the day's stocks in play (top relative volume).{" "}
          Selected stock is still scanned and shown.
        </div>
      </div>

      {scanUniverse && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
          <span className="caps">MAX POSITIONS</span>
          <div className="seg" style={{ padding: 1 }}>
            {[1, 2, 3].map(n => (
              <button
                key={n}
                className={maxPositions === n ? "active" : ""}
                onClick={() => setMaxPositions(n)}
                style={{ height: 18, padding: "0 9px", fontSize: 9.5 }}
              >{n}</button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

// ── Date section ──────────────────────────────────────────────────────────────

function CalendarGrid({
  month, tempFrom, tempTo, picking, hover,
  onClickDay, onHoverDay, onLeaveDay,
}: {
  month: Date; tempFrom: string; tempTo: string;
  picking: Date | null; hover: Date | null;
  onClickDay: (d: Date) => void;
  onHoverDay: (d: Date) => void;
  onLeaveDay: () => void;
}) {
  const todayStr   = fmtDate(new Date());
  const fromDate   = tempFrom ? parseDate(tempFrom) : null;
  const toDate     = tempTo   ? parseDate(tempTo)   : null;
  const days       = calDays(month);

  return (
    <>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", marginBottom:4 }}>
        {WD.map((d,i) => (
          <div key={i} style={{ textAlign:"center", fontSize:10, color:"var(--text-faint)", fontWeight:700, letterSpacing:"0.06em", paddingBottom:4 }}>{d}</div>
        ))}
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", rowGap:1 }}>
        {days.map((d, i) => {
          if (!d) return <div key={`e${i}`} />;
          const ds       = fmtDate(d);
          const isFrom   = fromDate && sameDay(d, fromDate);
          const isTo     = toDate   && sameDay(d, toDate);
          const endpoint = isFrom || isTo;

          let inRange = false;
          if (picking && hover) {
            const lo = picking <= hover ? picking : hover;
            const hi = picking <= hover ? hover   : picking;
            inRange  = d > lo && d < hi;
          } else if (fromDate && toDate && !picking) {
            inRange = d > fromDate && d < toDate;
          }

          return (
            <div key={ds} style={{
              display:"flex", justifyContent:"center", padding:"2px 0",
              background: inRange ? "color-mix(in oklab,var(--accent) 13%,transparent)" : "transparent",
            }}>
              <span
                onClick={() => onClickDay(d)}
                onMouseEnter={() => onHoverDay(d)}
                onMouseLeave={onLeaveDay}
                style={{
                  display:"inline-flex", alignItems:"center", justifyContent:"center",
                  width:34, height:34, borderRadius:"50%", fontSize:12.5, cursor:"pointer",
                  fontFamily:"JetBrains Mono,monospace", userSelect:"none", transition:"background 0.08s",
                  background: endpoint ? "var(--accent)" : "transparent",
                  color:      endpoint ? "#1A1308" : ds === todayStr ? "var(--accent)" : "var(--text)",
                  fontWeight: endpoint ? 700 : ds === todayStr ? 600 : 400,
                  outline:    ds === todayStr && !endpoint ? "1.5px solid var(--accent)" : "none",
                  outlineOffset: "-2px",
                }}
              >{d.getDate()}</span>
            </div>
          );
        })}
      </div>
    </>
  );
}

function DateSection() {
  const { from, to, setFrom, setTo } = useAdvancedStore();
  const [open,    setOpen]    = useState(false);
  const [tempFrom,setTempFrom]= useState(from);
  const [tempTo,  setTempTo]  = useState(to);
  const [month,   setMonth]   = useState(() => from ? parseDate(from) : new Date());
  const [picking, setPicking] = useState<Date | null>(null);
  const [hover,   setHover]   = useState<Date | null>(null);

  const presets = getDatePresets();
  const activeP = presets.find(p => p.from === from && p.to === to)?.label;

  function openModal() {
    setTempFrom(from); setTempTo(to);
    setMonth(from ? parseDate(from) : new Date());
    setPicking(null); setHover(null);
    setOpen(true);
  }

  function apply() {
    if (!picking) { setFrom(tempFrom); setTo(tempTo); setOpen(false); }
  }

  function close() { setPicking(null); setHover(null); setOpen(false); }

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  function applyPreset(p: { from: string; to: string }) {
    setTempFrom(p.from); setTempTo(p.to);
    setPicking(null); setHover(null);
    setMonth(parseDate(p.from));
  }

  function clickDay(d: Date) {
    if (!picking) {
      setPicking(d); setTempFrom(fmtDate(d)); setTempTo(fmtDate(d));
    } else {
      const [a, b] = picking <= d ? [picking, d] : [d, picking];
      setTempFrom(fmtDate(a)); setTempTo(fmtDate(b));
      setPicking(null); setHover(null);
    }
  }

  // Compact range label for the trigger button
  const fd = from ? parseDate(from) : null;
  const td = to   ? parseDate(to)   : null;
  const rangeLabel = fd && td
    ? from === to
      ? `${fd.getDate()} ${MO[fd.getMonth()]} ${fd.getFullYear()}`
      : `${fd.getDate()} ${MO[fd.getMonth()]} – ${td.getDate()} ${MO[td.getMonth()]} ${td.getFullYear()}`
    : "Select range…";

  const activePresetInModal = presets.find(p => p.from === tempFrom && p.to === tempTo)?.label;

  return (
    <section>
      <SectionLabel>Date Range</SectionLabel>

      {/* Trigger — compact pill showing current selection */}
      <button
        onClick={openModal}
        style={{
          width:"100%", display:"flex", alignItems:"center", justifyContent:"space-between",
          padding:"8px 10px", background:"var(--surface-2)",
          border:"1px solid var(--border)", borderRadius:5, cursor:"pointer",
          fontFamily:"inherit", color:"var(--text)", transition:"border-color 0.1s",
        }}
        onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--border-strong)")}
        onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border)")}
      >
        <div style={{ display:"flex", flexDirection:"column", gap:2, textAlign:"left" }}>
          {activeP && <span className="caps" style={{ fontSize:8.5, color:"var(--accent)" }}>{activeP}</span>}
          <span className="num" style={{ fontSize:11, color:"var(--text)" }}>{rangeLabel}</span>
        </div>
        <Icon name="calendar" size={13} color="var(--text-dim)" />
      </button>

      {/* Modal */}
      {open && (
        <div
          onClick={close}
          style={{
            position:"fixed", inset:0,
            background:"rgba(0,0,0,0.6)", backdropFilter:"blur(3px)",
            zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center",
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background:"var(--surface-1)", border:"1px solid var(--border-strong)",
              borderRadius:10, boxShadow:"0 32px 80px rgba(0,0,0,0.55)",
              width:460, overflow:"hidden",
            }}
          >
            {/* Header */}
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 18px 12px", borderBottom:"1px solid var(--border)" }}>
              <span style={{ fontSize:13, fontWeight:600, color:"var(--text)" }}>Select Date Range</span>
              <button onClick={close} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--text-dim)", display:"flex", padding:2 }}>
                <Icon name="x" size={14} />
              </button>
            </div>

            {/* Body */}
            <div style={{ padding:"16px 18px" }}>

              {/* Preset chips */}
              <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:18 }}>
                {presets.map(p => (
                  <button
                    key={p.label}
                    onClick={() => applyPreset(p)}
                    style={{
                      padding:"5px 12px", fontSize:11, fontFamily:"inherit", cursor:"pointer",
                      background: activePresetInModal === p.label ? "var(--accent)" : "var(--surface-2)",
                      color:      activePresetInModal === p.label ? "#1A1308"       : "var(--text-muted)",
                      border:     `1px solid ${activePresetInModal === p.label ? "var(--accent)" : "var(--border)"}`,
                      borderRadius:5, fontWeight: activePresetInModal === p.label ? 600 : 400,
                      transition:"all 0.1s",
                    }}
                  >{p.label}</button>
                ))}
              </div>

              {/* Month nav */}
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
                <button
                  onClick={() => setMonth(m => new Date(m.getFullYear(), m.getMonth()-1, 1))}
                  style={{ background:"var(--surface-2)", border:"1px solid var(--border)", borderRadius:5, color:"var(--text-dim)", cursor:"pointer", width:30, height:30, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16 }}
                >‹</button>
                <span style={{ fontSize:13, fontWeight:700, color:"var(--text)", letterSpacing:"0.04em" }}>
                  {MO[month.getMonth()]} {month.getFullYear()}
                </span>
                <button
                  onClick={() => setMonth(m => new Date(m.getFullYear(), m.getMonth()+1, 1))}
                  style={{ background:"var(--surface-2)", border:"1px solid var(--border)", borderRadius:5, color:"var(--text-dim)", cursor:"pointer", width:30, height:30, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16 }}
                >›</button>
              </div>

              <CalendarGrid
                month={month}
                tempFrom={tempFrom} tempTo={tempTo}
                picking={picking} hover={hover}
                onClickDay={clickDay}
                onHoverDay={d => picking && setHover(d)}
                onLeaveDay={() => picking && setHover(null)}
              />
            </div>

            {/* Footer */}
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 18px", borderTop:"1px solid var(--border)", background:"var(--surface-2)" }}>
              <span className="num" style={{ fontSize:11, color:"var(--text-dim)", minWidth:0 }}>
                {picking
                  ? <span style={{ color:"var(--accent)" }}>click end date…</span>
                  : tempFrom && tempTo
                    ? tempFrom === tempTo ? tempFrom : `${tempFrom}  →  ${tempTo}`
                    : null}
              </span>
              <div style={{ display:"flex", gap:8, flexShrink:0 }}>
                <button
                  onClick={close}
                  style={{ padding:"6px 16px", fontSize:11, fontFamily:"inherit", background:"var(--surface-3)", border:"1px solid var(--border)", borderRadius:5, color:"var(--text-muted)", cursor:"pointer" }}
                >Cancel</button>
                <button
                  onClick={apply}
                  disabled={!tempFrom || !tempTo || !!picking}
                  style={{ padding:"6px 16px", fontSize:11, fontFamily:"inherit", background:"var(--accent)", border:"none", borderRadius:5, color:"#1A1308", fontWeight:600, cursor: picking ? "not-allowed" : "pointer", opacity: picking ? 0.5 : 1 }}
                >Apply</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

// ── Interval section ──────────────────────────────────────────────────────────

function IntervalSection() {
  const { interval, setInterval } = useAdvancedStore();
  const cur = INTERVALS.find(i => i.id === interval);
  return (
    <section>
      <SectionLabel>Bar Interval</SectionLabel>
      <div className="seg" style={{ marginBottom: 6, width: "100%" }}>
        {INTERVALS.map(i => (
          <button key={i.id} className={i.id === interval ? "active" : ""} onClick={() => setInterval(i.id as "auto" | "1m" | "5m" | "15m")}>
            {i.id}
          </button>
        ))}
      </div>
      {"good" in (cur ?? {}) && (
        <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: "var(--profit)" }}>
          <Icon name="check" size={10} /> {(cur as { good: string }).good}
        </div>
      )}
      {"warn" in (cur ?? {}) && (
        <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: "var(--warning)" }}>
          <Icon name="alert" size={10} /> {(cur as { warn: string }).warn}
        </div>
      )}
      {"neutral" in (cur ?? {}) && (
        <div style={{ fontSize: 10, color: "var(--text-dim)", paddingLeft: 2 }}>{(cur as { neutral: string }).neutral}</div>
      )}
    </section>
  );
}

// ── Risk section ──────────────────────────────────────────────────────────────

function RiskSection() {
  const { capital, riskPct, maxLoss, setCapital, setRiskPct, setMaxLoss } = useAdvancedStore();
  const [open, setOpen] = useState(true);
  const maxRiskPerTrade = Math.round(capital * riskPct / 100);
  return (
    <section>
      <SectionLabel accessory={
        <button
          onClick={() => setOpen(!open)}
          style={{ background: "transparent", border: "none", padding: 0, color: "var(--text-dim)", cursor: "pointer", display: "flex" }}
        >
          <span style={{ transform: open ? "none" : "rotate(-90deg)", transition: "transform 0.15s", display: "inline-flex" }}>
            <Icon name="chevron" size={10} />
          </span>
        </button>
      }>Capital & Risk</SectionLabel>
      {open && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div>
            <div className="caps" style={{ marginBottom: 3 }}>CAPITAL</div>
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "var(--text-dim)", fontSize: 11, fontFamily: "JetBrains Mono" }}>₹</span>
              <input type="number" className="field" value={capital} onChange={e => setCapital(Number(e.target.value))} style={{ paddingLeft: 22 }} />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            <div>
              <div className="caps" style={{ marginBottom: 3 }}>RISK / TRADE</div>
              <div style={{ position: "relative" }}>
                <input type="number" className="field" value={riskPct} onChange={e => setRiskPct(Number(e.target.value))} step="0.1" style={{ paddingRight: 22 }} />
                <span style={{ position: "absolute", right: 9, top: "50%", transform: "translateY(-50%)", color: "var(--text-dim)", fontSize: 11, fontFamily: "JetBrains Mono" }}>%</span>
              </div>
            </div>
            <div>
              <div className="caps" style={{ marginBottom: 3 }}>MAX LOSS / DAY</div>
              <div style={{ position: "relative" }}>
                <input type="number" className="field" value={maxLoss} onChange={e => setMaxLoss(Number(e.target.value))} step="0.5" style={{ paddingRight: 22 }} />
                <span style={{ position: "absolute", right: 9, top: "50%", transform: "translateY(-50%)", color: "var(--text-dim)", fontSize: 11, fontFamily: "JetBrains Mono" }}>%</span>
              </div>
            </div>
          </div>
          <div className="inner" style={{ padding: "7px 10px", fontSize: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-dim)" }}>
              <span>Max risk / trade</span>
              <span className="num" style={{ color: "var(--loss)" }}>₹{maxRiskPerTrade.toLocaleString("en-IN")}</span>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

// ── Strategy section ──────────────────────────────────────────────────────────

const REGIME_COLOR: Record<string, string> = {
  trending: "var(--regime-trend)",
  sideways: "var(--regime-side)",
  high_vol: "var(--regime-vol)",
};

function isEnabled(id: string): boolean {
  const v = localStorage.getItem(`strategy_enabled_${id}`);
  return v === null ? true : v === "true";
}

function StrategySection() {
  const { autoStrategy, manualStrategy, setAutoStrategy, setManualStrategy } = useAdvancedStore();
  const { data: allStrategies = [] } = useQuery({
    queryKey:  ["strategies"],
    queryFn:   api.strategies,
    staleTime: Infinity,
  });

  // Only show strategies that are enabled in settings
  const strategies = allStrategies.filter(s => isEnabled(s.id));

  // If currently selected manual strategy got disabled, clear it
  useEffect(() => {
    if (!autoStrategy && manualStrategy && !strategies.find(s => s.id === manualStrategy)) {
      setManualStrategy(null);
    }
  }, [strategies, autoStrategy, manualStrategy, setManualStrategy]);

  return (
    <section>
      <SectionLabel accessory={
        <div className="seg" style={{ padding: 1 }}>
          <button className={autoStrategy ? "active" : ""} onClick={() => setAutoStrategy(true)} style={{ height: 18, padding: "0 7px", fontSize: 9.5 }}>AUTO</button>
          <button className={!autoStrategy ? "active" : ""} onClick={() => setAutoStrategy(false)} style={{ height: 18, padding: "0 7px", fontSize: 9.5 }}>MANUAL</button>
        </div>
      }>Strategy</SectionLabel>

      {autoStrategy ? (
        <div className="inner" style={{ padding: "8px 10px", marginBottom: 8, display: "flex", alignItems: "flex-start", gap: 7 }}>
          <Icon name="brain" size={12} color="var(--accent)" />
          <div style={{ fontSize: 10.5, color: "var(--text-muted)", lineHeight: 1.5 }}>
            Engine classifies each day's regime then auto-assigns the best-fit strategy.{" "}
            <span className="caps" style={{ color: "var(--accent-hi)" }}>Recommended</span>
          </div>
        </div>
      ) : (
        <div className="inner" style={{ padding: "8px 10px", marginBottom: 8 }}>
          <div style={{ fontSize: 10.5, color: "var(--text-muted)", lineHeight: 1.5 }}>
            Force one strategy for all days.{" "}
            <span style={{ color: "var(--warning)" }}>Bypasses regime fit.</span>
          </div>
        </div>
      )}

      {strategies.length === 0 ? (
        <div style={{ fontSize: 11, color: "var(--text-dim)", textAlign: "center", padding: "12px 0" }}>
          No strategies enabled — go to Settings to enable some.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {strategies.map(s => {
            const selected = autoStrategy || manualStrategy === s.id;
            const c = REGIME_COLOR[s.regime] ?? "var(--text-muted)";
            return (
              <button
                key={s.id}
                onClick={() => !autoStrategy && setManualStrategy(manualStrategy === s.id ? null : s.id)}
                style={{
                  textAlign: "left", padding: "9px 11px",
                  background: selected ? "var(--surface-2)" : "var(--surface-1)",
                  border: `1px solid ${selected ? c : "var(--border)"}`,
                  borderRadius: 5,
                  cursor: autoStrategy ? "default" : "pointer",
                  fontFamily: "inherit", color: "var(--text)",
                  display: "flex", flexDirection: "column", gap: 3,
                  boxShadow: selected ? `0 0 0 2px color-mix(in oklab, ${c} 15%, transparent)` : "none",
                  transition: "all 0.12s",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 6, height: 6, borderRadius: 3, background: c, flexShrink: 0 }} />
                    <span style={{ fontSize: 11.5, fontWeight: 600 }}>{s.name}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    {selected && !autoStrategy && (
                      <span className="caps" style={{ color: c, fontSize: 8.5 }}>ACTIVE</span>
                    )}
                    {autoStrategy && (
                      <span className="caps" style={{ color: "var(--text-faint)", fontSize: 8.5 }}>AUTO</span>
                    )}
                  </div>
                </div>
                <div style={{ fontSize: 10, color: "var(--text-dim)", lineHeight: 1.4, paddingLeft: 12 }}>
                  {s.description.split('.')[0]}.
                </div>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}


// ── LeftRail (main export) ────────────────────────────────────────────────────

export function LeftRail({ onRun, running }: { onRun: () => void; running: boolean }) {
  const { symbols, interval, reset } = useAdvancedStore();
  return (
    <aside style={{
      width: 296, flexShrink: 0,
      borderRight: "1px solid var(--border)",
      background: "var(--surface-1)",
      display: "flex", flexDirection: "column", overflow: "hidden",
    }}>
      <div style={{ flex: 1, overflowY: "auto", padding: "var(--rail-pad)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <Icon name="sliders" size={13} color="var(--accent)" />
            <span style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: "0.02em" }}>Configuration</span>
          </div>
          <button className="why-chip" onClick={reset}>
            <Icon name="refresh" size={9} /> RESET
          </button>
        </div>

        <StockSection />
        <Divider />
        <ScanSection />
        <Divider />
        <DateSection />
        <Divider />
        <IntervalSection />
        <Divider />
        <RiskSection />
        <Divider />
        <StrategySection />
      </div>

      <div style={{ borderTop: "1px solid var(--border)", background: "var(--surface-1)", padding: "12px 14px" }}>
        <button
          className="btn btn-primary btn-lg"
          style={{ width: "100%", letterSpacing: "0.02em", fontSize: 12.5 }}
          onClick={onRun}
          disabled={running || symbols.length === 0}
        >
          {running ? (
            <>
              <span style={{ width: 8, height: 8, borderRadius: 4, background: "#1A1308", animation: "pulse-dot 0.8s ease-in-out infinite", display: "inline-block" }} />
              Evaluating…
            </>
          ) : (
            <>
              <Icon name="play" size={11} color="#1A1308" />
              Run Backtest
            </>
          )}
        </button>
        <div className="num" style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 10, color: "var(--text-dim)" }}>
          <span>{symbols.length ? `${symbols.length} stock${symbols.length === 1 ? "" : "s"}` : "no stocks selected"}</span>
          <span>{interval}</span>
        </div>
      </div>
    </aside>
  );
}
