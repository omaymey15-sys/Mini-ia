class IA1 {
  constructor() {
    this.name = 'IA1 - Analyse Lexicale';
    this.version = '5.0.0';
    this.description = 'Tokenisation, stemming et analyse morphologique';
    
    this.stopWords = new Set([
      'le', 'la', 'les', 'un', 'une', 'des', 'de', 'du', 'à', 'au', 'aux',
      'ce', 'cet', 'cette', 'ces', 'est', 'sont', 'suis', 'es', 'sommes', 'êtes',
      'je', 'tu', 'il', 'elle', 'on', 'nous', 'vous', 'ils', 'elles',
      'me', 'te', 'se', 'moi', 'toi', 'lui', 'leur', 'y', 'en',
      'que', 'qui', 'quoi', 'dont', 'où', 'comment', 'pourquoi', 'quand',
      'et', 'ou', 'mais', 'donc', 'car', 'ni', 'or',
      'ne', 'pas', 'plus', 'jamais', 'rien', 'tout', 'très', 'trop'
    ]);
  }

  tokenize(text) {
    return text.toLowerCase().replace(/[.,!?;:()\[\]{}""'']/g, ' ').split(/\s+/).filter(w => w.length > 0);
  }

  removeStopWords(tokens) {
    return tokens.filter(t => !this.stopWords.has(t) && t.length > 1);
  }

  stem(word) {
    const suffixes = ['er', 'ir', 're', 'é', 'ée', 'és', 'ées', 'ez', 'ais', 'ait', 'aient', 'ions', 'iez', 'ant', 'ante', 'ants', 'antes', 'ment', 'tion', 'sion', 'isme', 'able', 'ible', 'euse', 'eur', 'teur', 'trice', 'ique', 'iste', 'esse', 'age', 'ure', 'ance', 'ence'];
    let lower = word.toLowerCase();
    for (let suf of suffixes) {
      if (lower.endsWith(suf) && lower.length > suf.length + 2) return lower.slice(0, -suf.length);
    }
    if (lower.endsWith('s') && lower.length > 3) return lower.slice(0, -1);
    if (lower.endsWith('aux') && lower.length > 4) return lower.slice(0, -3) + 'al';
    return lower;
  }

  getWordFrequencies(tokens) {
    const freq = {};
    tokens.forEach(t => { freq[t] = (freq[t] || 0) + 1; });
    return Object.entries(freq).sort((a, b) => b[1] - a[1]);
  }

  analyse(text) {
    const tokens = this.tokenize(text);
    const contentTokens = this.removeStopWords(tokens);
    const stems = contentTokens.map(t => this.stem(t));
    const frequencies = this.getWordFrequencies(stems);
    const uniqueWords = [...new Set(stems)];
    return {
      tokens, contentTokens, stems, uniqueWords, frequencies,
      tokenCount: tokens.length, uniqueCount: uniqueWords.length,
      lexicalDensity: uniqueWords.length / Math.max(tokens.length, 1)
    };
  }
}
