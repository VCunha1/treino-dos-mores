"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Heart, Home, Settings, User } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/", label: "Início", icon: Home },
  { href: "/casal", label: "Casal", icon: Heart },
  { href: "/perfil", label: "Perfil", icon: User },
  { href: "/configuracoes", label: "Ajustes", icon: Settings },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line/70 bg-surface/95 backdrop-blur pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto grid max-w-md grid-cols-4">
        {items.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium transition",
                  active ? "text-brand" : "text-ink-muted hover:text-ink",
                )}
              >
                <Icon className="h-6 w-6" aria-hidden />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
