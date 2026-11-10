/* eslint-disable @next/next/no-img-element */
import { cn, initials } from "@/lib/utils";

export function Avatar({
  name,
  src,
  className,
}: {
  name: string | null | undefined;
  src?: string | null;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-line bg-surface font-semibold text-brand",
        className,
      )}
    >
      {src ? <img src={src} alt={name ?? "Foto de perfil"} className="h-full w-full object-cover" /> : initials(name)}
    </span>
  );
}
