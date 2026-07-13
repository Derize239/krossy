import type { CatalogItem } from "./adishop-types";

const HISTORY_KEY = "kb-price-history-v1";
const SNAPSHOT_KEY = "kb-fav-snapshot-v1";
const NOTIF_KEY = "kb-notifications-v1";
const MAX_POINTS = 30;

export interface PricePoint {
  t: number; // timestamp ms
  price: number;
  oldPrice: number | null;
  discount: number | null;
}

export type NotificationKind = "new-discount" | "bigger-discount" | "price-drop" | "back-in-stock" | "out-of-stock";

export interface AppNotification {
  id: string;
  productId: string;
  productUrl: string;
  productTitle: string;
  productImage: string | null;
  kind: NotificationKind;
  oldValue: number | null;
  newValue: number | null;
  at: number;
  read: boolean;
}

type HistoryMap = Record<string, PricePoint[]>;
type SnapshotMap = Record<string, { price: number; discount: number | null; inStock: boolean }>;

function safeRead<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function safeWrite(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota — ignore */
  }
}

/* -------- Price history per product -------- */

export function recordPricePoint(productId: string, point: Omit<PricePoint, "t">) {
  const map = safeRead<HistoryMap>(HISTORY_KEY, {});
  const arr = map[productId] ?? [];
  const last = arr[arr.length - 1];
  // dedupe: if same price+discount within 5 minutes, skip
  if (
    last &&
    last.price === point.price &&
    last.discount === point.discount &&
    Date.now() - last.t < 5 * 60 * 1000
  ) {
    return;
  }
  arr.push({ t: Date.now(), ...point });
  if (arr.length > MAX_POINTS) arr.splice(0, arr.length - MAX_POINTS);
  map[productId] = arr;
  safeWrite(HISTORY_KEY, map);
}

export function getPriceHistory(productId: string): PricePoint[] {
  const map = safeRead<HistoryMap>(HISTORY_KEY, {});
  return map[productId] ?? [];
}

/* -------- Snapshot for favorites diffing -------- */

export function getFavoritesSnapshot(): SnapshotMap {
  return safeRead<SnapshotMap>(SNAPSHOT_KEY, {});
}

export function writeFavoritesSnapshot(snap: SnapshotMap) {
  safeWrite(SNAPSHOT_KEY, snap);
}

/* -------- Diff catalog against snapshot, emit notifications -------- */

export function diffAndNotify(favorites: CatalogItem[], catalog: CatalogItem[]) {
  if (typeof window === "undefined") return;
  const favIds = new Set(favorites.map((f) => f.id));
  const byId = new Map(catalog.filter((c) => favIds.has(c.id)).map((c) => [c.id, c]));
  const snap = getFavoritesSnapshot();
  const notifs = safeRead<AppNotification[]>(NOTIF_KEY, []);
  const now = Date.now();

  for (const fav of favorites) {
    const current = byId.get(fav.id);
    if (!current) continue;

    // record history
    recordPricePoint(current.id, {
      price: current.price,
      oldPrice: current.oldPrice,
      discount: current.discount,
    });

    const prev = snap[fav.id];
    // assume in-stock if it appears in the catalog listing
    const currInStock = true;

    if (prev) {
      // new discount appeared
      if (!prev.discount && current.discount && current.discount > 0) {
        notifs.unshift({
          id: `${fav.id}-disc-${now}`,
          productId: fav.id,
          productUrl: fav.url,
          productTitle: fav.title,
          productImage: fav.image,
          kind: "new-discount",
          oldValue: null,
          newValue: current.discount,
          at: now,
          read: false,
        });
      } else if (prev.discount && current.discount && current.discount > prev.discount) {
        notifs.unshift({
          id: `${fav.id}-bdisc-${now}`,
          productId: fav.id,
          productUrl: fav.url,
          productTitle: fav.title,
          productImage: fav.image,
          kind: "bigger-discount",
          oldValue: prev.discount,
          newValue: current.discount,
          at: now,
          read: false,
        });
      } else if (current.price < prev.price) {
        notifs.unshift({
          id: `${fav.id}-drop-${now}`,
          productId: fav.id,
          productUrl: fav.url,
          productTitle: fav.title,
          productImage: fav.image,
          kind: "price-drop",
          oldValue: prev.price,
          newValue: current.price,
          at: now,
          read: false,
        });
      }
      if (!prev.inStock && currInStock) {
        notifs.unshift({
          id: `${fav.id}-back-${now}`,
          productId: fav.id,
          productUrl: fav.url,
          productTitle: fav.title,
          productImage: fav.image,
          kind: "back-in-stock",
          oldValue: null,
          newValue: null,
          at: now,
          read: false,
        });
      }
    }

    snap[fav.id] = {
      price: current.price,
      discount: current.discount,
      inStock: currInStock,
    };
  }

  // detect out-of-stock: fav not in catalog anymore
  for (const fav of favorites) {
    if (!byId.has(fav.id)) {
      const prev = snap[fav.id];
      if (prev?.inStock) {
        notifs.unshift({
          id: `${fav.id}-out-${now}`,
          productId: fav.id,
          productUrl: fav.url,
          productTitle: fav.title,
          productImage: fav.image,
          kind: "out-of-stock",
          oldValue: null,
          newValue: null,
          at: now,
          read: false,
        });
        snap[fav.id] = { ...prev, inStock: false };
      }
    }
  }

  // cap
  if (notifs.length > 200) notifs.splice(200);

  writeFavoritesSnapshot(snap);
  safeWrite(NOTIF_KEY, notifs);
  window.dispatchEvent(new Event("kb-notifications-changed"));
}

export function readNotifications(): AppNotification[] {
  return safeRead<AppNotification[]>(NOTIF_KEY, []);
}

export function markAllRead() {
  const notifs = readNotifications().map((n) => ({ ...n, read: true }));
  safeWrite(NOTIF_KEY, notifs);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("kb-notifications-changed"));
  }
}

export function clearNotifications() {
  safeWrite(NOTIF_KEY, []);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("kb-notifications-changed"));
  }
}
