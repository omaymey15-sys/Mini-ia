class IA14 {
  constructor() {
    this.name = 'IA14 - Vérification';
    this.version = '5.0.0';
    this.description = 'Vérification factuelle et cohérence';
  }

  verify(paragraphs, data) {
    const issues = [];
    let score = 1.0;
    const fullText = Object.values(paragraphs).map(p => p.content || '').join(' ');

    const absoluteClaims = fullText.match(/\b(tous|toutes|chaque|aucun|jamais|toujours)\b/gi);
    if (absoluteClaims) {
      absoluteClaims.forEach(claim => {
        issues.push({ type: 'absolute_claim', claim, severity: 'medium', suggestion: 'Nuancez avec "en général" ou "dans la plupart des cas"' });
        score -= 0.05;
      });
    }

    const sentences = fullText.split(/[.!?]+/).filter(s => s.trim().length > 0);
    for (let i = 1; i < sentences.length; i++) {
      if (this.hasContradiction(sentences[i - 1], sentences[i])) {
        issues.push({ type: 'contradiction', severity: 'high' });
        score -= 0.1;
      }
    }

    score = Math.max(0, Math.min(1, score));
    return { score, issues, isValid: score > 0.7, needsCorrection: issues.some(i => i.severity === 'high') };
  }

  hasContradiction(s1, s2) {
    const contradictions = [['augmente', 'diminue'], ['positif', 'négatif'], ['toujours', 'parfois']];
    const a = s1.toLowerCase();
    const b = s2.toLowerCase();
    for (let [t1, t2] of contradictions) {
      if (a.includes(t1) && b.includes(t2)) return true;
    }
    return false;
  }

  correct(paragraphs, verificationResult) {
    if (!verificationResult.needsCorrection) return paragraphs;
    const corrected = { ...paragraphs };
    for (let issue of verificationResult.issues) {
      if (issue.type === 'absolute_claim') {
        for (let [name, p] of Object.entries(corrected)) {
          if (p.content && p.content.includes(issue.claim)) {
            corrected[name] = { ...p, content: p.content.replace(new RegExp(issue.claim, 'gi'), 'dans la grande majorité des cas') };
          }
        }
      }
    }
    return corrected;
  }
}
