class IA4 {
  constructor() {
    this.name = 'IA4 - Recherche Web Texte';
    this.version = '5.0.0';
    this.description = 'Recherche intelligente sur le web';
    this.cache = new Map();
    this.cacheTimeout = 30 * 60 * 1000;
  }

  needsSearch(text, intent, confidence) {
    if (confidence < 0.5) return true;
    if (intent === 'explication' || intent === 'analyse' || intent === 'information') return true;
    const triggers = [/qu'est-ce que/i, /c'est quoi/i, /explique/i, /comment fonctionne/i, /pourquoi/i, /qui a inventé/i, /histoire de/i, /origine de/i];
    for (let t of triggers) { if (t.test(text)) return true; }
    if (text.length > 120) return true;
    return false;
  }

  async search(query) {
    const cached = this.cache.get(query);
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
    if (results.length > 0) this.cache.set(query, { results, timestamp: Date.now() });
    return results.slice(0, 8);
  }

  async searchDuckDuckGo(query) {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1&language=fr-fr`;
    const response = await fetch(url);
    const data = await response.json();
    const results = [];
    if (data.AbstractText && data.AbstractText.length > 20) {
      results.push({ title: data.Heading || 'Résultat', content: data.AbstractText, source: data.AbstractSource || 'DuckDuckGo', url: data.AbstractURL || '', type: 'article', reliability: 0.85 });
    }
    if (data.RelatedTopics) {
      data.RelatedTopics.forEach(topic => {
        if (topic.Text && topic.Text.length > 30) {
          results.push({ title: topic.FirstURL?.split('/').pop() || 'Sujet', content: topic.Text, source: 'DuckDuckGo', url: topic.FirstURL || '', type: 'related', reliability: 0.75 });
        }
      });
    }
    return results;
  }

  async searchWikipedia(query) {
    const url = `https://fr.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*&srlimit=5`;
    const response = await fetch(url);
    const data = await response.json();
    if (!data.query?.search) return [];
    return data.query.search.map(r => ({ title: r.title, content: r.snippet.replace(/<[^>]+>/g, ''), source: 'Wikipedia', url: `https://fr.wikipedia.org/wiki/${encodeURIComponent(r.title)}`, type: 'encyclopedia', reliability: 0.9 }));
  }

  synthesizeResults(query, results) {
    if (!results || results.length === 0) return null;
    const mainResults = results.filter(r => r.reliability >= 0.7).slice(0, 3);
    if (mainResults.length === 0) return null;
    let synthesis = `**Concernant « ${query} » :**\n\n`;
    mainResults.forEach(r => { synthesis += `${r.content}\n\n`; });
    const sources = [...new Set(mainResults.map(r => r.source))];
    synthesis += `*Sources : ${sources.join(', ')}*`;
    return { synthesis, sources: mainResults.map(r => ({ title: r.title, url: r.url, source: r.source })), resultCount: results.length };
  }

  async searchAndSynthesize(query) {
    const results = await this.search(query);
    return this.synthesizeResults(query, results);
  }
  }
