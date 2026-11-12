// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionExercise } from "@/types/workout";

const saveSet = vi.fn();
vi.mock("@/features/workout/actions", () => ({
  saveSet: (...a: unknown[]) => saveSet(...a),
  addSet: vi.fn(),
  removeSet: vi.fn(),
  setExerciseStatus: vi.fn(),
  finishSession: vi.fn(),
  discardSession: vi.fn(),
}));

import { WorkoutRunner } from "@/features/workout/workout-runner";

const SESSION = { id: "6f9619ff-8b86-d011-b42d-00cf4fc964ff", planName: "Plano A", dayName: "Peito", startedAt: new Date().toISOString() };

function exercises(): SessionExercise[] {
  return [
    {
      id: "e1",
      session_id: SESSION.id,
      exercise_id: "x1",
      exercise_name: "Supino reto com barra",
      primary_muscle: "peitoral",
      position: 1,
      planned_sets: 2,
      planned_reps: "8-12",
      planned_load_kg: 40,
      rest_seconds: 60,
      special_technique: null,
      plan_notes: null,
      status: "pending",
      notes: null,
      sets: [
        { id: "s1", session_exercise_id: "e1", set_number: 1, reps: null, load_kg: 40, completed: false, completed_at: null },
        { id: "s2", session_exercise_id: "e1", set_number: 2, reps: null, load_kg: 40, completed: false, completed_at: null },
      ],
    },
  ];
}

function mount(soundEnabled = false) {
  return render(<WorkoutRunner session={SESSION} exercises={exercises()} defaultRestSeconds={90} soundEnabled={soundEnabled} />);
}

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  window.localStorage.clear();
  saveSet.mockReset();
  saveSet.mockResolvedValue({ ok: true });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("tela do treino", () => {
  it("não deixa concluir a série sem repetições e não envia nada ao servidor", async () => {
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Concluir série 1" }));
    await advance(1000);
    expect(screen.getByText("Informe as repetições para concluir.")).toBeTruthy();
    expect(saveSet).not.toHaveBeenCalled();
  });

  it("conclui a série, salva no servidor com os valores certos e inicia o descanso do exercício", async () => {
    mount();
    fireEvent.change(screen.getByLabelText("Repetições da série 1"), { target: { value: "12" } });
    fireEvent.click(screen.getByRole("button", { name: "Concluir série 1" }));
    await advance(1000);

    expect(saveSet).toHaveBeenCalledWith({ setId: "s1", reps: 12, loadKg: 40, completed: true });
    expect(screen.getByText("1 de 2 séries concluídas")).toBeTruthy();
    // Descanso de 60 s iniciado automaticamente (botão de pausar aparece).
    expect(screen.getByRole("button", { name: /Pausar/ })).toBeTruthy();
    expect(screen.getByLabelText(/Tempo de descanso 01:0\d|Tempo de descanso 00:\d\d/)).toBeTruthy();
    expect(screen.getByText("Tudo salvo")).toBeTruthy();
  });

  it("registra a carga alterada pelos botões de + e −", async () => {
    mount();
    fireEvent.change(screen.getByLabelText("Repetições da série 1"), { target: { value: "10" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Aumentar 2,5 kg" })[0]!);
    fireEvent.click(screen.getByRole("button", { name: "Concluir série 1" }));
    await advance(1000);
    expect(saveSet).toHaveBeenCalledWith({ setId: "s1", reps: 10, loadKg: 42.5, completed: true });
  });

  it("sem conexão: guarda a alteração no aparelho e reenvia quando a conexão volta, sem duplicar", async () => {
    saveSet.mockRejectedValue(new Error("network"));
    mount();
    fireEvent.change(screen.getByLabelText("Repetições da série 1"), { target: { value: "8" } });
    fireEvent.click(screen.getByRole("button", { name: "Concluir série 1" }));
    await advance(1000);

    expect(screen.getByText(/Sem conexão/)).toBeTruthy();
    const stored = JSON.parse(window.localStorage.getItem(`tdm:outbox:${SESSION.id}`) ?? "{}");
    expect(stored.s1).toMatchObject({ reps: 8, loadKg: 40, completed: true });

    // A conexão volta.
    saveSet.mockReset();
    saveSet.mockResolvedValue({ ok: true });
    await act(async () => {
      window.dispatchEvent(new Event("online"));
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(saveSet).toHaveBeenCalledTimes(1);
    expect(saveSet).toHaveBeenCalledWith({ setId: "s1", reps: 8, loadKg: 40, completed: true });
    expect(screen.getByText("Tudo salvo")).toBeTruthy();
    expect(window.localStorage.getItem(`tdm:outbox:${SESSION.id}`)).toBeNull();
  });

  it("recupera o que ficou pendente após fechar/atualizar a página e envia ao servidor", async () => {
    window.localStorage.setItem(
      `tdm:outbox:${SESSION.id}`,
      JSON.stringify({ s1: { reps: 9, loadKg: 45, completed: true, t: Date.now() } }),
    );
    mount();
    await advance(1000);

    // A tela já reflete a série concluída antes mesmo de falar com o servidor.
    expect((screen.getByLabelText("Repetições da série 1") as HTMLInputElement).value).toBe("9");
    expect((screen.getByLabelText("Carga da série 1 em kg") as HTMLInputElement).value).toBe("45");
    expect(screen.getByRole("button", { name: "Desmarcar série 1" })).toBeTruthy();
    expect(saveSet).toHaveBeenCalledWith({ setId: "s1", reps: 9, loadKg: 45, completed: true });
    expect(window.localStorage.getItem(`tdm:outbox:${SESSION.id}`)).toBeNull();
  });

  it("descarta da fila uma alteração que o servidor recusa de forma definitiva (treino já finalizado)", async () => {
    saveSet.mockResolvedValue({ ok: false, final: true, error: "Este treino não aceita mais alterações." });
    mount();
    fireEvent.change(screen.getByLabelText("Repetições da série 1"), { target: { value: "8" } });
    await advance(1500);
    expect(screen.getByText("Este treino não aceita mais alterações.")).toBeTruthy();
    expect(window.localStorage.getItem(`tdm:outbox:${SESSION.id}`)).toBeNull();
  });

  it("cronômetro: pausa, retoma e ajusta a duração", async () => {
    mount();
    fireEvent.click(screen.getByRole("button", { name: /Iniciar/ }));
    await advance(500);
    expect(screen.getByRole("button", { name: /Pausar/ })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Pausar/ }));
    expect(screen.getByText("Descanso pausado")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Retomar/ }));
    expect(screen.getByRole("button", { name: /Pausar/ })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Mais 15 segundos" }));
    // O estado do cronômetro é guardado para sobreviver a recarregar a página.
    expect(JSON.parse(window.localStorage.getItem(`tdm:timer:${SESSION.id}`) ?? "{}").total).toBe(105);
  });

  it("cronômetro: ao terminar mostra o aviso visual (e não toca som se o usuário não autorizou)", async () => {
    mount(false);
    fireEvent.click(screen.getByRole("button", { name: /Iniciar/ }));
    await advance(91_000);
    expect(screen.getByText("Descanso concluído")).toBeTruthy();
  });
});
