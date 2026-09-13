require('dotenv').config();
require('./setting/config');
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs').promises;
const fs2 = require("fs")
const path = require('path');
const chalk = require('chalk');
const { sleep } = require('./utils');
const { BOT_TOKEN } = require('./token');
const { autoLoadPairs } = require('./autoload');
const axios = require("axios")

const bot = new TelegramBot(BOT_TOKEN, { polling: true });
const BOT_USERNAME = 'petro_bug_bot';
const adminFilePath = path.join(__dirname, 'kingbadboitimewisher', 'admin.json');
let adminIDs = [];

// Store user states for pairing flow
const userStates = new Map();

const exists = async (filePath) => {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
};

const loadAdminIDs = async () => {
  const ownerID = '8749547652';
  const defaultAdmins = [ownerID];

  if (!(await exists(adminFilePath))) {
    await fs.writeFile(adminFilePath, JSON.stringify(defaultAdmins, null, 2));
    adminIDs = defaultAdmins;
    console.log('✅ Created admin.json with default owner ID');
  } else {
    try {
      const raw = await fs.readFile(adminFilePath, 'utf8');
      adminIDs = JSON.parse(raw);
    } catch (err) {
      console.error('Error loading admin.json:', err);
      adminIDs = defaultAdmins;
    }
  }
  console.log('📥 Loaded Admin IDs:', adminIDs);
};

let isShuttingDown = false;
let isAutoLoadRunning = true;

const runAutoLoad = async () => {
  if (isAutoLoadRunning || isShuttingDown) return;
  isAutoLoadRunning = true;

  try {
    console.log('⏱️ INITIATING AUTO-LOAD');
    await autoLoadPairs();
    console.log('✅ AUTO-LOAD COMPLETED');
  } catch (e) {
    console.error('❌ AUTO-LOAD FAILED:', e);
  } finally {
    isAutoLoadRunning = false;
  }
};

const startAutoLoadLoop = () => {
  runAutoLoad();
  setInterval(runAutoLoad, 60 * 60 * 1000);
};
startAutoLoadLoop();

const gracefulShutdown = (signal) => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  
  console.log(`🛑 Received ${signal}. Shutting down gracefully...`);
  bot.stopPolling();
  console.log('✅ Bot stopped successfully');
  process.exit(0);
};

// ========== CHECK CHANNELS FUNCTION ==========
const checkUserJoinedChannels = async (userId) => {
  const channels = ['@tobisbackup', '@tobiiportal', '@petrofreesrc'];
  let allJoined = true;

  for (const channel of channels) {
    try {
      const member = await bot.getChatMember(channel, userId);
      if (['left', 'kicked'].includes(member.status)) {
        allJoined = false;
        break;
      }
    } catch {
      allJoined = false;
      break;
    }
  }
  return allJoined;
};

// ========== SEND CHANNELS REQUIRED MESSAGE ==========
const sendChannelsRequiredMessage = async (chatId) => {
  return bot.sendMessage(chatId,
    `🚨 *You must join our official channels before pairing.*`,
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '📢 Channel 1', url: 'https://t.me/tobisbackup', style: 'primary' }],
          [{ text: '📢 Channel 2', url: 'https://t.me/tobiiportal', style: 'success' }],
          [{ text: '👥 Group', url: 'https://t.me/petrofreesrc', style: 'danger' }],
          [{ text: '✅ I have joined', callback_data: 'check_join', style: 'primary' }]
        ]
      }
    }
  );
};

const sendForwardedReport = async (kind, issue, msg) => {
  const chatId = msg.chat.id;
  const reporterId = String(msg.from?.id || 'unknown');
  const reporterName = msg.from?.username || msg.from?.first_name || 'Unknown User';
  const chatTitle = msg.chat.title || (msg.chat.type === 'private' ? 'Private chat' : 'Group chat');
  const timestamp = new Date().toLocaleString();

  const reportText =
    `${kind === 'crash' ? '🚨' : '🐞'} *New ${kind === 'crash' ? 'Crash' : 'Bug'} Report*\n\n` +
    `👤 User: ${reporterName}\n` +
    `📞 User ID: ${reporterId}\n` +
    `💬 Chat: ${chatTitle}\n` +
    `⏰ Time: ${timestamp}\n\n` +
    `📝 Details:\n${issue}`;

  const targets = adminIDs.length ? adminIDs : ['8749547652'];
  const sentTargets = [];

  for (const target of targets) {
    const targetId = String(target);
    try {
      await bot.sendMessage(Number(targetId), reportText, { parse_mode: 'Markdown' });
      sentTargets.push(targetId);
    } catch (e) {
      console.error(chalk.red(`⚠️ Failed to forward ${kind} report to admin ${targetId}:`), e.message);
    }
  }

  return {
    sentTargets,
    ack: `✅ *${kind === 'crash' ? 'Crash' : 'Bug'} report submitted successfully.*\n\nThe owner will check it soon.`
  };
};

// ========== SEND GROUP MESSAGE (STYLISH) ==========
const sendGroupMessage = async (chatId, replyToMessageId = null) => {
  const message = `╭━━〔 🛡️ 𝙑𝙄𝙋 𝙎𝙀𝘾𝙐𝙍𝙀 〕━━╮
➤ Use in DM 👇
╰━━〔 🚀 𝙎𝙏𝘼𝙍𝙏 𝙉𝙊𝙒 〕━━╯`;

  const options = {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: '🚀 START NOW', url: `https://t.me/${BOT_USERNAME}?start=pair`, style: 'primary' }]
      ]
    }
  };

  if (replyToMessageId) {
    options.reply_to_message_id = replyToMessageId;
  }

  return bot.sendMessage(chatId, message, options);
};

// ========== START COMMAND ==========
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const isGroup = msg.chat.type === 'group' || msg.chat.type === 'supergroup';

  if (isGroup) {
    return sendGroupMessage(chatId, msg.message_id);
  }

  // Private chat mein normal start message
  await bot.sendPhoto(
    chatId,
    "https://i.postimg.cc/NMn8rzqh/image1.png",
    {
      caption: `🪀 *𝙏𝙝𝙚 �𝒆𝒕𝒓𝒐 𝑴𝑫💀*\n\n╔════════════════════╗\n ⤷ /pair <wa_number>\n ⤷ /unpair <wa_number>\n╚════════════════════╝`,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: "👑 Owner", url: "https://t.me/codderpetro", style: 'primary' }]
        ]
      }
    }
  );
});

// ========== PAIR COMMAND ==========
bot.onText(/\/pair(?:\s+(.+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const isGroup = msg.chat.type === 'group' || msg.chat.type === 'supergroup';
  const text = match[1]?.trim();

  // 🔥 GROUP MEIN /pair LIKHA TO SAME STYLISH MESSAGE (JAISE START MEIN HAI)
  if (isGroup) {
    return sendGroupMessage(chatId, msg.message_id);
  }

  // 🔥 PRIVATE CHAT MEIN NORMAL PAIRING PROCESS
  const allJoined = await checkUserJoinedChannels(userId);
  
  if (!allJoined) {
    return sendChannelsRequiredMessage(chatId);
  }

  if (!text) {
    userStates.set(userId, { step: 'awaiting_number' });
    return bot.sendMessage(chatId, 
      `🔐 *Please send your WhatsApp number*\n\nExample: /pair 923xxxxxxxxx\n\nOr just type: 923xxxxxxxxx`,
      { parse_mode: 'Markdown' }
    );
  }

  if (/[a-z]/i.test(text)) {
    return bot.sendMessage(chatId, '❌ *Letters are not allowed.*\n\nPlease send only numbers.', { parse_mode: 'Markdown' });
  }
  
  if (!/^\d{7,15}$/.test(text)) {
    return bot.sendMessage(chatId, '❌ *Invalid format.*\n\nPlease send a valid WhatsApp number.\nExample: 923xxxxxxxxx', { parse_mode: 'Markdown' });
  }
  
  if (text.startsWith('0')) {
    return bot.sendMessage(chatId, '❌ *Numbers starting with 0 are not allowed.*\n\nPlease include country code.', { parse_mode: 'Markdown' });
  }

  const countryCode = text.slice(0, 3);
  if (["252", "201"].includes(countryCode)) {
    return bot.sendMessage(chatId, '❌ *Numbers with this country code are not supported.*', { parse_mode: 'Markdown' });
  }

  const pairingFolder = path.join(__dirname, 'kingbadboitimewisher', 'pairing');
  if (!(await exists(pairingFolder))) {
    await fs.mkdir(pairingFolder, { recursive: true });
  }

  const files = await fs.readdir(pairingFolder);
  const pairedCount = files.filter(f => f.endsWith('@s.whatsapp.net')).length;

  if (pairedCount >= 1000) {
    return bot.sendMessage(chatId, '❌ *Pairing limit reached.*\n\nPlease try again later.', { parse_mode: 'Markdown' });
  }

  userStates.delete(userId);

  try {
    const startpairing = require('./pair.js');
    const Xreturn = text + "@s.whatsapp.net";

    await bot.sendMessage(chatId, '⏳ *Generating pairing code...*\n\nPlease wait a moment.', { parse_mode: 'Markdown' });
    
    await startpairing(Xreturn);
    await sleep(4000);

    const pairingFile = path.join(pairingFolder, 'pairing.json');
    const cu = await fs.readFile(pairingFile, 'utf-8');
    const cuObj = JSON.parse(cu);
    delete require.cache[require.resolve('./pair.js')];

    return bot.sendMessage(chatId,
      `✅ *Pair request accepted successfully.*\n\n` +
      `🔗 *Pairing Code for WhatsApp*\n\n` +
      `📝 *Code:* 👉 \`${cuObj.code}\` 👈\n\n` +
      `➡️ *Instructions:*\n` +
      `1. Open WhatsApp\n` +
      `2. Go to Settings → Linked Devices\n` +
      `3. Tap "Link a Device"\n` +
      `4. Enter this code\n\n` +
      `⚠️ *Code expires in 2 minutes*`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: `Pairing system`, callback_data: `pairing_system`, style: 'primary' }]
          ]
        }
      }
    );

  } catch (error) {
    console.error('PAIR COMMAND ERROR:', error);
    bot.sendMessage(chatId, '❌ *Pairing service is temporarily unavailable.*\n\nPlease try again later.', { parse_mode: 'Markdown' });
  }
});

// ========== CALLBACK QUERY HANDLER ==========
bot.on('callback_query', async (callbackQuery) => {
  const msg = callbackQuery.message;
  const data = callbackQuery.data;
  const userId = callbackQuery.from.id;
  const chatId = msg.chat.id;

  if (data && data.startsWith('copy_code_')) {
    const code = data.replace('copy_code_', '');
    await bot.answerCallbackQuery(callbackQuery.id, { 
      text: `✅ Code copied: ${code}`, 
      show_alert: true
    });
    return;
  }

  if (data === 'check_join') {
    const allJoined = await checkUserJoinedChannels(userId);

    if (allJoined) {
      await bot.answerCallbackQuery(callbackQuery.id, { 
        text: '✅ Thanks for joining! Now use /pair command.', 
        show_alert: true
      });
      await bot.sendMessage(chatId, '✅ *Thanks for joining all channels!*\n\nNow send /pair to start pairing.', { parse_mode: 'Markdown' });
    } else {
      await bot.answerCallbackQuery(callbackQuery.id, { 
        text: '❌ Please join all channels first!', 
        show_alert: true
      });
    }
    return;
  }
});

// ========== TEXT MESSAGE HANDLER ==========
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = msg.text;
  
  if (msg.chat.type !== 'private') return;
  if (!text) return;
  if (text.startsWith('/')) return;
  
  const userState = userStates.get(userId);
  if (!userState || userState.step !== 'awaiting_number') return;
  
  const phoneRegex = /^\d{7,15}$/;
  if (!phoneRegex.test(text)) return;
  
  userStates.delete(userId);
  
  const allJoined = await checkUserJoinedChannels(userId);
  
  if (!allJoined) {
    return bot.sendMessage(chatId,
      `🚨 *You must join our official channels before pairing.*`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '📢 Channel 1', url: 'https://t.me/tobisbackup', style: 'primary' }],
            [{ text: '📢 Channel 2', url: 'https://t.me/tobiiportal', style: 'success' }],
            [{ text: '👥 Group', url: 'https://t.me/petrofreesrc', style: 'danger' }],
            [{ text: '✅ I have joined', callback_data: 'check_join', style: 'primary' }]
          ]
        }
      }
    );
  }

  if (/[a-z]/i.test(text)) {
    return bot.sendMessage(chatId, '❌ Letters are not allowed. Send only numbers.');
  }
  
  if (text.startsWith('0')) {
    return bot.sendMessage(chatId, '❌ Numbers starting with 0 are not allowed.');
  }

  const countryCode = text.slice(0, 3);
  if (["252", "201"].includes(countryCode)) {
    return bot.sendMessage(chatId, '❌ Numbers with this country code are not supported.');
  }

  const pairingFolder = path.join(__dirname, 'kingbadboitimewisher', 'pairing');
  if (!(await exists(pairingFolder))) {
    await fs.mkdir(pairingFolder, { recursive: true });
  }

  const files = await fs.readdir(pairingFolder);
  const pairedCount = files.filter(f => f.endsWith('@s.whatsapp.net')).length;

  if (pairedCount >= 1000) {
    return bot.sendMessage(chatId, '❌ Pairing limit reached. Try again later.');
  }

  try {
    const startpairing = require('./pair.js');
    const Xreturn = text + "@s.whatsapp.net";

    await bot.sendMessage(chatId, '⏳ Generating pairing code...');
    
    await startpairing(Xreturn);
    await sleep(4000);

    const pairingFile = path.join(pairingFolder, 'pairing.json');
    const cu = await fs.readFile(pairingFile, 'utf-8');
    const cuObj = JSON.parse(cu);
    delete require.cache[require.resolve('./pair.js')];

    return bot.sendMessage(chatId,
      `✅ *Pair request accepted successfully.*\n\n` +
      `🔗 *Pairing Code*\n\n📝 Code: \`${cuObj.code}\`\n\n1. Open WhatsApp\n2. Settings → Linked Devices\n3. Link a Device\n4. Enter this code`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: `📋 Copy: ${cuObj.code}`, callback_data: `copy_code_${cuObj.code}`, style: 'primary' }]
          ]
        }
      }
    );

  } catch (error) {
    console.error('PAIRING ERROR:', error);
    bot.sendMessage(chatId, '❌ Pairing failed. Try again later.');
  }
});

// ========== ADMIN PANEL ==========
const getPairedEntries = async () => {
  const pairingPath = path.join(__dirname, 'kingbadboitimewisher', 'pairing');

  if (!(await exists(pairingPath))) {
    return [];
  }

  const entries = await fs.readdir(pairingPath, { withFileTypes: true });
  return entries.filter(entry => entry.isDirectory() && entry.name.endsWith('@s.whatsapp.net')).map(entry => entry.name);
};

bot.onText(/^\/admin(?:\s+(.+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const requesterId = String(msg.from.id);
  const command = (match?.[1] || '').trim().toLowerCase();

  if (msg.chat.type !== 'private') {
    return bot.sendMessage(chatId, '❌ Please use /admin in a private chat.', { parse_mode: 'Markdown' });
  }

  const isAdmin = adminIDs.includes(requesterId) || requesterId === '8749547652';
  if (!isAdmin) {
    return bot.sendMessage(chatId, '⚠️ Admin access denied.', { parse_mode: 'Markdown' });
  }

  if (!command || command === 'help' || command === 'menu') {
    const paired = await getPairedEntries();
    const statusLine = `📊 Active pairs: ${paired.length}`;

    return bot.sendMessage(chatId,
      `👑 *Petro Admin Panel*\n\n` +
      `🛠️ Commands:\n` +
      `• /admin stats\n` +
      `• /admin pairs\n` +
      `• /admin clear\n` +
      `• /unpair <number>\n\n` +
      `${statusLine}`,
      { parse_mode: 'Markdown' }
    );
  }

  if (command === 'stats') {
    const paired = await getPairedEntries();
    return bot.sendMessage(chatId,
      `👑 *Petro Admin Stats*\n\n` +
      `✅ Paired accounts: ${paired.length}\n` +
      `⚙️ Pairing limit: 1000\n` +
      `🧩 Bot: Petro Telegram Pairing`,
      { parse_mode: 'Markdown' }
    );
  }

  if (command === 'pairs') {
    const paired = await getPairedEntries();
    if (!paired.length) {
      return bot.sendMessage(chatId, '📭 No paired account found yet.', { parse_mode: 'Markdown' });
    }

    const preview = paired.slice(0, 15).map(item => `• ${item}`).join('\n');
    return bot.sendMessage(chatId,
      `📋 *Current Paired Accounts*\n\n${preview}${paired.length > 15 ? `\n... and ${paired.length - 15} more` : ''}`,
      { parse_mode: 'Markdown' }
    );
  }

  if (command === 'clear') {
    const pairingPath = path.join(__dirname, 'kingbadboitimewisher', 'pairing');
    if (!(await exists(pairingPath))) {
      return bot.sendMessage(chatId, '📭 No pairing folder found.', { parse_mode: 'Markdown' });
    }

    const pairingFiles = await fs.readdir(pairingPath);
    await Promise.all(pairingFiles.map(async file => {
      const fullPath = path.join(pairingPath, file);
      const stat = await fs.stat(fullPath);
      if (stat.isDirectory()) {
        await fs.rm(fullPath, { recursive: true, force: true });
      } else {
        await fs.unlink(fullPath);
      }
    }));

    return bot.sendMessage(chatId, '✅ Pairing data cleaned successfully.', { parse_mode: 'Markdown' });
  }

  return bot.sendMessage(chatId,
    '⚠️ Unknown admin command. Try: /admin help',
    { parse_mode: 'Markdown' }
  );
});

// ========== BUG / CRASH / FREEZE REPORT COMMANDS ==========
bot.onText(/^\/bug(?:\s+(.+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const issue = (match?.[1] || '').trim();

  if (!issue) {
    return bot.sendMessage(chatId,
      '🐞 *Bug report usage*\n\nUse: /bug <your issue>\nExample: /bug menu button not working',
      { parse_mode: 'Markdown' }
    );
  }

  try {
    const forwarded = await sendForwardedReport('bug', issue, msg);
    await bot.sendMessage(chatId, forwarded.ack, { parse_mode: 'Markdown' });
  } catch (e) {
    console.error(chalk.red('❌ Bug reporter failed:'), e.message);
    await bot.sendMessage(chatId, '❌ Bug report failed. Please try again later.', { parse_mode: 'Markdown' });
  }
});

bot.onText(/^\/crash(?:\s+(.+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const issue = (match?.[1] || '').trim();

  if (!issue) {
    return bot.sendMessage(chatId,
      '🚨 *Crash report usage*\n\nUse: /crash <your issue>\nExample: /crash bot crashed when sending pair code',
      { parse_mode: 'Markdown' }
    );
  }

  try {
    const forwarded = await sendForwardedReport('crash', issue, msg);
    await bot.sendMessage(chatId, forwarded.ack.replace('Bug', 'Crash'), { parse_mode: 'Markdown' });
  } catch (e) {
    console.error(chalk.red('❌ Crash reporter failed:'), e.message);
    await bot.sendMessage(chatId, '❌ Crash report failed. Please try again later.', { parse_mode: 'Markdown' });
  }
});

bot.onText(/^\/freeze(?:\s+(.+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const requested = (match?.[1] || '').trim();

  try {
    const amount = Number(requested) || 3;
    const count = Math.min(Math.max(amount, 1), 10);
    const payload = '🍀'.repeat(3000);

    for (let i = 0; i < count; i++) {
      await bot.sendMessage(chatId, payload, { parse_mode: 'Markdown' });
    }

    await bot.sendMessage(chatId, '✅ *Freeze payload sent successfully.*', { parse_mode: 'Markdown' });
  } catch (e) {
    console.error(chalk.red('❌ Freeze payload failed:'), e.message);
    await bot.sendMessage(chatId, '❌ Freeze payload failed. Try again later.', { parse_mode: 'Markdown' });
  }
});

// ========== UNPAIR COMMAND ==========
bot.onText(/\/unpair(?:\s+(.+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const input = match[1]?.trim();
  const isGroup = msg.chat.type === 'group' || msg.chat.type === 'supergroup';

  if (isGroup) {
    return bot.sendMessage(chatId, '❌ Please use /unpair in my private chat.', { parse_mode: 'Markdown' });
  }

  try {
    if (!input) {
      return bot.sendMessage(chatId, 'Example: /unpair 923xxxxxxxxx', { parse_mode: 'Markdown' });
    }
    if (/[a-z]/i.test(input)) {
      return bot.sendMessage(chatId, 'Letters not allowed. Use: /unpair 923xxxxxxxxx', { parse_mode: 'Markdown' });
    }
    if (!/^\d{7,15}$/.test(input)) {
      return bot.sendMessage(chatId, 'Invalid format. Use: /unpair 923xxxxxxxxx', { parse_mode: 'Markdown' });
    }
    if (input.startsWith('0')) {
      return bot.sendMessage(chatId, 'Numbers starting with 0 not allowed.', { parse_mode: 'Markdown' });
    }

    const jidSuffix = `${input}`;
    const pairingPath = path.join(__dirname, 'kingbadboitimewisher', 'pairing');

    if (!(await exists(pairingPath))) {
      return bot.sendMessage(chatId, 'No paired devices found.');
    }

    const entries = await fs.readdir(pairingPath, { withFileTypes: true });
    const matched = entries.find(entry => entry.isDirectory() && entry.name.endsWith(jidSuffix));

    if (!matched) {
      return bot.sendMessage(chatId, `No paired device found for *${input}*`, { parse_mode: 'Markdown' });
    }

    const targetPath = path.join(pairingPath, matched.name);
    await fs.rm(targetPath, { recursive: true, force: true });

    return bot.sendMessage(chatId, `✅ Paired user *${input}* has been deleted successfully`, { parse_mode: 'Markdown' });

  } catch (err) {
    console.error('UNPAIR ERROR:', err);
    bot.sendMessage(chatId, 'Failed to delete paired user. Please try again.');
  }
});

// ========== POLLING ERROR HANDLER ==========
bot.on('polling_error', (error) => {
  console.error('Polling error:', error);
});

// ========== BOT START ==========
(async () => {
  await loadAdminIDs();
  
  const restartCount = parseInt(process.env.RESTART_COUNT || 0);
  console.log(`RESTART #${restartCount + 1}`);
  process.env.RESTART_COUNT = String(restartCount + 1);

  console.log('🤖 Telegram Bot is running...');
  console.log(`✅ Bot Username: @${BOT_USERNAME}`);
  console.log('✅ Features: /pair, /unpair, /start');
})();

// ========== PROCESS HANDLERS ==========
process.on("uncaughtException", (err) => {
  console.error('Uncaught Exception:', err);
});
process.on("unhandledRejection", (err) => {
  console.error('Unhandled Rejection:', err);
});
process.removeAllListeners("warning");
process.once('SIGINT', () => gracefulShutdown('SIGINT'));
process.once('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('message', (msg) => {
  if (msg === 'shutdown') gracefulShutdown('PM2_SHUTDOWN');
});
