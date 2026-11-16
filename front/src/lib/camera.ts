/**
 * The scan sheet's browser parts (deploy 90), as app.'s (core/app/static/app.js setupScan and shrink): the barcode reader, the
 * zxing library of app. (static/zxing.min.js, Apache 2.0, LICENSE-zxing.txt beside it) loaded on first use from this app, reading
 * EAN-13, EAN-8, UPC-A and UPC-E from the back camera; and a photo made smaller before it is sent. Browser only.
 */
import { shrunkSize } from './scan.js';

interface ZXingReader {
  decodeFromConstraints(c: MediaStreamConstraints, video: HTMLVideoElement, cb: (res: { getText(): string } | null) => void): Promise<unknown>;
  reset(): void;
}
interface ZXingLib {
  BrowserMultiFormatReader: new (hints: Map<unknown, unknown>) => ZXingReader;
  DecodeHintType: { POSSIBLE_FORMATS: unknown };
  BarcodeFormat: Record<'EAN_13' | 'EAN_8' | 'UPC_A' | 'UPC_E', unknown>;
}
declare global {
  interface Window {
    ZXing?: ZXingLib;
  }
}

let loading: Promise<ZXingLib> | null = null;

/** The zxing library, loaded once (a script of this app: the CSP allows 'self'). */
function library(): Promise<ZXingLib> {
  if (window.ZXing) return Promise.resolve(window.ZXing);
  loading ??= new Promise<ZXingLib>((ok, bad) => {
    const s = document.createElement('script');
    s.src = '/zxing.min.js';
    s.onload = () => (window.ZXing ? ok(window.ZXing) : bad(new Error('the scanner did not load')));
    s.onerror = () => {
      loading = null;
      bad(new Error('the scanner did not load'));
    };
    document.head.append(s);
  });
  return loading;
}

/** Why the camera did not start, in plain words. */
export function cameraProblem(e: unknown): string {
  const name = (e as { name?: string })?.name;
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'The camera is not allowed for this app: type the digits instead.';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'No camera here: type the digits.';
  return 'The camera did not start: type the digits instead.';
}

export const hasCamera = () => typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;

/**
 * The back camera into the video, reading barcodes until stop() (or the first code: onCode gets it once, and the camera stops).
 * Rejects when the camera does not start (cameraProblem says why).
 */
export async function startScanner(video: HTMLVideoElement, onCode: (code: string) => void): Promise<() => void> {
  const Z = await library();
  const hints = new Map();
  hints.set(Z.DecodeHintType.POSSIBLE_FORMATS, [Z.BarcodeFormat.EAN_13, Z.BarcodeFormat.EAN_8, Z.BarcodeFormat.UPC_A, Z.BarcodeFormat.UPC_E]);
  const reader = new Z.BrowserMultiFormatReader(hints);
  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    try {
      reader.reset();
    } catch {
      /* already stopped */
    }
    const s = video.srcObject as MediaStream | null;
    s?.getTracks().forEach((t) => t.stop());
    video.srcObject = null;
  };
  try {
    await reader.decodeFromConstraints({ video: { facingMode: 'environment' } }, video, (res) => {
      if (res && !stopped) {
        const code = res.getText();
        stop();
        onCode(code);
      }
    });
  } catch (e) {
    stop();
    throw e;
  }
  return stop;
}

/**
 * A photo made smaller (at most 1600 px, JPEG 0.85), as app.'s shrink: faster on mobile data, and a format the reader takes (an
 * iPhone's HEIC comes out as JPEG). If the browser cannot open it, it is sent as it is.
 */
export async function shrink(file: Blob): Promise<Blob> {
  let img: ImageBitmap;
  try {
    img = await createImageBitmap(file);
  } catch {
    return file;
  }
  const { width, height } = shrunkSize(img.width, img.height);
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  c.getContext('2d')?.drawImage(img, 0, 0, width, height);
  img.close();
  return new Promise((ok) => c.toBlob((b) => ok(b ?? file), 'image/jpeg', 0.85));
}
