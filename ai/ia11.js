class IA11 {
  constructor() {
    this.name = 'IA11 - Description Images';
    this.version = '5.0.0';
    this.description = 'Génération de descriptions pour les images';
  }

  generateImageDescription(image, query, index) {
    const captions = [
      `**Image ${index + 1}** : ${image.caption || query}`,
      `**Illustration ${index + 1}** — ${image.caption || query}`,
      `**Figure ${index + 1}** : ${image.caption || query}`
    ];
    return captions[index % captions.length];
  }

  generateImageContext(query, imageCount) {
    if (imageCount === 0) return 'Aucune image trouvée pour cette recherche.';
    if (imageCount === 1) return `Une image trouvée pour « ${query} ».`;
    return `${imageCount} images trouvées pour « ${query} ».`;
  }

  describeAllImages(images, query) {
    if (!images || images.length === 0) return { descriptions: [], context: 'Aucune image disponible.' };
    return {
      descriptions: images.map((img, i) => this.generateImageDescription(img, query, i)),
      context: this.generateImageContext(query, images.length),
      imageCount: images.length
    };
  }
}
