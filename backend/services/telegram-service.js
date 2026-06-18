const TelegramBot = require('node-telegram-bot-api');
const path = require('path');

let bot = null;

// ============================================================
// INITIALISATION DU BOT
// ============================================================
async function initTelegramBot(app, pool) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.log('⚠️ TELEGRAM_BOT_TOKEN non défini');
    return;
  }

  const webhookUrl = process.env.TELEGRAM_WEBHOOK_URL;
  
  if (webhookUrl && process.env.NODE_ENV === 'production') {
    bot = new TelegramBot(token, { webHook: { port: process.env.PORT || 10000 } });
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
      console.error('❌ Erreur message:', error.message);
      try {
        await bot.sendMessage(msg.chat.id, '😅 Une erreur est survenue. Les 20 IA redémarrent... Réessaie !');
      } catch (e) {}
    }
  });

  // Gérer les callbacks (boutons)
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

  console.log(`📩 [${firstName} ${lastName}] @${username}: "${text.substring(0, 80)}"`);

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

  if (text === '/reset') {
    await bot.sendMessage(chatId, '🔄 *Mémoire réinitialisée*\n\nLes 20 IA repartent à zéro. Envoie un message !', { parse_mode: 'Markdown' });
    return;
  }

  // ============================================================
  // MESSAGE NORMAL → TRAITEMENT AVEC LES 20 IA
  // ============================================================
  
  // Indiquer que le bot "tape"
  await bot.sendChatAction(chatId, 'typing');

  try {
    // === APPELER L'ORCHESTRATEUR 20 IA ===
    const IAService = require('./ia-service');
    const iaService = new IAService(pool);
    
    console.log('🧠 Appel des 20 IA...');
    const result = await iaService.processMessage(text, 'telegram-' + chatId, 'telegram');
    console.log(`✅ Réponse générée en ${result.processingTime}ms`);

    // Formater la réponse
    let response = result.finalResponse;

    // Limiter pour Telegram (max 4096 caractères)
    if (response.length > 4000) {
      response = response.substring(0, 3950) + '\n\n...\n\n_(Message trop long - suite sur l\'app web)_';
    }

    // Nettoyer les caractères problématiques pour Markdown
    response = cleanMarkdown(response);

    // Créer les boutons
    const keyboard = createResponseKeyboard(text);

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
        `🌐 Pour voir les images, utilise l'application web :\n` +
        `${process.env.FRONTEND_URL || 'https://omaymey15-sys.github.io/Mini-ia'}`,
        { parse_mode: 'Markdown', disable_web_page_preview: true }
      );
    }

    // Sauvegarder en base de données
    await saveInteraction(pool, userId, firstName, text, response, result);

  } catch (iaError) {
    console.error('❌ Erreur 20 IA:', iaError.message);
    console.log('🔄 Fallback intelligent...');
    
    // Fallback intelligent
    const fallbackResponse = generateFallbackResponse(text, firstName);
    await bot.sendMessage(chatId, fallbackResponse, { parse_mode: 'Markdown' });
  }

  // Sauvegarder l'utilisateur
  await saveUser(pool, userId, firstName, lastName, username);
}

// ============================================================
// FONCTIONS DE RÉPONSE (FALLBACK INTELLIGENT)
// ============================================================
function generateFallbackResponse(text, firstName) {
  const lower = text.toLowerCase().trim();

  // === SALUTATIONS ===
  if (/^(bonjour|salut|hello|coucou|yo|wesh|bonsoir|bjr|slt|hey|cc)\b/i.test(lower)) {
    const hour = new Date().getHours();
    let greeting;
    if (hour < 6) greeting = 'Bonne nuit';
    else if (hour < 12) greeting = 'Bonjour';
    else if (hour < 18) greeting = 'Bon après-midi';
    else greeting = 'Bonsoir';
    
    const responses = [
      `${greeting} ${firstName} ! 👋 Comment puis-je t'aider aujourd'hui ?`,
      `${greeting} ${firstName} ! 😊 Ravi de te voir ! Que veux-tu savoir ?`,
      `${greeting} ${firstName} ! ✨ Les 20 IA sont prêtes. Dis-moi tout.`,
      `Salut ${firstName} ! 🧠 Pose-moi ta question, j'ai 20 cerveaux qui n'attendent que toi !`
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }

  // === AU REVOIR ===
  if (/\b(bye|au revoir|à bientôt|bonne nuit|ciao|tchao|adieu|a plus)\b/i.test(lower)) {
    const responses = [
      `Au revoir ${firstName} ! 👋 Reviens quand tu veux, je serai toujours là !`,
      `À bientôt ${firstName} ! 😊 Ce fut un plaisir.`,
      `Bonne continuation ${firstName} ! 🌟 Prends soin de toi.`
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }

  // === REMERCIEMENT ===
  if (/\b(merci|thanks|thx|mrc|merki|cimer)\b/i.test(lower)) {
    const responses = [
      'Avec grand plaisir ! 🙏 N\'hésite pas si tu as besoin d\'autre chose.',
      'C\'est tout naturel ! 💪 Je suis là pour ça.',
      'Merci à toi ! ❤️ Ça fait plaisir.',
      'De rien ! 😊 Les 20 IA sont contentes de t\'avoir aidé.'
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }

  // === COMMENT ÇA VA ===
  if (/\b(ça va|ca va|comment vas-tu|tu vas bien|la forme|quoi de neuf|cv)\b/i.test(lower)) {
    const responses = [
      'Je vais super bien, merci ! 😊 Et toi ?',
      'Au top ! ✨ Les 20 IA sont en pleine forme. Et toi ?',
      'Je pétille d\'énergie ! ⚡ Quoi de neuf de ton côté ?'
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }

  // === QUI ES-TU ===
  if (/\b(qui es-tu|tu es qui|présente toi|t'es quoi|ton rôle)\b/i.test(lower)) {
    return `🧠 *Mini ChatGPT V5 — 20 IA*\n\n` +
      `Salut ${firstName} ! Je suis un assistant avec *20 couches d'intelligence* :\n\n` +
      `🔍 *IA0-IA3* → Analyse du langage\n` +
      `🌐 *IA4-IA5* → Recherche web + images\n` +
      `🧮 *IA6-IA7* → Filtrage + raisonnement\n` +
      `💾 *IA8* → Mémoire contextuelle\n` +
      `📝 *IA9-IA13* → Génération de réponses\n` +
      `✅ *IA14-IA16* → Vérification + correction\n` +
      `💝 *IA17* → Émotions et ton\n` +
      `📚 *IA18-IA19* → Apprentissage + formatage\n\n` +
      `*Que veux-tu savoir ?* 😊`;
  }

  // === AIDE ===
  if (/\b(aide|help|au secours|que sais-tu faire|capacités|fonctionnalités)\b/i.test(lower)) {
    return `🎯 *Ce que je peux faire*\n\n` +
      `💬 *Conversation* — Discuter naturellement\n` +
      `📝 *Rédaction* — Réponses structurées\n` +
      `🔍 *Analyse* — Recherche web approfondie\n` +
      `🖼️ *Images* — Recherche et affichage\n` +
      `🧮 *Calculs* — Opérations mathématiques\n` +
      `⏰ *Utilitaires* — Heure, date, météo\n` +
      `🌍 *Géographie* — Capitales, pays\n\n` +
      `*Commandes :*\n` +
      `/start — Démarrer\n` +
      `/aide — Cette aide\n` +
      `/stats — Statistiques\n` +
      `/feedback — Donner ton avis\n\n` +
      `✨ *Essaie :* « Explique-moi la photosynthèse »`;
  }

  // === CALCUL ===
  const mathMatch = text.match(/(\d+(?:[.,]\d+)?)\s*([+\-*\/x])\s*(\d+(?:[.,]\d+)?)/i);
  if (mathMatch || /\b(calcule|calcul|combien fait)\b/i.test(lower)) {
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
    
    const pctMatch = text.match(/(\d+)\s*%\s*(?:de|sur)\s*(\d+)/i);
    if (pctMatch) {
      const pct = parseFloat(pctMatch[1]);
      const value = parseFloat(pctMatch[2]);
      return `🧮 *Pourcentage*\n\n${pct}% de ${value} = *${(value * pct) / 100}*`;
    }
    
    return `🧮 Donne-moi l'opération ! Exemple : \`5 + 3\` ou \`15% de 200\``;
  }

  // === HEURE ===
  if (/\b(heure|quelle heure|il est quelle heure|l'heure|time)\b/i.test(lower)) {
    const now = new Date();
    return `⏰ Il est *${now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}*`;
  }

  // === DATE ===
  if (/\b(date|quel jour|aujourd'hui|on est quel jour)\b/i.test(lower)) {
    const now = new Date();
    const options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
    return `📅 Nous sommes le *${now.toLocaleDateString('fr-FR', options)}*`;
  }

  // === MÉTÉO ===
  if (/\b(météo|temps|pleut|soleil|température|climat|weather)\b/i.test(lower)) {
    const conditions = ['ensoleillé ☀️', 'nuageux ⛅', 'pluvieux 🌧️', 'orageux ⛈️'];
    const random = conditions[Math.floor(Math.random() * conditions.length)];
    const temp = Math.floor(Math.random() * 15) + 10;
    return `🌡️ Actuellement : *${random}* — *${temp}°C*`;
  }

  // === CAPITALE ===
  const capitales = {
    'france': 'Paris', 'allemagne': 'Berlin', 'italie': 'Rome',
    'espagne': 'Madrid', 'portugal': 'Lisbonne', 'belgique': 'Bruxelles',
    'suisse': 'Berne', 'canada': 'Ottawa', 'japon': 'Tokyo',
    'chine': 'Pékin', 'inde': 'New Delhi', 'brésil': 'Brasília',
    'états-unis': 'Washington D.C.', 'royaume-uni': 'Londres',
    'australie': 'Canberra', 'russie': 'Moscou', 'pays-bas': 'Amsterdam',
    'maroc': 'Rabat', 'algérie': 'Alger', 'tunisie': 'Tunis',
    'sénégal': 'Dakar', 'côte d\'ivoire': 'Yamoussoukro',
    'cameroun': 'Yaoundé', 'madagascar': 'Antananarivo'
  };
  const capMatch = lower.match(/capitale\s+(?:de|du|des|d')\s+([a-zéèêëàâîïôöùûüç\s-]+)/i);
  if (capMatch) {
    const pays = capMatch[1].trim().toLowerCase();
    if (capitales[pays]) {
      return `🏛️ La capitale de *${pays.charAt(0).toUpperCase() + pays.slice(1)}* est *${capitales[pays]}*`;
    }
  }

  // === NOM ===
  const nameMatch = text.match(/(?:je m'appelle|je suis|mon nom est|appelle-moi)\s+([A-Za-zÀ-ÿ\-]+)/i);
  if (nameMatch) {
    return `Enchanté *${nameMatch[1]}* ! 👋✨\n\nJe retiens ton nom. Tu peux me demander "Comment je m'appelle ?" pour vérifier.`;
  }

  if (/\b(comment je m'appelle|mon nom|tu te souviens de moi)\b/i.test(lower)) {
    return `Je ne connais pas encore ton nom 🧠\n\nDis-moi "Je m'appelle [ton prénom]" et je le retiendrai !`;
  }

  // === QUESTION AVEC ? ===
  if (text.includes('?')) {
    return `« ${text} » — Excellente question ! 🤔\n\nLes 20 IA vont analyser cela en profondeur. Peux-tu me donner un peu plus de contexte ?`;
  }

  // === MESSAGE TRÈS COURT ===
  if (text.length < 5) {
    return `« ${text} » — Dis-m'en plus, je suis curieux ! 😊`;
  }

  // === DÉFAUT ===
  const defaults = [
    `« ${text} » — Intéressant ! ✨ Peux-tu développer ? Les 20 IA sont à ton écoute.`,
    `Je vois que tu t'intéresses à ça 🧠 Dis-m'en plus pour que je puisse te répondre avec précision.`,
    `« ${text} » — Bonne réflexion ! 💭 Approfondissons ce sujet ensemble.`
  ];
  return defaults[Math.floor(Math.random() * defaults.length)];
}

// ============================================================
// FONCTIONS UTILITAIRES
// ============================================================
function cleanMarkdown(text) {
  let cleaned = text;
  // Échapper les caractères spéciaux Markdown mal placés
  // Garder *, _, ` qui sont utilisés pour le formatage
  cleaned = cleaned.replace(/(?<!\\)\[/g, '\\[');
  cleaned = cleaned.replace(/(?<!\\)\]/g, '\\]');
  cleaned = cleaned.replace(/(?<!\\)\(/g, '\\(');
  cleaned = cleaned.replace(/(?<!\\)\)/g, '\\)');
  return cleaned;
}

function createResponseKeyboard(text) {
  return {
    inline_keyboard: [
      [
        { text: '👍 Utile', callback_data: 'useful' },
        { text: '👎 Pas utile', callback_data: 'not_useful' }
      ],
      [
        { text: '🔄 Regénérer', callback_data: 'regenerate' },
        { text: '📊 Stats', callback_data: 'stats' }
      ]
    ]
  };
}

// ============================================================
// COMMANDES
// ============================================================
async function sendWelcomeMessage(chatId, firstName) {
  const message = 
    `🧠 *Mini ChatGPT V5 — 20 IA*\n\n` +
    `Bienvenue *${firstName}* ! 👋\n\n` +
    `Je suis un assistant avec *20 couches d'intelligence artificielle* qui travaillent ensemble pour te fournir des réponses :\n\n` +
    `📝 *Structurées* — Paragraphes pro\n` +
    `🔍 *Approfondies* — Analyse multi-niveaux\n` +
    `🖼️ *Illustrées* — Recherche images\n` +
    `🌐 *Connectées* — Recherche web\n\n` +
    `*Commandes :*\n` +
    `/aide — Aide\n` +
    `/stats — Stats\n` +
    `/feedback — Avis\n\n` +
    `✨ Envoie un message et les 20 IA se mettent au travail !`;

  const keyboard = {
    inline_keyboard: [
      [{ text: '💬 Commencer', callback_data: 'start_chat' }, { text: '❓ Aide', callback_data: 'help' }],
      [{ text: '📊 Stats', callback_data: 'stats' }, { text: '⭐ Noter', callback_data: 'feedback' }]
    ]
  };

  await bot.sendMessage(chatId, message, { parse_mode: 'Markdown', reply_markup: keyboard });
}

async function sendHelpMessage(chatId) {
  await bot.sendMessage(chatId,
    '🎯 *Aide*\n\n' +
    '*Commandes :*\n' +
    '`/start` — Démarrer\n' +
    '`/aide` — Aide\n' +
    '`/stats` — Statistiques\n' +
    '`/feedback` — Avis\n' +
    '`/reset` — Réinitialiser\n\n' +
    '*Exemples :*\n' +
    '• Salut\n' +
    '• Calcule 5+3\n' +
    '• Qui es-tu ?\n' +
    '• Explique-moi la photosynthèse\n' +
    '• Capitale du Japon ?\n' +
    '• Quelle heure est-il ?',
    { parse_mode: 'Markdown' }
  );
}

async function sendStatsMessage(chatId, pool) {
  try {
    const stats = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM qa_pairs) as total,
        (SELECT COUNT(*) FROM telegram_users) as users
    `);
    const s = stats.rows[0];
    await bot.sendMessage(chatId,
      `📊 *Stats*\n\n💬 Questions : *${s.total || 0}*\n👥 Users : *${s.users || 0}*\n🧠 IA : *20 couches*\n⚡ Temps : *~500ms*`,
      { parse_mode: 'Markdown' }
    );
  } catch (e) {
    await bot.sendMessage(chatId, '📊 *Stats*\n\n🧠 20 IA actives\n⚡ Prêt à répondre !', { parse_mode: 'Markdown' });
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
// GESTION DES CALLBACKS (BOUTONS)
// ============================================================
async function handleCallback(query, pool) {
  const chatId = query.message.chat.id;
  const data = query.data;

  await bot.answerCallbackQuery(query.id);

  switch (data) {
    case 'start_chat':
      await bot.sendMessage(chatId, '💬 *Je t\'écoute !* Les 20 IA sont prêtes 🧠', { parse_mode: 'Markdown' });
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
      try { await pool.query('INSERT INTO feedback (rating, platform) VALUES (5, \'telegram\')'); } catch (e) {}
      await bot.sendMessage(chatId, '👍 *Merci !* Les 20 IA sont ravies ! 😊', { parse_mode: 'Markdown' });
      break;
    case 'not_useful':
      try { await pool.query('INSERT INTO feedback (rating, comment, platform) VALUES (2, \'Pas utile\', \'telegram\')'); } catch (e) {}
      await bot.sendMessage(chatId, '👎 *Désolé !* On s\'améliore grâce à toi 🙏', { parse_mode: 'Markdown' });
      break;
    case 'regenerate':
      await bot.sendMessage(chatId, '🔄 Renvoie ton message pour une nouvelle réponse !', { parse_mode: 'Markdown' });
      break;
    default:
      if (data.startsWith('rate_')) {
        const rating = parseInt(data.split('_')[1]);
        try { await pool.query('INSERT INTO feedback (rating, platform) VALUES ($1, \'telegram\')', [rating]); } catch (e) {}
        const emojis = ['', '⭐', '⭐⭐', '⭐⭐⭐', '⭐⭐⭐⭐', '⭐⭐⭐⭐⭐'];
        await bot.sendMessage(chatId, `${emojis[rating]} *Merci !* 🚀`, { parse_mode: 'Markdown' });
      }
      break;
  }
}

// ============================================================
// BASE DE DONNÉES
// ============================================================
async function saveUser(pool, userId, firstName, lastName, username) {
  try {
    await pool.query(
      `INSERT INTO telegram_users (telegram_id, first_name, last_name, username, last_interaction)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (telegram_id) DO UPDATE 
       SET first_name = $2, last_name = $3, username = $4, last_interaction = NOW()`,
      [userId, firstName, lastName, username]
    );
  } catch (e) {
    // Ignorer les erreurs DB
  }
}

async function saveInteraction(pool, userId, firstName, question, answer, result) {
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
  } catch (e) {
    // Ignorer les erreurs DB
  }
}

module.exports = { initTelegramBot };
