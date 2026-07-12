export type Gender = "man" | "woman" | "kids";

export interface CatalogItem {
  id: string;
  url: string;
  title: string;
  subtitle: string;
  image: string | null;
  price: number;
  oldPrice: number | null;
  discount: number | null;
  gender: Gender;
}

export interface CatalogResult {
  items: CatalogItem[];
  updatedAt: string;
}

export interface ProductDetail {
  title: string;
  availability: string | null;
  inStock: boolean;
  sku: string | null;
  price: number | null;
  oldPrice: number | null;
  discount: number | null;
  description: string[];
  images: string[];
  sourceUrl: string;
}

export const GENDERS: Gender[] = ["man", "woman", "kids"];

export const GENDER_LABELS: Record<Gender, string> = {
  man: "Мужские",
  woman: "Женские",
  kids: "Детские",
};

export function formatPrice(value: number): string {
  return `${value.toFixed(2).replace(".", ",")} р.`;
}
