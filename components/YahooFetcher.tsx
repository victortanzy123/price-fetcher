"use client";

import React, { useState, useCallback, useRef, KeyboardEvent } from "react";
import {
  X,
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Loader2,
  TrendingUp,
} from "lucide-react";
import clsx from "clsx";

// ─── Types ────────────────────────────────────────────────────────────────────

interface YahooResult {
  ticker: string;
  label: string;
  date: string;
  close_price: number;
  open_price: number;
  high_price: number;
  low_price: number;
  volume: number;
  currency: string;
  exchange: string;
  timezone: string;
  query_url: string;
}

interface YahooError {
  ticker: string;
  date: string;
  error: string;
}

type Result = YahooResult | YahooError;

function isError(r: Result): r is YahooError {
  return "error" in r;
}

// ─── Presets ──────────────────────────────────────────────────────────────────

const PRESET_GROUPS: { label: string; tickers: string[] }[] = [
  {
    label: "Indexes",
    tickers: ["^GSPC", "^IXIC", "^DJI", "000001.SS"],
  },
  {
    label: "Big Tech",
    tickers: ["NVDA", "AAPL", "MSFT", "GOOGL", "AMZN"],
  },
  {
    label: "Commodities",
    tickers: ["GC=F", "SI=F", "CL=F", "NG=F"],
  },
  {
    label: "ETFs",
    tickers: ["SPY", "QQQ", "IWM", "GLD"],
  },
];

const POPULAR_TICKERS = [
  // Indexes
  "^GSPC", "^IXIC", "^DJI", "^RUT", "000001.SS",
  // Stocks
  "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA", "BRK-B",
  "JPM", "V", "JNJ", "WMT", "XOM", "UNH", "LLY",
  // ETFs
  "SPY", "QQQ", "IWM", "GLD", "TLT", "VTI", "ARKK",
  // Commodities (futures)
  "GC=F", "SI=F", "CL=F", "NG=F",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getLastTradingDay(): string {
  const now = new Date();
  const d = new Date(now);
  // Start from today. If today's US session has already closed (after 21:30 UTC),
  // today is the last concluded trading day. Otherwise, go back to yesterday.
  // Either way, skip weekends.
  const utcHour = now.getUTCHours();
  const utcMinute = now.getUTCMinutes();
  const todaySessionClosed = utcHour > 21 || (utcHour === 21 && utcMinute >= 30);
  if (!todaySessionClosed) {
    // Today's session hasn't closed yet — step back to yesterday
    d.setUTCDate(d.getUTCDate() - 1);
  }
  // Skip back past Sunday (0) and Saturday (6)
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) {
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return (
    d.getUTCFullYear() +
    "-" +
    String(d.getUTCMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getUTCDate()).padStart(2, "0")
  );
}

function isValidDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s + "T00:00:00Z").getTime());
}

function formatPrice(n: number, currency: string): string {
  const sym = currency === "USD" ? "$" : currency + " ";
  if (n >= 10_000) return sym + n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (n >= 1) return sym + n.toFixed(2);
  return sym + n.toFixed(4);
}

function formatVolume(v: number): string {
  if (v >= 1_000_000_000) return (v / 1_000_000_000).toFixed(2) + "B";
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(2) + "M";
  if (v >= 1_000) return (v / 1_000).toFixed(2) + "K";
  return v.toLocaleString("en-US");
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TickerChip({
  ticker,
  onRemove,
}: {
  ticker: string;
  onRemove: () => void;
}) {
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold tracking-wide transition-colors"
      style={{
        backgroundColor: "var(--bg-page)",
        color: "var(--accent)",
        border: "1px solid var(--border)",
      }}
    >
      {ticker}
      <button
        onClick={onRemove}
        className="opacity-60 hover:opacity-100 transition-opacity rounded"
        aria-label={`Remove ${ticker}`}
        type="button"
      >
        <X size={11} />
      </button>
    </span>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function YahooFetcher() {
  const [tickers, setTickers] = useState<string[]>(["^GSPC", "NVDA", "AAPL", "GC=F", "CL=F"]);
  const [inputVal, setInputVal] = useState("");
  const [dateStr, setDateStr] = useState(getLastTradingDay());
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Result[] | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [expandedRaw, setExpandedRaw] = useState<Set<string>>(new Set());
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [dateError, setDateError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Ticker management ───────────────────────────────────────────────────────

  const addTicker = useCallback(
    (raw: string) => {
      const t = raw.trim().toUpperCase();
      if (!t) return;
      if (tickers.includes(t)) return;
      setTickers((prev) => [...prev, t]);
      setInputVal("");
      setShowSuggestions(false);
    },
    [tickers]
  );

  const removeTicker = useCallback((t: string) => {
    setTickers((prev) => prev.filter((x) => x !== t));
  }, []);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTicker(inputVal);
    }
    if (e.key === "Backspace" && inputVal === "" && tickers.length > 0) {
      setTickers((prev) => prev.slice(0, -1));
    }
    if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  };

  const applyPreset = (preset: { tickers: string[] }) => {
    setTickers(preset.tickers);
  };

  const suggestions = POPULAR_TICKERS.filter(
    (t) => t.includes(inputVal.toUpperCase()) && !tickers.includes(t)
  ).slice(0, 8);

  // ── Fetch ────────────────────────────────────────────────────────────────────

  const handleFetch = async () => {
    if (tickers.length === 0) return;
    setDateError(null);

    if (!isValidDate(dateStr)) {
      setDateError("Invalid date. Use format: YYYY-MM-DD");
      return;
    }

    setLoading(true);
    setFetchError(null);
    setResults(null);
    setExpandedRaw(new Set());

    try {
      const res = await fetch("/api/yahoo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tickers, date: dateStr }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      const data: Result[] = await res.json();
      setResults(data);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const toggleRaw = (ticker: string) => {
    setExpandedRaw((prev) => {
      const next = new Set(prev);
      if (next.has(ticker)) next.delete(ticker);
      else next.add(ticker);
      return next;
    });
  };

  // ── Derived ──────────────────────────────────────────────────────────────────

  const successResults = results?.filter((r): r is YahooResult => !isError(r)) ?? [];
  const errorResults = results?.filter((r): r is YahooError => isError(r)) ?? [];

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-full px-8 py-8 max-w-5xl mx-auto">
      {/* Page header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <TrendingUp size={22} style={{ color: "var(--accent)" }} />
          <h1
            className="text-xl font-semibold tracking-wide"
            style={{ color: "var(--text-primary)" }}
          >
            Yahoo Finance EOD Close
          </h1>
        </div>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          Fetches the{" "}
          <span style={{ color: "var(--accent)" }}>end-of-day closing price</span>
          {" "}for any ticker on a given date — stocks, ETFs, indices, commodities, and more.
        </p>
      </div>

      {/* Card */}
      <div
        className="rounded-xl border p-6 mb-6"
        style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border)" }}
      >
        {/* Presets */}
        <div className="mb-5">
          <label
            className="block text-xs font-semibold tracking-widest uppercase mb-2"
            style={{ color: "var(--text-secondary)" }}
          >
            Presets
          </label>
          <div className="flex flex-wrap gap-2">
            {PRESET_GROUPS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => applyPreset(preset)}
                className="text-xs px-3 py-1.5 rounded transition-colors font-medium tracking-wide"
                style={{
                  backgroundColor: "var(--bg-page)",
                  color: "var(--text-secondary)",
                  border: "1px solid var(--border)",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = "var(--accent)";
                  (e.currentTarget as HTMLElement).style.color = "var(--accent)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
                  (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)";
                }}
              >
                {preset.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setTickers([])}
              className="text-xs px-3 py-1.5 rounded transition-colors font-medium tracking-wide"
              style={{
                backgroundColor: "var(--bg-page)",
                color: "var(--text-secondary)",
                border: "1px solid var(--border)",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = "var(--text-error)";
                (e.currentTarget as HTMLElement).style.color = "var(--text-error)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
                (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)";
              }}
            >
              Clear all
            </button>
          </div>
        </div>

        {/* Tickers input */}
        <div className="mb-5">
          <label
            className="block text-xs font-semibold tracking-widest uppercase mb-2"
            style={{ color: "var(--text-secondary)" }}
          >
            Tickers
            <span
              className="ml-2 normal-case font-normal tracking-normal"
              style={{ color: "var(--text-secondary)" }}
            >
              — type and press Enter or comma &nbsp;·&nbsp; use{" "}
              <span style={{ color: "var(--accent)" }}>^GSPC</span>,{" "}
              <span style={{ color: "var(--accent)" }}>GC=F</span> for indices/futures
            </span>
          </label>

          <div className="relative">
            <div
              className="flex flex-wrap gap-1.5 items-center min-h-[44px] px-3 py-2 rounded-lg border transition-colors cursor-text"
              style={{
                backgroundColor: "var(--bg-input)",
                borderColor: "var(--border)",
              }}
              onClick={() => inputRef.current?.focus()}
            >
              {tickers.map((t) => (
                <TickerChip key={t} ticker={t} onRemove={() => removeTicker(t)} />
              ))}
              <div className="flex items-center flex-1 min-w-[120px]">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputVal}
                  onChange={(e) => {
                    setInputVal(e.target.value);
                    setShowSuggestions(e.target.value.length > 0);
                  }}
                  onKeyDown={handleKeyDown}
                  onFocus={() => setShowSuggestions(inputVal.length > 0)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                  placeholder={tickers.length === 0 ? "AAPL, ^GSPC, GC=F…" : "Add ticker…"}
                  className="bg-transparent outline-none text-sm flex-1 placeholder:opacity-30"
                  style={{ color: "var(--text-primary)" }}
                  spellCheck={false}
                  autoComplete="off"
                />
                {inputVal && (
                  <button
                    type="button"
                    onClick={() => addTicker(inputVal)}
                    className="flex items-center gap-1 text-xs px-2 py-0.5 rounded ml-1 transition-colors"
                    style={{ color: "var(--accent)" }}
                  >
                    <Plus size={12} />
                    Add
                  </button>
                )}
              </div>
            </div>

            {/* Autocomplete suggestions */}
            {showSuggestions && suggestions.length > 0 && (
              <div
                className="absolute z-10 mt-1 w-full rounded-lg border shadow-lg overflow-hidden"
                style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border)" }}
              >
                {suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onMouseDown={() => addTicker(s)}
                    className="flex w-full items-center px-4 py-2 text-sm text-left transition-colors"
                    style={{ color: "var(--text-primary)" }}
                    onMouseEnter={(e) =>
                      ((e.currentTarget as HTMLElement).style.backgroundColor =
                        "var(--bg-hover)")
                    }
                    onMouseLeave={(e) =>
                      ((e.currentTarget as HTMLElement).style.backgroundColor = "")
                    }
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="mt-1.5 text-xs" style={{ color: "var(--text-secondary)" }}>
            {tickers.length === 0
              ? "No tickers added"
              : `${tickers.length} ticker${tickers.length > 1 ? "s" : ""} queued`}
          </div>
        </div>

        {/* Date input */}
        <div className="mb-6">
          <label
            className="block text-xs font-semibold tracking-widest uppercase mb-2"
            style={{ color: "var(--text-secondary)" }}
          >
            Date
            <span
              className="ml-2 normal-case font-normal tracking-normal"
              style={{ color: "var(--text-secondary)" }}
            >
              — returns the EOD close for the last trading session on or before this date
            </span>
          </label>
          <div className="flex items-center gap-2">
            <div className="relative flex-1 max-w-xs">
              <Clock
                size={13}
                className="absolute left-3 top-1/2 -translate-y-1/2"
                style={{ color: "var(--text-secondary)" }}
              />
              <input
                type="text"
                value={dateStr}
                onChange={(e) => {
                  setDateStr(e.target.value);
                  setDateError(null);
                }}
                placeholder="YYYY-MM-DD"
                className="w-full pl-8 pr-3 py-2.5 rounded-lg border text-sm outline-none transition-colors"
                style={{
                  backgroundColor: "var(--bg-input)",
                  borderColor: dateError ? "var(--text-error)" : "var(--border)",
                  color: "var(--text-primary)",
                }}
                onFocus={(e) =>
                  ((e.currentTarget as HTMLElement).style.borderColor =
                    "var(--border-focus)")
                }
                onBlur={(e) =>
                  ((e.currentTarget as HTMLElement).style.borderColor = dateError
                    ? "var(--text-error)"
                    : "var(--border)")
                }
                spellCheck={false}
              />
            </div>
            <button
              type="button"
              onClick={() => setDateStr(getLastTradingDay())}
              className="text-xs px-3 py-2.5 rounded-lg transition-colors"
              style={{
                backgroundColor: "var(--bg-page)",
                border: "1px solid var(--border)",
                color: "var(--text-secondary)",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.color = "var(--text-primary)";
                (e.currentTarget as HTMLElement).style.borderColor = "var(--accent)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)";
                (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
              }}
            >
              Last Trading Day
            </button>
          </div>
          {dateError && (
            <p className="mt-1.5 text-xs" style={{ color: "var(--text-error)" }}>
              {dateError}
            </p>
          )}

          {/* Date rationale disclaimer */}
          {(() => {
            const now = new Date();
            const utcHour = now.getUTCHours();
            const utcMinute = now.getUTCMinutes();
            const todaySessionClosed = utcHour > 21 || (utcHour === 21 && utcMinute >= 30);
            const nowUtcStr = `${String(utcHour).padStart(2, "0")}:${String(utcMinute).padStart(2, "0")} UTC`;
            return (
              <div
                className="mt-3 flex items-start gap-2.5 rounded-lg px-3.5 py-2.5 text-xs"
                style={{
                  backgroundColor: "rgba(226,183,20,0.06)",
                  border: "1px solid rgba(226,183,20,0.15)",
                }}
              >
                <span className="mt-px shrink-0 text-[10px]" style={{ color: "var(--accent)" }}>◈</span>
                <span style={{ color: "var(--text-secondary)", lineHeight: "1.6" }}>
                  <span style={{ color: "var(--accent)", fontWeight: 600 }}>
                    {todaySessionClosed ? "Today's session concluded." : "Today's session still open."}
                  </span>
                  {" "}US markets close at{" "}
                  <span style={{ color: "var(--text-primary)" }}>21:00 UTC</span>
                  {" "}(4 pm ET). It is currently{" "}
                  <span style={{ color: "var(--text-primary)" }}>{nowUtcStr}</span>
                  {todaySessionClosed
                    ? " — today's data is available. Defaulting to today."
                    : " — yesterday's session was the last to conclude. Defaulting to yesterday."}
                </span>
              </div>
            );
          })()}
        </div>

        {/* Fetch button */}
        <button
          type="button"
          onClick={handleFetch}
          disabled={loading || tickers.length === 0}
          className={clsx(
            "flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold tracking-wide transition-all",
            loading || tickers.length === 0
              ? "opacity-40 cursor-not-allowed"
              : "cursor-pointer"
          )}
          style={{
            backgroundColor: "var(--accent)",
            color: "var(--bg-page)",
          }}
          onMouseEnter={(e) => {
            if (!loading && tickers.length > 0)
              (e.currentTarget as HTMLElement).style.backgroundColor = "var(--accent-dim)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.backgroundColor = "var(--accent)";
          }}
        >
          {loading ? (
            <>
              <Loader2 size={15} className="animate-spin" />
              Fetching {tickers.length} ticker{tickers.length > 1 ? "s" : ""}…
            </>
          ) : (
            <>
              <Search size={15} />
              Fetch Closing Prices
            </>
          )}
        </button>
      </div>

      {/* Fetch-level error */}
      {fetchError && (
        <div
          className="flex items-start gap-3 rounded-xl border px-5 py-4 mb-6 text-sm"
          style={{
            backgroundColor: "rgba(202,71,84,0.08)",
            borderColor: "rgba(202,71,84,0.3)",
            color: "var(--text-error)",
          }}
        >
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold mb-0.5">Request failed</div>
            <div className="opacity-80">{fetchError}</div>
          </div>
        </div>
      )}

      {/* Results */}
      {results && (
        <div>
          {/* Summary bar */}
          <div className="flex items-center gap-4 mb-4 text-sm">
            <span style={{ color: "var(--text-secondary)" }}>
              {results.length} result{results.length !== 1 ? "s" : ""}
            </span>
            {successResults.length > 0 && (
              <span style={{ color: "var(--accent)" }}>{successResults.length} ok</span>
            )}
            {errorResults.length > 0 && (
              <span style={{ color: "var(--text-error)" }}>
                {errorResults.length} error{errorResults.length > 1 ? "s" : ""}
              </span>
            )}
          </div>

          {/* Success table */}
          {successResults.length > 0 && (
            <div
              className="rounded-xl border overflow-hidden mb-4"
              style={{ borderColor: "var(--border)" }}
            >
              <table className="w-full text-sm">
                <thead>
                  <tr
                    style={{
                      backgroundColor: "var(--bg-card)",
                      borderBottom: "1px solid var(--border)",
                    }}
                  >
                    {[
                      "Ticker",
                      "Name",
                      "Date",
                      "Close",
                      "Open",
                      "High",
                      "Low",
                      "Volume",
                      "Exchange",
                      "",
                    ].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-3 text-left text-[11px] font-semibold tracking-widest uppercase"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {successResults.map((r, i) => {
                    const isExpanded = expandedRaw.has(r.ticker);
                    return (
                      <React.Fragment key={r.ticker}>
                        <tr
                          style={{
                            backgroundColor:
                              i % 2 === 0 ? "var(--bg-page)" : "var(--bg-card)",
                            borderBottom: isExpanded
                              ? "none"
                              : "1px solid var(--border)",
                          }}
                        >
                          <td
                            className="px-4 py-3 font-semibold"
                            style={{ color: "var(--accent)" }}
                          >
                            {r.ticker}
                          </td>
                          <td
                            className="px-4 py-3 text-xs max-w-[160px] truncate"
                            style={{ color: "var(--text-secondary)" }}
                            title={r.label}
                          >
                            {r.label}
                          </td>
                          <td
                            className="px-4 py-3 tabular-nums text-xs"
                            style={{ color: "var(--text-secondary)" }}
                          >
                            {r.date}
                          </td>
                          <td
                            className="px-4 py-3 font-semibold tabular-nums"
                            style={{ color: "var(--text-primary)" }}
                          >
                            {formatPrice(r.close_price, r.currency)}
                          </td>
                          <td
                            className="px-4 py-3 tabular-nums"
                            style={{ color: "var(--text-secondary)" }}
                          >
                            {formatPrice(r.open_price, r.currency)}
                          </td>
                          <td
                            className="px-4 py-3 tabular-nums"
                            style={{ color: "#4caf7d" }}
                          >
                            {formatPrice(r.high_price, r.currency)}
                          </td>
                          <td
                            className="px-4 py-3 tabular-nums"
                            style={{ color: "var(--text-error)" }}
                          >
                            {formatPrice(r.low_price, r.currency)}
                          </td>
                          <td
                            className="px-4 py-3 tabular-nums"
                            style={{ color: "var(--text-secondary)" }}
                          >
                            {formatVolume(r.volume)}
                          </td>
                          <td
                            className="px-4 py-3 text-xs"
                            style={{ color: "var(--text-secondary)" }}
                          >
                            {r.exchange}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <a
                                href={r.query_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Open Yahoo Finance API URL"
                                className="opacity-40 hover:opacity-100 transition-opacity"
                                style={{ color: "var(--text-primary)" }}
                              >
                                <ExternalLink size={13} />
                              </a>
                              <button
                                type="button"
                                onClick={() => toggleRaw(r.ticker)}
                                title="Toggle raw response"
                                className="opacity-40 hover:opacity-100 transition-opacity"
                                style={{ color: "var(--text-primary)" }}
                              >
                                {isExpanded ? (
                                  <ChevronUp size={13} />
                                ) : (
                                  <ChevronDown size={13} />
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>

                        {/* Expanded raw row */}
                        {isExpanded && (
                          <tr
                            key={`${r.ticker}-raw`}
                            style={{
                              backgroundColor:
                                i % 2 === 0 ? "var(--bg-page)" : "var(--bg-card)",
                              borderBottom: "1px solid var(--border)",
                            }}
                          >
                            <td colSpan={10} className="px-4 pb-3">
                              <div
                                className="rounded-lg p-3 text-xs font-mono overflow-x-auto"
                                style={{
                                  backgroundColor: "var(--bg-sidebar)",
                                  color: "var(--text-secondary)",
                                  border: "1px solid var(--border)",
                                }}
                              >
                                <div
                                  className="mb-1.5 text-[10px] uppercase tracking-widest font-semibold"
                                  style={{ color: "var(--accent)" }}
                                >
                                  Query URL
                                </div>
                                <div
                                  className="break-all mb-3"
                                  style={{ color: "var(--text-primary)" }}
                                >
                                  {r.query_url}
                                </div>
                                <div
                                  className="mb-1.5 text-[10px] uppercase tracking-widest font-semibold"
                                  style={{ color: "var(--accent)" }}
                                >
                                  Result
                                </div>
                                <div
                                  className="mt-1 break-all"
                                  style={{ color: "var(--text-primary)" }}
                                >
                                  {JSON.stringify(r, null, 2)}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Errors */}
          {errorResults.length > 0 && (
            <div className="space-y-2">
              {errorResults.map((r) => (
                <div
                  key={r.ticker}
                  className="flex items-start gap-3 rounded-xl border px-4 py-3 text-sm"
                  style={{
                    backgroundColor: "rgba(202,71,84,0.06)",
                    borderColor: "rgba(202,71,84,0.25)",
                  }}
                >
                  <AlertCircle
                    size={15}
                    className="shrink-0 mt-0.5"
                    style={{ color: "var(--text-error)" }}
                  />
                  <div>
                    <span
                      className="font-semibold"
                      style={{ color: "var(--accent)" }}
                    >
                      {r.ticker}
                    </span>
                    <span className="ml-2" style={{ color: "var(--text-error)" }}>
                      {r.error}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {!results && !loading && (
        <div
          className="rounded-xl border px-6 py-10 text-center"
          style={{ borderColor: "var(--border)", borderStyle: "dashed" }}
        >
          <Search
            size={28}
            className="mx-auto mb-3 opacity-20"
            style={{ color: "var(--text-primary)" }}
          />
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Configure tickers and date above, then click{" "}
            <span style={{ color: "var(--accent)" }}>Fetch Closing Prices</span>.
          </p>
          <p className="text-xs mt-2" style={{ color: "var(--text-secondary)" }}>
            Supports stocks, ETFs, indices (
            <span style={{ color: "var(--accent)" }}>^GSPC</span>), and futures (
            <span style={{ color: "var(--accent)" }}>GC=F</span>).
          </p>
        </div>
      )}
    </div>
  );
}
