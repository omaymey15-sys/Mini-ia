class IA9 {
  constructor() {
    this.name = 'IA9 - Plan de Réponse';
    this.version = '5.0.0';
    this.description = 'Élaboration du plan de réponse structuré';
    this.templates = {
      explication: { sections: [
        { name: 'introduction', label: '📖 Introduction', purpose: 'Présenter le sujet' },
        { name: 'definition', label: '📝 Définition', purpose: 'Définir les termes' },
        { name: 'development', label: '🔍 Développement', purpose: 'Expliquer en détail' },
        { name: 'examples', label: '💡 Exemples', purpose: 'Illustrer concrètement' },
        { name: 'conclusion', label: '✅ Conclusion', purpose: 'Synthétiser' }
      ]},
      analyse: { sections: [
        { name: 'context', label: '📋 Contexte', purpose: 'Présenter le sujet' },
        { name: 'advantages', label: '✅ Avantages', purpose: 'Points forts' },
        { name: 'disadvantages', label: '⚠️ Inconvénients', purpose: 'Points faibles' },
        { name: 'comparison', label: '🔄 Comparaison', purpose: 'Comparer' },
        { name: 'synthesis', label: '📊 Synthèse', purpose: 'Conclusion' }
      ]},
      image_request: { sections: [
        { name: 'acknowledgment', label: '🖼️ Recherche images', purpose: 'Confirmer la recherche' },
        { name: 'images', label: '📸 Images trouvées', purpose: 'Afficher les images' },
        { name: 'description', label: '📝 Description', purpose: 'Décrire les images' },
        { name: 'context', label: '💡 Contexte', purpose: 'Ajouter du contexte' }
      ]},
      general: { sections: [
        { name: 'introduction', label: '📖 Introduction', purpose: 'Accroche' },
        { name: 'body', label: '📝 Corps', purpose: 'Développement' },
        { name: 'conclusion', label: '✅ Conclusion', purpose: 'Synthèse' }
      ]}
    };
  }

  createPlan(intent, analysis, searchResults, hasImages) {
    let template = this.templates[intent] || this.templates.general;
    if (hasImages && intent !== 'image_request') {
      template = {
        sections: [
          ...template.sections.slice(0, 2),
          { name: 'images', label: '🖼️ Illustrations', purpose: 'Images pertinentes' },
          ...template.sections.slice(2)
        ]
      };
    }
    return {
      intent,
      totalSections: template.sections.length,
      sections: template.sections.map((s, i) => ({ ...s, order: i + 1 })),
      hasImages
    };
  }
}
