class IA7 {
  constructor() {
    this.name = 'IA7 - Raisonnement Logique';
    this.version = '5.0.0';
    this.description = 'Raisonnement déductif, inductif et logique formelle';
  }

  reason(analysis, searchResults, imageResults, context) {
    const { intent, entities } = analysis;

    switch (intent) {
      case 'explication': return this.reasonExplanation(analysis, searchResults);
      case 'analyse': return this.reasonAnalysis(analysis, searchResults);
      case 'image_request': return this.reasonImageRequest(analysis, imageResults);
      case 'calcul': return this.reasonCalcul(analysis);
      case 'conseil': return this.reasonAdvice(analysis, context);
      default: return this.reasonGeneral(analysis, searchResults, imageResults, context);
    }
  }

  reasonExplanation(analysis, searchResults) {
    if (searchResults && searchResults.synthesis) {
      return { type: 'explanation_with_sources', content: searchResults.synthesis, sources: searchResults.sources, confidence: 0.9 };
    }
    return null;
  }

  reasonAnalysis(analysis, searchResults) {
    return {
      type: 'structured_analysis',
      structure: {
        introduction: 'Présentation du sujet d\'analyse',
        advantages: 'Points forts et avantages',
        disadvantages: 'Points faibles et limites',
        comparison: 'Comparaison avec alternatives',
        conclusion: 'Synthèse et recommandations'
      },
      confidence: 0.85
    };
  }

  reasonImageRequest(analysis, imageResults) {
    if (imageResults && imageResults.length > 0) {
      return {
        type: 'image_response',
        hasImages: true,
        imageCount: imageResults.length,
        confidence: 0.9
      };
    }
    return { type: 'image_response', hasImages: false, confidence: 0.3 };
  }

  reasonCalcul(analysis) {
    const text = analysis.original;
    const mathMatch = text.match(/(\d+(?:[.,]\d+)?)\s*([+\-*\/])\s*(\d+(?:[.,]\d+)?)/);
    if (mathMatch) {
      const a = parseFloat(mathMatch[1].replace(',', '.'));
      const op = mathMatch[2];
      const b = parseFloat(mathMatch[3].replace(',', '.'));
      let result;
      switch (op) { case '+': result = a + b; break; case '-': result = a - b; break; case '*': result = a * b; break; case '/': result = b !== 0 ? a / b : 'Infini'; break; }
      return { type: 'calculation', expression: `${a} ${op} ${b}`, result, confidence: 1.0 };
    }
    return null;
  }

  reasonAdvice(analysis, context) {
    return { type: 'advice', structure: { understanding: 'Compréhension du besoin', options: 'Alternatives possibles', recommendation: 'Recommandation principale', steps: 'Prochaines étapes' }, confidence: 0.8 };
  }

  reasonGeneral(analysis, searchResults, imageResults, context) {
    return {
      type: 'general',
      hasSearch: !!searchResults,
      hasImages: imageResults && imageResults.length > 0,
      hasContext: context?.hasRecentContext || false,
      approach: searchResults ? 'evidence_based' : 'reasoning',
      confidence: searchResults ? 0.85 : 0.6
    };
  }
}
