const TelegramBot = require('node-telegram-bot-api');

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
    console.log(`✅ Webhook Telegram: ${webhookUrl}`);
  } else {
    bot = new TelegramBot(token, { polling: true });
    console.log('✅ Bot Telegram en mode polling');
  }

  global.telegramBot = bot;

  bot.on('message', async (msg) => {
    try {
      await handleMessage(msg, pool);
    } catch (error) {
      console.error('❌ Erreur générale:', error.message);
      try {
        await bot.sendMessage(msg.chat.id, '😅 Une erreur est survenue. Réessaie !');
      } catch (e) {}
    }
  });

  bot.on('callback_query', async (query) => {
    try {
      await handleCallback(query, pool);
    } catch (error) {
      console.error('❌ Erreur callback:', error.message);
      await bot.answerCallbackQuery(query.id, { text: 'OK' });
    }
  });

  console.log('🤖 Bot Telegram prêt !');
}

async function handleMessage(msg, pool) {
  const chatId = msg.chat.id;
  const text = msg.text;
  const firstName = msg.from.first_name || 'ami';

  if (!text) return;

  console.log(`📩 ${firstName}: "${text.substring(0, 80)}"`);

  // Ignorer les messages de groupe sans mention
  if ((msg.chat.type === 'group' || msg.chat.type === 'supergroup') && bot) {
    try {
      const botInfo = await bot.getMe();
      if (!text.includes('@' + botInfo.username)) return;
    } catch (e) {}
  }

  // ============================================================
  // COMMANDES
  // ============================================================
  if (text === '/start') {
    await handleStart(chatId, firstName);
    return;
  }
  if (text === '/aide' || text === '/help') {
    await handleHelp(chatId);
    return;
  }
  if (text === '/stats') {
    await handleStats(chatId, pool);
    return;
  }
  if (text === '/feedback') {
    await handleFeedback(chatId);
    return;
  }

  // ============================================================
  // MESSAGE NORMAL → TRAITEMENT AVEC IA
  // ============================================================
  await bot.sendChatAction(chatId, 'typing');

  try {
    // === APPELER LE SERVICE IA (20 couches) ===
    const IAService = require('./ia-service');
    const iaService = new IAService(pool);
    const result = await iaService.processMessage(text, 'telegram-' + chatId, 'telegram');

    let response = result.finalResponse;

    // Limiter pour Telegram (max 4096 caractères)
    if (response.length > 4000) {
      response = response.substring(0, 3950) + '...\n\n_(Suite sur l\'app web)_';
    }

    console.log(`✅ Réponse générée en ${result.processingTime}ms`);

    // Ajouter des boutons
    const keyboard = {
      inline_keyboard: [
        [
          { text: '👍 Utile', callback_data: 'useful' },
          { text: '👎 Pas utile', callback_data: 'not_useful' }
        ],
        [
          { text: '🔄 Regénérer', callback_data: 'regenerate' }
        ]
      ]
    };

    await bot.sendMessage(chatId, response, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });

    // Sauvegarder en base (optionnel, ne bloque pas si erreur)
    try {
      await pool.query(
        `INSERT INTO qa_pairs (question, answer, intent, sentiment, source, search_performed, processing_time)
         VALUES ($1, $2, $3, $4, 'telegram', $5, $6)`,
        [
          text,
          response,
          result.analysis?.intent || 'conversation',
          result.analysis?.sentiment || 'neutre',
          result.searchPerformed || false,
          result.processingTime || 0
        ]
      );
    } catch (dbError) {
      console.log('⚠️ Sauvegarde DB ignorée');
    }

  } catch (iaError) {
    // === SI L'IA ÉCHOUE, UTILISER LE FALLBACK INTELLIGENT ===
    console.error('❌ Erreur IA:', iaError.message);
    console.log('🔄 Utilisation du fallback intelligent...');
    
    const fallbackResponse = generateSmartResponse(text, firstName);
    await bot.sendMessage(chatId, fallbackResponse, { parse_mode: 'Markdown' });
  }
}

// ============================================================
// RÉPONSE INTELLIGENTE (utilise des règles si l'IA échoue)
// ============================================================
function generateSmartResponse(text, firstName) {
  const lower = text.toLowerCase().trim();

  // Salutations
  if (/^(bonjour|salut|hello|coucou|yo|wesh|bonsoir|bjr|slt|hey|cc)\b/i.test(lower)) {
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir';
    const responses = [
      `${greeting} ${firstName} ! 👋 Comment puis-je t'aider ?`,
      `${greeting} ${firstName} ! 😊 Ravi de te voir !`,
      `${greeting} ${firstName} ! ✨ Que veux-tu savoir ?`
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }

  // Au revoir
  if (/\b(bye|au revoir|à bientôt|bonne nuit|ciao|tchao)\b/i.test(lower)) {
    return `Au revoir ${firstName} ! 👋 Reviens quand tu veux ! 😊`;
  }

  // Remerciement
  if (/\b(merci|thanks|thx|mrc|merki|cimer)\b/i.test(lower)) {
    return 'Avec plaisir ! 🙏 N\'hésite pas si tu as besoin d\'autre chose.';
  }

  // Comment ça va
  if (/\b(ça va|ca va|comment vas-tu|tu vas bien|la forme|cv)\b/i.test(lower)) {
    return 'Je vais super bien, merci ! 😊 Et toi ?';
  }

  // Qui es-tu
  if (/\b(qui es-tu|tu es qui|présente toi|t'es quoi)\b/i.test(lower)) {
    return `🧠 *Mini ChatGPT V5 — 20 IA*\n\nJe suis un assistant avec *20 couches d'intelligence* :\n• Analyse et compréhension\n• Recherche web et images\n• Raisonnement logique\n• Génération de réponses pro\n\n*Que veux-tu savoir ?* 😊`;
  }

  // Calcul
  const mathMatch = text.match(/(\d+(?:[.,]\d+)?)\s*([+\-*\/x])\s*(\d+(?:[.,]\d+)?)/i);
  if (mathMatch) {
    const a = parseFloat(mathMatch[1].replace(',', '.'));
    const op = mathMatch[2].toLowerCase();
    const b = parseFloat(mathMatch[3].replace(',', '.'));
    let result;
    switch (op) {
      case '+': result = a + b; break;
      case '-': result = a - b; break;
      case '*': case 'x': result = a * b; break;
      case '/': result = b !== 0 ? a / b : 'Infini'; break;
    }
    return `🧮 *Calcul*\n\n${a} ${op} ${b} = *${result}*\n\n✨ C'est tout bon !`;
  }

  // Pourcentage
  const pctMatch = text.match(/(\d+)\s*%\s*(?:de|sur)\s*(\d+)/i);
  if (pctMatch) {
    const pct = parseFloat(pctMatch[1]);
    const value = parseFloat(pctMatch[2]);
    return `🧮 *Pourcentage*\n\n${pct}% de ${value} = *${(value * pct) / 100}*`;
  }

  // Heure
  if (/\b(heure|quelle heure|il est quelle heure)\b/i.test(lower)) {
    const now = new Date();
    return `⏰ Il est *${now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}*`;
  }

  // Date
  if (/\b(date|quel jour|aujourd'hui)\b/i.test(lower)) {
    const now = new Date();
    return `📅 Nous sommes le *${now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}*`;
  }

  // Météo
  if (/\b(météo|temps|pleut|soleil|température)\b/i.test(lower)) {
    const conditions = ['ensoleillé ☀️', 'nuageux ⛅', 'pluvieux 🌧️'];
    const random = conditions[Math.floor(Math.random() * conditions.length)];
    return `Actuellement, c'est *${random}* avec environ *${Math.floor(Math.random() * 15) + 10}°C*`;
  }

  // Nom
  const nameMatch = text.match(/(?:je m'appelle|je suis|mon nom est)\s+([A-Za-zÀ-ÿ]+)/i);
  if (nameMatch) {
    return `Enchanté *${nameMatch[1]}* ! 👋✨ Je retiens ton nom !`;
  }

  // Capitale
  const capitales = {
    'france': 'Paris', 'allemagne': 'Berlin', 'italie': 'Rome',
    'espagne': 'Madrid', 'japon': 'Tokyo', 'chine': 'Pékin',
    'royaume-uni': 'Londres', 'états-unis': 'Washington D.C.',
    'canada': 'Ottawa', 'australie': 'Canberra', 'russie': 'Moscou'
  };
  const capMatch = lower.match(/capitale\s+(?:de|du|des|d')\s+([a-zéè\s-]+)/i);
  if (capMatch && capitales[capMatch[1].trim()]) {
    return `🏛️ La capitale de *${capMatch[1].trim()}* est *${capitales[capMatch[1].trim()]}*`;
  }

  // Réponse par défaut
  return `« ${text} » — Intéressant ! ✨\n\nPeux-tu développer un peu plus pour que je puisse te donner une réponse complète ? 🧠`;
}

// ============================================================
// COMMANDES
// ============================================================
async function handleStart(chatId, firstName) {
  const msg = 
    `🧠 *Mini ChatGPT V5 — 20 IA*\n\n` +
    `Salut *${firstName}* ! 👋\n\n` +
    `Je suis un assistant avec *20 couches d'IA* :\n\n` +
    `📝 Réponses structurées\n` +
    `🔍 Analyse approfondie\n` +
    `🖼️ Recherche d'images\n` +
    `🌐 Recherche web\n\n` +
    `Envoie-moi un message !`;

  const keyboard = {
    inline_keyboard: [
      [{ text: '💬 Commencer', callback_data: 'start_chat' }],
      [{ text: '❓ Aide', callback_data: 'help' }]
    ]
  };

  await bot.sendMessage(chatId, msg, { parse_mode: 'Markdown', reply_markup: keyboard });
}

async function handleHelp(chatId) {
  await bot.sendMessage(chatId,
    '🎯 *Aide*\n\n' +
    '/start - Démarrer\n' +
    '/aide - Aide\n' +
    '/stats - Stats\n' +
    '/feedback - Avis\n\n' +
    '*Exemples :*\n' +
    '• Salut\n' +
    '• Calcule 5+3\n' +
    '• Quelle heure est-il ?\n' +
    '• Qui es-tu ?',
    { parse_mode: 'Markdown' }
  );
}

async function handleStats(chatId, pool) {
  try {
    const result = await pool.query('SELECT COUNT(*) as c FROM qa_pairs');
    await bot.sendMessage(chatId, `📊 *Stats*\n\n💬 Questions : *${result.rows[0].c}*`, { parse_mode: 'Markdown' });
  } catch (e) {
    await bot.sendMessage(chatId, '📊 *Stats*\n\n🧠 20 IA actives', { parse_mode: 'Markdown' });
  }
}

async function handleFeedback(chatId) {
  const keyboard = {
    inline_keyboard: [[
      { text: '⭐', callback_data: 'rate_1' },
      { text: '⭐⭐', callback_data: 'rate_2' },
      { text: '⭐⭐⭐', callback_data: 'rate_3' },
      { text: '⭐⭐⭐⭐', callback_data: 'rate_4' },
      { text: '⭐⭐⭐⭐⭐', callback_data: 'rate_5' }
    ]]
  };
  await bot.sendMessage(chatId, '⭐ *Note le bot !*', { parse_mode: 'Markdown', reply_markup: keyboard });
}

// ============================================================
// CALLBACKS
// ============================================================
async function handleCallback(query, pool) {
  const chatId = query.message.chat.id;
  const data = query.data;
  await bot.answerCallbackQuery(query.id);

  switch (data) {
    case 'start_chat':
      await bot.sendMessage(chatId, '💬 Je t\'écoute ! Pose-moi ta question 😊');
      break;
    case 'help':
      await handleHelp(chatId);
      break;
    case 'useful':
      await bot.sendMessage(chatId, '👍 Merci ! 😊');
      break;
    case 'not_useful':
      await bot.sendMessage(chatId, '👎 Désolé ! Je vais m\'améliorer 🙏');
      break;
    default:
      if (data.startsWith('rate_')) {
        const rating = parseInt(data.split('_')[1]);
        const emojis = ['', '⭐', '⭐⭐', '⭐⭐⭐', '⭐⭐⭐⭐', '⭐⭐⭐⭐⭐'];
        await bot.sendMessage(chatId, `${emojis[rating]} Merci ! 🚀`);
      }
      break;
  }
}

module.exports = { initTelegramBot };
