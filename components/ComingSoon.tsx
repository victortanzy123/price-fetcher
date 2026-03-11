import { LucideIcon, Clock } from "lucide-react";

interface ComingSoonProps {
  title: string;
  description: string;
  icon: LucideIcon;
  features?: string[];
}

export function ComingSoon({ title, description, icon: Icon, features }: ComingSoonProps) {
  return (
    <div className="min-h-full flex items-center justify-center px-8 py-16">
      <div className="max-w-md w-full text-center">
        {/* Icon cluster */}
        <div className="relative inline-flex mb-8">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}
          >
            <Icon size={28} style={{ color: "var(--text-secondary)" }} />
          </div>
          <div
            className="absolute -bottom-1 -right-1 rounded-full p-1"
            style={{ backgroundColor: "var(--bg-page)", border: "2px solid var(--bg-page)" }}
          >
            <Clock size={14} style={{ color: "var(--accent)" }} />
          </div>
        </div>

        {/* Title */}
        <h1
          className="text-2xl font-semibold tracking-wide mb-3"
          style={{ color: "var(--text-primary)" }}
        >
          {title}
        </h1>

        {/* Description */}
        <p className="text-sm leading-relaxed mb-8" style={{ color: "var(--text-secondary)" }}>
          {description}
        </p>

        {/* Feature list */}
        {features && features.length > 0 && (
          <div
            className="rounded-xl border p-5 text-left space-y-2.5"
            style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border)" }}
          >
            <div
              className="text-[10px] font-semibold tracking-widest uppercase mb-3"
              style={{ color: "var(--text-secondary)" }}
            >
              Planned Features
            </div>
            {features.map((f) => (
              <div key={f} className="flex items-start gap-2.5 text-sm">
                <span
                  className="mt-0.5 w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: "var(--accent)", marginTop: "6px" }}
                />
                <span style={{ color: "var(--text-secondary)" }}>{f}</span>
              </div>
            ))}
          </div>
        )}

        {/* Coming soon badge */}
        <div className="mt-8">
          <span
            className="inline-block text-xs font-semibold tracking-widest uppercase px-4 py-2 rounded-full"
            style={{
              backgroundColor: "rgba(226,183,20,0.1)",
              color: "var(--accent)",
              border: "1px solid rgba(226,183,20,0.25)",
            }}
          >
            Coming Soon
          </span>
        </div>
      </div>
    </div>
  );
}
