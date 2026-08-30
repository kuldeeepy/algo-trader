interface IconProps {
  name: string;
  size?: number;
  color?: string;
}

export function Icon({ name, size = 14, color = "currentColor" }: IconProps) {
  const s: React.CSSProperties = {
    width: size, height: size,
    fill: "none", stroke: color,
    strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const,
    flexShrink: 0, display: "inline-block", verticalAlign: "middle",
  };
  switch (name) {
    case "play":      return <svg viewBox="0 0 24 24" style={s}><path d="M6 4l14 8-14 8z" fill={color} stroke="none"/></svg>;
    case "search":    return <svg viewBox="0 0 24 24" style={s}><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>;
    case "chevron":   return <svg viewBox="0 0 24 24" style={s}><path d="M6 9l6 6 6-6"/></svg>;
    case "chevron-r": return <svg viewBox="0 0 24 24" style={s}><path d="M9 6l6 6-6 6"/></svg>;
    case "plus":      return <svg viewBox="0 0 24 24" style={s}><path d="M12 5v14M5 12h14"/></svg>;
    case "x":         return <svg viewBox="0 0 24 24" style={s}><path d="M18 6L6 18M6 6l12 12"/></svg>;
    case "info":      return <svg viewBox="0 0 24 24" style={s}><circle cx="12" cy="12" r="9"/><path d="M12 8v.01M12 12v4"/></svg>;
    case "sliders":   return <svg viewBox="0 0 24 24" style={s}><path d="M4 7h12M18 7h2M4 12h2M8 12h12M4 17h12M18 17h2"/><circle cx="17" cy="7" r="2" fill={color}/><circle cx="7" cy="12" r="2" fill={color}/><circle cx="17" cy="17" r="2" fill={color}/></svg>;
    case "brain":     return <svg viewBox="0 0 24 24" style={s}><path d="M9 4a3 3 0 0 0-3 3v1a3 3 0 0 0-2 5 3 3 0 0 0 2 4 3 3 0 0 0 3 3v-16zM15 4a3 3 0 0 1 3 3v1a3 3 0 0 1 2 5 3 3 0 0 1-2 4 3 3 0 0 1-3 3v-16z"/></svg>;
    case "clock":     return <svg viewBox="0 0 24 24" style={s}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>;
    case "spark":     return <svg viewBox="0 0 24 24" style={s}><path d="M12 3l1.8 4.6L18 9l-4.2 1.6L12 15l-1.8-4.4L6 9l4.2-1.4z"/></svg>;
    case "expand":    return <svg viewBox="0 0 24 24" style={s}><path d="M4 9V4h5M20 15v5h-5M4 15v5h5M20 9V4h-5"/></svg>;
    case "refresh":   return <svg viewBox="0 0 24 24" style={s}><path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5"/></svg>;
    case "download":  return <svg viewBox="0 0 24 24" style={s}><path d="M12 4v12m-5-5l5 5 5-5M4 20h16"/></svg>;
    case "sun":       return <svg viewBox="0 0 24 24" style={s}><circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4"/></svg>;
    case "moon":      return <svg viewBox="0 0 24 24" style={s}><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>;
    case "live":      return <svg viewBox="0 0 24 24" style={s}><circle cx="12" cy="12" r="3" fill={color}/><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="10" opacity="0.4"/></svg>;
    case "check":     return <svg viewBox="0 0 24 24" style={s}><path d="M4 12l5 5L20 6"/></svg>;
    case "alert":     return <svg viewBox="0 0 24 24" style={s}><path d="M12 3l10 18H2z"/><path d="M12 10v4M12 18v.01"/></svg>;
    case "target":    return <svg viewBox="0 0 24 24" style={s}><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5" fill={color}/></svg>;
    case "trend":     return <svg viewBox="0 0 24 24" style={s}><path d="M3 17l6-6 4 4 8-8M14 7h7v7"/></svg>;
    case "wave":      return <svg viewBox="0 0 24 24" style={s}><path d="M3 12c2-4 4-4 6 0s4 4 6 0 4-4 6 0"/></svg>;
    case "bolt":      return <svg viewBox="0 0 24 24" style={s}><path d="M13 3L4 14h7l-1 7 9-11h-7z"/></svg>;
    case "reasoning": return <svg viewBox="0 0 24 24" style={s}><circle cx="9" cy="9" r="5"/><circle cx="17" cy="17" r="3"/><path d="M12 12l3 3"/></svg>;
    case "filter":    return <svg viewBox="0 0 24 24" style={s}><path d="M3 5h18l-7 9v6l-4-2v-4z"/></svg>;
    case "calendar":  return <svg viewBox="0 0 24 24" style={s}><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>;
    default: return null;
  }
}
