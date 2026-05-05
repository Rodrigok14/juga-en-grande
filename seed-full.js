const { pool, moneyToCents } = require("./lib/db");
const fs = require("fs");

async function seedFull() {
  console.log("Seeding full catalog into database...");
  try {
    // Drop existing products and combos to start fresh
    await pool.query("DELETE FROM combo_items");
    await pool.query("DELETE FROM combos");
    await pool.query("DELETE FROM orders");
    await pool.query("DELETE FROM products");
    // Reset sequence
    await pool.query("ALTER SEQUENCE products_id_seq RESTART WITH 1");

    // Read js/data.js to extract the BOOKS array
    const dataJs = fs.readFileSync("./js/data.js", "utf-8");
    const booksMatch = dataJs.match(/const BOOKS = (\[[\s\S]*?\]);/);
    if (!booksMatch) throw new Error("Could not find BOOKS in js/data.js");
    
    // Evaluate the array to a JS object
    const books = eval(booksMatch[1]);
    
    console.log(`Found ${books.length} books. Inserting...`);
    
    for (const b of books) {
      await pool.query(`
        INSERT INTO products (slug, title, author, category, price, old_price, format, stock, image, description, active)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 1)
      `, [
        b.slug,
        b.title,
        b.author || "",
        b.category,
        moneyToCents(b.price),
        b.oldPrice ? moneyToCents(b.oldPrice) : null,
        b.format === "físico" ? "fisico" : "digital",
        b.stock || 10,
        b.cover || "/assets/images/book_placeholder.svg",
        b.synopsis || "",
      ]);
    }
    
    console.log("Done! Database now has all 16 books.");
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

seedFull();
