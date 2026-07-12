import type { CatalogItem, CatalogResult, Gender, ProductDetail } from "./adishop-types";

const BASE = "https://www.adishop.by/";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const CATEGORIES: Record<Gender, string[]> = {
  man: ["catalog/man/shoes/running-shoes-sneakers-football-boots/"],
  woman: ["catalog/woman/shoes/running-shoes-sneakers-football-boots/"],
  kids: ["catalog/kids/teenager/shoes-for-boys/", "catalog/kids/baby/shoes/"],
};

const TTL = 3 * 60 * 1000; // 3 минуты — свежие данные при каждом открытии, но без лишней нагрузки
const cache = new Map<string, { t: number; v: unknown }>();

function cacheGet<T>(key: string): T | null {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.t < TTL) return hit.v as T;
  return null;
}

function cacheSet(key: string, v: unknown) {
  cache.set(key, { t: Date.now(), v });
}

async function fetchHtml(path: string): Promise<string> {
  const res = await fetch(BASE + path, {
    headers: { "User-Agent": UA, Accept: "text/html" },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`adishop.by вернул ${res.status} для ${path}`);
  return res.text();
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

function parseMoney(text: string): number | null {
  const m = text.match(/(\d+)\s*р\.\s*(\d+)/);
  if (!m) return null;
  return parseInt(m[1], 10) + parseInt(m[2], 10) / 100;
}

function parseCards(html: string, gender: Gender): CatalogItem[] {
  const chunks = html.split('<div class="hockeycard shk-item">').slice(1);
  const items: CatalogItem[] = [];
  for (const c of chunks) {
    const url = c.match(/href="(catalog\/[^"]+\.html)"/)?.[1];
    const img = c.match(/src="(\/assets\/images\/products\/[^"]+)"/)?.[1];
    const title = c.match(/<div class="title">([\s\S]*?)<\/div>/)?.[1];
    const subtitle = c.match(/<div class="subtitle">([\s\S]*?)<\/div>/)?.[1] ?? "";
    const priceRaw = c.match(/name="myprice" value="([\d.]+)"/)?.[1];
    const baseRaw = c.match(/class="baseprice">([^<]+)</)?.[1];
    const discount = c.match(/class="percent">\s*-?(\d+)\s*%/)?.[1];
    const id = c.match(/name="shk-id" value="(\d+)"/)?.[1];
    if (!url || !title || !priceRaw || !id) continue;
    items.push({
      id,
      url,
      title: decodeEntities(title),
      subtitle: decodeEntities(subtitle),
      image: img ? BASE.slice(0, -1) + img : null,
      price: parseFloat(priceRaw),
      oldPrice: baseRaw ? parseMoney(baseRaw) : null,
      discount: discount ? parseInt(discount, 10) : null,
      gender,
    });
  }
  return items;
}

function parseTotalPages(html: string): number {
  let max = 1;
  for (const m of html.matchAll(/\?page=(\d+)/g)) {
    max = Math.max(max, parseInt(m[1], 10));
  }
  return max;
}

async function mapLimit<T, R>(arr: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(arr.length);
  let i = 0;
  async function worker() {
    while (i < arr.length) {
      const idx = i++;
      results[idx] = await fn(arr[idx]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, arr.length) }, worker));
  return results;
}

export async function getCatalogForGender(gender: Gender): Promise<CatalogResult> {
  const key = `catalog:${gender}`;
  const hit = cacheGet<CatalogResult>(key);
  if (hit) return hit;

  const items: CatalogItem[] = [];
  for (const cat of CATEGORIES[gender]) {
    let first: string;
    try {
      first = await fetchHtml(cat);
    } catch {
      continue;
    }
    items.push(...parseCards(first, gender));
    const total = parseTotalPages(first);
    if (total > 1) {
      const pages = Array.from({ length: total - 1 }, (_, i) => i + 2);
      const rest = await mapLimit(pages, 6, (p) =>
        fetchHtml(`${cat}?page=${p}`)
          .then((h) => parseCards(h, gender))
          .catch(() => [] as CatalogItem[]),
      );
      for (const r of rest) items.push(...r);
    }
  }

  const seen = new Set<string>();
  const unique = items.filter((it) => {
    if (seen.has(it.id)) return false;
    seen.add(it.id);
    return true;
  });

  const result: CatalogResult = { items: unique, updatedAt: new Date().toISOString() };
  if (unique.length > 0) cacheSet(key, result);
  return result;
}

export async function getProductDetail(url: string): Promise<ProductDetail> {
  const key = `product:${url}`;
  const hit = cacheGet<ProductDetail>(key);
  if (hit) return hit;

  const html = await fetchHtml(url);

  const title = decodeEntities(
    html
      .match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1]
      ?.replace(/<[^>]+>/g, "") ?? "Товар",
  );
  const availability = html.match(/class="availability[^"]*">([^<]*)</)?.[1]?.trim() ?? null;
  const inStock = /availability in_stock/.test(html);
  const sku = html.match(/class="selectedvarval swatches_info">([^<]*)</)?.[1]?.trim() ?? null;
  const priceRaw = html.match(/name="myprice" value="([\d.]+)"/)?.[1];
  const oldRaw = html.match(/class="standardprice">([^<]+)</)?.[1];
  const discount = html.match(/class="percent">\s*-?(\d+)\s*%/)?.[1];

  const descBlock = html.match(/<div class="short_description">([\s\S]*?)<\/div>/)?.[1] ?? "";
  const description = [...descBlock.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)]
    .map((m) => decodeEntities(m[1].replace(/<[^>]+>/g, "")))
    .filter((t) => t.length > 1);

  const images = [
    ...new Set(
      [...html.matchAll(/\/assets\/images\/products\/\d+\/440x\/[^"']+/g)].map(
        (m) => BASE.slice(0, -1) + m[0],
      ),
    ),
  ];

  const detail: ProductDetail = {
    title,
    availability,
    inStock,
    sku,
    price: priceRaw ? parseFloat(priceRaw) : null,
    oldPrice: oldRaw ? parseMoney(oldRaw) : null,
    discount: discount ? parseInt(discount, 10) : null,
    description,
    images,
    sourceUrl: BASE + url,
  };
  cacheSet(key, detail);
  return detail;
}
