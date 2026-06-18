class IA15 {
  constructor() {
    this.name = 'IA15 - Correction Style';
    this.version = '5.0.0';
    this.description = 'Correction grammaticale et stylistique';
  }

  correct(text) {
    let corrected = text;
    corrected = corrected.replace(/\b(a)\s+([aeiouyéèêë])/gi, '$1 $2');
    corrected = corrected.replace(/\b(de)\s+le\b/gi, 'du');
    corrected = corrected.replace(/\b(à)\s+le\b/gi, 'au');
    corrected = corrected.replace(/\b(de)\s+les\b/gi, 'des');
    corrected = corrected.replace(/\b(à)\s+les\b/gi, 'aux');
    corrected = corrected.replace(/\s+([.,!?;:])/g, '$1');
    corrected = corrected.replace(/([.,!?;:])(?=[^\s])/g, '$1 ');
    corrected = corrected.replace(/\s{2,}/g, ' ');
    return corrected;
  }

  improveStyle(text) {
    let improved = text;
    const synonyms = { 'important': 'essentiel', 'intéressant': 'captivant', 'cependant': 'néanmoins', 'également': 'aussi' };
    for (let [word, alt] of Object.entries(synonyms)) {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      let count = 0;
      improved = improved.replace(regex, match => { count++; return count > 1 ? alt : match; });
    }
    return improved;
  }

  correctAll(paragraphs) {
    const corrected = {};
    for (let [name, p] of Object.entries(paragraphs)) {
      if (p.content && !p.isImageSection) {
        let content = p.content;
        content = this.correct(content);
        content = this.improveStyle(content);
        corrected[name] = { ...p, content };
      } else {
        corrected[name] = p;
      }
    }
    return corrected;
  }
}
