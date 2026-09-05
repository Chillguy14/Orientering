import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Scanner } from "@/components/Scanner";
import {
  formatDuration,
  getControls,
  getSessionByCode,
  parsePayload,
  readParticipant,
  sessionTitle,
  storeParticipant,
  type ControlRow,
  type SessionRow,
} from "@/lib/orienteering";

export const Route = createFileRoute("/run/$code")({
  head: () => ({
    meta: [
      { title: "Spring – Orientering" },
      {
        name: "description",
        content: "Gå med i orienteringsomgången och skanna av kontrollerna med mobilkameran.",
      },
      { property: "og:title", content: "Spring – Orientering" },
      {
        property: "og:description",
        content: "Gå med i orienteringsomgången och skanna av kontrollerna med mobilkameran.",
      },
    ],
  }),
  component: RunPage,
});

function RunPage() {
  const { code } = Route.useParams();
  const [session, setSession] = useState<SessionRow | null>(null);
  const [controls, setControls] = useState<ControlRow[]>([]);
  const [participantId, setParticipantId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [takenIds, setTakenIds] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void (async () => {
      const s = await getSessionByCode(code);
      if (!active) return;
      setSession(s);
      if (s) setControls(await getControls(s.id));
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [code]);

  // När omgångsnumret ändras (arrangören tryckte "Kör igen") nollställs deltagaren.
  const round = session?.round ?? null;
  useEffect(() => {
    if (round == null) return;
    setParticipantId(readParticipant(code, round));
    setTakenIds([]);
    setMessage(null);
  }, [code, round]);

  useEffect(() => {
    if (!participantId) return;
    void (async () => {
      const { data } = await supabase
        .from("punches")
        .select("control_id")
        .eq("participant_id", participantId);
      setTakenIds((data ?? []).map((p) => p.control_id as string));
    })();
  }, [participantId]);

  // Lyssna alltid på ändringar av just den här omgången (start, omstart).
  const sessionId = session?.id ?? null;
  useEffect(() => {
    if (!sessionId) return;
    const channel = supabase
      .channel(`run-${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "sessions",
          filter: `id=eq.${sessionId}`,
        },
        (payload) => {
          setSession(payload.new as SessionRow);
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [sessionId]);

  async function join(e: React.FormEvent) {
    e.preventDefault();
    if (!session || !name.trim()) return;
    const { data, error } = await supabase
      .from("participants")
      .insert({
        session_id: session.id,
        name: name.trim().slice(0, 40),
        round: session.round,
      })
      .select()
      .single();
    if (error || !data) {
      setMessage("Kunde inte gå med. Försök igen.");
      return;
    }
    storeParticipant(code, session.round, data.id as string);
    setParticipantId(data.id as string);
  }

  const handleScan = useCallback(
    (text: string) => {
      if (!session || !participantId) return;
      const parsed = parsePayload(text);
      if (!parsed || parsed.code !== session.code) {
        setMessage("Den koden hör inte till den här omgången.");
        return;
      }
      const control = controls.find((c) => c.token === parsed.token);
      if (!control) {
        setMessage("Okänd kontroll.");
        return;
      }
      if (takenIds.includes(control.id)) {
        setMessage(`Kontroll ${control.number} är redan avklarad.`);
        return;
      }
      if (session.ordered) {
        const next = nextControlNumber(controls, takenIds);
        if (next != null && control.number !== next) {
          setMessage(`Fel ordning – du ska ta kontroll ${next} härnäst.`);
          return;
        }
      }
      setTakenIds((prev) => (prev.includes(control.id) ? prev : [...prev, control.id]));
      void supabase
        .from("punches")
        .insert({ participant_id: participantId, control_id: control.id })
        .then(() => setMessage(`Kontroll ${control.number} avklarad!`));
    },
    [session, participantId, controls, takenIds],
  );

  useEffect(() => {
    if (!session?.started_at || !participantId) return;
    if (controls.length > 0 && takenIds.length >= controls.length) {
      const resultMs = Date.now() - new Date(session.started_at).getTime();
      void supabase
        .from("participants")
        .update({ finished_at: new Date().toISOString(), result_ms: resultMs })
        .eq("id", participantId)
        .is("finished_at", null);
    }
  }, [takenIds, controls, participantId, session]);

  if (loading) return <Centered text="Laddar..." />;
  if (!session) return <Centered text="Hittade ingen omgång med den koden." />;

  const allDone = controls.length > 0 && takenIds.length >= controls.length;

  return (
    <main className="min-h-screen bg-background pb-16">
      <header className="forest-panel px-5 py-8">
        <div className="mx-auto max-w-2xl">
          <Link to="/" className="text-sm opacity-80 underline-offset-4 hover:underline">
            ← Startsidan
          </Link>
          <h1 className="mt-3 font-display text-5xl leading-none">{sessionTitle(session)}</h1>
          <p className="mt-2 text-sm opacity-90">
            Kod {session.code} · omgång {session.round} · {controls.length} kontroller ·{" "}
            {session.status === "lobby" ? "väntar på start" : "igång"}
          </p>
        </div>
      </header>

      <section className="mx-auto max-w-2xl px-5 pt-8">
        {!participantId ? (
          <form onSubmit={(e) => void join(e)} className="surface-card space-y-4 p-6">
            <h2 className="text-3xl text-primary">Vad heter du?</h2>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ditt namn"
              maxLength={40}
              className="h-14 w-full rounded-xl border border-input bg-background px-4 text-lg"
            />
            <button
              type="submit"
              className="w-full rounded-xl bg-accent px-6 py-4 font-display text-2xl text-accent-foreground"
            >
              Gå med i omgången
            </button>
            {message ? <p className="text-sm text-destructive">{message}</p> : null}
          </form>
        ) : session.status === "lobby" ? (
          <div className="surface-card p-6 text-center">
            <h2 className="text-3xl text-primary">Väntar på start</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Arrangören startar omgången. Håll dig redo vid startpunkten.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="surface-card flex items-center justify-between p-5">
              <div>
                <p className="font-display text-4xl text-primary">
                  {takenIds.length}/{controls.length}
                </p>
                <p className="text-sm text-muted-foreground">kontroller avklarade</p>
                {session.ordered && !allDone ? (
                  <p className="mt-1 text-sm font-semibold text-accent">
                    Nästa: kontroll {nextControlNumber(controls, takenIds)}
                  </p>
                ) : null}
              </div>
              {session.started_at ? (
                <Timer startedAt={session.started_at} stopped={allDone} />
              ) : null}
            </div>

            {allDone ? (
              <div className="surface-card p-6 text-center">
                <h2 className="text-4xl text-accent">I mål!</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Alla kontroller är avcheckade. Snyggt jobbat.
                </p>
              </div>
            ) : (
              <Scanner onScan={handleScan} />
            )}

            {message ? (
              <p className="rounded-xl bg-secondary p-4 text-center text-sm font-semibold text-secondary-foreground">
                {message}
              </p>
            ) : null}

            <div>
              <h2 className="text-2xl text-primary">Kontroller</h2>
              <ul className="mt-3 grid grid-cols-4 gap-3 sm:grid-cols-6">
                {controls.map((c) => {
                  const done = takenIds.includes(c.id);
                  const isNext =
                    session.ordered && !done && c.number === nextControlNumber(controls, takenIds);
                  return (
                    <li
                      key={c.id}
                      className={`flex aspect-square items-center justify-center rounded-xl border font-display text-2xl ${
                        done
                          ? "border-transparent bg-accent text-accent-foreground"
                          : isNext
                            ? "border-primary bg-card text-primary"
                            : "border-border bg-card text-muted-foreground"
                      }`}
                    >
                      {c.number}
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

/** Lägsta kontrollnummer som inte är taget än (för nummerordning). */
function nextControlNumber(controls: ControlRow[], takenIds: string[]) {
  const left = controls.filter((c) => !takenIds.includes(c.id)).map((c) => c.number);
  return left.length > 0 ? Math.min(...left) : null;
}

function Timer({ startedAt, stopped }: { startedAt: string; stopped: boolean }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (stopped) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [stopped]);
  return (
    <p className="font-display text-4xl text-foreground">
      {formatDuration(now - new Date(startedAt).getTime())}
    </p>
  );
}

function Centered({ text }: { text: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-5">
      <p className="text-lg text-muted-foreground">{text}</p>
    </main>
  );
}
