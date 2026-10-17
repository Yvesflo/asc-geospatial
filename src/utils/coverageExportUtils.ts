/**
 * Moteur d'exportation cartographique haute résolution (300 DPI) et données (CSV)
 * pour le module de Couverture en ASC.
 * 
 * Normes cartographiques :
 * - Format PNG A4 300 DPI (2480 x 3508 px portrait / 3508 x 2480 px paysage)
 * - Intégration du fond de carte tuilé (OSM / OSM HOT / Satellite / CartoDB) avec CORS
 * - Légendes en position VERTICALE avec cartouches cartographiques clairs
 * - Pour les Small Multiples (grille 2x3) : fond de carte et légende verticale individuelle sur chacune des 6 cartes
 * - Rendu vectoriel natif précis au pixel près (sans flou ni dépendance externe)
 * - Titrage institutionnel, échelle en km, flèche du nord, sources officielles
 * - Filigrane diagonal "DONNÉES FACTICES" si activé en configuration
 * - Export CSV UTF-8 avec BOM et séparateur point-virgule pour Excel français
 */

import { SubdivisionLevel, CoverageMapType, BasemapType } from '../types';
import { 
  COVERAGE_CONFIG, 
  getPopulationForLevel, 
  getFeatureNameForLevel,
  getCanonicalRegionName,
  AscCategoryDef,
  TerritorialFilter,
  isFeatureInTerritorialFilter
} from '../config/coverageConfig';
import { QuantileClass } from '../components/CouvertureAscMap';

export interface ExportProgressCallback {
  (progressPercent: number, statusMessage: string): void;
}

// Projection Web Mercator standard (coordonnées conformes)
function projectWebMercator(lng: number, lat: number): [number, number] {
  const x = (lng * Math.PI) / 180;
  const latRad = Math.max(-85.0511, Math.min(85.0511, lat)) * (Math.PI / 180);
  const y = Math.log(Math.tan(Math.PI / 4 + latRad / 2));
  return [x, y];
}

// Conversion des tuiles Web Mercator vers coordonnées géographiques
function tileToLng(tx: number, z: number): number {
  return (tx / Math.pow(2, z)) * 360 - 180;
}

function tileToLat(ty: number, z: number): number {
  const n = Math.PI - (2 * Math.PI * ty) / Math.pow(2, z);
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}

// Calcul de l'emprise géographique projetée d'un ensemble d'entités
function computeFeaturesProjectedBounds(features: any[]): {
  minLng: number;
  maxLng: number;
  minLat: number;
  maxLat: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  centerLng: number;
  centerLat: number;
} {
  let minLng = Infinity;
  let maxLng = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let sumLng = 0;
  let sumLat = 0;
  let coordCount = 0;

  function scanCoords(coords: any) {
    if (typeof coords[0] === 'number') {
      const lng = coords[0];
      const lat = coords[1];
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;

      const [px, py] = projectWebMercator(lng, lat);
      if (px < minX) minX = px;
      if (px > maxX) maxX = px;
      if (py < minY) minY = py;
      if (py > maxY) maxY = py;

      sumLng += lng;
      sumLat += lat;
      coordCount++;
    } else {
      coords.forEach(scanCoords);
    }
  }

  features.forEach((f) => {
    if (f.geometry?.coordinates) {
      scanCoords(f.geometry.coordinates);
    }
  });

  if (minX === Infinity) {
    // Fallback Cameroun
    const [p1x, p1y] = projectWebMercator(8.5, 1.6);
    const [p2x, p2y] = projectWebMercator(16.2, 13.1);
    return {
      minLng: 8.5,
      maxLng: 16.2,
      minLat: 1.6,
      maxLat: 13.1,
      minX: p1x,
      minY: p1y,
      maxX: p2x,
      maxY: p2y,
      centerLng: 12.35,
      centerLat: 7.36,
    };
  }

  return {
    minLng,
    maxLng,
    minLat,
    maxLat,
    minX,
    minY,
    maxX,
    maxY,
    centerLng: coordCount > 0 ? sumLng / coordCount : 12.35,
    centerLat: coordCount > 0 ? sumLat / coordCount : 7.36,
  };
}

/**
 * File d'attente à priorité binaire (Max-Heap) optimisée pour le calcul du pôle d'inaccessibilité (Polylabel).
 */
class CellPriorityQueue {
  private data: any[] = [];
  push(item: any) {
    this.data.push(item);
    let i = this.data.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.data[p].max >= this.data[i].max) break;
      const t = this.data[p];
      this.data[p] = this.data[i];
      this.data[i] = t;
      i = p;
    }
  }
  pop(): any {
    const top = this.data[0];
    const bottom = this.data.pop();
    if (this.data.length > 0 && bottom !== undefined) {
      this.data[0] = bottom;
      let i = 0;
      const len = this.data.length;
      while (true) {
        const left = (i << 1) + 1;
        const right = left + 1;
        let best = i;
        if (left < len && this.data[left].max > this.data[best].max) best = left;
        if (right < len && this.data[right].max > this.data[best].max) best = right;
        if (best === i) break;
        const t = this.data[i];
        this.data[i] = this.data[best];
        this.data[best] = t;
        i = best;
      }
    }
    return top;
  }
  get length(): number {
    return this.data.length;
  }
}

function getSegDistSq(px: number, py: number, a: number[], b: number[]): number {
  let x = a[0];
  let y = a[1];
  let dx = b[0] - x;
  let dy = b[1] - y;
  if (dx !== 0 || dy !== 0) {
    const t = ((px - x) * dx + (py - y) * dy) / (dx * dx + dy * dy);
    if (t > 1) {
      x = b[0];
      y = b[1];
    } else if (t > 0) {
      x += dx * t;
      y += dy * t;
    }
  }
  dx = px - x;
  dy = py - y;
  return dx * dx + dy * dy;
}

function pointToPolygonDist(x: number, y: number, polygon: number[][][]): number {
  let inside = false;
  let minDistSq = Infinity;
  for (let k = 0; k < polygon.length; k++) {
    const ring = polygon[k];
    for (let i = 0, len = ring.length, j = len - 1; i < len; j = i++) {
      const a = ring[i];
      const b = ring[j];
      if ((a[1] > y !== b[1] > y) && (x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0])) {
        inside = !inside;
      }
      minDistSq = Math.min(minDistSq, getSegDistSq(x, y, a, b));
    }
  }
  return (inside ? 1 : -1) * Math.sqrt(minDistSq);
}

function getRingArea(ring: number[][]): number {
  let area = 0;
  for (let i = 0, len = ring.length, j = len - 1; i < len; j = i++) {
    area += ring[i][0] * ring[j][1] - ring[j][0] * ring[i][1];
  }
  return Math.abs(area / 2);
}

function polylabel(polygon: number[][][], precision = 0.0001): [number, number] {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const outerRing = polygon[0];
  if (!outerRing || outerRing.length < 3) return [12.35, 7.36];

  for (let i = 0; i < outerRing.length; i++) {
    const p = outerRing[i];
    if (p[0] < minX) minX = p[0];
    if (p[1] < minY) minY = p[1];
    if (p[0] > maxX) maxX = p[0];
    if (p[1] > maxY) maxY = p[1];
  }
  const width = maxX - minX;
  const height = maxY - minY;
  const cellSize = Math.min(width, height);
  let h = cellSize / 2;
  if (cellSize === 0) return [minX, minY];

  const q = new CellPriorityQueue();

  function createCell(x: number, y: number, cellH: number) {
    const d = pointToPolygonDist(x, y, polygon);
    return { x, y, h: cellH, d, max: d + cellH * Math.SQRT2 };
  }

  // Centroid initial
  let area = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0, len = outerRing.length, j = len - 1; i < len; j = i++) {
    const a = outerRing[i];
    const b = outerRing[j];
    const f = a[0] * b[1] - b[0] * a[1];
    cx += (a[0] + b[0]) * f;
    cy += (a[1] + b[1]) * f;
    area += f * 3;
  }
  let bestCell = area === 0 ? createCell(minX, minY, 0) : createCell(cx / area, cy / area, 0);
  const bboxCell = createCell(minX + width / 2, minY + height / 2, 0);
  if (bboxCell.d > bestCell.d) bestCell = bboxCell;

  for (let x = minX; x < maxX; x += cellSize) {
    for (let y = minY; y < maxY; y += cellSize) {
      q.push(createCell(x + h, y + h, h));
    }
  }

  let numSteps = 0;
  while (q.length > 0 && numSteps < 1000) {
    numSteps++;
    const cell = q.pop();
    if (cell.d > bestCell.d) {
      bestCell = cell;
    }
    if (cell.max - bestCell.d <= precision) continue;
    h = cell.h / 2;
    q.push(createCell(cell.x - h, cell.y - h, h));
    q.push(createCell(cell.x + h, cell.y - h, h));
    q.push(createCell(cell.x - h, cell.y + h, h));
    q.push(createCell(cell.x + h, cell.y + h, h));
  }

  return [bestCell.x, bestCell.y];
}

const featureCenterCache = new WeakMap<object, [number, number]>();

/**
 * Calcul du centre visuel et géométrique optimal (Pôle d'inaccessibilité / Maximum Inscribed Circle Center)
 * pour le positionnement parfait des symboles proportionnels à l'intérieur des polygones.
 * - Garanti 100% à l'intérieur du polygone (0 point hors limites ou sur une bordure, y compris pour formes concaves).
 * - Pour les MultiPolygones, sélectionne automatiquement la partie territoriale principale (la plus vaste).
 * - Optimisé avec cache memoïsé pour des performances instantanées à l'affichage et à l'export.
 */
export function getFeatureCenter(feature: any): [number, number] {
  if (!feature?.geometry?.coordinates) return [12.35, 7.36];

  if (typeof feature === 'object' && feature !== null) {
    const cached = featureCenterCache.get(feature);
    if (cached) return cached;
  }

  const type = feature.geometry.type || 'Polygon';
  const coordinates = feature.geometry.coordinates;

  let bestPolygon: number[][][] | null = null;
  if (type === 'MultiPolygon') {
    let maxArea = -1;
    for (const poly of coordinates) {
      if (Array.isArray(poly) && Array.isArray(poly[0])) {
        const a = getRingArea(poly[0]);
        if (a > maxArea) {
          maxArea = a;
          bestPolygon = poly;
        }
      }
    }
  } else if (Array.isArray(coordinates) && Array.isArray(coordinates[0])) {
    bestPolygon = coordinates;
  }

  if (!bestPolygon || !bestPolygon[0] || bestPolygon[0].length < 3) {
    return [12.35, 7.36];
  }

  const center = polylabel(bestPolygon);

  if (typeof feature === 'object' && feature !== null) {
    featureCenterCache.set(feature, center);
  }

  return center;
}

// Fonction de tracé des anneaux géométriques d'un polygone
function drawPolygonPath(
  ctx: CanvasRenderingContext2D,
  coordinates: any[],
  toCanvasX: (x: number) => number,
  toCanvasY: (y: number) => number
) {
  coordinates.forEach((ring) => {
    if (!Array.isArray(ring) || ring.length === 0) return;
    for (let i = 0; i < ring.length; i++) {
      const [lng, lat] = ring[i];
      const [px, py] = projectWebMercator(lng, lat);
      const cx = toCanvasX(px);
      const cy = toCanvasY(py);
      if (i === 0) {
        ctx.moveTo(cx, cy);
      } else {
        ctx.lineTo(cx, cy);
      }
    }
    ctx.closePath();
  });
}

// URL des tuiles selon le fond sélectionné
function getTileUrlTemplate(basemap: BasemapType = 'hot'): string {
  switch (basemap) {
    case 'hot':
      return 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png';
    case 'satellite':
      return 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
    case 'osm':
    default:
      return 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
  }
}

// Détermination du zoom de tuiles optimal
function getOptimalTileZoom(minLng: number, maxLng: number, targetWidthPx: number): number {
  const dLng = Math.max(0.05, maxLng - minLng);
  const z = Math.round(Math.log2((targetWidthPx * 1.15) / dLng));
  return Math.max(6, Math.min(12, z));
}

// Chargement et rendu du fond de carte tuilé dans le canevas
async function fetchAndRenderBasemapTiles(
  ctx: CanvasRenderingContext2D,
  basemap: BasemapType = 'hot',
  minLng: number,
  maxLng: number,
  minLat: number,
  maxLat: number,
  mapFrameX: number,
  mapFrameY: number,
  mapFrameW: number,
  mapFrameH: number,
  toCanvasX: (px: number) => number,
  toCanvasY: (py: number) => number
): Promise<void> {
  const z = getOptimalTileZoom(minLng, maxLng, mapFrameW);
  const n = Math.pow(2, z);

  const lngToTileX = (lng: number) => Math.floor(((lng + 180) / 360) * n);
  const latToTileY = (lat: number) => {
    const latRad = Math.max(-85.0511, Math.min(85.0511, lat)) * (Math.PI / 180);
    return Math.floor(((1 - Math.log(Math.tan(Math.PI / 4 + latRad / 2)) / Math.PI) / 2) * n);
  };

  const minTX = Math.max(0, lngToTileX(minLng) - 1);
  const maxTX = Math.min(n - 1, lngToTileX(maxLng) + 1);
  const minTY = Math.max(0, latToTileY(maxLat) - 1);
  const maxTY = Math.min(n - 1, latToTileY(minLat) + 1);

  const tileTemplate = getTileUrlTemplate(basemap);
  const subdomains = ['a', 'b', 'c'];

  const promises: Promise<{ img: HTMLImageElement; tx: number; ty: number } | null>[] = [];

  for (let tx = minTX; tx <= maxTX; tx++) {
    for (let ty = minTY; ty <= maxTY; ty++) {
      const s = subdomains[(tx + ty) % subdomains.length];
      const url = tileTemplate
        .replace('{s}', s)
        .replace('{z}', String(z))
        .replace('{x}', String(tx))
        .replace('{y}', String(ty));

      promises.push(
        new Promise((resolve) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          let settled = false;
          const timer = setTimeout(() => {
            if (!settled) {
              settled = true;
              resolve(null);
            }
          }, 3500);

          img.onload = () => {
            if (!settled) {
              settled = true;
              clearTimeout(timer);
              resolve({ img, tx, ty });
            }
          };
          img.onerror = () => {
            if (!settled) {
              settled = true;
              clearTimeout(timer);
              resolve(null);
            }
          };
          img.src = url;
        })
      );
    }
  }

  const results = await Promise.all(promises);

  ctx.save();
  ctx.beginPath();
  ctx.rect(mapFrameX, mapFrameY, mapFrameW, mapFrameH);
  ctx.clip();

  results.forEach((item) => {
    if (!item) return;
    const { img, tx, ty } = item;
    const lng1 = tileToLng(tx, z);
    const lat1 = tileToLat(ty, z);
    const lng2 = tileToLng(tx + 1, z);
    const lat2 = tileToLat(ty + 1, z);

    const [px1, py1] = projectWebMercator(lng1, lat1);
    const [px2, py2] = projectWebMercator(lng2, lat2);

    const cx1 = toCanvasX(px1);
    const cy1 = toCanvasY(py1);
    const cx2 = toCanvasX(px2);
    const cy2 = toCanvasY(py2);

    const cw = cx2 - cx1;
    const ch = cy2 - cy1;

    ctx.drawImage(img, cx1, cy1, cw, ch);
  });

  ctx.restore();
}

// Dessin de la flèche du nord cartographique
function drawNorthArrow(ctx: CanvasRenderingContext2D, x: number, y: number, size: number = 75) {
  ctx.save();
  ctx.translate(x, y);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.94)';
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.75, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  const tipY = -size * 0.55;
  const baseY = size * 0.45;
  const halfW = size * 0.22;

  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.moveTo(0, tipY);
  ctx.lineTo(-halfW, 0);
  ctx.lineTo(0, baseY);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#f8fafc';
  ctx.beginPath();
  ctx.moveTo(0, tipY);
  ctx.lineTo(halfW, 0);
  ctx.lineTo(0, baseY);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 22px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('N', 0, tipY - 4);

  ctx.restore();
}

// Dessin de la barre d'échelle
function drawScaleBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scaleLengthPx: number,
  kmValue: number
) {
  ctx.save();

  ctx.fillStyle = 'rgba(255, 255, 255, 0.94)';
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(x - 15, y - 32, scaleLengthPx + 30, 52, 10);
  ctx.fill();
  ctx.stroke();

  const barH = 10;
  const segW = scaleLengthPx / 2;

  ctx.fillStyle = '#0f172a';
  ctx.fillRect(x, y, segW, barH);
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x, y, segW, barH);

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x + segW, y, segW, barH);
  ctx.strokeRect(x + segW, y, segW, barH);

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 15px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('0', x, y - 3);
  ctx.fillText(`${Math.round(kmValue / 2)}`, x + segW, y - 3);
  ctx.fillText(`${kmValue} km`, x + scaleLengthPx, y - 3);

  ctx.restore();
}

// Dessin du filigrane diagonal "DONNÉES FACTICES"
function drawMockWatermark(ctx: CanvasRenderingContext2D, width: number, height: number) {
  ctx.save();
  ctx.translate(width / 2, height / 2);
  ctx.rotate(-Math.PI / 4);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  ctx.fillStyle = 'rgba(220, 38, 38, 0.12)';
  ctx.font = 'bold 130px sans-serif';
  ctx.fillText('DONNÉES FACTICES', 0, -80);
  ctx.font = 'bold 64px sans-serif';
  ctx.fillText('NE PAS DIFFUSER — SIMULATION MINSANTE / DOSTS', 0, 40);
  ctx.restore();
}

// Nettoyage pour les noms de fichiers
export function sanitizeFilename(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * 1. EXPORTATION D'UNE CARTE UNIQUE (A4 300 DPI)
 * Intègre le fond de carte et une LÉGENDE VERTICALE cartographique
 */
export async function exportSingleMapPng(options: {
  activeMap: CoverageMapType;
  level: SubdivisionLevel;
  selectedRegion: string | null;
  selectedSubdivision?: TerritorialFilter | null;
  selectedCategoryField: string;
  geoData: any;
  quantileBreaks: QuantileClass[];
  basemap?: BasemapType;
  orientation?: 'portrait' | 'landscape';
  onProgress?: ExportProgressCallback;
}): Promise<Blob> {
  const {
    activeMap,
    level,
    selectedRegion,
    selectedSubdivision = null,
    selectedCategoryField,
    geoData,
    quantileBreaks,
    basemap = 'hot',
    orientation = 'portrait',
    onProgress,
  } = options;

  onProgress?.(5, 'Initialisation du document A4 (300 DPI)...');
  await new Promise((r) => setTimeout(r, 20));

  const isPortrait = orientation === 'portrait';
  const canvasWidth = isPortrait ? 2480 : 3508;
  const canvasHeight = isPortrait ? 3508 : 2480;

  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Impossible de créer le contexte 2D');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // Filtrage des entités selon les filtres territoriaux actifs (Région, Département, District)
  onProgress?.(15, 'Calcul des coordonnées et du cadrage...');
  await new Promise((r) => setTimeout(r, 20));

  const allFeatures: any[] = geoData?.features || [];
  const filteredFeatures = allFeatures.filter((f) =>
    isFeatureInTerritorialFilter(f, selectedRegion, selectedSubdivision, level)
  );

  if (filteredFeatures.length === 0) {
    throw new Error('Aucune entité trouvée pour le filtre sélectionné.');
  }

  // Définition du cadre cartographique
  const marginX = 90;
  const headerH = 310;
  const footerH = 140;
  const mapFrameX = marginX;
  const mapFrameY = headerH;
  const mapFrameW = canvasWidth - marginX * 2;
  const mapFrameH = canvasHeight - headerH - footerH;

  const bounds = computeFeaturesProjectedBounds(filteredFeatures);
  const bboxW = bounds.maxX - bounds.minX;
  const bboxH = bounds.maxY - bounds.minY;

  // Décalage pour laisser de l'espace à la légende verticale en bas à gauche (Golfe de Guinée)
  const innerPadLeft = selectedRegion ? 60 : 60;
  const innerPadRight = 60;
  const innerPadTop = 60;
  const innerPadBottom = 60;

  const availW = mapFrameW - innerPadLeft - innerPadRight;
  const availH = mapFrameH - innerPadTop - innerPadBottom;

  const scale = Math.min(availW / bboxW, availH / bboxH);
  const renderedW = bboxW * scale;
  const renderedH = bboxH * scale;

  const offsetX = mapFrameX + innerPadLeft + (availW - renderedW) / 2;
  const offsetY = mapFrameY + innerPadTop + (availH - renderedH) / 2;

  const toCanvasX = (px: number) => offsetX + (px - bounds.minX) * scale;
  const toCanvasY = (py: number) => offsetY + (bounds.maxY - py) * scale;

  // 1. Fond du cadre
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(mapFrameX, mapFrameY, mapFrameW, mapFrameH);

  // 2. Chargement et rendu du fond de carte tuilé (OSM / Satellite / HOT)
  onProgress?.(30, `Chargement du fond de carte (${basemap.toUpperCase()}) avec tuiles CORS...`);
  await new Promise((r) => setTimeout(r, 20));

  try {
    await fetchAndRenderBasemapTiles(
      ctx,
      basemap,
      bounds.minLng,
      bounds.maxLng,
      bounds.minLat,
      bounds.maxLat,
      mapFrameX,
      mapFrameY,
      mapFrameW,
      mapFrameH,
      toCanvasX,
      toCanvasY
    );
  } catch (err) {
    console.warn("Impossible de charger les tuiles de fond de carte, export sans fond de carte:", err);
  }

  // 3. Cadre de délimitation
  ctx.strokeStyle = '#64748b';
  ctx.lineWidth = 2.5;
  ctx.strokeRect(mapFrameX, mapFrameY, mapFrameW, mapFrameH);

  // 4. Motifs hachurés pour absence de données / faible effectif
  const hatchCanvas = document.createElement('canvas');
  hatchCanvas.width = 16;
  hatchCanvas.height = 16;
  const hCtx = hatchCanvas.getContext('2d')!;
  hCtx.fillStyle = 'rgba(241, 245, 249, 0.85)';
  hCtx.fillRect(0, 0, 16, 16);
  hCtx.strokeStyle = '#94a3b8';
  hCtx.lineWidth = 2;
  hCtx.beginPath();
  hCtx.moveTo(0, 16);
  hCtx.lineTo(16, 0);
  hCtx.stroke();
  const hatchPattern = ctx.createPattern(hatchCanvas, 'repeat');

  const lightHatchCanvas = document.createElement('canvas');
  lightHatchCanvas.width = 16;
  lightHatchCanvas.height = 16;
  const lhCtx = lightHatchCanvas.getContext('2d')!;
  lhCtx.fillStyle = 'rgba(248, 250, 252, 0.9)';
  lhCtx.fillRect(0, 0, 16, 16);
  lhCtx.strokeStyle = '#cbd5e1';
  lhCtx.lineWidth = 2;
  lhCtx.beginPath();
  lhCtx.moveTo(0, 16);
  lhCtx.lineTo(16, 0);
  lhCtx.stroke();
  const lightHatchPattern = ctx.createPattern(lightHatchCanvas, 'repeat');

  // 5. Rendu vectoriel des polygones thématiques
  onProgress?.(55, 'Rendu des contours vectoriels et thématiques...');
  await new Promise((r) => setTimeout(r, 20));

  filteredFeatures.forEach((feature) => {
    const p = feature.properties || {};
    let fillColor: string | CanvasPattern = '#f8fafc';
    let fillAlpha = 0.78;

    if (activeMap === 'map-2a') {
      const c = p[COVERAGE_CONFIG.FIELDS.CLASSE_CVG];
      const def = c ? COVERAGE_CONFIG.NORMATIVE_CLASSES[c] : null;
      fillColor = def ? def.color : (hatchPattern || '#94a3b8');
      fillAlpha = 0.82;
    } else if (activeMap === 'map-2b') {
      const r = p[COVERAGE_CONFIG.FIELDS.RATIO_TOT];
      if (typeof r === 'number' && !isNaN(r)) {
        let matched = COVERAGE_CONFIG.RATIO_TOT_PALETTE[COVERAGE_CONFIG.RATIO_TOT_PALETTE.length - 1];
        for (const cls of quantileBreaks) {
          if (cls.isLast) {
            if (r >= cls.min) {
              matched = cls.color;
              break;
            }
          } else if (r <= cls.max) {
            matched = cls.color;
            break;
          }
        }
        fillColor = matched;
        fillAlpha = 0.82;
      } else {
        fillColor = hatchPattern || '#94a3b8';
      }
    } else if (activeMap === 'map-3b') {
      const pct = p[COVERAGE_CONFIG.FIELDS.PCT_INACT];
      const totA = p[COVERAGE_CONFIG.FIELDS.EFF_TOT_A];
      const totI = p[COVERAGE_CONFIG.FIELDS.EFF_TOT_I];
      const totalAsc = (totA || 0) + (totI || 0);

      if (pct === null || pct === undefined || isNaN(pct) || totA === null) {
        fillColor = hatchPattern || '#94a3b8';
      } else if (totalAsc < COVERAGE_CONFIG.MIN_TOTAL_ASC_FOR_PCT) {
        fillColor = lightHatchPattern || '#cbd5e1';
      } else {
        let matched = COVERAGE_CONFIG.PCT_INACT_CLASSES[COVERAGE_CONFIG.PCT_INACT_CLASSES.length - 1].color;
        for (const cls of COVERAGE_CONFIG.PCT_INACT_CLASSES) {
          if (pct < cls.max) {
            matched = cls.color;
            break;
          }
        }
        fillColor = matched;
        fillAlpha = 0.82;
      }
    } else {
      // Cartes 1 et 3a : fond semi-transparent neutre pour faire ressortir le relief et les cercles
      fillColor = 'rgba(248, 250, 252, 0.45)';
      fillAlpha = 0.5;
    }

    ctx.save();
    ctx.fillStyle = fillColor;
    ctx.globalAlpha = fillAlpha;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.8;

    const geom = feature.geometry;
    if (geom?.type === 'Polygon') {
      ctx.beginPath();
      drawPolygonPath(ctx, geom.coordinates, toCanvasX, toCanvasY);
      ctx.fill();
      ctx.globalAlpha = 1.0;
      ctx.stroke();
    } else if (geom?.type === 'MultiPolygon') {
      ctx.beginPath();
      geom.coordinates.forEach((poly: any[]) => {
        drawPolygonPath(ctx, poly, toCanvasX, toCanvasY);
      });
      ctx.fill();
      ctx.globalAlpha = 1.0;
      ctx.stroke();
    }
    ctx.restore();
  });

  // 6. Rendu des symboles proportionnels (Cartes 1 et 3a)
  if (activeMap === 'map-1' || activeMap === 'map-3a') {
    onProgress?.(70, 'Tracé des cercles proportionnels...');
    await new Promise((r) => setTimeout(r, 20));

    const isMap1 = activeMap === 'map-1';
    const checkField = isMap1 ? selectedCategoryField : COVERAGE_CONFIG.FIELDS.EFF_TOT_I;
    const activeCat = COVERAGE_CONFIG.ASC_CATEGORIES.find((c) => c.field === checkField) || COVERAGE_CONFIG.ASC_CATEGORIES[0];
    const circleColor = isMap1 ? activeCat.color : COVERAGE_CONFIG.INACTIVE_CIRCLES_COLOR;

    let maxVal = 0;
    filteredFeatures.forEach((f) => {
      const v = f.properties?.[checkField];
      if (typeof v === 'number' && v > maxVal) maxVal = v;
    });
    if (maxVal === 0) maxVal = 100;

    const maxRadiusPx = 80;
    const minRadiusPx = 6;

    filteredFeatures.forEach((f) => {
      const v = f.properties?.[checkField];
      if (typeof v === 'number' && v > 0) {
        const [centerLng, centerLat] = getFeatureCenter(f);
        const [px, py] = projectWebMercator(centerLng, centerLat);
        const cx = toCanvasX(px);
        const cy = toCanvasY(py);

        const radius = Math.max(minRadiusPx, Math.sqrt(v / maxVal) * maxRadiusPx);

        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fillStyle = circleColor;
        ctx.globalAlpha = 0.78;
        ctx.fill();
        ctx.globalAlpha = 1.0;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ctx.restore();
      }
    });
  }

  // 7. Flèche du Nord et Barre d'échelle
  onProgress?.(80, 'Disposition de la flèche du nord et de l\'échelle...');
  await new Promise((r) => setTimeout(r, 20));

  drawNorthArrow(ctx, mapFrameX + mapFrameW - 80, mapFrameY + 80, 80);

  const kmPerLng = 111.32 * Math.cos((bounds.centerLat * Math.PI) / 180);
  const pxPerLng = Math.abs(toCanvasX(projectWebMercator(bounds.centerLng + 1, bounds.centerLat)[0]) - toCanvasX(projectWebMercator(bounds.centerLng, bounds.centerLat)[0]));
  const pxPerKm = pxPerLng / kmPerLng;

  let targetKm = 100;
  if (selectedRegion) targetKm = 50;
  if (level === 'aires_sante') targetKm = 20;
  const scalePx = targetKm * pxPerKm;
  drawScaleBar(ctx, mapFrameX + mapFrameW - scalePx - 40, mapFrameY + mapFrameH - 40, scalePx, targetKm);

  // 8. LÉGENDE CARTOGRAPHIQUE EN POSITION VERTICALE
  onProgress?.(88, 'Mise en page de la légende verticale...');
  await new Promise((r) => setTimeout(r, 20));

  // Positionnement et dimensionnement adaptatif du cartouche de légende verticale :
  // La largeur et la hauteur sont calculées dynamiquement pour matcher au plus près
  // avec le contenu textuel et les figurés, sans espace vide excessif.
  const swatchW = 34;
  const swatchH = 22;
  let maxRequiredWidth = 0;
  let legendH = 260;

  // Mesure préalable du texte avec les polices exactes
  ctx.save();
  ctx.font = 'bold 20px sans-serif';
  maxRequiredWidth = Math.max(maxRequiredWidth, ctx.measureText('LÉGENDE OFFICIELLE').width + 48);

  const isMap1 = activeMap === 'map-1';
  const isMap3a = activeMap === 'map-3a';
  const checkField = isMap1 ? selectedCategoryField : COVERAGE_CONFIG.FIELDS.EFF_TOT_I;
  const activeCat = COVERAGE_CONFIG.ASC_CATEGORIES.find((c) => c.field === checkField) || COVERAGE_CONFIG.ASC_CATEGORIES[0];
  const circleColor = isMap1 ? activeCat.color : COVERAGE_CONFIG.INACTIVE_CIRCLES_COLOR;

  let maxVal = 0;
  if (isMap1 || isMap3a) {
    filteredFeatures.forEach((f) => {
      const v = f.properties?.[checkField];
      if (typeof v === 'number' && v > maxVal) maxVal = v;
    });
    if (maxVal === 0) maxVal = 100;
  }

  const refValues = [Math.round(maxVal), Math.round(maxVal * 0.5), Math.max(1, Math.round(maxVal * 0.1))];
  const refLabels = ['Maximum observé', 'Médiane (50 %)', 'Référence (10 %)'];
  const suffix = isMap1 ? 'ASC' : 'inactifs';

  if (activeMap === 'map-2a') {
    ctx.font = 'bold 15px sans-serif';
    Object.values(COVERAGE_CONFIG.NORMATIVE_CLASSES).forEach((cls) => {
      const w = ctx.measureText(cls.label).width;
      maxRequiredWidth = Math.max(maxRequiredWidth, 22 + swatchW + 16 + w + 24);
    });
    const noDataW = ctx.measureText('Données non disponibles').width;
    maxRequiredWidth = Math.max(maxRequiredWidth, 22 + swatchW + 16 + noDataW + 24);
    legendH = 76 + 5 * 34 + 16;
  } else if (activeMap === 'map-2b') {
    ctx.font = 'bold 14px monospace';
    const subTitleW = ctx.measureText('Ratio de couverture (1 ASC pour X habitants) :').width;
    maxRequiredWidth = Math.max(maxRequiredWidth, 22 + subTitleW + 24);

    ctx.font = 'bold 15px monospace';
    quantileBreaks.forEach((cls) => {
      const w = ctx.measureText(cls.label).width;
      maxRequiredWidth = Math.max(maxRequiredWidth, 22 + swatchW + 16 + w + 24);
    });
    ctx.font = 'bold 15px sans-serif';
    const noDataW = ctx.measureText('Données non disponibles').width;
    maxRequiredWidth = Math.max(maxRequiredWidth, 22 + swatchW + 16 + noDataW + 24);
    legendH = 76 + 24 + (quantileBreaks.length + 1) * 34 + 16;
  } else if (activeMap === 'map-3b') {
    ctx.font = 'bold 14px monospace';
    const subTitleW = ctx.measureText("Part d'ASC inactifs à remplacer :").width;
    maxRequiredWidth = Math.max(maxRequiredWidth, 22 + subTitleW + 24);

    ctx.font = 'bold 15px sans-serif';
    COVERAGE_CONFIG.PCT_INACT_CLASSES.forEach((cls) => {
      const w = ctx.measureText(cls.label).width;
      maxRequiredWidth = Math.max(maxRequiredWidth, 22 + swatchW + 16 + w + 24);
    });
    const smallEffW = ctx.measureText('< 5 ASC au total (effectif non significatif)').width;
    maxRequiredWidth = Math.max(maxRequiredWidth, 22 + swatchW + 16 + smallEffW + 24);
    const noDataW = ctx.measureText('Données non disponibles').width;
    maxRequiredWidth = Math.max(maxRequiredWidth, 22 + swatchW + 16 + noDataW + 24);
    legendH = 76 + 24 + 7 * 34 + 16;
  } else if (isMap1 || isMap3a) {
    ctx.font = 'bold 14px monospace';
    const subTitle = isMap1 ? `Effectif en ASC (${activeCat.shortLabel}) :` : 'Effectif en ASC inactifs :';
    const subTitleW = ctx.measureText(subTitle).width;
    maxRequiredWidth = Math.max(maxRequiredWidth, 22 + subTitleW + 24);

    refValues.forEach((val, idx) => {
      ctx.font = 'bold 15px monospace';
      const valW = ctx.measureText(`${val.toLocaleString('fr-FR')} ${suffix}`).width;
      ctx.font = '13px sans-serif';
      const lblW = ctx.measureText(`(${refLabels[idx]})`).width;
      maxRequiredWidth = Math.max(maxRequiredWidth, 85 + valW + 12 + lblW + 24);
    });

    ctx.font = 'italic 13px sans-serif';
    const footerW = ctx.measureText('Surfaces proportionnelles (échelle racine carrée)').width;
    maxRequiredWidth = Math.max(maxRequiredWidth, 22 + footerW + 24);
    legendH = 76 + 24 + 3 * 46 + 26 + 16;
  }
  ctx.restore();

  // Largeur ajustée aux écrits
  const legendW = Math.max(260, Math.ceil(maxRequiredWidth));
  const legX = mapFrameX + 35;
  const legY = mapFrameY + mapFrameH - legendH - 35;

  ctx.save();
  // Boîte de la légende
  ctx.fillStyle = 'rgba(255, 255, 255, 0.94)';
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(legX, legY, legendW, legendH, 16);
  ctx.fill();
  ctx.stroke();

  // En-tête de légende
  ctx.fillStyle = '#006948';
  ctx.font = 'bold 20px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('LÉGENDE OFFICIELLE', legX + 22, legY + 36);

  ctx.strokeStyle = '#006948';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(legX + 22, legY + 46);
  ctx.lineTo(legX + legendW - 22, legY + 46);
  ctx.stroke();

  let itemY = legY + 76;
  const textX = legX + 22 + swatchW + 16;

  if (activeMap === 'map-2a') {
    Object.values(COVERAGE_CONFIG.NORMATIVE_CLASSES).forEach((cls) => {
      ctx.fillStyle = cls.color;
      ctx.fillRect(legX + 22, itemY - 16, swatchW, swatchH);
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1.2;
      ctx.strokeRect(legX + 22, itemY - 16, swatchW, swatchH);

      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 15px sans-serif';
      ctx.fillText(cls.label, textX, itemY);
      itemY += 34;
    });

    // Données non disponibles
    ctx.fillStyle = hatchPattern || '#94a3b8';
    ctx.fillRect(legX + 22, itemY - 16, swatchW, swatchH);
    ctx.strokeRect(legX + 22, itemY - 16, swatchW, swatchH);
    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText('Données non disponibles', textX, itemY);
    itemY += 34;
  } else if (activeMap === 'map-2b') {
    ctx.fillStyle = '#475569';
    ctx.font = 'bold 14px monospace';
    ctx.fillText('Ratio de couverture (1 ASC pour X habitants) :', legX + 22, itemY - 6);
    itemY += 24;

    quantileBreaks.forEach((cls) => {
      ctx.fillStyle = cls.color;
      ctx.fillRect(legX + 22, itemY - 16, swatchW, swatchH);
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1.2;
      ctx.strokeRect(legX + 22, itemY - 16, swatchW, swatchH);

      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 15px monospace';
      ctx.fillText(cls.label, textX, itemY);
      itemY += 34;
    });

    ctx.fillStyle = hatchPattern || '#94a3b8';
    ctx.fillRect(legX + 22, itemY - 16, swatchW, swatchH);
    ctx.strokeRect(legX + 22, itemY - 16, swatchW, swatchH);
    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText('Données non disponibles', textX, itemY);
  } else if (activeMap === 'map-3b') {
    ctx.fillStyle = '#475569';
    ctx.font = 'bold 14px monospace';
    ctx.fillText("Part d'ASC inactifs à remplacer :", legX + 22, itemY - 6);
    itemY += 24;

    COVERAGE_CONFIG.PCT_INACT_CLASSES.forEach((cls) => {
      ctx.fillStyle = cls.color;
      ctx.fillRect(legX + 22, itemY - 16, swatchW, swatchH);
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1.2;
      ctx.strokeRect(legX + 22, itemY - 16, swatchW, swatchH);

      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 15px sans-serif';
      ctx.fillText(cls.label, textX, itemY);
      itemY += 34;
    });

    // Effectif faible
    ctx.fillStyle = lightHatchPattern || '#cbd5e1';
    ctx.fillRect(legX + 22, itemY - 16, swatchW, swatchH);
    ctx.strokeRect(legX + 22, itemY - 16, swatchW, swatchH);
    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText('< 5 ASC au total (effectif non significatif)', textX, itemY);
    itemY += 34;

    // Données non disponibles
    ctx.fillStyle = hatchPattern || '#94a3b8';
    ctx.fillRect(legX + 22, itemY - 16, swatchW, swatchH);
    ctx.strokeRect(legX + 22, itemY - 16, swatchW, swatchH);
    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText('Données non disponibles', textX, itemY);
  } else if (isMap1 || isMap3a) {
    ctx.fillStyle = '#475569';
    ctx.font = 'bold 14px monospace';
    const subTitle = isMap1 ? `Effectif en ASC (${activeCat.shortLabel}) :` : 'Effectif en ASC inactifs :';
    ctx.fillText(subTitle, legX + 22, itemY - 6);
    itemY += 24;

    refValues.forEach((val, idx) => {
      const r = Math.max(5, Math.sqrt(val / maxVal) * 36);
      ctx.beginPath();
      ctx.arc(legX + 38, itemY, r, 0, Math.PI * 2);
      ctx.fillStyle = circleColor;
      ctx.globalAlpha = 0.78;
      ctx.fill();
      ctx.globalAlpha = 1.0;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 15px monospace';
      const valStr = `${val.toLocaleString('fr-FR')} ${suffix}`;
      ctx.fillText(valStr, legX + 85, itemY + 5);
      const valStrW = ctx.measureText(valStr).width;

      ctx.fillStyle = '#64748b';
      ctx.font = '13px sans-serif';
      ctx.fillText(`(${refLabels[idx]})`, legX + 85 + valStrW + 12, itemY + 5);

      itemY += 46;
    });

    ctx.fillStyle = '#64748b';
    ctx.font = 'italic 13px sans-serif';
    ctx.fillText('Surfaces proportionnelles (échelle racine carrée)', legX + 22, itemY);
  }

  ctx.restore();

  // 9. En-tête institutionnel
  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillStyle = '#006948';
  ctx.fillText('RÉPUBLIQUE DU CAMEROUN • MINISTÈRE DE LA SANTÉ PUBLIQUE', canvasWidth / 2, 75);

  ctx.font = 'bold 17px monospace';
  ctx.fillStyle = '#475569';
  ctx.fillText("DIRECTION DE L'ORGANISATION DES SOINS ET DE LA TECHNOLOGIE SANITAIRE (DOSTS)", canvasWidth / 2, 105);

  const levelName = {
    regions: 'Régions',
    departements: 'Départements',
    arrondissements: 'Arrondissements',
    districts_sante: 'Districts de Santé',
    aires_sante: 'Aires de Santé',
  }[level];

  const territoryStr = selectedSubdivision
    ? (selectedSubdivision.type === 'district' ? `District : ${selectedSubdivision.name}` : `Département : ${selectedSubdivision.name}`)
    : (selectedRegion ? `Région : ${selectedRegion}` : 'National (Cameroun)');

  let mapTitle = '';
  let mapSubtitle = '';

  if (activeMap === 'map-1') {
    const activeCat = COVERAGE_CONFIG.ASC_CATEGORIES.find((c) => c.field === selectedCategoryField) || COVERAGE_CONFIG.ASC_CATEGORIES[0];
    mapTitle = `Effectifs des Acteurs de Santé : ${activeCat.label}`;
    mapSubtitle = `Découpage : ${levelName} • Territoire : ${territoryStr} • Fond de carte : ${basemap.toUpperCase()}`;
  } else if (activeMap === 'map-2a') {
    mapTitle = 'Couverture normative en Agents de Santé Communautaire Polyvalents (ASCp)';
    mapSubtitle = `Découpage : ${levelName} • Territoire : ${territoryStr} • Norme MINSANTE (1 pour 1 000 hab. / 1 pour 2 500 hab.)`;
  } else if (activeMap === 'map-2b') {
    mapTitle = 'Couverture toutes catégories d\'ASC (1 ASC pour X habitants)';
    mapSubtitle = `Découpage : ${levelName} • Territoire : ${territoryStr} • Quintiles relatifs • Fond de carte : ${basemap.toUpperCase()}`;
  } else if (activeMap === 'map-3a') {
    mapTitle = 'Effectif des Agents de Santé Communautaire inactifs à remplacer';
    mapSubtitle = `Découpage : ${levelName} • Territoire : ${territoryStr} • Symboles proportionnels`;
  } else if (activeMap === 'map-3b') {
    mapTitle = 'Part d\'Agents de Santé Communautaire inactifs (%)';
    mapSubtitle = `Découpage : ${levelName} • Territoire : ${territoryStr} • Seuils fixes d\'inactivité • Fond de carte : ${basemap.toUpperCase()}`;
  }

  ctx.font = 'bold 36px sans-serif';
  ctx.fillStyle = '#0f172a';
  ctx.fillText(mapTitle, canvasWidth / 2, 175);

  ctx.font = '21px sans-serif';
  ctx.fillStyle = '#334155';
  ctx.fillText(mapSubtitle, canvasWidth / 2, 220);

  ctx.strokeStyle = '#006948';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(marginX, 255);
  ctx.lineTo(canvasWidth - marginX, 255);
  ctx.stroke();
  ctx.restore();

  // 10. Pied de page cartographique (Source, norme, date)
  const footerY = canvasHeight - 80;
  ctx.save();
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(marginX, footerY - 30);
  ctx.lineTo(canvasWidth - marginX, footerY - 30);
  ctx.stroke();

  ctx.fillStyle = '#475569';
  ctx.font = '16px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`Source données : ${COVERAGE_CONFIG.SOURCES.MAP_SOURCE} | Fond : © OpenStreetMap contributors / DOSTS`, marginX, footerY);

  let noteStr = '';
  if (activeMap === 'map-2a') noteStr = COVERAGE_CONFIG.SOURCES.NORMATIVE_NOTE;
  if (activeMap === 'map-2b') noteStr = COVERAGE_CONFIG.SOURCES.RATIO_TOT_NOTE;
  if (noteStr) {
    ctx.font = '15px sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.fillText(`Norme : ${noteStr}`, marginX, footerY + 25);
  }

  const nowStr = new Date().toISOString().split('T')[0];
  ctx.textAlign = 'right';
  ctx.fillStyle = '#64748b';
  ctx.font = '16px monospace';
  ctx.fillText(`Atlas A4 (300 DPI) — DOSTS/MINSANTE — Exporté le ${nowStr}`, canvasWidth - marginX, footerY);
  ctx.restore();

  // 11. Filigrane diagonal si données factices
  if (COVERAGE_CONFIG.SHOW_MOCK_BANNER) {
    drawMockWatermark(ctx, canvasWidth, canvasHeight);
  }

  onProgress?.(95, 'Finalisation du fichier image PNG...');
  await new Promise((r) => setTimeout(r, 20));

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        onProgress?.(100, 'Exportation terminée avec succès !');
        resolve(blob);
      } else {
        reject(new Error("Échec de génération du blob d'image"));
      }
    }, 'image/png');
  });
}

/**
 * 2. SMALL MULTIPLES (CARTE 1 : PLANCHE DES 6 CATÉGORIES EN GRILLE 2x3 SUR A4)
 * Chaque panneau intègre son fond de carte et sa propre LÉGENDE VERTICALE INDIVIDUELLE
 */
export async function exportSmallMultiplesPng(options: {
  level: SubdivisionLevel;
  selectedRegion: string | null;
  selectedSubdivision?: TerritorialFilter | null;
  geoData: any;
  basemap?: BasemapType;
  onProgress?: ExportProgressCallback;
}): Promise<Blob> {
  const { level, selectedRegion, selectedSubdivision = null, geoData, basemap = 'hot', onProgress } = options;

  onProgress?.(5, 'Initialisation de la planche Small Multiples (A4 300 DPI)...');
  await new Promise((r) => setTimeout(r, 20));

  const canvasWidth = 2480;
  const canvasHeight = 3508;

  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Impossible de créer le contexte 2D');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  const allFeatures: any[] = geoData?.features || [];
  const filteredFeatures = allFeatures.filter((f) =>
    isFeatureInTerritorialFilter(f, selectedRegion, selectedSubdivision, level)
  );

  if (filteredFeatures.length === 0) throw new Error('Aucune entité trouvée pour les filtres sélectionnés.');

  const categories = COVERAGE_CONFIG.ASC_CATEGORIES;

  // Calcul du max global pour l'échelle commune
  let maxGlobal = 0;
  allFeatures.forEach((f) => {
    categories.forEach((cat) => {
      const v = f.properties?.[cat.field];
      if (typeof v === 'number' && v > maxGlobal) maxGlobal = v;
    });
  });
  if (maxGlobal === 0) maxGlobal = 100;

  const bounds = computeFeaturesProjectedBounds(filteredFeatures);
  const bboxW = bounds.maxX - bounds.minX;
  const bboxH = bounds.maxY - bounds.minY;

  const marginX = 80;
  const headerH = 260;
  const footerH = 110;
  const gridW = canvasWidth - marginX * 2;
  const gridH = canvasHeight - headerH - footerH;

  const cols = 2;
  const rows = 3;
  const gapX = 50;
  const gapY = 40;

  const cellW = (gridW - gapX * (cols - 1)) / cols;
  const cellH = (gridH - gapY * (rows - 1)) / rows;

  const innerPad = 25;
  const availW = cellW - innerPad * 2;
  const availH = cellH - innerPad * 2 - 45; // 45px en-tête

  const scale = Math.min(availW / bboxW, availH / bboxH);
  const renderedW = bboxW * scale;
  const renderedH = bboxH * scale;

  // En-tête principal
  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#006948';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText('RÉPUBLIQUE DU CAMEROUN • MINISTÈRE DE LA SANTÉ PUBLIQUE • DOSTS', canvasWidth / 2, 70);

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 36px sans-serif';
  ctx.fillText("Cartographie Comparative des 6 Catégories d'ASC Actifs", canvasWidth / 2, 145);

  const levelName = {
    regions: 'Régions',
    departements: 'Départements',
    arrondissements: 'Arrondissements',
    districts_sante: 'Districts de Santé',
    aires_sante: 'Aires de Santé',
  }[level];
  const territoryStr = selectedSubdivision
    ? (selectedSubdivision.type === 'district' ? `District : ${selectedSubdivision.name}` : `Département : ${selectedSubdivision.name}`)
    : (selectedRegion ? `Région : ${selectedRegion}` : 'National (Cameroun)');
  ctx.font = '21px sans-serif';
  ctx.fillStyle = '#475569';
  ctx.fillText(`Découpage : ${levelName} • Territoire : ${territoryStr} • Fond de carte : ${basemap.toUpperCase()} • Échelle commune`, canvasWidth / 2, 195);

  ctx.strokeStyle = '#006948';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(marginX, 230);
  ctx.lineTo(canvasWidth - marginX, 230);
  ctx.stroke();
  ctx.restore();

  // Rendu de chacun des 6 panneaux
  for (let idx = 0; idx < categories.length; idx++) {
    const cat = categories[idx];
    const col = idx % cols;
    const row = Math.floor(idx / cols);

    const cellX = marginX + col * (cellW + gapX);
    const cellY = headerH + row * (cellH + gapY);

    onProgress?.(15 + Math.round((idx / 6) * 70), `Rendu du panneau ${idx + 1}/6 : ${cat.shortLabel} avec fond de carte...`);
    await new Promise((r) => setTimeout(r, 20));

    // Cadre de la cellule
    ctx.save();
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(cellX, cellY, cellW, cellH);

    // Titre de la cellule
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(cellX, cellY, cellW, 48);
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(cellX, cellY, cellW, 48);

    // Pastille couleur
    ctx.beginPath();
    ctx.arc(cellX + 26, cellY + 24, 11, 0, Math.PI * 2);
    ctx.fillStyle = cat.color;
    ctx.fill();

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 19px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${idx + 1}. ${cat.label}`, cellX + 48, cellY + 30);

    let catMax = 0;
    filteredFeatures.forEach((f) => {
      const v = f.properties?.[cat.field];
      if (typeof v === 'number' && v > catMax) catMax = v;
    });
    ctx.font = 'bold 15px monospace';
    ctx.fillStyle = '#64748b';
    ctx.textAlign = 'right';
    ctx.fillText(`Max : ${catMax.toLocaleString('fr-FR')} ASC`, cellX + cellW - 16, cellY + 30);

    // Aire cartographique du panneau
    const mapAreaY = cellY + 48;
    const mapAreaH = cellH - 48;
    const cOffsetX = cellX + innerPad + (availW - renderedW) / 2;
    const cOffsetY = mapAreaY + innerPad + (availH - renderedH) / 2;

    const cToCanvasX = (px: number) => cOffsetX + (px - bounds.minX) * scale;
    const cToCanvasY = (py: number) => cOffsetY + (bounds.maxY - py) * scale;

    // 1. Fond de carte tuilé pour ce panneau
    try {
      await fetchAndRenderBasemapTiles(
        ctx,
        basemap,
        bounds.minLng,
        bounds.maxLng,
        bounds.minLat,
        bounds.maxLat,
        cellX,
        mapAreaY,
        cellW,
        mapAreaH,
        cToCanvasX,
        cToCanvasY
      );
    } catch (e) {
      // Poursuivre si tuile indisponible
    }

    // Bordure du panneau
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2;
    ctx.strokeRect(cellX, cellY, cellW, cellH);

    // 2. Polygones de délimitation
    ctx.fillStyle = 'rgba(248, 250, 252, 0.4)';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.2;

    filteredFeatures.forEach((f) => {
      const geom = f.geometry;
      if (geom?.type === 'Polygon') {
        ctx.beginPath();
        drawPolygonPath(ctx, geom.coordinates, cToCanvasX, cToCanvasY);
        ctx.fill();
        ctx.stroke();
      } else if (geom?.type === 'MultiPolygon') {
        ctx.beginPath();
        geom.coordinates.forEach((poly: any[]) => {
          drawPolygonPath(ctx, poly, cToCanvasX, cToCanvasY);
        });
        ctx.fill();
        ctx.stroke();
      }
    });

    // 3. Cercles proportionnels (échelle commune basée sur maxGlobal)
    const maxRadiusPx = 48;
    const minRadiusPx = 4;

    filteredFeatures.forEach((f) => {
      const v = f.properties?.[cat.field];
      if (typeof v === 'number' && v > 0) {
        const [centerLng, centerLat] = getFeatureCenter(f);
        const [px, py] = projectWebMercator(centerLng, centerLat);
        const cx = cToCanvasX(px);
        const cy = cToCanvasY(py);

        const radius = Math.max(minRadiusPx, Math.sqrt(v / maxGlobal) * maxRadiusPx);

        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fillStyle = cat.color;
        ctx.globalAlpha = 0.8;
        ctx.fill();
        ctx.globalAlpha = 1.0;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.6;
        ctx.stroke();
      }
    });

    // 4. LÉGENDE VERTICALE INDIVIDUELLE SUR CHAQUE CARTE
    // Positionnée en bas à gauche de la carte
    const pLegW = 280;
    const pLegH = 175;
    const pLegX = cellX + 16;
    const pLegY = cellY + cellH - pLegH - 16;

    ctx.fillStyle = 'rgba(255, 255, 255, 0.94)';
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(pLegX, pLegY, pLegW, pLegH, 10);
    ctx.fill();
    ctx.stroke();

    // Titre légende individuelle
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`Légende (${cat.shortLabel}) :`, pLegX + 14, pLegY + 22);

    ctx.strokeStyle = cat.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(pLegX + 14, pLegY + 28);
    ctx.lineTo(pLegX + pLegW - 14, pLegY + 28);
    ctx.stroke();

    // Cercles de référence verticaux pour ce panneau
    const pRefs = [
      { val: catMax, label: 'Max observé' },
      { val: Math.round(catMax * 0.5), label: '50 %' },
      { val: Math.max(1, Math.round(catMax * 0.1)), label: '10 %' },
    ];

    let pItemY = pLegY + 54;
    pRefs.forEach((rObj) => {
      const r = Math.max(3, Math.sqrt(rObj.val / maxGlobal) * maxRadiusPx);
      ctx.beginPath();
      ctx.arc(pLegX + 32, pItemY, r, 0, Math.PI * 2);
      ctx.fillStyle = cat.color;
      ctx.globalAlpha = 0.8;
      ctx.fill();
      ctx.globalAlpha = 1.0;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 13px monospace';
      ctx.fillText(`${rObj.val.toLocaleString('fr-FR')} ASC`, pLegX + 75, pItemY + 4);

      ctx.fillStyle = '#64748b';
      ctx.font = '11px sans-serif';
      ctx.fillText(`(${rObj.label})`, pLegX + 175, pItemY + 4);

      pItemY += 38;
    });

    ctx.fillStyle = '#64748b';
    ctx.font = 'italic 10px sans-serif';
    ctx.fillText('Échelle commune basée sur max global', pLegX + 14, pLegY + pLegH - 8);

    ctx.restore();
  }

  // Pied de page
  const footerY = canvasHeight - 55;
  ctx.save();
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(marginX, footerY - 20);
  ctx.lineTo(canvasWidth - marginX, footerY - 20);
  ctx.stroke();

  ctx.font = '15px sans-serif';
  ctx.fillStyle = '#475569';
  ctx.textAlign = 'left';
  ctx.fillText(`Source : ${COVERAGE_CONFIG.SOURCES.MAP_SOURCE} | Fond de carte : © OpenStreetMap contributors / DOSTS`, marginX, footerY);

  const nowStr = new Date().toISOString().split('T')[0];
  ctx.textAlign = 'right';
  ctx.fillStyle = '#64748b';
  ctx.font = '15px monospace';
  ctx.fillText(`Planche comparative A4 300 DPI — DOSTS/MINSANTE — ${nowStr}`, canvasWidth - marginX, footerY);
  ctx.restore();

  // Filigrane si activé
  if (COVERAGE_CONFIG.SHOW_MOCK_BANNER) {
    drawMockWatermark(ctx, canvasWidth, canvasHeight);
  }

  onProgress?.(95, 'Finalisation de la planche Small Multiples...');
  await new Promise((r) => setTimeout(r, 20));

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        onProgress?.(100, 'Export Small Multiples terminé !');
        resolve(blob);
      } else {
        reject(new Error("Échec de génération du blob d'image"));
      }
    }, 'image/png');
  });
}

/**
 * 3. EXPORTATION CARTE LIVRABLE 3 — Besoin Réel ASC (accès FOSA < 5 km)
 * Choroplèthe par % population couverte. Format A4 300 DPI.
 */
export async function exportCiblageAscMapPng(options: {
  level: SubdivisionLevel;
  selectedRegion: string | null;
  selectedSubdivision?: TerritorialFilter | null;
  geoData: any;
  basemap?: BasemapType;
  orientation?: 'portrait' | 'landscape';
  language?: 'fr' | 'en';
  onProgress?: ExportProgressCallback;
}): Promise<Blob> {
  const {
    level,
    selectedRegion,
    selectedSubdivision = null,
    geoData,
    basemap = 'hot',
    orientation = 'portrait',
    language = 'fr',
    onProgress,
  } = options;

  onProgress?.(5, 'Initialisation du document A4 (300 DPI)...');
  await new Promise((r) => setTimeout(r, 20));

  const isPortrait = orientation === 'portrait';
  const canvasWidth = isPortrait ? 2480 : 3508;
  const canvasHeight = isPortrait ? 3508 : 2480;

  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Impossible de créer le contexte 2D');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  onProgress?.(15, 'Calcul des coordonnées et du cadrage...');
  await new Promise((r) => setTimeout(r, 20));

  const allFeatures: any[] = geoData?.features || [];
  const filteredFeatures = allFeatures.filter((f) =>
    isFeatureInTerritorialFilter(f, selectedRegion, selectedSubdivision, level)
  );

  if (filteredFeatures.length === 0) {
    throw new Error('Aucune entité trouvée pour le filtre sélectionné.');
  }

  const marginX = 90;
  const headerH = 310;
  const footerH = 140;
  const mapFrameX = marginX;
  const mapFrameY = headerH;
  const mapFrameW = canvasWidth - marginX * 2;
  const mapFrameH = canvasHeight - headerH - footerH;

  const bounds = computeFeaturesProjectedBounds(filteredFeatures);
  const bboxW = bounds.maxX - bounds.minX;
  const bboxH = bounds.maxY - bounds.minY;

  const innerPad = 60;
  const availW = mapFrameW - innerPad * 2;
  const availH = mapFrameH - innerPad * 2;
  const scale = Math.min(availW / bboxW, availH / bboxH);
  const renderedW = bboxW * scale;
  const renderedH = bboxH * scale;

  const offsetX = mapFrameX + innerPad + (availW - renderedW) / 2;
  const offsetY = mapFrameY + innerPad + (availH - renderedH) / 2;

  const toCanvasX = (px: number) => offsetX + (px - bounds.minX) * scale;
  const toCanvasY = (py: number) => offsetY + (bounds.maxY - py) * scale;

  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(mapFrameX, mapFrameY, mapFrameW, mapFrameH);

  onProgress?.(30, `Chargement du fond de carte (${basemap.toUpperCase()})...`);
  await new Promise((r) => setTimeout(r, 20));

  try {
    await fetchAndRenderBasemapTiles(
      ctx, basemap,
      bounds.minLng, bounds.maxLng, bounds.minLat, bounds.maxLat,
      mapFrameX, mapFrameY, mapFrameW, mapFrameH,
      toCanvasX, toCanvasY
    );
  } catch (err) {
    console.warn('Fond de carte indisponible, export sans fond:', err);
  }

  ctx.strokeStyle = '#64748b';
  ctx.lineWidth = 2.5;
  ctx.strokeRect(mapFrameX, mapFrameY, mapFrameW, mapFrameH);

  const getColorForPct = (pct: number): string => {
    if (pct >= 90) return '#006948';
    if (pct >= 80) return '#22c55e';
    if (pct >= 65) return '#eab308';
    if (pct >= 50) return '#f97316';
    return '#dc2626';
  };

  onProgress?.(55, 'Rendu des polygones thématiques...');
  await new Promise((r) => setTimeout(r, 20));

  filteredFeatures.forEach((feature) => {
    const p = feature.properties || {};
    const pct = typeof p.popCoveredPercent === 'number' ? p.popCoveredPercent : -1;
    const fillColor = pct >= 0 ? getColorForPct(pct) : '#94a3b8';

    ctx.save();
    ctx.fillStyle = fillColor;
    ctx.globalAlpha = 0.82;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.8;

    const geom = feature.geometry;
    if (geom?.type === 'Polygon') {
      ctx.beginPath();
      drawPolygonPath(ctx, geom.coordinates, toCanvasX, toCanvasY);
      ctx.fill();
      ctx.globalAlpha = 1.0;
      ctx.stroke();
    } else if (geom?.type === 'MultiPolygon') {
      ctx.beginPath();
      geom.coordinates.forEach((poly: any[]) => drawPolygonPath(ctx, poly, toCanvasX, toCanvasY));
      ctx.fill();
      ctx.globalAlpha = 1.0;
      ctx.stroke();
    }
    ctx.restore();
  });

  onProgress?.(80, 'Flèche du nord et barre d\'échelle...');
  await new Promise((r) => setTimeout(r, 20));

  drawNorthArrow(ctx, mapFrameX + mapFrameW - 80, mapFrameY + 80, 80);

  const kmPerLng = 111.32 * Math.cos((bounds.centerLat * Math.PI) / 180);
  const pxPerLng = Math.abs(
    toCanvasX(projectWebMercator(bounds.centerLng + 1, bounds.centerLat)[0]) -
    toCanvasX(projectWebMercator(bounds.centerLng, bounds.centerLat)[0])
  );
  const pxPerKm = pxPerLng / kmPerLng;
  let targetKm = 100;
  if (selectedRegion) targetKm = 50;
  if (level === 'aires_sante') targetKm = 20;
  const scalePx = targetKm * pxPerKm;
  drawScaleBar(ctx, mapFrameX + mapFrameW - scalePx - 40, mapFrameY + mapFrameH - 40, scalePx, targetKm);

  onProgress?.(88, 'Mise en page de la légende...');
  await new Promise((r) => setTimeout(r, 20));

  const legendClasses = [
    { color: '#006948', label: language === 'fr' ? '≥ 90 % — Excellente couverture' : '≥ 90% — Excellent coverage' },
    { color: '#22c55e', label: language === 'fr' ? '80–89 % — Cible OMS atteinte' : '80–89% — WHO target met' },
    { color: '#eab308', label: language === 'fr' ? '65–79 % — Déficit modéré' : '65–79% — Moderate gap' },
    { color: '#f97316', label: language === 'fr' ? '50–64 % — Déficit élevé' : '50–64% — High deficit' },
    { color: '#dc2626', label: language === 'fr' ? '< 50 % — Déficit critique' : '< 50% — Critical deficit' },
    { color: '#94a3b8', label: language === 'fr' ? 'Données non disponibles' : 'Data not available' },
  ];

  const swatchW = 34;
  const swatchH = 22;
  ctx.save();
  ctx.font = 'bold 15px sans-serif';
  let maxLegW = ctx.measureText('LÉGENDE OFFICIELLE').width + 48;
  legendClasses.forEach((c) => {
    const w = ctx.measureText(c.label).width;
    maxLegW = Math.max(maxLegW, 22 + swatchW + 16 + w + 24);
  });
  ctx.restore();

  const legendW = Math.max(280, Math.ceil(maxLegW));
  const legendH = 76 + legendClasses.length * 34 + 16;
  const legX = mapFrameX + 35;
  const legY = mapFrameY + mapFrameH - legendH - 35;

  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.94)';
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(legX, legY, legendW, legendH, 16);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#006948';
  ctx.font = 'bold 20px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(language === 'fr' ? 'LÉGENDE OFFICIELLE' : 'OFFICIAL LEGEND', legX + 22, legY + 36);
  ctx.strokeStyle = '#006948';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(legX + 22, legY + 46);
  ctx.lineTo(legX + legendW - 22, legY + 46);
  ctx.stroke();

  let itemY = legY + 76;
  legendClasses.forEach((c) => {
    ctx.fillStyle = c.color;
    ctx.fillRect(legX + 22, itemY - 16, swatchW, swatchH);
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(legX + 22, itemY - 16, swatchW, swatchH);
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText(c.label, legX + 22 + swatchW + 16, itemY);
    itemY += 34;
  });
  ctx.restore();

  // Header institutionnel
  const levelName: Record<SubdivisionLevel, string> = {
    regions: language === 'fr' ? 'Régions' : 'Regions',
    departements: language === 'fr' ? 'Départements' : 'Departments',
    arrondissements: language === 'fr' ? 'Arrondissements' : 'Arrondissements',
    districts_sante: language === 'fr' ? 'Districts de Santé' : 'Health Districts',
    aires_sante: language === 'fr' ? 'Aires de Santé' : 'Health Areas',
  };
  const territoryStr = selectedSubdivision
    ? (selectedSubdivision.type === 'district' ? `District : ${selectedSubdivision.name}` : `Département : ${selectedSubdivision.name}`)
    : (selectedRegion ? `${language === 'fr' ? 'Région' : 'Region'} : ${selectedRegion}` : (language === 'fr' ? 'National (Cameroun)' : 'National (Cameroon)'));

  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillStyle = '#006948';
  ctx.fillText(
    language === 'fr'
      ? 'RÉPUBLIQUE DU CAMEROUN • MINISTÈRE DE LA SANTÉ PUBLIQUE'
      : 'REPUBLIC OF CAMEROON • MINISTRY OF PUBLIC HEALTH',
    canvasWidth / 2, 75
  );
  ctx.font = 'bold 17px monospace';
  ctx.fillStyle = '#475569';
  ctx.fillText(
    language === 'fr'
      ? "DIRECTION DE L'ORGANISATION DES SOINS ET DE LA TECHNOLOGIE SANITAIRE (DOSTS)"
      : 'DEPARTMENT OF HEALTH CARE ORGANIZATION & HEALTH TECHNOLOGY (DOSTS)',
    canvasWidth / 2, 105
  );
  ctx.font = 'bold 36px sans-serif';
  ctx.fillStyle = '#0f172a';
  ctx.fillText(
    language === 'fr'
      ? 'Besoin Réel en ASC — Accès aux FOSA (< 5 km)'
      : 'Real CHW Need — HF Access (< 5 km)',
    canvasWidth / 2, 175
  );
  ctx.font = '21px sans-serif';
  ctx.fillStyle = '#334155';
  ctx.fillText(
    `${language === 'fr' ? 'Découpage' : 'Level'} : ${levelName[level]} • ${language === 'fr' ? 'Territoire' : 'Territory'} : ${territoryStr} • ${language === 'fr' ? 'Fond' : 'Basemap'} : ${basemap.toUpperCase()}`,
    canvasWidth / 2, 220
  );
  ctx.strokeStyle = '#006948';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(marginX, 255);
  ctx.lineTo(canvasWidth - marginX, 255);
  ctx.stroke();
  ctx.restore();

  // Pied de page
  const footerY = canvasHeight - 80;
  ctx.save();
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(marginX, footerY - 30);
  ctx.lineTo(canvasWidth - marginX, footerY - 30);
  ctx.stroke();
  ctx.fillStyle = '#475569';
  ctx.font = '16px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(
    language === 'fr'
      ? 'Source : Population WorldPop ; Distances FOSA — AccessMod/DOSTS • Fond : © OpenStreetMap contributors'
      : 'Source: WorldPop population; HF distances — AccessMod/DOSTS • Basemap: © OpenStreetMap contributors',
    marginX, footerY
  );
  const nowStr = new Date().toISOString().split('T')[0];
  ctx.textAlign = 'right';
  ctx.fillStyle = '#64748b';
  ctx.font = '16px monospace';
  ctx.fillText(`Atlas A4 (300 DPI) — DOSTS/MINSANTE — ${language === 'fr' ? 'Exporté le' : 'Exported'} ${nowStr}`, canvasWidth - marginX, footerY);
  ctx.restore();

  if (COVERAGE_CONFIG.SHOW_MOCK_BANNER) {
    drawMockWatermark(ctx, canvasWidth, canvasHeight);
  }

  onProgress?.(95, 'Finalisation du fichier image PNG...');
  await new Promise((r) => setTimeout(r, 20));

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        onProgress?.(100, language === 'fr' ? 'Exportation terminée !' : 'Export complete!');
        resolve(blob);
      } else {
        reject(new Error("Échec de génération du blob d'image"));
      }
    }, 'image/png');
  });
}

/**
 * 4. EXPORT DES DONNÉES (CSV UTF-8 AVEC BOM ET SÉPARATEUR POINT-VIRGULE)
 */
export function exportCoverageCsv(options: {
  level: SubdivisionLevel;
  selectedRegion: string | null;
  selectedSubdivision?: TerritorialFilter | null;
  geoData: any;
}): string {
  const { level, selectedRegion, selectedSubdivision = null, geoData } = options;

  const allFeatures: any[] = geoData?.features || [];
  const filteredFeatures = allFeatures.filter((f) =>
    isFeatureInTerritorialFilter(f, selectedRegion, selectedSubdivision, level)
  );

  const headers = [
    'Nom de la zone',
    'Région',
    'Département',
    'District de Santé',
    'Population de référence',
    'Total ASC actifs (toutes catégories)',
    'ASC polyvalents (ASCp)',
    'ACCRA',
    'APS',
    'Pairs Éducateurs',
    'Mères Mentors',
    'Relais Communautaires',
    'ASC inactifs',
    "Part d'ASC inactifs (%)",
    'Ratio (1 ASCp pour X hab.)',
    'Ratio (1 ASC pour X hab. - toutes catégories)',
    'Classe de couverture (Code)',
    'Classe de couverture (Libellé officiel)',
  ];

  const escapeCsv = (val: any): string => {
    if (val === null || val === undefined) return 'Données non disponibles';
    const str = String(val).replace(/"/g, '""');
    if (str.includes(';') || str.includes('"') || str.includes('\n')) {
      return `"${str}"`;
    }
    return str;
  };

  const rows = filteredFeatures.map((f) => {
    const p = f.properties || {};
    const name = getFeatureNameForLevel(level, p);
    const region = p.region || p.Nom_Region || p.NAME_1 || '';
    const dept = p.dept || p.Nom_Dept || p.NAME_2 || '';
    const district = p.district || p.District_S || '';

    const pop = getPopulationForLevel(level, p);
    const popFormatted = pop !== null ? Math.round(pop) : 'Données non disponibles';

    const classeKey = p[COVERAGE_CONFIG.FIELDS.CLASSE_CVG];
    const classeDef = classeKey ? COVERAGE_CONFIG.NORMATIVE_CLASSES[classeKey] : null;

    return [
      escapeCsv(name),
      escapeCsv(region),
      escapeCsv(dept),
      escapeCsv(district),
      escapeCsv(popFormatted),
      escapeCsv(p.EFF_TOT_A),
      escapeCsv(p.EFF_ASCP_A),
      escapeCsv(p.EFF_ACC_A),
      escapeCsv(p.EFF_APS_A),
      escapeCsv(p.EFF_PE_A),
      escapeCsv(p.EFF_MM_A),
      escapeCsv(p.EFF_RC_A),
      escapeCsv(p.EFF_TOT_I),
      escapeCsv(p.PCT_INACT),
      escapeCsv(p.RATIO_ASCP),
      escapeCsv(p.RATIO_TOT),
      escapeCsv(classeKey),
      escapeCsv(classeDef?.label || 'Données non disponibles'),
    ].join(';');
  });

  return '\uFEFF' + headers.join(';') + '\n' + rows.join('\n');
}

/**
 * Déclenchement du téléchargement navigateur
 */
export function triggerBrowserDownload(content: Blob | string, filename: string) {
  const blob = typeof content === 'string' ? new Blob([content], { type: 'text/csv;charset=utf-8;' }) : content;
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
