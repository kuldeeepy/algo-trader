import { SectionLabel } from "./SectionLabel";

function fmt(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function getPresets(): { label: string; from: string; to: string }[] {
  const now   = new Date();
  const today = fmt(now);

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd   = new Date(now.getFullYear(), now.getMonth(), 0);

  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1));

  const last30 = new Date(now);
  last30.setDate(now.getDate() - 30);

  const last90 = new Date(now);
  last90.setDate(now.getDate() - 90);

  return [
    { label: "Today",      from: today,                   to: today },
    { label: "Yesterday",  from: fmt(yesterday),           to: fmt(yesterday) },
    { label: "This week",  from: fmt(weekStart),           to: today },
    { label: "This month", from: fmt(thisMonthStart),      to: today },
    { label: "Last month", from: fmt(lastMonthStart),      to: fmt(lastMonthEnd) },
    { label: "Last 30d",   from: fmt(last30),              to: today },
    { label: "Last 90d",   from: fmt(last90),              to: today },
  ];
}

interface Props {
  from: string;
  to:   string;
  onChange: (from: string, to: string) => void;
}

export function DateRangePicker({ from, to, onChange }: Props) {
  const presets = getPresets();
  const active  = presets.find(p => p.from === from && p.to === to)?.label;

  return (
    <div>
      <SectionLabel>Date Range</SectionLabel>
      <div className="flex flex-wrap gap-1 mb-2">
        {presets.map(p => (
          <button
            key={p.label}
            onClick={() => onChange(p.from, p.to)}
            className={`btn text-[10px] px-2 py-1 ${
              active === p.label ? "btn-primary" : "btn-ghost"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-1">
        <div>
          <div className="field-label">From</div>
          <input type="date" className="input" value={from}
            onChange={e => onChange(e.target.value, to)} />
        </div>
        <div>
          <div className="field-label">To</div>
          <input type="date" className="input" value={to}
            onChange={e => onChange(from, e.target.value)} />
        </div>
      </div>
    </div>
  );
}
