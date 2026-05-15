document.addEventListener("DOMContentLoaded", () => {
  const navbar = document.getElementById("navbar");
  window.addEventListener("scroll", () => {
    navbar?.classList.toggle("scrolled", window.scrollY > 50);
  }, { passive: true });

  const params = new URLSearchParams(window.location.search);
  const slug = params.get("slug");
  const book = slug ? getBookBySlug(slug) : null;
  const normalizeFormat = value => String(value || "").toLowerCase().includes("digital") ? "digital" : "fisico";

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

  document.title = `${book.title} — ${book.author} | Jugá en Grande`;
  document.getElementById("page-title").textContent = document.title;
  document.getElementById("page-desc").content = `${book.synopsis} Cómpralo en Jugá en Grande por ${formatPrice(book.price)}.`;

  const categoryName = CATEGORIES.find(category => category.id === book.category)?.name || book.category;
  document.getElementById("breadcrumb-cat").innerHTML = `<a href="catalogo.html?cat=${book.category}">${categoryName}</a>`;
  document.getElementById("breadcrumb-title").textContent = book.title;

  let qty = 1;
  let selectedFormat = normalizeFormat(book.format);
  const discount = book.oldPrice ? Math.round((1 - book.price / book.oldPrice) * 100) : null;
  const isDigital = selectedFormat === "digital";
  const galleryImages = Array.isArray(book.galleryImages) && book.galleryImages.length
    ? book.galleryImages
    : [book.cover];

  let stockHTML = "";
  if (book.stock === 0) {
    stockHTML = `<span class="product-stock-status out-stock">✕ Sin stock</span>`;
  } else if (!isDigital && book.stock <= 5) {
    stockHTML = `<span class="product-stock-status low-stock">⚠️ ¡Solo ${book.stock} disponibles!</span>`;
  } else if (isDigital) {
    stockHTML = `<span class="product-stock-status in-stock">✓ Descarga disponible al aprobarse el pago</span>`;
  } else {
    stockHTML = `<span class="product-stock-status in-stock">✓ En stock</span>`;
  }

  const supportHtml = isDigital
    ? `<div class="trust-point"><span>📩</span> Descarga por web y por email</div>`
    : `<div class="trust-point"><span>📍</span> Entrega solo en San Miguel de Tucumán</div>`;
  const includedFiles = Array.isArray(book.digitalFilesManifest) ? book.digitalFilesManifest : [];
  const isPack = book.sourceType === "combo" || includedFiles.length > 1;
  const includedHtml = isDigital
    ? `
      <div class="product-included product-details">
        <h3 class="details-title">${isPack ? "Qué incluye este pack" : "Qué recibís al comprar"}</h3>
        <div class="included-summary">
          <strong>${isPack ? `${includedFiles.length || 1} archivo(s) digitales en ZIP` : "Archivo digital listo para descargar"}</strong>
          <span>Después del pago aprobado, podés descargar desde la web y también recibís el acceso por email.</span>
        </div>
        ${includedFiles.length ? `
          <ul class="included-list">
            ${includedFiles.slice(0, 12).map(file => `<li>${file.split("/").pop()}</li>`).join("")}
          </ul>
        ` : ""}
      </div>
    `
    : `
      <div class="product-included product-details">
        <h3 class="details-title">Entrega física</h3>
        <div class="included-summary">
          <strong>Disponible solo en San Miguel de Tucumán</strong>
          <span>Coordinamos la entrega por WhatsApp después de confirmar el pedido.</span>
        </div>
      </div>
    `;

  const previewHtml = book.hasPreview
    ? `
      <div class="product-preview-card product-details">
        <div>
          <span class="product-preview-kicker">Muestra disponible</span>
          <h3>Leé las primeras 3 páginas antes de comprar</h3>
          <p>Abrí una vista previa del contenido y decidí con más seguridad antes de pagar.</p>
        </div>
        <button class="btn btn-secondary" id="open-preview-btn">Leer muestra</button>
      </div>
    `
    : "";

  const container = document.getElementById("product-container");
  container.innerHTML = `
    <div class="product-layout" id="product-layout">
      <div class="product-gallery">
        <div class="product-main-img" id="main-img-wrap">
          <img src="${galleryImages[0]}" alt="Portada de ${book.title}" id="main-img" />
          <div class="zoom-hint">🔍 Zoom</div>
        </div>
        <div class="gallery-thumbs">
          ${galleryImages.map((image, index) => `
            <div class="gallery-thumb ${index === 0 ? "active" : ""}">
              <img src="${image}" alt="${book.title}" />
            </div>
          `).join("")}
        </div>
      </div>

      <div class="product-info">
        <a href="catalogo.html?cat=${book.category}" class="product-category-link">${categoryName}</a>

        <div class="product-badges">
          ${isDigital ? '<span class="book-badge">Descarga digital</span>' : ''}
          ${book.badge === "bestseller" ? '<span class="book-badge badge-bestseller">🔥 Best Seller</span>' : ""}
          ${book.badge === "new" ? '<span class="book-badge badge-new">✨ Nuevo lanzamiento</span>' : ""}
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

        ${!isDigital && book.stock <= 5 && book.stock > 0 ? `
        <div class="urgency-bar">
          🔥 <strong>${book.stock} personas</strong> tienen este libro en su radar ahora mismo.
        </div>` : ""}

        <div class="format-selector">
          <div class="format-label">Formato:</div>
          <div class="format-options">
            <button class="format-option ${selectedFormat === "fisico" ? "active" : ""}" data-format="fisico">📗 Físico</button>
            <button class="format-option ${selectedFormat === "digital" ? "active" : ""}" data-format="digital">📱 Digital</button>
          </div>
        </div>

        <div class="qty-selector">
          <span class="qty-selector-label">Cantidad:</span>
          <div class="qty-control">
            <button id="qty-minus" aria-label="Menos">−</button>
            <input type="number" id="qty-input" value="1" min="1" max="${book.stock || 99}" readonly />
            <button id="qty-plus" aria-label="Más">+</button>
          </div>
        </div>

        <div class="product-cta">
          <button class="btn-add-cart" id="add-to-cart-btn">🛒 Añadir al carrito</button>
          <button class="btn-buy-now" id="buy-now-btn">⚡ Comprar ahora</button>
          <button class="btn-share-product" id="share-product-btn">↗ Compartir libro</button>
        </div>

        <div class="product-trust">
          ${isDigital ? '<div class="trust-point"><span>⚡</span> Acceso apenas se aprueba el pago</div>' : '<div class="trust-point"><span>🚚</span> Entrega coordinada en 24-48h</div>'}
          <div class="trust-point"><span>🔒</span> Pago 100% seguro</div>
          ${supportHtml}
          <div class="trust-point"><span>💬</span> Soporte por WhatsApp 3816590235</div>
        </div>

        ${previewHtml}
        ${includedHtml}

        <div class="product-synopsis product-details">
          <h3 class="details-title">Sinopsis</h3>
          <div class="synopsis-text collapsed" id="synopsis-text">${book.synopsis}</div>
          <button class="read-more-btn" id="read-more-btn">Leer más →</button>
        </div>

        <div class="product-benefits">
          <h4>✨ ¿Por qué este libro?</h4>
          <div class="benefit-item"><span class="benefit-icon">🎯</span><span>Elegido para avanzar en ${categoryName.toLowerCase()} con una lectura concreta.</span></div>
          <div class="benefit-item"><span class="benefit-icon">⚡</span><span>${isDigital ? "Pagás y accedés al material cuando el proveedor confirma el pago." : "Ideal si estás en Tucumán y querés el libro impreso."}</span></div>
          <div class="benefit-item"><span class="benefit-icon">⭐</span><span>Más de ${book.reviews.toLocaleString()} lectores lo tienen como referencia.</span></div>
          <div class="benefit-item"><span class="benefit-icon">💬</span><span>Si tenés problemas para descargar, soporte directo por WhatsApp.</span></div>
        </div>

        <div class="product-details">
          <h3 class="details-title">Detalles del libro</h3>
          <div class="details-grid">
            <div class="detail-row"><span class="label">Páginas</span><span class="value">${book.pages}</span></div>
            <div class="detail-row"><span class="label">Idioma</span><span class="value">${book.language}</span></div>
            <div class="detail-row"><span class="label">Formato</span><span class="value">${isDigital ? "Digital" : "Físico"}</span></div>
            <div class="detail-row"><span class="label">Categoría</span><span class="value">${categoryName}</span></div>
            <div class="detail-row"><span class="label">Autor</span><span class="value">${book.author}</span></div>
            <div class="detail-row"><span class="label">Disponibilidad</span><span class="value">${isDigital ? "Descarga inmediata" : (book.stock > 0 ? "En stock" : "Agotado")}</span></div>
          </div>
        </div>

        <div class="product-reviews product-details">
          <h3 class="details-title">Reseñas de lectores (${book.reviews.toLocaleString()})</h3>
          <div class="reviews-list" id="product-reviews-list"></div>
        </div>
      </div>
    </div>
  `;

  const previewModal = createPreviewModal();
  document.getElementById("open-preview-btn")?.addEventListener("click", () => previewModal.open(book));

  const reviewsList = document.getElementById("product-reviews-list");
  if (reviewsList) {
    reviewsList.innerHTML = REVIEWS.slice(0, 3).map(review => `
      <div class="product-review-card">
        <div class="product-review-header">
          <div class="review-avatar-sm">${review.name[0]}</div>
          <div>
            <strong style="font-size:.9rem">${review.name}</strong><br>
            <span style="color:var(--color-accent);font-size:.85rem">${"★".repeat(review.rating)}</span>
            <span style="color:var(--color-text-3);font-size:.78rem;margin-left:6px">${review.date}</span>
          </div>
        </div>
        <div class="product-review-text">"${review.text}"</div>
      </div>
    `).join("");
  }

  document.querySelectorAll(".gallery-thumb").forEach(thumb => {
    thumb.addEventListener("click", () => {
      document.querySelectorAll(".gallery-thumb").forEach(item => item.classList.remove("active"));
      thumb.classList.add("active");
      const mainImg = document.getElementById("main-img");
      if (mainImg) mainImg.src = thumb.querySelector("img").src;
    });
  });

  document.getElementById("read-more-btn")?.addEventListener("click", () => {
    const text = document.getElementById("synopsis-text");
    const button = document.getElementById("read-more-btn");
    if (text?.classList.contains("collapsed")) {
      text.classList.remove("collapsed");
      button.textContent = "Leer menos ↑";
    } else {
      text?.classList.add("collapsed");
      button.textContent = "Leer más →";
    }
  });

  document.querySelectorAll(".format-option").forEach(button => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".format-option").forEach(item => item.classList.remove("active"));
      button.classList.add("active");
    });
  });

  document.getElementById("qty-minus")?.addEventListener("click", () => {
    if (qty > 1) {
      qty -= 1;
      document.getElementById("qty-input").value = qty;
    }
  });
  document.getElementById("qty-plus")?.addEventListener("click", () => {
    if (qty < (book.stock || 99)) {
      qty += 1;
      document.getElementById("qty-input").value = qty;
    }
  });

  document.getElementById("add-to-cart-btn")?.addEventListener("click", () => {
    Cart.add(book, qty);
    Cart.openDrawer();
    if (typeof Analytics !== "undefined") Analytics.addToCart(book, qty);
  });

  document.getElementById("buy-now-btn")?.addEventListener("click", () => {
    Cart.clear();
    Cart.add(book, qty);
    window.location.href = "carrito.html";
  });

  document.getElementById("share-product-btn")?.addEventListener("click", () => {
    ShareBook.share(book);
  });

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
    const observer = new IntersectionObserver(entries => {
      stickyCta.style.display = entries[0].isIntersecting ? "none" : "flex";
    }, { threshold: 0 });
    const ctaElement = document.querySelector(".product-cta");
    if (ctaElement) observer.observe(ctaElement);
  }

  const related = getRelated(book, 5);
  if (related.length > 0) {
    const relatedSection = document.getElementById("related-section");
    const relatedCarousel = document.getElementById("related-carousel");
    if (relatedSection) relatedSection.style.display = "block";
    if (relatedCarousel) {
      relatedCarousel.innerHTML = related.map(item => `
        <div class="book-card" onclick="window.location.href='producto.html?slug=${item.slug}'" style="cursor:pointer;min-width:200px">
          <div class="book-card-cover">
            ${item.badge ? `<span class="book-badge badge-${item.badge}">${item.badge === "bestseller" ? "🔥" : item.badge === "new" ? "✨" : "🏷️"}</span>` : ""}
            <button class="book-share-btn" onclick="event.stopPropagation(); ShareBook.share(${item.id})" aria-label="Compartir libro">↗</button>
            <img src="${item.cover}" alt="${item.title}" loading="lazy" />
            <div class="book-card-quick-add"><button data-add-to-cart="${item.id}" onclick="event.stopPropagation()">🛒 Añadir</button></div>
          </div>
          <div class="book-card-body">
            <div class="book-title">${item.title}</div>
            <div class="book-author">${item.author}</div>
            <div class="book-price-row"><span class="book-price">${formatPrice(item.price)}</span></div>
          </div>
        </div>
      `).join("");
    }
  }

  if (typeof Analytics !== "undefined") Analytics.viewProduct(book);

  function createPreviewModal() {
    const wrapper = document.createElement("div");
    wrapper.className = "product-preview-modal";
    wrapper.innerHTML = `
      <div class="product-preview-backdrop" data-close-preview></div>
      <div class="product-preview-dialog" role="dialog" aria-modal="true" aria-label="Muestra de lectura">
        <button class="product-preview-close" data-close-preview aria-label="Cerrar">×</button>
        <div class="product-preview-head">
          <span>Muestra de lectura</span>
          <h3 id="product-preview-title">Vista previa</h3>
          <p>Primeras páginas disponibles para conocer el contenido antes de comprar.</p>
        </div>
        <iframe id="product-preview-frame" class="product-preview-frame" title="Muestra del libro"></iframe>
      </div>
    `;
    document.body.appendChild(wrapper);

    const frame = wrapper.querySelector("#product-preview-frame");
    const title = wrapper.querySelector("#product-preview-title");

    wrapper.addEventListener("click", event => {
      if (event.target.matches("[data-close-preview]")) api.close();
    });

    document.addEventListener("keydown", event => {
      if (event.key === "Escape") api.close();
    });

    const api = {
      open(currentBook) {
        title.textContent = `${currentBook.title} · muestra`;
        frame.src = `${currentBook.previewUrl}#toolbar=0&navpanes=0&scrollbar=1`;
        wrapper.classList.add("open");
        document.body.style.overflow = "hidden";
      },
      close() {
        wrapper.classList.remove("open");
        frame.src = "about:blank";
        document.body.style.overflow = "";
      }
    };

    return api;
  }
});
