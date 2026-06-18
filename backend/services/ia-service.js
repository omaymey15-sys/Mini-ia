const path = require('path');

// Importer les vrais modules d'IA (depuis la racine)
const IA0 = require(path.join(__dirname, '..', '..', 'ai', 'ia0.js'));
const IA1 = require(path.join(__dirname, '..', '..', 'ai', 'ia1.js'));
const IA2 = require(path.join(__dirname, '..', '..', 'ai', 'ia2.js'));
const IA3 = require(path.join(__dirname, '..', '..', 'ai', 'ia3.js'));
const IA4 = require(path.join(__dirname, '..', '..', 'ai', 'ia4.js'));
const IA5 = require(path.join(__dirname, '..', '..', 'ai', 'ia5.js'));
const IA6 = require(path.join(__dirname, '..', '..', 'ai', 'ia6.js'));
const IA7 = require(path.join(__dirname, '..', '..', 'ai', 'ia7.js'));
const IA8 = require(path.join(__dirname, '..', '..', 'ai', 'ia8.js'));
const IA9 = require(path.join(__dirname, '..', '..', 'ai', 'ia9.js'));
const IA10 = require(path.join(__dirname, '..', '..', 'ai', 'ia10.js'));
const IA11 = require(path.join(__dirname, '..', '..', 'ai', 'ia11.js'));
const IA12 = require(path.join(__dirname, '..', '..', 'ai', 'ia12.js'));
const IA13 = require(path.join(__dirname, '..', '..', 'ai', 'ia13.js'));
const IA14 = require(path.join(__dirname, '..', '..', 'ai', 'ia14.js'));
const IA15 = require(path.join(__dirname, '..', '..', 'ai', 'ia15.js'));
const IA16 = require(path.join(__dirname, '..', '..', 'ai', 'ia16.js'));
const IA17 = require(path.join(__dirname, '..', '..', 'ai', 'ia17.js'));
const IA18 = require(path.join(__dirname, '..', '..', 'ai', 'ia18.js'));
const IA19 = require(path.join(__dirname, '..', '..', 'ai', 'ia19.js'));

// Importer les données
const Storage = require(path.join(__dirname, '..', '..', 'data', 'storage.js'));
const Memory = require(path.join(__dirname, '..', '..', 'data', 'memory.js'));
const WebSearch = require(path.join(__dirname, '..', '..', 'data', 'web-search.js'));

// Importer l'orchestrateur
const Orchestrator = require(path.join(__dirname, '..', '..', 'ai', 'orchestrator.js'));

class IAService {
  constructor(pool) {
    this.pool = pool;
    this.orchestrator = null;
    this.memory = null;
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return;
    
    try {
      // Créer la mémoire
      this.memory = new Memory();
      
      // Créer l'orchestrateur avec les 20 IA
      this.orchestrator = new Orchestrator(this.memory);
      
      this.initialized = true;
      console.log('✅ 20 IA connectées au backend !');
    } catch (error) {
      console.error('❌ Erreur initialisation 20 IA:', error.message);
      throw error;
    }
  }

  async processMessage(message, sessionId, platform, options = {}) {
    // Initialiser si pas encore fait
    if (!this.initialized) {
      await this.init();
    }

    console.log(`🧠 20 IA traitent: "${message.substring(0, 80)}"`);

    try {
      // Utiliser l'orchestrateur avec les 20 IA
      const result = await this.orchestrator.processMessage(message, options);

      return {
        finalResponse: result.response,
        analysis: {
          intent: result.stats?.intent || 'conversation',
          confidence: result.stats?.confidence || 0.8,
          sentiment: 'neutre'
        },
        searchPerformed: result.stats?.searchPerformed || false,
        imagesFound: result.metadata?.imageCount || 0,
        processingTime: result.stats?.processingTime || 500,
        rewritten: null
      };
    } catch (error) {
      console.error('❌ Erreur 20 IA:', error.message);
      
      // Fallback : réponse simple
      return {
        finalResponse: this.fallbackResponse(message),
        analysis: { intent: 'conversation', confidence: 0.5 },
        searchPerformed: false,
        imagesFound: 0,
        processingTime: 100
      };
    }
  }

  fallbackResponse(text) {
    const lower = text.toLowerCase().trim();
    
    if (/bonjour|salut|hello|coucou/i.test(lower)) {
      return 'Bonjour ! 👋 Comment puis-je t\'aider ?';
    }
    if (/qui es-tu/i.test(lower)) {
      return 'Je suis Mini ChatGPT V5 avec 20 IA ! 🧠';
    }
    if (/merci/i.test(lower)) {
      return 'Avec plaisir ! 🙏';
    }
    
    const mathMatch = text.match(/(\d+)\s*([+\-*\/])\s*(\d+)/);
    if (mathMatch) {
      const a = parseFloat(mathMatch[1]);
      const op = mathMatch[2];
      const b = parseFloat(mathMatch[3]);
      let result;
      switch (op) { case '+': result = a + b; break; case '-': result = a - b; break; case '*': result = a * b; break; case '/': result = b !== 0 ? a / b : 'Infini'; break; }
      return `🧮 ${a} ${op} ${b} = ${result}`;
    }
    
    if (/heure/i.test(lower)) {
      return `⏰ ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
    }
    
    return `« ${text} » — Les 20 IA ont rencontré un petit souci. Peux-tu reformuler ? 😊`;
  }

  async globalLearning() {
    return { total_qa: 0, top_intents: [], suggestions: [] };
  }
}

module.exports = IAService;
