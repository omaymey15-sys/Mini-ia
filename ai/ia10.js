class IA10 {
  constructor() {
    this.name = 'IA10 - Génération Paragraphes';
    this.version = '5.0.0';
    this.description = 'Génération de paragraphes structurés et riches';
    this.transitions = {
      introduction: ['Pour commencer,', 'Tout d\'abord,', 'En premier lieu,'],
      development: ['Ensuite,', 'Par ailleurs,', 'De plus,', 'En outre,'],
      examples: ['Par exemple,', 'Pour illustrer,', 'Concrètement,'],
      conclusion: ['En conclusion,', 'Pour résumer,', 'En définitive,']
    };
  }

  generateParagraph(section, data, style = 'professional') {
    const { name } = section;
    const transition = this.getTransition(name);
    let paragraph = transition + ' ';

    switch (name) {
      case 'introduction': paragraph += 'le sujet que tu abordes est particulièrement pertinent. Il touche à des enjeux fondamentaux qui méritent une analyse approfondie et structurée.'; break;
      case 'definition': paragraph += 'il est essentiel de clarifier les termes clés pour une compréhension précise du sujet.'; break;
      case 'development': paragraph += 'plusieurs aspects méritent d\'être développés. Les fondements théoriques éclairent les mécanismes sous-jacents, tandis que les implications pratiques touchent directement au quotidien.'; break;
      case 'examples': paragraph += 'prenons l\'exemple d\'une situation concrète. Imaginons un scénario où ces principes sont appliqués. Les résultats observés confirment les analyses théoriques.'; break;
      case 'conclusion': paragraph += 'l\'ensemble de ces éléments permet de dresser un tableau complet. Cette analyse ouvre des perspectives intéressantes pour de futures explorations.'; break;
      case 'advantages': paragraph += 'les points forts sont multiples. Cette approche offre une solution efficace, sa mise en œuvre est accessible, et les résultats sont généralement satisfaisants.'; break;
      case 'disadvantages': paragraph += 'il convient de nuancer en évoquant certaines limites, notamment la complexité de mise en œuvre et certains effets secondaires possibles.'; break;
      case 'acknowledgment': paragraph += 'j\'ai effectué une recherche d\'images correspondant à ta demande. Voici les résultats les plus pertinents que j\'ai trouvés.'; break;
      case 'description': paragraph += 'ces images illustrent parfaitement le sujet. Chacune apporte un éclairage visuel complémentaire à notre analyse textuelle.'; break;
      default: paragraph += 'ce point apporte un éclairage complémentaire qui enrichit notre compréhension globale du sujet.';
    }

    return this.enhanceParagraph(paragraph);
  }

  getTransition(type) {
    const t = this.transitions[type] || this.transitions.development;
    return t[Math.floor(Math.random() * t.length)];
  }

  enhanceParagraph(paragraph) {
    let enhanced = paragraph;
    enhanced = enhanced.replace(/\s+/g, ' ').trim();
    enhanced = enhanced.charAt(0).toUpperCase() + enhanced.slice(1);
    if (!enhanced.endsWith('.')) enhanced += '.';
    return enhanced;
  }

  generateAllParagraphs(plan, data, style = 'professional') {
    const paragraphs = {};
    plan.sections.forEach(section => {
      paragraphs[section.name] = {
        order: section.order,
        label: section.label,
        content: this.generateParagraph(section, data, style),
        wordCount: 50
      };
    });
    return paragraphs;
  }
}
