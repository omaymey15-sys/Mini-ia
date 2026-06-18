class IA5 {
  constructor() {
    this.name = 'IA5 - Recherche Images';
    this.version = '5.0.0';
    this.description = 'Recherche et collecte d\'images depuis le web';
    this.cache = new Map();
    this.maxImages = 6;
  }

  async searchImages(query, count = 6) {
    const cacheKey = query.toLowerCase().trim();
    const cached = this.cache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < 3600000) return cached.images;

    const allImages = [];
    
    try {
      const unsplashImages = await this.searchUnsplash(query, count);
      allImages.push(...unsplashImages);
    } catch (e) {}

    try {
      const wikiImages = await this.searchWikipediaImages(query, count);
      allImages.push(...wikiImages);
    } catch (e) {}

    try {
      const ddgImages = await this.searchDuckDuckGoImages(query, count);
      allImages.push(...ddgImages);
    } catch (e) {}

    const uniqueImages = this.deduplicateImages(allImages).slice(0, count);
    this.cache.set(cacheKey, { images: uniqueImages, timestamp: Date.now() });
    return uniqueImages;
  }

  async searchUnsplash(query, count = 4) {
    try {
      const url = `https://unsplash.com/napi/search/photos?query=${encodeURIComponent(query)}&per_page=${count}`;
      const response = await fetch(url);
      const data = await response.json();
      if (!data.results) return [];
      return data.results.map(img => ({
        url: img.urls?.regular || img.urls?.small || '',
        thumbnail: img.urls?.thumb || '',
        title: img.alt_description || img.description || query,
        width: img.width || 800,
        height: img.height || 600,
        color: img.color || '#6366f1',
        author: img.user?.name || 'Unsplash',
        authorUrl: img.user?.links?.html || '',
        source: 'Unsplash',
        license: 'Unsplash License'
      }));
    } catch (e) { return []; }
  }

  async searchWikipediaImages(query, count = 3) {
    try {
      const url = `https://fr.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(query)}&prop=pageimages&format=json&pithumbsize=500&origin=*`;
      const response = await fetch(url);
      const data = await response.json();
      if (!data.query?.pages) return [];
      const images = [];
      for (let page of Object.values(data.query.pages)) {
        if (page.thumbnail) {
          images.push({
            url: page.thumbnail.source,
            thumbnail: page.thumbnail.source,
            title: page.title || query,
            width: page.thumbnail.width || 500,
            height: page.thumbnail.height || 300,
            source: 'Wikipedia',
            license: 'CC BY-SA'
          });
        }
      }
      return images;
    } catch (e) { return []; }
  }

  async searchDuckDuckGoImages(query, count = 3) {
    try {
      const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&iax=images&ia=images`;
      const response = await fetch(url);
      const data = await response.json();
      const images = [];
      if (data.Image && data.Image.length > 0) {
        images.push({
          url: data.Image,
          thumbnail: data.Image,
          title: query,
          source: 'DuckDuckGo',
          license: 'Web'
        });
      }
      return images;
    } catch (e) { return []; }
  }

  deduplicateImages(images) {
    const seen = new Set();
    return images.filter(img => {
      const key = img.url?.substring(0, 100) || '';
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}
