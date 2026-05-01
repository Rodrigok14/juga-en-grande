/* ================================================
   ANALYTICS — GA4 + custom event tracking
   ================================================ */

const Analytics = (() => {
  // Replace 'G-XXXXXXXXXX' with your real GA4 Measurement ID
  const GA_ID = "G-XXXXXXXXXX";

  function loadGA() {
    if (window.gtag) return;
    const script = document.createElement("script");
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
    script.async = true;
    document.head.appendChild(script);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function() { window.dataLayer.push(arguments); };
    gtag("js", new Date());
    gtag("config", GA_ID, { page_path: window.location.pathname });
  }

  function track(eventName, params = {}) {
    try {
      if (window.gtag) {
        gtag("event", eventName, params);
      }
      // Console log for development
      console.info(`[Analytics] ${eventName}`, params);
    } catch (err) {
      console.warn("[Analytics] Error tracking event:", err);
    }
  }

  function viewProduct(book) {
    track("view_item", {
      currency: "USD",
      value: book.price,
      items: [{
        item_id:       book.id,
        item_name:     book.title,
        item_category: book.category,
        price:         book.price
      }]
    });
  }

  function addToCart(book, qty = 1) {
    track("add_to_cart", {
      currency: "USD",
      value:    book.price * qty,
      items: [{
        item_id:       book.id,
        item_name:     book.title,
        item_category: book.category,
        price:         book.price,
        quantity:      qty
      }]
    });
  }

  function beginCheckout(items, value) {
    track("begin_checkout", {
      currency: "USD",
      value,
      items: items.map(i => ({
        item_id:   i.id,
        item_name: i.title,
        price:     i.price,
        quantity:  i.qty
      }))
    });
  }

  function purchase(orderId, items, total) {
    track("purchase", {
      transaction_id: orderId,
      currency:       "USD",
      value:          total,
      items:          items.map(i => ({
        item_id:   i.id,
        item_name: i.title,
        price:     i.price,
        quantity:  i.qty
      }))
    });
  }

  function search(query) {
    track("search", { search_term: query });
  }

  // Load GA on init
  loadGA();

  // Track page views on load
  track("page_view", { page_title: document.title, page_location: window.location.href });

  return { track, viewProduct, addToCart, beginCheckout, purchase, search };
})();
