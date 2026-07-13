import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, ExternalLink, Heart, TrendingDown, TrendingUp } from "lucide-react";
import { useEffect, useMemo } from "react";
import { getProduct } from "@/lib/adishop.functions";
import { formatPrice } from "@/lib/adishop-types";
import { BottomNav } from "@/components/BottomNav";
import { useFavorites } from "@/hooks/use-favorites";
import { getPriceHistory, recordPricePoint } from "@/lib/price-history";

export const Route = createFileRoute("/product")({
  validateSearch: (s: Record<string, unknown>) => ({
    u: typeof s.u === "string" ? s.u : "",
  }),
  head: () => ({
    meta: [
      { title: "Товар — Кроссы.by" },
      { name: "description", content: "Карточка кроссовок с актуальной ценой и наличием с adishop.by." },
    ],
  }),
  component: ProductPage,
});

function ProductPage() {
  const { u } = Route.useSearch();
  const fetchProduct = useServerFn(getProduct);
  const { favorites, toggle, isFavorite } = useFavorites();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["product", u],
    queryFn: () => fetchProduct({ data: { url: u } }),
    enabled: u.length > 0,
    staleTime: 2 * 60 * 1000,
    retry: 1,
  });

  const favItem = favorites.find((f) => f.url === u);
  const productId = favItem?.id ?? null;

  // Record price point in history when product loads
  useEffect(() => {
    if (data?.price != null && productId) {
      recordPricePoint(productId, {
        price: data.price,
        oldPrice: data.oldPrice,
        discount: data.discount,
      });
    }
  }, [data, productId]);

  const history = useMemo(() => (productId ? getPriceHistory(productId) : []), [productId, data]);
  const prev = history.length >= 2 ? history[history.length - 2] : null;
  const diff = data?.price != null && prev ? data.price - prev.price : null;
  const diffPct = diff != null && prev && prev.price > 0 ? (diff / prev.price) * 100 : null;

  const avg =
    history.length > 0
      ? history.reduce((s, p) => s + p.price, 0) / history.length
      : null;
  const vsAvg = data?.price != null && avg ? ((data.price - avg) / avg) * 100 : null;

  return (
    <div className="mx-auto min-h-screen max-w-lg bg-background pb-24">
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur-sm">
        <button
          type="button"
          aria-label="Назад"
          onClick={() => window.history.back()}
          className="flex h-9 w-9 items-center justify-center border border-border"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <span className="truncate text-sm font-bold uppercase tracking-wide">
          {data?.title ?? "Товар"}
        </span>
      </header>

      {!u ? (
        <p className="p-6 text-center text-sm text-muted-foreground">Товар не указан.</p>
      ) : isLoading ? (
        <div className="space-y-3 p-4">
          <div className="aspect-square animate-pulse bg-secondary" />
          <div className="h-5 w-3/4 animate-pulse bg-secondary" />
          <div className="h-6 w-1/3 animate-pulse bg-secondary" />
          <div className="h-24 w-full animate-pulse bg-secondary" />
        </div>
      ) : isError || !data ? (
        <div className="py-16 text-center">
          <p className="font-bold">Не удалось загрузить товар</p>
          <button
            type="button"
            onClick={() => refetch()}
            className="mt-4 bg-primary px-5 py-2 text-sm font-bold uppercase text-primary-foreground"
          >
            Повторить
          </button>
        </div>
      ) : (
        <main>
          {data.images.length > 0 ? (
            <div className="scrollbar-none flex snap-x snap-mandatory overflow-x-auto bg-secondary">
              {data.images.map((src) => (
                <img
                  key={src}
                  src={src}
                  alt={data.title}
                  className="aspect-square w-full shrink-0 snap-center object-contain"
                />
              ))}
            </div>
          ) : null}
          {data.images.length > 1 ? (
            <p className="py-1.5 text-center text-[11px] text-muted-foreground">
              {data.images.length} фото — листайте
            </p>
          ) : null}

          <div className="space-y-4 p-4">
            <div>
              <h1 className="text-xl font-black uppercase leading-tight tracking-tight">
                {data.title}
              </h1>
              {data.sku ? (
                <p className="mt-1 text-xs text-muted-foreground">Артикул: {data.sku}</p>
              ) : null}
            </div>

            <div className="flex items-center gap-3 border border-border p-3">
              <div className="flex-1">
                <div className="flex items-baseline gap-2">
                  {data.price != null ? (
                    <span
                      className={`text-2xl font-black ${data.oldPrice ? "text-sale" : "text-foreground"}`}
                    >
                      {formatPrice(data.price)}
                    </span>
                  ) : (
                    <span className="text-sm text-muted-foreground">Цена не указана</span>
                  )}
                  {data.oldPrice ? (
                    <span className="text-sm text-muted-foreground line-through">
                      {formatPrice(data.oldPrice)}
                    </span>
                  ) : null}
                  {data.discount ? (
                    <span className="bg-sale px-1.5 py-0.5 text-xs font-black italic text-sale-foreground">
                      −{data.discount}%
                    </span>
                  ) : null}
                </div>
                <p
                  className={`mt-1 text-xs font-semibold ${data.inStock ? "text-instock" : "text-muted-foreground"}`}
                >
                  {data.availability ?? (data.inStock ? "в наличии" : "нет данных о наличии")}
                </p>
              </div>
              {favItem && productId ? (
                <button
                  type="button"
                  aria-label="Избранное"
                  onClick={() => toggle(favItem)}
                  className="flex h-11 w-11 shrink-0 items-center justify-center border border-border"
                >
                  <Heart
                    className={`h-5 w-5 ${isFavorite(productId) ? "fill-sale text-sale" : "text-muted-foreground"}`}
                  />
                </button>
              ) : null}
            </div>

            {/* Price change block */}
            {productId && (diff != null || vsAvg != null) ? (
              <div className="space-y-2 border border-border p-3">
                <h2 className="text-xs font-black uppercase tracking-wide text-muted-foreground">
                  Изменение цены
                </h2>
                {diff != null && diffPct != null && prev ? (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      с {new Date(prev.t).toLocaleDateString("ru-RU")}
                    </span>
                    <span
                      className={`flex items-center gap-1 font-black ${
                        diff < 0 ? "text-instock" : diff > 0 ? "text-sale" : "text-muted-foreground"
                      }`}
                    >
                      {diff < 0 ? <TrendingDown className="h-4 w-4" /> : diff > 0 ? <TrendingUp className="h-4 w-4" /> : null}
                      {diff === 0 ? "без изменений" : `${diff > 0 ? "+" : ""}${diffPct.toFixed(1)}%`}
                    </span>
                  </div>
                ) : null}
                {vsAvg != null && history.length >= 3 ? (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      vs средняя ({history.length} замеров)
                    </span>
                    <span
                      className={`font-black ${
                        vsAvg < -1 ? "text-instock" : vsAvg > 1 ? "text-sale" : "text-muted-foreground"
                      }`}
                    >
                      {vsAvg > 0 ? "+" : ""}
                      {vsAvg.toFixed(1)}%
                    </span>
                  </div>
                ) : null}
                {history.length < 2 ? (
                  <p className="text-xs text-muted-foreground">
                    История цен появится после следующих обновлений каталога.
                  </p>
                ) : (
                  <Sparkline points={history.map((p) => p.price)} />
                )}
              </div>
            ) : null}

            {data.description.length > 0 ? (
              <div className="space-y-2">
                <h2 className="text-sm font-black uppercase tracking-wide">Описание</h2>
                {data.description.map((p, i) => (
                  <p key={i} className="text-sm leading-relaxed text-foreground/90">
                    {p}
                  </p>
                ))}
              </div>
            ) : null}

            <a
              href={data.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-2 bg-primary py-3 text-sm font-bold uppercase tracking-wide text-primary-foreground"
            >
              Купить на adishop.by
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        </main>
      )}

      <BottomNav />
      {/* fallback link for a11y */}
      <Link to="/" className="sr-only">
        На главную
      </Link>
    </div>
  );
}

function Sparkline({ points }: { points: number[] }) {
  if (points.length < 2) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const w = 300;
  const h = 40;
  const step = w / (points.length - 1);
  const d = points
    .map((v, i) => {
      const x = i * step;
      const y = h - ((v - min) / range) * h;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mt-1 h-10 w-full text-foreground">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
