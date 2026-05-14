document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("purchases-form");
  const orderInput = document.getElementById("purchase-order-id");
  const tokenInput = document.getElementById("purchase-token");
  const feedback = document.getElementById("purchases-feedback");
  const results = document.getElementById("purchases-results");
  const params = new URLSearchParams(window.location.search);

  if (params.get("order_id")) orderInput.value = params.get("order_id");
  if (params.get("token")) tokenInput.value = params.get("token");
  if (orderInput.value && tokenInput.value) loadPurchase();

  form?.addEventListener("submit", event => {
    event.preventDefault();
    loadPurchase();
  });

  async function loadPurchase() {
    const orderId = orderInput.value.trim();
    const token = tokenInput.value.trim();
    if (!orderId || !token) return;

    setFeedback("Buscando tu compra...", false);
    results.innerHTML = "";

    try {
      const response = await fetch(`/api/orders/access/${encodeURIComponent(orderId)}?token=${encodeURIComponent(token)}`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "No se pudo encontrar el pedido");

      if (data.status !== "approved") {
        results.innerHTML = `
          <div class="empty-packs">
            <strong>El pago todavía no figura aprobado.</strong>
            <span>Si ya pagaste, esperá unos minutos o escribinos por WhatsApp para revisarlo.</span>
            <a href="https://wa.me/543816590235?text=Hola,%20mi%20pedido%20${encodeURIComponent(orderId)}%20todavía%20no%20me%20habilita%20la%20descarga" target="_blank" rel="noopener noreferrer">Pedir ayuda</a>
          </div>
        `;
        setFeedback("Pedido encontrado, pendiente de aprobación.", false);
        return;
      }

      const downloads = Array.isArray(data.downloads) ? data.downloads : [];
      if (!downloads.length) {
        results.innerHTML = `
          <div class="empty-packs">
            <strong>Este pedido no tiene descargas digitales disponibles.</strong>
            <span>Puede ser un producto físico o faltar el archivo digital.</span>
          </div>
        `;
        setFeedback("Pedido aprobado, sin descargas digitales.", false);
        return;
      }

      results.innerHTML = downloads.map(item => `
        <article class="purchase-download-card">
          <div>
            <span>Pedido #${escapeHtml(data.id)}</span>
            <h3>${escapeHtml(item.title)}</h3>
            <p>${escapeHtml(item.fileName || "Archivo digital")}</p>
          </div>
          <a class="btn btn-primary" href="/api/orders/access/${encodeURIComponent(data.id)}/download/${encodeURIComponent(item.id)}?token=${encodeURIComponent(token)}">Descargar</a>
        </article>
      `).join("");
      setFeedback(`Compra aprobada para ${data.buyerEmail || "tu email"}.`, true);
    } catch (error) {
      results.innerHTML = `
        <div class="empty-packs">
          <strong>No pudimos abrir tu compra.</strong>
          <span>${escapeHtml(error.message)}</span>
          <a href="https://wa.me/543816590235?text=Hola,%20necesito%20ayuda%20para%20descargar%20mi%20compra" target="_blank" rel="noopener noreferrer">Pedir ayuda</a>
        </div>
      `;
      setFeedback(error.message, false, true);
    }
  }

  function setFeedback(message, success, error = false) {
    feedback.textContent = message;
    feedback.classList.toggle("is-success", success);
    feedback.classList.toggle("is-error", error);
  }

  function escapeHtml(value = "") {
    return String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
  }
});
