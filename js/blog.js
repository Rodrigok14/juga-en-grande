/* ================================================
   BLOG PAGE — JS
   ================================================ */

const FULL_POSTS = [
  {
    id: 1, slug: "top-10-libros-negocios-2026",
    title: "Top 10 Libros de Negocios que Debes Leer en 2026",
    excerpt: "Seleccionamos los libros que todo emprendedor y profesional debe tener en su biblioteca este año.",
    category: "Negocios",
    emoji: "💼",
    date: "28 Abr 2026",
    readTime: "6 min",
    featured: true,
    content: `
      <p>El mundo de los negocios evoluciona a una velocidad vertiginosa. Los líderes y emprendedores que se mantienen a la vanguardia son aquellos que no dejan de aprender. Aquí nuestra selección definitiva para 2026.</p>

      <h2>1. Atomic Habits — James Clear</h2>
      <p>No es estrictamente un libro de negocios, pero sus principios sobre la formación de hábitos son <strong>imprescindibles para cualquier profesional</strong>. La idea central: mejoras del 1% diario llevan a resultados extraordinarios.</p>

      <h2>2. Padre Rico, Padre Pobre — Robert Kiyosaki</h2>
      <p>Un clásico que sigue siendo relevante. La distinción entre activos y pasivos, y cómo pensar sobre el dinero de forma diferente.</p>

      <h2>3. El Método Lean Startup — Eric Ries</h2>
      <p>Para fundadores y equipos de producto: cómo iterar rápido, aprender de los clientes y <strong>construir lo que el mercado realmente quiere</strong>.</p>

      <h2>4. Empieza con el Porqué — Simon Sinek</h2>
      <p>¿Por qué Apple inspira fidelidad mientras otras marcas no? La respuesta está en el "Golden Circle" de Sinek. Lectura obligatoria para líderes.</p>

      <h2>5. Piense y Hágase Rico — Napoleon Hill</h2>
      <p>Escrito en 1937 pero más vigente que nunca. Los 13 principios del éxito financiero que Hill extrajo de entrevistas con los hombres más ricos de su época.</p>

      <ul>
        <li>Deseo ardiente y fe en el objetivo</li>
        <li>Planificación organizada</li>
        <li>Poder de la mente subconsciente</li>
        <li>Transmutación de la energía sexual</li>
        <li>El cerebro como estación de transmisión</li>
      </ul>

      <div class="article-cta-box">
        <h3>¿Listo para tu próxima lectura de negocios?</h3>
        <p>Explora nuestra colección completa y encuentra el libro que transformará tu carrera.</p>
        <a href="catalogo.html?cat=negocios" class="btn btn-primary">Ver libros de negocios →</a>
      </div>
    `
  },
  {
    id: 2, slug: "libros-cambian-tu-mentalidad",
    title: "7 Libros que Literalmente Cambiarán tu Forma de Pensar",
    excerpt: "Estos libros no solo se leen: se experimentan. Prepárate para cuestionar todo lo que creías saber.",
    category: "Desarrollo Personal",
    emoji: "🧠",
    date: "24 Abr 2026",
    readTime: "8 min",
    featured: false,
    content: `
      <p>Hay libros que entretienes. Y hay libros que te transforman. Esta lista pertenece a la segunda categoría. No te prometemos que la lectura sea cómoda — te prometemos que saldrás siendo otra persona.</p>

      <h2>1. El Poder del Ahora — Eckhart Tolle</h2>
      <p>¿Cuánto tiempo de tu vida pasas en el pasado o en el futuro, sin vivir el momento presente? Tolle propone una salida radical a través de la consciencia plena. Un libro que puede <strong>cambiar tu relación con el tiempo</strong>.</p>

      <h2>2. Los Cuatro Acuerdos — Don Miguel Ruiz</h2>
      <p>Basado en la sabiduría tolteca ancestral, estos cuatro principios simples tienen el poder de liberar décadas de condicionamiento mental. Sé impecable con tus palabras. No tomes nada personalmente.</p>

      <h2>3. Sapiens — Yuval Noah Harari</h2>
      <p>¿Qué somos realmente? Harari recorre 70.000 años de historia humana para mostrarnos que gran parte de lo que creemos "natural" es, en realidad, una construcción social. <strong>Difícil de leer sin que te cambie la perspectiva.</strong></p>

      <h2>4. Atomic Habits — James Clear</h2>
      <p>No cambias siendo quien eres — cambias siendo quien decides ser. Clear muestra que la identidad precede al comportamiento, no al revés.</p>

      <div class="article-cta-box">
        <h3>Encuentra tu próximo libro transformador</h3>
        <p>Nuestra colección de desarrollo personal tiene cientos de títulos que cambiarán tu perspectiva.</p>
        <a href="catalogo.html?cat=desarrollo" class="btn btn-primary">Explorar desarrollo personal →</a>
      </div>
    `
  },
  {
    id: 3, slug: "guia-leer-mas-rapido",
    title: "Cómo Leer 52 Libros al Año (Sin Sacrificar tu Vida Social)",
    excerpt: "Estrategias comprobadas de lectores voraces para hacer del hábito de leer parte de tu rutina.",
    category: "Hábitos",
    emoji: "⚡",
    date: "20 Abr 2026",
    readTime: "5 min",
    featured: false,
    content: `
      <p>Un libro por semana. 52 al año. Parece imposible si actualmente lees 5 o menos al año. Pero con el sistema correcto, no solo es posible — se vuelve natural.</p>

      <h2>El secreto: consistencia antes que velocidad</h2>
      <p>La mayoría de los "hacks" de lectura rápida se enfocan en leer más rápido. Pero el verdadero secreto es leer con más <strong>consistencia</strong>. 20 minutos diarios = más de 7 horas al mes = 2-3 libros fácilmente.</p>

      <h2>Estrategias que realmente funcionan</h2>
      <ul>
        <li><strong>Batch reading:</strong> Ten 2-3 libros activos de géneros distintos</li>
        <li><strong>Dead time:</strong> Audiolibros mientras caminas, cocinas o te transportas</li>
        <li><strong>Antes de dormir:</strong> 20 minutos de lectura en lugar de redes sociales</li>
        <li><strong>La regla del 20%:</strong> Si no te atrapa en el primer 20%, déjalo</li>
        <li><strong>Nota de 3 ideas:</strong> Escribe las 3 ideas principales — refuerza la retención</li>
      </ul>

      <h2>Tu stack de lectura ideal</h2>
      <p>Recomendamos mantener siempre:</p>
      <ul>
        <li>1 libro de no ficción (aprendizaje)</li>
        <li>1 libro de ficción (disfrute puro)</li>
        <li>1 audiolibro (para movimiento)</li>
      </ul>

      <div class="article-cta-box">
        <h3>Empieza tu stack de lectura hoy</h3>
        <p>Elige tus próximos libros y construye el hábito desde mañana.</p>
        <a href="catalogo.html" class="btn btn-primary">Explorar catálogo →</a>
      </div>
    `
  }
];

document.addEventListener("DOMContentLoaded", () => {

  const navbar = document.getElementById("navbar");
  window.addEventListener("scroll", () => {
    navbar?.classList.toggle("scrolled", window.scrollY > 50);
  }, { passive: true });

  /* ---- Check for single post in URL ---- */
  const params = new URLSearchParams(window.location.search);
  const slug   = params.get("slug");
  if (slug) {
    showPost(FULL_POSTS.find(p => p.slug === slug));
    return;
  }

  let activeCategory = "";

  /* ---- Featured post ---- */
  const featured = FULL_POSTS.find(p => p.featured) || FULL_POSTS[0];
  const featEl = document.getElementById("featured-post");
  if (featEl && featured) {
    featEl.innerHTML = `
      <div class="featured-post-img">${featured.emoji}</div>
      <div class="featured-post-body">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
          <span class="featured-tag">${featured.category}</span>
          <span class="featured-badge">⭐ Destacado</span>
        </div>
        <h2 class="featured-post-title">${featured.title}</h2>
        <p class="featured-post-excerpt">${featured.excerpt}</p>
        <div class="featured-post-meta">
          <span>📅 ${featured.date}</span>
          <span>⏱ ${featured.readTime} lectura</span>
        </div>
        <span class="featured-read-link">Leer artículo →</span>
      </div>
    `;
    featEl.addEventListener("click", () => showPost(featured));
  }

  /* ---- Category filter ---- */
  document.querySelectorAll(".blog-cat-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".blog-cat-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      activeCategory = btn.dataset.cat;
      renderPosts();
    });
  });

  /* ---- Render posts ---- */
  function renderPosts() {
    const grid = document.getElementById("blog-posts-grid");
    if (!grid) return;

    const filtered = activeCategory
      ? FULL_POSTS.filter(p => p.category === activeCategory)
      : FULL_POSTS;

    if (filtered.length === 0) {
      grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:60px;color:var(--color-text-2)">
        No hay artículos en esta categoría todavía.
      </div>`;
      return;
    }

    grid.innerHTML = filtered.map((p, i) => `
      <div class="blog-post-card" data-slug="${p.slug}" style="animation:fadeInUp .4s ${i * 0.07}s ease both">
        <div class="bpc-img">${p.emoji}</div>
        <div class="bpc-body">
          <div class="bpc-category">${p.category}</div>
          <div class="bpc-title">${p.title}</div>
          <div class="bpc-excerpt">${p.excerpt}</div>
          <div class="bpc-meta">
            <span>📅 ${p.date}</span>
            <span class="bpc-read">⏱ ${p.readTime} →</span>
          </div>
        </div>
      </div>
    `).join("");

    grid.querySelectorAll(".blog-post-card").forEach(card => {
      card.addEventListener("click", () => {
        const post = FULL_POSTS.find(p => p.slug === card.dataset.slug);
        if (post) showPost(post);
      });
    });
  }

  /* ---- Show single post ---- */
  function showPost(post) {
    if (!post) return;
    document.getElementById("featured-post-section").style.display = "none";
    document.getElementById("all-posts-section").style.display     = "none";
    document.querySelector(".blog-categories-bar").style.display   = "none";

    const articleEl = document.getElementById("blog-article");
    const contentEl = document.getElementById("article-content");
    if (!articleEl || !contentEl) return;

    articleEl.style.display = "block";
    contentEl.innerHTML = `
      <div class="article-header">
        <div class="article-category">${post.category}</div>
        <h1 class="article-title">${post.title}</h1>
        <div class="article-meta">
          <span>📅 ${post.date}</span>
          <span>⏱ ${post.readTime} de lectura</span>
        </div>
      </div>
      <span class="article-hero-emoji">${post.emoji}</span>
      <div class="article-body">${post.content}</div>
    `;

    document.title = `${post.title} | Blog de Librería Universo`;
    window.scrollTo({ top: 0, behavior: "smooth" });

    if (typeof Analytics !== "undefined")
      Analytics.track("view_blog_post", { post_slug: post.slug, post_title: post.title });
  }

  /* ---- Back to blog ---- */
  document.getElementById("back-to-blog")?.addEventListener("click", () => {
    document.getElementById("blog-article").style.display = "none";
    document.getElementById("featured-post-section").style.display = "block";
    document.getElementById("all-posts-section").style.display     = "block";
    document.querySelector(".blog-categories-bar").style.display   = "block";
    document.title = "Blog de Libros | Librería Universo";
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  renderPosts();
});
