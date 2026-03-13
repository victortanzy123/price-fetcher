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
  BarChart2,
} from "lucide-react";
import clsx from "clsx";

// ─── Types ────────────────────────────────────────────────────────

interface KlineResult {
  symbol: string;
  interval: string;
  resolution_candle_open_utc: string;
  startTime_ms: number;
  endTime_ms: number;
  kline_open_time_ms: number;
  kline_close_time_ms: number;
  close_price: number;
  open_price: number;
  high_price: number;
  low_price: number;
  volume: string;
  query_url: string;
}

interface KlineError {
  symbol: string;
  timestamp_end_seconds: number;
  error: string;
}

type Result = KlineResult | KlineError;

function isError(r: Result): r is KlineError {
  return "error" in r;
}

// ─── Presets ──────────────────────────────────────────────────────

const PRESET_PAIRS: { label: string; pairs: string[] }[] = [
  {
    label: "Top 4",
    pairs: ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT"],
  },
  {
    label: "Majors",
    pairs: ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT", "ADAUSDT"],
  },
  {
    label: "DeFi",
    pairs: ["UNIUSDT", "AAVEUSDT", "LINKUSDT", "CRVUSDT", "MKRUSDT"],
  },
  {
    label: "Layer 1",
    pairs: ["AVAXUSDT", "DOTUSDT", "ATOMUSDT", "NEARUSDT", "FTMUSDT"],
  },
];

const POPULAR_PAIRS = [
  "BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT",
  "ADAUSDT", "DOGEUSDT", "MATICUSDT", "AVAXUSDT", "LINKUSDT",
  "UNIUSDT", "AAVEUSDT", "DOTUSDT", "ATOMUSDT", "LTCUSDT",
  "NEARUSDT", "CRVUSDT", "MKRUSDT", "FTMUSDT", "ARBUSDT",
];

// ─── Helpers ──────────────────────────────────────────────────────

function getLastTradingDayUtc(): string {
  const now = new Date();
  const d = new Date(now);
  // The 23:59 UTC candle closes at 23:59:59 UTC. It's available from 00:00 UTC the next day.
  // In the first minute past midnight (00:00 UTC) go back 2 days to be safe; otherwise 1 day.
  const daysBack = now.getUTCHours() === 0 && now.getUTCMinutes() === 0 ? 2 : 1;
  d.setUTCDate(d.getUTCDate() - daysBack);
  // Skip back past Sunday (0) and Saturday (6)
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) {
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return (
    d.getUTCFullYear() +
    "-" +
    String(d.getUTCMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getUTCDate()).padStart(2, "0") +
    " 23:59:00"
  );
}

function parseDtString(s: string): number | null {
  // Try ISO 8601 (handles Z suffix)
  try {
    const cleaned = s.trim().replace("Z", "+00:00");
    const dt = new Date(cleaned);
    if (!isNaN(dt.getTime())) {
      return Math.floor(dt.getTime() / 1000);
    }
  } catch {
    /* ignore */
  }
  // Fallback: assume UTC if no tz info
  const withZ = s.trim().replace(/\s/, "T") + (s.includes("+") || s.includes("Z") ? "" : "Z");
  const dt2 = new Date(withZ);
  if (!isNaN(dt2.getTime())) return Math.floor(dt2.getTime() / 1000);
  return null;
}

function formatPrice(n: number): string {
  if (n >= 10_000) return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (n >= 1) return n.toFixed(4);
  return n.toFixed(6);
}

function formatVolume(v: string): string {
  const n = parseFloat(v);
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(2) + "K";
  return n.toFixed(2);
}

function formatCandleTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toISOString().replace("T", " ").slice(0, 19) + " UTC";
  } catch {
    return iso;
  }
}

// ─── Sub-components ───────────────────────────────────────────────

function PairChip({
  pair,
  onRemove,
}: {
  pair: string;
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
      {pair}
      <button
        onClick={onRemove}
        className="opacity-60 hover:opacity-100 transition-opacity rounded"
        aria-label={`Remove ${pair}`}
        type="button"
      >
        <X size={11} />
      </button>
    </span>
  );
}

function StatusBadge({ result }: { result: Result }) {
  if (isError(result)) {
    return (
      <span
        className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded"
        style={{ backgroundColor: "rgba(202,71,84,0.15)", color: "var(--text-error)" }}
      >
        <AlertCircle size={11} /> error
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded"
      style={{ backgroundColor: "rgba(226,183,20,0.12)", color: "var(--accent)" }}
    >
      <CheckCircle2 size={11} /> ok
    </span>
  );
}

// ─── Main Component ───────────────────────────────────────────────

export function BinanceFetcher() {
  const [pairs, setPairs] = useState<string[]>(["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT"]);
  const [inputVal, setInputVal] = useState("");
  const [dtStr, setDtStr] = useState(getLastTradingDayUtc());
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Result[] | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [expandedRaw, setExpandedRaw] = useState<Set<string>>(new Set());
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [dtError, setDtError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Pair management ────────────────────────────────────────────

  const addPair = useCallback(
    (raw: string) => {
      const p = raw.trim().toUpperCase();
      if (!p) return;
      if (pairs.includes(p)) return;
      setPairs((prev) => [...prev, p]);
      setInputVal("");
      setShowSuggestions(false);
    },
    [pairs]
  );

  const removePair = useCallback((p: string) => {
    setPairs((prev) => prev.filter((x) => x !== p));
  }, []);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addPair(inputVal);
    }
    if (e.key === "Backspace" && inputVal === "" && pairs.length > 0) {
      setPairs((prev) => prev.slice(0, -1));
    }
    if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  };

  const applyPreset = (preset: { pairs: string[] }) => {
    setPairs(preset.pairs);
  };

  const suggestions = POPULAR_PAIRS.filter(
    (p) => p.includes(inputVal.toUpperCase()) && !pairs.includes(p)
  ).slice(0, 8);

  // ── Fetch ──────────────────────────────────────────────────────

  const handleFetch = async () => {
    if (pairs.length === 0) return;
    setDtError(null);
    const ts = parseDtString(dtStr);
    if (ts === null) {
      setDtError("Could not parse datetime. Use format: YYYY-MM-DD HH:MM:SS");
      return;
    }

    setLoading(true);
    setFetchError(null);
    setResults(null);
    setExpandedRaw(new Set());

    try {
      const res = await fetch("/api/binance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbols: pairs,
          timestamp_end_seconds: ts,
        }),
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

  const toggleRaw = (symbol: string) => {
    setExpandedRaw((prev) => {
      const next = new Set(prev);
      if (next.has(symbol)) next.delete(symbol);
      else next.add(symbol);
      return next;
    });
  };

  // ── Derived ────────────────────────────────────────────────────

  const successResults = results?.filter((r): r is KlineResult => !isError(r)) ?? [];
  const errorResults = results?.filter((r): r is KlineError => isError(r)) ?? [];

  // ── Render ─────────────────────────────────────────────────────

  return (
    <div className="min-h-full px-8 py-8 max-w-5xl mx-auto">
      {/* Page header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <BarChart2 size={22} style={{ color: "var(--accent)" }} />
          <h1 className="text-xl font-semibold tracking-wide" style={{ color: "var(--text-primary)" }}>
            Binance Resolution Evidence
          </h1>
        </div>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          Fetches the{" "}
          <span style={{ color: "var(--accent)" }}>23:59 UTC 1m candle</span>
          {" "}close price for each symbol on a given date — used for market resolution.
        </p>
      </div>

      {/* Card */}
      <div
        className="rounded-xl border p-6 mb-6"
        style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border)" }}
      >
        {/* Presets */}
        <div className="mb-5">
          <label className="block text-xs font-semibold tracking-widest uppercase mb-2" style={{ color: "var(--text-secondary)" }}>
            Presets
          </label>
          <div className="flex flex-wrap gap-2">
            {PRESET_PAIRS.map((preset) => (
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
              onClick={() => setPairs([])}
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

        {/* Pairs input */}
        <div className="mb-5">
          <label className="block text-xs font-semibold tracking-widest uppercase mb-2" style={{ color: "var(--text-secondary)" }}>
            Trading Pairs
            <span className="ml-2 normal-case font-normal tracking-normal" style={{ color: "var(--text-secondary)" }}>
              — type and press Enter or comma
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
              {pairs.map((p) => (
                <PairChip key={p} pair={p} onRemove={() => removePair(p)} />
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
                  placeholder={pairs.length === 0 ? "BTCUSDT, ETHUSDT…" : "Add pair…"}
                  className="bg-transparent outline-none text-sm flex-1 placeholder:opacity-30"
                  style={{ color: "var(--text-primary)" }}
                  spellCheck={false}
                  autoComplete="off"
                />
                {inputVal && (
                  <button
                    type="button"
                    onClick={() => addPair(inputVal)}
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
                    onMouseDown={() => addPair(s)}
                    className="flex w-full items-center px-4 py-2 text-sm text-left transition-colors"
                    style={{ color: "var(--text-primary)" }}
                    onMouseEnter={(e) =>
                      ((e.currentTarget as HTMLElement).style.backgroundColor = "var(--bg-hover)")
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

          {/* Pair count */}
          <div className="mt-1.5 text-xs" style={{ color: "var(--text-secondary)" }}>
            {pairs.length === 0
              ? "No pairs added"
              : `${pairs.length} pair${pairs.length > 1 ? "s" : ""} queued`}
          </div>
        </div>

        {/* Datetime input */}
        <div className="mb-6">
          <label className="block text-xs font-semibold tracking-widest uppercase mb-2" style={{ color: "var(--text-secondary)" }}>
            Market End Datetime
            <span className="ml-2 normal-case font-normal tracking-normal" style={{ color: "var(--text-secondary)" }}>
              — UTC
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
                value={dtStr}
                onChange={(e) => {
                  setDtStr(e.target.value);
                  setDtError(null);
                }}
                placeholder="YYYY-MM-DD HH:MM:SS"
                className="w-full pl-8 pr-3 py-2.5 rounded-lg border text-sm outline-none transition-colors"
                style={{
                  backgroundColor: "var(--bg-input)",
                  borderColor: dtError ? "var(--text-error)" : "var(--border)",
                  color: "var(--text-primary)",
                }}
                onFocus={(e) =>
                  ((e.currentTarget as HTMLElement).style.borderColor = "var(--border-focus)")
                }
                onBlur={(e) =>
                  ((e.currentTarget as HTMLElement).style.borderColor = dtError
                    ? "var(--text-error)"
                    : "var(--border)")
                }
                spellCheck={false}
              />
            </div>
            <button
              type="button"
              onClick={() => setDtStr(getLastTradingDayUtc())}
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
          {dtError && (
            <p className="mt-1.5 text-xs" style={{ color: "var(--text-error)" }}>
              {dtError}
            </p>
          )}
          <p className="mt-1.5 text-xs" style={{ color: "var(--text-secondary)" }}>
            Candle fetched: 23:59:00 → 23:59:59 UTC on that date
          </p>
        </div>

        {/* Fetch button */}
        <button
          type="button"
          onClick={handleFetch}
          disabled={loading || pairs.length === 0}
          className={clsx(
            "flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold tracking-wide transition-all",
            loading || pairs.length === 0 ? "opacity-40 cursor-not-allowed" : "cursor-pointer"
          )}
          style={{
            backgroundColor: "var(--accent)",
            color: "var(--bg-page)",
          }}
          onMouseEnter={(e) => {
            if (!loading && pairs.length > 0)
              (e.currentTarget as HTMLElement).style.backgroundColor = "var(--accent-dim)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.backgroundColor = "var(--accent)";
          }}
        >
          {loading ? (
            <>
              <Loader2 size={15} className="animate-spin" />
              Fetching {pairs.length} pair{pairs.length > 1 ? "s" : ""}…
            </>
          ) : (
            <>
              <Search size={15} />
              Fetch Resolution Evidence
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
              <span style={{ color: "var(--accent)" }}>
                {successResults.length} ok
              </span>
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
                  <tr style={{ backgroundColor: "var(--bg-card)", borderBottom: "1px solid var(--border)" }}>
                    {["Symbol", "Close Price", "Open", "High", "Low", "Volume", "Candle Open UTC", ""].map(
                      (h) => (
                        <th
                          key={h}
                          className="px-4 py-3 text-left text-[11px] font-semibold tracking-widest uppercase"
                          style={{ color: "var(--text-secondary)" }}
                        >
                          {h}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody>
                  {successResults.map((r, i) => {
                    const isExpanded = expandedRaw.has(r.symbol);
                    return (
                      <React.Fragment key={r.symbol}>
                        <tr
                          style={{
                            backgroundColor: i % 2 === 0 ? "var(--bg-page)" : "var(--bg-card)",
                            borderBottom: isExpanded ? "none" : "1px solid var(--border)",
                          }}
                        >
                          <td className="px-4 py-3 font-semibold" style={{ color: "var(--accent)" }}>
                            {r.symbol}
                          </td>
                          <td className="px-4 py-3 font-semibold tabular-nums" style={{ color: "var(--text-primary)" }}>
                            ${formatPrice(r.close_price)}
                          </td>
                          <td className="px-4 py-3 tabular-nums" style={{ color: "var(--text-secondary)" }}>
                            ${formatPrice(r.open_price)}
                          </td>
                          <td className="px-4 py-3 tabular-nums" style={{ color: "#4caf7d" }}>
                            ${formatPrice(r.high_price)}
                          </td>
                          <td className="px-4 py-3 tabular-nums" style={{ color: "var(--text-error)" }}>
                            ${formatPrice(r.low_price)}
                          </td>
                          <td className="px-4 py-3 tabular-nums" style={{ color: "var(--text-secondary)" }}>
                            {formatVolume(r.volume)}
                          </td>
                          <td className="px-4 py-3 tabular-nums text-xs" style={{ color: "var(--text-secondary)" }}>
                            {formatCandleTime(r.resolution_candle_open_utc)}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <a
                                href={r.query_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Open query URL"
                                className="opacity-40 hover:opacity-100 transition-opacity"
                                style={{ color: "var(--text-primary)" }}
                              >
                                <ExternalLink size={13} />
                              </a>
                              <button
                                type="button"
                                onClick={() => toggleRaw(r.symbol)}
                                title="Toggle raw payload"
                                className="opacity-40 hover:opacity-100 transition-opacity"
                                style={{ color: "var(--text-primary)" }}
                              >
                                {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                              </button>
                            </div>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr
                            key={`${r.symbol}-raw`}
                            style={{
                              backgroundColor: i % 2 === 0 ? "var(--bg-page)" : "var(--bg-card)",
                              borderBottom: "1px solid var(--border)",
                            }}
                          >
                            <td colSpan={8} className="px-4 pb-3">
                              <div
                                className="rounded-lg p-3 text-xs font-mono overflow-x-auto"
                                style={{
                                  backgroundColor: "var(--bg-sidebar)",
                                  color: "var(--text-secondary)",
                                  border: "1px solid var(--border)",
                                }}
                              >
                                <div className="mb-1.5 text-[10px] uppercase tracking-widest font-semibold" style={{ color: "var(--accent)" }}>
                                  Query URL
                                </div>
                                <div className="break-all mb-3" style={{ color: "var(--text-primary)" }}>
                                  {r.query_url}
                                </div>
                                <div className="mb-1.5 text-[10px] uppercase tracking-widest font-semibold" style={{ color: "var(--accent)" }}>
                                  Raw Kline
                                </div>
                                <div style={{ color: "var(--text-primary)" }}>
                                  [open_time, open, high, low, <strong style={{ color: "var(--accent)" }}>close</strong>, volume, close_time, ...]
                                </div>
                                <div className="mt-1 break-all">{JSON.stringify((r as unknown as { raw: unknown[] }).raw)}</div>
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
                  key={r.symbol}
                  className="flex items-start gap-3 rounded-xl border px-4 py-3 text-sm"
                  style={{
                    backgroundColor: "rgba(202,71,84,0.06)",
                    borderColor: "rgba(202,71,84,0.25)",
                  }}
                >
                  <AlertCircle size={15} className="shrink-0 mt-0.5" style={{ color: "var(--text-error)" }} />
                  <div>
                    <span className="font-semibold" style={{ color: "var(--accent)" }}>
                      {r.symbol}
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
          <Search size={28} className="mx-auto mb-3 opacity-20" style={{ color: "var(--text-primary)" }} />
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Configure pairs and datetime above, then click{" "}
            <span style={{ color: "var(--accent)" }}>Fetch Resolution Evidence</span>.
          </p>
        </div>
      )}
    </div>
  );
}
