const Storage = {
  save(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.error('Erreur stockage:', e.message);
      if (e.name === 'QuotaExceededError') {
        this.cleanup();
        try {
          localStorage.setItem(key, JSON.stringify(value));
          return true;
        } catch (e2) {
          return false;
        }
      }
      return false;
    }
  },

  load(key, defaultValue = null) {
    try {
      const data = localStorage.getItem(key);
      return data !== null ? JSON.parse(data) : defaultValue;
    } catch (e) {
      return defaultValue;
    }
  },

  remove(key) {
    localStorage.removeItem(key);
  },

  getSize() {
    let total = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      const value = localStorage.getItem(key);
      total += (key.length + value.length) * 2;
    }
    return total;
  },

  cleanup() {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      keys.push(localStorage.key(i));
    }
    const sorted = keys.sort((a, b) => {
      try {
        const da = JSON.parse(localStorage.getItem(a));
        const db = JSON.parse(localStorage.getItem(b));
        return new Date(da?.timestamp || 0) - new Date(db?.timestamp || 0);
      } catch (e) { return 0; }
    });
    const toRemove = sorted.slice(0, Math.ceil(sorted.length * 0.3));
    toRemove.forEach(key => localStorage.removeItem(key));
  },

  clear() {
    localStorage.clear();
  }
};
