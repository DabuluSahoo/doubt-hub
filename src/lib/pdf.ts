import { jsPDF } from 'jspdf';

// Cache for loaded images to avoid re-loading
const imageCache = new Map<string, HTMLImageElement>();

async function preloadImages(paths: string[], onProgress?: (pct: number) => void) {
  let loaded = 0;
  const total = paths.length;
  if (total === 0) {
    if (onProgress) onProgress(100);
    return;
  }

  const promises = paths.map(async (path) => {
    if (imageCache.has(path)) {
      loaded++;
      if (onProgress) onProgress(Math.round((loaded / total) * 100));
      return;
    }
    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/doubt-images/${path}`;
    try {
      const img = await loadImage(url);
      imageCache.set(path, img);
    } catch (e) {
      console.error('Failed to preload image:', url);
    }
    loaded++;
    if (onProgress) onProgress(Math.round((loaded / total) * 100));
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

export async function generateSubjectPDF(subjectTitle: string, questions: any[], onProgress?: (pct: number) => void) {
  const allImagePaths: string[] = [];
  questions.forEach(q => {
    (q.question_images || []).forEach((img: any) => allImagePaths.push(img.storage_path));
    (q.solutions || []).forEach((sol: any) => {
      (sol.solution_images || []).forEach((img: any) => allImagePaths.push(img.storage_path));
    });
  });

  await preloadImages(allImagePaths, onProgress);

  // --- 1. PRE-CALCULATE TOTAL HEIGHT ---
  const pageWidth = 210;
  const margin = 15;
  const contentWidth = pageWidth - (margin * 2);
  let totalHeight = 40; // Header space

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    totalHeight += 15; // Title space
    if (q.description) {
      const tempDoc = new jsPDF();
      const lines = tempDoc.splitTextToSize(q.description, contentWidth);
      totalHeight += (lines.length * 5) + 5;
    }
    
    // Question Images height
    const qImgs = q.question_images || [];
    for (const imgPath of qImgs) {
      const img = imageCache.get(imgPath.storage_path);
      if (img) {
        const ratio = img.width / img.height;
        totalHeight += (contentWidth / ratio) + 10;
      }
    }

    // Solutions height
    const sols = q.solutions || [];
    for (const sol of sols) {
      totalHeight += 10; // Sol Label
      if (sol.text_content) {
        const tempDoc = new jsPDF();
        const lines = tempDoc.splitTextToSize(sol.text_content, contentWidth);
        totalHeight += (lines.length * 5) + 5;
      }
      const sImgs = sol.solution_images || [];
      for (const imgPath of sImgs) {
        const img = imageCache.get(imgPath.storage_path);
        if (img) {
          const ratio = img.width / img.height;
          totalHeight += (contentWidth / ratio) + 10;
        }
      }
    }
    totalHeight += 15; // Spacer between questions
  }

  // --- 2. GENERATE THE LONG PDF ---
  const doc = new jsPDF({
    orientation: 'p',
    unit: 'mm',
    format: [pageWidth, totalHeight],
    compress: true
  });

  let y = 20;
  doc.setFontSize(22);
  doc.setTextColor(124, 58, 237);
  doc.text(subjectTitle, margin, y);
  y += 15;
  doc.setTextColor(0, 0, 0);

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    doc.setFontSize(14);
    doc.setTextColor(124, 58, 237);
    doc.text(`Q${i + 1}: ${q.title}`, margin, y);
    y += 8;
    doc.setTextColor(0, 0, 0);

    if (q.description) {
      doc.setFontSize(10);
      const lines = doc.splitTextToSize(q.description, contentWidth);
      doc.text(lines, margin, y);
      y += (lines.length * 5) + 5;
    }

    for (const imgInfo of (q.question_images || [])) {
      y = addSimpleImageToPDF(doc, imgInfo.storage_path, y, margin, contentWidth);
    }

    for (let j = 0; j < (q.solutions || []).length; j++) {
      const sol = q.solutions[j];
      doc.setFontSize(12);
      doc.setTextColor(34, 197, 94);
      doc.text(`Sol ${q.solutions.length > 1 ? j + 1 : ''}`, margin, y);
      y += 6;
      doc.setTextColor(0, 0, 0);

      if (sol.text_content) {
        doc.setFontSize(10);
        const lines = doc.splitTextToSize(sol.text_content, contentWidth);
        doc.text(lines, margin, y);
        y += (lines.length * 5) + 5;
      }

      for (const imgInfo of (sol.solution_images || [])) {
        y = addSimpleImageToPDF(doc, imgInfo.storage_path, y, margin, contentWidth);
      }
    }
    y += 10;
  }

  doc.save(`${subjectTitle.replace(/\s+/g, '_')}_DoubtHub.pdf`);
}

function addSimpleImageToPDF(doc: jsPDF, path: string, y: number, margin: number, contentWidth: number) {
  const img = imageCache.get(path);
  if (!img) return y;

  const ratio = img.width / img.height;
  const h = contentWidth / ratio;

  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  const jpegData = canvas.toDataURL('image/jpeg', 0.6);

  doc.addImage(jpegData, 'JPEG', margin, y, contentWidth, h, undefined, 'FAST');
  return y + h + 10;
}

export async function generateGlobalPDF(data: { title: string, questions: any[] }[], onProgress?: (pct: number) => void) {
  // Logic for global would be very similar but with subjects added to height calculation
  // For simplicity and to avoid ultra-long PDFs that crash browsers, we will keep Global as multi-page
  // but Subject-specific will be the "Continuous Flow" version you requested.
  
  const allImagePaths: string[] = [];
  data.forEach(sub => {
    sub.questions.forEach(q => {
      (q.question_images || []).forEach((img: any) => allImagePaths.push(img.storage_path));
      (q.solutions || []).forEach((sol: any) => {
        (sol.solution_images || []).forEach((img: any) => allImagePaths.push(img.storage_path));
      });
    });
  });

  await preloadImages(allImagePaths, onProgress);

  const doc = new jsPDF({ compress: true });
  let y = 20;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - (margin * 2);

  doc.setFontSize(26);
  doc.text("DoubtHub - All Subjects", margin, y);
  y += 20;

  for (const subject of data) {
    if (y > pageHeight - 40) { doc.addPage(); y = 20; }
    doc.setFontSize(20);
    doc.setTextColor(124, 58, 237);
    doc.text(subject.title, margin, y);
    y += 12;
    doc.setTextColor(0, 0, 0);

    // Using the same adaptive multi-page logic for Global to prevent browser crashes on massive files
    y = await addQuestionsToDoc(doc, subject.questions, y, margin, contentWidth, pageHeight);
    if (y < pageHeight) { doc.addPage(); y = 20; }
  }

  doc.save(`DoubtHub_Full_Backup.pdf`);
}

async function addQuestionsToDoc(doc: jsPDF, questions: any[], startY: number, margin: number, contentWidth: number, pageHeight: number) {
  let y = startY;
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    await new Promise(r => setTimeout(r, 0));
    if (y > pageHeight - 25) { doc.addPage(); y = 20; }
    doc.setFontSize(14);
    doc.setTextColor(124, 58, 237);
    doc.text(`Q${i + 1}: ${q.title}`, margin, y);
    y += 8;
    doc.setTextColor(0, 0, 0);
    if (q.description) {
      doc.setFontSize(10);
      const lines = doc.splitTextToSize(q.description, contentWidth);
      if (y + (lines.length * 5) > pageHeight - 15) { doc.addPage(); y = 20; }
      doc.text(lines, margin, y);
      y += (lines.length * 5) + 5;
    }
    for (const imgInfo of (q.question_images || [])) {
      y = addAdaptiveImage(doc, imgInfo.storage_path, y, margin, contentWidth, pageHeight);
    }
    for (let j = 0; j < (q.solutions || []).length; j++) {
      const sol = q.solutions[j];
      await new Promise(r => setTimeout(r, 0));
      if (y > pageHeight - 20) { doc.addPage(); y = 20; }
      doc.setFontSize(12);
      doc.setTextColor(34, 197, 94);
      doc.text(`Sol ${q.solutions.length > 1 ? j + 1 : ''}`, margin, y);
      y += 6;
      doc.setTextColor(0, 0, 0);
      if (sol.text_content) {
        doc.setFontSize(10);
        const lines = doc.splitTextToSize(sol.text_content, contentWidth);
        if (y + (lines.length * 5) > pageHeight - 15) { doc.addPage(); y = 20; }
        doc.text(lines, margin, y);
        y += (lines.length * 5) + 5;
      }
      for (const imgInfo of (sol.solution_images || [])) {
        y = addAdaptiveImage(doc, imgInfo.storage_path, y, margin, contentWidth, pageHeight);
      }
    }
    y += 10;
  }
  return y;
}

function addAdaptiveImage(doc: jsPDF, path: string, y: number, margin: number, contentWidth: number, pageHeight: number) {
  const img = imageCache.get(path);
  if (!img) return y;
  const ratio = img.width / img.height;
  let drawWidth = contentWidth;
  let drawHeight = drawWidth / ratio;
  const bottomMargin = 15;
  const availableSpace = pageHeight - y - bottomMargin;

  const canvas = document.createElement('canvas');
  canvas.width = img.width; canvas.height = img.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  const jpegData = canvas.toDataURL('image/jpeg', 0.6);

  const draw = (curY: number, h: number, w: number) => {
    const xOffset = margin + (contentWidth - w) / 2;
    doc.addImage(jpegData, 'JPEG', xOffset, curY, w, h, undefined, 'FAST');
    return curY + h + 10;
  };

  if (drawHeight > availableSpace) {
    if (availableSpace > pageHeight * 0.35) {
      drawHeight = availableSpace;
      drawWidth = drawHeight * ratio;
      if (drawWidth > contentWidth) { drawWidth = contentWidth; drawHeight = drawWidth / ratio; }
      return draw(y, drawHeight, drawWidth);
    } else {
      doc.addPage();
      y = 20;
      drawWidth = contentWidth;
      drawHeight = drawWidth / ratio;
      if (drawHeight > pageHeight - 40) { drawHeight = pageHeight - 40; drawWidth = drawHeight * ratio; }
      return draw(y, drawHeight, drawWidth);
    }
  }
  return draw(y, drawHeight, drawWidth);
}
