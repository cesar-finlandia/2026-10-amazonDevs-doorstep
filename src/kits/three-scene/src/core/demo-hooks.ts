// Requirement IDs: HEE-KIT-01
export interface Demo3dApi { play(shot: string): void; shots: string[]; fpsProbe(ms: number): Promise<number>; ready: boolean }

type Demo3dWindow = { __demo3d?: Demo3dApi };

function demo3dHost(): Demo3dWindow {
  if (typeof window !== "undefined") return window as unknown as Demo3dWindow;
  return globalThis as Demo3dWindow;
}

export function installDemoHooks(args: { container: HTMLElement; name: string; shots: () => string[];
  play: (shot: string) => void; fpsProbe: (ms: number) => Promise<number> }): () => void {
  const { container, name } = args;
  container.setAttribute("data-demo-3d", name);
  const api: Demo3dApi = {
    play: (shot: string): void => {
      if (!args.shots().includes(shot)) {
        console.warn(`[three-scene] unknown shot: ${shot}`);
        return;
      }
      args.play(shot);
    },
    get shots(): string[] {
      return args.shots();
    },
    fpsProbe: (ms: number): Promise<number> => args.fpsProbe(ms),
    ready: true,
  };
  const host = demo3dHost();
  host.__demo3d = api;
  let uninstalled = false;
  return (): void => {
    if (uninstalled) return;
    uninstalled = true;
    container.removeAttribute("data-demo-3d");
    if (demo3dHost().__demo3d === api) delete demo3dHost().__demo3d;
  };
}
