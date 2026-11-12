/**
 * Lógica pura do treino no navegador (sem React): cronômetro de descanso,
 * fila de salvamento (outbox) e leitura de números digitados.
 * Fica separada da tela para ser testada de forma isolada.
 */

// ---------------------------------------------------------------- números

/** Repetições: só inteiros de 0 a 1000. Retorna null se vazio ou inválido. */
export function parseReps(value: string): number | null {
  const v = value.trim();
  if (!/^\d{1,4}$/.test(v)) return null;
  const n = Number(v);
  return n >= 0 && n <= 1000 ? n : null;
}

/** Carga em kg: aceita vírgula ou ponto, de 0 a 1000, com até 2 casas. */
export function parseLoad(value: string): number | null {
  const v = value.trim().replace(",", ".");
  if (!/^\d{1,4}(\.\d{0,2})?$/.test(v)) return null;
  const n = Number(v);
  return n >= 0 && n <= 1000 ? Math.round(n * 100) / 100 : null;
}

export function formatLoad(n: number | null | undefined): string {
  if (n === null || n === undefined) return "";
  return String(Number(n.toFixed(2))).replace(".", ",");
}

/** Soma/subtrai da carga digitada, sem passar de 0..1000. */
export function stepLoad(current: string, delta: number): string {
  const base = parseLoad(current) ?? 0;
  const next = Math.min(1000, Math.max(0, Math.round((base + delta) * 100) / 100));
  return formatLoad(next);
}

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(sec).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}min`;
  if (m > 0) return `${m} min`;
  return `${s}s`;
}

export function formatVolume(kg: number | null | undefined): string {
  if (kg === null || kg === undefined) return "—";
  return `${Math.round(kg).toLocaleString("pt-BR")} kg`;
}

// --------------------------------------------------------------- cronômetro

export type TimerStatus = "idle" | "running" | "paused" | "finished";

export type TimerState = {
  status: TimerStatus;
  /** Duração configurada, em segundos. */
  total: number;
  /** Instante (ms epoch) em que termina, quando running. */
  endsAt: number | null;
  /** Milissegundos restantes, quando paused. */
  pausedMs: number | null;
};

export const TIMER_MIN = 5;
export const TIMER_MAX = 900;

export function clampSeconds(n: number): number {
  return Math.min(TIMER_MAX, Math.max(TIMER_MIN, Math.round(n)));
}

export function idleTimer(totalSeconds: number): TimerState {
  return { status: "idle", total: clampSeconds(totalSeconds), endsAt: null, pausedMs: null };
}

export function startTimer(totalSeconds: number, now: number): TimerState {
  const total = clampSeconds(totalSeconds);
  return { status: "running", total, endsAt: now + total * 1000, pausedMs: null };
}

export function remainingMs(state: TimerState, now: number): number {
  switch (state.status) {
    case "running":
      return Math.max(0, (state.endsAt ?? now) - now);
    case "paused":
      return Math.max(0, state.pausedMs ?? 0);
    case "finished":
      return 0;
    default:
      return state.total * 1000;
  }
}

export function pauseTimer(state: TimerState, now: number): TimerState {
  if (state.status !== "running") return state;
  return { ...state, status: "paused", endsAt: null, pausedMs: remainingMs(state, now) };
}

export function resumeTimer(state: TimerState, now: number): TimerState {
  if (state.status !== "paused") return state;
  return { ...state, status: "running", endsAt: now + (state.pausedMs ?? 0), pausedMs: null };
}

/** Reinicia contando de novo a duração configurada. */
export function restartTimer(state: TimerState, now: number): TimerState {
  return startTimer(state.total, now);
}

export function resetTimer(state: TimerState): TimerState {
  return idleTimer(state.total);
}

/** Ajusta a duração (±segundos). Se estiver rodando ou pausado, ajusta também o tempo restante. */
export function adjustTimer(state: TimerState, deltaSeconds: number, now: number): TimerState {
  const total = clampSeconds(state.total + deltaSeconds);
  if (state.status === "running") {
    const endsAt = (state.endsAt ?? now) + deltaSeconds * 1000;
    return { ...state, total, endsAt: Math.max(now, endsAt) };
  }
  if (state.status === "paused") {
    return { ...state, total, pausedMs: Math.max(0, (state.pausedMs ?? 0) + deltaSeconds * 1000) };
  }
  return idleTimer(total);
}

/** Marca como concluído quando o tempo acaba. */
export function tickTimer(state: TimerState, now: number): TimerState {
  if (state.status === "running" && remainingMs(state, now) <= 0) {
    return { ...state, status: "finished", endsAt: null, pausedMs: null };
  }
  return state;
}

export function parseTimer(raw: string | null, fallbackSeconds: number): TimerState {
  if (!raw) return idleTimer(fallbackSeconds);
  try {
    const o = JSON.parse(raw) as Partial<TimerState>;
    const status = o.status;
    if (status !== "idle" && status !== "running" && status !== "paused" && status !== "finished") return idleTimer(fallbackSeconds);
    const total = typeof o.total === "number" ? clampSeconds(o.total) : fallbackSeconds;
    return {
      status,
      total,
      endsAt: typeof o.endsAt === "number" ? o.endsAt : null,
      pausedMs: typeof o.pausedMs === "number" ? o.pausedMs : null,
    };
  } catch {
    return idleTimer(fallbackSeconds);
  }
}

// ------------------------------------------------- fila de salvamento (outbox)

export type OutboxEntry = {
  reps: number | null;
  loadKg: number | null;
  completed: boolean;
  /** Momento da última alteração local; usado para não apagar uma alteração mais nova que a enviada. */
  t: number;
};

export type Outbox = Record<string, OutboxEntry>;

export function parseOutbox(raw: string | null): Outbox {
  if (!raw) return {};
  try {
    const o = JSON.parse(raw) as unknown;
    if (typeof o !== "object" || o === null || Array.isArray(o)) return {};
    const out: Outbox = {};
    for (const [id, v] of Object.entries(o as Record<string, unknown>)) {
      if (typeof v !== "object" || v === null) continue;
      const e = v as Record<string, unknown>;
      const reps = e.reps === null || typeof e.reps === "number" ? (e.reps as number | null) : undefined;
      const loadKg = e.loadKg === null || typeof e.loadKg === "number" ? (e.loadKg as number | null) : undefined;
      if (reps === undefined || loadKg === undefined) continue;
      if (typeof e.completed !== "boolean" || typeof e.t !== "number") continue;
      out[id] = { reps, loadKg, completed: e.completed, t: e.t };
    }
    return out;
  } catch {
    return {};
  }
}

/** Remove da fila a entrada já enviada, mas só se ela não foi alterada depois do envio. */
export function acknowledge(outbox: Outbox, id: string, sentT: number): Outbox {
  const current = outbox[id];
  if (!current || current.t !== sentT) return outbox;
  const { [id]: _removed, ...rest } = outbox;
  void _removed;
  return rest;
}
