class IA0 {
  constructor() {
    this.name = 'IA0 - Pré-traitement';
    this.version = '5.0.0';
    this.description = 'Normalisation, nettoyage et préparation du texte';
    
    this.emojiToText = {
      '😊': 'content', '😢': 'triste', '😡': 'énervé', '😴': 'fatigué',
      '👍': 'oui', '👎': 'non', '❤️': 'amour', '💔': 'cœur brisé',
      '🎉': 'fête', '🔥': 'excellent', '💡': 'idée', '🤔': 'réflexion',
      '😂': 'très drôle', '😍': 'j\'adore', '🙏': 'merci', '💪': 'force',
      '🤯': 'incroyable', '🥳': 'joyeux', '😎': 'cool', '🤗': 'câlin',
      '🖼️': 'image', '📸': 'photo', '🎨': 'art', '🌅': 'paysage'
    };

    this.abbreviations = {
      'bcp': 'beaucoup', 'tjr': 'toujours', 'qq': 'quelqu\'un',
      'qqch': 'quelque chose', 'cad': 'c\'est-à-dire', 'pb': 'problème',
      'msg': 'message', 'rdv': 'rendez-vous', 'appli': 'application',
      'ordi': 'ordinateur', 'tel': 'téléphone', 'info': 'information',
      'pdt': 'pendant', 'tt': 'tout', 'pr': 'pour', 'ds': 'dans',
      'av': 'avant', 'ap': 'après', 'pcq': 'parce que', 'qd': 'quand',
      'mm': 'même', 'vs': 'vous', 'ns': 'nous', 'ss': 'sans',
      'img': 'image', 'pic': 'image', 'photo': 'photographie'
    };

    this.smsToFrench = {
      'c': 'c\'est', 'koi': 'quoi', 'ki': 'qui', 'kan': 'quand',
      'pk': 'pourquoi', 'mdr': 'drôle', 'ptdr': 'très drôle',
      'stp': 's\'il te plaît', 'svp': 's\'il vous plaît', 'dsl': 'désolé',
      'bjr': 'bonjour', 'bsr': 'bonsoir', 'slt': 'salut', 'cc': 'coucou',
      'cv': 'ça va', 'ok': 'd\'accord', 'nn': 'non', 'ouais': 'oui',
      'vrm': 'vraiment', 'jsp': 'je ne sais pas', 'jss': 'je suis',
      'chui': 'je suis', 'ya': 'il y a', 'wsh': 'bonjour', 'mrc': 'merci'
    };
  }

  deepClean(text) {
    let cleaned = text.trim();
    cleaned = cleaned.replace(/\s+/g, ' ');
    cleaned = cleaned.replace(/["""]/g, '"').replace(/[''']/g, "'");
    cleaned = cleaned.replace(/[\x00-\x1F\x7F-\x9F]/g, '');
    cleaned = cleaned.replace(/\.{3,}/g, '…');
    cleaned = cleaned.replace(/!{2,}/g, '!');
    cleaned = cleaned.replace(/\?{2,}/g, '?');
    
    for (let [emoji, txt] of Object.entries(this.emojiToText)) {
      cleaned = cleaned.replace(new RegExp(emoji, 'g'), ` ${txt} `);
    }
    
    const words = cleaned.split(/\s+/);
    const expanded = words.map(w => this.abbreviations[w.toLowerCase()] || w);
    cleaned = expanded.join(' ');
    
    const words2 = cleaned.split(/\s+/);
    const converted = words2.map(w => this.smsToFrench[w.toLowerCase()] || w);
    cleaned = converted.join(' ');
    
    return cleaned;
  }

  detectLanguage(text) {
    const frMarkers = ['le', 'la', 'les', 'des', 'est', 'sont', 'je', 'tu', 'il', 'elle', 'nous', 'vous', 'dans', 'avec', 'pour', 'sur', 'bien', 'très', 'tout'];
    const words = text.toLowerCase().split(/\s+/);
    const frScore = words.filter(w => frMarkers.includes(w)).length;
    return frScore > 0 ? 'fr' : 'fr';
  }

  quickSentiment(text) {
    const positive = ['bien', 'super', 'génial', 'top', 'parfait', 'excellent', 'magnifique', 'joli', 'beau', 'bon', 'heureux', 'content', 'cool', 'merveilleux'];
    const negative = ['mal', 'nul', 'mauvais', 'horrible', 'affreux', 'triste', 'déçu', 'fatigué', 'stressé', 'énervé', 'fâché'];
    const words = text.toLowerCase().split(/\s+/);
    let score = 0;
    words.forEach(w => { if (positive.includes(w)) score++; if (negative.includes(w)) score--; });
    if (score > 2) return 'très_positif';
    if (score > 0) return 'positif';
    if (score < -2) return 'très_négatif';
    if (score < 0) return 'négatif';
    return 'neutre';
  }

  extractContext(text) {
    return {
      hasQuestion: text.includes('?'),
      hasExclamation: text.includes('!'),
      isLongMessage: text.length > 100,
      isShortMessage: text.length < 10,
      hasNumbers: /\d+/.test(text),
      hasURL: /https?:\/\//.test(text),
      wordCount: text.split(/\s+/).length,
      complexity: text.length > 200 ? 'élevée' : text.length > 80 ? 'moyenne' : 'simple',
      asksForImages: /montre|affiche|image|photo|illustration|voir|visualiser/i.test(text)
    };
  }

  preprocess(text) {
    const cleaned = this.deepClean(text);
    const language = this.detectLanguage(cleaned);
    const sentiment = this.quickSentiment(cleaned);
    const context = this.extractContext(cleaned);
    return { original: text, cleaned, language, sentiment, context, timestamp: new Date().toISOString() };
  }
      }
