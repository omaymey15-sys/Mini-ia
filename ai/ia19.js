class IA19 {
  constructor() {
    this.name = 'IA19 - Formatage Final';
    this.version = '5.0.0';
    this.description = 'Mise en forme finale et rendu visuel';
  }

  formatFinal(paragraphs, plan, images) {
    const allSections = [];
    
    for (let section of plan.sections) {
      const p = paragraphs[section.name];
      if (!p) continue;
      
      if (p.isImageSection) {
        allSections.push({ type: 'images', content: p.content, images: p.images, order: section.order });
      } else {
        allSections.push({ type: 'text', content: p.content, order: section.order });
      }
    }

    allSections.sort((a, b) => a.order - b.order);

    const finalContent = allSections.map(s => s.content).join('\n\n');
    
    const textOnly = finalContent.replace(/<[^>]+>/g, '');
    const wordCount = textOnly.split(/\s+/).filter(w => w.length > 0).length;
    const hasImages = allSections.some(s => s.type === 'images');
    const imageCount = allSections.reduce((sum, s) => sum + (s.images?.length || 0), 0);

    return {
      content: finalContent,
      metadata: {
        wordCount,
        readingTime: `${Math.ceil(wordCount / 200)} min`,
        hasImages,
        imageCount,
        totalSections: allSections.length,
        textSections: allSections.filter(s => s.type === 'text').length,
        imageSections: allSections.filter(s => s.type === 'images').length
      }
    };
  }
}
