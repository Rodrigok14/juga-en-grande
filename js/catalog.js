/* ================================================
   CATALOG JS — Filtering, sorting, pagination
   ================================================ */

document.addEventListener("DOMContentLoaded", () => {

  /* ---- Parse URL params ---- */
  const params  = new URLSearchParams(window.location.search);
  const initQ   = params.get("q")      || "";
  const initCat = params.get("cat")    || "";
  const initSort= params.get("sort")   || "popular";
  const initOff = params.get("offer")  === "1";
  const initFmt = params.get("format") || "";

  /* ---- State ---- */
  const state = {
    q: initQ, cat: initCat, sort: initSort,
    offer: initOff, format: initFmt,
    maxPrice: 30000, page: 1, perPage: 12,
    view: "grid"
  };

  /* ---- Apply initial values to UI ---- */
  if (initCat) {
    const radio = document.querySelector(`input[name="cat"][value="${initCat}"]`);
    if (radio) radio.checked = true;
  }
  if (initSort) {
    const sel = document.getElementById("sort-select");
    if (sel) sel.value = initSort;
  }
  if (initFmt) {
    const radio = document.querySelector(`input[name="format"][value="${initFmt}"]`);
    if (radio) radio.checked = true;
  }
  if (initOff) {
    const cb = document.getElementById("filter-offer");
    if (cb) cb.checked = true;
  }

  /* ---- Navbar scroll ---- */
  const navbar = document.getElementById("navbar");
  window.addEventListener("scroll", () => {
    navbar?.classList.toggle("scrolled", window.scrollY > 50);
  }, { passive: true });

  /* ---- Hamburger ---- */
  document.getElementById("hamburger")?.addEventListener("click", () => {
    document.getElementById("mobile-menu")?.classList.toggle("open");
  });

  /* ---- Mobile filter toggle ---- */
  document.getElementById("filter-toggle-btn")?.addEventListener("click", () => {
    document.getElementById("catalog-sidebar")?.classList.toggle("open");
  });

  /* ---- Filters ---- */
  document.querySelectorAll("input[name='cat']").forEach(r =>
    r.addEventListener("change", () => { state.cat = r.value; state.page = 1; render(); }));

  document.querySelectorAll("input[name='format']").forEach(r =>
    r.addEventListener("change", () => { state.format = r.value; state.page = 1; render(); }));

  document.getElementById("price-range")?.addEventListener("input", e => {
    state.maxPrice = +e.target.value;
    document.getElementById("price-label").textContent = `$${state.maxPrice}`;
    state.page = 1; render();
  });

  document.getElementById("filter-offer")?.addEventListener("change", e => {
    state.offer = e.target.checked; state.page = 1; render();
  });

  document.getElementById("sort-select")?.addEventListener("change", e => {
    state.sort = e.target.value; render();
  });

  document.getElementById("clear-filters-btn")?.addEventListener("click", () => {
    state.q = ""; state.cat = ""; state.sort = "popular";
    state.offer = false; state.format = ""; state.maxPrice = 50000;
    state.page = 1;
    document.querySelectorAll("input[name='cat']")[0].checked = true;
    document.querySelectorAll("input[name='format']")[0].checked = true;
    const pr = document.getElementById("price-range");
    if (pr) pr.value = 50000;
    document.getElementById("price-label").textContent = "$50000";
    const ofCb = document.getElementById("filter-offer");
    if (ofCb) ofCb.checked = false;
    document.getElementById("sort-select").value = "popular";
    render();
  });

  /* ---- View toggle ---- */
  document.getElementById("view-grid")?.addEventListener("click", () => {
    state.view = "grid";
    document.getElementById("view-grid")?.classList.add("active");
    document.getElementById("view-list")?.classList.remove("active");
    document.getElementById("books-grid")?.classList.remove("list-view");
  });
  document.getElementById("view-list")?.addEventListener("click", () => {
    state.view = "list";
    document.getElementById("view-list")?.classList.add("active");
    document.getElementById("view-grid")?.classList.remove("active");
    document.getElementById("books-grid")?.classList.add("list-view");
  });

  /* ---- Nav search ---- */
  const navInput = document.getElementById("nav-search-input");
  const navDrop  = document.getElementById("search-dropdown");
  if (navInput) navInput.value = initQ;
  navInput?.addEventListener("keydown", e => {
    if (e.key === "Enter") {
      state.q = navInput.value.trim(); state.page = 1; render();
      navDrop?.classList.remove("open");
    }
  });

  /* ---- Filter & sort logic ---- */
  function getFiltered() {
    let books = [...BOOKS];

    if (state.q) {
      const q = state.q.toLowerCase();
      books = books.filter(b =>
        b.title.toLowerCase().includes(q) ||
        b.author.toLowerCase().includes(q) ||
        b.tags.some(t => t.includes(q))
      );
    }
    if (state.cat)    books = books.filter(b => b.category === state.cat);
    if (state.format) books = books.filter(b => b.format === state.format);
    if (state.offer)  books = books.filter(b => b.oldPrice !== null);
    books = books.filter(b => b.price <= state.maxPrice);

    switch (state.sort) {
      case "new":        books.sort((a,b) => (b.badge === "new") - (a.badge === "new")); break;
      case "price-asc":  books.sort((a,b) => a.price - b.price); break;
      case "price-desc": books.sort((a,b) => b.price - a.price); break;
      case "rating":     books.sort((a,b) => b.rating - a.rating); break;
      default:           books.sort((a,b) => b.reviews - a.reviews); break;
    }
    return books;
  }

  /* ---- Book card HTML ---- */
  function bookCardHTML(b) {
    const discount = b.oldPrice ? Math.round((1 - b.price / b.oldPrice) * 100) : null;
    const catName  = CATEGORIES.find(c => c.id === b.category)?.name || b.category;
    const isLowStock = b.stock > 0 && b.stock <= 5;
    return `
      <div class="book-card" id="book-${b.id}">
        <div class="book-card-cover" onclick="window.location.href='producto.html?slug=${b.slug}'" style="cursor:pointer">
          ${b.badge ? `<span class="book-badge badge-${b.badge}">${b.badge === "bestseller" ? "🔥 Best" : b.badge === "new" ? "✨ Nuevo" : "🏷️ Oferta"}</span>` : ""}
          <button class="book-wishlist-btn" onclick="event.stopPropagation(); toggleWishlist(${b.id}, this)" aria-label="Favoritos">♡</button>
          <button class="book-share-btn" onclick="event.stopPropagation(); ShareBook.share(${b.id})" aria-label="Compartir libro">↗</button>
          <img src="${b.cover}" alt="${b.title}" loading="lazy" />
          <div class="book-card-quick-add">
            <button data-add-to-cart="${b.id}">🛒 Añadir al carrito</button>
          </div>
        </div>
        <div class="book-card-body" onclick="window.location.href='producto.html?slug=${b.slug}'" style="cursor:pointer">
          <div class="book-category">${catName}</div>
          <div class="book-title">${b.title}</div>
          <div class="book-author">${b.author}</div>
          <div class="book-stars"><span class="stars">★★★★★</span><span class="count">(${b.reviews.toLocaleString()})</span></div>
          ${isLowStock ? `<div style="font-size:.72rem;color:#f87171;margin-top:2px">⚠️ ¡Solo ${b.stock} en stock!</div>` : ""}
          <div class="book-price-row">
            <span class="book-price">${formatPrice(b.price)}</span>
            ${b.oldPrice ? `<span class="book-price-old">${formatPrice(b.oldPrice)}</span>` : ""}
            ${discount ? `<span class="book-badge badge-sale" style="position:static;font-size:.65rem">-${discount}%</span>` : ""}
            <span class="book-format-tag">${b.format === "digital" ? "📱" : "📗"}</span>
          </div>
        </div>
      </div>
    `;
  }

  /* ---- Render ---- */
  function render() {
    const filtered = getFiltered();
    const total    = filtered.length;
    const pages    = Math.ceil(total / state.perPage);
    const start    = (state.page - 1) * state.perPage;
    const visible  = filtered.slice(start, start + state.perPage);

    const grid = document.getElementById("books-grid");
    const info = document.getElementById("results-count");

    if (info) info.innerHTML = `<strong>${total}</strong> libros encontrados${state.q ? ` para "<em>${state.q}</em>"` : ""}`;

    if (!grid) return;

    if (visible.length === 0) {
      grid.innerHTML = `
        <div class="catalog-empty">
          <div class="catalog-empty-icon">📭</div>
          <h3>Sin resultados</h3>
          <p>Prueba con otros filtros o términos de búsqueda.</p>
          <button class="btn btn-primary" onclick="document.getElementById('clear-filters-btn').click()">Limpiar filtros</button>
        </div>`;
      document.getElementById("pagination").innerHTML = "";
      return;
    }

    grid.innerHTML = visible.map(bookCardHTML).join("");
    if (state.view === "list") grid.classList.add("list-view");

    // Restore wishlist state
    const wl = JSON.parse(localStorage.getItem("lu_wishlist") || "[]");
    wl.forEach(id => {
      const btn = grid.querySelector(`#book-${id} .book-wishlist-btn`);
      if (btn) { btn.textContent = "♥"; btn.classList.add("active"); }
    });

    // Pagination
    renderPagination(pages);

    // Animate
    grid.querySelectorAll(".book-card").forEach((el, i) => {
      el.style.opacity = "0";
      el.style.transform = "translateY(15px)";
      el.style.transition = `opacity .35s ${i * 0.04}s ease, transform .35s ${i * 0.04}s ease`;
      requestAnimationFrame(() => { el.style.opacity = "1"; el.style.transform = "translateY(0)"; });
    });
  }

  function renderPagination(pages) {
    const pg = document.getElementById("pagination");
    if (!pg || pages <= 1) { if (pg) pg.innerHTML = ""; return; }
    let html = "";
    const max = 7;
    for (let i = 1; i <= Math.min(pages, max); i++) {
      html += `<button class="page-btn ${i === state.page ? "active" : ""}" data-page="${i}">${i}</button>`;
    }
    if (pages > max) html += `<span style="padding:0 8px;color:var(--color-text-3)">…</span>`;
    pg.innerHTML = html;
    pg.querySelectorAll(".page-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        state.page = +btn.dataset.page;
        render();
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    });
  }

  /* ---- Wishlist ---- */
  window.toggleWishlist = function(id, btn) {
    let wl = JSON.parse(localStorage.getItem("lu_wishlist") || "[]");
    if (wl.includes(id)) { wl = wl.filter(x => x !== id); btn.textContent = "♡"; btn.classList.remove("active"); }
    else { wl.push(id); btn.textContent = "♥"; btn.classList.add("active"); }
    localStorage.setItem("lu_wishlist", JSON.stringify(wl));
  };

  render();
});
