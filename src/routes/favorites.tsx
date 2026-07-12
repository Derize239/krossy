import { createFileRoute, Link } from "@tanstack/react-router";
import { HeartOff } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { ProductCard } from "@/components/ProductCard";
import { useFavorites } from "@/hooks/use-favorites";

export const Route = createFileRoute("/favorites")({
  head: () => ({
    meta: [
      { title: "Избранное — Кроссы.by" },
      { name: "description", content: "Сохранённые кроссовки: сравнивайте цены и возвращайтесь к любимым моделям." },
    ],
  }),
  component: FavoritesPage,
});

function FavoritesPage() {
  const { favorites, hydrated, toggle, isFavorite } = useFavorites();

  return (
    <div className="mx-auto min-h-screen max-w-lg bg-background pb-20">
      <header className="sticky top-0 z-30 bg-primary px-4 py-3">
        <h1 className="text-xl font-black italic uppercase tracking-tight text-primary-foreground">
          Избранное
        </h1>
      </header>

      <main className="p-4">
        {!hydrated ? null : favorites.length === 0 ? (
          <div className="py-20 text-center">
            <HeartOff className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="mt-4 font-bold">Пока пусто</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Нажимайте ♥ на карточках, чтобы сохранять модели
            </p>
            <Link
              to="/"
              className="mt-6 inline-block bg-primary px-5 py-2 text-sm font-bold uppercase text-primary-foreground"
            >
              В каталог
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {favorites.map((item) => (
              <ProductCard
                key={item.id}
                item={item}
                isFavorite={isFavorite(item.id)}
                onToggleFavorite={toggle}
              />
            ))}
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
