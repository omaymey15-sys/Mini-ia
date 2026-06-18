const TelegramBot = require('node-telegram-bot-api');

let bot = null;

// ============================================================
// INITIALISATION DU BOT (SANS CRÉER DE SERVEUR SÉPARÉ)
// ============================================================
async function initTelegramBot(app, pool) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.log('⚠️ TELEGRAM_BOT_TOKEN non défini');
    return;
  }

  const webhookUrl = process.env.TELEGRAM_WEBHOOK_URL;
  
  // TOUJOURS utiliser le mode webhook (pas de serveur séparé)
  bot = new TelegramBot(token);
  
  if (webhookUrl) {
    await bot.setWebHook(webhookUrl);
    console.log(`✅ Webhook Telegram configuré: ${webhookUrl}`);
  } else {
    console.log('⚠️ Mode polling (développement)');
    await bot.startPolling();
  }

  global.telegramBot = bot;

  // ============================================================
  // GESTION DES MESSAGES
  // ============================================================
  bot.on('message', async (msg) => {
    try {
      await handleMessage(msg, pool);
    } catch (error) {
      console.error('❌ Erreur message:', error.message);
      try {
        await bot.sendMessage(msg.chat.id, '😅 Une erreur est survenue. Réessaie !');
      } catch (e) {}
    }
  });

  // ============================================================
  // GESTION DES CALLBACKS (BOUTONS)
  // ============================================================
  bot.on('callback_query', async (query) => {
    try {
      await handleCallback(query, pool);
    } catch (error) {
      console.error('❌ Erreur callback:', error.message);
      await bot.answerCallbackQuery(query.id, { text: 'OK' });
    }
  });

  // Gérer les erreurs de polling
  bot.on('polling_error', (error) => {
    console.error('❌ Erreur polling:', error.message);
  });

  // Gérer les erreurs webhook
  bot.on('webhook_error', (error) => {
    console.error('❌ Erreur webhook:', error.message);
  });

  console.log('🤖 Bot Telegram 20 IA prêt !');
}

// ============================================================
// GESTION DES MESSAGES
// ============================================================
async function handleMessage(msg, pool) {
  const chatId = msg.chat.id;
  const text = msg.text;
  const userId = msg.from.id;
  const firstName = msg.from.first_name || 'ami';
  const lastName = msg.from.last_name || '';
  const username = msg.from.username || '';

  if (!text) return;

  console.log(`📩 [${firstName}] : "${text.substring(0, 80)}"`);

  // Ignorer les messages de groupe sans mention du bot
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
    await sendWelcomeMessage(chatId, firstName);
    await saveUser(pool, userId, firstName, lastName, username);
    return;
  }

  if (text === '/aide' || text === '/help') {
    await sendHelpMessage(chatId);
    return;
  }

  if (text === '/stats') {
    await sendStatsMessage(chatId, pool);
    return;
  }

  if (text === '/feedback' || text === '/avis') {
    await sendFeedbackPrompt(chatId);
    return;
  }

  // ============================================================
  // MESSAGE NORMAL → TRAITEMENT AVEC LES 20 IA
  // ============================================================
  await bot.sendChatAction(chatId, 'typing');

  try {
    // === APPELER L'ORCHESTRATEUR 20 IA ===
    const IAService = require('./ia-service');
    const iaService = new IAService(pool);
    
    console.log('🧠 Appel des 20 IA...');
    const result = await iaService.processMessage(text, 'telegram-' + chatId, 'telegram');
    console.log(`✅ Réponse en ${result.processingTime}ms`);

    let response = result.finalResponse;

    // Limiter pour Telegram (max 4096 caractères)
    if (response.length > 4000) {
      response = response.substring(0, 3950) + '\n\n_(Suite sur l\'app web)_';
    }

    // Nettoyer pour Markdown
    response = cleanMarkdown(response);

    // Boutons
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
      reply_markup: keyboard,
      disable_web_page_preview: false
    });

    // Si des images trouvées
    if (result.imagesFound > 0) {
      await bot.sendMessage(chatId,
        `🖼️ *${result.imagesFound} images trouvées*\n\n` +
        `🌐 Voir les images : ${process.env.FRONTEND_URL || 'https://omaymey15-sys.github.io/Mini-ia'}`,
        { parse_mode: 'Markdown', disable_web_page_preview: true }
      );
    }

    // Sauvegarder
    await saveInteraction(pool, question, response, result);

  } catch (iaError) {
    console.error('❌ Erreur 20 IA:', iaError.message);
    console.log('🔄 Fallback intelligent...');
    
    const fallback = generateFallbackResponse(text, firstName);
    await bot.sendMessage(chatId, fallback, { parse_mode: 'Markdown' });
  }

  await saveUser(pool, userId, firstName, lastName, username);
}

// ============================================================
// FALLBACK INTELLIGENT (si l'IA échoue)
// ============================================================
function generateFallbackResponse(text, firstName) {
  const lower = text.toLowerCase().trim();

  // Salutations
  if (/^(bonjour|salut|hello|coucou|yo|wesh|bonsoir|bjr|slt|hey|cc)\b/i.test(lower)) {
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir';
    return `${greeting} ${firstName} ! 👋 Comment puis-je t'aider ?`;
  }

  // Au revoir
  if (/\b(bye|au revoir|à bientôt|ciao|bonne nuit)\b/i.test(lower)) {
    return `Au revoir ${firstName} ! 👋 Reviens quand tu veux ! 😊`;
  }

  // Remerciement
  if (/\b(merci|thanks|thx|mrc)\b/i.test(lower)) {
    return 'Avec plaisir ! 🙏 N\'hésite pas si tu as besoin d\'autre chose.';
  }

  // Comment ça va
  if (/\b(ça va|ca va|comment vas-tu|la forme|cv)\b/i.test(lower)) {
    return 'Je vais super bien, merci ! 😊 Et toi ?';
  }

  // Qui es-tu
  if (/\b(qui es-tu|tu es qui|présente toi|t'es quoi)\b/i.test(lower)) {
    return `🧠 *Mini ChatGPT V5 — 20 IA*\n\nJe suis un assistant avec *20 couches d'intelligence* !\n\n✨ *Ce que je peux faire :*\n• 💬 Discuter\n• 📝 Rédiger\n• 🔍 Analyser\n• 🖼️ Images\n• 🧮 Calculs\n\n*Que veux-tu savoir ?* 😊`;
  }

  // Calcul
  const mathMatch = text.match(/(\d+)\s*([+\-*\/x])\s*(\d+)/i);
  if (mathMatch) {
    const a = parseFloat(mathMatch[1]);
    const op = mathMatch[2];
    const b = parseFloat(mathMatch[3]);
    let result;
    switch (op) { case '+': result = a + b; break; case '-': result = a - b; break; case '*': case 'x': result = a * b; break; case '/': result = b !== 0 ? a / b : 'Infini'; break; }
    return `🧮 ${a} ${op} ${b} = *${result}*`;
  }

  // Heure
  if (/\b(heure|quelle heure)\b/i.test(lower)) {
    return `⏰ *${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}*`;
  }

  // Date
  if (/\b(date|quel jour|aujourd'hui)\b/i.test(lower)) {
    return `📅 *${new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}*`;
  }

  // Météo
  if (/\b(météo|temps|pleut|soleil)\b/i.test(lower)) {
    const c = ['ensoleillé ☀️', 'nuageux ⛅', 'pluvieux 🌧️'];
    return `${c[Math.floor(Math.random()*3)]}, ${Math.floor(Math.random()*15)+10}°C`;
  }

  // Capitale
  const capitales = { 'france': 'Paris', 'allemagne': 'Berlin', 'italie': 'Rome', 'espagne': 'Madrid', 'japon': 'Tokyo', 'chine': 'Pékin' };
  const capMatch = lower.match(/capitale\s+(?:de|du|des|d')\s+([a-zéè\s-]+)/i);
  if (capMatch && capitales[capMatch[1].trim()]) {
    return `🏛️ La capitale de *${capMatch[1].trim()}* est *${capitales[capMatch[1].trim()]}*`;
  }

  // Défaut
  return `« ${text} » — Intéressant ! ✨ Peux-tu développer ?`;
}

// ============================================================
// COMMANDES
// ============================================================
async function sendWelcomeMessage(chatId, firstName) {
  const msg = `🧠 *Mini ChatGPT V5 — 20 IA*\n\nSalut *${firstName}* ! 👋\n\nJe suis un assistant avec *20 couches d'IA* !\n\n✨ Envoie un message et les 20 IA se mettent au travail !`;

  const keyboard = {
    inline_keyboard: [
      [{ text: '💬 Commencer', callback_data: 'start_chat' }, { text: '❓ Aide', callback_data: 'help' }],
      [{ text: '📊 Stats', callback_data: 'stats' }, { text: '⭐ Noter', callback_data: 'feedback' }]
    ]
  };

  await bot.sendMessage(chatId, msg, { parse_mode: 'Markdown', reply_markup: keyboard });
}

async function sendHelpMessage(chatId) {
  await bot.sendMessage(chatId,
    '🎯 *Aide*\n\n`/start` - Démarrer\n`/aide` - Aide\n`/stats` - Stats\n`/feedback` - Avis\n\n*Exemples :*\n• Salut\n• Calcule 5+3\n• Qui es-tu ?\n• Explique-moi la photosynthèse',
    { parse_mode: 'Markdown' }
  );
}

async function sendStatsMessage(chatId, pool) {
  try {
    const r = await pool.query('SELECT COUNT(*) as c FROM qa_pairs');
    await bot.sendMessage(chatId, `📊 *Stats*\n\n💬 Questions : *${r.rows[0].c}*\n🧠 IA : *20 couches*`, { parse_mode: 'Markdown' });
  } catch (e) {
    await bot.sendMessage(chatId, '📊 *Stats*\n\n🧠 20 IA actives', { parse_mode: 'Markdown' });
  }
}

async function sendFeedbackPrompt(chatId) {
  const keyboard = {
    inline_keyboard: [[
      { text: '⭐', callback_data: 'rate_1' },
      { text: '⭐⭐', callback_data: 'rate_2' },
      { text: '⭐⭐⭐', callback_data: 'rate_3' },
      { text: '⭐⭐⭐⭐', callback_data: 'rate_4' },
      { text: '⭐⭐⭐⭐⭐', callback_data: 'rate_5' }
    ]]
  };
  await bot.sendMessage(chatId, '⭐ *Note les 20 IA !*', { parse_mode: 'Markdown', reply_markup: keyboard });
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
      await bot.sendMessage(chatId, '💬 Je t\'écoute ! Pose ta question 🧠');
      break;
    case 'help':
      await sendHelpMessage(chatId);
      break;
    case 'stats':
      await sendStatsMessage(chatId, pool);
      break;
    case 'feedback':
      await sendFeedbackPrompt(chatId);
      break;
    case 'useful':
      await bot.sendMessage(chatId, '👍 Merci ! 😊');
      break;
    case 'not_useful':
      await bot.sendMessage(chatId, '👎 Désolé ! On s\'améliore 🙏');
      break;
    case 'regenerate':
      await bot.sendMessage(chatId, '🔄 Renvoie ton message !');
      break;
    default:
      if (data.startsWith('rate_')) {
        const r = parseInt(data.split('_')[1]);
        const e = ['', '⭐', '⭐⭐', '⭐⭐⭐', '⭐⭐⭐⭐', '⭐⭐⭐⭐⭐'];
        await bot.sendMessage(chatId, `${e[r]} Merci ! 🚀`);
      }
      break;
  }
}

// ============================================================
// UTILITAIRES
// ============================================================
function cleanMarkdown(text) {
  return text.replace(/(?<!\\)\[/g, '\\[').replace(/(?<!\\)\]/g, '\\]');
}

async function saveUser(pool, userId, firstName, lastName, username) {
  try {
    await pool.query(
      `INSERT INTO telegram_users (telegram_id, first_name, last_name, username, last_interaction)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (telegram_id) DO UPDATE 
       SET first_name = $2, last_name = $3, username = $4, last_interaction = NOW()`,
      [userId, firstName, lastName, username]
    );
  } catch (e) {}
}

async function saveInteraction(pool, question, answer, result) {
  try {
    await pool.query(
      `INSERT INTO qa_pairs (question, answer, intent, sentiment, source, search_performed, images_found, processing_time)
       VALUES ($1, $2, $3, $4, 'telegram', $5, $6, $7)`,
      [
        question,
        answer,
        result.analysis?.intent || 'conversation',
        result.analysis?.sentiment || 'neutre',
        result.searchPerformed || false,
        result.imagesFound || 0,
        result.processingTime || 0
      ]
    );
  } catch (e) {}
}

module.exports = { initTelegramBot };
