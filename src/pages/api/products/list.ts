import type { APIRoute } from "astro";
import { directus } from "@/lib/directus";
import { readItems } from "@directus/sdk";
import { enrichWithPostgresData } from "@/lib/catalog";

export const prerender = false;

export const GET: APIRoute = async () => {
  try {
    const products = await directus.request(
      readItems("products", {
        fields: ["*"],
      })
    );

    const enriched = await enrichWithPostgresData(Array.isArray(products) ? products : []);
    const activeProducts = enriched.filter((p: any) => p.is_active !== false && p.status !== "archived");

    return new Response(JSON.stringify(activeProducts), {
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (err: any) {
    console.error("[API products/list] Error:", err);
    return new Response(JSON.stringify([]), {
      headers: { "Content-Type": "application/json" },
    });
  }
};