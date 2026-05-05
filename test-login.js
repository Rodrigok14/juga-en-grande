require("dotenv").config();

async function test() {
  const base = process.env.TEST_BASE_URL || "http://localhost:3000";
  const username = process.env.ADMIN_USER;
  const password = process.env.ADMIN_PASSWORD;
  if (!username || !password) {
    console.error("Set ADMIN_USER and ADMIN_PASSWORD in .env (see .env.example).");
    process.exit(1);
  }
  console.log("Testing login at", `${base}/api/auth/login`);
  const res = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  });
  console.log("Status:", res.status);
  const data = await res.json();
  console.log("Response:", data);
}

test();
