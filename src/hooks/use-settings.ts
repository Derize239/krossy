import { useCallback, useEffect, useState } from "react";

const KEY = "kb-settings-v1";
const EVENT = "kb-settings-changed";

export type RefreshInterval = 0 | 5 | 15 | 30 | 60; // minutes; 0 = manual only

export interface Settings {
  refreshMinutes: RefreshInterval;
}

const DEFAULT: Settings = { refreshMinutes: 15 };

function read(): Settings {
  if (typeof window === "undefined") return DEFAULT;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT;
    const parsed = JSON.parse(raw) as Partial<Settings>;
    const rm = parsed.refreshMinutes;
    const valid: RefreshInterval[] = [0, 5, 15, 30, 60];
    return { refreshMinutes: valid.includes(rm as RefreshInterval) ? (rm as RefreshInterval) : 15 };
  } catch {
    return DEFAULT;
  }
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(DEFAULT);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setSettings(read());
    setHydrated(true);
    const sync = () => setSettings(read());
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const update = useCallback((patch: Partial<Settings>) => {
    const next = { ...read(), ...patch };
    window.localStorage.setItem(KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(EVENT));
  }, []);

  return { settings, hydrated, update };
}
