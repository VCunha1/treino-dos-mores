"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Cloud, CloudOff, Minus, Plus, RefreshCw, SkipForward, Undo2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { addSet, discardSession, finishSession, removeSet, saveSet, setExerciseStatus } from "@/features/workout/actions";
import { RestTimerBar } from "@/features/workout/rest-timer-bar";
import { muscleLabel } from "@/lib/training";
import { cn } from "@/lib/utils";
import {
  acknowledge,
  adjustTimer,
  formatClock,
  formatLoad,
  idleTimer,
  parseLoad,
  parseOutbox,
  parseReps,
  parseTimer,
  pauseTimer,
  restartTimer,
  resumeTimer,
  startTimer,
  stepLoad,
  tickTimer,
  type Outbox,
  type TimerState,
} from "@/lib/workout-client";
import type { SessionExercise } from "@/types/workout";

type SetUI = { id: string; setNumber: number; reps: string; load: string; completed: boolean };
type ExUI = {
  id: string;
  name: string;
  muscle: string;
  plannedSets: number;
  plannedReps: string;
  restSeconds: number;
  technique: string | null;
  planNotes: string | null;
  status: "pending" | "skipped";
  sets: SetUI[];
};

type SaveStatus = "saved" | "saving" | "offline";

type Props = {
  session: { id: string; planName: string; dayName: string; startedAt: string };
  exercises: SessionExercise[];
  defaultRestSeconds: number;
  soundEnabled: boolean;
  notice?: string;
  error?: string;
};

function toUI(exercises: SessionExercise[]): ExUI[] {
  return exercises.map((e) => ({
    id: e.id,
    name: e.exercise_name,
    muscle: e.primary_muscle,
    plannedSets: e.planned_sets,
    plannedReps: e.planned_reps,
    restSeconds: e.rest_seconds,
    technique: e.special_technique,
    planNotes: e.plan_notes,
    status: e.status,
    sets: e.sets.map((s) => ({
      id: s.id,
      setNumber: s.set_number,
      reps: s.reps === null ? "" : String(s.reps),
      load: formatLoad(s.load_kg),
      completed: s.completed,
    })),
  }));
}

const outboxKey = (id: string) => `tdm:outbox:${id}`;
const timerKey = (id: string) => `tdm:timer:${id}`;

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeStorage(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // Armazenamento indisponível (modo privado): o salvamento no servidor continua funcionando.
  }
}

export function WorkoutRunner({ session, exercises, defaultRestSeconds, soundEnabled, notice, error }: Props) {
  const [exs, setExs] = useState<ExUI[]>(() => toUI(exercises));
  const [openId, setOpenId] = useState<string | null>(() => {
    const first = toUI(exercises).find((e) => e.status === "pending" && e.sets.some((s) => !s.completed));
    return first?.id ?? null;
  });
  const [pending, setPending] = useState(0);
  const [status, setStatus] = useState<SaveStatus>("saved");
  const [hint, setHint] = useState<{ setId: string; text: string } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [elapsed, setElapsed] = useState<number | null>(null);
  const [timer, setTimer] = useState<TimerState>(() => idleTimer(defaultRestSeconds));

  // Fonte única da verdade para eventos rápidos (digitar, tocar): evita ler estado desatualizado.
  const exsRef = useRef<ExUI[]>(exs);
  const commit = useCallback((next: ExUI[]) => {
    exsRef.current = next;
    setExs(next);
  }, []);

  const outboxRef = useRef<Outbox>({});
  const flushingRef = useRef(false);
  const flushAgainRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // ---------------------------------------------------------- persistência local

  const persistOutbox = useCallback(() => {
    const keys = Object.keys(outboxRef.current);
    writeStorage(outboxKey(session.id), keys.length ? JSON.stringify(outboxRef.current) : null);
    setPending(keys.length);
  }, [session.id]);

  const flush = useCallback(async (): Promise<number> => {
    if (flushingRef.current) {
      flushAgainRef.current = true;
      return Object.keys(outboxRef.current).length;
    }
    flushingRef.current = true;
    try {
      // Limite de passadas: se algo impedir a fila de esvaziar, para e tenta de novo no próximo ciclo
      // em vez de repetir sem parar e sobrecarregar o servidor.
      let passes = 0;
      do {
        passes += 1;
        flushAgainRef.current = false;
        const entries = Object.entries(outboxRef.current);
        if (entries.length === 0) break;
        setStatus("saving");
        for (const [setId, entry] of entries) {
          let result;
          try {
            result = await saveSet({ setId, reps: entry.reps, loadKg: entry.loadKg, completed: entry.completed });
          } catch {
            setStatus("offline");
            persistOutbox();
            return Object.keys(outboxRef.current).length;
          }
          if (result.ok || result.final) {
            outboxRef.current = acknowledge(outboxRef.current, setId, entry.t);
            if (!result.ok) setMessage(result.error);
          } else {
            setStatus("offline");
            persistOutbox();
            return Object.keys(outboxRef.current).length;
          }
        }
        persistOutbox();
      } while (passes < 5 && (flushAgainRef.current || Object.keys(outboxRef.current).length > 0));
      const left = Object.keys(outboxRef.current).length;
      setStatus(left > 0 ? "offline" : "saved");
      return left;
    } finally {
      flushingRef.current = false;
    }
  }, [persistOutbox]);

  const scheduleFlush = useCallback(
    (delay: number) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => void flush(), delay);
    },
    [flush],
  );

  // Ao abrir: recupera alterações que ficaram pendentes (fechou o navegador / caiu a conexão) e o cronômetro.
  useEffect(() => {
    const saved = parseOutbox(readStorage(outboxKey(session.id)));
    if (Object.keys(saved).length > 0) {
      outboxRef.current = saved;
      commit(
        exsRef.current.map((e) => ({
          ...e,
          sets: e.sets.map((s) => {
            const p = saved[s.id];
            return p ? { ...s, reps: p.reps === null ? "" : String(p.reps), load: formatLoad(p.loadKg), completed: p.completed } : s;
          }),
        })),
      );
      setPending(Object.keys(saved).length);
      scheduleFlush(300);
    }
    setTimer(tickTimer(parseTimer(readStorage(timerKey(session.id)), defaultRestSeconds), Date.now()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.id]);

  // Reenvia quando a conexão volta e periodicamente enquanto houver pendências.
  useEffect(() => {
    const onOnline = () => void flush();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [flush]);

  useEffect(() => {
    if (pending === 0) return;
    const id = setInterval(() => void flush(), 10_000);
    return () => clearInterval(id);
  }, [pending, flush]);

  // Avisa antes de fechar a aba se ainda há algo por sincronizar.
  useEffect(() => {
    if (pending === 0) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [pending]);

  // Relógio do treino.
  useEffect(() => {
    const start = Date.parse(session.startedAt);
    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - start) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [session.startedAt]);

  // ------------------------------------------------------------------ cronômetro

  const updateTimer = useCallback(
    (next: TimerState) => {
      setTimer(next);
      writeStorage(timerKey(session.id), next.status === "idle" ? null : JSON.stringify(next));
    },
    [session.id],
  );

  const primeAudio = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      audioRef.current ??= new Ctx();
      void audioRef.current.resume();
    } catch {
      // Sem áudio: o aviso visual continua.
    }
  }, [soundEnabled]);

  const alertFinished = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const ctx = audioRef.current;
      if (ctx) {
        for (let i = 0; i < 3; i++) {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sine";
          osc.frequency.value = 880;
          gain.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.3);
          gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + i * 0.3 + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.3 + 0.2);
          osc.connect(gain).connect(ctx.destination);
          osc.start(ctx.currentTime + i * 0.3);
          osc.stop(ctx.currentTime + i * 0.3 + 0.22);
        }
      }
      navigator.vibrate?.([200, 100, 200]);
    } catch {
      // ignora
    }
  }, [soundEnabled]);

  const startRest = (seconds: number) => {
    primeAudio();
    updateTimer(startTimer(seconds, Date.now()));
  };

  // ----------------------------------------------------------------- alterações

  const queueSet = useCallback(
    (set: SetUI, delay: number) => {
      outboxRef.current = {
        ...outboxRef.current,
        [set.id]: { reps: parseReps(set.reps), loadKg: parseLoad(set.load), completed: set.completed, t: Date.now() },
      };
      persistOutbox();
      scheduleFlush(delay);
    },
    [persistOutbox, scheduleFlush],
  );

  const patchSet = (exId: string, setId: string, patch: Partial<SetUI>, delay = 700) => {
    let updated: SetUI | null = null;
    commit(
      exsRef.current.map((e) =>
        e.id !== exId
          ? e
          : {
              ...e,
              sets: e.sets.map((s) => {
                if (s.id !== setId) return s;
                updated = { ...s, ...patch };
                return updated;
              }),
            },
      ),
    );
    if (updated) queueSet(updated, delay);
    if (hint?.setId === setId) setHint(null);
  };

  const toggleComplete = (ex: ExUI, set: SetUI) => {
    if (!set.completed) {
      if (parseReps(set.reps) === null) {
        setHint({ setId: set.id, text: "Informe as repetições para concluir." });
        document.getElementById(`reps-${set.id}`)?.focus();
        return;
      }
      patchSet(ex.id, set.id, { completed: true }, 0);
      const allDone = ex.sets.every((s) => (s.id === set.id ? true : s.completed));
      if (allDone) {
        const next = exsRef.current.find((e) => e.id !== ex.id && e.status === "pending" && e.sets.some((s) => !s.completed));
        setOpenId(next?.id ?? null);
      }
      startRest(ex.restSeconds);
    } else {
      patchSet(ex.id, set.id, { completed: false }, 0);
    }
  };

  const handleAddSet = async (ex: ExUI) => {
    try {
      const r = await addSet(ex.id);
      if (!r.ok) {
        setMessage(r.error);
        return;
      }
      commit(
        exsRef.current.map((e) =>
          e.id !== ex.id
            ? e
            : { ...e, sets: [...e.sets, { id: r.set.id, setNumber: r.set.setNumber, reps: "", load: formatLoad(r.set.loadKg), completed: false }] },
        ),
      );
    } catch {
      setMessage("Sem conexão. Tente adicionar a série novamente.");
    }
  };

  const handleRemoveSet = async (ex: ExUI, set: SetUI) => {
    try {
      const r = await removeSet(set.id);
      if (!r.ok) {
        setMessage("Não foi possível remover a série.");
        return;
      }
      const { [set.id]: _gone, ...rest } = outboxRef.current;
      void _gone;
      outboxRef.current = rest;
      persistOutbox();
      commit(exsRef.current.map((e) => (e.id !== ex.id ? e : { ...e, sets: e.sets.filter((s) => s.id !== set.id) })));
    } catch {
      setMessage("Sem conexão. Tente remover a série novamente.");
    }
  };

  const handleStatus = async (ex: ExUI, next: "pending" | "skipped") => {
    try {
      const r = await setExerciseStatus({ sessionExerciseId: ex.id, status: next });
      if (!r.ok) {
        setMessage("Não foi possível alterar o exercício.");
        return;
      }
      commit(exsRef.current.map((e) => (e.id === ex.id ? { ...e, status: next } : e)));
      if (next === "skipped" && openId === ex.id) {
        const following = exsRef.current.find((e) => e.id !== ex.id && e.status === "pending" && e.sets.some((s) => !s.completed));
        setOpenId(following?.id ?? null);
      }
      if (next === "pending") setOpenId(ex.id);
    } catch {
      setMessage("Sem conexão. Tente novamente.");
    }
  };

  const handleFinish = async () => {
    setMessage(null);
    const remaining = await flush();
    if (remaining > 0) {
      setMessage("Ainda há alterações sem sincronizar. Verifique a conexão e tente de novo.");
      return;
    }
    writeStorage(outboxKey(session.id), null);
    writeStorage(timerKey(session.id), null);
    formRef.current?.requestSubmit();
  };

  // ----------------------------------------------------------------- derivados

  const totals = useMemo(() => {
    const active = exs.filter((e) => e.status === "pending");
    const total = active.reduce((acc, e) => acc + e.sets.length, 0);
    const done = active.reduce((acc, e) => acc + e.sets.filter((s) => s.completed).length, 0);
    return { total, done };
  }, [exs]);

  const statusChip =
    status === "offline" ? (
      <span className="flex items-center gap-1 text-xs font-medium text-warn">
        <CloudOff className="h-4 w-4" aria-hidden /> Sem conexão{pending > 0 ? ` · ${pending} pendente${pending > 1 ? "s" : ""}` : ""}
      </span>
    ) : status === "saving" || pending > 0 ? (
      <span className="flex items-center gap-1 text-xs font-medium text-ink-muted">
        <RefreshCw className="h-4 w-4 animate-spin" aria-hidden /> Salvando...
      </span>
    ) : (
      <span className="flex items-center gap-1 text-xs font-medium text-success">
        <Cloud className="h-4 w-4" aria-hidden /> Tudo salvo
      </span>
    );

  return (
    <div className="space-y-4 pb-28">
      <header className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wider text-ink-muted">{session.planName}</p>
            <h1 className="font-display text-2xl font-bold leading-tight">{session.dayName}</h1>
          </div>
          <div className="shrink-0 text-right">
            <p className="font-display text-2xl font-bold tabular-nums text-brand" aria-label="Tempo de treino">
              {elapsed === null ? "--:--" : formatClock(elapsed)}
            </p>
            {statusChip}
          </div>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuemin={0} aria-valuemax={totals.total} aria-valuenow={totals.done} aria-label="Séries concluídas">
          <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${totals.total ? (totals.done / totals.total) * 100 : 0}%` }} />
        </div>
        <p className="text-xs text-ink-muted">
          {totals.done} de {totals.total} séries concluídas
        </p>
      </header>

      {notice ? (
        <p role="status" className="rounded-xl border border-brand/40 bg-brand/10 px-4 py-3 text-sm text-brand">
          {notice}
        </p>
      ) : null}
      {error || message ? (
        <p role="alert" className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {message ?? error}
        </p>
      ) : null}

      <ul className="space-y-3">
        {exs.map((ex) => {
          const isOpen = openId === ex.id && ex.status === "pending";
          const doneSets = ex.sets.filter((s) => s.completed).length;
          const allDone = ex.sets.length > 0 && doneSets === ex.sets.length;
          return (
            <li
              key={ex.id}
              className={cn(
                "rounded-2xl border bg-card transition",
                allDone ? "border-success/40" : isOpen ? "border-brand/60" : "border-line/70",
                ex.status === "skipped" && "opacity-60",
              )}
            >
              <button
                type="button"
                className="flex w-full items-center gap-3 p-4 text-left"
                onClick={() => ex.status === "pending" && setOpenId(isOpen ? null : ex.id)}
                aria-expanded={isOpen}
              >
                <div className="min-w-0 flex-1">
                  <p className={cn("font-semibold leading-snug", ex.status === "skipped" && "line-through")}>{ex.name}</p>
                  <p className="mt-0.5 text-xs text-ink-muted">
                    {ex.status === "skipped"
                      ? "Exercício pulado"
                      : `${doneSets}/${ex.sets.length} séries · meta ${ex.plannedSets} × ${ex.plannedReps} · ${muscleLabel(ex.muscle)}`}
                  </p>
                </div>
                {allDone ? <Check className="h-5 w-5 text-success" aria-label="Exercício concluído" /> : null}
                {ex.status === "pending" ? (
                  <ChevronDown className={cn("h-5 w-5 text-ink-muted transition", isOpen && "rotate-180")} aria-hidden />
                ) : null}
              </button>

              {ex.status === "skipped" ? (
                <div className="px-4 pb-4">
                  <Button variant="secondary" size="sm" onClick={() => void handleStatus(ex, "pending")}>
                    <Undo2 className="h-4 w-4" aria-hidden /> Retomar exercício
                  </Button>
                </div>
              ) : null}

              {isOpen ? (
                <div className="space-y-3 border-t border-line/60 p-4">
                  {ex.technique ? <p className="text-xs text-brand">Técnica: {ex.technique}</p> : null}
                  {ex.planNotes ? <p className="text-xs text-ink-muted">Obs. do plano: {ex.planNotes}</p> : null}

                  <ul className="space-y-3">
                    {ex.sets.map((s) => (
                      <li key={s.id} className={cn("rounded-xl border p-3", s.completed ? "border-success/40 bg-success/5" : "border-line/60 bg-surface")}>
                        <div className="mb-2 flex items-center justify-between">
                          <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Série {s.setNumber}</span>
                          {!s.completed && s.setNumber > ex.plannedSets ? (
                            <button type="button" onClick={() => void handleRemoveSet(ex, s)} className="flex items-center gap-1 text-xs text-ink-muted hover:text-danger" aria-label={`Remover série ${s.setNumber}`}>
                              <Trash2 className="h-4 w-4" aria-hidden /> Remover
                            </button>
                          ) : null}
                        </div>

                        <div className="grid grid-cols-[2fr_3fr] items-end gap-3">
                          <label className="space-y-1">
                            <span className="text-[11px] font-medium text-ink-muted">Reps (meta {ex.plannedReps})</span>
                            <input
                              id={`reps-${s.id}`}
                              inputMode="numeric"
                              pattern="[0-9]*"
                              value={s.reps}
                              onChange={(e) => patchSet(ex.id, s.id, { reps: e.target.value.replace(/\D/g, "").slice(0, 4) })}
                              className={cn("field h-14 text-center text-xl font-semibold", hint?.setId === s.id && "border-warn")}
                              aria-label={`Repetições da série ${s.setNumber}`}
                            />
                          </label>
                          <div className="space-y-1">
                            <span className="text-[11px] font-medium text-ink-muted">Carga (kg)</span>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => patchSet(ex.id, s.id, { load: stepLoad(s.load, -2.5) })}
                                className="flex h-14 w-11 shrink-0 items-center justify-center rounded-xl border border-line bg-card text-ink-muted active:scale-95"
                                aria-label="Diminuir 2,5 kg"
                              >
                                <Minus className="h-4 w-4" aria-hidden />
                              </button>
                              <input
                                inputMode="decimal"
                                value={s.load}
                                onChange={(e) => patchSet(ex.id, s.id, { load: e.target.value.replace(/[^\d.,]/g, "").slice(0, 7) })}
                                className="field h-14 min-w-0 flex-1 px-1 text-center text-xl font-semibold"
                                aria-label={`Carga da série ${s.setNumber} em kg`}
                              />
                              <button
                                type="button"
                                onClick={() => patchSet(ex.id, s.id, { load: stepLoad(s.load, 2.5) })}
                                className="flex h-14 w-11 shrink-0 items-center justify-center rounded-xl border border-line bg-card text-ink-muted active:scale-95"
                                aria-label="Aumentar 2,5 kg"
                              >
                                <Plus className="h-4 w-4" aria-hidden />
                              </button>
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleComplete(ex, s)}
                          className={cn(
                            "mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-xl border-2 text-sm font-semibold transition active:scale-[0.98]",
                            s.completed ? "border-success bg-success text-bg" : "border-brand text-brand hover:bg-brand/10",
                          )}
                          aria-pressed={s.completed}
                          aria-label={s.completed ? `Desmarcar série ${s.setNumber}` : `Concluir série ${s.setNumber}`}
                        >
                          <Check className="h-6 w-6" aria-hidden /> {s.completed ? "Concluída" : "Concluir série"}
                        </button>
                        
                        {hint?.setId === s.id ? <p role="alert" className="mt-2 text-xs text-warn">{hint.text}</p> : null}
                      </li>
                    ))}
                  </ul>

                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="secondary" size="sm" onClick={() => void handleAddSet(ex)}>
                      <Plus className="h-4 w-4" aria-hidden /> Série
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => void handleStatus(ex, "skipped")}>
                      <SkipForward className="h-4 w-4" aria-hidden /> Pular exercício
                    </Button>
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      <section className="space-y-3 border-t border-line/60 pt-5">
        {!finishing ? (
          <Button size="lg" className="w-full" onClick={() => setFinishing(true)}>
            Finalizar treino
          </Button>
        ) : (
          <form ref={formRef} action={finishSession} className="space-y-3 rounded-2xl border border-brand/40 bg-card p-4">
            <input type="hidden" name="sessionId" value={session.id} />
            <p className="text-sm">
              Você concluiu <strong>{totals.done}</strong> de {totals.total} séries. Quer deixar alguma observação sobre o treino?
            </p>
            <textarea name="notes" rows={3} maxLength={500} className="field-area" placeholder="Como foi o treino? (opcional)" aria-label="Observações do treino" />
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={() => setFinishing(false)}>
                Voltar
              </Button>
              <Button onClick={() => void handleFinish()}>Confirmar e finalizar</Button>
            </div>
          </form>
        )}

        <ConfirmButton
          action={discardSession}
          fields={{ sessionId: session.id }}
          label="Descartar este treino"
          message="Descartar o treino em andamento? Tudo o que você registrou nele será apagado."
          confirmLabel="Descartar"
          variant="ghost"
          className="w-full"
        />
      </section>

      <RestTimerBar
        state={timer}
        onChange={updateTimer}
        onStart={() => startRest(timer.total)}
        onPause={() => updateTimer(pauseTimer(timer, Date.now()))}
        onResume={() => updateTimer(resumeTimer(timer, Date.now()))}
        onRestart={() => {
          primeAudio();
          updateTimer(restartTimer(timer, Date.now()));
        }}
        onAdjust={(d) => updateTimer(adjustTimer(timer, d, Date.now()))}
        onDismiss={() => updateTimer(idleTimer(timer.total))}
        onFinished={alertFinished}
      />
    </div>
  );
}
