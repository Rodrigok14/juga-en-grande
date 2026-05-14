document.addEventListener("DOMContentLoaded", () => {
  let currentStep = 1;
  let exchangeRate = null;
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

  function selectedCountry() {
    return (document.getElementById("country")?.value || "AR").toUpperCase();
  }

  function paymentProvider() {
    if (checkoutType === "digital" && selectedCountry() !== "AR") return "paypal";
    return "mercadopago";
  }

  function formatArs(value) {
    return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(Number(value || 0));
  }

  function formatUsd(value) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value || 0));
  }

  async function loadExchangeRate() {
    if (exchangeRate) return exchangeRate;
    const response = await fetch("/api/exchange-rate");
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "No se pudo obtener el valor del dolar");
    exchangeRate = Number(data.usdArsRate || 0);
    if (!exchangeRate) throw new Error("El valor del dolar recibido no es valido");
    return exchangeRate;
  }

  function setCheckoutError(message) {
    const errorBox = document.getElementById("checkout-type-error");
    if (!errorBox) return;
    errorBox.textContent = message;
    errorBox.style.display = message ? "block" : "none";
  }

  function formatSectionForType() {
    const shippingBlock = document.getElementById("shipping-section");
    const shippingTitle = document.getElementById("shipping-title");
    const shippingNote = document.getElementById("shipping-note");
    const shippingFields = ["address", "city", "zip"];
    const shippingGroups = ["address-group", "city-group", "zip-group", "city-zip-row"];

    if (checkoutType === "digital") {
      shippingBlock?.classList.add("is-digital");
      if (shippingTitle) shippingTitle.textContent = "Pais de facturacion";
      if (shippingNote) shippingNote.textContent = "Argentina paga con Mercado Pago. Otros paises pagan con PayPal en USD.";
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
    }

    if (checkoutType === "fisico") {
      if (shippingTitle) shippingTitle.textContent = "Envio en Tucuman";
      if (shippingNote) shippingNote.textContent = "Los libros fisicos solo se envian dentro de Tucuman, Argentina.";
    }
  }

  function updatePaymentMethod() {
    const provider = paymentProvider();
    const mpOption = document.getElementById("pm-mp");
    const paypalOption = document.getElementById("pm-paypal");
    const mpInfo = document.getElementById("mp-info");
    const paypalInfo = document.getElementById("paypal-info");
    const button = document.getElementById("place-order-btn");

    if (mpOption) mpOption.style.display = provider === "mercadopago" ? "" : "none";
    if (paypalOption) paypalOption.style.display = provider === "paypal" ? "" : "none";
    document.querySelectorAll(".payment-method-option").forEach(option => option.classList.remove("active"));

    const activeOption = provider === "paypal" ? paypalOption : mpOption;
    if (activeOption) {
      activeOption.classList.add("active");
      const input = activeOption.querySelector("input");
      if (input) input.checked = true;
    }

    if (mpInfo) mpInfo.style.display = provider === "mercadopago" ? "block" : "none";
    if (paypalInfo) paypalInfo.style.display = provider === "paypal" ? "block" : "none";
    if (button) button.textContent = provider === "paypal" ? "Pagar con PayPal" : "Pagar con Mercado Pago";
  }

  function renderSummary() {
    const provider = paymentProvider();
    const subtotal = Cart.getSubtotal();
    const shipping = checkoutType === "digital" ? 0 : (subtotal >= 25 ? 0 : 4.99);
    const total = subtotal + shipping;
    const showUsd = provider === "paypal" && exchangeRate;

    const itemsEl = document.getElementById("checkout-items");
    if (itemsEl) {
      itemsEl.innerHTML = cartItems.map(item => `
        <div class="checkout-item">
          <img class="ci-img" src="${item.cover}" alt="${item.title}" loading="lazy" />
          <div class="ci-info">
            <div class="ci-title">${item.title}</div>
            <div class="ci-qty">x ${item.qty} - ${normalizeFormat(item.format) === "digital" ? "Digital" : "Fisico"}</div>
          </div>
          <div class="ci-price">${showUsd ? formatUsd((item.price * item.qty) / exchangeRate) : formatArs(item.price * item.qty)}</div>
        </div>
      `).join("") || "<p style='color:var(--color-text-3);font-size:.85rem'>Sin productos</p>";
    }

    const subtotalEl = document.getElementById("co-subtotal");
    const shippingEl = document.getElementById("co-shipping");
    const totalEl = document.getElementById("co-total");
    if (subtotalEl) subtotalEl.textContent = showUsd ? formatUsd(subtotal / exchangeRate) : formatArs(subtotal);
    if (shippingEl) {
      shippingEl.textContent = shipping === 0 ? "GRATIS" : formatArs(shipping);
      shippingEl.style.color = shipping === 0 ? "var(--color-success)" : "";
    }
    if (totalEl) totalEl.textContent = showUsd ? formatUsd(total / exchangeRate) : formatArs(total);
  }

  async function refreshInternationalPricing() {
    if (paymentProvider() === "paypal") await loadExchangeRate();
    updatePaymentMethod();
    renderSummary();
  }

  function goToStep(nextStep) {
    document.getElementById(`step-${currentStep}`)?.style.setProperty("display", "none");
    currentStep = nextStep;
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
    fields.forEach(field => {
      const input = document.getElementById(field.id);
      const err = document.getElementById(field.errId);
      if (!input) return;
      if (!input.value.trim()) {
        input.classList.add("error");
        if (err) err.textContent = `${field.label} es requerido`;
        valid = false;
      } else if (field.id === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value)) {
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
      const country = selectedCountry();
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
        const token = new URLSearchParams(window.location.search).get("token") || "";
        downloadsEl.innerHTML = (orderData.downloads || []).map(item => `
          <a class="btn btn-primary btn-full" href="/api/orders/access/${orderData.id}/download/${item.id}?token=${encodeURIComponent(token)}">
            Descargar ${item.title}
          </a>
        `).join("") || "<p>No hay archivos disponibles todavia.</p>";
      }
      return;
    }

    if (statusEl) statusEl.textContent = "Pago aprobado. Coordinaremos el envio dentro de Tucuman con los datos del pedido.";
    if (physicalEl) physicalEl.style.display = "block";
  }

  document.getElementById("step-1-form")?.addEventListener("submit", event => {
    event.preventDefault();
    if (cartItems.length === 0) {
      Cart.showToast("Agrega al menos un producto al carrito");
      return;
    }
    if (checkoutType === "mixed") {
      setCheckoutError("Separa los productos digitales de los fisicos antes de pagar.");
      return;
    }
    if (!validateStep1()) return;

    setCheckoutError("");
    refreshInternationalPricing()
      .then(() => {
        goToStep(2);
        if (typeof Analytics !== "undefined") Analytics.beginCheckout(cartItems, Cart.getSubtotal());
      })
      .catch(error => setCheckoutError(error.message));
  });

  document.getElementById("back-to-step1")?.addEventListener("click", () => goToStep(1));

  document.querySelectorAll(".payment-method-option").forEach(option => {
    option.addEventListener("click", () => updatePaymentMethod());
  });

  document.getElementById("place-order-btn")?.addEventListener("click", async () => {
    const terms = document.getElementById("accept-terms");
    if (!terms?.checked) {
      Cart.showToast("Acepta los terminos para continuar");
      return;
    }

    const provider = paymentProvider();
    const btn = document.getElementById("place-order-btn");
    btn.textContent = "Creando pago...";
    btn.disabled = true;

    try {
      const response = await fetch(provider === "paypal" ? "/api/checkout/paypal" : "/api/checkout/mercadopago", {
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
            country: selectedCountry()
          },
          billing: {
            country: selectedCountry()
          }
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo crear el pago");

      if (typeof Analytics !== "undefined") Analytics.purchase(data.orderId, cartItems, Cart.getSubtotal());
      window.location.href = data.approveUrl || data.initPoint || data.sandboxInitPoint;
    } catch (error) {
      Cart.showToast(error.message);
      updatePaymentMethod();
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

  document.getElementById("country")?.addEventListener("change", () => {
    setCheckoutError("");
    refreshInternationalPricing().catch(error => setCheckoutError(error.message));
  });

  if (checkoutType === "mixed") {
    setCheckoutError("No se pueden pagar juntos productos digitales y fisicos. Separa las compras.");
  }

  if (checkoutType === "empty") {
    setCheckoutError("Tu carrito esta vacio.");
  }

  formatSectionForType();
  refreshInternationalPricing().catch(error => setCheckoutError(error.message));
});
