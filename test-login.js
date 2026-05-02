const fetch = require("node-fetch");

async function test() {
  console.log("Testing login...");
  const res = await fetch("https://juga-en-grande.vercel.app/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "rodrigok14", password: "rodrigo" })
  });
  console.log("Status:", res.status);
  const data = await res.json();
  console.log("Response:", data);
}

test();
