'use client';

import { useEffect, useRef, useState } from 'react';

// BarcodeDetector ships in Chrome on Android, which most drivers use. Other
// browsers fall back to typing the code printed under the QR (COC-1).
interface DetectedBarcode {
  rawValue: string;
}
interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>;
}
type BarcodeDetectorCtor = new (opts: { formats: string[] }) => BarcodeDetectorLike;

interface Props {
  onResult: (code: string) => void;
}

export function QrScanner({ onResult }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [mode, setMode] = useState<'camera' | 'manual'>('camera');
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState('');

  useEffect(() => {
    if (mode !== 'camera') return;
    const Ctor = (globalThis as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
    if (!Ctor || !navigator.mediaDevices?.getUserMedia) {
      setMode('manual');
      setError('This browser cannot scan QR codes. Type the code printed under the QR instead.');
      return;
    }
    let stream: MediaStream | null = null;
    let timer: number | undefined;
    let stopped = false;
    const detector = new Ctor({ formats: ['qr_code'] });

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then((s) => {
        if (stopped) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = s;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = s;
        void video.play();
        timer = window.setInterval(async () => {
          if (!video.videoWidth) return;
          try {
            const [hit] = await detector.detect(video);
            if (hit?.rawValue) onResult(hit.rawValue.trim());
          } catch {
            // A frame that can't be read is normal; keep scanning.
          }
        }, 300);
      })
      .catch(() => {
        setMode('manual');
        setError('Camera not available. Type the code printed under the QR instead.');
      });

    return () => {
      stopped = true;
      if (timer) window.clearInterval(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [mode, onResult]);

  if (mode === 'manual') {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (manual.trim()) onResult(manual.trim().toUpperCase());
        }}
        style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
      >
        {error && (
          <div className="notice" data-tone="info">
            {error}
          </div>
        )}
        <label className="field">
          Shipment code
          <input
            className="input mono"
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            autoCapitalize="characters"
            autoComplete="off"
            placeholder="QR0204XX"
            style={{ fontSize: 22, minHeight: 56, letterSpacing: '0.1em' }}
          />
        </label>
        <button type="submit" className="btn btn-primary btn-driver" style={{ minHeight: 56, fontSize: 18 }}>
          Check code
        </button>
      </form>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="scanner">
        <video ref={videoRef} muted playsInline aria-label="Camera preview for scanning the shipment QR code" />
        <div className="frame" aria-hidden="true" />
      </div>
      <button type="button" className="btn btn-secondary" style={{ minHeight: 48 }} onClick={() => setMode('manual')}>
        Type the code instead
      </button>
    </div>
  );
}
