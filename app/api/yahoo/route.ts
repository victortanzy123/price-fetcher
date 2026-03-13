import { NextRequest, NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";

// Singleton instance — reuses cookie/crumb across requests within the same
// server process, which avoids redundant auth round-trips.
const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

// ─── Types ────────────────────────────────────────────────────────────────────

export interface YahooResult {
  ticker: string;
  label: string;
  date: string;        // YYYY-MM-DD of the trading session returned
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

export interface YahooError {
  ticker: string;
  date: string;
  error: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toDateStr(d: Date): string {
  return (
    d.getUTCFullYear() +
    "-" +
    String(d.getUTCMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getUTCDate()).padStart(2, "0")
  );
}

// ─── Core fetch (single ticker) ───────────────────────────────────────────────

async function fetchYahooClose(
  ticker: string,
  dateStr: string  // YYYY-MM-DD
): Promise<YahooResult> {
  // Fetch a window of up to 7 days ending on dateStr so we always capture
  // the most recent trading session on or before the requested date, even
  // when it falls on a weekend or public holiday.
  const period2 = new Date(dateStr + "T23:59:59Z");
  const period1 = new Date(period2);
  period1.setUTCDate(period1.getUTCDate() - 7);

  const result = await yf.chart(ticker, {
    period1,
    period2,
    interval: "1d",
  });

  const quotes = result.quotes ?? [];
  if (quotes.length === 0) {
    throw new Error(`No trading sessions found for "${ticker}" around ${dateStr}`);
  }

  // Pick the last quote whose date is on or before the requested date
  const cutoff = new Date(dateStr + "T23:59:59Z").getTime();
  let best = quotes[0];
  for (const q of quotes) {
    if (q.date.getTime() <= cutoff) best = q;
  }

  if (best.close === null || best.close === undefined) {
    throw new Error(`Close price is null for "${ticker}" on ${toDateStr(best.date)}`);
  }

  const meta = result.meta;

  // Reconstruct a human-readable URL for reference
  const queryUrl =
    `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}` +
    `?interval=1d&period1=${Math.floor(period1.getTime() / 1000)}&period2=${Math.floor(period2.getTime() / 1000)}`;

  return {
    ticker: meta.symbol,
    label: meta.longName || meta.shortName || meta.symbol,
    date: toDateStr(best.date),
    close_price: best.close,
    open_price: best.open ?? 0,
    high_price: best.high ?? 0,
    low_price: best.low ?? 0,
    volume: best.volume ?? 0,
    currency: meta.currency,
    exchange: meta.fullExchangeName || meta.exchangeName,
    timezone: meta.timezone,
    query_url: queryUrl,
  };
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tickers, date } = body as {
      tickers: string[];
      date: string;
    };

    if (!Array.isArray(tickers) || tickers.length === 0) {
      return NextResponse.json(
        { error: "tickers must be a non-empty array" },
        { status: 400 }
      );
    }

    if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json(
        { error: "date must be a string in YYYY-MM-DD format" },
        { status: 400 }
      );
    }

    // Fetch all tickers concurrently — yahoo-finance2 handles crumb/session
    const settled = await Promise.allSettled(
      tickers.map((t) => fetchYahooClose(t.trim(), date))
    );

    const out: (YahooResult | YahooError)[] = settled.map((r, i) => {
      if (r.status === "fulfilled") return r.value;
      return {
        ticker: tickers[i].trim().toUpperCase(),
        date,
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
