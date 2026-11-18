import { useEffect, useRef } from 'react';

export interface MapCanvasProps {
  position: { x: number; z: number; headingDeg: number } | null;
  trail: Array<{ x: number; z: number }>;
  /** Planned route to draw ahead (only when known for sure; e.g. demo). */
  route: Array<{ x: number; z: number }> | null;
  headingUp: boolean;
  /** Pixels per metre at zoom 1. */
  zoom: number;
  speedKmh: number | null;
  onScale?: (metresPer100px: number) => void;
}

interface Colors {
  bg: string; grid: string; gridMajor: string; route: string; routeCasing: string; trail: string; trailCasing: string; puck: string;
}

function readColors(el: Element): Colors {
  const cs = getComputedStyle(el);
  const v = (n: string) => cs.getPropertyValue(n).trim();
  return {
    bg: v('--map-bg'), grid: v('--map-grid'), gridMajor: v('--map-grid-major'), route: v('--map-route'),
    routeCasing: v('--map-route-casing'), trail: v('--map-trail'), trailCasing: v('--map-trail-casing'), puck: v('--map-puck'),
  };
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
function lerpAngle(a: number, b: number, t: number): number {
  const d = ((b - a + 540) % 360) - 180;
  return (a + d * t + 360) % 360;
}

/**
 * The live map. Today it draws what we know for certain: where the truck is,
 * where it has been and which way it faces. The road network comes with the
 * Map Data Pipeline phase; nothing here pretends to be a road.
 */
export function MapCanvas(props: MapCanvasProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const propsRef = useRef(props);
  propsRef.current = props;

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext('2d')!;
    let raf = 0;
    let colors = readColors(canvas);
    let cam: { x: number; z: number; h: number; zoom: number } | null = null;
    const mo = new MutationObserver(() => (colors = readColors(canvas)));
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    let lastScaleReport = 0;

    const draw = () => {
      raf = requestAnimationFrame(draw);
      const p = propsRef.current;
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = colors.bg;
      ctx.fillRect(0, 0, w, h);

      // Zoom out a little with speed, like a car navigator.
      const speedFactor = p.speedKmh ? 1 / (1 + Math.max(0, p.speedKmh - 30) / 140) : 1;
      const targetZoom = p.zoom * speedFactor;
      const target = p.position ?? (p.trail.length ? { ...p.trail[p.trail.length - 1]!, headingDeg: 0 } : { x: 0, z: 0, headingDeg: 0 });
      if (!cam) cam = { x: target.x, z: target.z, h: target.headingDeg, zoom: targetZoom };
      else {
        const jump = Math.hypot(target.x - cam.x, target.z - cam.z) > 3000;
        const t = jump ? 1 : 0.14;
        cam.x = lerp(cam.x, target.x, t);
        cam.z = lerp(cam.z, target.z, t);
        cam.h = lerpAngle(cam.h, target.headingDeg, jump ? 1 : 0.1);
        cam.zoom = lerp(cam.zoom, targetZoom, 0.08);
      }
      const s = cam.zoom;
      const rot = p.headingUp ? (-cam.h * Math.PI) / 180 : 0;
      const cx = w / 2;
      const cy = p.headingUp ? h * 0.66 : h * 0.55;

      const now = performance.now();
      if (p.onScale && now - lastScaleReport > 500) {
        lastScaleReport = now;
        p.onScale(100 / s);
      }

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rot);
      ctx.scale(s, s);
      ctx.translate(-cam.x, -cam.z);

      // Grid: 250 m minor, 1 km major.
      const R = Math.hypot(w, h) / s;
      const drawGrid = (step: number, color: string, width: number) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = width / s;
        ctx.beginPath();
        const x0 = Math.floor((cam!.x - R) / step) * step;
        const z0 = Math.floor((cam!.z - R) / step) * step;
        for (let x = x0; x <= cam!.x + R; x += step) { ctx.moveTo(x, cam!.z - R); ctx.lineTo(x, cam!.z + R); }
        for (let z = z0; z <= cam!.z + R; z += step) { ctx.moveTo(cam!.x - R, z); ctx.lineTo(cam!.x + R, z); }
        ctx.stroke();
      };
      if (s > 0.05) drawGrid(250, colors.grid, 1);
      drawGrid(1000, colors.gridMajor, 1);

      const line = (pts: Array<{ x: number; z: number }>, color: string, width: number) => {
        if (pts.length < 2) return;
        ctx.strokeStyle = color;
        ctx.lineWidth = width / s;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(pts[0]!.x, pts[0]!.z);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i]!.x, pts[i]!.z);
        ctx.stroke();
      };

      if (p.route && p.route.length > 1) {
        // Route ahead: from the point closest to the truck.
        let best = 0;
        let bd = Infinity;
        for (let i = 0; i < p.route.length; i++) {
          const d = Math.hypot(p.route[i]!.x - target.x, p.route[i]!.z - target.z);
          if (d < bd) { bd = d; best = i; }
        }
        const ahead = [{ x: target.x, z: target.z }, ...p.route.slice(best + 1)];
        line(ahead, colors.routeCasing, 13);
        line(ahead, colors.route, 9);
        const end = p.route[p.route.length - 1]!;
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(end.x, end.z, 9 / s, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = colors.route;
        ctx.beginPath(); ctx.arc(end.x, end.z, 6 / s, 0, Math.PI * 2); ctx.fill();
      }

      const trail = p.position ? [...p.trail, { x: target.x, z: target.z }] : p.trail;
      line(trail, colors.trailCasing, 10);
      line(trail, colors.trail, 6);
      ctx.restore();

      // Puck, in screen space.
      if (p.position) {
        const px = cx + 0;
        const py = cy + 0;
        const ang = p.headingUp ? 0 : (cam.h * Math.PI) / 180;
        ctx.save();
        ctx.translate(px, py);
        const halo = ctx.createRadialGradient(0, 0, 4, 0, 0, 46);
        halo.addColorStop(0, `${colors.puck}55`);
        halo.addColorStop(1, `${colors.puck}00`);
        ctx.fillStyle = halo;
        ctx.beginPath(); ctx.arc(0, 0, 46, 0, Math.PI * 2); ctx.fill();
        ctx.rotate(ang);
        ctx.shadowColor = 'rgba(0,0,0,0.35)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetY = 3;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(0, 0, 21, 0, Math.PI * 2); ctx.fill();
        ctx.shadowColor = 'transparent';
        ctx.fillStyle = colors.puck;
        ctx.beginPath(); ctx.arc(0, 0, 17.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(0, -10.5);
        ctx.lineTo(8, 8);
        ctx.lineTo(0, 4);
        ctx.lineTo(-8, 8);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      mo.disconnect();
    };
  }, []);

  return <canvas ref={ref} className="map-canvas" aria-label="Harta: poziția camionului și traseul parcurs" role="img" />;
}
