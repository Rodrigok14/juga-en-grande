# Jugá en Grande

Web + backend para tienda de libros con:

- **PostgreSQL** para productos, precios, combos y pedidos (`DATABASE_URL`).
- Panel admin en `/admin.html` (login con `ADMIN_USER` / `ADMIN_PASSWORD` definidos en el entorno).
- Mercado Pago Checkout Pro desde backend.
- Deploy en Vercel (`vercel.json` + función serverless que reutiliza la misma app Express).

## Desarrollo local

1. Crear `.env` copiando [`.env.example`](.env.example).
2. Completar al menos:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/tu_base
MP_ACCESS_TOKEN=TEST-...
ADMIN_USER=admin
ADMIN_PASSWORD=tu-clave-segura
SESSION_SECRET=un-secreto-largo-y-aleatorio
BASE_URL=http://localhost:3000
```

En **local**, si Postgres no usa TLS, podés añadir `DATABASE_SSL=false`.

En **producción** (incluido Vercel), `SESSION_SECRET` es **obligatorio**; el proceso no arranca sin él.

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

### Probar login por CLI

Con el servidor en marcha y `.env` cargado:

```bash
node test-login.js
```

Opcional: `TEST_BASE_URL=https://tu-dominio.com` para apuntar a un deploy.

## Base de datos

El proyecto usa el driver `pg` y espera esquemas de tablas ya creados en PostgreSQL (productos, combos, pedidos, etc.). Si la base está vacía, el arranque intenta un **seed** inicial de productos de ejemplo.

### SSL hacia PostgreSQL

- Por defecto, para URLs que no son `localhost` / `127.0.0.1`, el cliente usa TLS con verificación de certificado (`rejectUnauthorized: true`).
- Si tu proveedor lo requiere: `PG_SSL_REJECT_UNAUTHORIZED=false`.
- Postgres local sin SSL: `DATABASE_SSL=false` en `.env`.

## Mercado Pago

El checkout usa Checkout Pro. El navegador no ve el `MP_ACCESS_TOKEN`; el backend crea la preferencia en `/api/checkout/mercadopago`.

Cuando el pago cambia de estado, Mercado Pago llama al webhook:

```text
/api/webhooks/mercadopago
```

Para probar webhooks localmente hace falta exponer la app con una URL pública temporal y poner esa URL como `BASE_URL`.

## Vercel

- Configurá en el proyecto de Vercel: `DATABASE_URL`, `MP_ACCESS_TOKEN`, `ADMIN_USER`, `ADMIN_PASSWORD`, `SESSION_SECRET`, `BASE_URL`, etc.
- Para subir portadas/archivos en producción, configurá `BLOB_READ_WRITE_TOKEN` (token Read/Write de **Vercel Blob**, formato `vercel_blob_rw_...`). Sin eso, Vercel devuelve errores tipo `400 (Bad Request)` al intentar guardar.
- Imágenes y datos persisten en tu PostgreSQL gestionado (Neon, Supabase, etc.), no en disco del contenedor.
