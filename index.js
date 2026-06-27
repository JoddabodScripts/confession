"use strict";

// ─── CONFIG ───────────────────────────────────────────────────────────────────

require("dotenv").config();

const DB_PATH  = "./db.json";
const LOG_PATH = "./admin-log.json";

// ─── IMPORTS ──────────────────────────────────────────────────────────────────

const { Client, Events, RolePermissions } = require("@nerimity/nerimity.js");
const { confessionEmbed }                  = require("./embed.js");
const fs   = require("fs");
const path = require("path");
const cr   = require("crypto");

// ─── PERSISTENCE ──────────────────────────────────────────────────────────────

function loadDb() {
  if (!fs.existsSync(DB_PATH)) return {};
  try { return JSON.parse(fs.readFileSync(DB_PATH, "utf8")); }
  catch { return {}; }
}

function saveDb(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), "utf8");
}

function findByServerId(db, serverId) {
  return Object.entries(db).find(([, r]) => r.serverId === serverId);
}

/**
 * Create or update a server record.  Existing keys survive so users
 * don't have to re-learn their server key on re-setup.
 */
function upsertServer(db, serverId, channelId) {
  const existing  = findByServerId(db, serverId);
  const serverKey = existing ? existing[0] : generateServerKey();
  const count     = existing ? existing[1].confessionCount : 0;

  db[serverKey] = { serverId, confessionChannelId: channelId, confessionCount: count };
  saveDb(db);
  return serverKey;
}

function incrementCount(db, key) {
  db[key].confessionCount += 1;
  saveDb(db);
  return db[key].confessionCount;
}

// ─── SERVER KEY ───────────────────────────────────────────────────────────────

const WORDS = [
  "apple", "brave", "cedar", "delta", "ember", "frost", "grove", "haven",
  "ivory", "jade",  "kite",  "lemon", "maple", "noble", "ocean", "pearl",
  "quill", "river", "stone", "tiger", "ultra", "vivid", "willow", "xenon",
  "yield", "zephyr",
];

/** Human-readable key like "cedar-38". */
function generateServerKey() {
  const w = WORDS[Math.floor(Math.random() * WORDS.length)];
  const n = Math.floor(Math.random() * 90) + 10;
  return `${w}-${n}`;
}

// ─── AUDIT LOG ────────────────────────────────────────────────────────────────

function loadLog() {
  if (!fs.existsSync(LOG_PATH)) return [];
  try { return JSON.parse(fs.readFileSync(LOG_PATH, "utf8")); }
  catch { return []; }
}

/**
 * Append a hashed audit entry.
 *
 * Only SHA-256 hashes are stored (user ID + content), so the bot host
 * can verify claims without ever keeping raw user data on disk.
 */
function writeAuditLog(userId, serverKey, confessionNum, content) {
  const log = loadLog();

  const userIdHash  = cr.createHash("sha256").update(String(userId)).digest("hex");
  const contentHash = cr.createHash("sha256").update(content).digest("hex");

  log.push({
    timestamp:     new Date().toISOString(),
    serverKey,
    confessionNum,
    userIdHash,
    contentHash,
  });

  fs.writeFileSync(LOG_PATH, JSON.stringify(log, null, 2), "utf8");
}

// ─── MENTION STRIPPER ─────────────────────────────────────────────────────────

const MENTION_RE = /\[@:[^\]]*\]/g;

/**
 * Strip all Nerimity raw mention tokens – [@:userId], [@:e], [@:s] etc.
 * Returns null when nothing changed so callers can skip churn.
 */
function stripMentions(content) {
  if (!content) return null;
  const cleaned = content.replace(MENTION_RE, "").trim().replace(/\s{2,}/g, " ");
  return cleaned !== content ? cleaned : null;
}

// ─── COMMAND: SETUP ───────────────────────────────────────────────────────────

async function handleSetup(message) {
  const server = message.channel.server;
  if (!server) return;

  const member = message.member;
  if (!member) {
    await message.reply("Could not verify your permissions – are you a member of this server?");
    return;
  }

  if (!member.hasPermission(RolePermissions.ADMIN)) {
    await message.reply("Only server admins can set up the confession channel.");
    return;
  }

  const db        = loadDb();
  const serverKey = upsertServer(db, server.id, message.channelId);

  await message.reply(
    "✅ **Confession channel set to this channel.**\n\n" +
    `Your server key: \`${serverKey}\`\n\n` +
    "Share it with members — they DM me:\n" +
    `\`!confess ${serverKey} <their message>\``
  );
}

// ─── COMMAND: CONFESS ─────────────────────────────────────────────────────────

const CONFESS_RE = /^!confess\s+(\S+)\s+([\s\S]+)$/i;

async function handleConfess(client, message) {
  const content = message.content?.trim() ?? "";
  const match   = content.match(CONFESS_RE);

  if (!match) {
    await message.channel.send(
      "Usage:\n`!confess <serverKey> <your confession>`"
    );
    return;
  }

  const key       = match[1].toLowerCase();
  const text      = match[2].trim();
  const cleanText = stripMentions(text) ?? text;

  if (!cleanText) {
    await message.channel.send("Your confession can't be empty.");
    return;
  }

  const db     = loadDb();
  const record = db[key];
  if (!record) {
    await message.channel.send(
      `❌ Unknown server key \`${key}\`. Double-check and try again.`
    );
    return;
  }

  const count     = incrementCount(db, key);
  const target    = client.channels.cache.get(record.confessionChannelId);

  if (!target) {
    await message.channel.send(
      "⚠️ Couldn't find the confession channel. Ask the admin to re-run `!confess-setup`."
    );
    return;
  }

  try {
    await target.send("- Anonymous confession -", { htmlEmbed: confessionEmbed(count, cleanText) });
  } catch (err) {
    console.error("[confess] Failed to post:", err);
    await message.channel.send(
      "⚠️ Failed to post. The bot may lack send permission in that channel."
    );
    return;
  }

  writeAuditLog(message.user.id, key, count, cleanText);
  await message.channel.send("✅ Posted.");
}

// ─── MESSAGE ROUTER ──────────────────────────────────────────────────────────

async function onMessageCreate(client, message) {
  if (message.user.id === client.user?.id) return;

  const content = message.content?.trim() ?? "";
  const isDM    = !message.channel.server;

  if (isDM && content.toLowerCase().startsWith("!confess")) {
    await handleConfess(client, message);
  } else if (!isDM && content.toLowerCase() === "!confess-setup") {
    await handleSetup(message);
  }
}

// ─── RICH PRESENCE ────────────────────────────────────────────────────────────

function updatePresence(client) {
  try {
    const count = client.servers?.cache?.size ?? 0;
    const label = `${count} server${count !== 1 ? "s" : ""}`;
    const acts  = [
      { action: "Playing", name: "Confession Bot",     startedAt: Date.now(), title: label,      subtitle: "Type !confess-setup" },
      { action: "Watching", name: "Anonymous Confessions", startedAt: Date.now(), title: "🤫", subtitle: "Your secret is safe" },
    ];
    client.user?.setActivity(acts[activityIndex % acts.length]);
    activityIndex += 1;
  } catch (e) {
    console.error("[bot] Presence error:", e.message);
  }
}
let activityIndex = 0;

// ─── BOOT ─────────────────────────────────────────────────────────────────────

const client = new Client();

client.on(Events.Ready, () => {
  console.log(`[bot] Logged in as ${client.user?.username}`);
  console.log(`[bot] DB : ${path.resolve(DB_PATH)}`);
  console.log(`[bot] Log: ${path.resolve(LOG_PATH)}`);
  updatePresence(client);
  setInterval(() => updatePresence(client), 15000);
});

client.on(Events.MessageCreate, (msg) => {
  onMessageCreate(client, msg).catch((err) => {
    console.error("[bot] Handler error:", err);
  });
});

client.login(process.env.BOT_TOKEN);
