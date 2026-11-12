import { describe, expect, it } from "vitest";
import {
  acknowledge,
  adjustTimer,
  formatClock,
  formatDuration,
  formatLoad,
  formatVolume,
  idleTimer,
  parseLoad,
  parseOutbox,
  parseReps,
  parseTimer,
  pauseTimer,
  remainingMs,
  restartTimer,
  resumeTimer,
  startTimer,
  stepLoad,
  tickTimer,
  type Outbox,
} from "@/lib/workout-client";

describe("números digitados", () => {
  it("lê repetições só como inteiros válidos", () => {
    expect(parseReps("12")).toBe(12);
    expect(parseReps(" 8 ")).toBe(8);
    expect(parseReps("0")).toBe(0);
    expect(parseReps("")).toBeNull();
    expect(parseReps("8-12")).toBeNull();
    expect(parseReps("1.5")).toBeNull();
    expect(parseReps("-3")).toBeNull();
    expect(parseReps("5000")).toBeNull();
  });

  it("lê carga com vírgula ou ponto e limita o intervalo", () => {
    expect(parseLoad("42,5")).toBe(42.5);
    expect(parseLoad("42.5")).toBe(42.5);
    expect(parseLoad("40")).toBe(40);
    expect(parseLoad("")).toBeNull();
    expect(parseLoad("abc")).toBeNull();
    expect(parseLoad("-5")).toBeNull();
    expect(parseLoad("1001")).toBeNull();
    expect(parseLoad("12.345")).toBeNull();
  });

  it("formata e ajusta a carga com os botões de + e -", () => {
    expect(formatLoad(42.5)).toBe("42,5");
    expect(formatLoad(40)).toBe("40");
    expect(formatLoad(null)).toBe("");
    expect(stepLoad("40", 2.5)).toBe("42,5");
    expect(stepLoad("40", -2.5)).toBe("37,5");
    expect(stepLoad("", 2.5)).toBe("2,5");
    expect(stepLoad("1", -2.5)).toBe("0");
    expect(stepLoad("999", 5)).toBe("1000");
  });

  it("formata relógio, duração e volume", () => {
    expect(formatClock(75)).toBe("01:15");
    expect(formatClock(3725)).toBe("1:02:05");
    expect(formatClock(-4)).toBe("00:00");
    expect(formatDuration(45)).toBe("45s");
    expect(formatDuration(3000)).toBe("50 min");
    expect(formatDuration(4500)).toBe("1h 15min");
    expect(formatVolume(null)).toBe("—");
    expect(formatVolume(1330)).toMatch(/1\.330 kg|1330 kg/);
  });
});

describe("cronômetro de descanso", () => {
  const t0 = 1_000_000;

  it("inicia, conta e termina", () => {
    const s = startTimer(90, t0);
    expect(s.status).toBe("running");
    expect(remainingMs(s, t0)).toBe(90_000);
    expect(remainingMs(s, t0 + 30_000)).toBe(60_000);
    expect(tickTimer(s, t0 + 89_000).status).toBe("running");
    const done = tickTimer(s, t0 + 90_000);
    expect(done.status).toBe("finished");
    expect(remainingMs(done, t0 + 999_999)).toBe(0);
  });

  it("pausa e retoma preservando o tempo restante", () => {
    const s = startTimer(60, t0);
    const p = pauseTimer(s, t0 + 20_000);
    expect(p.status).toBe("paused");
    expect(remainingMs(p, t0 + 500_000)).toBe(40_000); // não anda enquanto pausado
    const r = resumeTimer(p, t0 + 500_000);
    expect(r.status).toBe("running");
    expect(remainingMs(r, t0 + 510_000)).toBe(30_000);
  });

  it("pausar/retomar no estado errado não faz nada", () => {
    const idle = idleTimer(90);
    expect(pauseTimer(idle, t0)).toBe(idle);
    expect(resumeTimer(idle, t0)).toBe(idle);
  });

  it("reinicia do começo com a duração configurada", () => {
    const s = startTimer(60, t0);
    const r = restartTimer(s, t0 + 45_000);
    expect(remainingMs(r, t0 + 45_000)).toBe(60_000);
  });

  it("ajusta a duração: parado, rodando e pausado, respeitando os limites", () => {
    expect(adjustTimer(idleTimer(90), 15, t0).total).toBe(105);
    expect(adjustTimer(idleTimer(10), -30, t0).total).toBe(5);
    expect(adjustTimer(idleTimer(890), 30, t0).total).toBe(900);

    const running = adjustTimer(startTimer(60, t0), 15, t0 + 10_000);
    expect(remainingMs(running, t0 + 10_000)).toBe(65_000);
    const shortened = adjustTimer(startTimer(60, t0), -30, t0 + 50_000);
    expect(remainingMs(shortened, t0 + 50_000)).toBe(0); // nunca negativo

    const paused = adjustTimer(pauseTimer(startTimer(60, t0), t0 + 20_000), 15, t0 + 30_000);
    expect(remainingMs(paused, t0 + 30_000)).toBe(55_000);
  });

  it("recupera o estado salvo e ignora dados corrompidos", () => {
    const saved = JSON.stringify(startTimer(60, t0));
    expect(parseTimer(saved, 90).status).toBe("running");
    expect(parseTimer("{quebrado", 90)).toEqual(idleTimer(90));
    expect(parseTimer(null, 90)).toEqual(idleTimer(90));
    expect(parseTimer(JSON.stringify({ status: "hack", total: 1 }), 90)).toEqual(idleTimer(90));
  });
});

describe("fila de salvamento (outbox)", () => {
  it("lê uma fila válida e descarta entradas inválidas", () => {
    const raw = JSON.stringify({
      a: { reps: 10, loadKg: 40, completed: true, t: 1 },
      b: { reps: "dez", loadKg: 40, completed: true, t: 1 },
      c: { reps: null, loadKg: null, completed: false, t: 2 },
      d: "lixo",
    });
    const out = parseOutbox(raw);
    expect(Object.keys(out).sort()).toEqual(["a", "c"]);
    expect(parseOutbox("não é json")).toEqual({});
    expect(parseOutbox("[1,2]")).toEqual({});
    expect(parseOutbox(null)).toEqual({});
  });

  it("confirma o envio removendo da fila só se não houve alteração mais nova", () => {
    const outbox: Outbox = { a: { reps: 10, loadKg: 40, completed: true, t: 5 } };
    // Enviou a versão t=5 e ela ainda é a atual: remove.
    expect(acknowledge(outbox, "a", 5)).toEqual({});
    // Enquanto enviava a t=5, o usuário editou (t=9): mantém a mais nova.
    const edited: Outbox = { a: { reps: 11, loadKg: 40, completed: true, t: 9 } };
    expect(acknowledge(edited, "a", 5)).toBe(edited);
    // Id que já não existe: nada muda.
    expect(acknowledge(outbox, "zzz", 1)).toBe(outbox);
  });
});
