import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  catalogItemsFromSource,
  parseCatalogSource,
  productDetailFromSource,
} from "./adishop.server";

function fixtureProduct(sku: string, gender: string, ageGroup?: string) {
  return {
    id: sku.toLowerCase(),
    sku,
    title: "SHOES - LOW (NON FOOTBALL)",
    category: "shoes",
    price: 458,
    oldPrice: null,
    sizes: [{ size: "8", total: 1, stores: { Минск: 1 } }],
    totalStock: 1,
    photos: [`images/${sku}/1.webp`],
    enrich: {
      displayName: `Кроссовки ${sku}`,
      shortDesc: "Короткое описание",
      description: "Полное описание",
      bullets: ["Кожа | Шнуровка"],
      gender,
      ...(ageGroup ? { ageGroup } : {}),
      color: "белый",
      productType: "SHOES - LOW (NON FOOTBALL)",
      productGroup: "SHOES",
    },
  };
}

function makeSource() {
  const products = [fixtureProduct("B75806", "Мужской"), fixtureProduct("KID001", "Унисекс", "KIDS")];
  return parseCatalogSource(`const PRODUCTS = ${JSON.stringify(products, null, 2)};`, {
    ok: true,
    products: [
      {
        product_key: "b75806",
        article: "B75806",
        price_override: "458.00",
        discount_percent: "20.00",
        is_hidden: 0,
      },
    ],
    photos: [
      { article: "B75806", file_path: "images/B75806/1.webp", sort_order: 2, is_hidden: 0 },
      { article: "B75806", file_path: "images/B75806/2.webp", sort_order: 1, is_hidden: 0 },
    ],
    stock_states_compact: {
      version: 1,
      articles: ["B75806", "KID001"],
      sizes: ["8"],
      stores: ["Минск"],
      rows: [0, 0, 0, 2, 1, 0, 0, 2],
    },
  });
}

describe("обновлённый источник adishop.by", () => {
  it("применяет действующую скидку и порядок фотографий", () => {
    const [item] = catalogItemsFromSource(makeSource(), "man");
    assert.equal(item?.price, 366.4);
    assert.equal(item?.oldPrice, 458);
    assert.equal(item?.discount, 20);
    assert.equal(item?.image, "https://www.adishop.by/images/B75806/2.webp");
    assert.equal(item?.url, "product/B75806/");
  });

  it("показывает унисекс взрослым, но не смешивает детские модели со взрослыми", () => {
    const source = makeSource();
    assert.deepEqual(catalogItemsFromSource(source, "man").map((item) => item.id), ["b75806"]);
    assert.deepEqual(catalogItemsFromSource(source, "woman").map((item) => item.id), []);
    assert.deepEqual(catalogItemsFromSource(source, "kids").map((item) => item.id), ["kid001"]);
  });

  it("возвращает описание, остатки и доступные размеры по новой ссылке", () => {
    const detail = productDetailFromSource(makeSource(), "product/B75806/");
    assert.equal(detail.title, "Кроссовки B75806");
    assert.equal(detail.inStock, true);
    assert.deepEqual(detail.availableSizes, ["8"]);
    assert.ok(detail.description.includes("Полное описание"));
    assert.equal(detail.images[0], "https://www.adishop.by/images/B75806/2.webp");
  });
});
