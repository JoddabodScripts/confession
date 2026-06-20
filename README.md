# Nerimity Confession Bot

An anonymous confession bot for [Nerimity](https://nerimity.com) servers, built with [nerimity.js](https://github.com/Nerimity/nerimity.js).

## Features

-  **Anonymous Confessions** - Users submit confessions via DM that are posted anonymously to designated channels
-  **Unique Server Keys** - Each server gets a human-readable key (e.g., `maple-42`) for easy sharing
-  **Privacy-Focused** - User IDs are never stored in plaintext; only SHA-256 hashes for audit purposes
-  **Mention Stripping** - Automatically removes mention patterns to prevent abuse
-  **Sequential Numbering** - Each confession is numbered for easy reference
-  **Hashed Audit Log** - Server admins can verify confession authorship without compromising anonymity

## How It Works

### For Server Admins

1. Invite the bot to your Nerimity server
2. In the channel where you want confessions posted, run:
   ```
   !confess-setup
   ```
3. The bot will respond with your unique server key
4. Share this key with your community members

### For Users

1. Send a DM to the confession bot with:
   ```
   !confess <serverKey> Your confession message here
   ```
2. The bot will post your confession anonymously to the server's confession channel
3. You'll receive a confirmation message

## Installation

### Prerequisites

- [Node.js](https://nodejs.org/) (v16 or higher recommended)
- A Nerimity bot token (create one at [Nerimity Developer Portal](https://nerimity.com))

### Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/JoddabodScripts/confession.git
   cd confession
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file based on `.env.example`:
   ```bash
   cp .env.example .env
   ```

4. Add your bot token to `.env`:
   ```env
   BOT_TOKEN=your_bot_token_here
   ```

5. Start the bot:
   ```bash
   npm start
   ```

## Configuration

The bot uses two JSON files for data persistence:

- **`db.json`** - Stores server configurations (server ID, confession channel, server key, confession count)
- **`admin-log.json`** - Hashed audit log with SHA-256 user IDs and content hashes

Both files are automatically created on first run.

## Commands

| Command | Location | Permission | Description |
|---------|----------|------------|-------------|
| `!confess-setup` | Server Channel | Admin | Set the current channel as the confession channel |
| `!confess <key> <message>` | DM | Everyone | Submit an anonymous confession |

## Privacy & Security

This bot is designed with privacy in mind:

- **No Raw User IDs**: User IDs are never stored in logs—only SHA-256 hashes
- **Audit Trail**: Server hosts can verify if a specific user posted a confession by comparing hashes
- **Mention Protection**: Raw mention patterns (`[@:userId]`) are stripped before posting
- **Synchronous Writes**: Database writes are synchronous to prevent data loss

### Audit Log Structure

Each confession generates a hashed audit entry:
```json
{
  "timestamp": "2026-06-20T06:54:00.000Z",
  "serverKey": "maple-42",
  "confessionNum": 123,
  "userIdHash": "sha256_hash_of_user_id",
  "contentHash": "sha256_hash_of_confession_text"
}
```

To verify if a user posted a specific confession, compute `SHA-256(userId)` and compare it to the stored hash.

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details.

## Support

If you encounter issues or have questions:

1. Check existing [Issues](https://github.com/JoddabodScripts/confession/issues)
2. Open a new issue with detailed information
3. Join the [Nerimity server](https://nerimity.com/i/jDRhc) for general help

## Acknowledgments

- Built with [nerimity.js](https://github.com/Nerimity/nerimity.js)
- Designed for the [Nerimity](https://nerimity.com) platform
