const crypto = require('crypto');

class SearchService {
  constructor(pool) {
    this.pool = pool;
    this.cacheHits = 0;
    this.cacheMisses = 0;
  }

  async search(query, options = {}) {
    const cached = await this.getFromCache(query);
    if (cached) { this.cacheHits++; return { source: 'cache', results: cached }; }
    this.cacheMisses++;

    const localResults = await this.searchLocal(query);
    if (localResults && localResults.length > 0) {
      return { source: 'local', results: localResults };
    }

    const webResults = await this.searchWeb(query);
    if (webResults && webResults.length > 0) {
      await this.saveToCache(query, webResults);
      return { source: 'web', results: webResults };
    }

    return { source: 'none', results: [] };
  }

  async searchLocal(query) {
    const keywords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    if (keywords.length === 0) return [];
    const result = await this.pool.query(
      'SELECT DISTINCT ON (sentence) sentence, keyword, category FROM knowledge WHERE keyword = ANY($1) LIMIT 10',
      [keywords]
    );
    return result.rows.map(r => ({ title: r.keyword, content: r.sentence, source: 'Base connaissances', category: r.category }));
  }

  async searchWeb(query) {
    const results = [];
    try {
      const res = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&language=fr-fr`);
      const data = await res.json();
      if (data.AbstractText) results.push({ title: data.Heading || 'Résultat', content: data.AbstractText, source: 'DuckDuckGo', url: data.AbstractURL || '' });
    } catch (e) {}
    return results;
  }

  async getFromCache(query) {
    const hash = crypto.createHash('sha256').update(query.toLowerCase().trim()).digest('hex');
    const result = await this.pool.query('SELECT results FROM search_cache WHERE query_hash = $1 AND expires_at > NOW()', [hash]);
    return result.rows.length > 0 ? result.rows[0].results : null;
  }

  async saveToCache(query, results) {
    const hash = crypto.createHash('sha256').update(query.toLowerCase().trim()).digest('hex');
    await this.pool.query(
      `INSERT INTO search_cache (query_hash, query_text, results, result_count)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (query_hash) DO UPDATE SET results = $3, result_count = $4, expires_at = NOW() + INTERVAL '24 hours'`,
      [hash, query, JSON.stringify(results), results.length]
    );
  }

  getStats() {
    return {
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses,
      hitRatio: this.cacheHits + this.cacheMisses > 0 ? (this.cacheHits / (this.cacheHits + this.cacheMisses) * 100).toFixed(1) + '%' : '0%'
    };
  }
}

module.exports = SearchService;
