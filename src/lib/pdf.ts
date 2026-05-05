import { jsPDF } from 'jspdf';

export async function generateSubjectPDF(subjectTitle: string, questions: any[]) {
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
    
    if (y > pageHeight - 30) {
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
      doc.text(lines, margin, y);
      y += (lines.length * 5) + 5;
    }

    const qImgs = (q.question_images || []).sort((a: any, b: any) => a.page_order - b.page_order);
    for (const img of qImgs) {
      y = await addImageToPDF(doc, img.storage_path, y, margin, contentWidth, pageHeight);
    }

    // Solutions
    const sols = q.solutions || [];
    for (let j = 0; j < sols.length; j++) {
      const sol = sols[j];
      if (y > pageHeight - 20) { doc.addPage(); y = 20; }
      
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

      const solImgs = (sol.solution_images || []).sort((a: any, b: any) => a.page_order - b.page_order);
      for (const img of solImgs) {
        y = await addImageToPDF(doc, img.storage_path, y, margin, contentWidth, pageHeight);
      }
    }
    y += 10;
  }
  return y;
}

async function addImageToPDF(doc: jsPDF, path: string, y: number, margin: number, contentWidth: number, pageHeight: number) {
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/doubt-images/${path}`;
  
  try {
    const img = await loadImage(url);
    const imgProps = doc.getImageProperties(img);
    const ratio = imgProps.width / imgProps.height;
    const displayHeight = contentWidth / ratio;

    if (y + displayHeight > pageHeight - 20) {
      doc.addPage();
      y = 20;
    }

    doc.addImage(img, 'WEBP', margin, y, contentWidth, displayHeight);
    return y + displayHeight + 10;
  } catch (e) {
    console.error('Failed to load image for PDF:', url);
    return y;
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
