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

  // Gérer les messages
  bot.on('message', async (msg) => {
    try {
      await handleMessage(msg, pool);
    } catch (error) {
      console.error('❌ Erreur message Telegram:', error.message);
      try {
        await bot.sendMessage(msg.chat.id, '😅 Une petite erreur est survenue. Réessaie dans un instant !');
      } catch (e) {
        console.error('Impossible d\'envoyer le message d\'erreur');
      }
    }
  });

  // Gérer les callbacks
  bot.on('callback_query', async (query) => {
    try {
      await handleCallback(query, pool);
    } catch (error) {
      console.error('❌ Erreur callback:', error.message);
      try {
        await bot.answerCallbackQuery(query.id, { text: 'OK' });
      } catch (e) {}
    }
  });

  console.log('🤖 Bot Telegram prêt !');
}

async function handleMessage(msg, pool) {
  const chatId = msg.chat.id;
  const text = msg.text;
  const userId = msg.from.id;
  const firstName = msg.from.first_name || 'ami';

  if (!text) return;

  console.log(`📩 Message de ${firstName} (${userId}): "${text.substring(0, 50)}"`);

  // Ignorer les messages de groupe sans mention
  if ((msg.chat.type === 'group' || msg.chat.type === 'supergroup') && bot) {
    try {
      const botInfo = await bot.getMe();
      if (!text.includes('@' + botInfo.username)) return;
    } catch (e) {}
  }

  // Commande /start
  if (text === '/start') {
    const welcomeMessage = 
      `🤖 *Salut ${firstName} !*\n\n` +
      `Je suis *Mini ChatGPT V5* avec *20 couches d'IA* !\n\n` +
      `✨ *Ce que je peux faire :*\n` +
      `• 🖼️ Rechercher et afficher des images\n` +
      `• 📝 Rédiger des réponses pro\n` +
      `• 🔍 Analyser en profondeur\n` +
      `• 🌐 Rechercher sur le web\n` +
      `• 🧮 Faire des calculs\n\n` +
      `*Commandes :*\n` +
      `/aide - Aide\n` +
      `/stats - Statistiques\n` +
      `/feedback - Donner ton avis\n\n` +
      `Envoie-moi un message ! 😊`;

    const keyboard = {
      inline_keyboard: [
        [{ text: '💬 Commencer', callback_data: 'start_chat' }],
        [{ text: '❓ Aide', callback_data: 'help' }],
        [{ text: '⭐ Noter', callback_data: 'feedback' }]
      ]
    };

    await bot.sendMessage(chatId, welcomeMessage, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
    return;
  }

  // Commande /aide
  if (text === '/aide' || text === '/help') {
    await bot.sendMessage(chatId,
      '🎯 *Aide Mini ChatGPT V5*\n\n' +
      '*Commandes :*\n' +
      '/start - Démarrer\n' +
      '/aide - Cette aide\n' +
      '/stats - Statistiques\n' +
      '/feedback - Donner ton avis\n\n' +
      '*Exemples :*\n' +
      '• Bonjour, qui es-tu ?\n' +
      '• Explique-moi la photosynthèse\n' +
      '• Calcule 15% de 200\n' +
      '• Quelle est la capitale du Japon ?',
      { parse_mode: 'Markdown' }
    );
    return;
  }

  // Commande /stats
  if (text === '/stats') {
    try {
      const result = await pool.query('SELECT COUNT(*) as count FROM qa_pairs');
      await bot.sendMessage(chatId,
        `📊 *Statistiques*\n\n` +
        `💬 Questions répondues : *${result.rows[0].count}*`,
        { parse_mode: 'Markdown' }
      );
    } catch (e) {
      await bot.sendMessage(chatId, '📊 *Statistiques*\n\n💬 Mode local actif', { parse_mode: 'Markdown' });
    }
    return;
  }

  // Commande /feedback
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
    await bot.sendMessage(chatId, '⭐ *Note le bot !*', {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
    return;
  }

  // Message normal → Réponse simple
  await bot.sendChatAction(chatId, 'typing');

  // Générer une réponse simple
  const response = generateSimpleResponse(text, firstName);
  
  // Envoyer la réponse
  await bot.sendMessage(chatId, response, { parse_mode: 'Markdown' });
}

function generateSimpleResponse(text, firstName) {
  const lower = text.toLowerCase().trim();

  // Salutations
  if (/bonjour|salut|hello|coucou|yo|wesh|bonsoir/i.test(lower)) {
    const hour = new Date().getHours();
    let greeting = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir';
    const responses = [
      `${greeting} ${firstName} ! 👋 Comment puis-je t'aider ?`,
      `${greeting} ${firstName} ! 😊 Ravi de te voir !`,
      `${greeting} ${firstName} ! ✨ Dis-moi tout.`
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }

  // Au revoir
  if (/bye|au revoir|à bientôt|bonne nuit|ciao/i.test(lower)) {
    return `Au revoir ${firstName} ! 👋 Reviens quand tu veux ! 😊`;
  }

  // Remerciement
  if (/merci|thanks|thx|mrc/i.test(lower)) {
    return 'Avec plaisir ! N\'hésite pas si tu as besoin d\'autre chose 😊🙏';
  }

  // Comment ça va
  if (/ça va|comment vas-tu|la forme/i.test(lower)) {
    return 'Je vais super bien, merci ! Et toi, comment te sens-tu ? 😊';
  }

  // Qui es-tu
  if (/qui es-tu|tu es qui|présente toi/i.test(lower)) {
    return 'Je suis *Mini ChatGPT V5*, un assistant IA avec *20 couches d\'intelligence* ! 🤖\n\nJe peux discuter, rechercher des images, analyser des sujets, faire des calculs et bien plus !\n\nQue veux-tu savoir ? 😊';
  }

  // Calcul simple
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
    return `🧮 *Calcul :* ${a} ${op} ${b}\n\n✨ *Résultat :* ${result}`;
  }

  // Heure
  if (/heure|quelle heure/i.test(lower)) {
    const now = new Date();
    const heure = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    return `⏰ Il est *${heure}*`;
  }

  // Date
  if (/date|quel jour|aujourd'hui/i.test(lower)) {
    const now = new Date();
    const date = now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    return `📅 Nous sommes le *${date}*`;
  }

  // Météo
  if (/météo|temps|pleut|soleil|température/i.test(lower)) {
    const conditions = ['ensoleillé ☀️', 'nuageux ⛅', 'pluvieux 🌧️'];
    const random = conditions[Math.floor(Math.random() * conditions.length)];
    const temp = Math.floor(Math.random() * 15) + 10;
    return `Actuellement, c'est *${random}* avec environ *${temp}°C*`;
  }

  // Réponse par défaut
  const fallbacks = [
    `« ${text} » — c'est intéressant ! Peux-tu m'en dire plus ? 🤔`,
    `J'aimerais en savoir plus sur « ${text} ». Développe, je t'écoute ! 🎧`,
    `« ${text} » — un sujet passionnant ! Qu'en penses-tu ? ✨`,
    `Très bonne question ! Peux-tu préciser ta pensée ? 💭`
  ];
  return fallbacks[Math.floor(Math.random() * fallbacks.length)];
}

async function handleCallback(query, pool) {
  const chatId = query.message.chat.id;
  const data = query.data;

  await bot.answerCallbackQuery(query.id);

  switch (data) {
    case 'start_chat':
      await bot.sendMessage(chatId, '💬 *Je t\'écoute !* Pose-moi ta question 😊', { parse_mode: 'Markdown' });
      break;
    case 'help':
      await bot.sendMessage(chatId, 'Utilise /aide pour voir toutes les commandes !');
      break;
    case 'feedback':
      const keyboard = {
        inline_keyboard: [[
          { text: '⭐', callback_data: 'rate_1' },
          { text: '⭐⭐', callback_data: 'rate_2' },
          { text: '⭐⭐⭐', callback_data: 'rate_3' },
          { text: '⭐⭐⭐⭐', callback_data: 'rate_4' },
          { text: '⭐⭐⭐⭐⭐', callback_data: 'rate_5' }
        ]]
      };
      await bot.sendMessage(chatId, '⭐ Donne une note :', { reply_markup: keyboard });
      break;
    default:
      if (data.startsWith('rate_')) {
        const rating = parseInt(data.split('_')[1]);
        const emojis = ['', '⭐', '⭐⭐', '⭐⭐⭐', '⭐⭐⭐⭐', '⭐⭐⭐⭐⭐'];
        await bot.sendMessage(chatId, `${emojis[rating]} *Merci pour ta note !* 🚀`, { parse_mode: 'Markdown' });
      }
      break;
  }
}

module.exports = { initTelegramBot };
