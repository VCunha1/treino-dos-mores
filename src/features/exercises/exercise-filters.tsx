import Link from "next/link";
import { Search } from "lucide-react";
import { MUSCLES } from "@/lib/training";
import { cn } from "@/lib/utils";

/** Busca e filtro por grupo muscular via query string (GET), sem JavaScript no cliente. */
export function ExerciseFilters({
  basePath,
  muscle,
  q,
}: {
  basePath: string;
  muscle?: string;
  q?: string;
}) {
  const href = (m?: string) => {
    const params = new URLSearchParams();
    if (m) params.set("m", m);
    if (q) params.set("q", q);
    const s = params.toString();
    return s ? `${basePath}?${s}` : basePath;
  };

  return (
    <div className="space-y-3">
      <form action={basePath} method="get" className="relative">
        {muscle ? <input type="hidden" name="m" value={muscle} /> : null}
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-muted" aria-hidden />
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Buscar exercício"
          aria-label="Buscar exercício"
          className="field pl-12"
          maxLength={60}
        />
      </form>
      <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1" role="group" aria-label="Filtrar por grupo muscular">
        <Link
          href={href()}
          className={cn(
            "shrink-0 rounded-full border px-3 py-1.5 text-sm transition",
            !muscle ? "border-brand bg-brand text-bg font-semibold" : "border-line text-ink-muted hover:text-ink",
          )}
        >
          Todos
        </Link>
        {MUSCLES.map((m) => (
          <Link
            key={m.value}
            href={href(m.value)}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1.5 text-sm transition",
              muscle === m.value ? "border-brand bg-brand text-bg font-semibold" : "border-line text-ink-muted hover:text-ink",
            )}
          >
            {m.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
