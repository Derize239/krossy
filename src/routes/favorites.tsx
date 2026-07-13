import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { HeartOff, RefreshCw } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BottomNav } from "@/components/BottomNav";
import { ProductCard } from "@/components/ProductCard";
import { useFavorites } from "@/hooks/use-favorites";
import { getCatalog } from "@/lib/adishop.functions";
import type { CatalogItem, CatalogResult, Gender } from "@/lib/adishop-types";
import { GENDERS } from "@/lib/adishop-types";
import { useQueries } from "@tanstack/react-query";

type FavSort = "added" | "discount" | "price-asc" | "price-desc";

export const Route = createFileRoute("/favorites")({
  head: () => ({
    meta: [
      { title: "Избранное — Кроссы.by" },
      { name: "description", content: "Сохранённые кроссовки: сортировка по скидке, фильтр наличия, обновление цен." },
    ],
  }),
  component: FavoritesPage,
});

function FavoritesPage() {
  const { favorites, hydrated, toggle, isFavorite } = useFavorites();
  const fetchCatalog = useServerFn(getCatalog);
  const [sort, setSort] = useState<FavSort>("discount");
  const [inStockOnly, setInStockOnly] = useState(false);

  // Fetch all catalogs to know availability
  const results = useQueries({
    queries: GENDERS.map((gender) => ({
      queryKey: ["catalog", gender],
      queryFn: (): Promise<CatalogResult> => fetchCatalog({ data: { gender } }),
      staleTime: 2 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 1,
    })),
  });

  const catalogIds = useMemo(() => {
    const s = new Set<string>();
    results.forEach((r) => r.data?.items.forEach((i) => s.add(i.id)));
    return s;
  }, [results.map((r) => r.data).join(",")]);

  const isRefreshing = results.some((r) => r.isFetching);

  // Merge fresh catalog data into favorites (fresher price/discount)
  const merged = useMemo(() => {
    const fresh = new Map<string, CatalogItem>();
    results.forEach((r) => r.data?.items.forEach((i) => fresh.set(i.id, i)));
    return favorites.map((f) => fresh.get(f.id) ?? f);
  }, [favorites, results.map((r) => r.data).join(",")]);

  const visible = useMemo(() => {
    let list = merged;
    if (inStockOnly) list = list.filter((f) => catalogIds.has(f.id));
    if (sort === "discount")
      list = [...list].sort((a, b) => (b.discount ?? 0) - (a.discount ?? 0));
    if (sort === "price-asc") list = [...list].sort((a, b) => a.price - b.price);
    if (sort === "price-desc") list = [...list].sort((a, b) => b.price - a.price);
    return list;
  }, [merged, sort, inStockOnly, catalogIds]);

  return (
    <div className="mx-auto min-h-screen max-w-lg bg-background pb-20">
      <header className="sticky top-0 z-30 bg-primary px-4 py-3">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-black italic uppercase tracking-tight text-primary-foreground">
            Избранное
          </h1>
          {favorites.length > 0 ? (
            <button
              type="button"
              aria-label="Обновить"
              onClick={() => results.forEach((r) => r.refetch())}
              className="flex items-center gap-1.5 text-xs font-semibold text-primary-foreground/80"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
              {isRefreshing ? "Обновляю…" : "Обновить"}
            </button>
          ) : null}
        </div>
      </header>

      {favorites.length > 0 ? (
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2">
          <label className="flex items-center gap-1.5 text-xs font-semibold">
            <input
              type="checkbox"
              checked={inStockOnly}
              onChange={(e) => setInStockOnly(e.target.checked)}
              className="h-3.5 w-3.5 accent-foreground"
            />
            Только в наличии
          </label>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as FavSort)}
            className="bg-transparent text-xs font-semibold outline-none"
          >
            <option value="discount">По размеру скидки</option>
            <option value="added">По дате добавления</option>
            <option value="price-asc">Сначала дешевле</option>
            <option value="price-desc">Сначала дороже</option>
          </select>
        </div>
      ) : null}

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
        ) : visible.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">
            Нет моделей, подходящих под фильтр.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {visible.map((item) => (
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
