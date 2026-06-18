class Memory {
  constructor() {
    this.userName = Storage.load('userName', '');
    this.context = Storage.load('userContext', {});
    this.preferences = Storage.load('userPreferences', {
      style: 'professional',
      images: 'auto',
      theme: 'dark',
      language: 'fr'
    });
    this.stats = Storage.load('userStats', {
      totalMessages: 0,
      firstInteraction: null,
      lastInteraction: null,
      imageRequests: 0
    });
  }

  setUserName(name) {
    this.userName = name;
    Storage.save('userName', name);
  }

  getUserName() {
    return this.userName;
  }

  updateContext(key, value) {
    this.context[key] = { value, timestamp: new Date().toISOString() };
    Storage.save('userContext', this.context);
  }

  getContext(key) {
    return this.context[key]?.value || null;
  }

  setPreference(key, value) {
    this.preferences[key] = value;
    Storage.save('userPreferences', this.preferences);
  }

  getPreference(key, defaultValue = null) {
    return this.preferences[key] || defaultValue;
  }

  updateStats(type) {
    this.stats.totalMessages++;
    if (!this.stats.firstInteraction) this.stats.firstInteraction = new Date().toISOString();
    this.stats.lastInteraction = new Date().toISOString();
    if (type === 'image') this.stats.imageRequests++;
    Storage.save('userStats', this.stats);
  }

  export() {
    return {
      userName: this.userName,
      context: this.context,
      preferences: this.preferences,
      stats: this.stats,
      exportDate: new Date().toISOString()
    };
  }
}
