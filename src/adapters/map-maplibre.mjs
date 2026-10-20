// Route map: MapLibre GL JS (pinned, with integrity hash) + OpenFreeMap vector tiles (no key).
// If the library or the tiles cannot be loaded, a message is shown and the rest of the page keeps working.
import { t } from "../i18n/i18n.mjs";

const VERSION = "4.7.1";
const SCRIPT = { url: `https://cdn.jsdelivr.net/npm/maplibre-gl@${VERSION}/dist/maplibre-gl.js`, integrity: "sha384-SYKAG6cglRMN0RVvhNeBY0r3FYKNOJtznwA0v7B5Vp9tr31xAHsZC0DqkQ/pZDmj" };
const STYLE_URL = "https://tiles.openfreemap.org/styles/dark";
const LOAD_TIMEOUT_MS = 15000;

let libraryPromise = null;
function loadLibrary() {
  if (window.maplibregl) return Promise.resolve(window.maplibregl);
  libraryPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT.url;
    script.integrity = SCRIPT.integrity;
    script.crossOrigin = "anonymous";
    script.onload = () => resolve(window.maplibregl);
    script.onerror = () => { libraryPromise = null; script.remove(); reject(new Error("MapLibre could not be loaded")); };
    document.head.append(script);
  });
  return libraryPromise;
}

const pin = (label, kind) => {
  const element = document.createElement("div");
  element.className = `map-pin ${kind}`;
  element.textContent = label;
  return element;
};

export function createRouteMap({ container, statusElement }) {
  let map = null;
  let lib = null;
  let markers = [];
  let ready = null;
  let endpoints = null;
  const setStatus = text => { statusElement.textContent = text || ""; };

  async function ensureMap() {
    lib ??= await loadLibrary();
    if (map) return ready;
    map = new lib.Map({
      container,
      style: STYLE_URL,
      center: [24.9, 45.9],
      zoom: 5,
      attributionControl: false,
      preserveDrawingBuffer: true, // lets the print view copy the canvas
      cooperativeGestures: true,   // phones: one finger scrolls the page, two move the map
      locale: {
        "CooperativeGesturesHandler.WindowsHelpText": t("map.gestureWin"),
        "CooperativeGesturesHandler.MacHelpText": t("map.gestureMac"),
        "CooperativeGesturesHandler.MobileHelpText": t("map.gestureMobile"),
        "NavigationControl.ZoomIn": t("map.zoomIn"),
        "NavigationControl.ZoomOut": t("map.zoomOut"),
      },
    });
    map.addControl(new lib.NavigationControl({ showCompass: false }), "top-right");
    ready = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("map load timeout")), LOAD_TIMEOUT_MS);
      map.once("load", () => {
        clearTimeout(timer);
        // Blend the base map into the page's navy background.
        try { map.setPaintProperty("background", "background-color", "#0e161f"); } catch { /* style without a background layer */ }
        map.addSource("route", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
        map.addLayer({ id: "route-glow", type: "line", source: "route", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#8ce0bd", "line-width": 12, "line-opacity": 0.22, "line-blur": 6 } });
        map.addLayer({ id: "route-line", type: "line", source: "route", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#8ce0bd", "line-width": 4 } });
        resolve();
      });
    });
    return ready;
  }

  async function show(data) {
    setStatus(t("map.loading"));
    try {
      await ensureMap();
      map.resize();
      const lines = (data.geometry || []).filter(line => Array.isArray(line) && line.length > 1);
      map.getSource("route").setData({ type: "Feature", properties: {}, geometry: { type: "MultiLineString", coordinates: lines } });
      endpoints = data;
      markers.forEach(marker => marker.remove());
      markers = [
        new lib.Marker({ element: pin("A", "a") }).setLngLat([data.origin.lon, data.origin.lat]).addTo(map),
        new lib.Marker({ element: pin("B", "b") }).setLngLat([data.destination.lon, data.destination.lat]).addTo(map),
      ];
      const bounds = new lib.LngLatBounds();
      bounds.extend([data.origin.lon, data.origin.lat]);
      bounds.extend([data.destination.lon, data.destination.lat]);
      for (const line of lines) for (const point of line) bounds.extend(point);
      map.fitBounds(bounds, { padding: { top: 56, bottom: 46, left: 36, right: 36 }, duration: 0, maxZoom: 11 });
      setStatus(lines.length ? "" : t("map.noGeometry"));
      container.setAttribute("aria-label", t("map.aria", { origin: data.originName, destination: data.destinationName }));
    } catch {
      setStatus(t("map.error"));
    }
  }

  // PNG/JPEG of the current map for the print view; null when the map is unavailable.
  async function snapshot() {
    if (!map || !ready) return null;
    try {
      await ready;
      if (!map.loaded() || map.isMoving()) {
        await new Promise(resolve => { const timer = setTimeout(resolve, 6000); map.once("idle", () => { clearTimeout(timer); resolve(); }); });
      }
      map.triggerRepaint();
      await new Promise(resolve => requestAnimationFrame(resolve));
      const canvas = map.getCanvas();
      // The A/B pins are HTML elements, not part of the WebGL canvas: draw them onto a copy.
      const copy = document.createElement("canvas");
      copy.width = canvas.width;
      copy.height = canvas.height;
      const context = copy.getContext("2d");
      context.drawImage(canvas, 0, 0);
      const scale = canvas.width / canvas.clientWidth;
      for (const [label, color, point] of [["A", "#8ce0bd", endpoints.origin], ["B", "#8bbcff", endpoints.destination]]) {
        const { x, y } = map.project([point.lon, point.lat]);
        context.beginPath();
        context.arc(x * scale, y * scale, 14 * scale, 0, Math.PI * 2);
        context.fillStyle = color;
        context.fill();
        context.lineWidth = 3 * scale;
        context.strokeStyle = "#0b1017";
        context.stroke();
        context.fillStyle = "#092017";
        context.font = `800 ${13 * scale}px Inter, Arial, sans-serif`;
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillText(label, x * scale, y * scale + scale * 0.5);
      }
      return copy.toDataURL("image/jpeg", 0.88);
    } catch { return null; }
  }

  return { show, snapshot };
}
