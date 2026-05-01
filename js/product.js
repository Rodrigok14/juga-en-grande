/* ================================================
   PRODUCT PAGE — JS Logic
   ================================================ */

document.addEventListener("DOMContentLoaded", () => {

  /* ---- Navbar scroll ---- */
  const navbar = document.getElementById("navbar");
  window.addEventListener("scroll", () => {
    navbar?.classList.toggle("scrolled", window.scrollY > 50);
  }, { passive: true });

  /* ---- Get book ---- */
  const params = new URLSearchParams(window.location.search);
  const slug   = params.get("slug");
  const book   = slug ? getBookBySlug(slug) : null;

  if (!book) {
    document.getElementById("product-loading").innerHTML = `
      <div style="text-align:center;padding:80px 20px;grid-column:1/-1">
        <div style="font-size:3rem;margin-bottom:16px">📭</div>
        <h2>Libro no encontrado</h2>
        <p style="color:var(--color-text-2);margin:12px 0 24px">El libro que buscas no existe o fue removido.</p>
        <a href="catalogo.html" class="btn btn-primary">Ver catálogo</a>
      </div>`;
    return;
  }

  /* ---- SEO ---- */
  document.title = `${book.title} — ${book.author} | Librería Universo`;
  document.getElementById("page-title").textContent = document.title;
  document.getElementById("page-desc").content =
    `${book.synopsis} Cómpralo en Librería Universo por solo ${formatPrice(book.price)}.`;

  /* ---- Breadcrumb ---- */
  const catName = CATEGORIES.find(c => c.id === book.category)?.name || book.category;
  document.getElementById("breadcrumb-cat").innerHTML =
    `<a href="catalogo.html?cat=${book.category}">${catName}</a>`;
  document.getElementById("breadcrumb-title").textContent = book.title;

  /* ---- State ---- */
  let qty = 1;
  let selectedFormat = book.format;

  /* ---- Discount ---- */
  const discount = book.oldPrice ? Math.round((1 - book.price / book.oldPrice) * 100) : null;

  /* ---- Stock status ---- */
  let stockHTML = "";
  if (book.stock === 0) {
    stockHTML = `<span class="product-stock-status out-stock">✗ Sin stock</span>`;
  } else if (book.stock <= 5) {
    stockHTML = `<span class="product-stock-status low-stock">⚠️ ¡Solo ${book.stock} disponibles!</span>`;
  } else {
    stockHTML = `<span class="product-stock-status in-stock">✓ En stock</span>`;
  }

  /* ---- Render product ---- */
  const container = document.getElementById("product-container");
  container.innerHTML = `
    <div class="product-layout" id="product-layout">
      <!-- Gallery -->
      <div class="product-gallery">
        <div class="product-main-img" id="main-img-wrap">
          <img src="${book.cover}" alt="Portada de ${book.title}" id="main-img" />
          <div class="zoom-hint">🔍 Zoom</div>
        </div>
        <div class="gallery-thumbs">
          <div class="gallery-thumb active"><img src="${book.cover}" alt="${book.title}" /></div>
          <div class="gallery-thumb"><img src="${book.cover}" alt="${book.title}" style="filter:sepia(.3)" /></div>
          <div class="gallery-thumb"><img src="${book.cover}" alt="${book.title}" style="filter:brightness(.8)" /></div>
        </div>
      </div>

      <!-- Info -->
      <div class="product-info">
        <a href="catalogo.html?cat=${book.category}" class="product-category-link">${catName}</a>

        <div class="product-badges">
          ${book.badge === "bestseller" ? '<span class="book-badge badge-bestseller">🔥 Best Seller</span>' : ""}
          ${book.badge === "new"        ? '<span class="book-badge badge-new">✨ Nuevo lanzamiento</span>'  : ""}
        </div>

        <h1 class="product-title">${book.title}</h1>
        <p class="product-author">por <a href="catalogo.html?q=${encodeURIComponent(book.author)}">${book.author}</a></p>

        <div class="product-rating-row">
          <span class="product-stars">★★★★★</span>
          <span class="product-rating-num">${book.rating}</span>
          <span class="product-rating-count">(${book.reviews.toLocaleString()} reseñas)</span>
        </div>

        <div class="product-price-block">
          <span class="product-price">${formatPrice(book.price)}</span>
          ${book.oldPrice ? `<span class="product-old-price">${formatPrice(book.oldPrice)}</span>` : ""}
          ${discount ? `<span class="product-discount-tag">-${discount}% OFF</span>` : ""}
        </div>

        ${stockHTML}

        ${book.stock <= 5 && book.stock > 0 ? `
        <div class="urgency-bar">
          🔥 <strong>${book.stock} personas</strong> tienen este libro en su carrito ahora mismo.
        </div>` : ""}

        <!-- Format selector -->
        <div class="format-selector">
          <div class="format-label">Formato:</div>
          <div class="format-options">
            <button class="format-option ${selectedFormat === "físico" ? "active" : ""}" data-format="físico">📗 Físico</button>
            <button class="format-option ${selectedFormat === "digital" ? "active" : ""}" data-format="digital">📱 Digital</button>
          </div>
        </div>

        <!-- Quantity -->
        <div class="qty-selector">
          <span class="qty-selector-label">Cantidad:</span>
          <div class="qty-control">
            <button id="qty-minus" aria-label="Menos">−</button>
            <input type="number" id="qty-input" value="1" min="1" max="${book.stock || 99}" readonly />
            <button id="qty-plus" aria-label="Más">+</button>
          </div>
        </div>

        <!-- CTA -->
        <div class="product-cta">
          <button class="btn-add-cart" id="add-to-cart-btn">🛒 Añadir al carrito</button>
          <button class="btn-buy-now" id="buy-now-btn">⚡ Comprar ahora</button>
        </div>

        <!-- Trust -->
        <div class="product-trust">
          <div class="trust-point"><span>🚚</span> Envío en 24-48h</div>
          <div class="trust-point"><span>🔒</span> Pago 100% seguro</div>
          <div class="trust-point"><span>↩️</span> 30 días devolución</div>
          <div class="trust-point"><span>✅</span> Libro original</div>
        </div>

        <!-- Synopsis -->
        <div class="product-synopsis product-details">
          <h3 class="details-title">Sinopsis</h3>
          <div class="synopsis-text collapsed" id="synopsis-text">${book.synopsis}</div>
          <button class="read-more-btn" id="read-more-btn">Leer más →</button>
        </div>

        <!-- Benefits -->
        <div class="product-benefits">
          <h4>✨ ¿Por qué este libro?</h4>
          <div class="benefit-item"><span class="benefit-icon">🎯</span><span>Conocimiento práctico y aplicable desde el primer capítulo.</span></div>
          <div class="benefit-item"><span class="benefit-icon">🧠</span><span>Transforma tu forma de pensar con perspectivas comprobadas.</span></div>
          <div class="benefit-item"><span class="benefit-icon">⭐</span><span>Más de ${book.reviews.toLocaleString()} lectores lo recomiendan.</span></div>
          <div class="benefit-item"><span class="benefit-icon">📖</span><span>Escritura clara y accesible para cualquier lector.</span></div>
        </div>

        <!-- Book details -->
        <div class="product-details">
          <h3 class="details-title">Detalles del libro</h3>
          <div class="details-grid">
            <div class="detail-row"><span class="label">Páginas</span><span class="value">${book.pages}</span></div>
            <div class="detail-row"><span class="label">Idioma</span><span class="value">${book.language}</span></div>
            <div class="detail-row"><span class="label">Formato</span><span class="value">${book.format}</span></div>
            <div class="detail-row"><span class="label">Categoría</span><span class="value">${catName}</span></div>
            <div class="detail-row"><span class="label">Autor</span><span class="value">${book.author}</span></div>
            <div class="detail-row"><span class="label">Disponibilidad</span><span class="value">${book.stock > 0 ? "En stock" : "Agotado"}</span></div>
          </div>
        </div>

        <!-- Reviews preview -->
        <div class="product-reviews product-details">
          <h3 class="details-title">Reseñas de lectores (${book.reviews.toLocaleString()})</h3>
          <div class="reviews-list" id="product-reviews-list"></div>
        </div>
      </div>
    </div>
  `;

  /* ---- Reviews ---- */
  const revList = document.getElementById("product-reviews-list");
  if (revList) {
    const sampleReviews = REVIEWS.slice(0, 3);
    revList.innerHTML = sampleReviews.map(r => `
      <div class="product-review-card">
        <div class="product-review-header">
          <div class="review-avatar-sm">${r.name[0]}</div>
          <div>
            <strong style="font-size:.9rem">${r.name}</strong><br>
            <span style="color:var(--color-accent);font-size:.85rem">${"★".repeat(r.rating)}</span>
            <span style="color:var(--color-text-3);font-size:.78rem;margin-left:6px">${r.date}</span>
          </div>
        </div>
        <div class="product-review-text">"${r.text}"</div>
      </div>
    `).join("");
  }

  /* ---- Gallery thumbs ---- */
  document.querySelectorAll(".gallery-thumb").forEach((thumb, i) => {
    thumb.addEventListener("click", () => {
      document.querySelectorAll(".gallery-thumb").forEach(t => t.classList.remove("active"));
      thumb.classList.add("active");
      const mainImg = document.getElementById("main-img");
      if (mainImg) mainImg.src = thumb.querySelector("img").src;
    });
  });

  /* ---- Read more ---- */
  document.getElementById("read-more-btn")?.addEventListener("click", () => {
    const text = document.getElementById("synopsis-text");
    const btn  = document.getElementById("read-more-btn");
    if (text?.classList.contains("collapsed")) {
      text.classList.remove("collapsed");
      btn.textContent = "Leer menos ↑";
    } else {
      text?.classList.add("collapsed");
      btn.textContent = "Leer más →";
    }
  });

  /* ---- Format selector ---- */
  document.querySelectorAll(".format-option").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".format-option").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      selectedFormat = btn.dataset.format;
    });
  });

  /* ---- Qty ---- */
  document.getElementById("qty-minus")?.addEventListener("click", () => {
    if (qty > 1) { qty--; document.getElementById("qty-input").value = qty; }
  });
  document.getElementById("qty-plus")?.addEventListener("click", () => {
    if (qty < (book.stock || 99)) { qty++; document.getElementById("qty-input").value = qty; }
  });

  /* ---- Add to cart ---- */
  document.getElementById("add-to-cart-btn")?.addEventListener("click", () => {
    Cart.add(book, qty);
    Cart.openDrawer();
    if (typeof Analytics !== "undefined") Analytics.addToCart(book, qty);
  });
  document.getElementById("buy-now-btn")?.addEventListener("click", () => {
    Cart.add(book, qty);
    window.location.href = "carrito.html";
  });

  /* ---- Sticky CTA ---- */
  const stickyCta = document.getElementById("sticky-cta");
  const stickyTitle = document.getElementById("sticky-title");
  const stickyPrice = document.getElementById("sticky-price");
  const stickyAddBtn = document.getElementById("sticky-add-btn");
  if (stickyCta) {
    if (stickyTitle) stickyTitle.textContent = book.title;
    if (stickyPrice) stickyPrice.textContent = formatPrice(book.price);
    stickyAddBtn?.addEventListener("click", () => {
      Cart.add(book, 1);
      Cart.openDrawer();
    });
    // Show sticky after scrolling past CTA
    const observer = new IntersectionObserver(entries => {
      stickyCta.style.display = entries[0].isIntersecting ? "none" : "flex";
    }, { threshold: 0 });
    const ctaEl = document.querySelector(".product-cta");
    if (ctaEl) observer.observe(ctaEl);
  }

  /* ---- Related books ---- */
  const related = getRelated(book, 5);
  if (related.length > 0) {
    const relSection = document.getElementById("related-section");
    const relCarousel = document.getElementById("related-carousel");
    if (relSection) relSection.style.display = "block";
    if (relCarousel) {
      relCarousel.innerHTML = related.map(b => `
        <div class="book-card" onclick="window.location.href='producto.html?slug=${b.slug}'" style="cursor:pointer;min-width:200px">
          <div class="book-card-cover">
            ${b.badge ? `<span class="book-badge badge-${b.badge}">${b.badge === "bestseller" ? "🔥" : b.badge === "new" ? "✨" : "🏷️"}</span>` : ""}
            <img src="${b.cover}" alt="${b.title}" loading="lazy" />
            <div class="book-card-quick-add"><button data-add-to-cart="${b.id}" onclick="event.stopPropagation()">🛒 Añadir</button></div>
          </div>
          <div class="book-card-body">
            <div class="book-title">${b.title}</div>
            <div class="book-author">${b.author}</div>
            <div class="book-price-row"><span class="book-price">${formatPrice(b.price)}</span></div>
          </div>
        </div>
      `).join("");
    }
  }

  /* ---- Analytics ---- */
  if (typeof Analytics !== "undefined") Analytics.viewProduct(book);
});
