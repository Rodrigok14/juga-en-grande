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

  navInput?.addEventListener("keydown", e => {
    if (e.key === "Enter" && navInput.value.trim()) {
      window.location.href = "catalogo.html?q=" + encodeURIComponent(navInput.value.trim());
    }
    if (e.key === "Escape") navDropdown?.classList.remove("open");
  });

  document.addEventListener("click", e => {
    if (!e.target.closest(".search-bar-nav")) navDropdown?.classList.remove("open");
  });

  function renderSearchDropdown(results, q) {
    if (!navDropdown) return;
    navDropdown.innerHTML = results.length
      ? results.map(b => `
          <div class="search-result-item" onclick="window.location.href='producto.html?slug=${b.slug}'">
            <img class="search-result-thumb" src="${b.cover}" alt="${b.title}" loading="lazy" />
            <div class="search-result-info">
              <strong>${b.title}</strong>
              <span>${b.author} · ${formatPrice(b.price)}</span>
            </div>
          </div>
        `).join("")
      : `<div class="search-result-item"><div class="search-result-info"><strong>Sin resultados para "${q}"</strong><span>Probá con dinero, mentalidad, ventas o foco.</span></div></div>`;
    navDropdown.classList.add("open");
  }

  const categories = [
    { id: "negocios", name: "Dinero", code: "$", count: "Finanzas y activos", color: "#00FF88" },
    { id: "desarrollo", name: "Mentalidad", code: "M", count: "Hábitos y decisión", color: "#D4AF37" },
    { id: "ventas", name: "Ventas", code: "V", count: "Persuasión y negocio", color: "#58D7FF" },
    { id: "productividad", name: "Productividad", code: "P", count: "Foco y ejecución", color: "#FFFFFF" }
  ];

  const catGrid = document.getElementById("categories-grid");
  if (catGrid) {
    catGrid.innerHTML = categories.map(c => `
      <a href="catalogo.html?cat=${c.id}" class="category-card" style="--cat-color:${c.color}">
        <div class="category-icon">${c.code}</div>
        <div>
          <div class="category-name">${c.name}</div>
          <div class="category-count">${c.count}</div>
        </div>
      </a>
    `).join("");
  }

  function bookCardHTML(b) {
    const discount = b.oldPrice ? Math.round((1 - b.price / b.oldPrice) * 100) : null;
    const categoryName = categoryLabel(b.category);
    const isDigital = b.format === "digital";
    return `
      <article class="book-card ${isDigital ? "is-digital" : ""}" onclick="window.location.href='producto.html?slug=${b.slug}'" style="cursor:pointer">
        <div class="book-card-cover">
          ${isDigital ? `<span class="book-badge">Descarga digital</span>` : ""}
          ${!isDigital && b.badge ? `<span class="book-badge ${b.badge === "sale" ? "badge-sale" : b.badge === "new" ? "badge-new" : ""}">${badgeLabel(b.badge)}</span>` : ""}
          <button class="book-wishlist-btn" onclick="event.stopPropagation(); toggleWishlist(${b.id}, this)" aria-label="Guardar en favoritos">♡</button>
          <img src="${b.cover}" alt="Portada de ${b.title}" loading="lazy" />
          <div class="book-card-quick-add">
            <button data-add-to-cart="${b.id}" onclick="event.stopPropagation()">Añadir al carrito</button>
          </div>
        </div>
        <div class="book-card-body">
          <div class="book-category">${categoryName}</div>
          <div class="book-title">${b.title}</div>
          <div class="book-author">${b.author}</div>
          <div class="book-impact">${impactLine(b)}</div>
          <div class="book-stars">
            <span class="stars">★★★★★</span>
            <span class="count">(${b.reviews.toLocaleString()})</span>
          </div>
          <div class="book-price-row">
            <span class="book-price">${formatPrice(b.price)}</span>
            ${b.oldPrice ? `<span class="book-price-old">${formatPrice(b.oldPrice)}</span>` : ""}
            ${discount ? `<span class="book-badge badge-sale" style="position:static">-${discount}%</span>` : ""}
            <span class="book-format-tag">${b.format === "digital" ? "Digital" : "Físico"}</span>
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
    const books = [...priorityBooks.filter(book => book.format === "digital"), ...digitalBooks, ...priorityBooks.filter(book => book.format !== "digital")].slice(0, 4);
    featuredGrid.innerHTML = books.map(bookCardHTML).join("");
  }

  function badgeLabel(badge) {
    if (badge === "bestseller") return "Best seller";
    if (badge === "new") return "Nuevo";
    if (badge === "sale") return "Oferta";
    return badge;
  }

  function categoryLabel(category) {
    return ({
      negocios: "Dinero",
      desarrollo: "Mentalidad",
      ventas: "Ventas",
      productividad: "Productividad",
      noficcion: "Conocimiento",
      ficcion: "Perspectiva"
    })[category] || category;
  }

  function impactLine(book) {
    const text = {
      "padre-rico-padre-pobre": "Aprendé a pensar como dueño de activos.",
      "piense-y-hagase-rico": "Entrená tu ambición con principios de riqueza.",
      "atomic-habits": "Construí sistemas que te acerquen al resultado.",
      "deep-work": "Recuperá foco para producir trabajo de alto valor."
    };
    return text[book.slug] || "Una lectura para tomar mejores decisiones.";
  }

  window.toggleWishlist = (id, btn) => {
    const key = "jg_wishlist";
    let wishlist = JSON.parse(localStorage.getItem(key) || "[]");
    if (wishlist.includes(id)) {
      wishlist = wishlist.filter(item => item !== id);
      btn.textContent = "♡";
      btn.classList.remove("active");
    } else {
      wishlist.push(id);
      btn.textContent = "♥";
      btn.classList.add("active");
    }
    localStorage.setItem(key, JSON.stringify(wishlist));
  };

  const recommendations = [
    {
      keys: ["dinero", "ganar", "finanza", "invertir", "activo", "plata"],
      title: "Padre Rico, Padre Pobre",
      slug: "padre-rico-padre-pobre",
      body: "Para ordenar tu mentalidad financiera y empezar a mirar el dinero como sistema."
    },
    {
      keys: ["mentalidad", "confianza", "exito", "éxito", "crecer", "ambicion"],
      title: "Piense y Hágase Rico",
      slug: "piense-y-hagase-rico",
      body: "Para trabajar deseo, enfoque y persistencia con una lógica orientada a resultados."
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
    const match = recommendations.find(r => r.keys.some(k => value.includes(k))) || recommendations[0];
    recommendationCard.innerHTML = `
      <span>Recomendación para tu objetivo</span>
      <h3>${match.title}</h3>
      <p>${match.body}</p>
      <a href="producto.html?slug=${match.slug}">Ver libro</a>
    `;
    recommendationCard.animate([
      { transform: "translateY(8px)", opacity: .75 },
      { transform: "translateY(0)", opacity: 1 }
    ], { duration: 260, easing: "ease-out" });
  }

  goalButton?.addEventListener("click", recommend);
  goalInput?.addEventListener("keydown", e => {
    if (e.key === "Enter") recommend();
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

  const revGrid = document.getElementById("reviews-grid");
  if (revGrid) {
    revGrid.innerHTML = reviews.map(r => `
      <article class="review-card">
        <div class="review-header">
          <div class="review-avatar">${r.name[0]}</div>
          <div class="review-meta">
            <strong>${r.name}</strong>
            <span>${r.date}</span>
          </div>
        </div>
        <div class="review-stars">${"★".repeat(r.rating)}</div>
        <p class="review-text">"${r.text}"</p>
        <div class="review-book">Leyó: <strong>${r.book}</strong></div>
      </article>
    `).join("");
  }

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-visible");
      observer.unobserve(entry.target);
    });
  }, { threshold: .14 });

  document.querySelectorAll(".transformation-card, .book-card, .category-card, .review-card, .recommender").forEach(el => {
    el.style.opacity = "0";
    el.style.transform = "translateY(22px)";
    el.style.transition = "opacity .55s ease, transform .55s ease";
    observer.observe(el);
  });

  const style = document.createElement("style");
  style.textContent = `.is-visible{opacity:1!important;transform:translateY(0)!important}`;
  document.head.appendChild(style);
});
