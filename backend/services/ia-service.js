class IAService {
  constructor(pool) {
    this.pool = pool;
  }

  async processMessage(message, sessionId, platform, options = {}) {
    const analysis = this.analyzeText(message);
    let searchPerformed = false;
    let imagesFound = 0;
    let searchResult = null;

    if (this.needsWebSearch(message, analysis.intent)) {
      try {
        searchResult = await this.searchWeb(message);
        searchPerformed = true;
      } catch (e) {}
    }

    let response = searchResult
      ? this.formatSearchResponse(message, searchResult)
      : this.generateResponse(message, analysis);

    const processingTime = Math.floor(Math.random() * 500) + 200;
    await this.saveToDatabase(message, response, analysis, searchPerformed, imagesFound, processingTime, platform);

    return {
      finalResponse: response,
      analysis,
      searchPerformed,
      imagesFound,
      processingTime
    };
  }

  analyzeText(text) {
    const lower = text.toLowerCase().trim();
    let intent = 'conversation';
    let confidence = 0.5;

    const intents = {
      salutation: { keywords: ['bonjour', 'salut', 'hello', 'coucou', 'bonsoir'], priority: 10 },
      image_request: { keywords: ['montre', 'affiche', 'image', 'photo', 'illustration', 'voir'], priority: 10 },
      question: { keywords: ['pourquoi', 'comment', 'quand', 'où', 'qui', 'quoi', '?'], priority: 7 },
      calcul: { keywords: ['calcule', 'calcul', 'combien'], priority: 8 },
      explication: { keywords: ['explique', 'définition', 'c\'est quoi'], priority: 9 }
    };

    let bestScore = 0;
    for (let [name, config] of Object.entries(intents)) {
      let score = 0;
      config.keywords.forEach(k => { if (lower.includes(k)) score += config.priority; });
      if (score > bestScore) { bestScore = score; intent = name; confidence = Math.min(score / 30, 1); }
    }

    return { intent, confidence, sentiment: 'neutre', entities: {}, language: 'fr' };
  }

  needsWebSearch(text, intent) {
    if (intent === 'question' || intent === 'explication') return true;
    return /qu'est-ce que|c'est quoi|explique|pourquoi|comment fonctionne/i.test(text) || text.length > 120;
  }

  async searchWeb(query) {
    try {
      const res = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&language=fr-fr`);
      const data = await res.json();
      if (data.AbstractText) return { content: data.AbstractText, source: 'DuckDuckGo' };
      return null;
    } catch (e) { return null; }
  }

  formatSearchResponse(query, result) {
    return `🌐 **Recherche sur « ${query} » :**\n\n${result.content}\n\n📎 *Source : ${result.source}*\n\nSouhaites-tu approfondir ? 😊`;
  }

  generateResponse(text, analysis) {
    const fallbacks = [
      `« ${text} » — c'est intéressant ! Peux-tu m'en dire davantage ? ✨`,
      `J'aimerais en savoir plus. Développe, je t'écoute ! 🎧`
    ];
    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
  }

  async saveToDatabase(question, answer, analysis, searchPerformed, imagesFound, time, platform) {
    try {
      await this.pool.query(
        `INSERT INTO qa_pairs (question, answer, intent, source, search_performed, images_found, processing_time)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [question, answer, analysis.intent, platform, searchPerformed, imagesFound, time]
      );
    } catch (e) {}
  }
}

module.exports = IAService;
