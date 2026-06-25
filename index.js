"use strict";

// ─── ENVIRONMENT & CONFIGURATION ─────────────────────────────────────────────

require('dotenv').config();

const DB_PATH     = "./db.json";                  // confession database
const LOG_PATH    = "./admin-log.json";           // hashed audit log

// ─── IMPORTS ─────────────────────────────────────────────────────────────────

const { Client, Events, RolePermissions } = require("@nerimity/nerimity.js");
const fs     = require("fs");
const path   = require("path");
const crypto = require("crypto");

// ─── DATABASE HELPERS ────────────────────────────────────────────────────────

/**
 * Load the JSON database from disk.
 * Returns an object keyed by serverKey → server record.
 */
function loadDb() {
  if (!fs.existsSync(DB_PATH)) return {};
  try {
    return JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
  } catch {
    return {};
  }
}

/**
 * Persist the database object to disk (synchronous write so we
 * never lose a confession count on an unexpected exit).
 */
function saveDb(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), "utf8");
}

/**
 * Find a server record by its serverKey.
 * Returns the record or undefined.
 */
function findByKey(db, serverKey) {
  return db[serverKey];
}

/**
 * Find a server record by its Nerimity serverId.
 * Returns [serverKey, record] or undefined.
 */
function findByServerId(db, serverId) {
  return Object.entries(db).find(([, record]) => record.serverId === serverId);
}

/**
 * Create or overwrite a server record.
 * If the server already has a key, that key is reused so existing
 * users don't need to learn a new one.
 * Returns the serverKey.
 */
function upsertServer(db, serverId, confessionChannelId) {
  const existing  = findByServerId(db, serverId);
  const serverKey = existing ? existing[0] : generateServerKey();

  db[serverKey] = {
    serverId,
    confessionChannelId,
    confessionCount: existing ? existing[1].confessionCount : 0,
  };

  saveDb(db);
  return serverKey;
}

/**
 * Increment the confession counter for a given serverKey and
 * return the new count.
 */
function incrementCount(db, serverKey) {
  db[serverKey].confessionCount += 1;
  saveDb(db);
  return db[serverKey].confessionCount;
}

// ─── KEY GENERATION ──────────────────────────────────────────────────────────

// Word list used to build human-readable server keys like "apple-77"
const WORDS = [
  "apple", "brave", "cedar", "delta", "ember", "frost", "grove", "haven",
  "ivory", "jade",  "kite",  "lemon", "maple", "noble", "ocean", "pearl",
  "quill", "river", "stone", "tiger", "ultra", "vivid", "willow", "xenon",
  "yield", "zephyr",
];

/**
 * Generate a short, human-readable key in the format "word-NN".
 * e.g. "maple-42"
 */
function generateServerKey() {
  const word   = WORDS[Math.floor(Math.random() * WORDS.length)];
  const number = Math.floor(Math.random() * 90) + 10; // 10–99
  return `${word}-${number}`;
}

// ─── ADMIN AUDIT LOGGING ─────────────────────────────────────────────────────

/**
 * Load the audit log array from disk.
 */
function loadLog() {
  if (!fs.existsSync(LOG_PATH)) return [];
  try {
    return JSON.parse(fs.readFileSync(LOG_PATH, "utf8"));
  } catch {
    return [];
  }
}

/**
 * Write a hashed audit entry to admin-log.json.
 *
 * Each entry contains:
 *   timestamp     – ISO date string
 *   serverKey     – which server the confession went to
 *   confessionNum – the sequential number (#N)
 *   userIdHash    – SHA-256(userId)
 *   contentHash   – SHA-256(confessionText)
 *
 * The bot host can verify "did user X post confession #N?" by
 * re-computing SHA-256(suspectedUserId) and comparing it to
 * the stored hash — without ever storing the raw user ID in the log.
 */
function writeAuditLog(userId, serverKey, confessionNum, content) {
  const log = loadLog();

  // Hash the user ID using SHA-256
  const userIdHash = crypto
    .createHash("sha256")
    .update(String(userId))
    .digest("hex");

  // Plain SHA-256 of the confession text for content matching
  const contentHash = crypto
    .createHash("sha256")
    .update(content)
    .digest("hex");

  log.push({
    timestamp:     new Date().toISOString(),
    serverKey,
    confessionNum,
    userIdHash,
    contentHash,
  });

  fs.writeFileSync(LOG_PATH, JSON.stringify(log, null, 2), "utf8");
}

// ─── MENTION RESOLVER ─────────────────────────────────────────────────────────

// Patterns for Nerimity mention formats: [@:userId], [@:e], [@:s], and any [@:...]
const MENTION_PATTERN = /\[@:[^\]]*\]/g;

/**
 * Strip all Nerimity raw mention patterns from a string.
 *
 *   [@:userId]  →  (removed)
 *   [@:e]       →  (removed)
 *   [@:s]       →  (removed)
 *   [@:anything]→  (removed)
 *
 * Returns the cleaned string or null if nothing changed.
 */
function resolveMentions(content) {
  if (!content) return null;

  const resolved = content.replace(MENTION_PATTERN, "").trim();

  // Clean up double spaces that might result from removal
  const cleaned = resolved.replace(/\s{2,}/g, " ");

  return cleaned !== content ? cleaned : null;
}

// ─── COMMAND HANDLERS ────────────────────────────────────────────────────────

/**
 * Handle !confess-setup in a guild channel.
 *
 * Only server admins (ADMIN permission bit) or the server creator
 * may run this command.
 */
async function handleConfessSetup(message) {
  const server = message.channel.server;
  if (!server) return; // guard: should always be set for guild messages

  // Resolve the sender's ServerMember to check permissions
  const member = message.member;
  if (!member) {
    await message.reply(
      "Could not verify your permissions. Are you a member of this server?"
    );
    return;
  }

  // hasPermission checks ADMIN bit and also returns true for the server creator
  if (!member.hasPermission(RolePermissions.ADMIN)) {
    await message.reply(
      "Only server administrators can set up the confession channel."
    );
    return;
  }

  const db        = loadDb();
  const serverKey = upsertServer(db, server.id, message.channelId);

  await message.reply(
    `✅ **Confession channel set to this channel.**\n\n` +
    `Your server key is: \`${serverKey}\`\n\n` +
    `Share this key with your members. They can submit confessions by DMing me:\n` +
    `\`!confess ${serverKey} <their message>\``
  );
}

/**
 * Handle !confess received via DM.
 *
 * Expected format:
 *   !confess <serverKey> <confession text>
 */
async function handleConfessDM(client, message) {
  const content = message.content?.trim() ?? "";

  // The key is the first whitespace-delimited token after !confess;
  // everything after that is the confession text.
  const match = content.match(/^!confess\s+(\S+)\s+([\s\S]+)$/i);

  if (!match) {
    await message.channel.send(
      "Invalid format. Please use:\n`!confess <serverKey> <your confession>`"
    );
    return;
  }

  const serverKey      = match[1].toLowerCase();
  const confessionText = match[2].trim();

  // Strip [@:...] mention patterns from the confession text
  const cleanConfession = resolveMentions(confessionText) ?? confessionText;

  if (!cleanConfession) {
    await message.channel.send("Your confession cannot be empty.");
    return;
  }

  const db     = loadDb();
  const record = findByKey(db, serverKey);

  if (!record) {
    await message.channel.send(
      `❌ Unknown server key \`${serverKey}\`. ` +
      `Please double-check the key and try again.`
    );
    return;
  }

  // Reserve the confession number before posting
  const count = incrementCount(db, serverKey);

  // Look up the target channel in the client's in-memory cache
  const targetChannel = client.channels.cache.get(record.confessionChannelId);

  if (!targetChannel) {
    // Channel not in cache — bot may have lost access or channel was deleted
    await message.channel.send(
      "⚠️ Could not find the confession channel. " +
      "Please ask the server admin to run `!confess-setup` again."
    );
    return;
  }

  // Build the anonymous confession (Nerimity markdown bold + newline)
  const confessionMessage = `**Confession #${count}**\n${cleanConfession}`;

  try {
    await targetChannel.send(confessionMessage);
  } catch (err) {
    console.error("[confess] Failed to post confession:", err);
    await message.channel.send(
      "⚠️ Failed to post your confession. " +
      "The bot may lack permission to send messages in that channel."
    );
    return;
  }

  // Write hashed audit entry — no raw user ID is persisted
  writeAuditLog(message.user.id, serverKey, count, cleanConfession);

  // Confirm to the user
  await message.channel.send("✅ Your confession has been posted successfully.");
}

// ─── MESSAGE ROUTER ──────────────────────────────────────────────────────────

/**
 * Central message handler.
 * Routes incoming messages to the correct handler based on
 * channel type (DM vs guild) and command prefix.
 */
async function onMessageCreate(client, message) {
  // Never respond to our own messages
  if (message.user.id === client.user?.id) return;

  const content = message.content?.trim() ?? "";
  const isDM = !message.channel.server;
  let handled = false;

  if (isDM) {
    if (content.toLowerCase().startsWith("!confess")) {
      await handleConfessDM(client, message);
      handled = true;
    }
  } else {
    // Guild channel commands
    if (content.toLowerCase() === "!confess-setup") {
      await handleConfessSetup(message);
      handled = true;
    }
  }

}

// ─── RICH PRESENCE ───────────────────────────────────────────────────────────

/**
 * Cycle between rich presence activities every 15 seconds.
 */
let activityIndex = 0;
function updatePresence(client) {
  try {
    const serverCount = client.servers?.cache?.size ?? 0;
    const serverLabel = `${serverCount} server${serverCount !== 1 ? "s" : ""}`;
    const activities = [
      {
        action:       "Playing",
        name:         "Confession Bot",
        startedAt:    Date.now(),
        title:        serverLabel,
        subtitle:     "Type !confess-setup",
      },
      {
        action:       "Watching",
        name:         "Anonymous Confessions",
        startedAt:    Date.now(),
        title:        "🤫",
        subtitle:     "Your secret is safe",
      },
    ];
    const activity = activities[activityIndex % activities.length];
    activityIndex += 1;
    client.user?.setActivity(activity);
  } catch (e) {
    console.error("[bot] Failed to update presence:", e.message);
  }
}

// ─── BOT BOOTSTRAP ───────────────────────────────────────────────────────────

const client = new Client();

client.on(Events.Ready, () => {
  console.log(`[bot] Logged in as ${client.user?.username}`);
  console.log(`[bot] Database : ${path.resolve(DB_PATH)}`);
  console.log(`[bot] Audit log: ${path.resolve(LOG_PATH)}`);
  updatePresence(client);
  setInterval(() => updatePresence(client), 15000);
});

client.on(Events.MessageCreate, (message) => {
  onMessageCreate(client, message).catch((err) => {
    console.error("[bot] Unhandled error in message handler:", err);
  });
});

client.login(process.env.BOT_TOKEN);
