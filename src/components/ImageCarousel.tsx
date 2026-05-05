'use client';
import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

type Props = { images: string[]; maxHeight?: number };

export default function ImageCarousel({ images, maxHeight = 520 }: Props) {
  const [idx, setIdx] = useState(0);
  if (!images || images.length === 0) return null;

  const prev = () => setIdx((i) => (i - 1 + images.length) % images.length);
  const next = () => setIdx((i) => (i + 1) % images.length);

  return (
    <div>
      <div className="carousel" style={{ maxHeight }}>
        <div
          className="carousel-track"
          style={{ transform: `translateX(-${idx * 100}%)` }}
        >
          {images.map((src, i) => (
            <div className="carousel-slide" key={i}>
              <img
                src={src}
                alt={`Page ${i + 1}`}
                style={{ maxHeight, objectFit: 'contain', width: '100%', background: '#000' }}
              />
            </div>
          ))}
        </div>

        {images.length > 1 && (
          <div className="carousel-controls">
            <button className="carousel-btn" onClick={prev}><ChevronLeft size={18} /></button>
            <button className="carousel-btn" onClick={next}><ChevronRight size={18} /></button>
          </div>
        )}

        {images.length > 1 && (
          <div className="carousel-counter">
            {idx + 1} / {images.length}
          </div>
        )}
      </div>

      {images.length > 1 && (
        <div className="carousel-dots">
          {images.map((_, i) => (
            <div
              key={i}
              className={`carousel-dot ${i === idx ? 'active' : ''}`}
              onClick={() => setIdx(i)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
