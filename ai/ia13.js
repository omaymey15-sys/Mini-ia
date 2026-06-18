class IA13 {
  constructor() {
    this.name = 'IA13 - Intégration Médias';
    this.version = '5.0.0';
    this.description = 'Intégration harmonieuse des images dans le texte';
  }

  integrateImages(paragraphs, images, plan) {
    if (!images || images.length === 0) return paragraphs;

    const imageSection = {
      name: 'images',
      order: Math.floor(plan.sections.length / 2),
      label: '🖼️ Illustrations',
      content: this.formatImagesHTML(images),
      isImageSection: true,
      images: images
    };

    const integrated = { ...paragraphs };
    integrated['images'] = imageSection;

    return integrated;
  }

  formatImagesHTML(images) {
    const imagesHTML = images.map((img, i) => `
      <div class="image-card" onclick="openImageModal('${img.url}', '${this.escapeHtml(img.caption || '')}', '${img.source || ''}', '${img.author || ''}')">
        <img src="${img.url}" alt="${this.escapeHtml(img.caption || 'Image')}" loading="lazy" onerror="this.style.display='none'">
        <div class="image-overlay">${img.source || 'Web'}</div>
        <div class="image-caption">
          <div>${this.escapeHtml(img.caption || 'Image')}</div>
          <div class="image-source">${img.source || 'Web'}${img.author ? ' · ' + img.author : ''}</div>
        </div>
      </div>
    `).join('');

    return `<div class="images-grid">${imagesHTML}</div>`;
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  formatFinalResponse(paragraphs, plan) {
    const sections = plan.sections
      .sort((a, b) => a.order - b.order)
      .map(section => {
        const paragraph = paragraphs[section.name];
        if (!paragraph) return '';
        if (paragraph.isImageSection) return paragraph.content;
        return `**${section.label}**\n${paragraph.content}`;
      })
      .filter(content => content.length > 0);

    const fullText = sections.join('\n\n');
    const wordCount = fullText.replace(/<[^>]+>/g, '').split(/\s+/).length;

    return {
      content: fullText,
      sections: sections.length,
      totalWords: wordCount,
      estimatedReadingTime: `${Math.ceil(wordCount / 200)} minute${wordCount > 200 ? 's' : ''}`,
      hasImages: Object.values(paragraphs).some(p => p.isImageSection)
    };
  }
      }
