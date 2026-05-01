const BOOKS = [
  {
    id: 1, slug: "el-poder-del-ahora",
    title: "El Poder del Ahora",
    author: "Eckhart Tolle",
    category: "desarrollo",
    price: 18.99, oldPrice: 24.99,
    rating: 4.9, reviews: 3241,
    format: "físico",
    badge: "bestseller",
    cover: "assets/images/book_personal_dev.png",
    synopsis: "Una guía para dominar el presente, bajar el ruido mental y decidir con más claridad.",
    stock: 4,
    pages: 236, language: "Español",
    featured: true, staffPick: true,
    staffNote: "Ideal para recuperar foco y presencia antes de tomar decisiones importantes.",
    tags: ["mindfulness", "mentalidad", "claridad", "consciencia"]
  },
  {
    id: 2, slug: "atomic-habits",
    title: "Atomic Habits",
    author: "James Clear",
    category: "productividad",
    price: 21.99, oldPrice: 29.99,
    rating: 4.9, reviews: 8752,
    format: "físico",
    badge: "bestseller",
    cover: "assets/images/book_personal_dev.png",
    synopsis: "Un sistema práctico para construir hábitos, eliminar fricción y sostener el progreso.",
    stock: 12,
    pages: 320, language: "Español",
    featured: true, staffPick: false,
    tags: ["hábitos", "productividad", "disciplina", "rutina"]
  },
  {
    id: 3, slug: "sapiens",
    title: "Sapiens: De Animales a Dioses",
    author: "Yuval Noah Harari",
    category: "noficcion",
    price: 19.99, oldPrice: null,
    rating: 4.8, reviews: 6431,
    format: "físico",
    badge: "bestseller",
    cover: "assets/images/book_nonfiction.png",
    synopsis: "Una mirada amplia sobre la humanidad para entender mejor cultura, poder y decisiones colectivas.",
    stock: 8,
    pages: 496, language: "Español",
    featured: true, staffPick: true,
    staffNote: "Expande la forma de pensar sistemas, historia y comportamiento humano.",
    tags: ["historia", "conocimiento", "humanidad", "poder"]
  },
  {
    id: 4, slug: "el-alquimista",
    title: "El Alquimista",
    author: "Paulo Coelho",
    category: "desarrollo",
    price: 14.99, oldPrice: 18.99,
    rating: 4.8, reviews: 11203,
    format: "físico",
    badge: "bestseller",
    cover: "assets/images/book_fiction.png",
    synopsis: "Una historia sobre propósito, decisión y la búsqueda de una vida más grande.",
    stock: 2,
    pages: 208, language: "Español",
    featured: true, staffPick: false,
    tags: ["propósito", "mentalidad", "visión", "crecimiento"]
  },
  {
    id: 5, slug: "piense-y-hagase-rico",
    title: "Piense y Hágase Rico",
    author: "Napoleon Hill",
    category: "negocios",
    price: 16.99, oldPrice: null,
    rating: 4.7, reviews: 4521,
    format: "físico",
    badge: null,
    cover: "assets/images/book_business.png",
    synopsis: "Principios de ambición, enfoque y riqueza para entrenar una mentalidad orientada a resultados.",
    stock: 15,
    pages: 344, language: "Español",
    featured: true, staffPick: true,
    staffNote: "Un clásico para conectar deseo, disciplina y objetivos económicos.",
    tags: ["finanzas", "éxito", "mentalidad", "riqueza"]
  },
  {
    id: 6, slug: "psicologia-del-dinero",
    title: "La Psicología del Dinero",
    author: "Morgan Housel",
    category: "negocios",
    price: 23.99, oldPrice: null,
    rating: 4.8, reviews: 5024,
    format: "físico",
    badge: "new",
    cover: "assets/images/book_business.png",
    synopsis: "Lecciones sobre comportamiento, paciencia y decisiones financieras inteligentes.",
    stock: 10,
    pages: 256, language: "Español",
    featured: true, staffPick: false,
    tags: ["dinero", "finanzas", "inversión", "comportamiento"]
  },
  {
    id: 7, slug: "padre-rico-padre-pobre",
    title: "Padre Rico, Padre Pobre",
    author: "Robert T. Kiyosaki",
    category: "negocios",
    price: 19.99, oldPrice: 25.99,
    rating: 4.7, reviews: 7823,
    format: "físico",
    badge: "sale",
    cover: "assets/images/book_business.png",
    synopsis: "Las lecciones que cambian la forma de mirar activos, ingresos y libertad financiera.",
    stock: 20,
    pages: 280, language: "Español",
    featured: true, staffPick: false,
    tags: ["finanzas personales", "inversión", "activos", "dinero"]
  },
  {
    id: 8, slug: "vendele-a-la-mente",
    title: "Véndele a la Mente, No a la Gente",
    author: "Jürgen Klaric",
    category: "ventas",
    price: 18.99, oldPrice: 22.99,
    rating: 4.6, reviews: 2218,
    format: "físico",
    badge: "sale",
    cover: "assets/images/book_business.png",
    synopsis: "Neuroventas aplicadas para comunicar mejor, persuadir y cerrar más oportunidades.",
    stock: 9,
    pages: 240, language: "Español",
    featured: true, staffPick: false,
    tags: ["ventas", "persuasión", "negocio", "cliente"]
  },
  {
    id: 9, slug: "1984",
    title: "1984",
    author: "George Orwell",
    category: "noficcion",
    price: 13.99, oldPrice: 17.99,
    rating: 4.8, reviews: 8901,
    format: "físico",
    badge: "new",
    cover: "assets/images/book_fiction.png",
    synopsis: "Una lectura para entrenar pensamiento crítico sobre poder, control y libertad.",
    stock: 11,
    pages: 328, language: "Español",
    featured: true, staffPick: false,
    tags: ["pensamiento crítico", "poder", "sociedad", "libertad"]
  },
  {
    id: 10, slug: "la-startup-lean",
    title: "El Método Lean Startup",
    author: "Eric Ries",
    category: "ventas",
    price: 22.99, oldPrice: null,
    rating: 4.6, reviews: 2341,
    format: "físico",
    badge: "new",
    cover: "assets/images/book_business.png",
    synopsis: "Cómo probar ideas rápido, aprender del mercado y construir negocios con menos desperdicio.",
    stock: 7,
    pages: 320, language: "Español",
    featured: true, staffPick: false,
    tags: ["emprendimiento", "startup", "negocio", "ventas"]
  },
  {
    id: 11, slug: "enfocate",
    title: "Enfócate",
    author: "Cal Newport",
    category: "productividad",
    price: 20.99, oldPrice: null,
    rating: 4.7, reviews: 1872,
    format: "físico",
    badge: "new",
    cover: "assets/images/book_personal_dev.png",
    synopsis: "Estrategias para concentrarte, elegir mejor y proteger tu energía mental.",
    stock: 5,
    pages: 256, language: "Español",
    featured: false, staffPick: false,
    tags: ["foco", "productividad", "concentración", "trabajo"]
  },
  {
    id: 12, slug: "el-hombre-mas-rico-de-babilonia",
    title: "El Hombre Más Rico de Babilonia",
    author: "George S. Clason",
    category: "negocios",
    price: 14.99, oldPrice: 19.99,
    rating: 4.7, reviews: 3102,
    format: "físico",
    badge: "sale",
    cover: "assets/images/book_business.png",
    synopsis: "Principios simples y potentes para ahorrar, invertir y hacer crecer el dinero.",
    stock: 13,
    pages: 192, language: "Español",
    featured: false, staffPick: false,
    tags: ["ahorro", "dinero", "riqueza", "finanzas"]
  },
  {
    id: 13, slug: "empieza-con-el-porque",
    title: "Empieza con el Porqué",
    author: "Simon Sinek",
    category: "ventas",
    price: 18.99, oldPrice: null,
    rating: 4.7, reviews: 4203,
    format: "digital",
    badge: "new",
    cover: "assets/images/book_business.png",
    synopsis: "Cómo líderes y marcas inspiran acción cuando comunican desde una causa clara.",
    stock: 99,
    pages: 256, language: "Español",
    featured: true, staffPick: false,
    tags: ["liderazgo", "ventas", "marca", "negocio"]
  },
  {
    id: 14, slug: "los-cuatro-acuerdos",
    title: "Los Cuatro Acuerdos",
    author: "Don Miguel Ruiz",
    category: "desarrollo",
    price: 14.99, oldPrice: null,
    rating: 4.8, reviews: 6741,
    format: "físico",
    badge: null,
    cover: "assets/images/book_personal_dev.png",
    synopsis: "Un código de conducta para reducir ruido mental y vivir con más intención.",
    stock: 14,
    pages: 168, language: "Español",
    featured: true, staffPick: false,
    tags: ["sabiduría", "mentalidad", "crecimiento", "autoayuda"]
  },
  {
    id: 15, slug: "deep-work",
    title: "Trabajo Profundo",
    author: "Cal Newport",
    category: "productividad",
    price: 20.99, oldPrice: 26.99,
    rating: 4.8, reviews: 3812,
    format: "digital",
    badge: "sale",
    cover: "assets/images/book_personal_dev.png",
    synopsis: "Reglas para concentrarte en tareas de alto valor en un mundo lleno de distracciones.",
    stock: 99,
    pages: 304, language: "Español",
    featured: true, staffPick: false,
    tags: ["productividad", "foco", "trabajo", "concentración"]
  },
  {
    id: 16, slug: "habitos-atomicos-cuaderno",
    title: "Plan de Acción de Hábitos",
    author: "Jugá en Grande",
    category: "productividad",
    price: 9.99, oldPrice: null,
    rating: 4.6, reviews: 903,
    format: "digital",
    badge: null,
    cover: "assets/images/book_personal_dev.png",
    synopsis: "Una guía digital para convertir lectura en acciones semanales medibles.",
    stock: 99,
    pages: 80, language: "Español",
    featured: false, staffPick: false,
    tags: ["acción", "hábitos", "plan", "productividad"]
  }
];

const CATEGORIES = [
  { id: "negocios", name: "Dinero", icon: "$", count: 756, color: "#00FF88" },
  { id: "desarrollo", name: "Mentalidad", icon: "M", count: 1102, color: "#D4AF37" },
  { id: "ventas", name: "Ventas", icon: "V", count: 420, color: "#58D7FF" },
  { id: "productividad", name: "Productividad", icon: "P", count: 534, color: "#FFFFFF" },
  { id: "noficcion", name: "Conocimiento", icon: "C", count: 980, color: "#00C853" }
];

const REVIEWS = [
  {
    name: "María González",
    rating: 5,
    date: "hace 2 días",
    text: "Compré libros de finanzas y cambié la forma en que organizo mi sueldo. Ahora tengo un plan.",
    book: "Padre Rico, Padre Pobre"
  },
  {
    name: "Carlos Rodríguez",
    rating: 5,
    date: "hace 5 días",
    text: "La selección no se siente como una librería común. Te empuja a leer con un objetivo claro.",
    book: "Atomic Habits"
  },
  {
    name: "Laura Martínez",
    rating: 5,
    date: "hace 1 semana",
    text: "El diseño y la curaduría hacen que sea fácil elegir qué leer según lo que querés lograr.",
    book: "Trabajo Profundo"
  }
];

const BLOG_POSTS = [
  {
    id: 1, slug: "libros-para-ganar-mas",
    title: "5 libros para pensar mejor el dinero",
    excerpt: "Una ruta de lectura para pasar de inspiración a decisiones financieras concretas.",
    category: "Dinero",
    emoji: "$",
    date: "28 Abr 2026",
    readTime: "6 min"
  },
  {
    id: 2, slug: "mentalidad-de-exito",
    title: "Cómo leer para cambiar tu mentalidad",
    excerpt: "No se trata de leer más, sino de leer con intención y ejecutar lo aprendido.",
    category: "Mentalidad",
    emoji: "M",
    date: "24 Abr 2026",
    readTime: "8 min"
  },
  {
    id: 3, slug: "productividad-lectora",
    title: "Convertí un libro en un plan de acción",
    excerpt: "Un sistema simple para transformar ideas en hábitos, decisiones y resultados.",
    category: "Productividad",
    emoji: "P",
    date: "20 Abr 2026",
    readTime: "5 min"
  }
];

function getBookById(id) { return BOOKS.find(b => b.id === id); }
function getBookBySlug(slug) { return BOOKS.find(b => b.slug === slug); }
function getBestSellers() { return BOOKS.filter(b => b.badge === "bestseller"); }
function getNewReleases() { return BOOKS.filter(b => b.badge === "new"); }
function getStaffPicks() { return BOOKS.filter(b => b.staffPick); }
function getFeatured() { return BOOKS.filter(b => b.featured); }
function getByCategory(cat) { return BOOKS.filter(b => b.category === cat); }
function getRelated(book, n = 4) {
  return BOOKS.filter(b => b.id !== book.id && b.category === book.category).slice(0, n);
}
function searchBooks(q) {
  const query = q.toLowerCase();
  return BOOKS.filter(b =>
    b.title.toLowerCase().includes(query) ||
    b.author.toLowerCase().includes(query) ||
    b.category.toLowerCase().includes(query) ||
    b.tags.some(t => t.toLowerCase().includes(query))
  );
}
function starsHTML(rating) {
  const full = Math.floor(rating);
  const half = rating % 1 >= 0.5;
  let s = "★".repeat(full);
  if (half) s += "½";
  return s;
}
function formatPrice(p) { return "$" + parseFloat(p).toFixed(2); }
