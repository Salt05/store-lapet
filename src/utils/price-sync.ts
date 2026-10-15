import { isB2BUser } from "./auth";

function formatPrice(v:number){
  return v.toLocaleString("vi-VN")+"đ";
}

export function updateAllPrices(){

  const dealer=isB2BUser();

  document.querySelectorAll("[data-retail-price]").forEach(card=>{

    const retail=Number(card.getAttribute("data-retail-price")||0);
    const wholesale=Number(card.getAttribute("data-wholesale-price")||0);

    const active=dealer&&wholesale>0?wholesale:retail;

    card.setAttribute("data-effective-price",String(active));

    const label=card.querySelector(".product-price-label");
    const strike=card.querySelector(".product-price-strike");

    if(label) label.textContent=formatPrice(active);

    if(strike){
      if(dealer&&wholesale>0&&retail>wholesale){
        strike.textContent=formatPrice(retail);
        strike.classList.remove("hidden");
      }else{
        strike.classList.add("hidden");
      }
    }
  });

  window.dispatchEvent(new Event("price-updated"));
}