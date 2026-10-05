"use client";

import { useEffect, useState } from "react";
import type { Application } from "pixi.js";

/**
 * Create a PixiJS Application attached to the supplied container ref.
 *
 * The pixi.js module is imported dynamically inside the effect so it is never
 * loaded server-side (the component that uses this hook can be rendered by
 * Next.js without blowing up on missing `window` / WebGL).
 */
export function usePixiApp(containerRef: React.RefObject<HTMLElement | null>) {
  const [app, setApp] = useState<Application | null>(null);

  useEffect(() => {
    let cancelled = false;
    let created: Application | null = null;

    async function init() {
      const PIXI = await import("pixi.js");
      const container = containerRef.current;
      if (!container || cancelled) return;

      created = new PIXI.Application();
      await created.init({
        resizeTo: container,
        backgroundAlpha: 0,
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      });

      if (cancelled) {
        created.destroy({ removeView: true }, { children: true, texture: true });
        return;
      }

      container.appendChild(created.canvas);
      setApp(created);
    }

    init();

    return () => {
      cancelled = true;
      if (created) {
        created.destroy({ removeView: true }, { children: true, texture: true });
      }
      setApp(null);
    };
  }, [containerRef]);

  return app;
}
