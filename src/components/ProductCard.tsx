import { Link } from "@tanstack/react-router";
import { Heart } from "lucide-react";
import type { CatalogItem } from "@/lib/adishop-types";
import { formatPrice } from "@/lib/adishop-types";

interface Props {
  item: CatalogItem;
  isFavorite: boolean;
  onToggleFavorite: (item: CatalogItem) => void;
}

export function ProductCard({ item, isFavorite, onToggleFavorite }: Props) {
  return (
    <div className="group relative flex flex-col border border-border bg-card">
      <button
        type="button"
        aria-label={isFavorite ? "Убрать из избранного" : "В избранное"}
        onClick={(e) => {
          e.preventDefault();
          onToggleFavorite(item);
        }}
        className="absolute right-2 top-2 z-10 flex h-9 w-9 items-center justify-center bg-background/80 backdrop-blur-sm transition-colors"
      >
        <Heart
          className={`h-5 w-5 transition-colors ${
            isFavorite ? "fill-sale text-sale" : "text-muted-foreground"
          }`}
        />
      </button>

      <Link to="/product" search={{ u: item.url }} className="flex flex-1 flex-col">
        <div className="relative aspect-square w-full overflow-hidden bg-secondary">
          {item.image ? (
            <img
              src={item.image}
              alt={item.title}
              loading="lazy"
              className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
              нет фото
            </div>
          )}
          {item.discount ? (
            <span className="absolute left-0 top-2 bg-sale px-2 py-0.5 text-xs font-black italic text-sale-foreground">
              −{item.discount}%
            </span>
          ) : null}
        </div>
        <div className="flex flex-1 flex-col gap-1 p-3">
          <p className="line-clamp-2 text-sm font-semibold leading-tight text-foreground">
            {item.title}
          </p>
          <p className="text-xs text-muted-foreground">{item.subtitle}</p>
          <div className="mt-auto flex items-baseline gap-2 pt-1">
            <span className={`text-sm font-black ${item.oldPrice ? "text-sale" : "text-foreground"}`}>
              {formatPrice(item.price)}
            </span>
            {item.oldPrice ? (
              <span className="text-xs text-muted-foreground line-through">
                {formatPrice(item.oldPrice)}
              </span>
            ) : null}
          </div>
        </div>
      </Link>
    </div>
  );
}
