class IA3 {
  constructor() {
    this.name = 'IA3 - Analyse Sémantique';
    this.version = '5.0.0';
    this.description = 'Détection d\'intention, extraction d\'entités et analyse sémantique';

    this.intents = {
      explication: { keywords: ['explique', 'définition', 'c\'est quoi', 'qu\'est-ce que', 'signification', 'définir', 'décris', 'comment fonctionne'], patterns: [/explique/i, /qu'est-ce que/i, /c'est quoi/i], priority: 10 },
      analyse: { keywords: ['analyse', 'analyser', 'compare', 'comparer', 'différence', 'avantages', 'inconvénients'], patterns: [/analyse/i, /compare/i, /différence entre/i], priority: 10 },
      creation: { keywords: ['rédige', 'écris', 'crée', 'génère', 'produis', 'élabore', 'plan', 'structure'], patterns: [/rédige/i, /écris/i, /crée/i], priority: 9 },
      image_request: { keywords: ['montre', 'affiche', 'image', 'photo', 'illustration', 'voir', 'visualiser', 'cherche une image', 'trouve une photo', 'montre-moi'], patterns: [/montre.moi/i, /affiche/i, /image de/i, /photo de/i, /cherche une image/i], priority: 10 },
      salutation: { keywords: ['bonjour', 'salut', 'hello', 'coucou', 'yo', 'bonsoir', 'hey'], patterns: [/^(bonjour|salut|hello|coucou)/i], priority: 10 },
      calcul: { keywords: ['calcule', 'calcul', 'combien fait', 'résultat', 'addition', 'soustraction'], patterns: [/[\d]+\s*[\+\-\*\/]\s*[\d]+/, /calcule/i], priority: 8 },
      information: { keywords: ['informations', 'renseignements', 'que sais-tu', 'parle-moi', 'dis-moi', 'raconte'], patterns: [/que sais-tu/i, /parle-moi de/i], priority: 7 },
      conseil: { keywords: ['conseil', 'conseille', 'recommande', 'suggestion', 'propose', 'aide-moi'], patterns: [/conseille/i, /recommande/i], priority: 8 }
    };
  }

  detectIntent(text) {
    let bestIntent = null;
    let bestScore = 0;
    const lower = text.toLowerCase();
    for (let [intent, config] of Object.entries(this.intents)) {
      let score = 0;
      for (let pattern of config.patterns) { if (pattern.test(text)) score += config.priority * 2; }
      for (let keyword of config.keywords) { if (lower.includes(keyword)) score += config.priority; }
      if (score > bestScore) { bestScore = score; bestIntent = intent; }
    }
    return { intent: bestIntent || 'conversation', confidence: Math.min(bestScore / 20, 1) };
  }

  extractEntities(text) {
    const entities = {};
    const nameMatch = text.match(/(?:je m'appelle|je suis|mon nom est)\s+([A-ZÀ-Ü][a-zà-ü]+)/i);
    if (nameMatch) entities.name = nameMatch[1];
    const imageMatch = text.match(/(?:montre|affiche|image de|photo de|cherche)\s+(?:moi\s+)?(?:une\s+)?(?:image|photo|illustration)?\s*(?:de\s+)?(.+?)(?:\s+avec|\s+en|\s+de style|\s*$)/i);
    if (imageMatch) entities.imageQuery = imageMatch[1].trim();
    const numberMatch = text.match(/\b(\d+(?:[.,]\d+)?)\b/g);
    if (numberMatch) entities.numbers = numberMatch.map(n => parseFloat(n.replace(',', '.')));
    return entities;
  }

  analyse(text, lexicalAnalysis) {
    const intentResult = this.detectIntent(text);
    const entities = this.extractEntities(text);
    const topics = [];
    const topicKeywords = {
      'technologie': ['tech', 'informatique', 'ordinateur', 'internet', 'ia', 'intelligence artificielle'],
      'science': ['science', 'physique', 'chimie', 'biologie', 'mathématiques'],
      'nature': ['nature', 'animal', 'plante', 'fleur', 'paysage', 'montagne', 'mer', 'forêt'],
      'architecture': ['bâtiment', 'monument', 'architecture', 'pont', 'tour', 'cathédrale'],
      'art': ['peinture', 'tableau', 'sculpture', 'art', 'musée', 'exposition']
    };
    const lower = text.toLowerCase();
    for (let [topic, keywords] of Object.entries(topicKeywords)) {
      if (keywords.some(k => lower.includes(k))) topics.push(topic);
    }
    return { ...intentResult, entities, semantics: { topics, complexity: text.length > 200 ? 'très complexe' : text.length > 80 ? 'complexe' : 'simple' } };
  }
}
