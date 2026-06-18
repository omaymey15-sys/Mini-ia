class IA16 {
  constructor() {
    this.name = 'IA16 - Polissage';
    this.version = '5.0.0';
    this.description = 'Polissage final pour qualité professionnelle';
  }

  polish(paragraphs, plan) {
    const polished = {};
    const previousContent = [];

    for (let section of plan.sections) {
      const p = paragraphs[section.name];
      if (!p || p.isImageSection) { if (p) polished[section.name] = p; continue; }

      let content = p.content;

      if (previousContent.length > 0 && section.order > 1) {
        const transitions = ['Dans la continuité de cette analyse,', 'Ces éléments établis,', 'Après avoir examiné ces aspects,'];
        const transition = transitions[Math.floor(Math.random() * transitions.length)];
        if (!content.startsWith(transition)) {
          content = transition + ' ' + content.charAt(0).toLowerCase() + content.slice(1);
        }
      }

      content = `**${section.label}**\n${content}`;
      previousContent.push(content);
      polished[section.name] = { ...p, content };
    }

    return polished;
  }
}
