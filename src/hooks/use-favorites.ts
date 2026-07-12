import { useCallback, useEffect, useState } from "react";
import type { CatalogItem } from "@/lib/adishop-types";

const KEY = "sneaker-favorites-v1";
const EVENT = "favorites-changed";

function read(): CatalogItem[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as CatalogItem[]) : [];
  } catch {
    return [];
  }
}

function write(items: CatalogItem[]) {
  window.localStorage.setItem(KEY, JSON.stringify(items));
  window.dispatchEvent(new Event(EVENT));
}

export function useFavorites() {
  const [favorites, setFavorites] = useState<CatalogItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setFavorites(read());
    setHydrated(true);
    const sync = () => setFavorites(read());
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const toggle = useCallback((item: CatalogItem) => {
    const current = read();
    const exists = current.some((f) => f.id === item.id);
    const next = exists ? current.filter((f) => f.id !== item.id) : [item, ...current];
    write(next);
  }, []);

  const isFavorite = useCallback(
    (id: string) => favorites.some((f) => f.id === id),
    [favorites],
  );

  return { favorites, hydrated, toggle, isFavorite };
}
