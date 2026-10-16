import React, { useState, useEffect, useRef, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { 
  Users, 
  ShieldCheck, 
  AlertTriangle, 
  Layers, 
  Filter, 
  Activity, 
  MapPin, 
  UserMinus, 
  Percent, 
  BarChart3, 
  HelpCircle,
  Download,
  FileSpreadsheet,
  Printer,
  LayoutGrid,
  X,
  Sparkles,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Search,
  Building2
} from 'lucide-react';
import { SubdivisionLevel, BasemapType, CoverageMapType } from '../types';
import { 
  COVERAGE_CONFIG, 
  getPopulationForLevel, 
  getFeatureNameForLevel,
  getCanonicalRegionName,
  normalizeString,
  isFeatureInTerritorialFilter,
  TerritorialFilter,
  AscCategoryDef 
} from '../config/coverageConfig';
import { CouvertureAscSidePanel } from './CouvertureAscSidePanel';
import { FloatingBasemapSwitcher } from './FloatingBasemapSwitcher';
import { 
  exportSingleMapPng, 
  exportSmallMultiplesPng, 
  exportCoverageCsv, 
  triggerBrowserDownload, 
  sanitizeFilename,
  getFeatureCenter 
} from '../utils/coverageExportUtils';

interface CouvertureAscMapProps {
  language: 'fr' | 'en';
  level: SubdivisionLevel;
  onLevelChange: (level: SubdivisionLevel) => void;
  basemap: BasemapType;
  onBasemapChange?: (bm: BasemapType) => void;
  exportTrigger?: number;
  activeMap?: CoverageMapType;
  onActiveMapChange?: (map: CoverageMapType) => void;
  selectedCategoryField?: string;
  onSelectedCategoryFieldChange?: (field: string) => void;
}

export interface QuantileClass {
  min: number;
  max: number;
  color: string;
  label: string;
  isFirst: boolean;
  isLast: boolean;
}

// Fonction de calcul des 5 classes par quantiles (quintiles) avec fusion des bornes identiques
function computeQuintileBreaks(values: number[], lang: 'fr' | 'en' = 'fr'): QuantileClass[] {
  if (!values || values.length === 0) return [];
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;

  const getPercentile = (p: number) => {
    const idx = (p / 100) * (n - 1);
    const low = Math.floor(idx);
    const high = Math.ceil(idx);
    if (low === high) return sorted[low];
    return sorted[low] + (sorted[high] - sorted[low]) * (idx - low);
  };

  const min = sorted[0];
  const max = sorted[n - 1];
  const q20 = getPercentile(20);
  const q40 = getPercentile(40);
  const q60 = getPercentile(60);
  const q80 = getPercentile(80);

  const rawCuts = [min, q20, q40, q60, q80, max];
  
  // Fusion des bornes identiques pour ne pas avoir de classe vide
  const uniqueCuts = [rawCuts[0]];
  for (let i = 1; i < rawCuts.length; i++) {
    if (rawCuts[i] > uniqueCuts[uniqueCuts.length - 1]) {
      uniqueCuts.push(rawCuts[i]);
    }
  }

  const classes: QuantileClass[] = [];
  const palette = COVERAGE_CONFIG.RATIO_TOT_PALETTE;
  const numClasses = uniqueCuts.length - 1;

  for (let i = 0; i < numClasses; i++) {
    const minVal = uniqueCuts[i];
    const maxVal = uniqueCuts[i + 1];
    const colorIdx = numClasses === 1 ? 2 : Math.round((i / (numClasses - 1)) * (palette.length - 1));
    const color = palette[colorIdx];

    const locale = lang === 'fr' ? 'fr-FR' : 'en-US';
    const label = lang === 'fr'
      ? (i === 0
          ? `1 ASC pour ≤ ${Math.round(maxVal).toLocaleString(locale)} hab.`
          : i === numClasses - 1
          ? `1 ASC pour > ${Math.round(minVal).toLocaleString(locale)} hab.`
          : `1 ASC pour ${Math.round(minVal).toLocaleString(locale)} à ${Math.round(maxVal).toLocaleString(locale)} hab.`)
      : (i === 0
          ? `1 CHW per ≤ ${Math.round(maxVal).toLocaleString(locale)} pop.`
          : i === numClasses - 1
          ? `1 CHW per > ${Math.round(minVal).toLocaleString(locale)} pop.`
          : `1 CHW per ${Math.round(minVal).toLocaleString(locale)}–${Math.round(maxVal).toLocaleString(locale)} pop.`);

    classes.push({
      min: minVal,
      max: maxVal,
      isFirst: i === 0,
      isLast: i === numClasses - 1,
      color,
      label
    });
  }
  return classes;
}

export const CouvertureAscMap: React.FC<CouvertureAscMapProps> = ({
  language,
  level,
  onLevelChange,
  basemap,
  onBasemapChange,
  exportTrigger,
  activeMap: externalActiveMap,
  onActiveMapChange,
  selectedCategoryField: externalCategoryField,
  onSelectedCategoryFieldChange,
}) => {
  // Navigation active entre les cartes (gérée par le parent ou en interne)
  const [internalActiveMap, setInternalActiveMap] = useState<CoverageMapType>('map-1');
  const activeMap = externalActiveMap ?? internalActiveMap;
  const setActiveMap = (map: CoverageMapType) => {
    if (onActiveMapChange) onActiveMapChange(map);
    else setInternalActiveMap(map);
  };

  // Sélecteur de catégorie d'effectifs pour Carte 1 (défaut : EFF_TOT_A)
  const [internalCategoryField, setInternalCategoryField] = useState<string>(
    COVERAGE_CONFIG.FIELDS.EFF_TOT_A
  );
  const selectedCategoryField = externalCategoryField ?? internalCategoryField;
  const setSelectedCategoryField = (field: string) => {
    if (onSelectedCategoryFieldChange) onSelectedCategoryFieldChange(field);
    else setInternalCategoryField(field);
  };

  // Filtre par région (persistant lors du changement de carte)
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);

  // Filtre territorial fin (département ou district sanitaire)
  const [selectedSubdivision, setSelectedSubdivision] = useState<TerritorialFilter | null>(null);
  const [searchSubdivText, setSearchSubdivText] = useState<string>('');
  const [isSubdivDropdownOpen, setIsSubdivDropdownOpen] = useState<boolean>(false);

  // État d'ouverture du panneau latéral d'analyse (replié au démarrage pour dégager la carte)
  const [isPanelOpen, setIsPanelOpen] = useState<boolean>(false);

  // État d'ouverture / réduction de la légende flottante (repliée au démarrage pour dégager la carte)
  const [isLegendOpen, setIsLegendOpen] = useState<boolean>(false);

  // État de chargement et données du niveau actif
  const [loading, setLoading] = useState<boolean>(true);
  const [geoData, setGeoData] = useState<any>(null);
  const [selectedFeature, setSelectedFeature] = useState<any>(null);

  // Données de référence pour calculs stricts et benchmarks
  const [allAiresFeatures, setAllAiresFeatures] = useState<any[]>([]);
  const [regionsFeatures, setRegionsFeatures] = useState<any[]>([]);
  const [districtsFeatures, setDistrictsFeatures] = useState<any[]>([]);
  const [departementsFeatures, setDepartementsFeatures] = useState<any[]>([]);

  // Préchargement des couches auxiliaires (régions, départements, districts, aires)
  useEffect(() => {
    // Régions pour le benchmark de ratio
    fetch(COVERAGE_CONFIG.GEOJSON_FILES.regions)
      .then((r) => r.json())
      .then((d) => setRegionsFeatures(d.features || []))
      .catch((e) => console.error('Erreur chargement regions:', e));

    // Départements pour la recherche libre et le filtrage
    fetch(COVERAGE_CONFIG.GEOJSON_FILES.departements)
      .then((r) => r.json())
      .then((d) => setDepartementsFeatures(d.features || []))
      .catch((e) => console.error('Erreur chargement departements:', e));

    // Districts pour le benchmark de ratio et le filtrage
    fetch(COVERAGE_CONFIG.GEOJSON_FILES.districts_sante)
      .then((r) => r.json())
      .then((d) => setDistrictsFeatures(d.features || []))
      .catch((e) => console.error('Erreur chargement districts:', e));

    // Aires de santé pour les totaux d'effectifs et de population stricts
    fetch(COVERAGE_CONFIG.GEOJSON_FILES.aires_sante)
      .then((r) => r.json())
      .then((d) => setAllAiresFeatures(d.features || []))
      .catch((e) => console.error('Erreur chargement aires:', e));
  }, []);

  // Liste unique des départements disponibles
  const departmentsList = useMemo(() => {
    const map = new Map<string, { name: string; region: string }>();
    departementsFeatures.forEach((f) => {
      const p = f.properties || {};
      const name = p.NAME_2 || p.name;
      const region = p.NAME_1 || p.region || '';
      if (name && !map.has(name)) {
        map.set(name, { name, region });
      }
    });
    districtsFeatures.forEach((f) => {
      const p = f.properties || {};
      const name = p.Nom_Dept || p.dept;
      const region = p.Nom_Region || p.region || '';
      if (name && !map.has(name)) {
        map.set(name, { name, region });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [departementsFeatures, districtsFeatures]);

  // Liste unique des districts disponibles
  const districtsList = useMemo(() => {
    const map = new Map<string, { name: string; region: string; dept: string }>();
    districtsFeatures.forEach((f) => {
      const p = f.properties || {};
      const name = p.District_S || p.name;
      const region = p.Nom_Region || p.region || '';
      const dept = p.Nom_Dept || p.dept || '';
      if (name && !map.has(name)) {
        map.set(name, { name, region, dept });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [districtsFeatures]);

  // Suggestions prédictives pour la recherche libre de Département ou District
  const filteredSubdivSuggestions = useMemo(() => {
    if (!searchSubdivText.trim()) return [];
    const query = normalizeString(searchSubdivText);
    const canSelectedReg = selectedRegion ? normalizeString(selectedRegion) : null;

    const deptMatches = departmentsList
      .filter((d) => {
        if (canSelectedReg && normalizeString(d.region) !== canSelectedReg) return false;
        return normalizeString(d.name).includes(query);
      })
      .map((d) => ({
        type: 'dept' as const,
        name: d.name,
        region: d.region,
      }));

    const distMatches = districtsList
      .filter((d) => {
        if (canSelectedReg && normalizeString(d.region) !== canSelectedReg) return false;
        return normalizeString(d.name).includes(query) || (d.dept && normalizeString(d.dept).includes(query));
      })
      .map((d) => ({
        type: 'district' as const,
        name: d.name,
        region: d.region,
        dept: d.dept,
      }));

    return [...deptMatches, ...distMatches].slice(0, 15);
  }, [searchSubdivText, departmentsList, districtsList, selectedRegion]);

  // États d'exportation
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportProgress, setExportProgress] = useState<number>(0);
  const [exportStatus, setExportStatus] = useState<string>('');
  const [showExportModal, setShowExportModal] = useState<boolean>(false);
  const [exportOrientation, setExportOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [exportType, setExportType] = useState<'single' | 'small-multiples'>('single');

  // Déclencheur d'export depuis la barre d'en-tête horizontale
  useEffect(() => {
    if (exportTrigger && exportTrigger > 0) {
      setExportType('single');
      setShowExportModal(true);
    }
  }, [exportTrigger]);

  // 1. Exportation d'une carte unique (A4 300 DPI)
  const handleExportMap = async (orientation: 'portrait' | 'landscape' = exportOrientation) => {
    if (!geoData) return;
    setIsExporting(true);
    setExportProgress(5);
    setExportStatus('Préparation du document cartographique A4 (300 DPI)...');

    try {
      const blob = await exportSingleMapPng({
        activeMap,
        level,
        selectedRegion,
        selectedSubdivision,
        selectedCategoryField,
        geoData,
        quantileBreaks,
        basemap,
        orientation,
        onProgress: (pct, msg) => {
          setExportProgress(pct);
          setExportStatus(msg);
        },
      });

      const dateStr = new Date().toISOString().split('T')[0];
      const numMap = activeMap.replace('map-', '');
      let indicatorStr = 'indicateur';
      if (activeMap === 'map-1') {
        indicatorStr = sanitizeFilename(activeCategory.shortLabel);
      } else if (activeMap === 'map-2a') {
        indicatorStr = 'couverture_ascp';
      } else if (activeMap === 'map-2b') {
        indicatorStr = 'ratios_toutes_categories';
      } else if (activeMap === 'map-3a') {
        indicatorStr = 'inactifs_a_remplacer';
      } else if (activeMap === 'map-3b') {
        indicatorStr = 'pct_inactifs';
      }

      const levelStr = sanitizeFilename(level);
      let filterStr = 'national';
      if (selectedSubdivision) {
        filterStr = sanitizeFilename(`${selectedSubdivision.type}_${selectedSubdivision.name}`);
      } else if (selectedRegion) {
        filterStr = sanitizeFilename(selectedRegion);
      }
      const filename = `carte_${numMap}_${indicatorStr}_${levelStr}_${filterStr}_${dateStr}.png`;

      triggerBrowserDownload(blob, filename);
      setShowExportModal(false);
    } catch (err: any) {
      console.error('Erreur export carte:', err);
      alert(`Erreur lors de l'export de la carte : ${err?.message || err}`);
    } finally {
      setTimeout(() => {
        setIsExporting(false);
        setExportProgress(0);
        setExportStatus('');
      }, 500);
    }
  };

  // 2. Exportation Small Multiples (Carte 1)
  const handleExportSmallMultiples = async () => {
    if (!geoData) return;
    setIsExporting(true);
    setExportProgress(5);
    setExportStatus('Préparation de la planche comparative Small Multiples (A4 300 DPI)...');

    try {
      const blob = await exportSmallMultiplesPng({
        level,
        selectedRegion,
        selectedSubdivision,
        geoData,
        basemap,
        onProgress: (pct, msg) => {
          setExportProgress(pct);
          setExportStatus(msg);
        },
      });

      const dateStr = new Date().toISOString().split('T')[0];
      const levelStr = sanitizeFilename(level);
      let filterStr = 'national';
      if (selectedSubdivision) {
        filterStr = sanitizeFilename(`${selectedSubdivision.type}_${selectedSubdivision.name}`);
      } else if (selectedRegion) {
        filterStr = sanitizeFilename(selectedRegion);
      }
      const filename = `carte_1_small_multiples_categories_${levelStr}_${filterStr}_${dateStr}.png`;

      triggerBrowserDownload(blob, filename);
    } catch (err: any) {
      console.error('Erreur export small multiples:', err);
      alert(`Erreur lors de l'export small multiples : ${err?.message || err}`);
    } finally {
      setTimeout(() => {
        setIsExporting(false);
        setExportProgress(0);
        setExportStatus('');
      }, 500);
    }
  };

  // 3. Exportation des données CSV
  const handleExportCsv = () => {
    if (!geoData) return;
    try {
      const csvContent = exportCoverageCsv({
        level,
        selectedRegion,
        selectedSubdivision,
        geoData,
      });

      const dateStr = new Date().toISOString().split('T')[0];
      const levelStr = sanitizeFilename(level);
      let filterStr = 'national';
      if (selectedSubdivision) {
        filterStr = sanitizeFilename(`${selectedSubdivision.type}_${selectedSubdivision.name}`);
      } else if (selectedRegion) {
        filterStr = sanitizeFilename(selectedRegion);
      }
      const filename = `donnees_couverture_asc_${levelStr}_${filterStr}_${dateStr}.csv`;

      triggerBrowserDownload(csvContent, filename);
    } catch (err: any) {
      console.error('Erreur export CSV:', err);
      alert(`Erreur lors de l'export CSV : ${err?.message || err}`);
    }
  };

  // Références Leaflet et UI
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const polygonsLayerRef = useRef<L.GeoJSON | null>(null);
  const circlesLayerRef = useRef<L.LayerGroup | null>(null);
  const subdivDropdownRef = useRef<HTMLDivElement>(null);

  // Tour: simulate click on first polygon to show demo popup
  useEffect(() => {
    const handler = () => {
      setTimeout(() => {
        const layers = polygonsLayerRef.current?.getLayers();
        if (layers && layers.length > 0) {
          (layers[0] as L.Path).fire('click');
        }
      }, 400);
    };
    window.addEventListener('tour:show-demo-popup', handler);
    return () => window.removeEventListener('tour:show-demo-popup', handler);
  }, []);

  // Fermeture du menu de recherche lors d'un clic extérieur
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (subdivDropdownRef.current && !subdivDropdownRef.current.contains(event.target as Node)) {
        setIsSubdivDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Catégorie active pour Carte 1
  const activeCategory = useMemo(() => {
    return (
      COVERAGE_CONFIG.ASC_CATEGORIES.find((c) => c.field === selectedCategoryField) ||
      COVERAGE_CONFIG.ASC_CATEGORIES[0]
    );
  }, [selectedCategoryField]);

  // Calcul du max global de EFF_TOT_A sur la couche actuelle pour garantir une échelle commune sur Carte 1
  const globalMaxTotalActifs = useMemo(() => {
    if (!geoData || !geoData.features) return 100;
    let max = 0;
    geoData.features.forEach((f: any) => {
      const val = f.properties?.[COVERAGE_CONFIG.FIELDS.EFF_TOT_A];
      if (typeof val === 'number' && val > max) {
        max = val;
      }
    });
    return max > 0 ? max : 100;
  }, [geoData]);

  // Valeur maximale de la catégorie courante pour informations (Carte 1)
  const currentCategoryMax = useMemo(() => {
    if (!geoData || !geoData.features) return 100;
    let max = 0;
    geoData.features.forEach((f: any) => {
      const val = f.properties?.[selectedCategoryField];
      if (typeof val === 'number' && val > max) {
        max = val;
      }
    });
    return max > 0 ? max : 100;
  }, [geoData, selectedCategoryField]);

  // Échelle racine carrée Carte 1 : calcul du rayon en pixels (rayon max 32px pour le max global)
  const calculateCircleRadius = (val: number): number => {
    if (val <= 0 || isNaN(val)) return 0;
    const maxRadius = 32;
    const minRadius = 3;
    const ratio = Math.sqrt(val / globalMaxTotalActifs);
    return Math.max(minRadius, ratio * maxRadius);
  };

  // Valeur maximale pour les ASC inactifs sur la couche (Carte 3a)
  const globalMaxInactive = useMemo(() => {
    if (!geoData || !geoData.features) return 50;
    let max = 0;
    geoData.features.forEach((f: any) => {
      const val = f.properties?.[COVERAGE_CONFIG.FIELDS.EFF_TOT_I];
      if (typeof val === 'number' && val > max) {
        max = val;
      }
    });
    return max > 0 ? max : 50;
  }, [geoData]);

  // Échelle racine carrée Carte 3a (Inactifs)
  const calculateInactiveCircleRadius = (val: number): number => {
    if (val <= 0 || isNaN(val)) return 0;
    const maxRadius = 32;
    const minRadius = 3;
    const ratio = Math.sqrt(val / globalMaxInactive);
    return Math.max(minRadius, ratio * maxRadius);
  };

  // Calcul des quantiles Carte 2b (RATIO_TOT) sur toutes les zones du niveau actif
  const quantileBreaks = useMemo((): QuantileClass[] => {
    if (!geoData || !geoData.features) return [];
    const vals: number[] = [];
    geoData.features.forEach((f: any) => {
      const v = f.properties?.[COVERAGE_CONFIG.FIELDS.RATIO_TOT];
      if (typeof v === 'number' && !isNaN(v)) {
        vals.push(v);
      }
    });
    return computeQuintileBreaks(vals, language);
  }, [geoData]);

  // 1. Initialisation de la carte Leaflet
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    // Centré sur le Cameroun
    const map = L.map(mapContainerRef.current, {
      center: [7.36, 12.35],
      zoom: 7,
      zoomControl: false,
    });

    L.control.zoom({ position: 'topright' }).addTo(map);

    // Injection des motifs SVG hachurés (gris pour absence de données, clair pour effectif < 5)
    const injectDefsSvg = () => {
      const svg = map.getContainer().querySelector('svg');
      if (svg && !svg.querySelector('#hatch-gray')) {
        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        defs.innerHTML = `
          <pattern id="hatch-gray" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="8" stroke="#94a3b8" stroke-width="2" />
          </pattern>
          <pattern id="hatch-light" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="8" height="8" fill="#f8fafc" />
            <line x1="0" y1="0" x2="0" y2="8" stroke="#cbd5e1" stroke-width="1.5" />
          </pattern>
        `;
        svg.prepend(defs);
      }
    };
    map.on('layeradd', injectDefsSvg);
    injectDefsSvg();

    // Couche de fond de carte
    const getTileUrl = (type: BasemapType) => {
      switch (type) {
        case 'hot':
          return 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png';
        case 'satellite':
          return 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
        case 'osm':
        default:
          return 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
      }
    };

    const tileLayer = L.tileLayer(getTileUrl(basemap), {
      maxZoom: 18,
      attribution: '&copy; OpenStreetMap contributors | DOSTS / MINSANTE',
    }).addTo(map);

    tileLayerRef.current = tileLayer;

    // Groupes de couches
    const circlesGroup = L.layerGroup().addTo(map);
    circlesLayerRef.current = circlesGroup;

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // 2. Mise à jour du fond de carte
  useEffect(() => {
    if (!mapInstanceRef.current || !tileLayerRef.current) return;
    const getTileUrl = (type: BasemapType) => {
      switch (type) {
        case 'hot':
          return 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png';
        case 'satellite':
          return 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
        case 'osm':
        default:
          return 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
      }
    };

    mapInstanceRef.current.removeLayer(tileLayerRef.current);
    const newTile = L.tileLayer(getTileUrl(basemap), {
      maxZoom: 18,
      attribution: '&copy; OpenStreetMap contributors | DOSTS / MINSANTE',
    }).addTo(mapInstanceRef.current);
    tileLayerRef.current = newTile;
  }, [basemap]);

  // 3. Chargement des données GeoJSON selon le niveau actif
  useEffect(() => {
    setLoading(true);
    const fileUrl = COVERAGE_CONFIG.GEOJSON_FILES[level];
    if (!fileUrl) {
      setLoading(false);
      return;
    }

    fetch(fileUrl)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP error ${res.status}`);
        return res.json();
      })
      .then((data) => {
        setGeoData(data);
        setLoading(false);

        // Recentrage avec cadrage optimal (+1 pour compenser le panneau latéral)
        if (mapInstanceRef.current) {
          const tempLayer = L.geoJSON(data);
          const bounds = tempLayer.getBounds();
          if (bounds.isValid()) {
            const fitZoom = mapInstanceRef.current.getBoundsZoom(bounds, false, L.point(20, 20));
            mapInstanceRef.current.setView(bounds.getCenter(), fitZoom);
          }
        }
      })
      .catch((err) => {
        console.error('Erreur chargement GeoJSON Couverture ASC:', err);
        setLoading(false);
      });
  }, [level]);

  // 4. Fonction de création sécurisée et compacte de contenu Pop-up (sans masquer la carte)
  const createSafePopupNode = (props: any, feature?: any): HTMLElement => {
    const container = document.createElement('div');
    container.className = 'p-3 font-sans w-72 max-w-[90vw] space-y-2 text-[#0f172a]';

    // Nom et hiérarchie de la zone (lecture stricte selon la couche)
    const nameStr = getFeatureNameForLevel(level, props);
    const regionStr = props.region || props.Nom_Region || props.NAME_1 || '';
    const districtStr = props.district || props.District_S || '';
    const deptStr = props.dept || props.Nom_Dept || props.NAME_2 || '';

    const titleBox = document.createElement('div');
    titleBox.className = 'border-b border-[#e2e8f0]/80 pb-1.5';

    const h4 = document.createElement('h4');
    h4.className = 'font-bold text-xs text-[#0f172a] leading-snug';
    h4.textContent = nameStr;
    titleBox.appendChild(h4);

    let hierarchyItems: string[] = [];
    if (level === 'aires_sante') {
      hierarchyItems = [regionStr, districtStr].filter(Boolean);
    } else if (level === 'districts_sante') {
      hierarchyItems = [regionStr].filter(Boolean);
    } else if (level === 'departements') {
      hierarchyItems = [regionStr].filter(Boolean);
    }
    if (hierarchyItems.length > 0) {
      const sub = document.createElement('div');
      sub.className = 'text-[10px] font-mono text-[#64748b] mt-0.5';
      sub.textContent = hierarchyItems.join(' • ');
      titleBox.appendChild(sub);
    }
    container.appendChild(titleBox);

    // Extraction population
    const popVal = getPopulationForLevel(level, props);
    const locale = language === 'fr' ? 'fr-FR' : 'en-US';
    const popUnit = language === 'fr' ? 'hab.' : 'pop.';
    const popFormatted = popVal !== null ? `${Math.round(popVal).toLocaleString(locale)} ${popUnit}` : 'N/A';

    // Card des indicateurs contextuels selon la carte active
    const card = document.createElement('div');
    card.className = 'bg-white/80 p-2.5 rounded-xl border border-[#cbd5e1]/70 text-xs font-mono space-y-1.5 shadow-2xs';

    // Ligne Population
    const popRow = document.createElement('div');
    popRow.className = 'flex justify-between items-center text-[10.5px] text-[#64748b]';
    popRow.innerHTML = `<span>👥 ${language === 'fr' ? 'Population :' : 'Population:'}</span><strong class="text-[#0f172a]">${popFormatted}</strong>`;
    card.appendChild(popRow);

    // Indicateurs spécifiques à la carte active (très lisibles, compacts)
    if (activeMap === 'map-1') {
      const catVal = props[selectedCategoryField];
      const totalCount = props[COVERAGE_CONFIG.FIELDS.EFF_TOT_A];
      const catRow = document.createElement('div');
      catRow.className = 'pt-1 border-t border-[#e2e8f0] flex justify-between items-center text-[11px]';
      catRow.innerHTML = `
        <span class="flex items-center gap-1.5 truncate">
          <span style="background-color: ${activeCategory.color}" class="w-2 h-2 rounded-full shrink-0"></span>
          <span class="truncate">${language === 'fr' ? activeCategory.shortLabel : activeCategory.shortLabelEn} :</span>
        </span>
        <strong style="color: ${activeCategory.color}" class="text-xs shrink-0">${typeof catVal === 'number' ? catVal.toLocaleString(locale) : '0'} ${language === 'fr' ? 'ASC' : 'CHW'}</strong>
      `;
      card.appendChild(catRow);

      if (selectedCategoryField !== COVERAGE_CONFIG.FIELDS.EFF_TOT_A && typeof totalCount === 'number') {
        const totRow = document.createElement('div');
        totRow.className = 'flex justify-between items-center text-[10px] text-[#64748b]';
        totRow.innerHTML = `<span>${language === 'fr' ? 'Total toutes catégories :' : 'All-category total:'}</span><strong>${totalCount.toLocaleString(locale)} ${language === 'fr' ? 'ASC' : 'CHW'}</strong>`;
        card.appendChild(totRow);
      }
    } else if (activeMap === 'map-2a') {
      const ascpCount = props[COVERAGE_CONFIG.FIELDS.EFF_ASCP_A];
      const classeRaw = props[COVERAGE_CONFIG.FIELDS.CLASSE_CVG];
      const classeDef = classeRaw ? COVERAGE_CONFIG.NORMATIVE_CLASSES[classeRaw] : null;
      const ratioAscp = props[COVERAGE_CONFIG.FIELDS.RATIO_ASCP];

      const cvgRow = document.createElement('div');
      cvgRow.className = 'pt-1 border-t border-[#e2e8f0] space-y-1';
      cvgRow.innerHTML = `
        <div class="flex justify-between items-center text-[11px]">
          <span>${language === 'fr' ? 'ASC polyvalents (ASCp) :' : 'Multipurpose CHWs (CHWp):'}</span>
          <strong class="text-[#006948]">${typeof ascpCount === 'number' ? ascpCount.toLocaleString(locale) : '0'} ${language === 'fr' ? 'ASCp' : 'CHWp'}</strong>
        </div>
        ${ratioAscp ? `<div class="flex justify-between items-center text-[10px] text-[#64748b]"><span>${language === 'fr' ? 'Ratio :' : 'Ratio:'}</span><strong>${language === 'fr' ? `1 ASCp pour ${Math.round(ratioAscp).toLocaleString(locale)} hab.` : `1 CHWp per ${Math.round(ratioAscp).toLocaleString(locale)} pop.`}</strong></div>` : ''}
        ${classeDef ? `<div class="text-[10px] font-bold px-2 py-0.5 rounded-lg text-center" style="background-color: ${classeDef.color}15; color: ${classeDef.color}; border: 1px solid ${classeDef.color}40">${language === 'fr' ? classeDef.shortLabel : (classeDef as any).shortLabelEn || classeDef.shortLabel}</div>` : ''}
      `;
      card.appendChild(cvgRow);
    } else if (activeMap === 'map-2b') {
      const totalCount = props[COVERAGE_CONFIG.FIELDS.EFF_TOT_A];
      const ratioTot = props[COVERAGE_CONFIG.FIELDS.RATIO_TOT];

      const totRow = document.createElement('div');
      totRow.className = 'pt-1 border-t border-[#e2e8f0] space-y-1';
      totRow.innerHTML = `
        <div class="flex justify-between items-center text-[11px]">
          <span>${language === 'fr' ? 'Total ASC actifs :' : 'Total active CHWs:'}</span>
          <strong class="text-[#8b5cf6]">${typeof totalCount === 'number' ? totalCount.toLocaleString(locale) : '0'} ${language === 'fr' ? 'ASC' : 'CHW'}</strong>
        </div>
        ${ratioTot ? `<div class="flex justify-between items-center text-[10px] text-[#64748b]"><span>${language === 'fr' ? 'Ratio démographique :' : 'Demographic ratio:'}</span><strong class="text-[#0f172a]">${language === 'fr' ? `1 ASC pour ${Math.round(ratioTot).toLocaleString(locale)} hab.` : `1 CHW per ${Math.round(ratioTot).toLocaleString(locale)} pop.`}</strong></div>` : ''}
      `;
      card.appendChild(totRow);
    } else if (activeMap === 'map-3a') {
      const inactCount = props[COVERAGE_CONFIG.FIELDS.EFF_TOT_I];
      const inactPct = props[COVERAGE_CONFIG.FIELDS.PCT_INACT];

      const inactRow = document.createElement('div');
      inactRow.className = 'pt-1 border-t border-[#e2e8f0] space-y-1';
      inactRow.innerHTML = `
        <div class="flex justify-between items-center text-[11px]">
          <span class="text-[#ea580c]">${language === 'fr' ? 'Inactifs à remplacer :' : 'Inactive to replace:'}</span>
          <strong class="text-[#ea580c]">${typeof inactCount === 'number' ? inactCount.toLocaleString(locale) : '0'} ${language === 'fr' ? 'ASC' : 'CHW'}</strong>
        </div>
        ${inactPct !== undefined && inactPct !== null ? `<div class="flex justify-between items-center text-[10px] text-[#64748b]"><span>${language === 'fr' ? "Part d'inactifs :" : 'Inactive share:'}</span><strong>${inactPct} %</strong></div>` : ''}
      `;
      card.appendChild(inactRow);
    } else if (activeMap === 'map-3b') {
      const inactCount = props[COVERAGE_CONFIG.FIELDS.EFF_TOT_I];
      const inactPct = props[COVERAGE_CONFIG.FIELDS.PCT_INACT];

      const pctRow = document.createElement('div');
      pctRow.className = 'pt-1 border-t border-[#e2e8f0] space-y-1';
      pctRow.innerHTML = `
        <div class="flex justify-between items-center text-[11px]">
          <span class="text-[#dc2626]">${language === 'fr' ? "Part d'inactifs :" : 'Inactive share:'}</span>
          <strong class="text-[#dc2626]">${inactPct !== undefined && inactPct !== null ? `${inactPct} %` : 'N/A'}</strong>
        </div>
        ${inactCount !== undefined && inactCount !== null ? `<div class="flex justify-between items-center text-[10px] text-[#64748b]"><span>${language === 'fr' ? 'Volume à remplacer :' : 'Volume to replace:'}</span><strong>${inactCount.toLocaleString(locale)} ${language === 'fr' ? 'ASC' : 'CHW'}</strong></div>` : ''}
      `;
      card.appendChild(pctRow);
    }

    container.appendChild(card);

    // Bouton discret d'ouverture de la fiche complète dans le panneau latéral (à la demande de l'utilisateur)
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'w-full py-1.5 px-2.5 rounded-xl bg-[#006948]/10 hover:bg-[#006948] text-[#006948] hover:text-white font-mono text-[10.5px] font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer border border-[#006948]/20';
    btn.innerHTML = `<span>${language === 'fr' ? 'Fiche & analyse complète' : 'Full profile & analysis'}</span><span>➔</span>`;
    btn.onclick = (e) => {
      e.stopPropagation();
      if (feature) setSelectedFeature(feature);
      setIsPanelOpen(true);
    };
    container.appendChild(btn);

    return container;
  };

  // 5. Rendu cartographique dynamique (Cartes 1, 2a, 2b, 3a, 3b)
  useEffect(() => {
    if (!mapInstanceRef.current || !geoData) return;
    const map = mapInstanceRef.current;

    // Nettoyer les couches précédentes
    if (polygonsLayerRef.current) {
      map.removeLayer(polygonsLayerRef.current);
      polygonsLayerRef.current = null;
    }
    if (circlesLayerRef.current) {
      circlesLayerRef.current.clearLayers();
    }

    // A. Fonction de style des polygones selon la carte active
    const strokeWeight = level === 'aires_sante' ? 0.6 : 1.2;

    const getPolygonStyle = (feature: any): L.PathOptions => {
      const p = feature.properties || {};

      if (activeMap === 'map-2a') {
        // CARTE 2a : Choroplèthe catégorielle CLASSE_CVG
        const classeVal = p[COVERAGE_CONFIG.FIELDS.CLASSE_CVG];
        const classeDef = classeVal ? COVERAGE_CONFIG.NORMATIVE_CLASSES[classeVal] : null;

        if (classeDef) {
          return {
            fillColor: classeDef.color,
            fillOpacity: 0.82,
            weight: strokeWeight,
            color: '#ffffff',
            opacity: 1,
          };
        } else {
          if (classeVal) {
            console.warn(`[Couverture ASC] Valeur CLASSE_CVG inconnue : "${classeVal}" pour l'entité :`, p.name || p.Nom_AS);
          }
          return {
            fillColor: 'url(#hatch-gray)',
            fillOpacity: 0.85,
            weight: strokeWeight,
            color: '#94a3b8',
            opacity: 0.9,
            dashArray: '3, 4',
          };
        }
      } else if (activeMap === 'map-2b') {
        // CARTE 2b : Couverture toutes catégories (RATIO_TOT, 5 classes par quantiles)
        const ratioTot = p[COVERAGE_CONFIG.FIELDS.RATIO_TOT];
        if (ratioTot === undefined || ratioTot === null || isNaN(ratioTot)) {
          return {
            fillColor: 'url(#hatch-gray)',
            fillOpacity: 0.85,
            weight: strokeWeight,
            color: '#94a3b8',
            dashArray: '3, 4',
          };
        }

        // Trouver la classe quantile correspondante
        let matchedColor = COVERAGE_CONFIG.RATIO_TOT_PALETTE[COVERAGE_CONFIG.RATIO_TOT_PALETTE.length - 1];
        for (const cls of quantileBreaks) {
          if (cls.isLast) {
            if (ratioTot >= cls.min) {
              matchedColor = cls.color;
              break;
            }
          } else if (ratioTot <= cls.max) {
            matchedColor = cls.color;
            break;
          }
        }

        return {
          fillColor: matchedColor,
          fillOpacity: 0.85,
          weight: strokeWeight,
          color: '#ffffff',
          opacity: 1,
        };
      } else if (activeMap === 'map-3b') {
        // CARTE 3b : Part d'ASC inactifs (PCT_INACT, seuils fixes)
        const pct = p[COVERAGE_CONFIG.FIELDS.PCT_INACT];
        const totA = p[COVERAGE_CONFIG.FIELDS.EFF_TOT_A];
        const totI = p[COVERAGE_CONFIG.FIELDS.EFF_TOT_I];

        if (pct === null || pct === undefined || isNaN(pct) || totA === null || totA === undefined) {
          return {
            fillColor: 'url(#hatch-gray)',
            fillOpacity: 0.85,
            weight: strokeWeight,
            color: '#94a3b8',
            dashArray: '3, 4',
          };
        }

        const totalAsc = (totA || 0) + (totI || 0);
        // Règle des < 5 ASC : motif hachuré clair
        if (totalAsc < COVERAGE_CONFIG.MIN_TOTAL_ASC_FOR_PCT) {
          return {
            fillColor: 'url(#hatch-light)',
            fillOpacity: 0.85,
            weight: strokeWeight,
            color: '#cbd5e1',
            dashArray: '2, 3',
          };
        }

        let matchedColor = COVERAGE_CONFIG.PCT_INACT_CLASSES[COVERAGE_CONFIG.PCT_INACT_CLASSES.length - 1].color;
        for (const cls of COVERAGE_CONFIG.PCT_INACT_CLASSES) {
          if (pct < cls.max) {
            matchedColor = cls.color;
            break;
          }
        }

        return {
          fillColor: matchedColor,
          fillOpacity: 0.85,
          weight: strokeWeight,
          color: '#ffffff',
          opacity: 1,
        };
      } else {
        // CARTES 1 & 3a : Polygones neutres de fond pour porter les symboles proportionnels
        const checkField = activeMap === 'map-3a' 
          ? COVERAGE_CONFIG.FIELDS.EFF_TOT_I 
          : selectedCategoryField;
        const val = p[checkField];
        const hasData = val !== undefined && val !== null;

        if (!hasData) {
          return {
            fillColor: 'url(#hatch-gray)',
            fillOpacity: 0.85,
            weight: strokeWeight,
            color: '#94a3b8',
            dashArray: '3, 4',
          };
        }

        return {
          fillColor: '#f8fafc',
          fillOpacity: 0.75,
          weight: strokeWeight,
          color: '#cbd5e1',
          opacity: 1,
        };
      }
    };

    // B. Création de la couche des polygones avec filtre territorial (région + département/district)
    const polyLayer = L.geoJSON(geoData, {
      filter: (feature) => {
        return isFeatureInTerritorialFilter(feature, selectedRegion, selectedSubdivision, level);
      },
      style: getPolygonStyle,
      onEachFeature: (feature, layer) => {
        const p = feature.properties || {};

        // Liaison de la pop-up sécurisée, translucide et compacte
        layer.bindPopup(() => createSafePopupNode(p, feature), {
          maxWidth: 300,
          minWidth: 260,
          className: 'coverage-custom-popup',
          autoPanPadding: [40, 40],
        });

        // Événements de survol & sélection
        layer.on({
          mouseover: (e) => {
            const target = e.target;
            target.setStyle({
              weight: 2.5,
              color: '#0f172a',
            });
            target.bringToFront();
          },
          mouseout: (e) => {
            polyLayer.resetStyle(e.target);
          },
          click: () => {
            setSelectedFeature(feature);
            // La pop-up s'affiche sans déployer d'office le panneau latéral
          },
        });

        // C. CARTE 1 : Symboles proportionnels Actifs
        if (activeMap === 'map-1') {
          const val = p[selectedCategoryField];
          if (typeof val === 'number' && val > 0 && circlesLayerRef.current) {
            try {
              const [centerLng, centerLat] = getFeatureCenter(feature);
              const center = L.latLng(centerLat, centerLng);
              const radius = calculateCircleRadius(val);

              const circleMarker = L.circleMarker(center, {
                radius,
                fillColor: activeCategory.color,
                fillOpacity: 0.65,
                weight: 1.5,
                color: '#ffffff',
                opacity: 1,
                pane: 'markerPane',
              });

              const safeName = getFeatureNameForLevel(level, p) + (level === 'aires_sante' && p.District_S ? ` (${p.District_S})` : '');
              circleMarker.bindTooltip(
                `<div class="font-mono text-xs">
                  <strong>${safeName}</strong><br/>
                  <span>${activeCategory.shortLabel} : <strong>${val.toLocaleString('fr-FR')}</strong></span>
                </div>`,
                { sticky: true }
              );

              circleMarker.on('click', () => {
                layer.openPopup();
                setSelectedFeature(feature);
              });

              circlesLayerRef.current.addLayer(circleMarker);
            } catch (err) {
              console.error('Erreur positionnement cercle proportionnel Carte 1:', err);
            }
          }
        }

        // D. CARTE 3a : Symboles proportionnels ASC inactifs
        if (activeMap === 'map-3a') {
          const val = p[COVERAGE_CONFIG.FIELDS.EFF_TOT_I];
          // Une zone avec 0 inactif n'a pas de cercle ; une zone sans données reste en gris hachuré
          if (typeof val === 'number' && val > 0 && circlesLayerRef.current) {
            try {
              const [centerLng, centerLat] = getFeatureCenter(feature);
              const center = L.latLng(centerLat, centerLng);
              const radius = calculateInactiveCircleRadius(val);

              const circleMarker = L.circleMarker(center, {
                radius,
                fillColor: COVERAGE_CONFIG.INACTIVE_CIRCLES_COLOR,
                fillOpacity: 0.7,
                weight: 1.5,
                color: '#ffffff',
                opacity: 1,
                pane: 'markerPane',
              });

              const safeName = getFeatureNameForLevel(level, p) + (level === 'aires_sante' && p.District_S ? ` (${p.District_S})` : '');
              circleMarker.bindTooltip(
                `<div class="font-mono text-xs">
                  <strong>${safeName}</strong><br/>
                  <span>ASC inactifs à remplacer : <strong>${val.toLocaleString('fr-FR')}</strong></span>
                </div>`,
                { sticky: true }
              );

              circleMarker.on('click', () => {
                layer.openPopup();
                setSelectedFeature(feature);
              });

              circlesLayerRef.current.addLayer(circleMarker);
            } catch (err) {
              console.error('Erreur positionnement cercle proportionnel Carte 3a:', err);
            }
          }
        }
      },
    });

    polyLayer.addTo(map);
    polygonsLayerRef.current = polyLayer;
  }, [geoData, activeMap, selectedCategoryField, activeCategory, globalMaxTotalActifs, globalMaxInactive, quantileBreaks, selectedRegion, selectedSubdivision]);

  // Recentrage lors du changement de filtre territorial (région ou département/district)
  useEffect(() => {
    if (!mapInstanceRef.current || !polygonsLayerRef.current) return;
    const map = mapInstanceRef.current;
    if (selectedSubdivision || selectedRegion) {
      const bounds = polygonsLayerRef.current.getBounds();
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: level === 'aires_sante' ? 12 : 10 });
      }
    } else if (geoData) {
      const tempLayer = L.geoJSON(geoData);
      const bounds = tempLayer.getBounds();
      if (bounds.isValid()) {
        const fitZoom = map.getBoundsZoom(bounds, false, L.point(20, 20));
        map.setView(bounds.getCenter(), fitZoom);
      }
    }
  }, [selectedRegion, selectedSubdivision]);

  // Zoom et sélection depuis les listes cliquables du panneau latéral
  const handleSelectFeatureFromList = (feature: any) => {
    setSelectedFeature(feature);
    setIsPanelOpen(true);
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    try {
      const temp = L.geoJSON(feature);
      const bounds = temp.getBounds();
      if (bounds.isValid()) {
        map.fitBounds(bounds, {
          padding: [60, 60],
          maxZoom: level === 'aires_sante' ? 12 : 10,
        });
      }
    } catch (err) {
      console.error('Erreur zoom sur zone:', err);
    }

    if (polygonsLayerRef.current) {
      polygonsLayerRef.current.eachLayer((layer: any) => {
        const p = layer.feature?.properties;
        const targetP = feature.properties;
        const name1 = getFeatureNameForLevel(level, p);
        const name2 = getFeatureNameForLevel(level, targetP);
        const dist1 = p?.District_S || p?.district || '';
        const dist2 = targetP?.District_S || targetP?.district || '';
        const match = level === 'aires_sante' 
          ? (name1 === name2 && dist1 === dist2)
          : (name1 === name2);
        if (match) {
          layer.openPopup();
        }
      });
    }
  };

  // Valeurs de référence pour la légende des 3 cercles de la Carte 1
  const circleRefValues1 = useMemo(() => {
    const max = Math.round(globalMaxTotalActifs);
    const mid = Math.round(max * 0.5);
    const low = Math.max(1, Math.round(max * 0.1));
    return [max, mid, low];
  }, [globalMaxTotalActifs]);

  // Valeurs de référence pour la légende des 3 cercles de la Carte 3a (Inactifs)
  const circleRefValues3a = useMemo(() => {
    const max = Math.round(globalMaxInactive);
    const mid = Math.round(max * 0.5);
    const low = Math.max(1, Math.round(max * 0.1));
    return [max, mid, low];
  }, [globalMaxInactive]);

  return (
    <div className="relative w-full h-[calc(100vh-4rem)] flex flex-col bg-[#f8fafc] overflow-hidden">
      {/* 1. Bandeau Données Factices (Configurable) */}
      {COVERAGE_CONFIG.SHOW_MOCK_BANNER && (
        <div className="bg-amber-500/90 text-amber-950 px-4 py-1 text-center font-mono font-bold text-xs uppercase tracking-wider shadow-xs flex items-center justify-center gap-2 z-20">
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>{COVERAGE_CONFIG.MOCK_BANNER_TEXT}</span>
        </div>
      )}

      {/* 2. Barre Supérieure Épurée : Carte Active & Filtres Territoriaux */}
      <div className="bg-white/95 backdrop-blur-md border-b border-[#cbd5e1]/70 px-4 py-2 flex flex-wrap items-center justify-between gap-3 z-10 shadow-2xs">
        {/* Module Title & Active Thematic Map Badge */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#006948]/10 text-[#006948] font-mono text-[11px] font-bold">
            <Users className="w-3.5 h-3.5" />
            <span>{language === 'fr' ? 'Couverture en ASC' : 'CHW Coverage'}</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#f8fafc] border border-[#cbd5e1] font-mono text-xs shadow-2xs">
            {activeMap === 'map-1' && (
              <>
                <span className="w-2.5 h-2.5 rounded-full bg-[#0284c7] shrink-0 animate-pulse"></span>
                <Users className="w-4 h-4 text-[#006948] shrink-0" />
                <span className="font-bold text-[#0f172a]">{language === 'fr' ? '1. Effectifs Actifs :' : '1. Active CHWs:'}</span>
                <span className="px-2 py-0.5 rounded-lg bg-[#e0f2fe] text-[#0369a1] font-bold text-[11px]">
                  {language === 'fr' ? activeCategory.shortLabel : activeCategory.shortLabelEn}
                </span>
              </>
            )}
            {activeMap === 'map-2a' && (
              <>
                <span className="w-2.5 h-2.5 rounded-full bg-[#16a34a] shrink-0 animate-pulse"></span>
                <ShieldCheck className="w-4 h-4 text-[#16a34a] shrink-0" />
                <span className="font-bold text-[#0f172a]">{language === 'fr' ? '2a. Couverture Normative ASCp' : '2a. Normative CHWp Coverage'}</span>
                <span className="text-[#64748b] text-[10px] hidden sm:inline">{language === 'fr' ? '(1 ASCp pour ≤ 1 000 hab.)' : '(1 CHWp per ≤ 1,000 pop.)'}</span>
              </>
            )}
            {activeMap === 'map-2b' && (
              <>
                <span className="w-2.5 h-2.5 rounded-full bg-[#8b5cf6] shrink-0 animate-pulse"></span>
                <BarChart3 className="w-4 h-4 text-[#8b5cf6] shrink-0" />
                <span className="font-bold text-[#0f172a]">{language === 'fr' ? '2b. Ratios Toutes Catégories' : '2b. All-Category Ratios'}</span>
                <span className="text-[#64748b] text-[10px] hidden sm:inline">{language === 'fr' ? '(1 ASC pour X hab.)' : '(1 CHW per X pop.)'}</span>
              </>
            )}
            {activeMap === 'map-3a' && (
              <>
                <span className="w-2.5 h-2.5 rounded-full bg-[#ea580c] shrink-0 animate-pulse"></span>
                <UserMinus className="w-4 h-4 text-[#ea580c] shrink-0" />
                <span className="font-bold text-[#0f172a]">{language === 'fr' ? '3a. ASC Inactifs à Remplacer' : '3a. Inactive CHWs to Replace'}</span>
                <span className="text-[#ea580c] font-bold text-[11px] hidden sm:inline">{language === 'fr' ? "(Volume d'inactifs)" : '(Inactive volume)'}</span>
              </>
            )}
            {activeMap === 'map-3b' && (
              <>
                <span className="w-2.5 h-2.5 rounded-full bg-[#dc2626] shrink-0 animate-pulse"></span>
                <Percent className="w-4 h-4 text-[#dc2626] shrink-0" />
                <span className="font-bold text-[#0f172a]">{language === 'fr' ? "3b. Part d'ASC Inactifs" : '3b. Inactive CHW Share'}</span>
                <span className="text-[#dc2626] font-bold text-[11px] hidden sm:inline">(%)</span>
              </>
            )}
          </div>
        </div>

        {/* Barre d'outils et de filtres territoriaux */}
        <div data-tour="horizontal-filter-bar" className="flex items-center gap-2 flex-wrap">

          {/* Filtre Régional */}
          <div className="flex items-center gap-1.5 bg-[#f8fafc] px-2.5 py-1 rounded-xl border border-[#cbd5e1]/70">
            <span className="text-[11px] font-mono font-bold text-[#475569] flex items-center gap-1">
              <MapPin className="w-3 h-3 text-[#006948]" />
              <span className="hidden md:inline">{language === 'fr' ? 'Région :' : 'Region:'}</span>
            </span>
            <select
              value={selectedRegion || ''}
              onChange={(e) => {
                const newReg = e.target.value ? e.target.value : null;
                setSelectedRegion(newReg);
                if (selectedSubdivision && newReg && selectedSubdivision.region) {
                  if (normalizeString(selectedSubdivision.region) !== normalizeString(newReg)) {
                    setSelectedSubdivision(null);
                    setSearchSubdivText('');
                  }
                }
              }}
              className="bg-white border border-[#cbd5e1] text-[#0f172a] text-xs font-mono font-semibold rounded-lg px-2 py-1 focus:ring-1 focus:ring-[#006948] focus:outline-none"
            >
              <option value="">{language === 'fr' ? 'Toutes (National)' : 'All (National)'}</option>
              {COVERAGE_CONFIG.REGIONS_LIST.map((reg) => (
                <option key={reg} value={reg}>
                  {reg}
                </option>
              ))}
            </select>
          </div>

          {/* Filtre Libre : Département ou District (Recherche libre demandée par l'utilisateur) */}
          <div data-tour="map-search" ref={subdivDropdownRef} className="relative flex items-center">
            <div className="flex items-center gap-1.5 bg-[#f8fafc] px-2.5 py-1 rounded-xl border border-[#cbd5e1]/70 focus-within:border-[#006948] focus-within:ring-1 focus-within:ring-[#006948] transition-all">
              <Search className="w-3 h-3 text-[#006948] shrink-0" />
              <input
                type="text"
                placeholder={language === 'fr' ? 'Dép. ou District (texte libre)...' : 'Dept. or District (free text)...'}
                value={searchSubdivText}
                onChange={(e) => {
                  const val = e.target.value;
                  setSearchSubdivText(val);
                  setIsSubdivDropdownOpen(true);
                  if (!val.trim() && selectedSubdivision) {
                    setSelectedSubdivision(null);
                  }
                }}
                onFocus={() => {
                  if (searchSubdivText.trim()) {
                    setIsSubdivDropdownOpen(true);
                  }
                }}
                className="bg-transparent border-none text-[#0f172a] text-xs font-mono font-semibold placeholder:text-[#94a3b8] placeholder:font-normal focus:outline-none w-36 sm:w-48 md:w-56"
              />
              {selectedSubdivision && (
                <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-md font-bold uppercase ${
                  selectedSubdivision.type === 'district' ? 'bg-[#e0f2fe] text-[#0284c7]' : 'bg-[#fef3c7] text-[#d97706]'
                }`}>
                  {selectedSubdivision.type === 'district' ? 'Dist' : (language === 'fr' ? 'Dép' : 'Dept')}
                </span>
              )}
              {(searchSubdivText || selectedSubdivision) && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedSubdivision(null);
                    setSearchSubdivText('');
                    setIsSubdivDropdownOpen(false);
                  }}
                  className="text-[#94a3b8] hover:text-[#0f172a] p-0.5 rounded transition-colors cursor-pointer"
                  title={language === 'fr' ? 'Effacer le filtre' : 'Clear filter'}
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Menu déroulant de suggestions prédictives */}
            {isSubdivDropdownOpen && filteredSubdivSuggestions.length > 0 && (
              <div 
                className="absolute left-0 top-full mt-1.5 w-72 bg-white rounded-2xl shadow-xl border border-[#cbd5e1] py-1.5 z-50 max-h-64 overflow-y-auto font-mono text-xs animate-in fade-in zoom-in-95 duration-100"
              >
                <div className="px-3 py-1 text-[10px] font-bold text-[#64748b] uppercase tracking-wider border-b border-[#f1f5f9] flex items-center justify-between">
                  <span>{language === 'fr' ? 'Suggestions correspondantes' : 'Matching suggestions'}</span>
                  <span>{filteredSubdivSuggestions.length}</span>
                </div>
                {filteredSubdivSuggestions.map((item, idx) => (
                  <button
                    key={`${item.type}-${item.name}-${idx}`}
                    type="button"
                    onClick={() => {
                      setSelectedSubdivision(item);
                      setSearchSubdivText(item.name);
                      if (item.region && !selectedRegion) {
                        setSelectedRegion(item.region);
                      }
                      setIsSubdivDropdownOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-[#f0fdf4] transition-colors flex items-center justify-between border-b border-[#f8fafc] last:border-b-0 cursor-pointer"
                  >
                    <div className="flex items-center gap-2 overflow-hidden">
                      {item.type === 'district' ? (
                        <span className="w-5 h-5 rounded-md bg-[#e0f2fe] text-[#0284c7] flex items-center justify-center shrink-0 text-[10px] font-bold">
                          🏥
                        </span>
                      ) : (
                        <span className="w-5 h-5 rounded-md bg-[#fef3c7] text-[#d97706] flex items-center justify-center shrink-0 text-[10px] font-bold">
                          🏢
                        </span>
                      )}
                      <div className="truncate">
                        <div className="font-bold text-[#0f172a] truncate">{item.name}</div>
                        <div className="text-[10px] text-[#64748b] truncate">
                          {item.type === 'district'
                            ? `District • ${language === 'fr' ? 'Dép.' : 'Dept.'} ${item.dept || '-'} • ${item.region}`
                            : `${language === 'fr' ? 'Département' : 'Department'} • ${language === 'fr' ? 'Région' : 'Region'} ${item.region}`}
                        </div>
                      </div>
                    </div>
                    <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded shrink-0 ml-1.5 ${
                      item.type === 'district' ? 'bg-[#e0f2fe] text-[#0284c7]' : 'bg-[#fef3c7] text-[#d97706]'
                    }`}>
                      {item.type === 'district' ? 'District' : (language === 'fr' ? 'Dép.' : 'Dept.')}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3. Conteneur de la Carte Leaflet */}
      <div data-tour="couverture-map" className="relative flex-1 w-full h-full">
        {/* Élément Map */}
        <div ref={mapContainerRef} className="w-full h-full z-0" />

        {/* Indicateur de chargement */}
        {loading && (
          <div className="absolute inset-0 bg-white/70 backdrop-blur-xs flex items-center justify-center z-30">
            <div className="flex items-center gap-3 bg-white px-4 py-2.5 rounded-2xl shadow-xl border border-[#cbd5e1] font-mono text-xs text-[#0f172a]">
              <div className="w-4 h-4 border-2 border-[#006948] border-t-transparent rounded-full animate-spin"></div>
              <span>{language === 'fr' ? `Chargement des données (${level})...` : `Loading data (${level})...`}</span>
            </div>
          </div>
        )}

        {/* 4. Légende Flottante Interactive Adaptative (Déployée ou Réduite/Dockée) */}
        {!isLegendOpen ? (
          <button
            data-tour="legend-btn"
            type="button"
            onClick={() => setIsLegendOpen(true)}
            className="absolute bottom-6 left-4 z-20 bg-white/95 hover:bg-white text-[#0f172a] border border-[#cbd5e1] rounded-2xl px-3.5 py-2.5 shadow-xl font-sans text-xs font-bold flex items-center gap-2.5 transition-all hover:scale-105 backdrop-blur-md group cursor-pointer"
            title={language === 'fr' ? 'Afficher la légende' : 'Show legend'}
          >
            <div className="w-6 h-6 rounded-lg bg-[#006948]/10 text-[#006948] flex items-center justify-center font-bold">
              <Layers className="w-3.5 h-3.5" />
            </div>
            <div className="flex items-center gap-1.5 font-sans font-semibold text-xs text-[#0f172a]">
              <span>{language === 'fr' ? 'Légende' : 'Legend'}</span>
              {activeMap === 'map-1' && (
                <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: activeCategory.color }}></span>
              )}
            </div>
            <ChevronUp className="w-4 h-4 text-[#64748b] group-hover:text-[#006948] transition-colors" />
          </button>
        ) : (
          <div className="absolute bottom-6 left-4 z-20 max-w-xs sm:max-w-sm bg-white/80 backdrop-blur-xl rounded-2xl shadow-2xl border border-[#cbd5e1]/70 p-3 space-y-2 text-xs font-sans animate-in fade-in zoom-in-95 duration-150">
            
            {/* Légende Carte 1 : Symboles Proportionnels Actifs */}
            {activeMap === 'map-1' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between border-b border-[#e2e8f0] pb-1.5 gap-2">
                  <span className="font-bold text-xs text-[#0f172a] flex items-center gap-1.5 truncate">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: activeCategory.color }}></span>
                    <span className="truncate">{activeCategory.shortLabel}</span>
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[10px] font-mono bg-[#f1f5f9] text-[#475569] px-1.5 py-0.5 rounded">
                      Max: {currentCategoryMax.toLocaleString('fr-FR')}
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsLegendOpen(false)}
                      className="p-1 rounded-md hover:bg-[#e2e8f0] text-[#64748b] hover:text-[#0f172a] transition-colors cursor-pointer"
                      title={language === 'fr' ? 'Réduire la légende' : 'Collapse legend'}
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Cercles de référence verticaux */}
                <div className="flex flex-col gap-2 py-2 px-2.5 bg-[#f8fafc] rounded-xl border border-[#e2e8f0]">
                  {circleRefValues1.map((val, idx) => {
                    const r = calculateCircleRadius(val);
                    const maxR = calculateCircleRadius(circleRefValues1[0]);
                    const refLabel = language === 'fr'
                      ? (idx === 0 ? 'Max observé' : idx === 1 ? '50 %' : '10 %')
                      : (idx === 0 ? 'Max observed' : idx === 1 ? '50%' : '10%');
                    const locale = language === 'fr' ? 'fr-FR' : 'en-US';
                    return (
                      <div key={idx} className="flex items-center gap-2.5">
                        <div
                          className="flex items-center justify-center shrink-0"
                          style={{ width: `${Math.max(28, maxR * 2)}px`, height: `${Math.max(20, r * 2)}px` }}
                        >
                          <div
                            className="rounded-full border border-white shadow-xs"
                            style={{
                              width: `${Math.max(4, r * 2)}px`,
                              height: `${Math.max(4, r * 2)}px`,
                              backgroundColor: activeCategory.color,
                              opacity: 0.65,
                            }}
                          />
                        </div>
                        <div className="flex items-baseline gap-1.5 font-mono">
                          <span className="text-xs font-semibold text-[#0f172a]">
                            {val.toLocaleString(locale)}
                          </span>
                          <span className="text-[10px] text-[#64748b]">
                            {language === 'fr' ? `ASC (${refLabel})` : `CHW (${refLabel})`}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="text-[10px] font-mono text-[#64748b] text-center">
                  {language === 'fr' ? 'Surfaces proportionnelles (échelle racine carrée commune)' : 'Proportional symbols (common square-root scale)'}
                </div>
              </div>
            )}

            {/* Légende Carte 2a : Couverture Normative (CLASSE_CVG) */}
            {activeMap === 'map-2a' && (
              <div className="space-y-2">
                <div className="border-b border-[#e2e8f0] pb-1 font-bold text-xs text-[#0f172a] flex items-center justify-between gap-2">
                  <span>{language === 'fr' ? 'Couverture normative en ASCp' : 'Normative CHWp coverage'}</span>
                  <button
                    type="button"
                    onClick={() => setIsLegendOpen(false)}
                    className="p-1 rounded-md hover:bg-[#e2e8f0] text-[#64748b] hover:text-[#0f172a] transition-colors cursor-pointer"
                    title="Réduire la légende"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="space-y-1 font-mono text-[11px]">
                  {Object.values(COVERAGE_CONFIG.NORMATIVE_CLASSES).map((cls) => (
                    <div key={cls.id} className="flex items-center gap-2">
                      <span
                        className="w-3.5 h-3.5 rounded shrink-0 shadow-2xs border border-black/10"
                        style={{ backgroundColor: cls.color }}
                      ></span>
                      <span className="text-[#334155] leading-tight text-[10px]">
                        {language === 'fr' ? cls.label : cls.labelEn}
                      </span>
                    </div>
                  ))}

                  {/* Classe Absence de données */}
                  <div className="flex items-center gap-2 pt-1 border-t border-[#f1f5f9]">
                    <span
                      className="w-3.5 h-3.5 rounded shrink-0 border border-[#94a3b8]"
                      style={{
                        backgroundImage: 'repeating-linear-gradient(45deg, #cbd5e1, #cbd5e1 2px, #f1f5f9 2px, #f1f5f9 6px)',
                      }}
                    ></span>
                    <span className="text-[#64748b] text-[10px]">
                      {language === 'fr' ? COVERAGE_CONFIG.NO_DATA_STYLE.label : COVERAGE_CONFIG.NO_DATA_STYLE.labelEn}
                    </span>
                  </div>
                </div>

                <div className="text-[10px] text-[#475569] bg-[#f8fafc] p-2 rounded-lg border border-[#e2e8f0] leading-snug">
                  <strong>{language === 'fr' ? 'Note :' : 'Note:'}</strong> {language === 'fr' ? COVERAGE_CONFIG.SOURCES.NORMATIVE_NOTE : COVERAGE_CONFIG.SOURCES.NORMATIVE_NOTE_EN}
                </div>
              </div>
            )}

            {/* Légende Carte 2b : Couverture toutes catégories (RATIO_TOT, Quantiles) */}
            {activeMap === 'map-2b' && (
              <div className="space-y-2">
                <div className="border-b border-[#e2e8f0] pb-1 font-bold text-xs text-[#0f172a] flex items-center justify-between gap-2">
                  <span>{language === 'fr' ? 'Ratios toutes catégories (1 ASC pour X hab.)' : 'All-category ratios (1 CHW per X pop.)'}</span>
                  <button
                    type="button"
                    onClick={() => setIsLegendOpen(false)}
                    className="p-1 rounded-md hover:bg-[#e2e8f0] text-[#64748b] hover:text-[#0f172a] transition-colors cursor-pointer"
                    title="Réduire la légende"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="space-y-1 font-mono text-[11px]">
                  {quantileBreaks.map((cls, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span
                        className="w-3.5 h-3.5 rounded shrink-0 shadow-2xs border border-black/10"
                        style={{ backgroundColor: cls.color }}
                      ></span>
                      <span className="text-[#334155] leading-tight text-[10px]">
                        {cls.label}
                      </span>
                    </div>
                  ))}

                  {/* Absence de données */}
                  <div className="flex items-center gap-2 pt-1 border-t border-[#f1f5f9]">
                    <span
                      className="w-3.5 h-3.5 rounded shrink-0 border border-[#94a3b8]"
                      style={{
                        backgroundImage: 'repeating-linear-gradient(45deg, #cbd5e1, #cbd5e1 2px, #f1f5f9 2px, #f1f5f9 6px)',
                      }}
                    ></span>
                    <span className="text-[#64748b] text-[10px]">
                      {language === 'fr' ? COVERAGE_CONFIG.NO_DATA_STYLE.label : COVERAGE_CONFIG.NO_DATA_STYLE.labelEn}
                    </span>
                  </div>
                </div>

                <div className="text-[10px] text-[#475569] bg-[#f8fafc] p-2 rounded-lg border border-[#e2e8f0] leading-snug">
                  {language === 'fr' ? COVERAGE_CONFIG.SOURCES.RATIO_TOT_NOTE : COVERAGE_CONFIG.SOURCES.RATIO_TOT_NOTE_EN}
                </div>
              </div>
            )}

            {/* Légende Carte 3a : Inactifs à remplacer (Symboles proportionnels) */}
            {activeMap === 'map-3a' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between border-b border-[#e2e8f0] pb-1.5 gap-2">
                  <span className="font-bold text-xs text-[#0f172a] flex items-center gap-1.5 truncate">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COVERAGE_CONFIG.INACTIVE_CIRCLES_COLOR }}></span>
                    <span className="truncate">{language === 'fr' ? COVERAGE_CONFIG.SOURCES.INACTIVE_TITLE : COVERAGE_CONFIG.SOURCES.INACTIVE_TITLE_EN}</span>
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[10px] font-mono bg-[#f1f5f9] text-[#475569] px-1.5 py-0.5 rounded">
                      Max: {globalMaxInactive.toLocaleString('fr-FR')}
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsLegendOpen(false)}
                      className="p-1 rounded-md hover:bg-[#e2e8f0] text-[#64748b] hover:text-[#0f172a] transition-colors cursor-pointer"
                      title={language === 'fr' ? 'Réduire la légende' : 'Collapse legend'}
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Cercles de référence verticaux */}
                <div className="flex flex-col gap-2 py-2 px-2.5 bg-[#fff7ed] rounded-xl border border-[#ffedd5]">
                  {circleRefValues3a.map((val, idx) => {
                    const r = calculateInactiveCircleRadius(val);
                    const maxR = calculateInactiveCircleRadius(circleRefValues3a[0]);
                    const refLabel = language === 'fr'
                      ? (idx === 0 ? 'Max observé' : idx === 1 ? '50 %' : '10 %')
                      : (idx === 0 ? 'Max observed' : idx === 1 ? '50%' : '10%');
                    const locale3a = language === 'fr' ? 'fr-FR' : 'en-US';
                    return (
                      <div key={idx} className="flex items-center gap-2.5">
                        <div
                          className="flex items-center justify-center shrink-0"
                          style={{ width: `${Math.max(28, maxR * 2)}px`, height: `${Math.max(20, r * 2)}px` }}
                        >
                          <div
                            className="rounded-full border border-white shadow-xs"
                            style={{
                              width: `${Math.max(4, r * 2)}px`,
                              height: `${Math.max(4, r * 2)}px`,
                              backgroundColor: COVERAGE_CONFIG.INACTIVE_CIRCLES_COLOR,
                              opacity: 0.7,
                            }}
                          />
                        </div>
                        <div className="flex items-baseline gap-1.5 font-mono">
                          <span className="text-xs font-semibold text-[#9a3412]">
                            {val.toLocaleString(locale3a)}
                          </span>
                          <span className="text-[10px] text-[#c2410c]">
                            {language === 'fr' ? `inactifs (${refLabel})` : `inactive (${refLabel})`}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="text-[10px] font-mono text-[#64748b] text-center">
                  {language === 'fr' ? 'Une zone avec 0 inactif n\'a pas de cercle' : 'A zone with 0 inactive has no circle'}
                </div>
              </div>
            )}

            {/* Légende Carte 3b : Part d'ASC inactifs (Seuils fixes) */}
            {activeMap === 'map-3b' && (
              <div className="space-y-2">
                <div className="border-b border-[#e2e8f0] pb-1 font-bold text-xs text-[#0f172a] flex items-center justify-between gap-2">
                  <span>{language === 'fr' ? "Part d'ASC inactifs (%)" : 'Inactive CHW share (%)'}</span>
                  <button
                    type="button"
                    onClick={() => setIsLegendOpen(false)}
                    className="p-1 rounded-md hover:bg-[#e2e8f0] text-[#64748b] hover:text-[#0f172a] transition-colors cursor-pointer"
                    title="Réduire la légende"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="space-y-1 font-mono text-[11px]">
                  {COVERAGE_CONFIG.PCT_INACT_CLASSES.map((cls) => (
                    <div key={cls.id} className="flex items-center gap-2">
                      <span
                        className="w-3.5 h-3.5 rounded shrink-0 shadow-2xs border border-black/10"
                        style={{ backgroundColor: cls.color }}
                      ></span>
                      <span className="text-[#334155] leading-tight text-[10px]">
                        {language === 'fr' ? cls.label : cls.labelEn}
                      </span>
                    </div>
                  ))}

                  {/* Effectif trop faible (< 5 ASC) */}
                  <div className="flex items-center gap-2 pt-1 border-t border-[#f1f5f9]">
                    <span
                      className="w-3.5 h-3.5 rounded shrink-0 border border-[#cbd5e1]"
                      style={{
                        backgroundImage: 'repeating-linear-gradient(45deg, #cbd5e1, #cbd5e1 1.5px, #f8fafc 1.5px, #f8fafc 6px)',
                      }}
                    ></span>
                    <span className="text-[#64748b] text-[10px] leading-tight">
                      {language === 'fr' ? COVERAGE_CONFIG.LOW_ASC_STYLE.label : COVERAGE_CONFIG.LOW_ASC_STYLE.labelEn}
                    </span>
                  </div>

                  {/* Absence de données */}
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3.5 h-3.5 rounded shrink-0 border border-[#94a3b8]"
                      style={{
                        backgroundImage: 'repeating-linear-gradient(45deg, #cbd5e1, #cbd5e1 2px, #f1f5f9 2px, #f1f5f9 6px)',
                      }}
                    ></span>
                    <span className="text-[#64748b] text-[10px]">
                      {language === 'fr' ? COVERAGE_CONFIG.NO_DATA_STYLE.label : COVERAGE_CONFIG.NO_DATA_STYLE.labelEn}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Source cartographique obligatoire sur chaque carte */}
            <div className="text-[9px] text-[#94a3b8] font-mono border-t border-[#e2e8f0] pt-1 leading-tight">
              {language === 'fr' ? 'Source :' : 'Source:'} {language === 'fr' ? COVERAGE_CONFIG.SOURCES.MAP_SOURCE : COVERAGE_CONFIG.SOURCES.MAP_SOURCE_EN}
            </div>
          </div>
        )}

        {/* Sélecteur Flottant de Fond de Carte (en bas à droite, repositionné dynamiquement si le panneau est ouvert) */}
        <FloatingBasemapSwitcher
          basemap={basemap}
          onBasemapChange={onBasemapChange}
          language={language}
          className={isPanelOpen ? 'bottom-5 right-92 sm:right-100' : 'bottom-5 right-4'}
        />

        {/* 5. Panneau Latéral d'Analyse (Mode 1 : Résumé / Mode 2 : Fiche) */}
        <CouvertureAscSidePanel
          isOpen={isPanelOpen}
          onToggleOpen={() => setIsPanelOpen(!isPanelOpen)}
          level={level}
          selectedRegion={selectedRegion}
          onSelectRegion={(reg) => {
            setSelectedRegion(reg);
            if (selectedSubdivision && reg && selectedSubdivision.region) {
              if (normalizeString(selectedSubdivision.region) !== normalizeString(reg)) {
                setSelectedSubdivision(null);
                setSearchSubdivText('');
              }
            }
          }}
          selectedSubdivision={selectedSubdivision}
          onSelectSubdivision={(subdiv) => {
            setSelectedSubdivision(subdiv);
            if (subdiv) {
              setSearchSubdivText(subdiv.name);
              if (subdiv.region && !selectedRegion) {
                setSelectedRegion(subdiv.region);
              }
            } else {
              setSearchSubdivText('');
            }
          }}
          departmentsList={departmentsList}
          districtsList={districtsList}
          selectedFeature={selectedFeature}
          onClearSelectedFeature={() => setSelectedFeature(null)}
          onSelectFeatureFromList={handleSelectFeatureFromList}
          currentLevelFeatures={geoData?.features || []}
          allAiresFeatures={allAiresFeatures}
          regionsFeatures={regionsFeatures}
          districtsFeatures={districtsFeatures}
          language={language}
        />

        {/* 6. Fenêtre Modale de Configuration d'Exportation */}
        {showExportModal && !isExporting && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl border border-[#cbd5e1] max-w-md w-full p-5 space-y-4 font-sans animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-2 border-b border-[#e2e8f0]">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-[#006948]/10 text-[#006948] flex items-center justify-center font-bold">
                    <Download className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-[#0f172a]">
                      {language === 'fr' ? 'Exporter la carte actuelle' : 'Export current map'}
                    </h3>
                    <span className="text-[10px] font-mono text-[#64748b]">
                      {language === 'fr' ? 'Format haute résolution pour rapport officiel (300 DPI)' : 'High-resolution format for official report (300 DPI)'}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowExportModal(false)}
                  className="p-1 rounded-lg hover:bg-[#f1f5f9] text-[#64748b] transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Détails du document à exporter */}
              <div className="bg-[#f8fafc] p-3 rounded-2xl border border-[#e2e8f0] space-y-2 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-[#64748b]">{language === 'fr' ? 'Carte active :' : 'Active map:'}</span>
                  <strong className="text-[#0f172a]">
                    {activeMap === 'map-1' && `${language === 'fr' ? '1. Effectifs' : '1. CHW Count'} (${language === 'fr' ? activeCategory.shortLabel : activeCategory.shortLabelEn})`}
                    {activeMap === 'map-2a' && (language === 'fr' ? '2a. Couverture normative ASCp' : '2a. Normative CHWp coverage')}
                    {activeMap === 'map-2b' && (language === 'fr' ? '2b. Ratios toutes catégories' : '2b. All-category ratios')}
                    {activeMap === 'map-3a' && (language === 'fr' ? '3a. ASC inactifs à remplacer' : '3a. Inactive CHWs to replace')}
                    {activeMap === 'map-3b' && (language === 'fr' ? "3b. Part d'inactifs (%)" : '3b. Inactive share (%)')}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#64748b]">{language === 'fr' ? 'Découpage :' : 'Subdivision:'}</span>
                  <strong className="text-[#006948]">{level}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#64748b]">{language === 'fr' ? 'Territoire :' : 'Territory:'}</span>
                  <strong className="text-[#0f172a]">
                    {selectedSubdivision
                      ? `${selectedSubdivision.type === 'district' ? (language === 'fr' ? 'District' : 'District') : (language === 'fr' ? 'Dép.' : 'Dept.')} : ${selectedSubdivision.name}`
                      : (selectedRegion ? `${language === 'fr' ? 'Région' : 'Region'} : ${selectedRegion}` : (language === 'fr' ? 'National (Cameroun)' : 'National (Cameroon)'))}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#64748b]">{language === 'fr' ? 'Résolution :' : 'Resolution:'}</span>
                  <strong className="text-[#0284c7]">A4 — 300 DPI ({exportType === 'small-multiples' || exportOrientation === 'portrait' ? '2480 x 3508 px' : '3508 x 2480 px'})</strong>
                </div>
              </div>

              {/* Choix du mode d'export (Actif sur Carte 1) */}
              {activeMap === 'map-1' && (
                <div className="space-y-1.5">
                  <label className="text-[11px] font-mono font-bold text-[#475569]">
                    {language === 'fr' ? 'Type de document à exporter :' : 'Document type to export:'}
                  </label>
                  <div className="grid grid-cols-2 gap-2 font-mono text-xs">
                    <button
                      type="button"
                      onClick={() => setExportType('single')}
                      className={`py-2 px-3 rounded-xl border flex flex-col items-center gap-1 transition-all cursor-pointer ${
                        exportType === 'single'
                          ? 'border-[#006948] bg-[#f0fdf4] text-[#006948] font-bold shadow-xs'
                          : 'border-[#cbd5e1] bg-white text-[#475569] hover:bg-[#f8fafc]'
                      }`}
                    >
                      <span>{language === 'fr' ? 'Carte actuelle' : 'Current map'}</span>
                      <span className="text-[10px] text-[#64748b] font-normal">{language === 'fr' ? activeCategory.shortLabel : activeCategory.shortLabelEn}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setExportType('small-multiples')}
                      className={`py-2 px-3 rounded-xl border flex flex-col items-center gap-1 transition-all cursor-pointer ${
                        exportType === 'small-multiples'
                          ? 'border-[#006948] bg-[#f0fdf4] text-[#006948] font-bold shadow-xs'
                          : 'border-[#cbd5e1] bg-white text-[#475569] hover:bg-[#f8fafc]'
                      }`}
                    >
                      <span>Small Multiples</span>
                      <span className="text-[10px] text-[#64748b] font-normal">{language === 'fr' ? 'Planche 2x3 (6 catégories)' : '2×3 sheet (6 categories)'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Choix d'orientation (Pour carte unique) */}
              {exportType === 'single' && (
                <div className="space-y-1.5">
                  <label className="text-[11px] font-mono font-bold text-[#475569]">
                    {language === 'fr' ? 'Orientation de la page :' : 'Page orientation:'}
                  </label>
                  <div className="grid grid-cols-2 gap-2 font-mono text-xs">
                    <button
                      type="button"
                      onClick={() => setExportOrientation('portrait')}
                      className={`py-2 px-3 rounded-xl border flex flex-col items-center gap-1 transition-all cursor-pointer ${
                        exportOrientation === 'portrait'
                          ? 'border-[#006948] bg-[#f0fdf4] text-[#006948] font-bold shadow-xs'
                          : 'border-[#cbd5e1] bg-white text-[#475569] hover:bg-[#f8fafc]'
                      }`}
                    >
                      <span>{language === 'fr' ? 'Portrait (Recommandé)' : 'Portrait (Recommended)'}</span>
                      <span className="text-[10px] text-[#64748b] font-normal">{language === 'fr' ? 'Idéal pour le Cameroun' : 'Ideal for Cameroon'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setExportOrientation('landscape')}
                      className={`py-2 px-3 rounded-xl border flex flex-col items-center gap-1 transition-all cursor-pointer ${
                        exportOrientation === 'landscape'
                          ? 'border-[#006948] bg-[#f0fdf4] text-[#006948] font-bold shadow-xs'
                          : 'border-[#cbd5e1] bg-white text-[#475569] hover:bg-[#f8fafc]'
                      }`}
                    >
                      <span>{language === 'fr' ? 'Paysage' : 'Landscape'}</span>
                      <span className="text-[10px] text-[#64748b] font-normal">{language === 'fr' ? 'Orientation horizontale' : 'Horizontal orientation'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Bouton de confirmation */}
              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (exportType === 'small-multiples') {
                      setShowExportModal(false);
                      handleExportSmallMultiples();
                    } else {
                      handleExportMap(exportOrientation);
                    }
                  }}
                  className="flex-1 py-2.5 px-4 bg-[#006948] hover:bg-[#005238] text-white font-mono font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>
                    {exportType === 'small-multiples'
                      ? (language === 'fr' ? 'Générer la planche Small Multiples A4' : 'Generate Small Multiples A4 sheet')
                      : (language === 'fr' ? 'Générer et télécharger le PNG A4' : 'Generate and download A4 PNG')}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowExportModal(false)}
                  className="py-2.5 px-3 bg-[#f1f5f9] hover:bg-[#e2e8f0] text-[#475569] font-mono font-semibold text-xs rounded-xl transition-all cursor-pointer"
                >
                  {language === 'fr' ? 'Annuler' : 'Cancel'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 7. Indicateur de Progression d'Exportation (Non bloquant) */}
        {isExporting && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl border border-[#cbd5e1] max-w-sm w-full p-5 space-y-3 font-sans text-center animate-in fade-in zoom-in-95 duration-150">
              <div className="w-10 h-10 mx-auto rounded-2xl bg-[#006948]/10 text-[#006948] flex items-center justify-center">
                <Sparkles className="w-5 h-5 animate-pulse" />
              </div>
              <h3 className="font-bold text-sm text-[#0f172a]">
                {language === 'fr' ? "Génération de l'export cartographique" : 'Generating map export'}
              </h3>
              <p className="text-xs font-mono text-[#64748b]">
                {exportStatus || (language === 'fr' ? 'Traitement en cours...' : 'Processing...')}
              </p>

              {/* Barre de progression */}
              <div className="w-full h-2.5 bg-[#f1f5f9] rounded-full overflow-hidden border border-[#e2e8f0]">
                <div
                  className="h-full bg-[#006948] rounded-full transition-all duration-300"
                  style={{ width: `${exportProgress}%` }}
                />
              </div>

              <div className="text-[10px] font-mono text-[#94a3b8]">
                {exportProgress}% • {language === 'fr' ? 'Rendu 300 DPI haute résolution' : '300 DPI high-resolution rendering'}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
