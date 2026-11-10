
export function generateUUID(): string {
  // Use the browser's native UUID generator when available.
  if (typeof globalThis.crypto !== "undefined" && globalThis.crypto.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  // Fallback UUID generation.
  const b = new Uint8Array(16);

  if (
    typeof globalThis.crypto !== "undefined" &&
    typeof globalThis.crypto.getRandomValues === "function"
  ) {
    globalThis.crypto.getRandomValues(b);
  } else {
    // Fallback for environments without Web Crypto.
    for (let i = 0; i < b.length; i++) {
      b[i] = Math.floor(Math.random() * 256);
    }
  }

  b[6] = ((b[6] ?? 0) & 0x0f) | 0x40;
  b[8] = ((b[8] ?? 0) & 0x3f) | 0x80;

  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");

  return [
    h.slice(0, 8),
    h.slice(8, 12),
    h.slice(12, 16),
    h.slice(16, 20),
    h.slice(20),
  ].join("-");
}
