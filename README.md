# Jugá en Grande

Web + backend para tienda de libros con:

- SQLite para productos, precios, combos y pedidos.
- Panel admin en `/admin.html`.
- Mercado Pago Checkout Pro desde backend.
- Preparación inicial para deploy en Vercel.

## Desarrollo local

1. Crear `.env` copiando `.env.example`.
2. Completar:

```env
MP_ACCESS_TOKEN=TEST-...
ADMIN_USER=admin
ADMIN_PASSWORD=tu-clave
SESSION_SECRET=un-secreto-largo
BASE_URL=http://localhost:3000
```

3. Instalar dependencias:

```bash
npm install
```

4. Levantar el servidor:

```bash
npm run dev
```

5. Abrir:

- Tienda: `http://localhost:3000`
- Admin: `http://localhost:3000/admin.html`

## Mercado Pago

El checkout usa Checkout Pro. El navegador no ve el `MP_ACCESS_TOKEN`; el backend crea la preferencia en `/api/checkout/mercadopago`.

Cuando el pago cambia de estado, Mercado Pago llama al webhook:

```text
/api/webhooks/mercadopago
```

Para probar webhooks localmente hace falta exponer la app con una URL pública temporal y poner esa URL como `BASE_URL`.

## Vercel + SQLite

El proyecto incluye `vercel.json`, pero SQLite en Vercel sirve solo para pruebas porque las funciones serverless no tienen almacenamiento persistente. Los cambios del admin y las imágenes subidas pueden perderse.

Para producción conviene migrar a:

- Supabase o Neon para base de datos.
- Supabase Storage, Cloudinary o S3 para imágenes.

La estructura de endpoints ya queda preparada para esa migración.
