class Orchestrator {
  constructor(memory) {
    this.memory = memory;
    this.ia0 = new IA0();
    this.ia1 = new IA1();
    this.ia2 = new IA2();
    this.ia3 = new IA3();
    this.ia4 = new IA4();
    this.ia5 = new IA5();
    this.ia6 = new IA6();
    this.ia7 = new IA7();
    this.ia8 = new IA8(memory);
    this.ia9 = new IA9();
    this.ia10 = new IA10();
    this.ia11 = new IA11();
    this.ia12 = new IA12();
    this.ia13 = new IA13();
    this.ia14 = new IA14();
    this.ia15 = new IA15();
    this.ia16 = new IA16();
    this.ia17 = new IA17();
    this.ia18 = new IA18();
    this.ia19 = new IA19();

    this.pipeline = [];
    this.stats = { totalProcessed: 0, searchPerformed: 0, imagesFound: 0, averageTime: 0 };
  }

  async processMessage(text, options = {}) {
    const startTime = Date.now();
    this.stats.totalProcessed++;
    this.pipeline = [];

    try {
      // IA0-IA3 : Analyse
      const preprocess = this.ia0.preprocess(text);
      this.logStep(0, 'Pré-traitement', '✅');

      const lexical = this.ia1.analyse(preprocess.cleaned);
      this.logStep(1, 'Analyse Lexicale', `${lexical.tokenCount} tokens`);

      const syntax = this.ia2.analyse(preprocess.cleaned);
      this.logStep(2, 'Analyse Syntaxique', `${syntax.sentenceCount} phrases`);

      const semantic = this.ia3.analyse(preprocess.cleaned, lexical);
      this.logStep(3, 'Analyse Sémantique', `Intention: ${semantic.intent}`);

      // IA4 : Recherche texte
      let searchResults = null;
      if (this.ia4.needsSearch(text, semantic.intent, semantic.confidence)) {
        searchResults = await this.ia4.searchAndSynthesize(text);
        this.stats.searchPerformed++;
        this.logStep(4, 'Recherche Texte', searchResults ? '✅' : '⚠️');
      } else {
        this.logStep(4, 'Recherche Texte', '⏭️ Non nécessaire');
      }

      // IA5-IA6 : Recherche images
      let images = null;
      if (semantic.intent === 'image_request' || preprocess.context.asksForImages || options.imageSearch === 'always') {
        const imageQuery = semantic.entities?.imageQuery || text.replace(/montre|affiche|image|photo|cherche/gi, '').trim();
        const rawImages = await this.ia5.searchImages(imageQuery);
        images = this.ia6.analyseAndFilter(rawImages, imageQuery);
        if (images.length > 0) this.stats.imagesFound += images.length;
        this.logStep(5, 'Recherche Images', images.length > 0 ? `${images.length} trouvées` : '⚠️ Aucune');
        this.logStep(6, 'Analyse Images', images.length > 0 ? '✅ Filtrées' : '⏭️');
      } else {
        this.logStep(5, 'Recherche Images', '⏭️ Non nécessaire');
        this.logStep(6, 'Analyse Images', '⏭️');
      }

      // IA7 : Raisonnement
      const context = this.ia8.getContext();
      const reasoning = this.ia7.reason(semantic, searchResults, images, context);
      this.logStep(7, 'Raisonnement', reasoning?.type || 'général');

      // IA8 : Mémoire
      this.ia8.addToMemory('user', text, { analysis: semantic });
      this.logStep(8, 'Contexte & Mémoire', `${context.messageCount} messages`);

      // IA9 : Plan
      const data = { analysis: semantic, searchResults, reasoning };
      const plan = this.ia9.createPlan(semantic.intent, semantic, searchResults, images && images.length > 0);
      this.logStep(9, 'Plan de Réponse', `${plan.totalSections} sections`);

      // IA10-IA11 : Génération
      let paragraphs = this.ia10.generateAllParagraphs(plan, data, options.style);
      this.logStep(10, 'Génération Paragraphes', `${Object.keys(paragraphs).length} paragraphes`);

      if (images && images.length > 0) {
        const imageDesc = this.ia11.describeAllImages(images, text);
        paragraphs['image_description'] = { order: 0, label: '📸', content: imageDesc.context, wordCount: 10 };
        this.logStep(11, 'Description Images', imageDesc.context);
      } else {
        this.logStep(11, 'Description Images', '⏭️');
      }

      // IA12-IA13 : Enrichissement et intégration
      paragraphs = this.ia12.enrichAllParagraphs(paragraphs, data);
      this.logStep(12, 'Enrichissement', '✅');

      if (images && images.length > 0) {
        paragraphs = this.ia13.integrateImages(paragraphs, images, plan);
        this.logStep(13, 'Intégration Médias', `${images.length} images intégrées`);
      } else {
        this.logStep(13, 'Intégration Médias', '⏭️');
      }

      // IA14-IA15-IA16 : Vérification, correction, polissage
      const verification = this.ia14.verify(paragraphs, data);
      if (verification.needsCorrection) paragraphs = this.ia14.correct(paragraphs, verification);
      this.logStep(14, 'Vérification', verification.isValid ? '✅' : '🔧 Corrigé');

      paragraphs = this.ia15.correctAll(paragraphs);
      this.logStep(15, 'Correction Style', '✅');

      paragraphs = this.ia16.polish(paragraphs, plan);
      this.logStep(16, 'Polissage', '✅');

      // IA17 : Émotions
      let response = this.ia19.formatFinal(paragraphs, plan, images);
      response.content = this.ia17.adaptTone(response.content, preprocess.sentiment, options.style);
      this.logStep(17, 'Émotions & Ton', preprocess.sentiment);

      // IA18 : Apprentissage
      this.ia18.learn({
        hasImages: images && images.length > 0,
        confidence: semantic.confidence,
        processingTime: Date.now() - startTime
      });
      this.logStep(18, 'Apprentissage', `${this.ia18.getStats().totalInteractions} interactions`);

      // IA19 : Formatage final
      const final = this.ia19.formatFinal(paragraphs, plan, images);
      this.logStep(19, 'Formatage Final', `${final.metadata.wordCount} mots`);

      // Ajouter à la mémoire
      this.ia8.addToMemory('assistant', final.content, { pipeline: this.pipeline });

      const processingTime = Date.now() - startTime;
      this.stats.averageTime = (this.stats.averageTime * (this.stats.totalProcessed - 1) + processingTime) / this.stats.totalProcessed;

      return {
        response: final.content,
        metadata: final.metadata,
        pipeline: this.pipeline,
        stats: { processingTime, searchPerformed: !!searchResults, imagesFound: images?.length || 0 }
      };

    } catch (error) {
      console.error('❌ Orchestrateur:', error);
      return { response: 'Une erreur est survenue. Peux-tu réessayer ? 😊', pipeline: this.pipeline, error: error.message };
    }
  }

  logStep(iaNumber, name, result) {
    this.pipeline.push({ step: iaNumber + 1, ia: `IA${iaNumber}`, name, result, time: '-' });
  }

  getStats() {
    return { ...this.stats, ia18: this.ia18.getStats() };
  }
}
