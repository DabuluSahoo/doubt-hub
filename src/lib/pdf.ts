import { jsPDF } from 'jspdf';

// Shared image cache
let imageCache = new Map<string, HTMLImageElement>();
// Shared canvas to reduce memory churn
let sharedCanvas: HTMLCanvasElement | null = null;

async function preloadImages(paths: string[], onProgress?: (pct: number) => void) {
  const CHUNK_SIZE = 5;
  let loaded = 0;
  const total = paths.length;
  if (total === 0) {
    if (onProgress) onProgress(100);
    return;
  }

  for (let i = 0; i < total; i += CHUNK_SIZE) {
    const chunk = paths.slice(i, i + CHUNK_SIZE);
    await Promise.all(chunk.map(async (path) => {
      if (imageCache.has(path)) {
        loaded++;
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
    }));
    
    // Yield to UI and report progress
    await new Promise(r => setTimeout(r, 0));
    if (onProgress) onProgress(Math.round((loaded / total) * 100));
  }
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
  // Clear cache before starting to free memory
  imageCache.clear();
  
  const allImagePaths: string[] = [];
  questions.forEach(q => {
    (q.question_images || []).forEach((img: any) => allImagePaths.push(img.storage_path));
    (q.solutions || []).forEach((sol: any) => {
      (sol.solution_images || []).forEach((img: any) => allImagePaths.push(img.storage_path));
    });
  });

  await preloadImages(allImagePaths, onProgress);

  const pageWidth = 210;
  const margin = 15;
  const contentWidth = pageWidth - (margin * 2);
  
  const totalHeight = 40 + calculateQuestionsHeight(questions, contentWidth);

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

  y = await renderQuestionsToDoc(doc, questions, y, margin, contentWidth);
  doc.save(`${subjectTitle.replace(/\s+/g, '_')}_DoubtHub.pdf`);
  
  // Clean up
  imageCache.clear();
}

export async function generateGlobalPDF(data: { title: string, questions: any[] }[], onProgress?: (pct: number) => void) {
  imageCache.clear();
  
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

  const pageWidth = 210;
  const margin = 15;
  const contentWidth = pageWidth - (margin * 2);
  
  let totalHeight = 40;
  data.forEach(sub => {
    totalHeight += 20; // Subject Title
    totalHeight += calculateQuestionsHeight(sub.questions, contentWidth);
    totalHeight += 10; // Extra padding between subjects
  });

  const doc = new jsPDF({
    orientation: 'p',
    unit: 'mm',
    format: [pageWidth, totalHeight],
    compress: true
  });

  let y = 20;
  doc.setFontSize(26);
  doc.text("DoubtHub - All Subjects", margin, y);
  y += 20;

  for (const subject of data) {
    doc.setFontSize(20);
    doc.setTextColor(124, 58, 237);
    doc.text(subject.title, margin, y);
    y += 12;
    doc.setTextColor(0, 0, 0);

    y = await renderQuestionsToDoc(doc, subject.questions, y, margin, contentWidth);
    y += 10;
  }

  doc.save(`DoubtHub_Full_Backup.pdf`);
  imageCache.clear();
}

function calculateQuestionsHeight(questions: any[], contentWidth: number): number {
  let h = 0;
  const tempDoc = new jsPDF();
  
  for (const q of questions) {
    h += 15; // Q Title
    if (q.description) {
      const lines = tempDoc.splitTextToSize(q.description, contentWidth);
      h += (lines.length * 5) + 5;
    }
    (q.question_images || []).forEach((imgData: any) => {
      const img = imageCache.get(imgData.storage_path);
      if (img) h += (contentWidth / (img.width / img.height)) + 10;
    });

    (q.solutions || []).forEach((sol: any) => {
      h += 10; // Sol Label
      if (sol.text_content) {
        const lines = tempDoc.splitTextToSize(sol.text_content, contentWidth);
        h += (lines.length * 5) + 5;
      }
      (sol.solution_images || []).forEach((imgData: any) => {
        const img = imageCache.get(imgData.storage_path);
        if (img) h += (contentWidth / (img.width / img.height)) + 10;
      });
    });
    h += 15; // Spacer
  }
  return h;
}

async function renderQuestionsToDoc(doc: jsPDF, questions: any[], startY: number, margin: number, contentWidth: number) {
  let y = startY;
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    
    // Yield more frequently for stability
    if (i % 2 === 0) await new Promise(r => setTimeout(r, 0));

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
      y = addContinuousImage(doc, imgInfo.storage_path, y, margin, contentWidth);
    }

    const sols = q.solutions || [];
    for (let j = 0; j < sols.length; j++) {
      const sol = sols[j];
      doc.setFontSize(12);
      doc.setTextColor(34, 197, 94);
      doc.text(`Sol ${sols.length > 1 ? j + 1 : ''}`, margin, y);
      y += 6;
      doc.setTextColor(0, 0, 0);

      if (sol.text_content) {
        doc.setFontSize(10);
        const lines = doc.splitTextToSize(sol.text_content, contentWidth);
        doc.text(lines, margin, y);
        y += (lines.length * 5) + 5;
      }

      for (const imgInfo of (sol.solution_images || [])) {
        y = addContinuousImage(doc, imgInfo.storage_path, y, margin, contentWidth);
      }
    }
    y += 10;
  }
  return y;
}

function addContinuousImage(doc: jsPDF, path: string, y: number, margin: number, contentWidth: number) {
  const img = imageCache.get(path);
  if (!img) return y;

  const ratio = img.width / img.height;
  const h = contentWidth / ratio;

  // Use shared canvas to save memory allocation
  if (!sharedCanvas) sharedCanvas = document.createElement('canvas');
  sharedCanvas.width = img.width;
  sharedCanvas.height = img.height;
  const ctx = sharedCanvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  
  const jpegData = sharedCanvas.toDataURL('image/jpeg', 0.6);
  doc.addImage(jpegData, 'JPEG', margin, y, contentWidth, h, undefined, 'FAST');
  
  return y + h + 10;
}
