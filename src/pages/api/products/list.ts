import type { APIRoute } from "astro";
import { directus } from "@/lib/directus";
import { readItems } from "@directus/sdk";

export const prerender=false;

export const GET:APIRoute=async()=>{

  const products=await directus.request(
    readItems("products",{
      fields:["*"]
    })
  );

  return new Response(JSON.stringify(products),{
    headers:{
      "Content-Type":"application/json"
    }
  });

};