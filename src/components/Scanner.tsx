import { useEffect, useRef, useState } from "react";

type Html5QrcodeInstance = {
  start: (
    camera: unknown,
    config: { fps: number; qrbox: { width: number; height: number } },
    onSuccess: (decodedText: string) => void,
    onError: (message: string) => void,
  ) => Promise<void>;
  stop: () => Promise<void>;
  clear: () => void;
};

export function Scanner({ onScan }: { onScan: (text: string) => void }) {
  const containerId = useRef(`scanner-${Math.random().toString(36).slice(2)}`);
  const [error, setError] = useState<string | null>(null);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  useEffect(() => {
    let instance: Html5QrcodeInstance | null = null;
    let stopped = false;

    void (async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        instance = new Html5Qrcode(containerId.current) as unknown as Html5QrcodeInstance;
        await instance.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          (decodedText) => onScanRef.current(decodedText),
          () => {},
        );
        if (stopped) await instance.stop();
      } catch {
        setError("Kunde inte starta kameran. Tillåt kameraåtkomst och ladda om sidan.");
      }
    })();

    return () => {
      stopped = true;
      if (instance) {
        instance
          .stop()
          .then(() => instance?.clear())
          .catch(() => {});
      }
    };
  }, []);

  return (
    <div className="surface-card overflow-hidden p-3">
      <div id={containerId.current} className="w-full overflow-hidden rounded-lg" />
      {error ? <p className="p-3 text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
