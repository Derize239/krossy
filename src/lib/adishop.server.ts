import type { CatalogItem, CatalogResult, Gender, ProductDetail } from "./adishop-types";

const BASE = "https://www.adishop.by/";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const TTL = 3 * 60 * 1000;

interface SourceSize {
  size: string;
  total: number;
  stores: Record<string, number>;
}

interface SourceEnrich {
  displayName?: string;
  description?: string;
  shortDesc?: string;
  bullets?: string[];
  gender?: string;
  ageGroup?: string;
  targetAudience?: string;
  color?: string;
  productType?: string;
  productGroup?: string;
}

interface SourceProduct {
  id: string;
  sku: string;
  title: string;
  category: string;
  price: number | null;
  oldPrice: number | null;
  sizes: SourceSize[];
  totalStock: number;
  photos?: string[];
  enrich?: SourceEnrich;
  publicHidden?: boolean;
  hiddenFromPublic?: boolean;
  adminHidden?: boolean;
  discountPercent?: number;
}

interface ProductOverride {
  product_key?: string;
  article?: string;
  title?: string | null;
  short_description?: string | null;
  full_description?: string | null;
  price_override?: string | number | null;
  sale_price?: string | number | null;
  discount_percent?: string | number | null;
  is_hidden?: number;
  is_new?: number;
}

interface PhotoOverride {
  article?: string;
  file_path?: string;
  sort_order?: number;
  is_hidden?: number;
}

interface StockState {
  article?: string;
  size_label?: string;
  store_name?: string;
  state?: string;
}

interface CompactStock {
  version?: number;
  articles?: string[];
  sizes?: string[];
  stores?: string[];
  rows?: number[];
}

interface OverridesPayload {
  ok?: boolean;
  products?: ProductOverride[];
  photos?: PhotoOverride[];
  stock_states?: StockState[];
  stock_states_compact?: CompactStock;
}

export interface CatalogSource {
  products: SourceProduct[];
  bySku: Map<string, SourceProduct>;
  fetchedAt: string;
}

const cache = new Map<string, { t: number; v: unknown }>();
let sourcePromise: Promise<CatalogSource> | null = null;

function cacheGet<T>(key: string): T | null {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.t < TTL) return hit.v as T;
  return null;
}

function cacheSet(key: string, value: unknown) {
  cache.set(key, { t: Date.now(), v: value });
}

async function fetchText(path: string): Promise<string> {
  const response = await fetch(BASE + path, {
    headers: { "User-Agent": UA, Accept: path.endsWith(".php") ? "application/json" : "text/javascript" },
    redirect: "follow",
  });
  if (!response.ok) throw new Error(`adishop.by вернул ${response.status} для ${path}`);
  return response.text();
}

function finiteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeSizeKey(value: unknown): string {
  return String(value ?? "").trim().replace(",", ".").toUpperCase();
}

function hasStock(product: SourceProduct): boolean {
  return product.sizes.some((size) => {
    const storeQuantities = Object.values(size.stores ?? {});
    if (storeQuantities.length > 0) return storeQuantities.some((quantity) => Number(quantity) > 0);
    return Number(size.total) > 0;
  });
}

function safeImagePath(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const path = value.trim().replace(/^\//, "");
  if (!/^(?:images|photos|images-svg)\/[A-Za-z0-9А-Яа-яЁё._/-]+$/.test(path)) return null;
  if (path.split("/").some((part) => part === "." || part === "..")) return null;
  return path;
}

function imageUrl(value: unknown): string | null {
  const path = safeImagePath(value);
  return path ? BASE + path : null;
}

function isKidsShoeProduct(product: SourceProduct): boolean {
  if (product.category !== "shoes") return false;
  const enrich = product.enrich ?? {};
  const kidsMarkers = [
    product.title,
    enrich.displayName,
    enrich.description,
    enrich.shortDesc,
    ...(enrich.bullets ?? []),
    enrich.gender,
    enrich.productType,
    enrich.productGroup,
    enrich.ageGroup,
    enrich.targetAudience,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return /(^|[\s/_-])(kids?|children|child|junior|youth|infant)(?=$|[\s/_-])|для\s+дет|детск|юниор|малыш/i.test(
    kidsMarkers,
  );
}

function matchesGender(product: SourceProduct, gender: Gender): boolean {
  const kids = isKidsShoeProduct(product);
  if (gender === "kids") return kids;
  if (kids) return false;
  const sourceGender = product.enrich?.gender;
  if (gender === "man") return sourceGender === "Мужской" || sourceGender === "Унисекс";
  return sourceGender === "Женский" || sourceGender === "Унисекс";
}

function getPricing(product: SourceProduct): {
  current: number | null;
  old: number | null;
  discount: number | null;
} {
  const base = finiteNumber(product.price);
  const discount = finiteNumber(product.discountPercent);
  const old = finiteNumber(product.oldPrice);
  if (discount !== null && discount > 0 && discount < 100 && base !== null) {
    return {
      current: Math.round(base * (100 - discount)) / 100,
      old: base,
      discount,
    };
  }
  if (base !== null && old !== null && old > base) return { current: base, old, discount: null };
  return { current: base, old: null, discount: null };
}

function applyStockStates(products: SourceProduct[], bySku: Map<string, SourceProduct>, payload: OverridesPayload) {
  const compact = payload.stock_states_compact;
  const validCompact = Boolean(
    compact &&
      compact.version === 1 &&
      Array.isArray(compact.articles) &&
      Array.isArray(compact.sizes) &&
      Array.isArray(compact.stores) &&
      Array.isArray(compact.rows) &&
      compact.rows.length % 4 === 0,
  );
  const validStores = new Set(
    validCompact && compact?.stores
      ? compact.stores
      : products.flatMap((product) => product.sizes.flatMap((size) => Object.keys(size.stores ?? {}))),
  );
  const touched = new Set<SourceProduct>();
  const sizeIndexes = new Map<SourceProduct, Map<string, SourceSize>>();

  function applyState(
    product: SourceProduct | undefined,
    sizeLabel: string,
    store: string,
    state: string,
  ) {
    const sizeKey = normalizeSizeKey(sizeLabel);
    if (
      !product ||
      !sizeKey ||
      !validStores.has(store) ||
      !["available", "last_unit", "unavailable"].includes(state)
    ) {
      return;
    }
    let sizeIndex = sizeIndexes.get(product);
    if (!sizeIndex) {
      sizeIndex = new Map();
      for (const row of product.sizes) {
        const key = normalizeSizeKey(row.size);
        if (!sizeIndex.has(key)) sizeIndex.set(key, row);
      }
      sizeIndexes.set(product, sizeIndex);
    }
    let sizeRow = sizeIndex.get(sizeKey);
    if (!sizeRow) {
      sizeRow = { size: sizeLabel, total: 0, stores: {} };
      product.sizes.push(sizeRow);
      sizeIndex.set(sizeKey, sizeRow);
    }
    if (!sizeRow.stores) sizeRow.stores = {};
    const currentQuantity = Math.max(0, Number(sizeRow.stores[store]) || 0);
    if (state === "unavailable") sizeRow.stores[store] = 0;
    if (state === "last_unit") sizeRow.stores[store] = 1;
    if (state === "available" && currentQuantity <= 0) sizeRow.stores[store] = 2;
    touched.add(product);
  }

  if (validCompact && compact?.rows && compact.articles && compact.sizes && compact.stores) {
    const states = ["unavailable", "last_unit", "available"];
    for (let index = 0; index < compact.rows.length; index += 4) {
      const article = compact.articles[compact.rows[index] ?? -1];
      const size = compact.sizes[compact.rows[index + 1] ?? -1];
      const store = compact.stores[compact.rows[index + 2] ?? -1];
      const state = states[compact.rows[index + 3] ?? -1];
      if (!article || !size || !store || !state) continue;
      applyState(bySku.get(article.trim().toUpperCase()), size, store, state);
    }
  } else if (Array.isArray(payload.stock_states)) {
    for (const row of payload.stock_states) {
      if (!row.article || !row.size_label || !row.store_name || !row.state) continue;
      applyState(
        bySku.get(row.article.trim().toUpperCase()),
        row.size_label,
        row.store_name,
        row.state,
      );
    }
  }

  for (const product of touched) {
    for (const size of product.sizes) {
      size.total = Object.values(size.stores ?? {}).reduce(
        (sum, quantity) => sum + Math.max(0, Number(quantity) || 0),
        0,
      );
    }
    product.totalStock = product.sizes.reduce((sum, size) => sum + Number(size.total || 0), 0);
  }
}

export function parseCatalogSource(dataJs: string, overridesPayload: OverridesPayload): CatalogSource {
  const declaration = dataJs.indexOf("const PRODUCTS");
  const arrayStart = declaration >= 0 ? dataJs.indexOf("[", declaration) : -1;
  const arrayEnd = arrayStart >= 0 ? dataJs.indexOf("\n];", arrayStart) : -1;
  if (arrayStart < 0 || arrayEnd < 0) throw new Error("Не удалось прочитать обновлённый каталог adishop.by");
  const parsed = JSON.parse(dataJs.slice(arrayStart, arrayEnd + 2)) as SourceProduct[];
  const products = parsed.map((product) => ({
    ...product,
    sizes: Array.isArray(product.sizes) ? product.sizes : [],
    enrich: product.enrich ?? {},
  }));
  const bySku = new Map<string, SourceProduct>();
  const byId = new Map<string, SourceProduct>();
  for (const product of products) {
    bySku.set(String(product.sku).trim().toUpperCase(), product);
    byId.set(product.id, product);
  }

  for (const override of overridesPayload.products ?? []) {
    const article = String(override.article ?? "").trim().toUpperCase();
    const product = (override.product_key ? byId.get(override.product_key) : undefined) ?? bySku.get(article);
    if (!product) continue;
    product.enrich = product.enrich ?? {};
    if (override.title) {
      product.title = override.title;
      product.enrich.displayName = override.title;
    }
    if (override.short_description) product.enrich.shortDesc = override.short_description;
    if (override.full_description) product.enrich.description = override.full_description;
    const priceOverride = finiteNumber(override.price_override);
    if (priceOverride !== null) product.price = priceOverride;
    const salePrice = finiteNumber(override.sale_price);
    if (salePrice !== null) {
      product.oldPrice = product.price;
      product.price = salePrice;
    }
    const discount = finiteNumber(override.discount_percent);
    if (discount !== null) product.discountPercent = discount;
    product.adminHidden = Number(override.is_hidden) === 1;
  }

  const photosByArticle = new Map<string, PhotoOverride[]>();
  for (const photo of overridesPayload.photos ?? []) {
    if (Number(photo.is_hidden) === 1 || !photo.article || !safeImagePath(photo.file_path)) continue;
    const article = photo.article.trim().toUpperCase();
    const photos = photosByArticle.get(article) ?? [];
    photos.push(photo);
    photosByArticle.set(article, photos);
  }
  for (const [article, photos] of photosByArticle) {
    const product = bySku.get(article);
    if (!product) continue;
    photos.sort((left, right) => Number(left.sort_order ?? 0) - Number(right.sort_order ?? 0));
    product.photos = photos.map((photo) => photo.file_path).filter((path): path is string => Boolean(path));
  }

  applyStockStates(products, bySku, overridesPayload);
  return { products, bySku, fetchedAt: new Date().toISOString() };
}

export function catalogItemsFromSource(source: CatalogSource, gender: Gender): CatalogItem[] {
  const items: CatalogItem[] = [];
  for (const product of source.products) {
    if (
      product.category !== "shoes" ||
      product.adminHidden ||
      product.publicHidden ||
      product.hiddenFromPublic ||
      !matchesGender(product, gender) ||
      !hasStock(product)
    ) {
      continue;
    }
    const pricing = getPricing(product);
    if (pricing.current === null || pricing.current <= 0) continue;
    const subtitle = [product.enrich?.color, product.sku].filter(Boolean).join(" · ");
    items.push({
      id: product.id,
      url: `product/${String(product.sku).toUpperCase()}/`,
      title: product.enrich?.displayName || product.title,
      subtitle,
      image: imageUrl(product.photos?.[0]),
      price: pricing.current,
      oldPrice: pricing.old,
      discount: pricing.discount,
      gender,
    });
  }
  return items;
}

export function productDetailFromSource(source: CatalogSource, url: string): ProductDetail {
  const match = url.match(/^product\/([A-Z0-9]+)\/$/i);
  const product = match?.[1] ? source.bySku.get(match[1].toUpperCase()) : undefined;
  if (!product || product.adminHidden) throw new Error("Товар не найден на обновлённом сайте adishop.by");
  const pricing = getPricing(product);
  const inStock = hasStock(product);
  const enrich = product.enrich ?? {};
  const description = [
    enrich.shortDesc,
    enrich.description,
    ...(enrich.bullets ?? []).flatMap((bullet) => bullet.split("|")),
  ]
    .map((text) => text?.trim())
    .filter((text): text is string => Boolean(text && text.length > 1));
  const availableSizes = product.sizes
    .filter((size) => Number(size.total) > 0)
    .map((size) => size.size)
    .sort((left, right) => left.localeCompare(right, "ru", { numeric: true }));

  return {
    title: enrich.displayName || product.title,
    availability: inStock ? "В наличии" : "Нет в наличии",
    inStock,
    sku: product.sku,
    price: pricing.current,
    oldPrice: pricing.old,
    discount: pricing.discount,
    description: [...new Set(description)],
    images: (product.photos ?? []).map(imageUrl).filter((image): image is string => Boolean(image)),
    availableSizes,
    sourceUrl: BASE + `product/${String(product.sku).toUpperCase()}/`,
  };
}

async function loadSource(): Promise<CatalogSource> {
  const [dataJs, overridesText] = await Promise.all([
    fetchText("data.js"),
    fetchText("api/catalog-overrides.php?stock_states=1&stock_format=compact-v1"),
  ]);
  const payload = JSON.parse(overridesText) as OverridesPayload;
  if (!payload.ok) throw new Error("adishop.by не вернул актуальные цены и остатки");
  return parseCatalogSource(dataJs, payload);
}

async function getSource(): Promise<CatalogSource> {
  const cached = cacheGet<CatalogSource>("source");
  if (cached) return cached;
  if (!sourcePromise) {
    sourcePromise = loadSource().finally(() => {
      sourcePromise = null;
    });
  }
  const source = await sourcePromise;
  cacheSet("source", source);
  return source;
}

export async function getCatalogForGender(gender: Gender): Promise<CatalogResult> {
  const source = await getSource();
  return { items: catalogItemsFromSource(source, gender), updatedAt: source.fetchedAt };
}

export async function getProductDetail(url: string): Promise<ProductDetail> {
  if (!/^product\/[A-Z0-9]+\/$/i.test(url)) {
    throw new Error("Эта старая ссылка больше не поддерживается обновлённым сайтом adishop.by");
  }
  const source = await getSource();
  return productDetailFromSource(source, url);
}
