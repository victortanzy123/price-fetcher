import { BinanceFetcher } from "@/components/BinanceFetcher";

export const metadata = {
  title: "Binance | PriceFetcher",
  description: "Fetch 1m OHLC kline close prices from Binance",
};

export default function BinancePage() {
  return <BinanceFetcher />;
}
