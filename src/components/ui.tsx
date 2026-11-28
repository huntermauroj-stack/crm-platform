import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

export const btn = {
  base: "inline-flex items-center justify-center gap-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap",
  primary: "bg-accent-500 hover:bg-accent-600 text-white px-3.5 py-2 shadow-sm shadow-accent-500/20",
  secondary: "bg-ink-800 hover:bg-ink-700 text-zinc-100 px-3.5 py-2 ring-1 ring-inset ring-ink-600",
  ghost: "hover:bg-ink-800 text-zinc-300 hover:text-zinc-100 px-2.5 py-1.5",
  danger: "bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 px-3.5 py-2 ring-1 ring-inset ring-rose-500/30",
  success: "bg-emerald-500 hover:bg-emerald-600 text-white px-3.5 py-2",
  sm: "!px-2.5 !py-1 text-xs",
};

export function Button({
  variant = "secondary",
  size,
  className,
  ...props
}: ComponentProps<"button"> & { variant?: "primary" | "secondary" | "ghost" | "danger" | "success"; size?: "sm" }) {
  return <button className={cx(btn.base, btn[variant], size === "sm" && btn.sm, className)} {...props} />;
}

export function LinkButton({
  variant = "secondary",
  size,
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: "primary" | "secondary" | "ghost" | "danger" | "success"; size?: "sm" }) {
  return <Link className={cx(btn.base, btn[variant], size === "sm" && btn.sm, className)} {...props} />;
}

export const inputCls =
  "w-full rounded-lg bg-ink-900 px-3 py-2 text-sm text-zinc-100 ring-1 ring-inset ring-ink-600 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-accent-500";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cx(inputCls, className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cx(inputCls, "min-h-20", className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cx(inputCls, "pr-8", className)} {...props} />;
}

export function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={cx("block", className)}>
      <span className="mb-1 block text-xs font-medium text-zinc-400">{label}</span>
      {children}
    </label>
  );
}

export function Card({ className, children, title, action }: { className?: string; children: ReactNode; title?: ReactNode; action?: ReactNode }) {
  return (
    <section className={cx("rounded-xl bg-ink-900 ring-1 ring-ink-700", className)}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-2 border-b border-ink-700 px-4 py-3">
          <h2 className="text-sm font-semibold text-zinc-200">{title}</h2>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function Badge({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset whitespace-nowrap",
        className ?? "bg-ink-800 text-zinc-300 ring-ink-600",
      )}
    >
      {children}
    </span>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-zinc-400">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="px-6 py-12 text-center">
      <p className="text-sm font-medium text-zinc-300">{title}</p>
      {children && <div className="mt-2 text-sm text-zinc-500">{children}</div>}
    </div>
  );
}

export function Stat({ label, value, hint, href }: { label: string; value: ReactNode; hint?: ReactNode; href?: string }) {
  const inner = (
    <div className="rounded-xl bg-ink-900 p-4 ring-1 ring-ink-700 transition-colors hover:ring-ink-600">
      <div className="text-xs font-medium text-zinc-400">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums text-white">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-zinc-500">{hint}</div>}
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

export function Avatar({ text, className }: { text: string; className?: string }) {
  return (
    <span
      className={cx(
        "inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent-500/40 to-fuchsia-500/30 text-xs font-semibold text-white ring-1 ring-white/10",
        className,
      )}
    >
      {text}
    </span>
  );
}
