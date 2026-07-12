import { createServerFn } from "@tanstack/react-start";
import { getCatalogForGender, getProductDetail } from "./adishop.server";
import type { Gender } from "./adishop-types";

export const getCatalog = createServerFn({ method: "GET" })
  .inputValidator((input: { gender: Gender }) => {
    if (!["man", "woman", "kids"].includes(input?.gender)) {
      throw new Error("Некорректная категория");
    }
    return input;
  })
  .handler(async ({ data }) => {
    return getCatalogForGender(data.gender);
  })

export const getProduct = createServerFn({ method: "GET" })
  .inputValidator((input: { url: string }) => {
    const url = input?.url ?? "";
    if (!url.startsWith("catalog/") || !url.endsWith(".html") || url.includes("..")) {
      throw new Error("Некорректная ссылка на товар");
    }
    return { url };
  })
  .handler(async ({ data }) => {
    return getProductDetail(data.url);
  })
