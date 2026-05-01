/* ================================================
   CART — Persistent cart with localStorage
   ================================================ */

const Cart = (() => {
  const KEY = "lu_cart";

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; }
    catch { return []; }
  }
  function save(items) {
    localStorage.setItem(KEY, JSON.stringify(items));
  }

  const state = { items: load() };

  function getItems()   { return state.items; }
  function getCount()   { return state.items.reduce((s, i) => s + i.qty, 0); }
  function getSubtotal(){ return state.items.reduce((s, i) => s + i.price * i.qty, 0); }

  function add(book, qty = 1) {
    const existing = state.items.find(i => i.id === book.id);
    if (existing) {
      existing.qty += qty;
    } else {
      state.items.push({
        id: book.id, title: book.title, author: book.author,
        price: book.price, cover: book.cover, slug: book.slug, qty
      });
    }
    save(state.items);
    updateUI();
    showToast(`"${book.title}" añadido al carrito`);
    if (typeof Analytics !== "undefined") Analytics.addToCart(book);
  }

  function remove(id) {
    state.items = state.items.filter(i => i.id !== id);
    save(state.items);
    updateUI();
  }

  function updateQty(id, delta) {
    const item = state.items.find(i => i.id === id);
    if (!item) return;
    item.qty = Math.max(1, item.qty + delta);
    save(state.items);
    updateUI();
  }

  function clear() {
    state.items = [];
    save(state.items);
    updateUI();
  }

  /* --- UI sync --- */
  function updateUI() {
    const count = getCount();
    document.querySelectorAll("#cart-count").forEach(el => {
      el.textContent = count;
      el.style.display = count > 0 ? "flex" : "none";
    });
    renderDrawer();
  }

  function renderDrawer() {
    const itemsEl = document.getElementById("cart-drawer-items");
    const footerEl = document.getElementById("cart-drawer-footer");
    const emptyEl  = document.getElementById("cart-empty");
    if (!itemsEl) return;

    const items = state.items;
    if (items.length === 0) {
      if (emptyEl) emptyEl.style.display = "flex";
      if (footerEl) footerEl.style.display = "none";
      // Clear existing items but keep empty state
      const existing = itemsEl.querySelectorAll(".cart-item");
      existing.forEach(el => el.remove());
      return;
    }

    if (emptyEl) emptyEl.style.display = "none";
    if (footerEl) footerEl.style.display = "flex";

    // Rebuild items
    const existing = itemsEl.querySelectorAll(".cart-item");
    existing.forEach(el => el.remove());

    items.forEach(item => {
      const el = document.createElement("div");
      el.className = "cart-item";
      el.dataset.id = item.id;
      el.innerHTML = `
        <img class="cart-item-img" src="${item.cover}" alt="${item.title}" loading="lazy" />
        <div class="cart-item-info">
          <div class="cart-item-title">${item.title}</div>
          <div class="cart-item-author">${item.author}</div>
          <div class="cart-item-controls">
            <button class="qty-btn qty-minus" data-id="${item.id}" aria-label="Reducir cantidad">−</button>
            <span class="qty-num">${item.qty}</span>
            <button class="qty-btn qty-plus" data-id="${item.id}" aria-label="Aumentar cantidad">+</button>
            <span class="cart-item-remove" data-id="${item.id}" role="button" tabindex="0">Eliminar</span>
          </div>
        </div>
        <div class="cart-item-price">${formatPrice(item.price * item.qty)}</div>
      `;
      itemsEl.appendChild(el);
    });

    // Subtotal
    const sub = getSubtotal();
    const subEl = document.getElementById("cart-subtotal-price");
    if (subEl) subEl.textContent = formatPrice(sub);

    // Free shipping hint
    const freeEl = document.getElementById("cart-free-shipping");
    if (freeEl) {
      if (sub >= 25) {
        freeEl.textContent = "Envío gratis incluido";
        freeEl.style.color = "var(--color-success)";
      } else {
        const left = (25 - sub).toFixed(2);
        freeEl.textContent = `Agregá $${left} más para envío gratis`;
        freeEl.style.color = "var(--color-text-2)";
      }
    }

    // Event delegation for qty and remove
    itemsEl.querySelectorAll(".qty-minus").forEach(btn =>
      btn.onclick = () => updateQty(+btn.dataset.id, -1));
    itemsEl.querySelectorAll(".qty-plus").forEach(btn =>
      btn.onclick = () => updateQty(+btn.dataset.id, +1));
    itemsEl.querySelectorAll(".cart-item-remove").forEach(el =>
      el.onclick = () => remove(+el.dataset.id));
  }

  /* --- Toast --- */
  let toastTimer;
  function showToast(msg) {
    const toast = document.getElementById("toast");
    const msgEl = document.getElementById("toast-msg");
    if (!toast) return;
    if (msgEl) msgEl.textContent = msg;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2800);
  }

  /* --- Drawer toggle --- */
  function openDrawer() {
    document.getElementById("cart-drawer")?.classList.add("open");
    document.getElementById("cart-overlay")?.classList.add("open");
    document.body.style.overflow = "hidden";
  }
  function closeDrawer() {
    document.getElementById("cart-drawer")?.classList.remove("open");
    document.getElementById("cart-overlay")?.classList.remove("open");
    document.body.style.overflow = "";
  }

  /* --- Init --- */
  function init() {
    updateUI();

    document.getElementById("cart-btn")?.addEventListener("click", openDrawer);
    document.getElementById("cart-close")?.addEventListener("click", closeDrawer);
    document.getElementById("cart-overlay")?.addEventListener("click", closeDrawer);

    // Delegate add-to-cart clicks anywhere on the page
    document.addEventListener("click", e => {
      const btn = e.target.closest("[data-add-to-cart]");
      if (!btn) return;
      const id = +btn.dataset.addToCart;
      const book = getBookById(id);
      if (book) add(book);
    });
  }

  document.addEventListener("DOMContentLoaded", init);

  return { add, remove, updateQty, clear, getItems, getCount, getSubtotal, openDrawer, closeDrawer, showToast };
})();
