"use client";

import { useEffect, useRef, useState } from "react";
import { Minus, Pause, Play, Plus, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatClock, remainingMs, tickTimer, type TimerState } from "@/lib/workout-client";

type Props = {
  state: TimerState;
  onChange: (next: TimerState) => void;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onRestart: () => void;
  onAdjust: (deltaSeconds: number) => void;
  onDismiss: () => void;
  /** Chamado quando o tempo acaba (para tocar o aviso sonoro, se autorizado). */
  onFinished: () => void;
};

/** Barra fixa do cronômetro de descanso. O tempo é calculado pelo horário final, então sobrevive a recarregar a página. */
export function RestTimerBar({ state, onChange, onStart, onPause, onResume, onRestart, onAdjust, onDismiss, onFinished }: Props) {
  const [now, setNow] = useState<number>(() => Date.now());
  const finishedFired = useRef(false);

  useEffect(() => {
    if (state.status !== "running") return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [state.status]);

  useEffect(() => {
    if (state.status !== "running") {
      finishedFired.current = false;
      return;
    }
    const next = tickTimer(state, now);
    if (next.status === "finished" && !finishedFired.current) {
      finishedFired.current = true;
      onChange(next);
      onFinished();
    }
  }, [now, state, onChange, onFinished]);

  const remaining = Math.ceil(remainingMs(state, now) / 1000);
  const progress = state.total > 0 ? Math.min(1, Math.max(0, 1 - remaining / state.total)) : 0;
  const finished = state.status === "finished";

  return (
    <div
      role="timer"
      aria-live="off"
      className={cn(
        "fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 mx-auto max-w-md px-3 pb-1.5",
      )}
    >
      <div
        className={cn(
          "overflow-hidden rounded-2xl border bg-surface/95 shadow-[0_-8px_30px_-12px_rgba(0,0,0,0.8)] backdrop-blur",
          finished ? "border-brand animate-pulse" : "border-line",
        )}
      >
        {state.status === "running" || state.status === "paused" ? (
          <div className="h-1 w-full bg-line">
            <div className="h-full bg-brand transition-[width] duration-200" style={{ width: `${progress * 100}%` }} />
          </div>
        ) : null}

        <div className="flex items-center gap-1.5 px-3 py-2">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
              {finished ? "Descanso concluído" : state.status === "paused" ? "Descanso pausado" : "Descanso"}
            </p>
            <p
              className={cn("font-display text-2xl font-bold leading-tight tabular-nums", finished ? "text-brand" : "text-ink")}
              aria-label={`Tempo de descanso ${formatClock(remaining)}`}
            >
              {finished ? "Bora!" : formatClock(remaining)}
            </p>
          </div>

          {state.status === "idle" || state.status === "finished" ? (
            <>
              <Button variant="ghost" size="sm" className="h-10 w-10 px-0" onClick={() => onAdjust(-15)} aria-label="Menos 15 segundos">
                <Minus className="h-5 w-5" aria-hidden />
              </Button>
              <Button variant="ghost" size="sm" className="h-10 w-10 px-0" onClick={() => onAdjust(15)} aria-label="Mais 15 segundos">
                <Plus className="h-5 w-5" aria-hidden />
              </Button>
              <Button size="md" className="h-11 px-3" onClick={onStart}>
                <Play className="h-5 w-5" aria-hidden /> {finished ? "Outro" : "Iniciar"}
              </Button>
              {finished ? (
                <Button variant="ghost" size="sm" className="h-10 w-10 px-0" onClick={onDismiss} aria-label="Fechar aviso">
                  <X className="h-5 w-5" aria-hidden />
                </Button>
              ) : null}
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" className="h-10 w-10 px-0" onClick={() => onAdjust(-15)} aria-label="Menos 15 segundos">
                <Minus className="h-5 w-5" aria-hidden />
              </Button>
              <Button variant="ghost" size="sm" className="h-10 w-10 px-0" onClick={() => onAdjust(15)} aria-label="Mais 15 segundos">
                <Plus className="h-5 w-5" aria-hidden />
              </Button>
              <Button variant="secondary" size="sm" className="h-10 w-10 px-0" onClick={onRestart} aria-label="Reiniciar descanso">
                <RotateCcw className="h-5 w-5" aria-hidden />
              </Button>
              {state.status === "running" ? (
                <Button size="md" className="h-11 px-3" onClick={onPause}>
                  <Pause className="h-5 w-5" aria-hidden /> Pausar
                </Button>
              ) : (
                <Button size="md" className="h-11 px-3" onClick={onResume}>
                  <Play className="h-5 w-5" aria-hidden /> Retomar
                </Button>
              )}
              <Button variant="ghost" size="sm" className="h-10 w-10 px-0" onClick={onDismiss} aria-label="Encerrar descanso">
                <X className="h-5 w-5" aria-hidden />
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
