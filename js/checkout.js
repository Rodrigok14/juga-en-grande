document.addEventListener("DOMContentLoaded", () => {
  let currentStep = 1;
  const cartItems = Cart.getItems();

  function normalizeFormat(value) {
    const raw = String(value || "").trim().toLowerCase();
    if (raw.includes("digital")) return "digital";
    return "fisico";
  }

  function getCheckoutType(items) {
    const uniqueFormats = [...new Set(items.map(item => normalizeFormat(item.format)))];
    if (uniqueFormats.length === 0) return "empty";
    if (uniqueFormats.length > 1) return "mixed";
    return uniqueFormats[0];
  }

  const checkoutType = getCheckoutType(cartItems);

  function formatSectionForType() {
    const shippingBlock = document.getElementById("shipping-section");
    const shippingTitle = document.getElementById("shipping-title");
    const shippingNote = document.getElementById("shipping-note");
    const shippingFields = ["address", "city", "zip", "country"];
    const shippingGroups = ["address-group", "city-group", "zip-group", "country-group", "city-zip-row"];

    if (checkoutType === "digital") {
      shippingBlock?.classList.add("is-digital");
      if (shippingTitle) shippingTitle.textContent = "Entrega digital";
      if (shippingNote) shippingNote.textContent = "Este pack se habilita para descarga automatica despues de que Mercado Pago confirme el pago.";
      shippingGroups.forEach(id => {
        const element = document.getElementById(id);
        if (element) element.style.display = "none";
      });
      shippingFields.forEach(id => {
        const input = document.getElementById(id);
        if (!input) return;
        input.required = false;
        input.value = "";
      });
      const country = document.getElementById("country");
      if (country) country.value = "AR";
    }

    if (checkoutType === "fisico") {
      if (shippingTitle) shippingTitle.textContent = "Envio en Tucuman";
      if (shippingNote) shippingNote.textContent = "Los libros fisicos solo se envian dentro de Tucuman, Argentina.";
    }
  }

  function renderSummary() {
    const el = document.getElementById("checkout-items");
    if (el) {
      el.innerHTML = cartItems.map(i => `
        <div class="checkout-item">
          <img class="ci-img" src="${i.cover}" alt="${i.title}" loading="lazy" />
          <div class="ci-info">
            <div class="ci-title">${i.title}</div>
            <div class="ci-qty">x ${i.qty} · ${normalizeFormat(i.format) === "digital" ? "Digital" : "Fisico"}</div>
          </div>
          <div class="ci-price">${formatPrice(i.price * i.qty)}</div>
        </div>
      `).join("") || "<p style='color:var(--color-text-3);font-size:.85rem'>Sin productos</p>";
    }

    const sub = Cart.getSubtotal();
    const shipping = checkoutType === "digital" ? 0 : (sub >= 25 ? 0 : 4.99);
    const total = sub + shipping;
    const s = id => document.getElementById(id);
    if (s("co-subtotal")) s("co-subtotal").textContent = formatPrice(sub);
    if (s("co-shipping")) {
      s("co-shipping").textContent = shipping === 0 ? "GRATIS" : formatPrice(shipping);
      s("co-shipping").style.color = shipping === 0 ? "var(--color-success)" : "";
    }
    if (s("co-total")) s("co-total").textContent = formatPrice(total);
  }

  function goToStep(n) {
    document.getElementById(`step-${currentStep}`)?.style.setProperty("display", "none");
    currentStep = n;
    document.getElementById(`step-${currentStep}`)?.style.setProperty("display", "block");
    for (let i = 1; i <= 2; i++) {
      const btn = document.getElementById(`step-${i}-btn`);
      if (!btn) continue;
      btn.classList.remove("active", "done");
      if (i < currentStep) btn.classList.add("done");
      if (i === currentStep) btn.classList.add("active");
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function setCheckoutError(message) {
    const errorBox = document.getElementById("checkout-type-error");
    if (!errorBox) return;
    errorBox.textContent = message;
    errorBox.style.display = message ? "block" : "none";
  }

  function validateStep1() {
    const fields = [
      { id: "first-name", errId: "first-name-err", label: "Nombre" },
      { id: "last-name", errId: "last-name-err", label: "Apellido" },
      { id: "email", errId: "email-err", label: "Email" }
    ];

    if (checkoutType === "fisico") {
      fields.push(
        { id: "address", errId: "address-err", label: "Direccion" },
        { id: "city", errId: "city-err", label: "Ciudad" },
        { id: "zip", errId: "zip-err", label: "Codigo postal" }
      );
    }

    let valid = true;
    fields.forEach(f => {
      const input = document.getElementById(f.id);
      const err = document.getElementById(f.errId);
      if (!input) return;
      if (!input.value.trim()) {
        input.classList.add("error");
        if (err) err.textContent = `${f.label} es requerido`;
        valid = false;
      } else if (f.id === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value)) {
        input.classList.add("error");
        if (err) err.textContent = "Email invalido";
        valid = false;
      } else {
        input.classList.remove("error");
        if (err) err.textContent = "";
      }
    });

    if (checkoutType === "fisico") {
      const city = document.getElementById("city")?.value || "";
      const country = document.getElementById("country")?.value || "";
      if (!String(city).toLowerCase().includes("tucuman") || country !== "AR") {
        const cityErr = document.getElementById("city-err");
        if (cityErr) cityErr.textContent = "Solo hacemos envios dentro de Tucuman, Argentina";
        valid = false;
      }
    }

    return valid;
  }

  async function loadOrderAccess(orderId, token, attempts = 1) {
    const response = await fetch(`/api/orders/access/${orderId}?token=${encodeURIComponent(token)}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "No se pudo validar el pedido");
    if (data.status !== "approved" && attempts > 0) {
      await new Promise(resolve => setTimeout(resolve, 2500));
      return loadOrderAccess(orderId, token, attempts - 1);
    }
    return data;
  }

  function showSuccessState(orderData) {
    Cart.clear();
    document.getElementById("step-1").style.display = "none";
    document.getElementById("step-2").style.display = "none";
    document.getElementById("checkout-success").style.display = "block";
    document.getElementById("checkout-summary").style.display = "none";
    document.getElementById("order-num").textContent = orderData.id;

    const statusEl = document.getElementById("checkout-status-copy");
    const downloadsEl = document.getElementById("checkout-downloads");
    const physicalEl = document.getElementById("checkout-physical-note");
    if (downloadsEl) downloadsEl.innerHTML = "";
    if (physicalEl) physicalEl.style.display = "none";

    if (orderData.status !== "approved") {
      if (statusEl) statusEl.textContent = "Tu pago esta pendiente. Apenas se apruebe, vas a poder volver a esta pagina para descargar tu pack.";
      return;
    }

    if (orderData.deliveryType === "digital") {
      if (statusEl) statusEl.textContent = "Pago aprobado. Tus archivos ya estan habilitados para descarga.";
      if (downloadsEl) {
        downloadsEl.innerHTML = (orderData.downloads || []).map(item => `
          <a class="btn btn-primary btn-full" href="/api/orders/access/${orderData.id}/download/${item.id}?token=${encodeURIComponent(new URLSearchParams(window.location.search).get("token") || "")}">
            Descargar ${item.title}
          </a>
        `).join("") || "<p>No hay archivos disponibles todavia.</p>";
      }
      return;
    }

    if (statusEl) statusEl.textContent = "Pago aprobado. Coordinaremos el envio dentro de Tucuman con los datos del pedido.";
    if (physicalEl) physicalEl.style.display = "block";
  }

  document.getElementById("step-1-form")?.addEventListener("submit", e => {
    e.preventDefault();
    if (cartItems.length === 0) {
      Cart.showToast("Agrega al menos un producto al carrito");
      return;
    }
    if (checkoutType === "mixed") {
      setCheckoutError("Separa los productos digitales de los fisicos antes de pagar.");
      return;
    }
    if (validateStep1()) {
      setCheckoutError("");
      goToStep(2);
      if (typeof Analytics !== "undefined") Analytics.beginCheckout(cartItems, Cart.getSubtotal());
    }
  });

  document.getElementById("back-to-step1")?.addEventListener("click", () => goToStep(1));

  document.querySelectorAll(".payment-method-option").forEach(opt => {
    opt.addEventListener("click", () => {
      document.querySelectorAll(".payment-method-option").forEach(o => o.classList.remove("active"));
      opt.classList.add("active");
      opt.querySelector("input").checked = true;
      const val = opt.querySelector("input").value;
      const cardFormEl = document.getElementById("card-form");
      const paypalInfoEl = document.getElementById("paypal-info");
      const mpInfoEl = document.getElementById("mp-info");
      if (cardFormEl) cardFormEl.style.display = "none";
      if (paypalInfoEl) paypalInfoEl.style.display = "none";
      if (mpInfoEl) mpInfoEl.style.display = val === "mercadopago" || val === "card" ? "block" : "none";
    });
  });

  const cardForm = document.getElementById("card-form");
  if (cardForm) cardForm.style.display = "none";
  const mpInfo = document.getElementById("mp-info");
  if (mpInfo) {
    mpInfo.style.display = "block";
    mpInfo.querySelector("p").textContent = "Vas a ser redirigido a Mercado Pago Checkout Pro para pagar de forma segura.";
  }
  const placeOrderBtn = document.getElementById("place-order-btn");
  if (placeOrderBtn) placeOrderBtn.textContent = "Pagar con Mercado Pago";
  document.querySelector("input[name='payment'][value='mercadopago']")?.click();

  placeOrderBtn?.addEventListener("click", async () => {
    const terms = document.getElementById("accept-terms");
    if (!terms?.checked) {
      Cart.showToast("Acepta los terminos para continuar");
      return;
    }

    const btn = document.getElementById("place-order-btn");
    btn.textContent = "Creando pago...";
    btn.disabled = true;

    try {
      const response = await fetch("/api/checkout/mercadopago", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cartItems.map(item => ({
            id: item.id,
            slug: item.slug,
            qty: item.qty
          })),
          buyer: {
            name: `${document.getElementById("first-name")?.value || ""} ${document.getElementById("last-name")?.value || ""}`.trim(),
            email: document.getElementById("email")?.value || "",
            phone: document.getElementById("phone")?.value || ""
          },
          shipping: {
            address: document.getElementById("address")?.value || "",
            city: document.getElementById("city")?.value || "",
            zip: document.getElementById("zip")?.value || "",
            country: document.getElementById("country")?.value || "AR"
          }
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo crear el pago");

      if (typeof Analytics !== "undefined") Analytics.purchase(data.orderId, cartItems, Cart.getSubtotal());
      window.location.href = data.initPoint || data.sandboxInitPoint;
    } catch (error) {
      Cart.showToast(error.message);
      btn.textContent = "Pagar con Mercado Pago";
      btn.disabled = false;
    }
  });

  const params = new URLSearchParams(window.location.search);
  const paymentStatus = params.get("payment");
  const orderId = params.get("order_id");
  const token = params.get("token");

  if (paymentStatus && orderId && token) {
    document.getElementById("step-1").style.display = "none";
    document.getElementById("step-2").style.display = "none";
    document.getElementById("checkout-success").style.display = "block";
    document.getElementById("checkout-summary").style.display = "none";
    document.getElementById("order-num").textContent = orderId;

    if (paymentStatus === "failure") {
      document.getElementById("checkout-status-copy").textContent = "El pago no se pudo completar. Podes volver a intentarlo.";
    } else {
      loadOrderAccess(orderId, token, paymentStatus === "success" ? 3 : 0)
        .then(showSuccessState)
        .catch(error => {
          document.getElementById("checkout-status-copy").textContent = error.message;
        });
    }
  }

  document.querySelectorAll("input[required]").forEach(input => {
    input.addEventListener("blur", () => {
      if (!input.value.trim()) input.classList.add("error");
      else input.classList.remove("error");
    });
  });

  if (checkoutType === "mixed") {
    setCheckoutError("No se pueden pagar juntos productos digitales y fisicos. Separa las compras.");
  }

  if (checkoutType === "empty") {
    setCheckoutError("Tu carrito esta vacio.");
  }

  formatSectionForType();
  renderSummary();
});
