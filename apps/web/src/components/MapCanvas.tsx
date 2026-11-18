import { useEffect, useMemo, useRef } from 'react';
import type { RegionalMap } from '../../../../packages/core/src/regional-map.ts';

export interface MapCanvasProps {
  position: { x: number; z: number; headingDeg: number } | null;
  trail: Array<{ x: number; z: number }>;
  regionalMap: RegionalMap | null;
  overview: boolean;
  /** Planned route to draw ahead (only when known for sure; e.g. demo). */
  route: Array<{ x: number; z: number }> | null;
  calculatedRoute: boolean;
  headingUp: boolean;
  /** Pixels per metre at zoom 1. */
  zoom: number;
  speedKmh: number | null;
  onScale?: (metresPer100px: number) => void;
}

interface Colors {
  bg: string; grid: string; gridMajor: string; route: string; routeCasing: string; trail: string; trailCasing: string; puck: string;
  road: string; roadEdge: string; city: string;
}

function readColors(el: Element): Colors {
  const cs = getComputedStyle(el);
  const v = (n: string) => cs.getPropertyValue(n).trim();
  return {
    bg: v('--map-bg'), grid: v('--map-grid'), gridMajor: v('--map-grid-major'), route: v('--map-route'),
    routeCasing: v('--map-route-casing'), trail: v('--map-trail'), trailCasing: v('--map-trail-casing'), puck: v('--map-puck'),
    road: v('--map-road'), roadEdge: v('--map-road-edge'), city: v('--label'),
  };
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
function lerpAngle(a: number, b: number, t: number): number {
  const d = ((b - a + 540) % 360) - 180;
  return (a + d * t + 360) % 360;
}

export function MapCanvas(props: MapCanvasProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const roads = useMemo(() => [...(props.regionalMap?.roads ?? []), ...(props.regionalMap?.junctions ?? [])].map((points) => {
    const xs = points.map(([x]) => x);
    const zs = points.map(([, z]) => z);
    return { points, minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs) };
  }), [props.regionalMap]);
  const region = useMemo(() => {
    if (!roads.length) return null;
    const minX = Math.min(...roads.map((road) => road.minX));
    const maxX = Math.max(...roads.map((road) => road.maxX));
    const minZ = Math.min(...roads.map((road) => road.minZ));
    const maxZ = Math.max(...roads.map((road) => road.maxZ));
    const path = new Path2D();
    for (const { points } of roads) {
      path.moveTo(...points[0]!);
      for (const point of points.slice(1)) path.lineTo(...point);
    }
    return { x: (minX + maxX) / 2, z: (minZ + maxZ) / 2, width: maxX - minX, height: maxZ - minZ, path };
  }, [roads]);
  const frame = { ...props, roads, region };
  const propsRef = useRef(frame);
  propsRef.current = frame;

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext('2d')!;
    let raf = 0;
    let colors = readColors(canvas);
    let cam: { x: number; z: number; h: number; zoom: number } | null = null;
    let wasOverview = false;
    const mo = new MutationObserver(() => (colors = readColors(canvas)));
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    let lastScaleReport = 0;

    const draw = () => {
      raf = requestAnimationFrame(draw);
      const p = propsRef.current;
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (!w || !h) return;
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = colors.bg;
      ctx.fillRect(0, 0, w, h);

      // Zoom out a little with speed, like a car navigator.
      const speedFactor = p.speedKmh ? 1 / (1 + Math.max(0, p.speedKmh - 30) / 140) : 1;
      const overview = p.overview ? p.region : null;
      const targetZoom = overview
        ? Math.min(w * 0.84 / overview.width, h * 0.62 / overview.height)
        : p.zoom * speedFactor;
      const center = p.regionalMap?.cities.find((city) => city.id === 'brasov')?.position ?? [0, 0];
      const target = overview ? { x: overview.x, z: overview.z, headingDeg: 0 } : p.position ?? (p.trail.length
        ? { ...p.trail[p.trail.length - 1]!, headingDeg: 0 }
        : { x: center[0]!, z: center[1]!, headingDeg: 0 });
      if (!cam || Boolean(overview) !== wasOverview) cam = { x: target.x, z: target.z, h: target.headingDeg, zoom: targetZoom };
      else {
        const jump = Math.hypot(target.x - cam.x, target.z - cam.z) > 3000;
        const t = jump ? 1 : 0.14;
        cam.x = lerp(cam.x, target.x, t);
        cam.z = lerp(cam.z, target.z, t);
        cam.h = lerpAngle(cam.h, target.headingDeg, jump ? 1 : 0.1);
        cam.zoom = lerp(cam.zoom, targetZoom, 0.08);
      }
      wasOverview = Boolean(overview);
      const s = cam.zoom;
      const rot = p.headingUp && !overview ? (-cam.h * Math.PI) / 180 : 0;
      const cx = w / 2;
      const cy = overview ? h * 0.52 : w < 900 ? h * 0.48 : h * (p.headingUp ? 0.66 : 0.55);

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
      if (!overview) {
        if (s > 0.05) drawGrid(250, colors.grid, 1);
        drawGrid(1000, colors.gridMajor, 1);
      }

      if (overview) {
        // Europe-wide view: only multi-lane roads, drawn a little wider to read at this scale.
        ctx.lineWidth = 1.8 / s;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = colors.road;
        ctx.stroke(overview.path);
      } else if (p.roads.length) {
        ctx.beginPath();
        const { x, z } = cam;
        for (const road of p.roads) {
          if (road.maxX < x - R || road.minX > x + R || road.maxZ < z - R || road.minZ > z + R) continue;
          ctx.moveTo(...road.points[0]!);
          for (let i = 1; i < road.points.length; i++) ctx.lineTo(...road.points[i]!);
        }
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.lineWidth = 7 / s;
        ctx.strokeStyle = colors.roadEdge;
        ctx.stroke();
        ctx.lineWidth = 4 / s;
        ctx.strokeStyle = colors.road;
        ctx.stroke();
      }

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

      if (overview && p.route) {
        line(p.route, colors.routeCasing, 4);
        line(p.route, colors.route, 2.5);
      } else if (p.route && p.route.length > 1) {
        // Route ahead: from the point closest to the truck.
        let best = 0;
        let bd = Infinity;
        for (let i = 0; i < p.route.length; i++) {
          const d = Math.hypot(p.route[i]!.x - target.x, p.route[i]!.z - target.z);
          if (d < bd) { bd = d; best = i; }
        }
        const ahead = p.calculatedRoute ? p.route.slice(Math.max(0, best - 1))
          : [{ x: target.x, z: target.z }, ...p.route.slice(best + 1)];
        line(ahead, colors.routeCasing, 13);
        line(ahead, colors.route, 9);
        const end = p.route[p.route.length - 1]!;
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(end.x, end.z, 9 / s, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = colors.route;
        ctx.beginPath(); ctx.arc(end.x, end.z, 6 / s, 0, Math.PI * 2); ctx.fill();
      }

      const trail = p.position ? [...p.trail, { x: p.position.x, z: p.position.z }] : p.trail;
      if (!overview) line(trail, colors.trailCasing, 10);
      line(trail, colors.trail, overview ? 2 : 6);
      ctx.restore();

      if (p.regionalMap) {
        const sin = Math.sin(rot);
        const cos = Math.cos(rot);
        ctx.font = '600 12px system-ui';
        ctx.textAlign = 'center';
        ctx.lineWidth = 3;
        ctx.strokeStyle = colors.bg;
        ctx.fillStyle = colors.city;
        const labelBoxes: Array<{ left: number; right: number; y: number }> = [];
        for (const city of p.regionalMap.cities) {
          const x = (city.position[0] - cam.x) * s;
          const z = (city.position[1] - cam.z) * s;
          const sx = cx + x * cos - z * sin;
          const sy = cy + x * sin + z * cos;
          if (sx < 0 || sx > w || sy < 0 || sy > h) continue;
          const width = ctx.measureText(city.name).width / 2 + 4;
          if (labelBoxes.some((box) => Math.abs(sy - box.y) < 14 && sx + width > box.left && sx - width < box.right)) continue;
          labelBoxes.push({ left: sx - width, right: sx + width, y: sy });
          ctx.strokeText(city.name, sx, sy);
          ctx.fillText(city.name, sx, sy);
        }
      }

      // Puck, in screen space.
      if (p.position) {
        const px = overview ? cx + (p.position.x - cam.x) * s : cx;
        const py = overview ? cy + (p.position.z - cam.z) * s : cy;
        if (overview) {
          ctx.beginPath();
          ctx.arc(px, py, 5, 0, Math.PI * 2);
          ctx.fillStyle = colors.puck;
          ctx.fill();
          ctx.lineWidth = 1.5;
          ctx.strokeStyle = '#fff';
          ctx.stroke();
          return;
        }
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

  return <canvas ref={ref} className="map-canvas" aria-label={props.regionalMap ? 'Drumuri și orașe din ETS2, poziția camionului și traseul parcurs' : 'Harta: poziția camionului și traseul parcurs'} role="img" />;
}
