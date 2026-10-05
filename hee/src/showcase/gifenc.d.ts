// Type declarations for the gifenc dependency (DP-W09 WU-4).
declare module "gifenc" {
  export function GIFEncoder(opts?: { auto?: boolean; initialCapacity?: number }): {
    writeFrame(
      index: Uint8Array,
      width: number,
      height: number,
      opts?: { palette?: number[][]; delay?: number; repeat?: number; transparent?: boolean },
    ): void;
    finish(): void;
    bytes(): Uint8Array;
    reset(): void;
  };
  export function quantize(
    rgba: Uint8Array | Uint8ClampedArray,
    maxColors: number,
    options?: Record<string, unknown>,
  ): number[][];
  export function applyPalette(
    rgba: Uint8Array | Uint8ClampedArray,
    palette: number[][],
    format?: string,
  ): Uint8Array;
}
