class IA18 {
  constructor() {
    this.name = 'IA18 - Apprentissage';
    this.version = '5.0.0';
    this.description = 'Apprentissage continu et amélioration';
    this.data = Storage.load('ia18_learning', { interactions: 0, topics: {}, imageRequests: 0, textRequests: 0, avgConfidence: 0, avgTime: 0 });
  }

  learn(interactionData) {
    this.data.interactions++;
    if (interactionData.hasImages) this.data.imageRequests++;
    else this.data.textRequests++;
    this.data.avgConfidence = (this.data.avgConfidence * 0.95) + ((interactionData.confidence || 0.5) * 0.05);
    this.data.avgTime = (this.data.avgTime * 0.95) + ((interactionData.processingTime || 1000) * 0.05);
    Storage.save('ia18_learning', this.data);
  }

  getStats() {
    return {
      totalInteractions: this.data.interactions,
      imageRequests: this.data.imageRequests,
      textRequests: this.data.textRequests,
      avgConfidence: this.data.avgConfidence.toFixed(2),
      avgTime: Math.round(this.data.avgTime) + 'ms'
    };
  }
}
