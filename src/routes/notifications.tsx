import { createFileRoute, Link } from "@tanstack/react-router";
import { Bell, BellOff, CheckCheck, Trash2 } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { useNotifications } from "@/hooks/use-notifications";
import { clearNotifications, markAllRead, type AppNotification, type NotificationKind } from "@/lib/price-history";

const KIND_LABEL: Record<NotificationKind, string> = {
  "new-discount": "Новая скидка",
  "bigger-discount": "Скидка выросла",
  "price-drop": "Цена снизилась",
  "back-in-stock": "Снова в наличии",
  "out-of-stock": "Пропал из наличия",
};

export const Route = createFileRoute("/notifications")({
  head: () => ({
    meta: [
      { title: "Уведомления — Кроссы.by" },
      { name: "description", content: "Изменения цен и наличия по избранным моделям." },
      { property: "og:title", content: "Уведомления — Кроссы.by" },
      { property: "og:description", content: "Изменения цен и наличия по избранным моделям." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const { notifications, unreadCount, hydrated } = useNotifications();

  return (
    <div className="mx-auto min-h-screen max-w-lg bg-background pb-20">
      <header className="sticky top-0 z-30 bg-primary px-4 py-3">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-black italic uppercase tracking-tight text-primary-foreground">
            Новости
          </h1>
          <div className="flex items-center gap-3 text-xs font-semibold text-primary-foreground/90">
            {unreadCount > 0 ? (
              <button type="button" onClick={markAllRead} className="flex items-center gap-1">
                <CheckCheck className="h-4 w-4" /> прочитать
              </button>
            ) : null}
            {notifications.length > 0 ? (
              <button type="button" onClick={clearNotifications} className="flex items-center gap-1">
                <Trash2 className="h-4 w-4" /> очистить
              </button>
            ) : null}
          </div>
        </div>
      </header>

      <main className="p-4">
        {!hydrated ? null : notifications.length === 0 ? (
          <div className="py-20 text-center">
            <BellOff className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="mt-4 font-bold">Пока тихо</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Уведомления появятся, когда цены или наличие в избранном изменятся.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border border border-border">
            {notifications.map((n) => (
              <NotifRow key={n.id} n={n} />
            ))}
          </ul>
        )}
      </main>

      <BottomNav />
    </div>
  );
}

function NotifRow({ n }: { n: AppNotification }) {
  return (
    <li className={`flex items-center gap-3 p-3 ${n.read ? "opacity-70" : ""}`}>
      <div className="relative h-14 w-14 shrink-0 bg-secondary">
        {n.productImage ? (
          <img src={n.productImage} alt={n.productTitle} className="h-full w-full object-contain" />
        ) : (
          <Bell className="m-4 h-6 w-6 text-muted-foreground" />
        )}
      </div>
      <div className="flex-1 overflow-hidden">
        <Link
          to="/product"
          search={{ u: n.productUrl }}
          className="line-clamp-1 text-sm font-bold uppercase tracking-wide"
        >
          {n.productTitle}
        </Link>
        <p className="mt-0.5 text-xs">
          <span
            className={`font-black ${
              n.kind === "new-discount" || n.kind === "bigger-discount" || n.kind === "price-drop"
                ? "text-sale"
                : n.kind === "back-in-stock"
                  ? "text-instock"
                  : "text-muted-foreground"
            }`}
          >
            {KIND_LABEL[n.kind]}
          </span>
          {n.oldValue != null && n.newValue != null ? (
            <span className="ml-1 text-muted-foreground">
              {n.oldValue} → {n.newValue}
              {n.kind === "new-discount" || n.kind === "bigger-discount" ? "%" : ""}
            </span>
          ) : null}
        </p>
        <p className="text-[11px] text-muted-foreground">
          {new Date(n.at).toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" })}
        </p>
      </div>
      {!n.read ? <span className="h-2 w-2 shrink-0 rounded-full bg-sale" /> : null}
    </li>
  );
}
