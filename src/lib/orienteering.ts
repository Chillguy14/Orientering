import { supabase } from "@/integrations/supabase/client";

export type SessionRow = {
  id: string;
  code: string;
  control_count: number;
  status: string;
  created_at: string;
  started_at: string | null;
};

export type ControlRow = {
  id: string;
  session_id: string;
  number: number;
  token: string;
};

export type ParticipantRow = {
  id: string;
  session_id: string;
  name: string;
  joined_at: string;
  finished_at: string | null;
};

export type PunchRow = {
  id: string;
  participant_id: string;
  control_id: string;
  punched_at: string;
};

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function randomCode(length = 5) {
  let out = "";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return out;
}

export function controlPayload(sessionCode: string, token: string) {
  return `ORIENT:${sessionCode}:${token}`;
}

export function parsePayload(text: string) {
  const parts = text.trim().split(":");
  if (parts.length !== 3 || parts[0] !== "ORIENT") return null;
  return { code: parts[1]!, token: parts[2]! };
}

export async function createSession(controlCount: number) {
  let code = randomCode();
  let created: SessionRow | null = null;

  for (let attempt = 0; attempt < 5 && !created; attempt++) {
    const { data, error } = await supabase
      .from("sessions")
      .insert({ code, control_count: controlCount })
      .select()
      .single();
    if (error) {
      code = randomCode();
      if (attempt === 4) throw error;
      continue;
    }
    created = data as SessionRow;
  }
  if (!created) throw new Error("Kunde inte skapa omgång");

  const controls = Array.from({ length: controlCount }, (_, i) => ({
    session_id: created!.id,
    number: i + 1,
    token: randomCode(10),
  }));
  const { error: controlError } = await supabase.from("controls").insert(controls);
  if (controlError) throw controlError;

  return created;
}

export async function getSessionByCode(code: string) {
  const { data, error } = await supabase
    .from("sessions")
    .select("*")
    .eq("code", code.toUpperCase())
    .maybeSingle();
  if (error) throw error;
  return (data as SessionRow) ?? null;
}

export async function getControls(sessionId: string) {
  const { data, error } = await supabase
    .from("controls")
    .select("*")
    .eq("session_id", sessionId)
    .order("number");
  if (error) throw error;
  return (data ?? []) as ControlRow[];
}

export async function getParticipants(sessionId: string) {
  const { data, error } = await supabase
    .from("participants")
    .select("*")
    .eq("session_id", sessionId)
    .order("joined_at");
  if (error) throw error;
  return (data ?? []) as ParticipantRow[];
}

export async function getPunches(participantIds: string[]) {
  if (participantIds.length === 0) return [] as PunchRow[];
  const { data, error } = await supabase
    .from("punches")
    .select("*")
    .in("participant_id", participantIds);
  if (error) throw error;
  return (data ?? []) as PunchRow[];
}

export function storeParticipant(code: string, participantId: string) {
  localStorage.setItem(`orient:${code.toUpperCase()}`, participantId);
}

export function readParticipant(code: string) {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(`orient:${code.toUpperCase()}`);
}

export function formatDuration(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
