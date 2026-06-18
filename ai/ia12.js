class IA12 {
  constructor() {
    this.name = 'IA12 - Enrichissement';
    this.version = '5.0.0';
    this.description = 'Enrichissement avec détails, exemples et données';
  }

  enrichParagraph(paragraph, topic, section) {
    let enriched = paragraph;
    if (section === 'examples' || section === 'development') {
      enriched += ' Pour rendre cela plus concret, observons comment ces principes s\'appliquent dans des situations réelles. Les résultats démontrent clairement l\'efficacité de cette approche.';
    }
    if (section === 'conclusion') {
      enriched += ' Cette réflexion ouvre la voie à de nouvelles interrogations passionnantes qui mériteraient d\'être explorées.';
    }
    return enriched;
  }

  enrichAllParagraphs(paragraphs, data) {
    const topic = data?.analysis?.semantics?.topics?.[0] || 'général';
    const enriched = {};
    for (let [name, paragraph] of Object.entries(paragraphs)) {
      enriched[name] = { ...paragraph, content: this.enrichParagraph(paragraph.content, topic, name) };
    }
    return enriched;
  }
}
