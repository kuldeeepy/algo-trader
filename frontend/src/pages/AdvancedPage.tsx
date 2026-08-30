import { useState, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { AdvancedResult } from "../lib/api";
import { useAdvancedStore } from "../store/advancedStore";
import { LeftRail } from "../components/advanced/LeftRail";
import { Workspace, EmptyWorkspace } from "../components/advanced/Workspace";
import { RightRail } from "../components/advanced/RightRail";
import { LoadingOverlay } from "../components/advanced/LoadingOverlay";

type Phase = "idle" | "animating" | "waiting" | "done";

export function AdvancedPage() {
  const { symbols, from, to, interval, capital, riskPct, maxLoss, hoveredTrade, autoStrategy, manualStrategy, scanUniverse, maxPositions } = useAdvancedStore();
  const [phase, setPhase]   = useState<Phase>("idle");
  const [result, setResult] = useState<AdvancedResult | null>(null);
  const pendingData = useRef<AdvancedResult | null>(null);

  const mut = useMutation({
    mutationFn: api.advancedBacktest,
    onSuccess: (data) => {
      pendingData.current = data;
      setPhase(prev => (prev === "waiting" || prev === "animating") ? "done" : prev);
    },
    onError: () => setPhase("idle"),
  });

  function handleRun() {
    if (symbols.length === 0) return;
    pendingData.current = null;
    setResult(null);
    setPhase("animating");
    const strategy = autoStrategy ? null : (manualStrategy ?? null);
    // Read enabled strategy ids from localStorage (set by SettingsPage)
    const enabledStrategies = ["ORB", "VWAP_FADE", "GAP_FADE", "MOMO"]
      .filter(id => {
        const v = localStorage.getItem(`strategy_enabled_${id}`);
        return v === null ? true : v === "true";
      });
    mut.mutate({ symbols, start: from, end: to, capital, interval, risk_pct: riskPct, max_loss_pct: maxLoss, strategy, enabled_strategies: enabledStrategies, scan_universe: scanUniverse, max_positions: maxPositions });
  }

  function handleOverlayDone() {
    if (pendingData.current) setPhase("done");
    else setPhase("waiting");
  }

  if (phase === "done" && pendingData.current && !result) {
    setResult(pendingData.current);
    pendingData.current = null;
  }

  const showOverlay = phase === "animating" || phase === "waiting";

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>
      <LeftRail onRun={handleRun} running={showOverlay} />

      <div style={{ flex: 1, display: "flex", overflow: "hidden", minWidth: 0, position: "relative" }}>
        {showOverlay ? (
          <LoadingOverlay onDone={handleOverlayDone} waiting={phase === "waiting"} />
        ) : result ? (
          <Workspace result={result} />
        ) : (
          <EmptyWorkspace />
        )}

        {mut.isError && phase === "idle" && (
          <div style={{
            position: "absolute", bottom: 20, left: "50%", transform: "translateX(-50%)",
            background: "var(--loss-bg)", border: "1px solid var(--loss)", borderRadius: 6,
            padding: "10px 18px", color: "var(--loss)", fontSize: 12,
            boxShadow: "var(--shadow-pop)", zIndex: 50,
          }}>
            {(mut.error as Error).message}
          </div>
        )}
      </div>

      <RightRail hoveredTrade={hoveredTrade} result={result} />
    </div>
  );
}
