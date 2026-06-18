class WebSearch {
  constructor() {
    this.name = 'WebSearch V5';
    this.cache = new Map();
    this.cacheTimeout = 30 * 60 * 1000;
    this.maxCacheSize = 100;
  }

  async search(query) {
    const cacheKey = query.toLowerCase().trim();
    const cached = this.cache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < this.cacheTimeout) return cached.results;

    const results = [];
    try {
      const ddg = await this.searchDuckDuckGo(query);
      results.push(...ddg);
    } catch (e) {}
    try {
      const wiki = await this.searchWikipedia(query);
      results.push(...wiki);
    } catch (e) {}

    if (results.length > 0) {
      this.cache.set(cacheKey, { results, timestamp: Date.now() });
      if (this.cache.size > this.maxCacheSize) {
        const firstKey = this.cache.keys().next().value;
        this.cache.delete(firstKey);
      }
    }

    return results.slice(0, 8);
  }

  async searchDuckDuckGo(query) {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&language=fr-fr`;
    const response = await fetch(url);
    const data = await response.json();
    const results = [];
    if (data.AbstractText && data.AbstractText.length > 20) {
      results.push({ title: data.Heading || 'Résultat', content: data.AbstractText, source: 'DuckDuckGo', url: data.AbstractURL || '', reliability: 0.85 });
    }
    return results;
  }

  async searchWikipedia(query) {
    const url = `https://fr.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*&srlimit=5`;
    const response = await fetch(url);
    const data = await response.json();
    if (!data.query?.search) return [];
    return data.query.search.map(r => ({ title: r.title, content: r.snippet.replace(/<[^>]+>/g, ''), source: 'Wikipedia', url: `https://fr.wikipedia.org/wiki/${encodeURIComponent(r.title)}`, reliability: 0.9 }));
  }
}
