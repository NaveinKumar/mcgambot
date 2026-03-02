import * as dotenv from "dotenv";
dotenv.config();

import { Telegraf } from "telegraf";
import Redis from "ioredis";
import { Pool } from "pg";

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection:", reason);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err);
});


// 1️⃣ Create bot FIRST
const bot = new Telegraf(process.env.BOT_TOKEN!);

// 2️⃣ Connections
const redis = new Redis(process.env.REDIS_URL);

console.log("DB URL:", process.env.DATABASE_URL);
console.log("Type:", typeof process.env.DATABASE_URL);

const pg = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// 3️⃣ Commands
bot.start(async (ctx) => {
  console.log("Received /start from", ctx.chat.id);

  await ctx.reply("how are u");
  await redis.set(`state:${ctx.chat.id}`, "WAITING_FOR_CUSTOMER");
});



bot.on("text", async (ctx) => {
  // 🚫 Ignore ALL Telegram commands properly
  if (ctx.message.entities?.some(e => e.type === "bot_command")) {
    return;
  }

  const state = await redis.get(`state:${ctx.chat.id}`);
  if (state !== "WAITING_FOR_CUSTOMER") return;

  const customerMsg = ctx.message.text;

  await pg.query(
    "INSERT INTO messages(user_id, message_text, direction) VALUES ($1, $2, 'in')",
    [ctx.chat.id, customerMsg]
  );

  await ctx.reply("Thanks! Vendor has been notified.");
});

// 4️⃣ Launch LAST (this keeps process alive)
bot.launch({ dropPendingUpdates: true }).then(() => {
  console.log("MCGA bot running...");
});


// 5️⃣ Graceful shutdown
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
