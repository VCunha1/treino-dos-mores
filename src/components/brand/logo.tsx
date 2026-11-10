import { Dumbbell } from "lucide-react";
import { cn } from "@/lib/utils";

export function Logo({ className, showSlogan = false }: { className?: string; showSlogan?: boolean }) {
  return (
    <div className={cn("flex flex-col items-center text-center", className)}>
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand text-bg shadow-[0_8px_30px_-8px_rgba(229,174,54,0.55)]">
        <Dumbbell className="h-7 w-7" aria-hidden />
      </span>
      <span className="mt-4 font-display text-2xl font-extrabold uppercase tracking-[0.14em]">
        Treino dos <span className="text-brand">Mores</span>
      </span>
      {showSlogan ? (
        <span className="mt-1.5 max-w-[16rem] text-[11px] font-medium uppercase tracking-[0.18em] text-ink-muted">
          Juntos na rotina, mais fortes na evolução.
        </span>
      ) : null}
    </div>
  );
}
