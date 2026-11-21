import { Link } from "@tanstack/react-router";
import { Bell, Heart, LayoutGrid, Settings } from "lucide-react";
import { useFavorites } from "@/hooks/use-favorites";
import { useNotifications } from "@/hooks/use-notifications";

export function BottomNav() {
  const { favorites, hydrated } = useFavorites();
  const { unreadCount } = useNotifications();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex max-w-lg">
        <Link
          to="/"
          search={{ q: "", tab: "all", sort: "default", sale: false }}
          className="flex flex-1 flex-col items-center gap-0.5 py-2.5 text-muted-foreground"
          activeProps={{ className: "flex flex-1 flex-col items-center gap-0.5 py-2.5 text-foreground" }}
          activeOptions={{ exact: true }}
        >
          <LayoutGrid className="h-5 w-5" />
          <span className="text-[11px] font-bold uppercase tracking-wide">Каталог</span>
        </Link>
        <Link
          to="/favorites"
          className="relative flex flex-1 flex-col items-center gap-0.5 py-2.5 text-muted-foreground"
          activeProps={{
            className: "relative flex flex-1 flex-col items-center gap-0.5 py-2.5 text-foreground",
          }}
        >
          <span className="relative">
            <Heart className="h-5 w-5" />
            {hydrated && favorites.length > 0 ? (
              <span className="absolute -right-2.5 -top-1.5 flex h-4 min-w-4 items-center justify-center bg-sale px-1 text-[10px] font-black text-sale-foreground">
                {favorites.length}
              </span>
            ) : null}
          </span>
          <span className="text-[11px] font-bold uppercase tracking-wide">Избранное</span>
        </Link>
        <Link
          to="/notifications"
          className="relative flex flex-1 flex-col items-center gap-0.5 py-2.5 text-muted-foreground"
          activeProps={{
            className: "relative flex flex-1 flex-col items-center gap-0.5 py-2.5 text-foreground",
          }}
        >
          <span className="relative">
            <Bell className="h-5 w-5" />
            {unreadCount > 0 ? (
              <span className="absolute -right-2.5 -top-1.5 flex h-4 min-w-4 items-center justify-center bg-sale px-1 text-[10px] font-black text-sale-foreground">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            ) : null}
          </span>
          <span className="text-[11px] font-bold uppercase tracking-wide">Новости</span>
        </Link>
        <Link
          to="/settings"
          className="flex flex-1 flex-col items-center gap-0.5 py-2.5 text-muted-foreground"
          activeProps={{ className: "flex flex-1 flex-col items-center gap-0.5 py-2.5 text-foreground" }}
        >
          <Settings className="h-5 w-5" />
          <span className="text-[11px] font-bold uppercase tracking-wide">Ещё</span>
        </Link>
      </div>
    </nav>
  );
}
