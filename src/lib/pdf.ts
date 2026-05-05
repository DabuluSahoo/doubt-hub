import { jsPDF } from 'jspdf';

// Cache for loaded images to avoid re-loading
const imageCache = new Map<string, HTMLImageElement>();

async function preloadImages(paths: string[]) {
  const promises = paths.map(async (path) => {
    if (imageCache.has(path)) return;
    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/doubt-images/${path}`;
    try {
      const img = await loadImage(url);
      imageCache.set(path, img);
    } catch (e) {
      console.error('Failed to preload image:', url);
    }
  });
  await Promise.all(promises);
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

export async function generateSubjectPDF(subjectTitle: string, questions: any[]) {
  // 1. Collect all image paths
  const allImagePaths: string[] = [];
  questions.forEach(q => {
    (q.question_images || []).forEach((img: any) => allImagePaths.push(img.storage_path));
    (q.solutions || []).forEach((sol: any) => {
      (sol.solution_images || []).forEach((img: any) => allImagePaths.push(img.storage_path));
    });
  });

  // 2. Preload all images in parallel
  await preloadImages(allImagePaths);

  const doc = new jsPDF();
  let y = 20;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - (margin * 2);

  doc.setFontSize(22);
  doc.setTextColor(124, 58, 237);
  doc.text(subjectTitle, margin, y);
  y += 15;
  doc.setTextColor(0, 0, 0);

  await addQuestionsToDoc(doc, questions, y, margin, contentWidth, pageHeight);
  doc.save(`${subjectTitle.replace(/\s+/g, '_')}_DoubtHub.pdf`);
}

export async function generateGlobalPDF(data: { title: string, questions: any[] }[]) {
  // 1. Collect all image paths
  const allImagePaths: string[] = [];
  data.forEach(sub => {
    sub.questions.forEach(q => {
      (q.question_images || []).forEach((img: any) => allImagePaths.push(img.storage_path));
      (q.solutions || []).forEach((sol: any) => {
        (sol.solution_images || []).forEach((img: any) => allImagePaths.push(img.storage_path));
      });
    });
  });

  // 2. Preload all images in parallel
  await preloadImages(allImagePaths);

  const doc = new jsPDF();
  let y = 20;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - (margin * 2);

  doc.setFontSize(26);
  doc.text("DoubtHub - All Subjects", margin, y);
  y += 20;

  for (const subject of data) {
    if (y > pageHeight - 40) {
      doc.addPage();
      y = 20;
    }
    
    doc.setFontSize(20);
    doc.setTextColor(124, 58, 237);
    doc.text(subject.title, margin, y);
    y += 12;
    doc.setTextColor(0, 0, 0);

    y = await addQuestionsToDoc(doc, subject.questions, y, margin, contentWidth, pageHeight);
    
    if (y < pageHeight) {
      doc.addPage();
      y = 20;
    }
  }

  doc.save(`DoubtHub_Full_Backup.pdf`);
}

async function addQuestionsToDoc(doc: jsPDF, questions: any[], startY: number, margin: number, contentWidth: number, pageHeight: number) {
  let y = startY;

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    
    // Page break check for title
    if (y > pageHeight - 25) {
      doc.addPage();
      y = 20;
    }

    doc.setFontSize(14);
    doc.setTextColor(124, 58, 237);
    doc.text(`Q${i + 1}: ${q.title}`, margin, y);
    y += 8;
    doc.setTextColor(0, 0, 0);

    if (q.description) {
      doc.setFontSize(10);
      const lines = doc.splitTextToSize(q.description, contentWidth);
      // Check if text needs page break
      if (y + (lines.length * 5) > pageHeight - 15) {
        doc.addPage();
        y = 20;
      }
      doc.text(lines, margin, y);
      y += (lines.length * 5) + 5;
    }

    const qImgs = (q.question_images || []).sort((a: any, b: any) => a.page_order - b.page_order);
    for (const img of qImgs) {
      y = addCachedImageToPDF(doc, img.storage_path, y, margin, contentWidth, pageHeight);
    }

    // Solutions
    const sols = q.solutions || [];
    for (let j = 0; j < sols.length; j++) {
      const sol = sols[j];
      
      if (y > pageHeight - 20) {
        doc.addPage();
        y = 20;
      }
      
      doc.setFontSize(12);
      doc.setTextColor(34, 197, 94);
      doc.text(`Sol ${sols.length > 1 ? j + 1 : ''}`, margin, y);
      y += 6;
      doc.setTextColor(0, 0, 0);

      if (sol.text_content) {
        doc.setFontSize(10);
        const lines = doc.splitTextToSize(sol.text_content, contentWidth);
        if (y + (lines.length * 5) > pageHeight - 15) {
          doc.addPage();
          y = 20;
        }
        doc.text(lines, margin, y);
        y += (lines.length * 5) + 5;
      }

      const solImgs = (sol.solution_images || []).sort((a: any, b: any) => a.page_order - b.page_order);
      for (const img of solImgs) {
        y = addCachedImageToPDF(doc, img.storage_path, y, margin, contentWidth, pageHeight);
      }
    }
    y += 10;
  }
  return y;
}

function addCachedImageToPDF(doc: jsPDF, path: string, y: number, margin: number, contentWidth: number, pageHeight: number) {
  const img = imageCache.get(path);
  if (!img) return y;

  const imgProps = doc.getImageProperties(img);
  const ratio = imgProps.width / imgProps.height;
  
  let drawWidth = contentWidth;
  let drawHeight = drawWidth / ratio;
  const bottomMargin = 15;
  const availableSpace = pageHeight - y - bottomMargin;

  // Adaptive logic:
  // 1. If it fits, draw it.
  // 2. If it doesn't fit:
  //    a. If we have > 30% of page left, scale it down to fit.
  //    b. Else, move to next page.
  
  if (drawHeight > availableSpace) {
    if (availableSpace > pageHeight * 0.35) {
      // Scale down to fit available space
      drawHeight = availableSpace;
      drawWidth = drawHeight * ratio;
      // If it became wider than content area (unlikely with ratio), cap it
      if (drawWidth > contentWidth) {
        drawWidth = contentWidth;
        drawHeight = drawWidth / ratio;
      }
      const xOffset = margin + (contentWidth - drawWidth) / 2;
      doc.addImage(img, 'WEBP', xOffset, y, drawWidth, drawHeight);
      return y + drawHeight + 10;
    } else {
      // Move to next page
      doc.addPage();
      y = 20;
      // Re-evaluate for full page
      drawWidth = contentWidth;
      drawHeight = drawWidth / ratio;
      if (drawHeight > pageHeight - 40) {
        drawHeight = pageHeight - 40;
        drawWidth = drawHeight * ratio;
      }
      const xOffset = margin + (contentWidth - drawWidth) / 2;
      doc.addImage(img, 'WEBP', xOffset, y, drawWidth, drawHeight);
      return y + drawHeight + 10;
    }
  }

  const xOffset = margin + (contentWidth - drawWidth) / 2;
  doc.addImage(img, 'WEBP', xOffset, y, drawWidth, drawHeight);
  return y + drawHeight + 10;
}
