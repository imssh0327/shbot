const { createClient } = require("redis");

const REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";

const client = createClient({ url: REDIS_URL });

let isReady = false;

client.on("error", (err) => {
  console.error("Redis error:", err);
});

client.on("ready", () => {
  isReady = true;
  console.log("Redis ready");
});

async function ensureRedis() {
  if (isReady) return;
  if (!client.isOpen) {
    await client.connect();
  }
}

module.exports = {
  redis: client,
  ensureRedis,
};
