document.addEventListener("DOMContentLoaded", () => {
  let currentStep = 1;

  function renderSummary() {
    const items = Cart.getItems();
    const el = document.getElementById("checkout-items");
    if (el) {
      el.innerHTML = items.map(i => `
        <div class="checkout-item">
          <img class="ci-img" src="${i.cover}" alt="${i.title}" loading="lazy" />
          <div class="ci-info">
            <div class="ci-title">${i.title}</div>
            <div class="ci-qty">x ${i.qty}</div>
          </div>
          <div class="ci-price">${formatPrice(i.price * i.qty)}</div>
        </div>
      `).join("") || "<p style='color:var(--color-text-3);font-size:.85rem'>Sin productos</p>";
    }

    const sub = Cart.getSubtotal();
    const shipping = sub >= 25 ? 0 : 4.99;
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
    document.getElementById(`step-${currentStep}`).style.display = "none";
    currentStep = n;
    document.getElementById(`step-${currentStep}`).style.display = "block";
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
      { id: "email", errId: "email-err", label: "Email" },
      { id: "address", errId: "address-err", label: "Dirección" }
    ];
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
        if (err) err.textContent = "Email inválido";
        valid = false;
      } else {
        input.classList.remove("error");
        if (err) err.textContent = "";
      }
    });
    return valid;
  }

  document.getElementById("step-1-form")?.addEventListener("submit", e => {
    e.preventDefault();
    if (Cart.getItems().length === 0) {
      Cart.showToast("Agregá al menos un producto al carrito");
      return;
    }
    if (validateStep1()) {
      goToStep(2);
      if (typeof Analytics !== "undefined") Analytics.beginCheckout(Cart.getItems(), Cart.getSubtotal());
    }
  });

  document.getElementById("back-to-step1")?.addEventListener("click", () => goToStep(1));

  document.querySelectorAll(".payment-method-option").forEach(opt => {
    opt.addEventListener("click", () => {
      document.querySelectorAll(".payment-method-option").forEach(o => o.classList.remove("active"));
      opt.classList.add("active");
      opt.querySelector("input").checked = true;
      const val = opt.querySelector("input").value;
      document.getElementById("card-form").style.display = "none";
      document.getElementById("paypal-info").style.display = "none";
      document.getElementById("mp-info").style.display = val === "mercadopago" || val === "card" ? "block" : "none";
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
      Cart.showToast("Aceptá los términos para continuar");
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
          items: Cart.getItems().map(item => ({
            id: item.id,
            slug: item.slug,
            qty: item.qty
          })),
          buyer: {
            name: `${document.getElementById("first-name")?.value || ""} ${document.getElementById("last-name")?.value || ""}`.trim(),
            email: document.getElementById("email")?.value || "",
            phone: document.getElementById("phone")?.value || ""
          }
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo crear el pago");

      if (typeof Analytics !== "undefined") Analytics.purchase(data.orderId, Cart.getItems(), Cart.getSubtotal());
      window.location.href = data.initPoint || data.sandboxInitPoint;
    } catch (error) {
      Cart.showToast(error.message);
      btn.textContent = "Pagar con Mercado Pago";
      btn.disabled = false;
    }
  });

  const params = new URLSearchParams(window.location.search);
  if (params.get("payment") === "success") {
    Cart.clear();
    document.getElementById("step-1").style.display = "none";
    document.getElementById("step-2").style.display = "none";
    document.getElementById("checkout-success").style.display = "block";
    document.getElementById("checkout-summary").style.display = "none";
  }

  document.querySelectorAll("input[required]").forEach(input => {
    input.addEventListener("blur", () => {
      if (!input.value.trim()) input.classList.add("error");
      else input.classList.remove("error");
    });
  });

  renderSummary();
});
