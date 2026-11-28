"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { Icon, type IconName } from "./icons";
import { cx } from "./ui";

const NAV: { href: string; label: string; icon: IconName; group?: string }[] = [
  { href: "/", label: "Dashboard", icon: "dashboard" },
  { href: "/tasks", label: "Tasks", icon: "check" },
  { href: "/lists", label: "Call lists", icon: "phone", group: "Prospecting" },
  { href: "/contacts", label: "Contacts", icon: "users" },
  { href: "/companies", label: "Companies", icon: "building" },
  { href: "/emails", label: "Emails", icon: "mail" },
  { href: "/import", label: "Import", icon: "upload" },
  { href: "/pipeline", label: "Pipeline", icon: "pipeline", group: "Sales" },
  { href: "/clients", label: "Clients", icon: "target" },
  { href: "/recordings", label: "Call recordings", icon: "mic" },
  { href: "/settings", label: "Settings", icon: "settings", group: " " },
];

export function Sidebar({ dueCount, appName }: { dueCount: number; appName: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r border-ink-700 bg-ink-900/60 px-3 py-4">
      <Link href="/" className="mb-5 flex items-center gap-2 px-2">
        <span className="flex size-7 items-center justify-center rounded-lg bg-gradient-to-br from-accent-400 to-fuchsia-500 text-white shadow-lg shadow-accent-500/30">
          <Icon name="sparkles" className="size-4" />
        </span>
        <span className="text-[15px] font-semibold tracking-tight text-white">{appName}</span>
      </Link>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const q = searchRef.current?.value.trim();
          router.push(q ? `/contacts?q=${encodeURIComponent(q)}` : "/contacts");
        }}
        className="relative mb-4"
      >
        <Icon name="search" className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-zinc-500" />
        <input
          ref={searchRef}
          placeholder="Search contacts…"
          className="w-full rounded-lg bg-ink-850 py-2 pl-8 pr-10 text-sm text-zinc-100 ring-1 ring-inset ring-ink-700 placeholder:text-zinc-500 focus:outline-none focus:ring-accent-500"
        />
        <kbd className="pointer-events-none absolute right-2 top-2 rounded bg-ink-700 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">
          ⌘K
        </kbd>
      </form>

      <nav className="flex-1 space-y-0.5 overflow-y-auto">
        {NAV.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <div key={item.href}>
              {item.group && (
                <div className="mb-1 mt-4 px-2 text-[11px] font-medium uppercase tracking-wider text-zinc-500">{item.group}</div>
              )}
              <Link
                href={item.href}
                className={cx(
                  "flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition-colors",
                  active ? "bg-ink-800 text-white ring-1 ring-ink-600" : "text-zinc-400 hover:bg-ink-850 hover:text-zinc-100",
                )}
              >
                <Icon name={item.icon} className={cx("size-4", active ? "text-accent-400" : "text-zinc-500")} />
                <span className="flex-1">{item.label}</span>
                {item.href === "/tasks" && dueCount > 0 && (
                  <span className="rounded-full bg-accent-500/20 px-1.5 text-[11px] font-semibold text-accent-300">{dueCount}</span>
                )}
              </Link>
            </div>
          );
        })}
      </nav>
      <div className="px-2 pt-3 text-[11px] text-zinc-600">Local · data stays on this PC</div>
    </aside>
  );
}
