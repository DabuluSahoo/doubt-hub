'use client';
import { useState, useCallback, useEffect } from 'react';
import { compressImage } from '@/lib/compress';
import { ImagePlus, X } from 'lucide-react';

export type PreviewFile = {
  id: string;
  file: Blob;
  preview: string;
  originalSize: number;
  compressedSize: number;
  name: string;
};

type Props = {
  onFilesChange: (files: PreviewFile[]) => void;
  maxFiles?: number;
  label?: string;
};

export default function UploadZone({ onFilesChange, maxFiles = 20, label = 'question images' }: Props) {
  const [previews, setPreviews] = useState<PreviewFile[]>([]);
  const [dragging, setDragging] = useState(false);
  const [compressing, setCompressing] = useState(false);

  const processFiles = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setCompressing(true);
    const arr = Array.from(files).filter((f) => f.type.startsWith('image/'));
    const results: PreviewFile[] = [];
    for (const file of arr) {
      const compressed = await compressImage(file);
      const preview = URL.createObjectURL(compressed);
      results.push({
        id: `${Date.now()}-${Math.random()}`,
        file: compressed,
        preview,
        originalSize: file.size,
        compressedSize: compressed.size,
        name: file.name,
      });
    }
    setCompressing(false);
    setPreviews((prev) => {
      const next = [...prev, ...results].slice(0, maxFiles);
      setTimeout(() => onFilesChange(next), 0);
      return next;
    });
  }, [maxFiles, onFilesChange]);

  const remove = (id: string) => {
    setPreviews((prev) => {
      const next = prev.filter((p) => p.id !== id);
      setTimeout(() => onFilesChange(next), 0);
      return next;
    });
  };

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (e.clipboardData?.files?.length) {
        processFiles(e.clipboardData.files);
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [processFiles]);

  return (
    <div>
      <label
        className={`upload-zone ${dragging ? 'dragging' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); processFiles(e.dataTransfer.files); }}
      >
        <input
          type="file"
          multiple
          accept="image/*"
          onChange={(e) => processFiles(e.target.files)}
        />
        <div className="upload-zone-icon">
          {compressing ? '⚙️' : <ImagePlus size={36} color="var(--accent-light)" />}
        </div>
        <div className="upload-zone-text">
          {compressing
            ? 'Compressing images...'
            : <><strong>Click to upload</strong>, drag & drop, or paste (Ctrl+V)</>}
        </div>
        <div className="upload-zone-hint">
          PNG, JPG, WEBP — auto-compressed to WebP · max {maxFiles} images
        </div>
      </label>

      {previews.length > 0 && (
        <div className="image-preview-strip">
          {previews.map((p) => (
            <div key={p.id} className="image-preview-item">
              <img src={p.preview} alt={p.name} />
              <div className="compression-badge">
                -{Math.round((1 - p.compressedSize / p.originalSize) * 100)}%
              </div>
              <div className="image-preview-remove" onClick={() => remove(p.id)}>
                <X size={10} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
