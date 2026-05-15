/* ================================================
   CART PAGE — JS
   ================================================ */

document.addEventListener("DOMContentLoaded", () => {

  const navbar = document.getElementById("navbar");
  window.addEventListener("scroll", () => {
    navbar?.classList.toggle("scrolled", window.scrollY > 50);
  }, { passive: true });

  let appliedCoupon = null;
  const COUPONS = {
    "LECTOR10": 10,
    "UNIVERSO20": 20,
    "LIBROS15": 15
  };

  function render() {
    const items   = Cart.getItems();
    const itemsEl = document.getElementById("cart-page-items");
    const emptyEl = document.getElementById("cart-page-empty");
    const layoutEl = document.querySelector(".cart-page-layout");

    if (items.length === 0) {
      if (itemsEl)  itemsEl.style.display   = "none";
      if (layoutEl) layoutEl.style.display  = "none";
      if (emptyEl)  emptyEl.style.display   = "block";
      return;
    }

    if (itemsEl)  itemsEl.style.display   = "flex";
    if (layoutEl) layoutEl.style.display  = "grid";
    if (emptyEl)  emptyEl.style.display   = "none";

    if (itemsEl) {
      itemsEl.innerHTML = items.map(item => `
        <div class="cart-page-item" id="cpi-${item.id}">
          <img class="cpi-img" src="${item.cover}" alt="${item.title}" loading="lazy" />
          <div class="cpi-info">
            <div class="cpi-title">${item.title}</div>
            <div class="cpi-author">${item.author}</div>
            <div class="cpi-actions">
              <div class="cpi-qty-control">
                <button data-action="minus" data-id="${item.id}" aria-label="Reducir">−</button>
                <span>${item.qty}</span>
                <button data-action="plus" data-id="${item.id}" aria-label="Aumentar">+</button>
              </div>
              <span class="cpi-remove" data-id="${item.id}" role="button">🗑 Eliminar</span>
            </div>
          </div>
          <div class="cpi-price">
            <span class="current">${formatPrice(item.price * item.qty)}</span>
            <span class="each">${item.qty > 1 ? formatPrice(item.price) + " c/u" : ""}</span>
          </div>
        </div>
      `).join("");

      // Events
      itemsEl.querySelectorAll("[data-action='minus']").forEach(btn =>
        btn.addEventListener("click", () => { Cart.updateQty(+btn.dataset.id, -1); render(); }));
      itemsEl.querySelectorAll("[data-action='plus']").forEach(btn =>
        btn.addEventListener("click", () => { Cart.updateQty(+btn.dataset.id, +1); render(); }));
      itemsEl.querySelectorAll(".cpi-remove").forEach(el =>
        el.addEventListener("click", () => { Cart.remove(+el.dataset.id); render(); }));
    }

    updateSummary();
  }

  function updateSummary() {
    const sub = Cart.getSubtotal();
    const shipping = sub >= 25 ? 0 : 4.99;
    let discount = 0;
    if (appliedCoupon) discount = (sub * appliedCoupon / 100);
    const total = Math.max(0, sub - discount + shipping);

    const fmt = v => formatPrice(v);
    const el = id => document.getElementById(id);

    if (el("summary-subtotal")) el("summary-subtotal").textContent = fmt(sub);
    if (el("summary-shipping")) {
      el("summary-shipping").textContent = shipping === 0 ? "¡GRATIS! 🎉" : fmt(shipping);
      el("summary-shipping").style.color = shipping === 0 ? "var(--color-success)" : "";
    }
    if (el("summary-total")) el("summary-total").textContent = fmt(total);

    const discRow = el("discount-row");
    if (discRow) discRow.style.display = discount > 0 ? "flex" : "none";
    if (el("summary-discount")) el("summary-discount").textContent = "-" + fmt(discount);
  }

  /* ---- Coupon ---- */
  document.getElementById("coupon-apply-btn")?.addEventListener("click", () => {
    const code = document.getElementById("coupon-input")?.value.trim().toUpperCase();
    const msg  = document.getElementById("coupon-msg");
    if (!code) return;
    if (COUPONS[code]) {
      appliedCoupon = COUPONS[code];
      if (msg) {
        msg.textContent = `✅ Cupón aplicado: ${appliedCoupon}% de descuento`;
        msg.style.color = "var(--color-success)";
      }
      updateSummary();
    } else {
      if (msg) {
        msg.textContent = "❌ Cupón inválido o expirado";
        msg.style.color = "var(--color-danger)";
      }
    }
  });

  /* ---- Checkout btn ---- */
  document.getElementById("checkout-btn")?.addEventListener("click", e => {
    if (Cart.getItems().length === 0) { e.preventDefault(); return; }
    if (typeof Analytics !== "undefined")
      Analytics.beginCheckout(Cart.getItems(), Cart.getSubtotal());
  });

  /* ---- Recommended ---- */
  const recCarousel = document.getElementById("cart-rec-carousel");
  if (recCarousel) {
    const cartIds  = Cart.getItems().map(i => i.id);
    const recBooks = getFeatured().filter(b => !cartIds.includes(b.id)).slice(0, 5);
    recCarousel.innerHTML = recBooks.map(b => `
      <div class="book-card" onclick="window.location.href='producto.html?slug=${b.slug}'" style="cursor:pointer;min-width:200px">
        <div class="book-card-cover">
          ${b.badge ? `<span class="book-badge badge-${b.badge}">${b.badge === "bestseller" ? "🔥" : "✨"}</span>` : ""}
          <button class="book-share-btn" onclick="event.stopPropagation(); ShareBook.share(${b.id})" aria-label="Compartir libro">↗</button>
          <img src="${b.cover}" alt="${b.title}" loading="lazy" />
          <div class="book-card-quick-add"><button data-add-to-cart="${b.id}" onclick="event.stopPropagation()">🛒 Añadir</button></div>
        </div>
        <div class="book-card-body">
          <div class="book-title">${b.title}</div>
          <div class="book-author">${b.author}</div>
          <div class="book-price-row">
            <span class="book-price">${formatPrice(b.price)}</span>
            ${b.oldPrice ? `<span class="book-price-old">${formatPrice(b.oldPrice)}</span>` : ""}
          </div>
        </div>
      </div>
    `).join("");
  }

  render();
});
