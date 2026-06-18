const TelegramBot = require('node-telegram-bot-api');
const IAService = require('./ia-service');

let bot = null;

async function initTelegramBot(app, pool) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.log('⚠️ TELEGRAM_BOT_TOKEN non défini');
    return;
  }

  const webhookUrl = process.env.TELEGRAM_WEBHOOK_URL;
  
  if (webhookUrl && process.env.NODE_ENV === 'production') {
    bot = new TelegramBot(token);
    await bot.setWebHook(webhookUrl);
    console.log(`✅ Webhook Telegram V5: ${webhookUrl}`);
  } else {
    bot = new TelegramBot(token, { polling: true });
    console.log('✅ Bot Telegram V5 en mode polling');
  }

  global.telegramBot = bot;

  bot.on('message', async (msg) => {
    try {
      await handleMessage(msg, pool);
    } catch (error) {
      console.error('Erreur Telegram:', error);
      try { await bot.sendMessage(msg.chat.id, '😅 Une erreur est survenue. Réessaie !'); } catch (e) {}
    }
  });

  bot.on('callback_query', async (query) => {
    try {
      await handleCallback(query, pool);
    } catch (error) {
      await bot.answerCallbackQuery(query.id, { text: 'Erreur' });
    }
  });

  console.log('🤖 Bot Telegram V5 prêt !');
}

async function handleMessage(msg, pool) {
  const chatId = msg.chat.id;
  const text = msg.text;
  const userId = msg.from.id;

  if (!text) return;

  if ((msg.chat.type === 'group' || msg.chat.type === 'supergroup') && bot) {
    const botInfo = await bot.getMe();
    if (!text.includes('@' + botInfo.username)) return;
  }

  await saveTelegramUser(pool, msg.from);

  if (text === '/start') {
    const firstName = msg.from.first_name || 'ami';
    await bot.sendMessage(chatId,
      `🤖 *Salut ${firstName} !*\n\n` +
      `Je suis *Mini ChatGPT V5* avec *20 couches d'IA* !\n\n` +
      `✨ *Nouveautés V5 :*\n` +
      `• 🖼️ Recherche et affichage d'images\n` +
      `• 📝 Paragraphes professionnels\n` +
      `• 🔍 Analyse approfondie\n` +
      `• 🌐 Recherche web intelligente\n\n` +
      `*Commandes :*\n` +
      `/aide - Aide\n` +
      `/images - Rechercher des images\n` +
      `/stats - Statistiques\n` +
      `/feedback - Donner ton avis\n\n` +
      `Envoie-moi un message ! 😊`,
      { parse_mode: 'Markdown' }
    );
    return;
  }

  if (text === '/aide' || text === '/help') {
    await bot.sendMessage(chatId,
      '🎯 *Aide Mini ChatGPT V5*\n\n' +
      '*Commandes :*\n' +
      '/start - Démarrer\n' +
      '/aide - Cette aide\n' +
      '/images [recherche] - Chercher des images\n' +
      '/stats - Statistiques\n' +
      '/feedback - Donner ton avis\n\n' +
      '*Exemples :*\n' +
      '• Montre-moi des images de Paris\n' +
      '• Explique-moi la photosynthèse\n' +
      '• Analyse les avantages de l\'IA\n\n' +
      '_20 IA travaillent pour toi !_ 🚀',
      { parse_mode: 'Markdown' }
    );
    return;
  }

  if (text.startsWith('/images')) {
    const query = text.replace('/images', '').trim() || 'paysage';
    await bot.sendChatAction(chatId, 'upload_photo');
    await bot.sendMessage(chatId, `🖼️ Recherche d'images pour « ${query} »... Utilise l'application web pour voir les images.\n\n🌐 ${process.env.FRONTEND_URL || 'http://localhost:10000'}`);
    return;
  }

  if (text === '/stats') {
    const stats = await pool.query(`SELECT (SELECT COUNT(*) FROM qa_pairs) as qa, (SELECT COUNT(*) FROM image_cache) as images, (SELECT COUNT(*) FROM users) as users`);
    const s = stats.rows[0];
    await bot.sendMessage(chatId,
      '📊 *Statistiques V5*\n\n' +
      `💬 Q/R : *${s.qa}*\n` +
      `🖼️ Images : *${s.images}*\n` +
      `👥 Users : *${s.users}*\n\n` +
      '_Plus tu utilises le bot, plus il apprend !_ 🚀',
      { parse_mode: 'Markdown' }
    );
    return;
  }

  if (text === '/feedback') {
    const keyboard = {
      inline_keyboard: [[
        { text: '⭐', callback_data: 'rate_1' },
        { text: '⭐⭐', callback_data: 'rate_2' },
        { text: '⭐⭐⭐', callback_data: 'rate_3' },
        { text: '⭐⭐⭐⭐', callback_data: 'rate_4' },
        { text: '⭐⭐⭐⭐⭐', callback_data: 'rate_5' }
      ]]
    };
    await bot.sendMessage(chatId, '⭐ *Note le bot V5 !*', { parse_mode: 'Markdown', reply_markup: keyboard });
    return;
  }

  // Message normal
  await bot.sendChatAction(chatId, 'typing');
  const iaService = new IAService(pool);
  const result = await iaService.processMessage(text, 'telegram-' + chatId, 'telegram');

  await pool.query(
    'INSERT INTO qa_pairs (question, answer, intent, source) VALUES ($1, $2, $3, $4)',
    [text, result.finalResponse, result.analysis?.intent, 'telegram']
  );
  await pool.query('UPDATE telegram_users SET last_interaction = NOW() WHERE telegram_id = $1', [userId]);

  let response = result.finalResponse;
  if (response.length > 4000) response = response.substring(0, 3997) + '...';

  await bot.sendMessage(chatId, response, { parse_mode: 'Markdown' });
}

async function handleCallback(query, pool) {
  const chatId = query.message.chat.id;
  const data = query.data;
  await bot.answerCallbackQuery(query.id);

  if (data === 'useful') {
    await pool.query('INSERT INTO feedback (rating, platform) VALUES ($1, $2)', [5, 'telegram']);
    await bot.sendMessage(chatId, '👍 *Merci !* 😊', { parse_mode: 'Markdown' });
  } else if (data === 'not_useful') {
    await pool.query('INSERT INTO feedback (rating, comment, platform) VALUES ($1, $2, $3)', [2, 'Pas utile', 'telegram']);
    await bot.sendMessage(chatId, '👎 *Désolé !* Je vais m\'améliorer. 🙏', { parse_mode: 'Markdown' });
  } else if (data.startsWith('rate_')) {
    const rating = parseInt(data.split('_')[1]);
    await pool.query('INSERT INTO feedback (rating, platform) VALUES ($1, $2)', [rating, 'telegram']);
    const emojis = ['', '⭐', '⭐⭐', '⭐⭐⭐', '⭐⭐⭐⭐', '⭐⭐⭐⭐⭐'];
    await bot.sendMessage(chatId, `${emojis[rating]} *Merci !* 🚀`, { parse_mode: 'Markdown' });
  }
}

async function saveTelegramUser(pool, user) {
  try {
    await pool.query(
      `INSERT INTO telegram_users (telegram_id, username, first_name, last_name, language_code, last_interaction)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (telegram_id) DO UPDATE SET username = $2, first_name = $3, last_name = $4, last_interaction = NOW()`,
      [user.id, user.username, user.first_name, user.last_name, user.language_code]
    );
  } catch (e) {}
}

module.exports = { initTelegramBot };
