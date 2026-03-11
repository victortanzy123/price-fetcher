import { ComingSoon } from "@/components/ComingSoon";
import { TrendingUp } from "lucide-react";

export const metadata = {
  title: "Yahoo Finance | PriceFetcher",
};

export default function YahooPage() {
  return (
    <ComingSoon
      title="Yahoo Finance"
      description="Pull historical and end-of-day closing prices for stocks, ETFs, indices, and more via the Yahoo Finance API."
      icon={TrendingUp}
      features={[
        "End-of-day close price for any ticker",
        "Configurable date range",
        "Batch fetch multiple tickers at once",
        "Export results to CSV",
      ]}
    />
  );
}
