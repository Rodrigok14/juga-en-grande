const state = {
  products: [],
  combos: [],
  orders: [],
  customers: [],
  requests: []
};

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];

document.addEventListener("DOMContentLoaded", init);

async function init() {
  bindLogin();
  bindTabs();
  bindModals();
  bindForms();
  const me = await api("/api/auth/me");
  if (me.authenticated) showAdmin();
}

function bindLogin() {
  $("#login-form")?.addEventListener("submit", async event => {
    event.preventDefault();
    $("#login-message").textContent = "";
    try {
      await api("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: $("#login-user").value.trim(),
          password: $("#login-password").value
        })
      });
      showAdmin();
    } catch (error) {
      $("#login-message").textContent = error.message;
    }
  });

  $("#logout-btn")?.addEventListener("click", async () => {
    await api("/api/auth/logout", { method: "POST" });
    location.reload();
  });
}

function bindTabs() {
  $$(".admin-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      $$(".admin-tab").forEach(item => item.classList.remove("active"));
      $$(".tab-panel").forEach(item => item.classList.remove("active"));
      tab.classList.add("active");
      $(`#tab-${tab.dataset.tab}`).classList.add("active");
      if (tab.dataset.tab === "orders") loadOrders();
      if (tab.dataset.tab === "customers") loadCustomers();
      if (tab.dataset.tab === "requests") loadRequests();
    });
  });
}

function bindModals() {
  $$("[data-close-modal]").forEach(button => button.addEventListener("click", closeModals));

  $("#new-product-btn")?.addEventListener("click", () => openProductModal());
  $("#new-combo-btn")?.addEventListener("click", () => openComboModal());
  $("#refresh-orders-btn")?.addEventListener("click", loadOrders);
  $("#refresh-customers-btn")?.addEventListener("click", loadCustomers);
  $("#refresh-requests-btn")?.addEventListener("click", loadRequests);
}

function bindForms() {
  $("#product-form")?.addEventListener("submit", saveProduct);
  $("#combo-form")?.addEventListener("submit", saveCombo);
}

async function showAdmin() {
  $("#login-view").style.display = "none";
  $("#admin-view").style.display = "block";
  await Promise.all([loadProducts(), loadCombos(), loadOrders()]);
}

async function loadProducts() {
  const data = await api("/api/products?all=1");
  state.products = data.products;
  renderProducts();
  renderComboProductOptions();
}

async function loadCombos() {
  const data = await api("/api/combos?all=1");
  state.combos = data.combos;
  renderCombos();
}

async function loadOrders() {
  const data = await api("/api/orders");
  state.orders = data.orders;
  renderOrders();
}

async function loadCustomers() {
  const data = await api("/api/customers");
  state.customers = data.customers;
  renderCustomers();
}

async function loadRequests() {
  const data = await api("/api/book-requests");
  state.requests = data.requests;
  renderRequests();
}

function renderProducts() {
  const products = state.products.filter(product => product.sourceType !== "combo");
  $("#products-table").innerHTML = products.map(product => `
    <tr>
      <td>
        <div class="admin-product-cell">
          <img class="admin-thumb" src="${product.image}" alt="${escapeHtml(product.title)}" />
          <div>
            <strong>${escapeHtml(product.title)}</strong>
            <div class="admin-muted">${escapeHtml(product.author || "")}</div>
            ${product.galleryImageCount > 1 ? `<div class="admin-muted">${product.galleryImageCount} imagenes disponibles</div>` : ""}
            ${product.hasDigitalFile ? `<div class="admin-muted">Archivo digital cargado</div>` : ""}
            ${product.digitalFilesManifest?.length ? `<div class="admin-muted">${product.digitalFilesManifest.length} archivo(s) dentro del pack</div>` : ""}
            ${product.hasPreview ? `<div class="admin-muted">Muestra de lectura disponible</div>` : ""}
          </div>
        </div>
      </td>
      <td>${product.format === "digital" ? "Digital" : "Fisico"}</td>
      <td>${categoryName(product.category)}</td>
      <td>${money(product.price)}</td>
      <td>${product.displayOrder ?? 0}</td>
      <td>${product.stock}</td>
      <td><span class="admin-status ${product.active ? "" : "off"}">${product.active ? "Activo" : "Oculto"}</span></td>
      <td>
        <div class="admin-row-actions">
          <button class="admin-action" data-edit-product="${product.id}">Editar</button>
          <button class="admin-action is-danger" data-delete-product="${product.id}">Eliminar</button>
        </div>
      </td>
    </tr>
  `).join("");

  $$("[data-edit-product]").forEach(button => {
    button.addEventListener("click", () => {
      const product = state.products.find(item => item.id === Number(button.dataset.editProduct));
      openProductModal(product);
    });
  });

  $$("[data-delete-product]").forEach(button => {
    button.addEventListener("click", async () => {
      const product = state.products.find(item => item.id === Number(button.dataset.deleteProduct));
      if (!product) return;
      const confirmed = window.confirm(`Eliminar "${product.title}" de la tienda?`);
      if (!confirmed) return;
      try {
        await api(`/api/products/${product.id}`, { method: "DELETE" });
        state.products = state.products.filter(item => item.id !== product.id);
        renderProducts();
        renderComboProductOptions();
        showToast("Producto eliminado");
      } catch (error) {
        showToast(error.message);
      }
    });
  });
}

function renderCombos() {
  renderPackAlerts();
  $("#combos-table").innerHTML = state.combos.map(combo => `
    <tr>
      <td>
        <div class="admin-product-cell">
          <img class="admin-thumb" src="${combo.image}" alt="${escapeHtml(combo.title)}" />
          <div>
            <strong>${escapeHtml(combo.title)}</strong>
            <div class="admin-muted">${escapeHtml(combo.description || "")}</div>
            <div class="admin-muted">${combo.hasDigitalPack ? `ZIP listo: ${escapeHtml(combo.digitalFileName || "pack.zip")}` : "ZIP pendiente: selecciona libros digitales con archivo"}</div>
          </div>
        </div>
      </td>
      <td><span class="admin-status">${pillarName(combo.pillar)}</span></td>
      <td>${combo.items.map(item => `${escapeHtml(item.title)} x${item.qty}`).join("<br>") || "-"}</td>
      <td>${money(combo.price)}</td>
      <td><span class="admin-status ${combo.active ? "" : "off"}">${combo.active ? "Activo" : "Oculto"}</span></td>
      <td>
        <div class="admin-row-actions">
          <button class="admin-action" data-edit-combo="${combo.id}">Editar</button>
          <button class="admin-action is-danger" data-delete-combo="${combo.id}">Eliminar</button>
        </div>
      </td>
    </tr>
  `).join("");

  $$("[data-edit-combo]").forEach(button => {
    button.addEventListener("click", () => {
      const combo = state.combos.find(item => item.id === Number(button.dataset.editCombo));
      openComboModal(combo);
    });
  });

  $$("[data-delete-combo]").forEach(button => {
    button.addEventListener("click", async () => {
      const combo = state.combos.find(item => item.id === Number(button.dataset.deleteCombo));
      if (!combo) return;
      const confirmed = window.confirm(`Eliminar el combo "${combo.title}" de la tienda?`);
      if (!confirmed) return;
      try {
        await api(`/api/combos/${combo.id}`, { method: "DELETE" });
        state.combos = state.combos.filter(item => item.id !== combo.id);
        renderCombos();
        await loadProducts();
        showToast("Combo eliminado");
      } catch (error) {
        showToast(error.message);
      }
    });
  });
}

function renderOrders() {
  $("#orders-table").innerHTML = state.orders.map(order => `
    <tr>
      <td>#${order.id}</td>
      <td>
        <strong>${escapeHtml(order.buyer_name || "-")}</strong>
        <div class="admin-muted">${escapeHtml(order.buyer_email || "")}</div>
      </td>
      <td>${money(order.total)}</td>
      <td><span class="admin-status">${escapeHtml(order.status)}</span></td>
      <td>${new Date(order.created_at).toLocaleString("es-AR")}</td>
    </tr>
  `).join("") || `<tr><td colspan="5" class="admin-muted">Todavia no hay pedidos.</td></tr>`;
}

function renderCustomers() {
  const table = $("#customers-table");
  if (!table) return;
  table.innerHTML = state.customers.map(customer => {
    const products = (customer.purchases || [])
      .slice(0, 3)
      .map(item => `${escapeHtml(item.productTitle || "-")} x${item.quantity || 1}`)
      .join("<br>");
    return `
      <tr>
        <td>
          <strong>${escapeHtml(customer.name || "-")}</strong>
          <div class="admin-muted">${escapeHtml(customer.email || "")}</div>
          <div class="admin-muted">${escapeHtml(customer.phone || "")}</div>
        </td>
        <td>${escapeHtml(customer.country || "-")}</td>
        <td>${customer.totalOrders}</td>
        <td>${money(customer.totalSpent)}</td>
        <td>${products || "-"}</td>
      </tr>
    `;
  }).join("") || `<tr><td colspan="5" class="admin-muted">Todavia no hay clientes aprobados.</td></tr>`;
}

function renderRequests() {
  const table = $("#requests-table");
  if (!table) return;
  table.innerHTML = state.requests.map(request => `
    <tr>
      <td>
        <strong>${escapeHtml(request.requestedTitle || "-")}</strong>
        <div class="admin-muted">${escapeHtml(request.requestedAuthor || "")}</div>
      </td>
      <td>
        <strong>${escapeHtml(request.name || "Anonimo")}</strong>
        <div class="admin-muted">${escapeHtml(request.email || "")}</div>
      </td>
      <td>${escapeHtml(request.notes || "Sin detalle adicional.")}</td>
      <td>${new Date(request.createdAt).toLocaleString("es-AR")}</td>
    </tr>
  `).join("") || `<tr><td colspan="4" class="admin-muted">Todavia no hay sugerencias cargadas.</td></tr>`;
}

function openProductModal(product = null) {
  $("#product-form").reset();
  $("#product-id").value = product?.id || "";
  $("#product-modal-title").textContent = product ? "Editar producto" : "Nuevo producto";
  $("#product-title").value = product?.title || "";
  $("#product-slug").value = product?.slug || "";
  $("#product-author").value = product?.author || "";
  $("#product-category").value = product?.category || "negocios";
  $("#product-price").value = product?.price || "";
  $("#product-old-price").value = product?.oldPrice || "";
  $("#product-display-order").value = product?.displayOrder ?? 0;
  $("#product-format").value = product?.format || "fisico";
  $("#product-stock").value = product?.stock ?? 0;
  $("#product-active").value = product?.active === false ? "0" : "1";
  $("#product-description").value = product?.description || product?.synopsis || "";
  $("#product-digital-file-status").textContent = product?.digitalFileName
    ? `Archivo actual: ${product.digitalFileName}${product?.hasPreview ? " • muestra de lectura lista" : " • sin muestra automática"}${product?.digitalFilesManifest?.length ? ` • contiene: ${product.digitalFilesManifest.join(", ")}` : ""}`
    : "Sin archivo digital cargado. Si subes varios PDF, el sistema los comprime automaticamente en un ZIP y genera la muestra desde el primer PDF.";
  $("#product-gallery-status").textContent = product?.galleryImages?.length > 1
    ? `Fotos actuales: ${product.galleryImages.length - 1} extra ademas de la portada.`
    : "Sin fotos extra cargadas.";
  $("#product-modal").showModal();
}

function openComboModal(combo = null) {
  $("#combo-form").reset();
  $("#combo-id").value = combo?.id || "";
  $("#combo-modal-title").textContent = combo ? "Editar combo" : "Nuevo combo";
  $("#combo-title").value = combo?.title || "";
  $("#combo-slug").value = combo?.slug || "";
  $("#combo-price").value = combo?.price || "";
  $("#combo-pillar").value = combo?.pillar || "dinero";
  $("#combo-featured").value = combo?.featured === false ? "0" : "1";
  $("#combo-active").value = combo?.active === false ? "0" : "1";
  $("#combo-description").value = combo?.description || "";
  renderComboProductOptions(combo?.items?.map(item => item.id) || []);
  $("#combo-digital-status").textContent = combo?.hasDigitalPack
    ? `Pack generado: ${combo.digitalFileName}${combo.digitalFilesManifest?.length ? ` • contiene ${combo.digitalFilesManifest.length} archivo(s)` : ""}`
    : "Al guardar, el sistema arma un ZIP con los PDFs de los libros digitales seleccionados.";
  $("#combo-modal").showModal();
}

function renderComboProductOptions(selected = []) {
  const select = $("#combo-products");
  if (!select) return;
  const products = state.products.filter(product => product.sourceType !== "combo" && product.format === "digital");
  select.innerHTML = products.map(product => `
    <option value="${product.id}" ${selected.includes(product.id) ? "selected" : ""} ${product.hasDigitalFile ? "" : "disabled"}>
      ${escapeHtml(product.title)} - ${money(product.price)}${product.hasDigitalFile ? "" : " (sin PDF/ZIP)"}
    </option>
  `).join("");
}

async function saveProduct(event) {
  event.preventDefault();
  const submitButton = event.submitter || $("#product-form button[type='submit']");
  setFormState(submitButton, true, "Guardando producto...");
  const id = $("#product-id").value;
  const form = new FormData();
  try {
    const title = $("#product-title").value.trim();
    const slug = $("#product-slug").value.trim();
    const format = $("#product-format").value;
    const digitalFiles = [...$("#product-digital-files").files];
    if (!title || !slug) throw new Error("Completa titulo y slug antes de guardar");
    if (!id && format === "digital" && digitalFiles.length === 0) {
      throw new Error("Para un producto digital nuevo debes subir al menos un PDF o ZIP");
    }
    form.set("title", title);
    form.set("slug", slug);
    form.set("author", $("#product-author").value.trim());
    form.set("category", $("#product-category").value);
    form.set("price", $("#product-price").value);
    form.set("oldPrice", $("#product-old-price").value);
    form.set("displayOrder", $("#product-display-order").value);
    form.set("format", format);
    form.set("stock", $("#product-stock").value);
    form.set("active", $("#product-active").value);
    form.set("description", $("#product-description").value.trim());
    const shouldUseBlobUpload = canUseClientBlobUpload();
    const imageFile = $("#product-image").files[0] || null;
    const galleryFiles = [...$("#product-gallery-images").files].slice(0, 3);
    if (shouldUseBlobUpload) {
      if (imageFile) {
        const imageBlob = await uploadAdminFile(imageFile, "image", submitButton);
        form.set("imageBlob", JSON.stringify(imageBlob));
      }
      if (galleryFiles.length) {
        const galleryBlobs = [];
        for (const file of galleryFiles) {
          galleryBlobs.push(await uploadAdminFile(file, "image", submitButton));
        }
        form.set("galleryImageBlobs", JSON.stringify(galleryBlobs));
      }
      if (digitalFiles.length) {
        const digitalBlobs = [];
        for (const file of digitalFiles) {
          digitalBlobs.push(await uploadAdminFile(file, "digital", submitButton));
        }
        form.set("digitalFileBlobs", JSON.stringify(digitalBlobs));
      }
    } else {
      if (imageFile) form.set("image", imageFile);
      galleryFiles.forEach(file => form.append("galleryImages", file));
      digitalFiles.forEach(file => form.append("digitalFiles", file));
    }
    await api(id ? `/api/products/${id}` : "/api/products", { method: id ? "PUT" : "POST", body: form });
    closeModals();
    await loadProducts();
    showToast("Producto guardado");
  } catch (error) {
    showToast(error.message);
  } finally {
    setFormState(submitButton, false);
  }
}

async function saveCombo(event) {
  event.preventDefault();
  const id = $("#combo-id").value;
  const form = new FormData();
  form.set("title", $("#combo-title").value.trim());
  form.set("slug", $("#combo-slug").value.trim());
  form.set("price", $("#combo-price").value);
  form.set("pillar", $("#combo-pillar").value);
  form.set("featured", $("#combo-featured").value);
  form.set("active", $("#combo-active").value);
  form.set("description", $("#combo-description").value.trim());
  const productIds = [...$("#combo-products").selectedOptions].map(option => option.value);
  if (productIds.length === 0) {
    showToast("Selecciona al menos un libro digital con PDF o ZIP");
    return;
  }
  form.set("productIds", productIds.join(","));
  if ($("#combo-image").files[0]) form.set("image", $("#combo-image").files[0]);
  await api(id ? `/api/combos/${id}` : "/api/combos", { method: id ? "PUT" : "POST", body: form });
  closeModals();
  await loadCombos();
  showToast("Combo guardado");
}

function closeModals() {
  $$("dialog[open]").forEach(dialog => dialog.close());
}

async function api(url, options = {}) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Error de servidor");
  return data;
}

function setFormState(button, isLoading, label = "Guardando...") {
  if (!button) return;
  if (isLoading) {
    button.dataset.originalText = button.textContent;
    button.textContent = label;
    button.disabled = true;
    button.classList.add("is-loading");
    return;
  }
  button.textContent = button.dataset.originalText || button.textContent;
  button.disabled = false;
  button.classList.remove("is-loading");
}

function canUseClientBlobUpload() {
  return location.hostname !== "localhost" && location.hostname !== "127.0.0.1";
}

async function uploadAdminFile(file, type, button) {
  if (!window.__vercelBlobClient) {
    window.__vercelBlobClient = import("https://esm.sh/@vercel/blob@1.1.1/client");
  }
  const { upload } = await window.__vercelBlobClient;
  const safeName = String(file.name || "archivo")
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, "-");
  const folder = type === "image" ? "admin-images" : "admin-digital";
  const contentType = inferUploadContentType(file, type);
  const blob = await upload(`${folder}/${Date.now()}-${safeName}`, file, {
    access: "public",
    contentType,
    multipart: file.size > 8 * 1024 * 1024,
    handleUploadUrl: "/api/blob/upload",
    clientPayload: JSON.stringify({ type }),
    onUploadProgress: event => {
      const percent = Math.round((event.loaded / event.total) * 100);
      setFormState(button, true, `Subiendo ${file.name} ${percent}%`);
    }
  });
  return {
    url: blob.url,
    pathname: blob.pathname || safeName,
    name: file.name,
    contentType
  };
}

function inferUploadContentType(file, type) {
  const current = String(file.type || "").trim();
  if (current) return current;
  const name = String(file.name || "").toLowerCase();
  if (name.endsWith(".pdf")) return "application/pdf";
  if (name.endsWith(".zip")) return "application/zip";
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".webp")) return "image/webp";
  if (type === "image") return "image/jpeg";
  return "application/pdf";
}

function money(value) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(Number(value || 0));
}

function categoryName(value) {
  return ({
    "educacion-financiera": "Educación financiera",
    "crecimiento-personal": "Crecimiento personal",
    dinero: "Dinero",
    amor: "Amor",
    negocios: "Dinero",
    desarrollo: "Mentalidad",
    ventas: "Ventas",
    productividad: "Productividad",
    noficcion: "Conocimiento"
  })[value] || value;
}

function pillarName(value) {
  return categoryName(value);
}

function renderPackAlerts() {
  const container = $("#pack-alerts");
  if (!container) return;
  const pillars = [
    ["educacion-financiera", "Educación financiera"],
    ["crecimiento-personal", "Crecimiento personal"],
    ["dinero", "Dinero"],
    ["amor", "Amor"]
  ];
  const activeCombos = state.combos.filter(combo => combo.active && combo.hasDigitalPack);
  container.innerHTML = pillars.map(([id, label]) => {
    const count = activeCombos.filter(combo => combo.pillar === id).length;
    return `
      <div class="admin-pack-alert ${count ? "is-ok" : "is-missing"}">
        <strong>${count ? "Listo" : "Falta pack"}</strong>
        <span>${label}</span>
        <small>${count ? `${count} pack(s) activos en la tienda` : `Armá al menos 1 pack para que este pilar aparezca fuerte en la home`}</small>
      </div>
    `;
  }).join("");
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
}

function showToast(message) {
  const toast = $("#toast");
  $("#toast-msg").textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2200);
}
