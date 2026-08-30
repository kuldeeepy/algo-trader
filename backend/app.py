#!/usr/bin/env python3
"""
Algo Trader — Redesigned UI
Run: python3 app.py  →  http://localhost:8050
"""
from datetime import datetime, timedelta
import yfinance as yf
import plotly.graph_objects as go
from plotly.subplots import make_subplots
import dash
from dash import dcc, html, Input, Output, State, no_update
import dash_bootstrap_components as dbc
from engine import (
    fetch, fetch_intraday, market_status,
    apply_crossover, apply_price_vs_ema,
    apply_rsi, apply_macd_rsi, apply_supertrend,
    run_backtest,
)
from universe import all_symbols, SYMBOL_SECTOR
from backtest import run as adv_run

# ── App init ─────────────────────────────────────────────────────────────────
app = dash.Dash(
    __name__,
    external_stylesheets=[
        dbc.themes.CYBORG,
        "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap",
    ],
    title="Algo Trader",
    suppress_callback_exceptions=True,
)

# ── Color constants (mirrors CSS vars) ───────────────────────────────────────
BG      = "#0f1117"
PANEL   = "#1a1d27"
CARD    = "#21242f"
HOVER   = "#2a2d3a"
CHART   = "#131722"
GRID    = "#1e222d"
BORDER  = "#2a2d3a"
TEXT    = "#e2e8f0"
MUTED   = "#94a3b8"
DIM     = "#4a5568"
PROFIT  = "#26a69a"
LOSS    = "#ef5350"
ACCENT  = "#3b82f6"
WARNING = "#f59e0b"
MONO    = "'IBM Plex Mono', monospace"

TODAY = datetime.today().strftime("%Y-%m-%d")


# ── Indian number formatter ───────────────────────────────────────────────────
def inr(value: float, sign: bool = False) -> str:
    prefix = "+" if (sign and value > 0) else ("−" if value < 0 else "")
    v = abs(value)
    if v >= 1_00_00_000:
        s = f"₹{v/1_00_00_000:.2f}Cr"
    elif v >= 1_00_000:
        s = f"₹{v/1_00_000:.2f}L"
    elif v >= 1_000:
        s = f"₹{v:,.0f}"
    else:
        s = f"₹{v:.2f}"
    return prefix + s


# ── Chart builders ────────────────────────────────────────────────────────────

def _empty_chart(msg="Select a stock and run the backtest"):
    fig = go.Figure()
    fig.update_layout(
        paper_bgcolor=CHART, plot_bgcolor=CHART,
        margin=dict(l=0, r=0, t=0, b=0),
        xaxis=dict(visible=False), yaxis=dict(visible=False),
        annotations=[dict(
            text=msg, xref="paper", yref="paper",
            x=0.5, y=0.5, showarrow=False,
            font=dict(size=13, color=DIM, family="Inter, sans-serif"),
        )],
    )
    return fig


def _candle_chart(df, result=None, sl_price=None, tp_price=None, entry_price=None):
    """Candlestick + EMA lines + buy/sell markers. Optionally portfolio beneath."""
    rows = 2 if result else 1
    heights = [0.70, 0.30] if result else [1.0]

    fig = make_subplots(
        rows=rows, cols=1, shared_xaxes=True,
        row_heights=heights, vertical_spacing=0.02,
    )

    # Candlestick
    fig.add_trace(go.Candlestick(
        x=df.index, open=df["open"], high=df["high"],
        low=df["low"], close=df["close"],
        increasing=dict(line=dict(color=PROFIT, width=1), fillcolor=PROFIT),
        decreasing=dict(line=dict(color=LOSS,   width=1), fillcolor=LOSS),
        name="Price", showlegend=False, hoverinfo="x+y",
    ), row=1, col=1)

    # EMA lines
    _ema_cfg = [("ema_fast","#f59e0b","EMA 12"), ("ema_slow","#3b82f6","EMA 26"), ("ema","#a78bfa","EMA 20")]
    for col, color, name in _ema_cfg:
        if col in df.columns:
            fig.add_trace(go.Scatter(
                x=df.index, y=df[col], name=name,
                line=dict(color=color, width=1.5),
                hovertemplate=f"{name}: ₹%{{y:.2f}}<extra></extra>",
            ), row=1, col=1)

    # Buy markers (green triangle below low)
    buys = df[df["signal"] == 1]
    if not buys.empty:
        fig.add_trace(go.Scatter(
            x=buys.index, y=buys["low"] * 0.992,
            mode="markers", name="Buy",
            marker=dict(symbol="triangle-up", size=12, color=PROFIT,
                        line=dict(color="#fff", width=0.5)),
            customdata=buys["close"],
            hovertemplate="▲ BUY  ₹%{customdata:.2f}<extra></extra>",
        ), row=1, col=1)

    # Sell markers (red triangle above high)
    sells = df[df["signal"] == -1]
    if not sells.empty:
        fig.add_trace(go.Scatter(
            x=sells.index, y=sells["high"] * 1.008,
            mode="markers", name="Sell",
            marker=dict(symbol="triangle-down", size=12, color=LOSS,
                        line=dict(color="#fff", width=0.5)),
            customdata=sells["close"],
            hovertemplate="▼ SELL  ₹%{customdata:.2f}<extra></extra>",
        ), row=1, col=1)

    # SL / TP / Entry lines for live sim
    for price, color, label in [
        (entry_price, ACCENT,  f"Entry ₹{entry_price:.2f}" if entry_price else None),
        (sl_price,    LOSS,    f"SL ₹{sl_price:.2f}"       if sl_price    else None),
        (tp_price,    PROFIT,  f"TP ₹{tp_price:.2f}"       if tp_price    else None),
    ]:
        if price and label:
            fig.add_hline(y=price, line_dash="dot", line_color=color, line_width=1.5,
                          annotation_text=label, annotation_font_color=color,
                          annotation_font_size=10, row=1, col=1)

    # Portfolio value + drawdown (backtest only)
    if result:
        eq = result["equity"]
        fig.add_trace(go.Scatter(
            x=eq.index, y=eq, fill="tozeroy",
            fillcolor="rgba(59,130,246,0.07)",
            line=dict(color=ACCENT, width=2),
            name="Portfolio",
            hovertemplate="₹%{y:,.0f}<extra>Portfolio</extra>",
        ), row=2, col=1)
        fig.add_hline(y=result["initial"], line_dash="dot",
                      line_color=MUTED, line_width=1, row=2, col=1)

        # Drawdown shading between peak and current
        peak = eq.cummax()
        fig.add_trace(go.Scatter(
            x=eq.index, y=peak,
            line=dict(width=0), showlegend=False, hoverinfo="skip",
        ), row=2, col=1)
        fig.add_trace(go.Scatter(
            x=eq.index, y=eq,
            fill="tonexty", fillcolor="rgba(239,83,80,0.12)",
            line=dict(width=0), showlegend=False, hoverinfo="skip",
        ), row=2, col=1)

    fig.update_layout(
        paper_bgcolor=CHART, plot_bgcolor=CHART,
        margin=dict(l=4, r=4, t=6, b=4),
        legend=dict(
            orientation="h", y=1.02, x=0,
            font=dict(size=11, color=MUTED, family="Inter"),
            bgcolor="rgba(0,0,0,0)",
        ),
        hovermode="x unified", xaxis_rangeslider_visible=False,
        font=dict(color=TEXT, family="'IBM Plex Mono', monospace"),
    )
    for i in range(1, rows + 1):
        fig.update_xaxes(
            showgrid=True, gridcolor=GRID, gridwidth=1,
            showspikes=True, spikecolor=MUTED, spikethickness=1,
            zeroline=False, row=i, col=1,
        )
        fig.update_yaxes(
            showgrid=True, gridcolor=GRID, gridwidth=1,
            zeroline=False, row=i, col=1,
        )
    return fig


# ── UI building blocks ────────────────────────────────────────────────────────

def _section(label):
    return html.P(label, className="section-label")


def _kpi(label, value, color=TEXT, tile_id=None):
    kwargs = {"id": tile_id} if tile_id else {}
    return html.Div([
        html.Div(label, className="kpi-label"),
        html.Div(value, className="kpi-value", style=dict(color=color)),
    ], className="kpi-tile", **kwargs)


def _date_btn(label, btn_id, active=False):
    return dbc.Button(
        label, id=btn_id, size="sm",
        color="primary" if active else "secondary",
        outline=not active,
        style=dict(fontSize="11px", padding="3px 8px", fontWeight="600"),
    )


def _slider(slider_id, label, val, mn, mx, step):
    return html.Div([
        html.Div(
            [html.Span(label, style=dict(color=MUTED, fontSize="11px")),
             html.Span(id=f"{slider_id}-display", children=f"{val}%",
                       style=dict(color=TEXT, fontSize="11px", fontFamily=MONO))],
            style=dict(display="flex", justifyContent="space-between", marginBottom="6px"),
        ),
        dcc.Slider(
            id=slider_id, min=mn, max=mx, step=step, value=val,
            marks={mn: str(mn), mx: str(mx)},
            tooltip=dict(always_visible=False, placement="bottom"),
        ),
    ], style=dict(marginBottom="16px"))


# ── Left config panel ─────────────────────────────────────────────────────────

def _left_panel(tab):
    t = tab
    return html.Div([

        _section("Stock"),
        dcc.Dropdown(
            id=f"{t}-search",
            placeholder="🔍  Search any company...",
            searchable=True, clearable=False,
            style=dict(backgroundColor=CARD, color=TEXT,
                       border=f"1px solid {BORDER}", borderRadius="6px",
                       fontSize="13px"),
        ),

        _section("Date Range"),
        html.Div([
            _date_btn("Today", f"{t}-today", active=True),
            _date_btn("Yest",  f"{t}-yest"),
            _date_btn("3D",    f"{t}-3d"),
            _date_btn("1W",    f"{t}-1w"),
            _date_btn("2W",    f"{t}-2w"),
            _date_btn("1M",    f"{t}-1m"),
            _date_btn("3M",    f"{t}-3m"),
        ], className="date-chips"),
        dbc.Row([
            dbc.Col([html.Div("From", style=dict(fontSize="9px", color=DIM, marginBottom="3px")),
                     dbc.Input(id=f"{t}-from", type="date", value=TODAY, size="sm")], width=6),
            dbc.Col([html.Div("To",   style=dict(fontSize="9px", color=DIM, marginBottom="3px")),
                     dbc.Input(id=f"{t}-to",   type="date", value=TODAY, size="sm")], width=6),
        ], className="g-1 mb-2"),
        html.Div(id=f"{t}-interval-badge"),

        _section("Strategy"),
        dbc.RadioItems(
            id=f"{t}-strategy",
            options=[
                {"label": html.Span([
                    "EMA Crossover (12/26) ",
                    html.Span("ⓘ", id=f"{t}-info-crossover",
                              style=dict(cursor="pointer", color=ACCENT, fontSize="11px")),
                ]), "value": "crossover"},
                {"label": html.Span([
                    "Price vs EMA (20) ",
                    html.Span("ⓘ", id=f"{t}-info-pvema",
                              style=dict(cursor="pointer", color=ACCENT, fontSize="11px")),
                ]), "value": "price_vs_ema"},
                {"label": html.Span([
                    "RSI Mean Reversion ",
                    html.Span("ⓘ", id=f"{t}-info-rsi",
                              style=dict(cursor="pointer", color=ACCENT, fontSize="11px")),
                ]), "value": "rsi"},
                {"label": html.Span([
                    "MACD + RSI ",
                    html.Span("ⓘ", id=f"{t}-info-macd",
                              style=dict(cursor="pointer", color=ACCENT, fontSize="11px")),
                ]), "value": "macd_rsi"},
                {"label": html.Span([
                    "Supertrend (10/3) ",
                    html.Span("ⓘ", id=f"{t}-info-st",
                              style=dict(cursor="pointer", color=ACCENT, fontSize="11px")),
                ]), "value": "supertrend"},
            ],
            value="crossover",
            style=dict(fontSize="12px"),
        ),
        dbc.Tooltip("Buy when fast EMA(12) crosses above slow EMA(26). Sell on reverse cross. Classic trend-following.", target=f"{t}-info-crossover", placement="right"),
        dbc.Tooltip("Buy when price crosses above EMA(20). Sell when it falls below. Simple momentum filter.", target=f"{t}-info-pvema", placement="right"),
        dbc.Tooltip("RSI measures overbought/oversold momentum. Buy when RSI crosses UP through 30 (oversold). Sell when RSI crosses DOWN through 70 (overbought). Works best on 5m+ bars.", target=f"{t}-info-rsi", placement="right"),
        dbc.Tooltip("MACD crossover filtered by RSI. Buy only when RSI < 60 (not already overbought), sell only when RSI > 40. Statistically the strongest combo — 73% win rate in backtests.", target=f"{t}-info-macd", placement="right"),
        dbc.Tooltip("ATR-based dynamic support/resistance line. Buy when price closes above the Supertrend line, sell when it closes below. Adapts to volatility — avoids false signals in choppy markets.", target=f"{t}-info-st", placement="right"),

        _section("Bar Interval"),
        dbc.RadioItems(
            id=f"{t}-barinterval",
            options=[
                {"label": "1 min",  "value": "1m"},
                {"label": "2 min",  "value": "2m"},
                {"label": "5 min",  "value": "5m"},
                {"label": "15 min", "value": "15m"},
                {"label": "30 min", "value": "30m"},
            ],
            value="1m",
            inline=True,
            style=dict(fontSize="12px"),
        ),

        _section("Stop Loss"),
        _slider(f"{t}-sl", "Stop Loss %", 3, 0, 15, 0.5),

        _section("Take Profit"),
        _slider(f"{t}-tp", "Take Profit %", 6, 0, 30, 0.5),

        _section("Capital"),
        dbc.InputGroup([
            dbc.InputGroupText("₹", style=dict(
                backgroundColor=CARD, borderColor=BORDER,
                color=MUTED, fontSize="13px")),
            dbc.Input(id=f"{t}-capital", type="number",
                      value=100000, min=1,
                      style=dict(backgroundColor=CARD, borderColor=BORDER,
                                 color=TEXT, fontSize="13px")),
        ], size="sm"),

    ], className="side-panel")


# ── Right metrics panel ───────────────────────────────────────────────────────

def _right_panel():
    return html.Div([
        html.Div(id="live-price-card"),
        html.Hr(className="dim"),
        _section("Performance"),
        html.Div(id="kpi-grid"),
        html.Hr(className="dim"),
        html.Div(id="interval-badge-right"),
    ], className="side-panel")


# ── Layout ────────────────────────────────────────────────────────────────────

app.layout = dbc.Container([

    # ── Header ──
    html.Div([
        html.Div([
            html.Span("📈 ", style=dict(fontSize="20px")),
            html.Span("ALGO TRADER", style=dict(
                fontSize="16px", fontWeight="800",
                letterSpacing="4px", color=ACCENT,
            )),
            html.Span("  Intraday Backtester",
                      style=dict(fontSize="11px", color=DIM, marginLeft="10px")),
        ], style=dict(display="flex", alignItems="center")),
        html.Div(id="header-clock",
                 style=dict(fontSize="11px", color=DIM, fontFamily=MONO)),
    ], style=dict(
        display="flex", justifyContent="space-between", alignItems="center",
        padding="12px 0 10px",
    )),

    # ── Tabs ──
    dbc.Tabs(id="tabs", active_tab="backtest", style=dict(marginBottom="12px"), children=[

        # ════════════════════════════════════════════
        # BACKTEST TAB
        # ════════════════════════════════════════════
        dbc.Tab(label="📊  Backtest", tab_id="backtest", children=[
            dbc.Row([

                # Left: config
                dbc.Col(_left_panel("bt"), width=3),

                # Center: charts + trade log
                dbc.Col([
                    html.Div(className="center-panel", children=[

                        # Run button lives in center top for visibility
                        dbc.Button(
                            "▶  Run Backtest", id="bt-run", color="primary",
                            style=dict(
                                width="100%", fontWeight="700",
                                letterSpacing="0.06em", padding="10px",
                            ),
                        ),

                        # Chart
                        html.Div(
                            dcc.Graph(
                                id="bt-chart",
                                config=dict(displayModeBar=False),
                                figure=_empty_chart(),
                                style=dict(height="460px"),
                            ),
                            style=dict(
                                background=CHART, borderRadius="10px",
                                border=f"1px solid {BORDER}", overflow="hidden",
                            ),
                        ),

                        # Trade log
                        html.Div([
                            html.Div(id="trade-log-content"),
                        ], style=dict(
                            background=PANEL, borderRadius="10px",
                            border=f"1px solid {BORDER}", overflow="hidden",
                            maxHeight="280px", overflowY="auto",
                        )),
                    ]),
                ], width=6),

                # Right: metrics
                dbc.Col(_right_panel(), width=3),

            ], className="g-3"),
        ]),

        # ════════════════════════════════════════════
        # LIVE SIMULATION TAB
        # ════════════════════════════════════════════
        dbc.Tab(label="🔴  Live Simulation", tab_id="live", children=[
            dbc.Row([

                # Left: config
                dbc.Col([
                    _left_panel("live"),
                    # Start / Stop buttons below config panel
                    html.Div([
                        dbc.Button("▶  Start", id="live-start", color="success",
                                   style=dict(flex="1", fontWeight="700")),
                        dbc.Button("⏹  Stop", id="live-stop",  color="danger",
                                   outline=True, disabled=True,
                                   style=dict(flex="1", fontWeight="700")),
                    ], style=dict(display="flex", gap="8px", marginTop="12px")),
                ], width=3),

                # Center: market bar + intraday chart + position
                dbc.Col([
                    html.Div(className="center-panel", children=[
                        html.Div(id="market-status-bar"),
                        html.Div(
                            dcc.Graph(
                                id="live-chart",
                                config=dict(displayModeBar=False),
                                figure=_empty_chart("Start a simulation to see today's intraday chart"),
                                style=dict(height="420px"),
                            ),
                            style=dict(
                                background=CHART, borderRadius="10px",
                                border=f"1px solid {BORDER}", overflow="hidden",
                            ),
                        ),
                        html.Div(id="position-panel"),
                        html.Div(id="live-trade-log"),
                    ]),
                ], width=6),

                # Right: live price + live metrics
                dbc.Col([
                    html.Div([
                        html.Div(id="live-price-live"),
                        html.Hr(className="dim"),
                        _section("Today's Performance"),
                        html.Div(id="live-kpi-grid"),
                    ], className="side-panel"),
                ], width=3),

            ], className="g-3"),
        ]),

        # ════════════════════════════════════════════
        # ADVANCED BACKTEST TAB
        # ════════════════════════════════════════════
        dbc.Tab(label="🧠  Advanced", tab_id="advanced", children=[
            dbc.Row([

                # Left: config
                dbc.Col([
                    html.Div([
                        _section("Stocks"),
                        html.Div("Search any NSE stock — select multiple",
                                 style=dict(fontSize="9px", color=DIM, marginBottom="4px")),
                        dcc.Dropdown(
                            id="adv-symbols",
                            options=[{"label": f"{s}  ({SYMBOL_SECTOR.get(s,'')})", "value": s}
                                     for s in all_symbols()],
                            value=["RELIANCE", "HDFCBANK"],
                            multi=True,
                            clearable=True,
                            searchable=True,
                            placeholder="Search or pick stocks…",
                            style=dict(backgroundColor=CARD, borderColor=BORDER,
                                       color=TEXT, fontSize="12px"),
                        ),
                        _section("Date Range"),
                        html.Div([
                            _date_btn("1W",  "adv-1w"),
                            _date_btn("2W",  "adv-2w"),
                            _date_btn("1M",  "adv-1m", active=True),
                            _date_btn("3M",  "adv-3m"),
                        ], className="date-chips"),
                        dbc.Row([
                            dbc.Col([html.Div("From", style=dict(fontSize="9px", color=DIM, marginBottom="3px")),
                                     dbc.Input(id="adv-from", type="date", value="2026-04-01", size="sm")], width=6),
                            dbc.Col([html.Div("To",   style=dict(fontSize="9px", color=DIM, marginBottom="3px")),
                                     dbc.Input(id="adv-to",   type="date", value=TODAY, size="sm")], width=6),
                        ], className="g-1 mb-2"),
                        html.Div(id="adv-range-warn",
                                 style=dict(fontSize="9px", color=WARNING, marginBottom="4px")),

                        _section("Bar Interval"),
                        html.Div("Regime detection needs ≥6 bars in first 30 min — 5m is the sweet spot.",
                                 style=dict(fontSize="9px", color=DIM, marginBottom="6px")),
                        dbc.RadioItems(
                            id="adv-interval",
                            options=[
                                {"label": "1 min",  "value": "1m"},
                                {"label": "5 min",  "value": "5m"},
                                {"label": "15 min", "value": "15m"},
                                {"label": "1 day",  "value": "1d"},
                            ],
                            value="5m",
                            inline=True,
                            style=dict(fontSize="12px"),
                        ),
                        html.Div(id="adv-interval-note",
                                 style=dict(fontSize="9px", marginTop="4px", marginBottom="2px")),

                        _section("Capital per Stock"),
                        dbc.InputGroup([
                            dbc.InputGroupText("₹", style=dict(backgroundColor=CARD, borderColor=BORDER, color=MUTED, fontSize="13px")),
                            dbc.Input(id="adv-capital", type="number", value=100000, min=1,
                                      style=dict(backgroundColor=CARD, borderColor=BORDER, color=TEXT, fontSize="13px")),
                        ], size="sm"),

                        _section("Risk Config"),
                        dbc.Row([
                            dbc.Col([
                                html.Div("Risk/trade %", style=dict(fontSize="9px", color=MUTED, marginBottom="3px")),
                                dbc.Input(id="adv-risk", type="number", value=1.0, min=0.1, max=5, step=0.1, size="sm",
                                          style=dict(backgroundColor=CARD, borderColor=BORDER, color=TEXT, fontSize="12px")),
                            ], width=6),
                            dbc.Col([
                                html.Div("Max loss/day %", style=dict(fontSize="9px", color=MUTED, marginBottom="3px")),
                                dbc.Input(id="adv-maxloss", type="number", value=2.0, min=0.5, max=10, step=0.5, size="sm",
                                          style=dict(backgroundColor=CARD, borderColor=BORDER, color=TEXT, fontSize="12px")),
                            ], width=6),
                        ], className="g-1"),

                        dbc.Button(
                            "▶  Run Advanced Backtest",
                            id="adv-run", color="primary", n_clicks=0,
                            style=dict(width="100%", fontWeight="700", marginTop="20px", padding="10px"),
                        ),
                        html.Div(id="adv-status",
                                 style=dict(fontSize="11px", color=MUTED, marginTop="8px", textAlign="center")),

                        html.Hr(style=dict(borderColor=BORDER, margin="16px 0 10px")),
                        html.Div([
                            html.Div("Strategy logic", style=dict(fontSize="10px", color=MUTED, fontWeight="600", marginBottom="6px")),
                            *[html.Div([
                                html.Span(label, style=dict(color=ACCENT, fontFamily=MONO, fontSize="9px")),
                                html.Span(f"  →  {desc}", style=dict(color=DIM, fontSize="9px")),
                            ], style=dict(marginBottom="4px")) for label, desc in [
                                ("TRENDING",  "Opening Range Breakout (ORB)"),
                                ("SIDEWAYS",  "VWAP Mean Reversion"),
                                ("HIGH_VOL",  "Skip — no trade (too risky)"),
                            ]],
                        ]),
                    ], className="side-panel"),
                ], width=3),

                # Center: results
                dbc.Col([
                    dcc.Loading(
                        id="adv-loading",
                        type="circle",
                        color=ACCENT,
                        delay_show=300,
                        children=html.Div(
                            id="adv-results",
                            className="center-panel",
                            children=[
                                html.Div([
                                    html.Div("🧠", style=dict(fontSize="32px", marginBottom="12px")),
                                    html.Div("Regime-Aware Backtester",
                                             style=dict(color=TEXT, fontSize="15px", fontWeight="600", marginBottom="8px")),
                                    html.Div([
                                        html.Div("Each trading day is analysed independently:", style=dict(color=MUTED, fontSize="12px", marginBottom="8px")),
                                        *[html.Div([
                                            html.Span(f"  {num}. ", style=dict(color=ACCENT, fontFamily=MONO, fontSize="11px")),
                                            html.Span(step, style=dict(color=DIM, fontSize="11px")),
                                        ], style=dict(marginBottom="4px")) for num, step in [
                                            ("①", "Classify regime from first 30 min of price action"),
                                            ("②", "Select best strategy for that regime"),
                                            ("③", "Run bar-by-bar simulation with ATR-based SL/TP"),
                                            ("④", "Apply risk rules (position size, daily loss limit)"),
                                        ]],
                                    ], style=dict(textAlign="left", maxWidth="400px")),
                                    html.Div("→ Select stocks, set date range, hit Run",
                                             style=dict(color=MUTED, fontSize="11px", marginTop="16px")),
                                ], style=dict(padding="50px 40px", textAlign="center")),
                            ],
                        ),
                    ),
                ], width=9),

            ], className="g-3"),
        ]),
    ]),

    # Hidden state
    dcc.Store(id="live-state", data=dict(running=False, ticker=None,
                                          strategy="crossover", sl=3.0, tp=6.0,
                                          capital=100000)),
    dcc.Interval(id="live-tick",  interval=60_000, disabled=True),
    dcc.Interval(id="clock-tick", interval=30_000, n_intervals=0),
    dcc.Interval(id="price-tick", interval=60_000, n_intervals=0),

], fluid=True, style=dict(backgroundColor=BG, minHeight="100vh", padding="0 20px 40px"))


# ── Helpers ───────────────────────────────────────────────────────────────────

def _apply_strategy(df, strategy):
    if strategy == "crossover":    return apply_crossover(df)
    if strategy == "price_vs_ema": return apply_price_vs_ema(df)
    if strategy == "rsi":          return apply_rsi(df)
    if strategy == "macd_rsi":     return apply_macd_rsi(df)
    if strategy == "supertrend":   return apply_supertrend(df)
    return apply_crossover(df)


def _make_search_options(query, current):
    options = [{"label": current, "value": current}] if current else []
    if not query or len(query.strip()) < 2:
        return options
    try:
        seen = {current} if current else set()
        for r in yf.Search(query.strip(), max_results=12).quotes:
            sym  = r.get("symbol","")
            exc  = r.get("exchange","")
            name = r.get("shortname") or r.get("longname") or sym
            if exc in ("NSI","BSE","BOM") and sym and sym not in seen:
                options.append({"label": f"{name}  ·  {sym}", "value": sym})
                seen.add(sym)
    except Exception:
        pass
    return options


def _price_card(ticker, card_id=None):
    if not ticker:
        return html.Div("Select a stock", style=dict(color=DIM, fontSize="12px", padding="8px 0"))
    try:
        fi    = yf.Ticker(ticker).fast_info
        price = fi.last_price
        prev  = fi.previous_close
        diff  = price - prev
        pct   = diff / prev * 100
        color = PROFIT if diff >= 0 else LOSS
        sign  = "+" if diff >= 0 else "−"
        name  = ticker.split(".")[0]
        return html.Div([
            html.Div(name, className="price-ticker"),
            html.Div(f"₹{price:,.2f}", className="price-big"),
            html.Div(
                f"{sign}₹{abs(diff):.2f}  {sign}{abs(pct):.2f}%",
                className="price-change", style=dict(color=color),
            ),
            html.Div("~15 min delayed  ·  NSE", className="price-meta"),
        ], className="price-card", **({"id": card_id} if card_id else {}))
    except Exception:
        return html.Div("Price unavailable", style=dict(color=DIM, fontSize="12px"))


def _kpi_grid(r):
    if not r:
        return html.Div("Run a backtest to see metrics",
                        style=dict(color=DIM, fontSize="12px", padding="8px 0"))

    sign    = "+" if r["pnl"] >= 0 else "−"
    p_color = PROFIT if r["pnl"] >= 0 else LOSS

    pf = r.get("profit_factor", 0)
    pf_str = f"{pf:.2f}" if pf != float("inf") else "∞"
    pf_col = PROFIT if pf >= 1.5 else (WARNING if pf >= 1 else LOSS)

    return html.Div([
        _kpi("P & L",    f"{sign}{inr(abs(r['pnl']))}",      p_color),
        _kpi("Return",   f"{'+' if r['return_pct']>=0 else '−'}{abs(r['return_pct']):.2f}%", p_color),
        _kpi("Trades",   str(r["total_trades"])),
        _kpi("Win Rate", f"{r['win_rate']:.1f}%"),
        _kpi("Profit Factor", pf_str, pf_col),
        _kpi("Max DD",   f"{r['max_drawdown']:.2f}%", LOSS),
        _kpi("Sharpe",   f"{r['sharpe']:.2f}"),
        _kpi("Max Loss Streak", str(r.get("max_consec_losses", 0))),
    ], className="kpi-grid")


def _trade_table(trades, intraday=False):
    if not trades:
        return html.Div(
            "No trades triggered in this period.",
            style=dict(color=MUTED, fontSize="12px", padding="12px 14px"),
        )

    badge = {"stop_loss": "SL", "take_profit": "TP", "signal": "SIG"}
    badge_cls = {"stop_loss": "badge-sl", "take_profit": "badge-tp", "signal": "badge-sig"}

    rows = []
    for i, t in enumerate(trades):
        c       = PROFIT if t.pnl >= 0 else LOSS
        row_cls = "row-profit" if t.pnl >= 0 else "row-loss"
        sign    = "+" if t.pnl >= 0 else "−"
        b       = badge.get(t.exit_reason, "SIG")
        bc      = badge_cls.get(t.exit_reason, "badge-sig")

        rows.append(html.Tr([
            html.Td(f"{t.entry_date}  →  {t.exit_date}"),
            html.Td(html.Span(b, className=bc)),
            html.Td(f"₹{t.entry_price:,.2f}"),
            html.Td(f"₹{t.exit_price:,.2f}"),
            html.Td(f"{sign}{inr(abs(t.pnl))}",  style=dict(color=c, fontWeight="600")),
            html.Td(f"{'+' if t.pnl_pct>=0 else '−'}{abs(t.pnl_pct):.2f}%", style=dict(color=c)),
        ], className=row_cls))

    return html.Table([
        html.Thead(html.Tr([
            html.Th("Time / Date"), html.Th("Exit"), html.Th("Entry"),
            html.Th("Exit"), html.Th("P & L"), html.Th("%"),
        ])),
        html.Tbody(rows),
    ], className="trade-table")


def _position_panel_html(shares, entry, current, sl, tp, open_pnl, ticker):
    if shares == 0:
        return html.Div(
            "No open position — waiting for signal",
            style=dict(color=DIM, fontSize="12px",
                       padding="12px 14px", textAlign="center"),
        )
    color = PROFIT if open_pnl >= 0 else LOSS
    sign  = "+" if open_pnl >= 0 else "−"
    pct   = (current - entry) / entry * 100

    rows = [("Stock", ticker.split(".")[0]), ("Side", "LONG"),
            ("Shares", str(shares)), ("Entry", f"₹{entry:,.2f}"),
            ("Current", f"₹{current:,.2f}")]
    if sl:  rows.append(("Stop Loss",   f"₹{sl:,.2f}"))
    if tp:  rows.append(("Take Profit", f"₹{tp:,.2f}"))

    return html.Div([
        html.Div("OPEN POSITION", className="position-label", style=dict(marginBottom="10px")),
        *[html.Div([
            html.Span(k, className="pos-row-key"),
            html.Span(v, className="pos-row-val"),
        ], className="pos-row") for k, v in rows],
        html.Div(style=dict(borderTop=f"1px solid {BORDER}", marginTop="10px", paddingTop="10px"), children=[
            html.Span("Unrealised P&L  ", style=dict(color=MUTED, fontSize="11px")),
            html.Span(f"{sign}{inr(abs(open_pnl))}  ({sign}{abs(pct):.2f}%)",
                      style=dict(color=color, fontWeight="700", fontSize="14px",
                                 fontFamily=MONO)),
        ]),
    ], className="position-card")


# ── Callbacks: search ─────────────────────────────────────────────────────────

@app.callback(Output("bt-search",   "options"), Input("bt-search",   "search_value"), State("bt-search",   "value"))
def search_bt(q, c):   return _make_search_options(q, c)

@app.callback(Output("live-search", "options"), Input("live-search", "search_value"), State("live-search", "value"))
def search_live(q, c): return _make_search_options(q, c)

# ── Advanced tab: stock search (multi-select) ─────────────────────────────────

_ADV_BASE_OPTIONS = [{"label": f"{s}  ({SYMBOL_SECTOR.get(s,'')})", "value": s} for s in all_symbols()]

@app.callback(
    Output("adv-symbols", "options"),
    Input("adv-symbols", "search_value"),
    State("adv-symbols", "value"),
)
def search_adv_symbols(query, current_values):
    # Build a base dict from the universe; always keep selected values
    base = {o["value"]: o for o in _ADV_BASE_OPTIONS}
    for v in (current_values or []):
        if v not in base:
            base[v] = {"label": v, "value": v}

    if not query or len(query.strip()) < 2:
        return list(base.values())

    q_lower = query.lower()
    # Filter universe by query
    result = {k: v for k, v in base.items()
              if q_lower in k.lower() or q_lower in v["label"].lower()}

    # Supplement with yfinance live search
    try:
        seen = set(base.keys())
        for r in yf.Search(query.strip(), max_results=8).quotes:
            sym  = r.get("symbol", "")
            exc  = r.get("exchange", "")
            name = r.get("shortname") or r.get("longname") or sym
            if exc in ("NSI", "BSE", "BOM") and sym and sym not in seen:
                result[sym] = {"label": f"{name}  ·  {sym}", "value": sym}
                seen.add(sym)
    except Exception:
        pass

    # Always keep currently selected in result
    for v in (current_values or []):
        if v not in result:
            result[v] = base.get(v, {"label": v, "value": v})

    return list(result.values())


# ── Advanced tab: interval advisory note ──────────────────────────────────────

@app.callback(
    Output("adv-interval-note", "children"),
    Output("adv-interval-note", "style"),
    Input("adv-interval", "value"),
)
def adv_interval_note(iv):
    notes = {
        "1m": ("⚠  1m is very noisy — regime detection is less reliable. 5m recommended.", WARNING),
        "5m": ("✓  5m is optimal for intraday regime detection.", PROFIT),
        "15m": ("ℹ  15m reduces trade count but improves signal quality.", MUTED),
        "1d": ("ℹ  Daily bars: regime uses full-day data, strategy runs end-of-day.", MUTED),
    }
    text, color = notes.get(iv, ("", MUTED))
    style = dict(fontSize="9px", color=color, marginTop="4px", marginBottom="2px")
    return text, style


# ── Callbacks: slider displays ────────────────────────────────────────────────

for _t in ("bt", "live"):
    for _k in ("sl", "tp"):
        @app.callback(
            Output(f"{_t}-{_k}-display", "children"),
            Input(f"{_t}-{_k}", "value"),
        )
        def _upd_slider(val): return f"{val or 0:.1f}%"


# ── Callbacks: date shortcuts ─────────────────────────────────────────────────

def _make_date_callback(tab):
    ids   = ["today","yest","3d","1w","2w","1m","3m"]
    btns  = [f"{tab}-{i}" for i in ids]
    days  = {"today":0, "yest":1, "3d":3, "1w":7, "2w":14, "1m":30, "3m":90}

    @app.callback(
        Output(f"{tab}-from", "value"),
        Output(f"{tab}-to",   "value"),
        *[v for b in btns for v in [Output(b,"color"), Output(b,"outline")]],
        *[Input(b, "n_clicks") for b in btns],
        prevent_initial_call=True,
    )
    def _cb(*_):
        btn = dash.callback_context.triggered[0]["prop_id"].split(".")[0]
        key = btn.replace(f"{tab}-", "")
        d   = days.get(key, 0)
        now = datetime.today()
        td  = now.strftime("%Y-%m-%d")
        if key == "yest":
            start = end = (now - timedelta(days=1)).strftime("%Y-%m-%d")
        elif d == 0:
            start = end = td
        else:
            start, end = (now - timedelta(days=d)).strftime("%Y-%m-%d"), td
        result = [start, end]
        for b in btns:
            bkey = b.replace(f"{tab}-","")
            result += ["primary", False] if bkey == key else ["secondary", True]
        return result

_make_date_callback("bt")
_make_date_callback("live")


@app.callback(
    Output("adv-from", "value"),
    Output("adv-to",   "value"),
    Output("adv-1w",  "color"), Output("adv-1w",  "outline"),
    Output("adv-2w",  "color"), Output("adv-2w",  "outline"),
    Output("adv-1m",  "color"), Output("adv-1m",  "outline"),
    Output("adv-3m",  "color"), Output("adv-3m",  "outline"),
    Input("adv-1w",  "n_clicks"),
    Input("adv-2w",  "n_clicks"),
    Input("adv-1m",  "n_clicks"),
    Input("adv-3m",  "n_clicks"),
    prevent_initial_call=True,
)
def adv_date_shortcuts(*_):
    keys  = ["1w","2w","1m","3m"]
    days  = {"1w":7, "2w":14, "1m":30, "3m":90}
    btn   = dash.callback_context.triggered[0]["prop_id"].split(".")[0].replace("adv-","")
    now   = datetime.today()
    start = (now - timedelta(days=days[btn])).strftime("%Y-%m-%d")
    end   = now.strftime("%Y-%m-%d")
    result = [start, end]
    for k in keys:
        result += ["primary", False] if k == btn else ["secondary", True]
    return result


@app.callback(
    Output("adv-range-warn", "children"),
    Input("adv-from", "value"),
    Input("adv-to",   "value"),
    Input("adv-interval", "value"),
)
def adv_range_warning(date_from, date_to, interval):
    if not date_from or not date_to or interval == "1d":
        return ""
    _limits = {"1m": 7, "5m": 60, "15m": 60}
    limit = _limits.get(interval, 60)
    try:
        delta = (datetime.strptime(date_to, "%Y-%m-%d") - datetime.strptime(date_from, "%Y-%m-%d")).days
        if delta > limit:
            return f"⚠  {interval} data is limited to {limit} days. Older bars will be missing — switch to 1d for longer ranges."
    except Exception:
        pass
    return ""


# ── Callback: header clock ────────────────────────────────────────────────────

@app.callback(Output("header-clock","children"), Input("clock-tick","n_intervals"))
def header_clock(_):
    from datetime import datetime
    from zoneinfo import ZoneInfo
    now = datetime.now(ZoneInfo("Asia/Kolkata"))
    s   = market_status()
    dot_color = s["color"]
    return html.Span([
        html.Span("● ", style=dict(color=dot_color)),
        f"NSE  {now.strftime('%a %d %b  %H:%M')} IST",
    ])


# ── Callback: live price (backtest sidebar) ───────────────────────────────────

@app.callback(
    Output("live-price-card", "children"),
    Input("price-tick", "n_intervals"),
    Input("bt-search", "value"),
)
def update_price(_, ticker): return _price_card(ticker)


# ── Callback: run backtest ────────────────────────────────────────────────────

@app.callback(
    Output("bt-chart",          "figure"),
    Output("kpi-grid",          "children"),
    Output("trade-log-content", "children"),
    Output("bt-interval-badge", "children"),
    Output("interval-badge-right", "children"),
    Input("bt-run", "n_clicks"),
    State("bt-search",   "value"),
    State("bt-from",     "value"),
    State("bt-to",       "value"),
    State("bt-strategy",    "value"),
    State("bt-sl",          "value"),
    State("bt-tp",          "value"),
    State("bt-capital",     "value"),
    State("bt-barinterval", "value"),
    prevent_initial_call=True,
)
def run_bt(_, ticker, start, end, strategy, sl, tp, capital, barinterval):
    err_style = dict(color=LOSS, padding="12px 14px", fontSize="13px")

    if not ticker:
        return no_update, html.Div("⚠  Select a stock first.", style=err_style), no_update, no_update, no_update

    try:
        df, interval = fetch(ticker, start=start, end=end, interval=barinterval or None)
    except ValueError as e:
        return no_update, html.Div(f"⚠  {e}", style=err_style), no_update, no_update, no_update

    df = _apply_strategy(df, strategy)
    r  = run_backtest(df, float(capital or 100_000),
                      stop_loss_pct=float(sl or 0), take_profit_pct=float(tp or 0))

    fig   = _candle_chart(df, result=r)
    kpis  = _kpi_grid(r)
    table = _trade_table(r["trades"], intraday=(interval in ("1m","5m")))

    iv_lbl = {"1m":"1-MIN","2m":"2-MIN","5m":"5-MIN","15m":"15-MIN","30m":"30-MIN","1d":"DAILY"}.get(interval, interval) + " BARS"
    fell_back = barinterval and barinterval != interval
    badge = html.Span(
        [iv_lbl, html.Span(" (auto-adjusted)", style=dict(fontSize="9px", marginLeft="4px", opacity="0.7"))] if fell_back else iv_lbl,
        className="interval-badge",
        title=f"You selected {barinterval} but your date range requires {interval}" if fell_back else "",
    )
    return fig, kpis, table, badge, badge


# ── Callback: market status bar ───────────────────────────────────────────────

@app.callback(Output("market-status-bar","children"), Input("clock-tick","n_intervals"))
def mkt_bar(_):
    s = market_status()
    dot_cls = {"OPEN":"status-dot status-dot-open",
               "CLOSED":"status-dot status-dot-closed",
               "PRE-MARKET":"status-dot status-dot-pre"}.get(s["label"], "status-dot status-dot-closed")
    return html.Div([
        html.Span(className=dot_cls),
        html.Span(s["label"],  style=dict(color=s["color"], fontWeight="700", fontSize="12px")),
        html.Span(s["time"],   style=dict(color=MUTED, fontSize="11px", fontFamily=MONO)),
        html.Span(s["detail"], style=dict(color=DIM,   fontSize="11px")),
    ], className="market-bar")


# ── Callbacks: start / stop live sim ─────────────────────────────────────────

@app.callback(
    Output("live-state",  "data"),
    Output("live-tick",   "disabled"),
    Output("live-start",  "disabled"),
    Output("live-stop",   "disabled"),
    Input("live-start",  "n_clicks"),
    Input("live-stop",   "n_clicks"),
    State("live-search",      "value"),
    State("live-strategy",    "value"),
    State("live-sl",          "value"),
    State("live-tp",          "value"),
    State("live-capital",     "value"),
    State("live-barinterval", "value"),
    State("live-state",       "data"),
    prevent_initial_call=True,
)
def toggle_sim(_, __, ticker, strategy, sl, tp, capital, barinterval, state):
    trig = dash.callback_context.triggered[0]["prop_id"].split(".")[0]
    if trig == "live-start":
        if not ticker:
            return state, True, False, True
        return (dict(running=True, ticker=ticker, strategy=strategy,
                     sl=float(sl or 0), tp=float(tp or 0),
                     capital=float(capital or 100_000),
                     interval=barinterval or "1m"),
                False, True, False)
    return ({**state, "running": False}, True, False, True)


# ── Callback: live simulation tick ───────────────────────────────────────────

@app.callback(
    Output("live-chart",      "figure"),
    Output("position-panel",  "children"),
    Output("live-trade-log",  "children"),
    Output("live-price-live", "children"),
    Output("live-kpi-grid",   "children"),
    Input("live-tick",  "n_intervals"),
    Input("live-state", "data"),
    prevent_initial_call=True,
)
def live_tick(_, state):
    empty_fig = _empty_chart("Start a simulation to see today's intraday chart")

    if not state or not state.get("running") or not state.get("ticker"):
        return empty_fig, no_update, no_update, no_update, no_update

    ticker   = state["ticker"]
    strategy = state["strategy"]
    sl_pct   = state["sl"]
    tp_pct   = state["tp"]
    capital  = state["capital"]
    interval = state.get("interval", "1m")

    try:
        df = fetch_intraday(ticker, interval=interval)
    except ValueError as e:
        return no_update, html.Div(str(e), style=dict(color=LOSS)), no_update, no_update, no_update

    if len(df) < 30:
        msg = html.Div(
            f"Only {len(df)} bars so far — need ~30 for signals. Check back in a few minutes.",
            style=dict(color=WARNING, fontSize="12px", padding="12px"))
        return _empty_chart("Waiting for enough bars…"), msg, no_update, no_update, no_update

    df = _apply_strategy(df, strategy)
    r  = run_backtest(df, capital, stop_loss_pct=sl_pct, take_profit_pct=tp_pct)

    # Replay loop to detect open position
    current  = float(df["close"].iloc[-1])
    cash     = capital
    pos      = 0
    ep       = 0.0
    sl_m     = (1 - sl_pct / 100) if sl_pct else None
    tp_m     = (1 + tp_pct / 100) if tp_pct else None
    for _, row in df.iterrows():
        px  = float(row["close"])
        sig = int(row["signal"])
        exited = False
        if pos > 0:
            if sl_m and px <= ep * sl_m: cash += pos * px; pos = 0; exited = True
            elif tp_m and px >= ep * tp_m: cash += pos * px; pos = 0; exited = True
            elif sig == -1: cash += pos * px; pos = 0; exited = True
        if not exited and sig == 1 and pos == 0:
            s = int(cash // px)
            if s > 0: pos = s; ep = px; cash -= s * px

    sl_price = round(ep * sl_m, 2) if (pos > 0 and sl_m) else None
    tp_price = round(ep * tp_m, 2) if (pos > 0 and tp_m) else None
    open_pnl = (current - ep) * pos if pos > 0 else None

    fig      = _candle_chart(df, result=r, sl_price=sl_price, tp_price=tp_price,
                              entry_price=ep if pos > 0 else None)
    pos_html = _position_panel_html(pos, ep, current, sl_price, tp_price, open_pnl or 0, ticker)
    trades   = _trade_table(r["trades"], intraday=True)
    price    = _price_card(ticker)
    kpis     = _kpi_grid(r)

    return fig, pos_html, trades, price, kpis


# ── Callback: advanced backtest ───────────────────────────────────────────────

@app.callback(
    Output("adv-results", "children"),
    Output("adv-status",  "children"),
    Output("adv-run",     "disabled"),
    Output("adv-run",     "children"),
    Input("adv-run",      "n_clicks"),
    State("adv-symbols",  "value"),
    State("adv-from",     "value"),
    State("adv-to",       "value"),
    State("adv-capital",  "value"),
    State("adv-risk",     "value"),
    State("adv-maxloss",  "value"),
    State("adv-interval", "value"),
    prevent_initial_call=True,
)
def run_advanced(_, symbols, date_from, date_to, capital, risk_pct, max_loss, interval):
    _btn_idle = "▶  Run Advanced Backtest"
    from risk import RiskConfig
    from collections import defaultdict

    err_style  = dict(color=LOSS, padding="20px", fontSize="13px")
    _re = lambda content, status: (content, status, False, _btn_idle)  # re-enable button helper

    if not symbols:
        return _re(no_update, html.Span("⚠  Select at least one stock.", style=dict(color=WARNING)))
    if not date_from or not date_to or date_from > date_to:
        return _re(no_update, html.Span("⚠  Invalid date range.", style=dict(color=WARNING)))

    cfg = RiskConfig(
        risk_per_trade_pct=float(risk_pct or 1.0),
        max_daily_loss_pct=float(max_loss or 2.0),
    )

    try:
        results = adv_run(
            symbols=symbols,
            start_date=date_from,
            end_date=date_to,
            capital=float(capital or 100_000),
            risk_config=cfg,
            interval=interval or "5m",
            save_to_db=True,
        )
    except Exception as e:
        import traceback; traceback.print_exc()
        return _re(html.Div(f"⚠  Error: {e}", style=err_style), "")

    s      = results["summary"]
    trades = results["trades"]
    rs     = results["regime_stats"]

    # ── Regime analysis banner (always shown) ────────────────────────────────
    total_days  = sum(v["trades"] for v in rs.values()) or 1
    regime_pills = []
    for regime, data in rs.items():
        count = data["trades"]
        if count == 0:
            continue
        color_map = {"trending": PROFIT, "sideways": ACCENT, "high_vol": WARNING}
        strategy_map = {"trending": "ORB", "sideways": "VWAP Rev.", "high_vol": "Skipped"}
        col = color_map.get(regime, MUTED)
        regime_pills.append(html.Div([
            html.Div(regime.upper(), style=dict(
                fontSize="9px", color=col, fontFamily=MONO,
                fontWeight="700", marginBottom="2px", letterSpacing="0.08em")),
            html.Div(strategy_map.get(regime, "—"),
                     style=dict(fontSize="10px", color=TEXT, marginBottom="2px")),
            html.Div(f"{count} trades", style=dict(fontSize="9px", color=DIM)),
        ], style=dict(
            padding="8px 14px", borderRadius="6px",
            border=f"1px solid {col}22",
            backgroundColor=f"{col}0d",
            minWidth="80px", textAlign="center",
        )))

    # high_vol days are skipped — count them from regime_stats (they have 0 trades
    # but the engine still classified them); approximate from total trading days
    high_vol_skipped = rs.get("high_vol", {}).get("trades", 0)  # always 0 per design

    regime_banner = html.Div([
        html.Div("REGIME DETECTION", style=dict(
            fontSize="9px", color=DIM, letterSpacing="0.12em",
            fontWeight="600", marginBottom="8px")),
        html.Div(regime_pills, style=dict(display="flex", gap="10px", flexWrap="wrap")),
        html.Div(
            f"Each day's first 30 min determined regime → strategy was auto-selected accordingly.",
            style=dict(fontSize="9px", color=DIM, marginTop="8px")),
    ], style=dict(
        background=CARD, border=f"1px solid {BORDER}",
        borderRadius="8px", padding="14px 16px", marginBottom="16px",
    ))

    if s["total_trades"] == 0:
        no_trade_msg = html.Div([
            regime_banner,
            html.Div([
                html.Div("No trades generated", style=dict(color=MUTED, fontSize="14px", fontWeight="600", marginBottom="8px")),
                html.Div("Possible reasons:", style=dict(color=DIM, fontSize="12px", marginBottom="6px")),
                html.Ul([
                    html.Li("All days classified as high-volatility → skipped by design"),
                    html.Li("No NSE trading days in selected range (check for market holidays)"),
                    html.Li(f"5m data: 60-day limit · 1m data: 7-day limit — try 1d for older ranges"),
                    html.Li("Stock had no price data for those dates"),
                ], style=dict(color=DIM, fontSize="11px", lineHeight="1.9", paddingLeft="16px")),
            ], style=dict(padding="20px 0")),
        ], style=dict(padding="20px 30px"))
        return _re(no_trade_msg, html.Span("0 trades — see reasons above", style=dict(color=WARNING)))

    # ── Summary KPIs ──────────────────────────────────────────────────────────
    sign    = "+" if s["pnl"] >= 0 else ""
    pnl_col = PROFIT if s["pnl"] >= 0 else LOSS
    pf      = s["profit_factor"]
    pf_str  = f"{pf:.2f}" if pf != float("inf") else "∞"
    th_style = dict(fontSize="9px", color=DIM, textTransform="uppercase", letterSpacing="0.1em")

    kpi_row = html.Div([
        _kpi("Total P&L",     f"{sign}{inr(s['pnl'])}",          pnl_col),
        _kpi("Return",        f"{sign}{s['return_pct']:.2f}%",   pnl_col),
        _kpi("Total Trades",  str(s["total_trades"]),             TEXT),
        _kpi("Win Rate",      f"{s['win_rate']:.1f}%",            TEXT),
        _kpi("Profit Factor", pf_str,                             PROFIT if pf >= 1.5 else (WARNING if pf >= 1 else LOSS)),
        _kpi("Avg Win",       inr(s["avg_win"]),                  PROFIT),
        _kpi("Avg Loss",      inr(abs(s["avg_loss"])),            LOSS),
        _kpi("Stocks",        str(len(symbols)),                  TEXT),
    ], className="kpi-grid", style=dict(marginBottom="16px"))

    # ── Per-stock breakdown ───────────────────────────────────────────────────
    per_stock = defaultdict(lambda: {"trades": 0, "wins": 0, "pnl": 0.0})
    for t in trades:
        ps = per_stock[t.symbol]
        ps["trades"] += 1
        ps["pnl"]    += t.pnl
        if t.pnl > 0:
            ps["wins"] += 1

    stock_rows = []
    for sym, ps in sorted(per_stock.items(), key=lambda x: -x[1]["pnl"]):
        wr  = round(ps["wins"] / ps["trades"] * 100, 1) if ps["trades"] else 0
        col = PROFIT if ps["pnl"] >= 0 else LOSS
        stock_rows.append(html.Tr([
            html.Td(sym.replace(".NS",""),    style=dict(fontWeight="600", fontSize="12px")),
            html.Td(str(ps["trades"]),        style=dict(textAlign="right", fontFamily=MONO)),
            html.Td(f"{wr:.0f}%",             style=dict(textAlign="right", fontFamily=MONO)),
            html.Td(f"{'+' if ps['pnl']>=0 else ''}₹{ps['pnl']:,.0f}",
                    style=dict(textAlign="right", fontFamily=MONO, color=col, fontWeight="600")),
        ]))

    # ── Regime breakdown ─────────────────────────────────────────────────────
    regime_rows = []
    strategy_names = {"trending": "ORB", "sideways": "VWAP Rev.", "high_vol": "—"}
    for regime, rdata in rs.items():
        if rdata["trades"] == 0:
            continue
        wr  = round(rdata["wins"] / rdata["trades"] * 100, 1)
        col = PROFIT if rdata["pnl"] >= 0 else LOSS
        regime_rows.append(html.Tr([
            html.Td(regime.upper(), style=dict(color=ACCENT, fontSize="11px", fontFamily=MONO)),
            html.Td(strategy_names.get(regime, "—"), style=dict(color=MUTED, fontSize="11px")),
            html.Td(str(rdata["trades"]),  style=dict(textAlign="right", fontFamily=MONO)),
            html.Td(f"{wr}%",              style=dict(textAlign="right", fontFamily=MONO)),
            html.Td(f"{'+' if rdata['pnl']>=0 else ''}₹{rdata['pnl']:,.0f}",
                    style=dict(textAlign="right", fontFamily=MONO, color=col, fontWeight="600")),
        ]))

    breakdown_row = dbc.Row([
        dbc.Col([
            html.P("BY STOCK", className="section-label"),
            html.Div(html.Table([
                html.Thead(html.Tr([
                    html.Th("STOCK"), html.Th("TRADES"), html.Th("WIN%"), html.Th("P&L")
                ], style=th_style)),
                html.Tbody(stock_rows),
            ], className="trade-table"), className="trade-table-wrap"),
        ], width=6),
        dbc.Col([
            html.P("BY REGIME / STRATEGY", className="section-label"),
            html.Div(html.Table([
                html.Thead(html.Tr([
                    html.Th("REGIME"), html.Th("STRATEGY"),
                    html.Th("TRADES"), html.Th("WIN%"), html.Th("P&L")
                ], style=th_style)),
                html.Tbody(regime_rows or [html.Tr([html.Td("—", colSpan=5, style=dict(color=DIM))])]),
            ], className="trade-table"), className="trade-table-wrap"),
        ], width=6),
    ], className="g-3 mb-3")

    # ── Trade log ─────────────────────────────────────────────────────────────
    trade_rows = []
    for t in trades[-150:]:
        pnl_col_r = PROFIT if t.pnl > 0 else LOSS
        badge_cls = {"stop_loss": "badge-sl", "take_profit": "badge-tp"}.get(t.exit_reason, "badge-sig")
        et = str(t.entry_time)[5:16] if len(str(t.entry_time)) > 16 else str(t.entry_time)
        xt = str(t.exit_time)[5:16]  if len(str(t.exit_time))  > 16 else str(t.exit_time)
        trade_rows.append(html.Tr([
            html.Td([
                html.Div(t.symbol.replace(".NS",""), style=dict(fontWeight="600", fontSize="12px")),
                html.Div(f"{t.date}  {et} → {xt}", style=dict(fontSize="10px", color=DIM)),
            ]),
            html.Td([
                html.Div(t.regime[:4].upper(), style=dict(fontSize="9px", color=ACCENT, fontFamily=MONO)),
                html.Div(t.strategy,           style=dict(fontSize="9px", color=DIM)),
            ]),
            html.Td(f"₹{t.entry_price:,.2f}"),
            html.Td(f"₹{t.exit_price:,.2f}"),
            html.Td(html.Span(t.exit_reason.replace("_"," ").upper(), className=badge_cls)),
            html.Td(f"{'+' if t.pnl>=0 else ''}₹{t.pnl:,.0f}",
                    style=dict(color=pnl_col_r, fontWeight="600")),
        ], className="row-profit" if t.pnl > 0 else "row-loss"))

    trade_section = html.Div([
        html.P(f"TRADE LOG  ({min(len(trades),150)} of {len(trades)} shown)", className="section-label"),
        html.Div(html.Table([
            html.Thead(html.Tr([
                html.Th("STOCK / TIME"), html.Th("REGIME / STRATEGY"),
                html.Th("ENTRY"), html.Th("EXIT"),
                html.Th("EXIT"), html.Th("P&L"),
            ], style=th_style)),
            html.Tbody(trade_rows),
        ], className="trade-table"), className="trade-table-wrap"),
    ])

    status_text = f"✓  {len(trades)} trades · {len(symbols)} stocks · {date_from} → {date_to}"
    return _re(
        html.Div([
            regime_banner,
            html.P("SUMMARY", className="section-label"),
            kpi_row,
            breakdown_row,
            trade_section,
        ]),
        html.Span(status_text, style=dict(color=PROFIT)),
    )


if __name__ == "__main__":
    print("\n  Algo Trader  →  http://localhost:8050\n")
    app.run(debug=False, port=8050)
