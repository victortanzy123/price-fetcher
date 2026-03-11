import { ComingSoon } from "@/components/ComingSoon";
import { DollarSign } from "lucide-react";

export const metadata = {
  title: "Forex | PriceFetcher",
};

export default function ForexPage() {
  return (
    <ComingSoon
      title="Forex"
      description="Fetch spot FX rates for major and minor currency pairs from public foreign exchange data providers."
      icon={DollarSign}
      features={[
        "Spot rates for major currency pairs",
        "Historical daily close rates",
        "Configurable base currency",
        "Batch multi-pair queries",
      ]}
    />
  );
}
