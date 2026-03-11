"use client";

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
        className="transition-colors"
        style={{ color: "var(--text-secondary)" }}
        onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "var(--accent)")}
        onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "var(--text-secondary)")}
      >
        @0xCheeezzyyyy
      </a>
    </footer>
  );
}
