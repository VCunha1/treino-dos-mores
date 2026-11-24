// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { JointParticipant } from "@/types/joint";

type Handler = (payload: unknown) => void;
const handlers: Record<string, Handler> = {};
let subscribeCb: ((s: string) => void) | null = null;
const removeChannel = vi.fn();
const refresh = vi.fn();
let participantsRows: Record<string, unknown>[] = [];
let jointRows: Record<string, unknown>[] = [{ status: "active" }];
const reads: string[] = [];

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => {
    const channel = {
      on(_type: string, cfg: { table: string }, cb: Handler) {
        handlers[cfg.table] = cb;
        return channel;
      },
      subscribe(cb: (s: string) => void) {
        subscribeCb = cb;
        return channel;
      },
    };
    return {
      channel: () => channel,
      removeChannel,
      from: (table: string) => ({
        select: () => ({
          eq: async () => {
            reads.push(table);
            return { data: table === "joint_sessions" ? jointRows : participantsRows };
          },
        }),
      }),
    };
  },
}));

import { JointLiveCard } from "@/features/joint/joint-live-card";

const ME = { id: "me", name: "Ana", avatarUrl: null };
const PARTNER = { id: "bia", name: "Bia", avatarUrl: null };

function part(over: Partial<JointParticipant> & { user_id: string }): JointParticipant {
  return {
    session_id: null,
    status: "training",
    day_name: "Peito",
    sets_done: 0,
    sets_total: 10,
    exercises_done: 0,
    exercises_total: 3,
    current_exercise: "Supino reto",
    volume_kg: 0,
    updated_at: new Date().toISOString(),
    ...over,
  };
}

function mount(variant: "full" | "compact" = "full", parts: JointParticipant[] = [part({ user_id: "me" }), part({ user_id: "bia", day_name: "Costas", current_exercise: "Remada" })]) {
  return render(<JointLiveCard jointId="j1" initialStatus="active" initialParticipants={parts} me={ME} partner={PARTNER} variant={variant} />);
}

async function emit(table: string, payload: unknown) {
  await act(async () => {
    handlers[table]?.(payload);
  });
}

beforeEach(() => {
  for (const k of Object.keys(handlers)) delete handlers[k];
  subscribeCb = null;
  removeChannel.mockReset();
  refresh.mockReset();
  reads.length = 0;
  participantsRows = [];
  jointRows = [{ status: "active" }];
});
afterEach(cleanup);

describe("progresso ao vivo do parceiro", () => {
  it("mostra os dois e atualiza o parceiro quando chega uma mudança do Realtime", async () => {
    mount();
    expect(screen.getByText(/Remada/)).toBeTruthy();
    expect(screen.getAllByLabelText("0 de 10 séries")).toHaveLength(2);

    await emit("joint_participants", {
      eventType: "UPDATE",
      new: { ...part({ user_id: "bia", sets_done: 4, day_name: "Costas", current_exercise: "Puxada" }), volume_kg: "1200" },
      old: {},
    });

    expect(screen.getByText(/Puxada/)).toBeTruthy();
    const bar = screen.getByRole("progressbar", { name: "Progresso de Bia" });
    expect(bar.getAttribute("aria-valuenow")).toBe("40");
    // O progresso da própria pessoa não é alterado pelo evento do parceiro.
    expect(screen.getByRole("progressbar", { name: "Progresso de você" }).getAttribute("aria-valuenow")).toBe("0");
  });

  it("indica ao vivo só depois de inscrito e 'reconectando' se o canal cai", async () => {
    mount();
    expect(screen.getByText("Conectando...")).toBeTruthy();
    await act(async () => subscribeCb?.("SUBSCRIBED"));
    expect(screen.getByText("Ao vivo")).toBeTruthy();
    await act(async () => subscribeCb?.("CHANNEL_ERROR"));
    expect(screen.getByText("Reconectando...")).toBeTruthy();
  });

  it("ao conectar, relê o estado para não perder o que mudou antes", async () => {
    participantsRows = [part({ user_id: "bia", sets_done: 7, day_name: "Costas" }) as unknown as Record<string, unknown>];
    mount();
    await act(async () => subscribeCb?.("SUBSCRIBED"));
    expect(reads).toContain("joint_participants");
    expect(screen.getByLabelText("7 de 10 séries")).toBeTruthy();
  });

  it("na versão compacta aparece só o parceiro", () => {
    mount("compact");
    expect(screen.getByText("Bia")).toBeTruthy();
    expect(screen.queryByText("Você")).toBeNull();
    expect(screen.getByText("Treinando juntos")).toBeTruthy();
  });

  it("parceiro ainda não entrou: mostra que está aguardando", () => {
    render(<JointLiveCard jointId="j1" initialStatus="waiting" initialParticipants={[part({ user_id: "me" })]} me={ME} partner={PARTNER} variant="compact" />);
    expect(screen.getByText("Aguardando Bia entrar...")).toBeTruthy();
  });

  it("quando o encontro termina, pede à página para atualizar; enquanto ativo, não", async () => {
    mount();
    expect(refresh).not.toHaveBeenCalled();
    await emit("joint_sessions", { eventType: "UPDATE", new: { status: "completed" }, old: {} });
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("mostra quem terminou com o resumo e quem saiu", async () => {
    mount();
    await emit("joint_participants", {
      eventType: "UPDATE",
      new: { ...part({ user_id: "bia", status: "finished", sets_done: 9, day_name: "Costas" }), volume_kg: "2500", current_exercise: null },
      old: {},
    });
    expect(screen.getByText(/9 séries/)).toBeTruthy();
    expect(screen.getByRole("progressbar", { name: "Progresso de Bia" }).getAttribute("aria-valuenow")).toBe("100");
    await emit("joint_participants", { eventType: "UPDATE", new: part({ user_id: "bia", status: "left" }), old: {} });
    expect(screen.getByText("Saiu do encontro")).toBeTruthy();
  });

  it("desinscreve do canal ao sair da tela", () => {
    const { unmount } = mount();
    unmount();
    expect(removeChannel).toHaveBeenCalledTimes(1);
  });
});
