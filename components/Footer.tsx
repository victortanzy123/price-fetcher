"use client";

function XLogo({ size = 11 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-label="X (Twitter)"
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.747l7.73-8.835L1.254 2.25H8.08l4.253 5.622 5.912-5.622Zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

export function Footer() {
  return (
    <footer
      className="px-8 py-4 text-center text-[11px]"
      style={{ color: "var(--text-secondary)", borderTop: "1px solid var(--border)" }}
    >
      built by{" "}
      <a
        href="https://x.com/0xCheeezzyyyy"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 transition-colors"
        style={{ color: "var(--text-secondary)" }}
        onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "var(--accent)")}
        onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "var(--text-secondary)")}
      >
        <XLogo size={11} />
        @0xCheeezzyyyy
      </a>
    </footer>
  );
}
