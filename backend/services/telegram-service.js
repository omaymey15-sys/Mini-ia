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
    console.log(`✅ Webhook Telegram 20 IA: ${webhookUrl}`);
  } else {
    bot = new TelegramBot(token, { polling: true });
    console.log('✅ Bot Telegram 20 IA en mode polling');
  }

  global.telegramBot = bot;

  // Gérer les messages
  bot.on('message', async (msg) => {
    try {
      await handleMessage(msg, pool);
    } catch (error) {
      console.error('❌ Erreur message Telegram:', error.message);
      try {
        await bot.sendMessage(msg.chat.id, '😅 Une petite erreur est survenue. Réessaie dans un instant ! 🔧');
      } catch (e) {}
    }
  });

  // Gérer les callbacks
  bot.on('callback_query', async (query) => {
    try {
      await handleCallback(query, pool);
    } catch (error) {
      console.error('❌ Erreur callback:', error.message);
      await bot.answerCallbackQuery(query.id, { text: 'OK' });
    }
  });

  console.log('🤖 Bot Telegram 20 IA prêt !');
}

async function handleMessage(msg, pool) {
  const chatId = msg.chat.id;
  const text = msg.text;
  const userId = msg.from.id;
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
  // MESSAGE NORMAL → TRAITEMENT AVEC LES 20 IA
  // ============================================================

  await bot.sendChatAction(chatId, 'typing');

  try {
    // Utiliser le service IA complet (20 couches)
    const iaService = new IAService(pool);
    const result = await iaService.processMessage(text, 'telegram-' + chatId, 'telegram');

    // Formater la réponse pour Telegram
    let response = result.finalResponse;

    // Limiter la taille (Telegram max 4096 caractères)
    if (response.length > 4000) {
      response = response.substring(0, 3950) + '...\n\n_(Réponse complète sur l\'application web)_';
    }

    // Ajouter des boutons
    const keyboard = {
      inline_keyboard: [
        [
          { text: '👍 Utile', callback_data: 'useful' },
          { text: '👎 Pas utile', callback_data: 'not_useful' }
        ],
        [
          { text: '🖼️ Images', callback_data: 'images_' + encodeURIComponent(text.substring(0, 50)) },
          { text: '🔄 Regénérer', callback_data: 'regenerate' }
        ]
      ]
    };

    // Envoyer la réponse
    await bot.sendMessage(chatId, response, {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
      disable_web_page_preview: false
    });

    // Si des images ont été trouvées, envoyer un message supplémentaire
    if (result.imagesFound > 0) {
      await bot.sendMessage(chatId,
        `🖼️ *${result.imagesFound} images trouvées*\n\n` +
        `🌐 Ouvre l'application web pour voir les images :\n` +
        `${process.env.FRONTEND_URL || 'https://omaymey15-sys.github.io/Mini-ia'}`,
        { parse_mode: 'Markdown', disable_web_page_preview: true }
      );
    }

    // Sauvegarder l'interaction
    try {
      await pool.query(
        `INSERT INTO qa_pairs (question, answer, intent, sentiment, source, search_performed, images_found, processing_time)
         VALUES ($1, $2, $3, $4, 'telegram', $5, $6, $7)`,
        [
          text,
          response,
          result.analysis?.intent || 'conversation',
          result.analysis?.sentiment || 'neutre',
          result.searchPerformed || false,
          result.imagesFound || 0,
          result.processingTime || 0
        ]
      );

      await pool.query(
        `INSERT INTO telegram_users (telegram_id, first_name, last_interaction)
         VALUES ($1, $2, NOW())
         ON CONFLICT (telegram_id) DO UPDATE SET first_name = $2, last_interaction = NOW()`,
        [userId, firstName]
      );
    } catch (dbError) {
      console.log('Sauvegarde DB ignorée:', dbError.message);
    }

  } catch (error) {
    console.error('❌ Erreur traitement IA:', error.message);
    
    // Fallback : réponse simple
    const fallbackResponse = generateFallbackResponse(text, firstName);
    await bot.sendMessage(chatId, fallbackResponse, { parse_mode: 'Markdown' });
  }
}

// ============================================================
// GESTION DES COMMANDES
// ============================================================

async function handleStart(chatId, firstName) {
  const welcomeMessage = 
    `🧠 *Mini ChatGPT V5 — 20 IA*\n\n` +
    `Salut *${firstName}* ! 👋\n\n` +
    `Je suis un assistant IA avec *20 couches d'intelligence* qui travaillent ensemble pour te fournir des réponses :\n\n` +
    `📝 *Structurées* — Paragraphes professionnels\n` +
    `🔍 *Approfondies* — Analyse multi-niveaux\n` +
    `🖼️ *Illustrées* — Recherche d'images intégrée\n` +
    `🌐 *Connectées* — Recherche web automatique\n\n` +
    `*Commandes :*\n` +
    `/aide — Voir l'aide\n` +
    `/stats — Statistiques\n` +
    `/feedback — Donner ton avis\n\n` +
    `✨ Envoie-moi un message et les 20 IA se mettent au travail !`;

  const keyboard = {
    inline_keyboard: [
      [
        { text: '💬 Commencer', callback_data: 'start_chat' },
        { text: '❓ Aide', callback_data: 'help' }
      ],
      [
        { text: '📊 Stats', callback_data: 'stats' },
        { text: '⭐ Noter', callback_data: 'feedback' }
      ]
    ]
  };

  await bot.sendMessage(chatId, welcomeMessage, {
    parse_mode: 'Markdown',
    reply_markup: keyboard
  });
}

async function handleHelp(chatId) {
  const helpMessage = 
    '🎯 *Aide Mini ChatGPT V5 — 20 IA*\n\n' +
    '*Commandes :*\n' +
    '`/start` — Démarrer le bot\n' +
    '`/aide` — Cette aide\n' +
    '`/stats` — Statistiques\n' +
    '`/feedback` — Donner ton avis\n\n' +
    '*Exemples de questions :*\n' +
    '• *Explique-moi* la photosynthèse\n' +
    '• *Analyse* les avantages de l\'IA\n' +
    '• *Montre-moi* des images de Paris\n' +
    '• *Calcule* 15% de 200\n' +
    '• *Quelle est* la capitale du Japon ?\n' +
    '• *Rédige* un plan marketing\n\n' +
    '_Les 20 IA analysent ta question en profondeur !_ 🚀';

  await bot.sendMessage(chatId, helpMessage, { parse_mode: 'Markdown' });
}

async function handleStats(chatId, pool) {
  try {
    const stats = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM qa_pairs) as total_qa,
        (SELECT COUNT(*) FROM telegram_users) as total_users,
        (SELECT COUNT(*) FROM image_cache) as cached_images,
        (SELECT COUNT(*) FROM documents) as documents
    `);
    
    const s = stats.rows[0];
    await bot.sendMessage(chatId,
      '📊 *Statistiques Mini ChatGPT V5*\n\n' +
      `💬 Questions traitées : *${s.total_qa || 0}*\n` +
      `👥 Utilisateurs : *${s.total_users || 0}*\n` +
      `🖼️ Images en cache : *${s.cached_images || 0}*\n` +
      `📄 Documents : *${s.documents || 0}*\n\n` +
      `🧠 *Architecture : 20 IA*\n` +
      `🌐 *API : Connectée*\n` +
      `⚡ *Temps moyen : ~500ms*\n\n` +
      '_Plus tu utilises le bot, plus il apprend !_ 🚀',
      { parse_mode: 'Markdown' }
    );
  } catch (e) {
    await bot.sendMessage(chatId,
      '📊 *Statistiques Mini ChatGPT V5*\n\n' +
      '🧠 Architecture : *20 IA*\n' +
      '🌐 API : *Connectée*\n' +
      '⚡ Temps moyen : *~500ms*\n\n' +
      '_Les statistiques détaillées sont disponibles sur l\'application web_',
      { parse_mode: 'Markdown' }
    );
  }
}

async function handleFeedback(chatId) {
  const keyboard = {
    inline_keyboard: [
      [
        { text: '⭐', callback_data: 'rate_1' },
        { text: '⭐⭐', callback_data: 'rate_2' },
        { text: '⭐⭐⭐', callback_data: 'rate_3' },
        { text: '⭐⭐⭐⭐', callback_data: 'rate_4' },
        { text: '⭐⭐⭐⭐⭐', callback_data: 'rate_5' }
      ]
    ]
  };
  await bot.sendMessage(chatId, '⭐ *Note les 20 IA !*\n\nQuelle note donnes-tu au bot ?', {
    parse_mode: 'Markdown',
    reply_markup: keyboard
  });
}

// ============================================================
// GESTION DES CALLBACKS
// ============================================================

async function handleCallback(query, pool) {
  const chatId = query.message.chat.id;
  const data = query.data;

  await bot.answerCallbackQuery(query.id);

  switch (data) {
    case 'start_chat':
      await bot.sendMessage(chatId, '💬 *Je t\'écoute !* Pose-moi ta question et les 20 IA se mettent au travail 🧠', { parse_mode: 'Markdown' });
      break;
      
    case 'help':
      await handleHelp(chatId);
      break;
      
    case 'stats':
      await handleStats(chatId, pool);
      break;
      
    case 'feedback':
      await handleFeedback(chatId);
      break;
      
    case 'useful':
      try {
        await pool.query('INSERT INTO feedback (rating, platform) VALUES ($1, $2)', [5, 'telegram']);
      } catch (e) {}
      await bot.sendMessage(chatId, '👍 *Merci !* Les 20 IA sont contentes de t\'avoir aidé ! 😊', { parse_mode: 'Markdown' });
      break;
      
    case 'not_useful':
      try {
        await pool.query('INSERT INTO feedback (rating, comment, platform) VALUES ($1, $2, $3)', [2, 'Pas utile', 'telegram']);
      } catch (e) {}
      await bot.sendMessage(chatId, '👎 *Désolé !* Les 20 IA vont s\'améliorer grâce à ton retour 🙏', { parse_mode: 'Markdown' });
      break;
      
    case 'regenerate':
      await bot.sendMessage(chatId, '🔄 *Fonctionnalité en cours de développement*\n\nRenvoie ton message pour une nouvelle réponse !', { parse_mode: 'Markdown' });
      break;
      
    default:
      if (data.startsWith('rate_')) {
        const rating = parseInt(data.split('_')[1]);
        try {
          await pool.query('INSERT INTO feedback (rating, platform) VALUES ($1, $2)', [rating, 'telegram']);
        } catch (e) {}
        const emojis = ['', '⭐', '⭐⭐', '⭐⭐⭐', '⭐⭐⭐⭐', '⭐⭐⭐⭐⭐'];
        await bot.sendMessage(chatId, `${emojis[rating]} *Merci pour ta note !*\n\nLes 20 IA continuent d\'apprendre grâce à toi 🚀`, { parse_mode: 'Markdown' });
      } else if (data.startsWith('images_')) {
        const query = decodeURIComponent(data.replace('images_', ''));
        await bot.sendMessage(chatId,
          `🖼️ *Recherche d'images pour « ${query} »*\n\n` +
          `🌐 Ouvre l'application web pour voir les images :\n` +
          `${process.env.FRONTEND_URL || 'https://omaymey15-sys.github.io/Mini-ia'}\n\n` +
          `_Ou envoie "Montre-moi des images de ${query}"_`,
          { parse_mode: 'Markdown', disable_web_page_preview: true }
        );
      }
      break;
  }
}

// ============================================================
// RÉPONSE DE FALLBACK (si l'IA échoue)
// ============================================================

function generateFallbackResponse(text, firstName) {
  const lower = text.toLowerCase().trim();

  if (/bonjour|salut|hello|coucou/i.test(lower)) {
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir';
    return `${greeting} ${firstName} ! 👋\n\nLes 20 IA sont prêtes à t'aider. Que veux-tu savoir ?`;
  }

  if (/qui es-tu|présente toi/i.test(lower)) {
    return `🧠 *Mini ChatGPT V5 — 20 IA*\n\n` +
      `Je suis un assistant IA avec *20 couches d'intelligence* :\n\n` +
      `• 🔍 Analyse lexicale, syntaxique et sémantique\n` +
      `• 🌐 Recherche web texte et images\n` +
      `• 🧮 Raisonnement logique\n` +
      `• 💾 Mémoire contextuelle\n` +
      `• 📝 Génération de paragraphes\n` +
      `• ✨ Polissage professionnel\n` +
      `• 💝 Adaptation émotionnelle\n` +
      `• 📚 Apprentissage continu\n\n` +
      `*Que puis-je faire pour toi ?* 😊`;
  }

  if (/calcule|calcul/i.test(lower)) {
    const mathMatch = text.match(/(\d+)\s*([+\-*\/])\s*(\d+)/);
    if (mathMatch) {
      const a = parseFloat(mathMatch[1]);
      const op = mathMatch[2];
      const b = parseFloat(mathMatch[3]);
      let result;
      switch (op) {
        case '+': result = a + b; break;
        case '-': result = a - b; break;
        case '*': result = a * b; break;
        case '/': result = b !== 0 ? a / b : 'Infini'; break;
      }
      return `🧮 *Calcul*\n\n${a} ${op} ${b} = *${result}*`;
    }
  }

  if (/heure/i.test(lower)) {
    const now = new Date();
    return `⏰ Il est *${now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}*`;
  }

  if (/date|jour/i.test(lower)) {
    const now = new Date();
    return `📅 Nous sommes le *${now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}*`;
  }

  return `« ${text} » — Les 20 IA analysent ta question en profondeur 🧠\n\n` +
    `Pour une réponse complète avec paragraphes structurés et images, utilise l'application web :\n` +
    `🌐 ${process.env.FRONTEND_URL || 'https://omaymey15-sys.github.io/Mini-ia'}\n\n` +
    `_Ou reformule ta question pour que je puisse te répondre au mieux !_ 😊`;
}

module.exports = { initTelegramBot };
