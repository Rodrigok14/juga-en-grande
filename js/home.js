document.addEventListener("DOMContentLoaded", () => {
  const navbar = document.getElementById("navbar");
  window.addEventListener("scroll", () => {
    navbar?.classList.toggle("scrolled", window.scrollY > 40);
  }, { passive: true });

  document.getElementById("ann-close")?.addEventListener("click", () => {
    const bar = document.getElementById("announcement-bar");
    if (!bar) return;
    bar.style.transition = "opacity .25s ease, max-height .25s ease, padding .25s ease";
    bar.style.maxHeight = bar.offsetHeight + "px";
    requestAnimationFrame(() => {
      bar.style.opacity = "0";
      bar.style.maxHeight = "0";
      bar.style.paddingTop = "0";
      bar.style.paddingBottom = "0";
      bar.style.overflow = "hidden";
    });
  });

  document.getElementById("hamburger")?.addEventListener("click", () => {
    document.getElementById("mobile-menu")?.classList.toggle("open");
  });

  const navInput = document.getElementById("nav-search-input");
  const navDropdown = document.getElementById("search-dropdown");
  let searchTimeout;

  navInput?.addEventListener("input", () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      const q = navInput.value.trim();
      if (q.length < 2) {
        navDropdown?.classList.remove("open");
        return;
      }
      renderSearchDropdown(searchBooks(q).slice(0, 5), q);
    }, 180);
  });

  navInput?.addEventListener("keydown", event => {
    if (event.key === "Enter" && navInput.value.trim()) {
      window.location.href = "catalogo.html?q=" + encodeURIComponent(navInput.value.trim());
    }
    if (event.key === "Escape") navDropdown?.classList.remove("open");
  });

  document.addEventListener("click", event => {
    if (!event.target.closest(".search-bar-nav")) navDropdown?.classList.remove("open");
  });

  function renderSearchDropdown(results, query) {
    if (!navDropdown) return;
    navDropdown.innerHTML = results.length
      ? results.map(book => `
          <div class="search-result-item" onclick="window.location.href='producto.html?slug=${book.slug}'">
            <img class="search-result-thumb" src="${book.cover}" alt="${book.title}" loading="lazy" />
            <div class="search-result-info">
              <strong>${book.title}</strong>
              <span>${book.author} · ${formatPrice(book.price)}</span>
            </div>
          </div>
        `).join("")
      : `<div class="search-result-item"><div class="search-result-info"><strong>Sin resultados para \"${escapeHtml(query)}\"</strong><span>Probá con dinero, ventas, mentalidad o foco.</span></div></div>`;
    navDropdown.classList.add("open");
  }

  const categories = [
    { id: "educacion-financiera", name: "Educación financiera", code: "$", count: "Activos e inversión", color: "#00FF88" },
    { id: "crecimiento-personal", name: "Crecimiento personal", code: "C", count: "Hábitos y mentalidad", color: "#D4AF37" },
    { id: "dinero", name: "Dinero", code: "$", count: "Ingresos y negocio", color: "#58D7FF" },
    { id: "amor", name: "Amor", code: "A", count: "Relaciones y autoestima", color: "#FF6FAE" }
  ];

  const categoryGrid = document.getElementById("categories-grid");
  if (categoryGrid) {
    categoryGrid.innerHTML = categories.map(category => `
      <a href="catalogo.html?cat=${category.id}" class="category-card" style="--cat-color:${category.color}">
        <div class="category-icon">${category.code}</div>
        <div>
          <div class="category-name">${category.name}</div>
          <div class="category-count">${category.count}</div>
        </div>
      </a>
    `).join("");
  }

  function categoryLabel(category) {
    return ({
      negocios: "Dinero",
      desarrollo: "Mentalidad",
      "educacion-financiera": "Educación financiera",
      "crecimiento-personal": "Crecimiento personal",
      dinero: "Dinero",
      amor: "Amor",
      ventas: "Ventas",
      productividad: "Productividad",
      noficcion: "Conocimiento",
      ficcion: "Perspectiva"
    })[category] || category;
  }

  function impactLine(book) {
    const lines = {
      robert: "Compralo digital y recibí el acceso cuando se apruebe el pago.",
      "padre-rico-padre-pobre": "Aprendé a pensar como dueño de activos.",
      "piense-y-hagase-rico": "Entrená tu ambición con principios de riqueza.",
      "atomic-habits": "Construí sistemas que te acerquen al resultado.",
      "deep-work": "Recuperá foco para producir trabajo de alto valor."
    };
    return lines[book.slug] || "Una lectura para tomar mejores decisiones.";
  }

  function badgeLabel(badge) {
    if (badge === "bestseller") return "Best seller";
    if (badge === "new") return "Nuevo";
    if (badge === "sale") return "Oferta";
    return badge || "";
  }

  const previewModal = createPreviewModal();
  window.openBookPreview = bookId => {
    const book = getBookById(Number(bookId));
    if (!book?.hasPreview || !book.previewUrl) return;
    previewModal.open(book);
  };

  window.toggleWishlist = (id, button) => {
    const key = "jg_wishlist";
    let wishlist = JSON.parse(localStorage.getItem(key) || "[]");
    if (wishlist.includes(id)) {
      wishlist = wishlist.filter(item => item !== id);
      button.textContent = "♡";
      button.classList.remove("active");
    } else {
      wishlist.push(id);
      button.textContent = "♥";
      button.classList.add("active");
    }
    localStorage.setItem(key, JSON.stringify(wishlist));
  };

  function bookCardHTML(book) {
    const discount = book.oldPrice ? Math.round((1 - book.price / book.oldPrice) * 100) : null;
    const isDigital = book.format === "digital";
    const previewButton = book.hasPreview
      ? `<button class="book-inline-action" onclick="event.stopPropagation(); openBookPreview(${book.id})">Leer muestra</button>`
      : "";

    return `
      <article class="book-card ${isDigital ? "is-digital" : ""}" onclick="window.location.href='producto.html?slug=${book.slug}'" style="cursor:pointer">
        <div class="book-card-cover">
          ${isDigital ? `<span class="book-badge">Descarga digital</span>` : ""}
          ${!isDigital && book.badge ? `<span class="book-badge ${book.badge === "sale" ? "badge-sale" : book.badge === "new" ? "badge-new" : ""}">${badgeLabel(book.badge)}</span>` : ""}
          <button class="book-wishlist-btn" onclick="event.stopPropagation(); toggleWishlist(${book.id}, this)" aria-label="Guardar en favoritos">♡</button>
          <img src="${book.cover}" alt="Portada de ${book.title}" loading="lazy" />
          <div class="book-card-quick-add">
            <button data-add-to-cart="${book.id}" onclick="event.stopPropagation()">Añadir al carrito</button>
          </div>
        </div>
        <div class="book-card-body">
          <div class="book-category">${categoryLabel(book.category)}</div>
          <div class="book-title">${book.title}</div>
          <div class="book-author">${book.author}</div>
          <div class="book-impact">${impactLine(book)}</div>
          <div class="book-stars">
            <span class="stars">★★★★★</span>
            <span class="count">(${book.reviews.toLocaleString()})</span>
          </div>
          <div class="book-price-row">
            <span class="book-price">${formatPrice(book.price)}</span>
            ${book.oldPrice ? `<span class="book-price-old">${formatPrice(book.oldPrice)}</span>` : ""}
            ${discount ? `<span class="book-badge badge-sale" style="position:static">-${discount}%</span>` : ""}
            <span class="book-format-tag">${isDigital ? "Digital" : "Físico"}</span>
          </div>
          <div class="book-inline-actions">
            ${previewButton}
            <a class="book-inline-link" href="producto.html?slug=${book.slug}" onclick="event.stopPropagation()">Ver ficha</a>
          </div>
        </div>
      </article>
    `;
  }

  const featuredGrid = document.getElementById("featured-books-grid");
  if (featuredGrid) {
    const priority = ["robert", "deep-work", "padre-rico-padre-pobre", "piense-y-hagase-rico", "atomic-habits"];
    const priorityBooks = priority.map(slug => getBookBySlug(slug)).filter(Boolean);
    const digitalBooks = BOOKS.filter(book => book.format === "digital" && !priorityBooks.some(item => item.id === book.id));
    const books = [
      ...priorityBooks.filter(book => book.format === "digital"),
      ...digitalBooks,
      ...priorityBooks.filter(book => book.format !== "digital")
    ].slice(0, 8);
    featuredGrid.innerHTML = books.map(bookCardHTML).join("");
  }

  const packGrid = document.getElementById("digital-packs-grid");
  const tabs = document.getElementById("pillar-tabs");
  const emptyPacks = document.getElementById("empty-packs");
  const pillars = [
    ["todos", "Todos"],
    ["educacion-financiera", "Educación financiera"],
    ["crecimiento-personal", "Crecimiento personal"],
    ["dinero", "Dinero"],
    ["amor", "Amor"]
  ];

  function renderPacks(active = "todos") {
    if (!packGrid) return;
    const packs = BOOKS
      .filter(book => book.sourceType === "combo" && book.format === "digital")
      .filter(book => active === "todos" || book.category === active);
    packGrid.innerHTML = packs.slice(0, 8).map(bookCardHTML).join("");
    if (emptyPacks) emptyPacks.hidden = packs.length > 0;
  }

  if (tabs && packGrid) {
    tabs.innerHTML = pillars.map(([id, label], index) => `
      <button class="pillar-tab ${index === 0 ? "active" : ""}" data-pillar="${id}">${label}</button>
    `).join("");
    tabs.querySelectorAll("[data-pillar]").forEach(button => {
      button.addEventListener("click", () => {
        tabs.querySelectorAll(".pillar-tab").forEach(item => item.classList.remove("active"));
        button.classList.add("active");
        renderPacks(button.dataset.pillar);
      });
    });
    renderPacks();
  }

  const recommendations = [
    {
      keys: ["educacion financiera", "finanza", "invertir", "activo", "ahorrar", "libertad financiera"],
      title: "Padre Rico, Padre Pobre",
      slug: "padre-rico-padre-pobre",
      body: "Para ordenar tu mentalidad financiera y empezar a mirar el dinero como sistema."
    },
    {
      keys: ["crecimiento", "mentalidad", "confianza", "exito", "éxito", "crecer", "ambicion"],
      title: "Piense y Hágase Rico",
      slug: "piense-y-hagase-rico",
      body: "Para trabajar deseo, enfoque y persistencia con una lógica orientada a resultados."
    },
    {
      keys: ["dinero", "ganar", "ingresos", "negocio", "plata"],
      title: "Pack digital de dinero",
      slug: (BOOKS.find(book => book.sourceType === "combo" && book.category === "dinero") || getBookBySlug("padre-rico-padre-pobre"))?.slug,
      body: "Para ordenar ideas y tomar mejores decisiones con tus ingresos."
    },
    {
      keys: ["amor", "pareja", "relacion", "relación", "autoestima", "vinculo", "vínculo"],
      title: "Lecturas para relaciones y autoestima",
      slug: (BOOKS.find(book => book.sourceType === "combo" && book.category === "amor") || getBookBySlug("atomic-habits"))?.slug,
      body: "Para trabajar vínculos, autoestima y decisiones emocionales con más claridad."
    },
    {
      keys: ["habito", "hábito", "disciplina", "constancia", "rutina"],
      title: "Atomic Habits",
      slug: "atomic-habits",
      body: "Para transformar objetivos grandes en sistemas diarios que puedas sostener."
    },
    {
      keys: ["foco", "productividad", "distraido", "distraído", "trabajo", "ejecutar"],
      title: "Trabajo Profundo",
      slug: "deep-work",
      body: "Para proteger tu atención y producir más valor con menos ruido."
    },
    {
      keys: ["vender", "ventas", "negocio", "emprender", "startup"],
      title: "El Método Lean Startup",
      slug: "la-startup-lean",
      body: "Para probar ideas, aprender rápido y convertir movimiento en negocio real."
    }
  ];

  const goalInput = document.getElementById("goal-input");
  const goalButton = document.getElementById("goal-button");
  const recommendationCard = document.getElementById("recommendation-card");

  function recommend() {
    if (!recommendationCard) return;
    const value = (goalInput?.value || "").toLowerCase();
    const match = recommendations.find(item => item.keys.some(key => value.includes(key))) || recommendations[0];
    recommendationCard.innerHTML = `
      <span>Recomendación para tu objetivo</span>
      <h3>${match.title}</h3>
      <p>${match.body}</p>
      <a href="producto.html?slug=${match.slug}">Ver recomendación</a>
    `;
    recommendationCard.animate([
      { transform: "translateY(8px)", opacity: .75 },
      { transform: "translateY(0)", opacity: 1 }
    ], { duration: 260, easing: "ease-out" });
  }

  goalButton?.addEventListener("click", recommend);
  goalInput?.addEventListener("keydown", event => {
    if (event.key === "Enter") recommend();
  });

  const reviews = [
    {
      name: "María G.",
      date: "Hace 2 días",
      rating: 5,
      text: "Compré libros de finanzas y cambié la forma en que organizo mi sueldo. Ahora tengo un plan.",
      book: "Padre Rico, Padre Pobre"
    },
    {
      name: "Carlos R.",
      date: "Hace 1 semana",
      rating: 5,
      text: "La selección no se siente como una librería común. Te empuja a leer con un objetivo claro.",
      book: "Atomic Habits"
    },
    {
      name: "Sofía L.",
      date: "Hace 3 semanas",
      rating: 5,
      text: "Entré buscando motivación y terminé armando una rutina de lectura y acción diaria.",
      book: "Trabajo Profundo"
    }
  ];

  const reviewsGrid = document.getElementById("reviews-grid");
  if (reviewsGrid) {
    reviewsGrid.innerHTML = reviews.map(review => `
      <article class="review-card">
        <div class="review-header">
          <div class="review-avatar">${review.name[0]}</div>
          <div class="review-meta">
            <strong>${review.name}</strong>
            <span>${review.date}</span>
          </div>
        </div>
        <div class="review-stars">${"★".repeat(review.rating)}</div>
        <p class="review-text">"${review.text}"</p>
        <div class="review-book">Leyó: <strong>${review.book}</strong></div>
      </article>
    `).join("");
  }

  bindBookRequestForm();
  bindRevealAnimation();

  function bindBookRequestForm() {
    const form = document.getElementById("book-request-form");
    const feedback = document.getElementById("book-request-feedback");
    if (!form || !feedback) return;

    form.addEventListener("submit", async event => {
      event.preventDefault();
      feedback.textContent = "Enviando sugerencia...";
      feedback.classList.remove("is-error", "is-success");

      const payload = {
        name: document.getElementById("request-name")?.value.trim() || "",
        email: document.getElementById("request-email")?.value.trim() || "",
        requestedTitle: document.getElementById("request-title")?.value.trim() || "",
        requestedAuthor: document.getElementById("request-author")?.value.trim() || "",
        notes: document.getElementById("request-notes")?.value.trim() || ""
      };

      try {
        const response = await fetch("/api/book-requests", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "No se pudo enviar la sugerencia");

        form.reset();
        feedback.textContent = "Listo. Recibimos tu sugerencia para sumar nuevos libros digitales.";
        feedback.classList.add("is-success");
      } catch (error) {
        feedback.textContent = error.message;
        feedback.classList.add("is-error");
      }
    });
  }

  function bindRevealAnimation() {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    }, { threshold: .14 });

    document.querySelectorAll(".transformation-card, .book-card, .category-card, .review-card, .recommender, .preview-card, .support-card, .request-form").forEach(element => {
      element.style.opacity = "0";
      element.style.transform = "translateY(22px)";
      element.style.transition = "opacity .55s ease, transform .55s ease";
      observer.observe(element);
    });

    const style = document.createElement("style");
    style.textContent = `.is-visible{opacity:1!important;transform:translateY(0)!important}`;
    document.head.appendChild(style);
  }

  function createPreviewModal() {
    const wrapper = document.createElement("div");
    wrapper.className = "preview-modal";
    wrapper.innerHTML = `
      <div class="preview-modal-backdrop" data-close-preview></div>
      <div class="preview-modal-dialog" role="dialog" aria-modal="true" aria-label="Muestra de lectura">
        <button class="preview-modal-close" data-close-preview aria-label="Cerrar muestra">×</button>
        <div class="preview-modal-head">
          <span class="preview-modal-label">Muestra de lectura</span>
          <h3 id="preview-modal-title">Vista previa</h3>
          <p>Primeras páginas disponibles para conocer el contenido antes de comprar.</p>
        </div>
        <iframe class="preview-modal-frame" id="preview-modal-frame" title="Vista previa del libro"></iframe>
      </div>
    `;
    document.body.appendChild(wrapper);

    wrapper.addEventListener("click", event => {
      if (event.target.matches("[data-close-preview]")) api.close();
    });

    document.addEventListener("keydown", event => {
      if (event.key === "Escape") api.close();
    });

    const title = wrapper.querySelector("#preview-modal-title");
    const frame = wrapper.querySelector("#preview-modal-frame");

    const api = {
      open(book) {
        title.textContent = `${book.title} · muestra`; 
        frame.src = `${book.previewUrl}#toolbar=0&navpanes=0&scrollbar=1`;
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

  function escapeHtml(value = "") {
    return String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
  }
});
