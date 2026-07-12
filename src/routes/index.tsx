import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueries } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { RefreshCw, Search } from "lucide-react";
import { getCatalog } from "@/lib/adishop.functions";
import type { CatalogItem, CatalogResult, Gender } from "@/lib/adishop-types";
import { GENDERS, GENDER_LABELS } from "@/lib/adishop-types";
import { ProductCard } from "@/components/ProductCard";
import { CatalogSkeleton } from "@/components/CatalogSkeleton";
import { BottomNav } from "@/components/BottomNav";
import { useFavorites } from "@/hooks/use-favorites";

type Tab = "all" | Gender;
type Sort = "default" | "price-asc" | "price-desc" | "discount";

export const Route = createFileRoute("/")({
  validateSearch: (s: Record<string, unknown>) => ({
    q: typeof s.q === "string" ? s.q : "",
    tab: (["all", "man", "woman", "kids"].includes(s.tab as string) ? s.tab : "all") as Tab,
    sort: (["default", "price-asc", "price-desc", "discount"].includes(s.sort as string)
      ? s.sort
      : "default") as Sort,
    sale: s.sale === true || s.sale === "true",
  }),
  head: () => ({
    meta: [
      { title: "Кроссовки adidsshop.by — удобный каталог" },
      {
        name: "description",
        content:
          "Быстрый и удобный каталог кроссовок adidsshop.by: живые цены и скидки, поиск, фильтры и избранное.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const { q, tab, sort, sale } = Route.useSearch();
  const navigate = useNavigate({ from: "/" });
  const fetchCatalog = useServerFn(getCatalog);
  const { toggle, isFavorite } = useFavorites();
  const [searchInput, setSearchInput] = useState(q);

  const results = useQueries({
    queries: GENDERS.map((gender) => ({
      queryKey: ["catalog", gender],
      queryFn: (): Promise<CatalogResult> => fetchCatalog({ data: { gender } }),
      staleTime: 2 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 1,
    })),
  });

  const activeGenders: Gender[] = tab === "all" ? GENDERS : [tab];
  const activeResults = activeGenders.map((g) => results[GENDERS.indexOf(g)]);
  const isLoading = activeResults.some((r) => r.isLoading);
  const isError = activeResults.every((r) => r.isError);
  const isFetching = results.some((r) => r.isFetching);

  const items = useMemo(() => {
    let list: CatalogItem[] = activeResults.flatMap((r) => r.data?.items ?? []);
    const query = q.trim().toLowerCase();
    if (query) {
      list = list.filter(
        (i) =>
          i.title.toLowerCase().includes(query) || i.subtitle.toLowerCase().includes(query),
      );
    }
    if (sale) list = list.filter((i) => i.discount);
    if (sort === "price-asc") list = [...list].sort((a, b) => a.price - b.price);
    if (sort === "price-desc") list = [...list].sort((a, b) => b.price - a.price);
    if (sort === "discount")
      list = [...list].sort((a, b) => (b.discount ?? 0) - (a.discount ?? 0));
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results.map((r) => r.data).join(","), q, tab, sort, sale]);

  const updatedAt = activeResults.find((r) => r.data)?.data?.updatedAt;

  return (
    <div className="mx-auto min-h-screen max-w-lg bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur-sm">
        <div className="flex items-center justify-between bg-primary px-4 py-3">
          <h1 className="text-xl font-black italic uppercase tracking-tight text-primary-foreground">
            Кроссы<span className="text-sale">.</span>by
          </h1>
          <button
            type="button"
            aria-label="Обновить данные"
            onClick={() => results.forEach((r) => r.refetch())}
            className="flex items-center gap-1.5 text-xs font-semibold text-primary-foreground/70"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            {updatedAt
              ? new Date(updatedAt).toLocaleTimeString("ru-RU", {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : ""}
          </button>
        </div>

        {/* Search */}
        <div className="px-4 pt-3">
          <div className="flex items-center gap-2 border border-border bg-secondary px-3">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              type="search"
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value);
                navigate({
                  search: (prev: Record<string, unknown>) => ({ ...prev, q: e.target.value }),
                  replace: true,
                });
              }}
              placeholder="Поиск: Superstar, Ultraboost…"
              className="h-10 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
        </div>

        {/* Tabs */}
        <div className="scrollbar-none flex gap-1.5 overflow-x-auto px-4 py-3">
          {(["all", ...GENDERS] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => navigate({ search: (prev: Record<string, unknown>) => ({ ...prev, tab: t }) })}
              className={`shrink-0 px-3.5 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors ${
                tab === t
                  ? "bg-primary text-primary-foreground"
                  : "border border-border bg-background text-foreground"
              }`}
            >
              {t === "all" ? "Все" : GENDER_LABELS[t]}
            </button>
          ))}
          <button
            type="button"
            onClick={() => navigate({ search: (prev: Record<string, unknown>) => ({ ...prev, sale: !sale }) })}
            className={`shrink-0 px-3.5 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors ${
              sale
                ? "bg-sale text-sale-foreground"
                : "border border-border bg-background text-sale"
            }`}
          >
            % Скидки
          </button>
        </div>
      </header>

      {/* Sort + count */}
      <div className="flex items-center justify-between px-4 pb-2">
        <span className="text-xs text-muted-foreground">
          {isLoading ? "Загрузка…" : `${items.length} моделей`}
        </span>
        <select
          value={sort}
          onChange={(e) =>
            navigate({ search: (prev: Record<string, unknown>) => ({ ...prev, sort: e.target.value as Sort }) })
          }
          className="bg-transparent text-xs font-semibold text-foreground outline-none"
        >
          <option value="default">По умолчанию</option>
          <option value="price-asc">Сначала дешевле</option>
          <option value="price-desc">Сначала дороже</option>
          <option value="discount">По размеру скидки</option>
        </select>
      </div>

      {/* Grid */}
      <main className="px-4">
        {isLoading ? (
          <CatalogSkeleton />
        ) : isError ? (
          <div className="py-16 text-center">
            <p className="font-bold">Не удалось загрузить каталог</p>
            <p className="mt-1 text-sm text-muted-foreground">
              adishop.by не отвечает. Попробуйте обновить.
            </p>
            <button
              type="button"
              onClick={() => results.forEach((r) => r.refetch())}
              className="mt-4 bg-primary px-5 py-2 text-sm font-bold uppercase text-primary-foreground"
            >
              Обновить
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="py-16 text-center">
            <p className="font-bold">Ничего не найдено</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Попробуйте изменить запрос или фильтры
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {items.map((item) => (
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

      <footer className="px-4 py-6 text-center text-[11px] text-muted-foreground">
        Данные обновляются с adishop.by при каждом открытии
      </footer>

      <BottomNav />
    </div>
  );
}
