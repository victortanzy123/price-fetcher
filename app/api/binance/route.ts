import { NextRequest, NextResponse } from "next/server";

const BINANCE_KLINES_URL = "https://data-api.binance.vision/api/v3/klines";

export interface KlineResult {
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
  raw: unknown[];
}

export interface KlineError {
  symbol: string;
  timestamp_end_seconds: number;
  error: string;
}

function dtToMs(dt: Date): number {
  return dt.getTime();
}

function resolutionWindow(timestampEndSeconds: number): {
  startMs: number;
  endMs: number;
  candleOpenDt: Date;
} {
  const endDt = new Date(timestampEndSeconds * 1000);
  // Build the 23:59 UTC candle for that date
  const candleOpen = new Date(
    Date.UTC(
      endDt.getUTCFullYear(),
      endDt.getUTCMonth(),
      endDt.getUTCDate(),
      23,
      59,
      0,
      0
    )
  );
  const candleClose = new Date(
    Date.UTC(
      endDt.getUTCFullYear(),
      endDt.getUTCMonth(),
      endDt.getUTCDate(),
      23,
      59,
      59,
      999
    )
  );
  return {
    startMs: dtToMs(candleOpen),
    endMs: dtToMs(candleClose),
    candleOpenDt: candleOpen,
  };
}

async function fetchKline(
  symbol: string,
  timestampEndSeconds: number
): Promise<KlineResult> {
  const { startMs, endMs, candleOpenDt } = resolutionWindow(timestampEndSeconds);

  const params = new URLSearchParams({
    symbol,
    interval: "1m",
    startTime: String(startMs),
    endTime: String(endMs),
    limit: "1",
  });

  const url = `${BINANCE_KLINES_URL}?${params.toString()}`;
  const res = await fetch(url, {
    next: { revalidate: 0 },
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Binance HTTP ${res.status}: ${body}`);
  }

  const data: unknown[][] = await res.json();

  if (!Array.isArray(data) || data.length === 0) {
    throw new Error(
      `No kline returned for symbol=${symbol} startTime=${startMs} endTime=${endMs}`
    );
  }

  const k = data[0];
  // [open_time, open, high, low, close, volume, close_time, ...]
  return {
    symbol,
    interval: "1m",
    resolution_candle_open_utc: candleOpenDt.toISOString(),
    startTime_ms: startMs,
    endTime_ms: endMs,
    kline_open_time_ms: Number(k[0]),
    kline_close_time_ms: Number(k[6]),
    open_price: parseFloat(String(k[1])),
    high_price: parseFloat(String(k[2])),
    low_price: parseFloat(String(k[3])),
    close_price: parseFloat(String(k[4])),
    volume: String(k[5]),
    query_url: url,
    raw: k,
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { symbols, timestamp_end_seconds } = body as {
      symbols: string[];
      timestamp_end_seconds: number;
    };

    if (!Array.isArray(symbols) || symbols.length === 0) {
      return NextResponse.json(
        { error: "symbols must be a non-empty array" },
        { status: 400 }
      );
    }
    if (typeof timestamp_end_seconds !== "number") {
      return NextResponse.json(
        { error: "timestamp_end_seconds must be a number" },
        { status: 400 }
      );
    }

    const results = await Promise.allSettled(
      symbols.map((sym) => fetchKline(sym.toUpperCase(), timestamp_end_seconds))
    );

    const out: (KlineResult | KlineError)[] = results.map((r, i) => {
      if (r.status === "fulfilled") return r.value;
      return {
        symbol: symbols[i].toUpperCase(),
        timestamp_end_seconds,
        error: r.reason instanceof Error ? r.reason.message : String(r.reason),
      };
    });

    return NextResponse.json(out);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
