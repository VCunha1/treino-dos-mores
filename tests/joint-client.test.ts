import { describe, expect, it } from "vitest";
import {
  applyParticipantChange,
  formatAgo,
  normalizeJointStatus,
  normalizeParticipant,
  progressPct,
  replaceParticipants,
} from "@/lib/joint-client";
import type { JointParticipant } from "@/types/joint";

const row = (over: Record<string, unknown> = {}) => ({
  user_id: "u1",
  session_id: "s1",
  status: "training",
  day_name: "Peito",
  sets_done: 2,
  sets_total: 10,
  exercises_done: 0,
  exercises_total: 3,
  current_exercise: "Supino",
  volume_kg: "800.00",
  updated_at: "2026-11-12T12:00:00.000Z",
  ...over,
});

describe("normalizeParticipant", () => {
  it("converte números vindos como texto e aceita linha completa", () => {
    expect(normalizeParticipant(row())).toMatchObject({ user_id: "u1", sets_done: 2, volume_kg: 800, current_exercise: "Supino" });
  });
  it("rejeita linha sem usuário ou com status desconhecido", () => {
    expect(normalizeParticipant(row({ user_id: undefined }))).toBeNull();
    expect(normalizeParticipant(row({ status: "hack" }))).toBeNull();
    expect(normalizeParticipant(null)).toBeNull();
  });
  it("valores inválidos viram 0 e nunca NaN", () => {
    const p = normalizeParticipant(row({ sets_done: "abc", sets_total: -5, volume_kg: null }))!;
    expect(p.sets_done).toBe(0);
    expect(p.sets_total).toBe(0);
    expect(p.volume_kg).toBe(0);
  });
});

describe("applyParticipantChange", () => {
  const a = normalizeParticipant(row())!;
  const b = normalizeParticipant(row({ user_id: "u2", day_name: "Perna" }))!;

  it("INSERT adiciona", () => {
    expect(applyParticipantChange([a], { eventType: "INSERT", new: row({ user_id: "u2" }), old: {} }).map((p) => p.user_id)).toEqual(["u1", "u2"]);
  });
  it("UPDATE substitui só a pessoa certa", () => {
    const out = applyParticipantChange([a, b], { eventType: "UPDATE", new: row({ sets_done: 5 }), old: {} });
    expect(out.find((p) => p.user_id === "u1")!.sets_done).toBe(5);
    expect(out.find((p) => p.user_id === "u2")).toEqual(b);
  });
  it("DELETE remove por user_id", () => {
    expect(applyParticipantChange([a, b], { eventType: "DELETE", new: {}, old: { user_id: "u1" } }).map((p) => p.user_id)).toEqual(["u2"]);
  });
  it("evento malformado não altera a lista", () => {
    const list: JointParticipant[] = [a];
    expect(applyParticipantChange(list, { eventType: "UPDATE", new: { foo: 1 }, old: {} })).toBe(list);
    expect(applyParticipantChange(list, { eventType: "DELETE", new: {}, old: {} })).toBe(list);
  });
});

describe("outros", () => {
  it("progressPct limita entre 0 e 100 e finalizado é 100", () => {
    expect(progressPct({ status: "training", sets_done: 2, sets_total: 10 })).toBe(20);
    expect(progressPct({ status: "training", sets_done: 0, sets_total: 0 })).toBe(0);
    expect(progressPct({ status: "training", sets_done: 12, sets_total: 10 })).toBe(100);
    expect(progressPct({ status: "finished", sets_done: 3, sets_total: 10 })).toBe(100);
  });
  it("formatAgo", () => {
    const now = Date.parse("2026-11-12T12:10:00Z");
    expect(formatAgo("2026-11-12T12:09:55Z", now)).toBe("agora");
    expect(formatAgo("2026-11-12T12:07:00Z", now)).toBe("há 3 min");
    expect(formatAgo("2026-11-12T09:10:00Z", now)).toBe("há 3 h");
    expect(formatAgo("lixo", now)).toBe("");
  });
  it("normalizeJointStatus e replaceParticipants", () => {
    expect(normalizeJointStatus("active")).toBe("active");
    expect(normalizeJointStatus("x")).toBeNull();
    expect(replaceParticipants(null)).toBeNull();
    expect(replaceParticipants([row(), { nada: 1 }])).toHaveLength(1);
  });
});
