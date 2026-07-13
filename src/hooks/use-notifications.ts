import { useEffect, useState } from "react";
import { readNotifications, type AppNotification } from "@/lib/price-history";

export function useNotifications() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setNotifications(readNotifications());
    setHydrated(true);
    const sync = () => setNotifications(readNotifications());
    window.addEventListener("kb-notifications-changed", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("kb-notifications-changed", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;
  return { notifications, unreadCount, hydrated };
}
