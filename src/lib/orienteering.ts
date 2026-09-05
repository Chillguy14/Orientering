import { supabase } from "@/integrations/supabase/client";

export type SessionRow = {
  id: string;
  code: string;
  name: string | null;
  control_count: number;
  status: string;
  round: number;
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
  round: number;
  joined_at: string;
  finished_at: string | null;
  result_ms: number | null;
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

/** Rundans visningsnamn – namnet om det finns, annars koden. */
export function sessionTitle(session: Pick<SessionRow, "name" | "code">) {
  const n = session.name?.trim();
  return n && n.length > 0 ? n : `Omgång ${session.code}`;
}

export async function createSession(controlCount: number, name: string) {
  let code = randomCode();
  let created: SessionRow | null = null;

  for (let attempt = 0; attempt < 5 && !created; attempt++) {
    const { data, error } = await supabase
      .from("sessions")
      .insert({
        code,
        control_count: controlCount,
        name: name.trim().slice(0, 60) || null,
      })
      .select()
      .single();
    if (error) {
      // 23505 = koden var upptagen, prova en ny. Annat fel = kasta direkt.
      if (error.code !== "23505" || attempt === 4) throw error;
      code = randomCode();
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

  saveHostedRound(created);
  return created;
}

/** Nollställer rundan till väntläge med nytt omgångsnummer. Kontroller/QR-koder behålls. */
export async function restartSession(session: SessionRow) {
  const { data, error } = await supabase
    .from("sessions")
    .update({ status: "lobby", started_at: null, round: session.round + 1 })
    .eq("id", session.id)
    .select()
    .single();
  if (error) throw error;
  return data as SessionRow;
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

/* ---------- Deltagare sparas per runda OCH omgång i webbläsaren ---------- */

function participantKey(code: string, round: number) {
  return `orient:${code.toUpperCase()}:r${round}`;
}

export function storeParticipant(code: string, round: number, participantId: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(participantKey(code, round), participantId);
}

export function readParticipant(code: string, round: number) {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(participantKey(code, round));
}

/* ---------- Rundor du arrangerat, sparas i webbläsaren ---------- */

export type HostedRound = {
  code: string;
  name: string | null;
  controlCount: number;
  createdAt: string;
};

const HOSTED_KEY = "orient:hosted";

export function listHostedRounds(): HostedRound[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(HOSTED_KEY);
    return raw ? (JSON.parse(raw) as HostedRound[]) : [];
  } catch {
    return [];
  }
}

export function saveHostedRound(session: SessionRow) {
  if (typeof window === "undefined") return;
  const rest = listHostedRounds().filter((r) => r.code !== session.code);
  const entry: HostedRound = {
    code: session.code,
    name: session.name,
    controlCount: session.control_count,
    createdAt: session.created_at,
  };
  localStorage.setItem(HOSTED_KEY, JSON.stringify([entry, ...rest].slice(0, 30)));
}

export function removeHostedRound(code: string) {
  if (typeof window === "undefined") return;
  const rest = listHostedRounds().filter((r) => r.code !== code);
  localStorage.setItem(HOSTED_KEY, JSON.stringify(rest));
}

export function formatDuration(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
