class IA2 {
  constructor() {
    this.name = 'IA2 - Analyse Syntaxique';
    this.version = '5.0.0';
    this.description = 'Structure des phrases, grammaire et relations syntaxiques';
  }

  splitSentences(text) {
    return text.split(/[.!?]+/).filter(s => s.trim().length > 0).map(s => s.trim());
  }

  analyzeSentence(sentence) {
    const words = sentence.split(/\s+/);
    return {
      text: sentence,
      wordCount: words.length,
      hasVerb: words.some(w => w.endsWith('er') || w.endsWith('ir') || w.endsWith('re') || w.endsWith('é') || w === 'est' || w === 'a' || w === 'sont'),
      hasSubject: words.some(w => ['je', 'tu', 'il', 'elle', 'on', 'nous', 'vous', 'ils', 'elles'].includes(w.toLowerCase())),
      type: sentence.includes('?') ? 'interrogative' : sentence.includes('!') ? 'exclamative' : 'déclarative'
    };
  }

  analyse(text) {
    const sentences = this.splitSentences(text);
    const analyzed = sentences.map(s => this.analyzeSentence(s));
    return {
      sentences: analyzed,
      sentenceCount: analyzed.length,
      avgSentenceLength: analyzed.reduce((sum, s) => sum + s.wordCount, 0) / Math.max(analyzed.length, 1),
      types: {
        declarative: analyzed.filter(s => s.type === 'déclarative').length,
        interrogative: analyzed.filter(s => s.type === 'interrogative').length,
        exclamative: analyzed.filter(s => s.type === 'exclamative').length
      },
      complexity: analyzed.length > 3 ? 'complexe' : analyzed.length > 1 ? 'moyenne' : 'simple'
    };
  }
}
