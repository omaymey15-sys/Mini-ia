class IA8 {
  constructor(memory) {
    this.name = 'IA8 - Contexte & Mémoire';
    this.version = '5.0.0';
    this.description = 'Gestion mémoire court/long terme et contexte conversationnel';
    this.memory = memory;
    this.shortTermMemory = [];
    this.longTermMemory = Storage.load('ia8_long_term', {});
    this.maxShortTerm = 30;
  }

  addToMemory(role, content, metadata = {}) {
    this.shortTermMemory.push({ role, content: content.substring(0, 500), metadata, timestamp: new Date().toISOString() });
    if (this.shortTermMemory.length > this.maxShortTerm) this.shortTermMemory.shift();
  }

  getRecentContext(count = 10) {
    return this.shortTermMemory.slice(-count);
  }

  getContext() {
    const recent = this.getRecentContext(5);
    const userName = this.memory.userName;
    const contextSummary = recent.map(m => `${m.role === 'user' ? '👤' : '🤖'} ${m.content.substring(0, 60)}...`).join(' | ');
    return {
      recentMessages: recent,
      contextSummary,
      userName,
      messageCount: this.shortTermMemory.length,
      hasRecentContext: recent.length > 0,
      lastInteraction: recent.length > 0 ? recent[recent.length - 1].timestamp : null
    };
  }

  learn(key, value) {
    this.longTermMemory[key] = { value, timestamp: new Date().toISOString(), accessCount: 0 };
    Storage.save('ia8_long_term', this.longTermMemory);
  }

  recall(key) {
    const entry = this.longTermMemory[key];
    if (entry) { entry.accessCount++; return entry.value; }
    return null;
  }

  getStats() {
    return { shortTermSize: this.shortTermMemory.length, longTermSize: Object.keys(this.longTermMemory).length };
  }
}
