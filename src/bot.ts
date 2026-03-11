import * as dotenv from "dotenv";
dotenv.config();

import { Telegraf } from "telegraf";
import Redis from "ioredis";
import { Pool } from "pg";

console.log("ENV GROUP ID:", process.env.VENDOR_GROUP_ID);
console.log("TYPE:", typeof process.env.VENDOR_GROUP_ID);

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection:", reason);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err);
});

// Validate required envs early (fail fast)
if (!process.env.BOT_TOKEN) throw new Error("BOT_TOKEN missing");
if (!process.env.REDIS_URL) throw new Error("REDIS_URL missing");
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL missing");
if (!process.env.VENDOR_GROUP_ID) throw new Error("VENDOR_GROUP_ID missing");

// Create bot FIRST
const bot = new Telegraf(process.env.BOT_TOKEN);

// Connections
const redis = new Redis(process.env.REDIS_URL);
const pg = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const VENDOR_GROUP_ID = process.env.VENDOR_GROUP_ID;

console.log("DB URL:", process.env.DATABASE_URL);
console.log("Type:", typeof process.env.DATABASE_URL);

// /start command
bot.start(async (ctx) => {
  console.log("Received /start from", ctx.chat.id);

  await ctx.reply(

    
    "Welcome to Gig Maid Service 🙏,Please send your request in this format:\n\n" +
      "1. Duration: 15 mins / 30 mins / 1 hour\n" +
      "2. Work Required: Cleaning / Dishes / Cooking / Other \n"+
      "3.💰 Expected pay for this task? (₹)(or type 'ask vendor')\n"+
      "4.🕒 When is this needed? (now / today / specific time)\n"+
      "5. Location (Block & Flat No):\n" +
      "6. Phone: (optional)\n" +
      "• Sample request: 15min, Cl, rs 50, 10:00 am today, Z:20 "

  );

  await redis.set(`state:${ctx.chat.id}`, "WAITING_FOR_CUSTOMER");
});

// Customer messages
bot.on("text", async (ctx, next) => {

  if (ctx.chat.type !== "private") {
    return next();   // 🔥 IMPORTANT
  }

  console.log("TEXT FROM:", ctx.chat.id);

  if (ctx.message.entities?.some(e => e.type === "bot_command"))
    return next();

  const state = await redis.get(`state:${ctx.chat.id}`);
  console.log("STATE:", state);

  if (state !== "WAITING_FOR_CUSTOMER")
    return next();
  const customerMsg = ctx.message.text ?? "";

  if (!customerMsg.trim()) {
    await ctx.reply("Please send a text message with your requirement 🙏");
    return;
  }

// 1️⃣ Insert user if not exists
await pg.query(
  `
  INSERT INTO users (platform, platform_user_id)
  VALUES ('telegram', $1)
  ON CONFLICT (platform, platform_user_id) DO NOTHING
  `,
  [String(ctx.chat.id)]
);

// 2️⃣ Fetch internal user id
const userRes = await pg.query(
  `
  SELECT id FROM users
  WHERE platform = 'telegram' AND platform_user_id = $1
  `,
  [String(ctx.chat.id)]
);

const internalUserId = userRes.rows[0].id;

// 3️⃣ Insert message using internal id
await pg.query(
  `
  INSERT INTO messages (user_id, message_text, direction)
  VALUES ($1, $2, 'in')
  `,
  [internalUserId, customerMsg]
);

  const sent = await ctx.telegram.sendMessage(
    VENDOR_GROUP_ID,
    `📩 New Customer Request\n\nCustomer ID: ${ctx.chat.id}\n\n${customerMsg}`
  );

  await redis.set(`map:${sent.message_id}`, String(ctx.chat.id));

  await ctx.reply("Thanks! Your request has been sent to our vendor team 🙏");
});

// Vendor replies
bot.on("message", async (ctx) => {

  
  console.log("GROUP HANDLER HIT:", ctx.chat.id);
  
  
  if (String(ctx.chat.id) !== String(VENDOR_GROUP_ID)) return;
  console.log("INSIDE VENDOR GROUP");
  const message: any = ctx.message; // <-- important cast
  console.log("REPLY_TO:", message.reply_to_message);

  if (!message.reply_to_message) return;

  const originalVendorMsgId = message.reply_to_message.message_id;

  const customerChatId = await redis.get(`map:${originalVendorMsgId}`);
  if (!customerChatId) return;

  const vendorReply = message.text || "Vendor sent a response.";

  await ctx.telegram.sendMessage(
    customerChatId,
    `📨 Vendor replied:\n\n${vendorReply}`
  );
});

// Launch bot
bot.launch({ dropPendingUpdates: true }).then(() => {
  console.log("MCGA bot running...");
});

// Graceful shutdown
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));