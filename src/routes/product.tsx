import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, ExternalLink, Heart } from "lucide-react";
import { getProduct } from "@/lib/adishop.functions";
import { formatPrice } from "@/lib/adishop-types";
import { BottomNav } from "@/components/BottomNav";
import { useFavorites } from "@/hooks/use-favorites";

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

  return (
    <div className="mx-auto min-h-screen max-w-lg bg-background pb-24">
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur-sm">
        <Link to="/" aria-label="Назад" className="flex h-9 w-9 items-center justify-center border border-border">
          <ArrowLeft className="h-5 w-5" />
        </Link>
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
          {/* Gallery */}
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
    </div>
  );
}
