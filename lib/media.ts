/**
 * Shared media helpers for the guest-facing menu.
 *
 * Two hot-path concerns live here:
 *  - `thumbUrl` keeps the menu from shipping full-resolution originals for
 *    88px-wide cards, which is the dominant cost on restaurant wifi.
 *  - `playChime` reuses one AudioContext. Browsers cap concurrent contexts
 *    (~6 on Chrome/Safari); constructing a fresh one per add-to-cart both
 *    leaks and eventually starts throwing or blocking on the main thread.
 */

const VIDEO_RE = /\.(mp4|webm|ogg|mov|m4v)$/i;

export function isVideoUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return VIDEO_RE.test(url) || url.includes('/video/upload/');
}

/**
 * Ask the CDN for a right-sized, auto-format image.
 *
 * Only rewrites Cloudinary-style `/image/upload/` URLs (including the custom
 * res.tastefy.food domain, which fronts the same origin). Anything else — R2,
 * Unsplash, a bare path — is returned untouched, so an unrecognised host
 * degrades to the original behaviour rather than a broken image.
 */
export function thumbUrl(url: string | null | undefined, width: number): string {
  if (!url) return '';
  if (isVideoUrl(url)) return url;

  const marker = '/image/upload/';
  const idx = url.indexOf(marker);
  if (idx === -1) return url;

  const after = url.slice(idx + marker.length);
  // Already transformed (a transform segment precedes the version/public id).
  if (/^[a-z]_[^/]*\//.test(after)) return url;

  return `${url.slice(0, idx + marker.length)}f_auto,q_auto,c_fill,w_${width}/${after}`;
}

let sharedAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext || (window as any).webkitAudioContext;
  if (!Ctor) return null;

  if (!sharedAudioCtx) {
    try {
      sharedAudioCtx = new Ctor();
    } catch {
      return null;
    }
  }

  // iOS suspends the context when the page backgrounds; resume is a no-op otherwise.
  if (sharedAudioCtx.state === 'suspended') {
    void sharedAudioCtx.resume().catch(() => {});
  }

  return sharedAudioCtx;
}

/** Two-tone confirmation chime (C6 → E6). Silent and harmless if audio is blocked. */
export function playChime(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const playNote = (freq: number, startTime: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);

      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.15, startTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 1.0);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 1.0);
      // Release the nodes once they've finished so repeated adds don't accumulate.
      osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
      };
    };

    playNote(1046.5, ctx.currentTime);
    playNote(1318.51, ctx.currentTime + 0.1);
  } catch {
    // Ignore if audio fails or is blocked by browser policies.
  }
}
