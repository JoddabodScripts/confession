"use strict";

/**
 * Escape HTML special characters so user-provided strings don't break
 * the Nerimity HTML validator's tag-balance check.
 *
 * That validator counts every `<letter...>` sequence as an opening tag,
 * so unescaped `<` in usernames or confession text = instant rejection.
 */
function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Build an HTML embed for a confession message.
 *
 * Uses only Nerimity-allowed tags, attributes, and CSS properties.
 * All user content is HTML-escaped before insertion.
 */
function confessionEmbed(count, content) {
  const safe = escapeHtml(content);

  return `<style>
  .wrap {
    background: #1c1917;
    border-radius: 12px;
    padding: 20px 24px;
    max-width: 520px;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  }
  .badge {
    display: inline-block;
    background: linear-gradient(135deg, #f97316, #fb923c);
    color: #fff;
    font-size: 11px;
    font-weight: 700;
    padding: 4px 12px;
    border-radius: 20px;
    margin-bottom: 6px;
  }
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 14px;
    padding-bottom: 12px;
    box-shadow: 0 1px 0 0 rgba(255,255,255,0.06);
  }
  .num {
    color: rgba(255,255,255,0.35);
    font-size: 13px;
    font-weight: 500;
  }
  .body {
    color: #e2e8f0;
    font-size: 15px;
    line-height: 1.6;
    word-break: break-word;
    white-space: pre-wrap;
    margin: 0;
  }
</style>
<div class="wrap">
  <div class="head">
    <span class="badge">🙊 Confidential</span>
    <span class="num">#${count}</span>
  </div>
  <p class="body">${safe}</p>
</div>`;
}

module.exports = { confessionEmbed };
