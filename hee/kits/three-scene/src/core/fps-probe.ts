// Requirement IDs: HEE-KIT-01
export type Raf = (cb: (t: number) => void) => void;

export function measureFps(ms: number, raf: Raf, invalidate: () => void): Promise<number> {
  return new Promise((resolve) => {
    const t0 = performance.now();
    let frames = 0;
    const tick = (): void => {
      invalidate();
      frames++;
      const now = performance.now();
      if (now - t0 >= ms) {
        const fps = frames / ((now - t0) / 1000);
        resolve(Math.round(fps * 10) / 10);
        return;
      }
      raf(tick);
    };
    raf(tick);
  });
}
