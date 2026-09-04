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
  storeParticipant,
  type ControlRow,
  type SessionRow,
} from "@/lib/orienteering";

export const Route = createFileRoute("/run/$code")({
  head: () => ({
    meta: [
      { title: "Spring omgången – Kontrollen" },
      {
        name: "description",
        content: "Gå med i orienteringsomgången och skanna av kontrollerna med mobilkameran.",
      },
      { property: "og:title", content: "Spring omgången – Kontrollen" },
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
      setParticipantId(readParticipant(code));
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [code]);

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

  useEffect(() => {
    if (!session || session.status !== "lobby") return;
    const channel = supabase
      .channel(`run-${session.id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "sessions" }, () => {
        void getSessionByCode(code).then((s) => s && setSession(s));
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [session, code]);

  async function join(e: React.FormEvent) {
    e.preventDefault();
    if (!session || !name.trim()) return;
    const { data, error } = await supabase
      .from("participants")
      .insert({ session_id: session.id, name: name.trim().slice(0, 40) })
      .select()
      .single();
    if (error || !data) {
      setMessage("Kunde inte gå med. Försök igen.");
      return;
    }
    storeParticipant(code, data.id as string);
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
      setTakenIds((prev) => {
        if (prev.includes(control.id)) {
          setMessage(`Kontroll ${control.number} är redan avklarad.`);
          return prev;
        }
        void supabase
          .from("punches")
          .insert({ participant_id: participantId, control_id: control.id })
          .then(() => setMessage(`Kontroll ${control.number} avklarad!`));
        return [...prev, control.id];
      });
    },
    [session, participantId, controls],
  );

  useEffect(() => {
    if (!session?.started_at || !participantId) return;
    if (controls.length > 0 && takenIds.length >= controls.length) {
      void supabase
        .from("participants")
        .update({ finished_at: new Date().toISOString() })
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
          <h1 className="mt-3 font-display text-5xl leading-none">Omgång {session.code}</h1>
          <p className="mt-2 text-sm opacity-90">
            {controls.length} kontroller ·{" "}
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
                  return (
                    <li
                      key={c.id}
                      className={`flex aspect-square items-center justify-center rounded-xl border font-display text-2xl ${
                        done
                          ? "border-transparent bg-accent text-accent-foreground"
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
