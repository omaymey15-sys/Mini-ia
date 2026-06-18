const express = require('express');
const router = express.Router();

router.post('/webhook', async (req, res) => {
  try {
    if (global.telegramBot) {
      await global.telegramBot.processUpdate(req.body);
    }
    res.sendStatus(200);
  } catch (error) {
    console.error('Erreur webhook:', error);
    res.sendStatus(200);
  }
});

router.get('/info', async (req, res) => {
  try {
    if (!global.telegramBot) return res.json({ status: 'disconnected' });
    const info = await global.telegramBot.getMe();
    const webhook = await global.telegramBot.getWebHookInfo();
    res.json({ status: 'connected', version: '5.0.0', bot: info, webhook });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/send', async (req, res) => {
  try {
    const { chat_id, text, parse_mode } = req.body;
    if (!global.telegramBot) return res.status(503).json({ error: 'Bot non connecté' });
    const result = await global.telegramBot.sendMessage(chat_id, text, { parse_mode: parse_mode || 'Markdown' });
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
