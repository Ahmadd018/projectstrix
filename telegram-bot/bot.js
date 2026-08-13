require('dotenv').config({ path: '../strix-dashboard/.env' });
const TelegramBotModule = require('node-telegram-bot-api');
const TelegramBot = TelegramBotModule.default || TelegramBotModule.TelegramBot || TelegramBotModule;
const { Client } = require('pg');

const dbUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/strix';

const client = new Client({
  connectionString: dbUrl,
});

async function main() {
  await client.connect();
  console.log('Connected to Strix database.');

  // Fetch bot token from user settings
  const res = await client.query(`SELECT "telegramToken", "telegramBotEnabled", "telegramChatId" FROM "UserSettings" LIMIT 1`);
  if (res.rows.length === 0) {
    console.error('No user settings found. Please configure the bot in the Strix Dashboard.');
    process.exit(1);
  }

  const settings = res.rows[0];
  if (!settings.telegramBotEnabled || !settings.telegramToken) {
    console.log('Telegram Bot is not enabled or token is missing in settings. Exiting.');
    process.exit(0);
  }

  const token = settings.telegramToken;
  const bot = new TelegramBot(token, { polling: true });

  console.log('Strix Telegram Bot is running...');

  // Notify on startup if chat ID is already configured
  if (settings.telegramChatId) {
    bot.sendMessage(settings.telegramChatId, '🦅 *Strix Bot is online and monitoring.*', { parse_mode: 'Markdown' }).catch(err => console.error("Failed to send startup message:", err.message));
  }

  // Handle /start command
  bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id.toString();
    
    // Update the database with the new chatId
    try {
      await client.query(`UPDATE "UserSettings" SET "telegramChatId" = $1`, [chatId]);
      bot.sendMessage(chatId, '✅ *Strix Bot Connected!*\n\nYour Chat ID has been automatically saved to your settings. You will now receive scan notifications here.\n\nCommands:\n/status - View running scans\n/scans - View recent scans', { parse_mode: 'Markdown' });
    } catch (err) {
      console.error(err);
      bot.sendMessage(chatId, '❌ Failed to save Chat ID to database.');
    }
  });

  // Handle /status command
  bot.onText(/\/status/, async (msg) => {
    const chatId = msg.chat.id.toString();
    try {
      const res = await client.query(`SELECT target, "scanMode", "startedAt" FROM "Scan" WHERE status = 'running'`);
      if (res.rows.length === 0) {
        bot.sendMessage(chatId, '🟢 *System Idle*\nNo scans are currently running.', { parse_mode: 'Markdown' });
      } else {
        let text = '🔥 *Running Scans:*\n\n';
        res.rows.forEach(r => {
          text += `🎯 Target: ${r.target}\n⚙️ Mode: ${r.scanMode}\n⏱️ Started: ${new Date(r.startedAt).toLocaleString()}\n\n`;
        });
        bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
      }
    } catch (err) {
      bot.sendMessage(chatId, '❌ Error fetching status.');
    }
  });

  // Handle /scans command
  bot.onText(/\/scans/, async (msg) => {
    const chatId = msg.chat.id.toString();
    try {
      const res = await client.query(`SELECT target, status, "vulnCount", "startedAt" FROM "Scan" ORDER BY "startedAt" DESC LIMIT 5`);
      if (res.rows.length === 0) {
        bot.sendMessage(chatId, 'No scans found in the database.');
      } else {
        let text = '📋 *Recent Scans:*\n\n';
        res.rows.forEach(r => {
          const icon = r.status === 'completed' ? '✅' : (r.status === 'failed' ? '❌' : (r.status === 'running' ? '🔥' : '⏳'));
          text += `${icon} *${r.target}*\nStatus: ${r.status}\nVulnerabilities: ${r.vulnCount}\nDate: ${new Date(r.startedAt).toLocaleString()}\n\n`;
        });
        bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
      }
    } catch (err) {
      bot.sendMessage(chatId, '❌ Error fetching recent scans.');
    }
  });

}

main().catch(console.error);
