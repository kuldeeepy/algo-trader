/** Format Indian Rupee amounts with lakh/crore shorthand. */
export function inr(value: number, sign = false): string {
  const prefix = sign && value > 0 ? "+" : value < 0 ? "−" : "";
  const v = Math.abs(value);
  let s: string;
  if (v >= 1_00_00_000) s = `₹${(v / 1_00_00_000).toFixed(2)}Cr`;
  else if (v >= 1_00_000) s = `₹${(v / 1_00_000).toFixed(2)}L`;
  else if (v >= 1_000)    s = `₹${v.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
  else                    s = `₹${v.toFixed(2)}`;
  return prefix + s;
}

export function pct(value: number, sign = false): string {
  const prefix = sign && value > 0 ? "+" : value < 0 ? "−" : "";
  return `${prefix}${Math.abs(value).toFixed(2)}%`;
}

export function clr(value: number) {
  if (value > 0) return "profit";
  if (value < 0) return "loss";
  return "muted";
}
