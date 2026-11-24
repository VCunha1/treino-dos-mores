"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Radio, WifiOff } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { createClient } from "@/lib/supabase/client";
import {
  PARTICIPANT_COLUMNS,
  applyParticipantChange,
  formatAgo,
  isOpenJoint,
  normalizeJointStatus,
  participantStatusText,
  progressPct,
  replaceParticipants,
  type ChangePayload,
} from "@/lib/joint-client";
import { cn } from "@/lib/utils";
import { formatVolume } from "@/lib/workout-client";
import type { JointParticipant, JointPerson, JointStatus } from "@/types/joint";

type Props = {
  jointId: string;
  initialStatus: JointStatus;
  initialParticipants: JointParticipant[];
  me: JointPerson;
  partner: JointPerson;
  /** "compact": só o(a) parceiro(a), fixo no topo do treino. "full": os dois lado a lado. */
  variant?: "full" | "compact";
};

type Connection = "connecting" | "live" | "reconnecting";

/** Releitura de segurança caso o Realtime caia: a cada 15 s e ao voltar para a aba. */
const POLL_MS = 15_000;

export function JointLiveCard({ jointId, initialStatus, initialParticipants, me, partner, variant = "full" }: Props) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [status, setStatus] = useState<JointStatus>(initialStatus);
  const [parts, setParts] = useState<JointParticipant[]>(initialParticipants);
  const [conn, setConn] = useState<Connection>("connecting");
  const [now, setNow] = useState(() => Date.now());
  const refreshedFor = useRef<JointStatus | null>(null);

  const reread = useCallback(async () => {
    try {
      const [j, p] = await Promise.all([
        supabase.from("joint_sessions").select("status").eq("id", jointId),
        supabase.from("joint_participants").select(PARTICIPANT_COLUMNS).eq("joint_id", jointId),
      ]);
      const next = normalizeJointStatus((j.data?.[0] as { status?: unknown } | undefined)?.status);
      if (next) setStatus(next);
      const list = replaceParticipants(p.data as Record<string, unknown>[] | null);
      if (list) setParts(list);
    } catch {
      // Sem conexão agora; a próxima releitura tenta de novo.
    }
  }, [supabase, jointId]);

  useEffect(() => {
    const channel = supabase
      .channel(`joint:${jointId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "joint_participants", filter: `joint_id=eq.${jointId}` },
        (payload) => setParts((cur) => applyParticipantChange(cur, payload as unknown as ChangePayload)),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "joint_sessions", filter: `id=eq.${jointId}` },
        (payload) => {
          const next = normalizeJointStatus((payload.new as { status?: unknown } | null)?.status);
          if (next) setStatus(next);
        },
      )
      .subscribe((s) => {
        if (s === "SUBSCRIBED") {
          setConn("live");
          void reread(); // pega o que mudou antes da conexão abrir
        } else if (s === "CHANNEL_ERROR" || s === "TIMED_OUT" || s === "CLOSED") {
          setConn("reconnecting");
        }
      });

    const poll = setInterval(() => void reread(), POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void reread();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisible);
      void supabase.removeChannel(channel);
    };
  }, [supabase, jointId, reread]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  // Quando o encontro termina ou é cancelado, a página (servidor) decide o que mostrar.
  useEffect(() => {
    if (!isOpenJoint(status) && refreshedFor.current !== status) {
      refreshedFor.current = status;
      router.refresh();
    }
  }, [status, router]);

  const mine = parts.find((p) => p.user_id === me.id);
  const theirs = parts.find((p) => p.user_id === partner.id);

  const liveBadge =
    conn === "live" ? (
      <span className="flex items-center gap-1 text-[11px] font-medium text-success">
        <Radio className="h-3.5 w-3.5" aria-hidden /> Ao vivo
      </span>
    ) : (
      <span className="flex items-center gap-1 text-[11px] font-medium text-warn">
        <WifiOff className="h-3.5 w-3.5" aria-hidden /> {conn === "connecting" ? "Conectando..." : "Reconectando..."}
      </span>
    );

  if (variant === "compact") {
    return (
      <section
        aria-label={`Treino em conjunto com ${partner.name}`}
        className="sticky top-2 z-20 mb-3 rounded-2xl border border-brand/40 bg-surface/95 p-3 shadow-lg backdrop-blur"
      >
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-brand">Treinando juntos</p>
          {liveBadge}
        </div>
        <div className="mt-2">
          {theirs ? (
            <PersonRow person={partner} part={theirs} now={now} compact />
          ) : (
            <div className="flex items-center gap-3">
              <Avatar name={partner.name} src={partner.avatarUrl} className="h-9 w-9 text-xs" />
              <p className="text-sm text-ink-muted">
                {status === "waiting" ? `Aguardando ${partner.name} entrar...` : `${partner.name} não está no encontro.`}
              </p>
            </div>
          )}
        </div>
      </section>
    );
  }

  return (
    <section aria-label="Progresso do treino em conjunto" className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Progresso</h2>
        {liveBadge}
      </div>
      <ul className="space-y-3">
        <li>{mine ? <PersonRow person={me} part={mine} now={now} isMe /> : <Waiting person={me} text="Você ainda não entrou." />}</li>
        <li>
          {theirs ? (
            <PersonRow person={partner} part={theirs} now={now} />
          ) : (
            <Waiting person={partner} text={status === "waiting" ? `Aguardando ${partner.name} entrar...` : `${partner.name} não está no encontro.`} />
          )}
        </li>
      </ul>
    </section>
  );
}

function Waiting({ person, text }: { person: JointPerson; text: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-dashed border-line bg-surface p-4">
      <Avatar name={person.name} src={person.avatarUrl} className="h-11 w-11 text-sm" />
      <p className="text-sm text-ink-muted">{text}</p>
    </div>
  );
}

function PersonRow({
  person,
  part,
  now,
  isMe = false,
  compact = false,
}: {
  person: JointPerson;
  part: JointParticipant;
  now: number;
  isMe?: boolean;
  compact?: boolean;
}) {
  const pct = progressPct(part);
  const finished = part.status === "finished";
  const left = part.status === "left";
  const detail = finished
    ? `${part.sets_done} séries · ${formatVolume(part.volume_kg)}`
    : left
      ? participantStatusText(part.status)
      : part.current_exercise
        ? `${part.current_exercise}`
        : "Quase lá";

  const body = (
    <div className="min-w-0 flex-1">
      <div className="flex items-baseline justify-between gap-2">
        <p className="truncate text-sm font-semibold">
          {isMe ? "Você" : person.name}
          <span className="ml-2 text-xs font-normal text-ink-muted">{part.day_name}</span>
        </p>
        <p className="shrink-0 text-xs tabular-nums text-ink-muted" aria-label={`${part.sets_done} de ${part.sets_total} séries`}>
          {part.sets_done}/{part.sets_total}
        </p>
      </div>
      <div
        className="mt-1.5 h-2 overflow-hidden rounded-full bg-line"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label={`Progresso de ${isMe ? "você" : person.name}`}
      >
        <div className={cn("h-full rounded-full transition-all duration-500", finished ? "bg-success" : left ? "bg-ink-muted" : "bg-brand")} style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1 truncate text-xs text-ink-muted">
        {detail}
        {part.status === "training" ? ` · ${formatAgo(part.updated_at, now)}` : ""}
      </p>
    </div>
  );

  if (compact) {
    return (
      <div className="flex items-center gap-3">
        <Avatar name={person.name} src={person.avatarUrl} className="h-9 w-9 text-xs" />
        {body}
      </div>
    );
  }
  return (
    <div className={cn("flex items-center gap-3 rounded-2xl border bg-card p-4", isMe ? "border-brand/40" : "border-line/70")}>
      <Avatar name={person.name} src={person.avatarUrl} className="h-11 w-11 text-sm" />
      {body}
    </div>
  );
}
