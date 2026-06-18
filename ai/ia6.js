class IA6 {
  constructor() {
    this.name = 'IA6 - Analyse Images';
    this.version = '5.0.0';
    this.description = 'Analyse, filtrage et validation des images trouvées';
    this.minWidth = 200;
    this.minHeight = 150;
    this.maxImages = 6;
    this.blockedDomains = ['spam.com', 'malware.net'];
    this.allowedFormats = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
  }

  filterImages(images) {
    return images
      .filter(img => this.isValidImage(img))
      .filter(img => this.hasGoodDimensions(img))
      .filter(img => this.isSafeDomain(img))
      .filter(img => this.hasValidFormat(img))
      .slice(0, this.maxImages);
  }

  isValidImage(img) {
    return img && img.url && img.url.startsWith('http');
  }

  hasGoodDimensions(img) {
    const width = img.width || 800;
    const height = img.height || 600;
    return width >= this.minWidth && height >= this.minHeight;
  }

  isSafeDomain(img) {
    try {
      const url = new URL(img.url);
      return !this.blockedDomains.some(domain => url.hostname.includes(domain));
    } catch (e) {
      return false;
    }
  }

  hasValidFormat(img) {
    const url = img.url.toLowerCase();
    return this.allowedFormats.some(format => url.includes('.' + format) || url.includes('format=' + format));
  }

  rankImages(images, query) {
    const queryWords = query.toLowerCase().split(/\s+/);
    return images
      .map(img => {
        let score = 0;
        const title = (img.title || '').toLowerCase();
        queryWords.forEach(word => {
          if (title.includes(word)) score += 10;
        });
        if (img.source === 'Unsplash') score += 5;
        if (img.source === 'Wikipedia') score += 3;
        if (img.width >= 1000) score += 2;
        return { ...img, relevanceScore: score };
      })
      .sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  generateCaption(img, query) {
    if (img.title && img.title.length > 3) return img.title;
    return `Image : ${query}`;
  }

  analyseAndFilter(images, query) {
    const filtered = this.filterImages(images);
    const ranked = this.rankImages(filtered, query);
    return ranked.map(img => ({
      ...img,
      caption: this.generateCaption(img, query)
    }));
  }
}
