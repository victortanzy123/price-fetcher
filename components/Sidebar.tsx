"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart2, TrendingUp, DollarSign, Clock, Zap } from "lucide-react";
import clsx from "clsx";

const NAV_ITEMS = [
  {
    label: "Binance",
    href: "/binance",
    icon: BarChart2,
    available: true,
    description: "OHLC kline close prices",
  },
  {
    label: "Yahoo Finance",
    href: "/yahoo",
    icon: TrendingUp,
    available: true,
    description: "Stock & ETF prices",
  },
  {
    label: "Forex",
    href: "/forex",
    icon: DollarSign,
    available: false,
    description: "FX spot rates",
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="flex flex-col w-56 shrink-0 border-r"
      style={{
        backgroundColor: "var(--bg-sidebar)",
        borderColor: "var(--border)",
      }}
    >
      {/* Logo */}
      <div
        className="flex items-center gap-2 px-5 py-5 border-b"
        style={{ borderColor: "var(--border)" }}
      >
        <Zap size={18} style={{ color: "var(--accent)" }} />
        <span
          className="text-sm font-semibold tracking-wider uppercase"
          style={{ color: "var(--accent)" }}
        >
          PriceFetcher
        </span>
      </div>

      {/* Section label */}
      <div className="px-5 pt-5 pb-2">
        <span
          className="text-[10px] font-semibold tracking-widest uppercase"
          style={{ color: "var(--text-secondary)" }}
        >
          Data Sources
        </span>
      </div>

      {/* Nav items */}
      <nav className="flex flex-col gap-1 px-3 flex-1">
        {NAV_ITEMS.map(({ label, href, icon: Icon, available, description }) => {
          const isActive = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={available ? href : "#"}
              className={clsx(
                "group flex flex-col rounded-md px-3 py-2.5 transition-colors duration-150",
                available
                  ? isActive
                    ? "cursor-default"
                    : "cursor-pointer"
                  : "cursor-not-allowed opacity-50"
              )}
              style={
                isActive && available
                  ? {
                      backgroundColor: "var(--bg-hover)",
                      color: "var(--accent)",
                    }
                  : {}
              }
              onMouseEnter={(e) => {
                if (!available || isActive) return;
                (e.currentTarget as HTMLElement).style.backgroundColor =
                  "var(--bg-hover)";
              }}
              onMouseLeave={(e) => {
                if (!available || isActive) return;
                (e.currentTarget as HTMLElement).style.backgroundColor = "";
              }}
              onClick={(e) => {
                if (!available) e.preventDefault();
              }}
            >
              <div className="flex items-center gap-2.5">
                <Icon
                  size={15}
                  style={{
                    color:
                      isActive && available
                        ? "var(--accent)"
                        : "var(--text-secondary)",
                    flexShrink: 0,
                  }}
                />
                <span
                  className="text-sm font-medium"
                  style={{
                    color:
                      isActive && available
                        ? "var(--accent)"
                        : "var(--text-primary)",
                  }}
                >
                  {label}
                </span>
                {!available && (
                  <span
                    className="ml-auto text-[9px] font-semibold tracking-wider uppercase px-1.5 py-0.5 rounded"
                    style={{
                      backgroundColor: "var(--border)",
                      color: "var(--text-secondary)",
                    }}
                  >
                    Soon
                  </span>
                )}
              </div>
              <span
                className="text-[11px] mt-0.5 pl-[22px]"
                style={{ color: "var(--text-secondary)" }}
              >
                {description}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div
        className="px-5 py-4 border-t text-[11px]"
        style={{
          borderColor: "var(--border)",
          color: "var(--text-secondary)",
        }}
      >
        <div>Binance · Yahoo Finance</div>
        <div className="mt-0.5" style={{ color: "var(--border)" }}>
          no key required
        </div>
      </div>
    </aside>
  );
}
