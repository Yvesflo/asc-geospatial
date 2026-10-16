import React, { useState, useEffect, useRef, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { 
  Layers, 
  Search, 
  Download, 
  Activity, 
  ArrowRight, 
  MapPin, 
  Building2, 
  Users, 
  CheckCircle2, 
  AlertTriangle, 
  RotateCcw, 
  Sparkles, 
  FileSpreadsheet,
  ChevronUp,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
  Building,
  Target,
  Sliders,
  Eye,
  EyeOff,
  X
} from 'lucide-react';
import { Language, SubdivisionLevel, BasemapType } from '../types';
import { 
  COVERAGE_CONFIG, 
  getFeatureNameForLevel,
  normalizeString,
  isFeatureInTerritorialFilter,
  TerritorialFilter,
  getCanonicalRegionName
} from '../config/coverageConfig';
import { FloatingBasemapSwitcher } from './FloatingBasemapSwitcher';
import { CiblageAscSidePanel } from './Livrable3SidePanel';
import { exportCiblageAscMapPng, triggerBrowserDownload, sanitizeFilename } from '../utils/coverageExportUtils';

interface CiblageAscMapProps {
  language: Language;
  level?: SubdivisionLevel;
  onLevelChange?: (level: SubdivisionLevel) => void;
  basemap?: BasemapType;
  onBasemapChange?: (bm: BasemapType) => void;
  thematicOpacity?: number;
  onThematicOpacityChange?: (val: number) => void;
  isThematicVisible?: boolean;
  onIsThematicVisibleChange?: (val: boolean) => void;
  rasterOpacity?: number;
  onRasterOpacityChange?: (val: number) => void;
  isRasterVisible?: boolean;
  onIsRasterVisibleChange?: (val: boolean) => void;
  exportTrigger?: number;
}

interface NationalData {
  COUNTRY: string;
  popTotal: number;
  popTravelTime_60: number;
  popCoveredPercent_60: number;
}

interface HierarchyItem {
  levelLabel: string;
  name: string;
  popTotal: number;
  popCoveredPercent: number;
}

// Normalizer helper for robust multi-level fuzzy string matching across tables
function normalizeName(str: string | undefined | null): string {
  if (!str) return '';
  return str
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

export const CiblageAscMap: React.FC<CiblageAscMapProps> = ({
  language,
  level: externalLevel = 'regions',
  onLevelChange,
  basemap: externalBasemap = 'hot',
  onBasemapChange,
  thematicOpacity = 0.85,
  onThematicOpacityChange,
  isThematicVisible = true,
  onIsThematicVisibleChange,
  rasterOpacity = 0.85,
  onRasterOpacityChange,
  isRasterVisible = true,
  onIsRasterVisibleChange,
  exportTrigger,
}) => {
  // State controlled by props
  const level = externalLevel;
  const setLevel = (newLevel: SubdivisionLevel) => {
    if (onLevelChange) onLevelChange(newLevel);
  };

  const basemap = externalBasemap;
  const setBasemap = (newBasemap: BasemapType) => {
    if (onBasemapChange) onBasemapChange(newBasemap);
  };

  const setIsThematicVisible = (visible: boolean) => {
    if (onIsThematicVisibleChange) onIsThematicVisibleChange(visible);
  };

  const setThematicOpacity = (val: number) => {
    if (onThematicOpacityChange) onThematicOpacityChange(val);
  };

  const setIsRasterVisible = (visible: boolean) => {
    if (onIsRasterVisibleChange) onIsRasterVisibleChange(visible);
  };

  const setRasterOpacity = (val: number) => {
    if (onRasterOpacityChange) onRasterOpacityChange(val);
  };

  const [nationalData, setNationalData] = useState<NationalData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedFeature, setSelectedFeature] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [allFeatures, setAllFeatures] = useState<any[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isLegendOpen, setIsLegendOpen] = useState<boolean>(false);
  const [isPanelOpen, setIsPanelOpen] = useState<boolean>(false);

  // Filtres territoriaux (Région, Département ou District de Santé)
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [selectedSubdivision, setSelectedSubdivision] = useState<TerritorialFilter | null>(null);
  const [searchSubdivText, setSearchSubdivText] = useState<string>('');
  const [isSubdivDropdownOpen, setIsSubdivDropdownOpen] = useState<boolean>(false);
  const subdivDropdownRef = useRef<HTMLDivElement>(null);

  // Couches de référence pour la recherche libre et le découpage
  const [departementsFeatures, setDepartementsFeatures] = useState<any[]>([]);
  const [districtsFeatures, setDistrictsFeatures] = useState<any[]>([]);

  // Données GeoJSON brutes du niveau actif
  const [geoData, setGeoData] = useState<any>(null);

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

  // Lookup dictionaries for upper tiers
  const [regionsLookup, setRegionsLookup] = useState<Map<string, any>>(new Map());
  const [deptsLookup, setDeptsLookup] = useState<Map<string, any>>(new Map());
  const [arrsLookup, setArrsLookup] = useState<Map<string, any>>(new Map());
  const [distsLookup, setDistsLookup] = useState<Map<string, any>>(new Map());

  // Leaflet map refs
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const geojsonLayerRef = useRef<L.GeoJSON | null>(null);
  const rasterLayerRef = useRef<L.ImageOverlay | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const featureLayersRef = useRef<Map<string, L.Layer>>(new Map());
  const selectedHighlightLayerRef = useRef<L.Layer | null>(null);

  // Ref tracking isThematicVisible so mouseover closure always reads the live value
  const isThematicVisibleRef = useRef<boolean>(isThematicVisible);
  const thematicOpacityRef = useRef<number>(thematicOpacity);
  isThematicVisibleRef.current = isThematicVisible;
  thematicOpacityRef.current = thematicOpacity;

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Export states
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportProgress, setExportProgress] = useState<number>(0);
  const [exportStatus, setExportStatus] = useState<string>('');
  const [showExportModal, setShowExportModal] = useState<boolean>(false);
  const [exportOrientation, setExportOrientation] = useState<'portrait' | 'landscape'>('portrait');

  useEffect(() => {
    if (exportTrigger && exportTrigger > 0) {
      setShowExportModal(true);
    }
  }, [exportTrigger]);

  const handleExportMap = async (orientation: 'portrait' | 'landscape' = exportOrientation) => {
    if (!geoData) return;
    setIsExporting(true);
    setExportProgress(5);
    setExportStatus(language === 'fr' ? 'Initialisation...' : 'Initializing...');
    try {
      const blob = await exportCiblageAscMapPng({
        level,
        selectedRegion,
        selectedSubdivision,
        geoData,
        basemap,
        orientation,
        language,
        onProgress: (pct, msg) => {
          setExportProgress(pct);
          setExportStatus(msg);
        },
      });
      const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
      const levelStr = level.replace('_', '-');
      const filterStr = selectedRegion ? sanitizeFilename(selectedRegion) : 'national';
      const orientStr = orientation === 'landscape' ? '_paysage' : '_portrait';
      triggerBrowserDownload(blob, `besoin_reel_asc_5km_${levelStr}_${filterStr}${orientStr}_${dateStr}.png`);
      triggerToast(language === 'fr' ? 'Export PNG généré avec succès !' : 'PNG export successful!');
    } catch (err) {
      console.error('Export error:', err);
      triggerToast(language === 'fr' ? 'Erreur lors de l\'export.' : 'Export failed.');
    } finally {
      setIsExporting(false);
      setExportProgress(0);
      setExportStatus('');
    }
  };

  // Color ramp based on popCoveredPercent (< 5 km of any FOSA)
  const getColor = (pct: number) => {
    if (pct >= 90) return '#006948'; // Deep emerald: excellent coverage
    if (pct >= 80) return '#22c55e'; // Green: meets national target (>= 80%)
    if (pct >= 65) return '#eab308'; // Amber: moderate gap
    if (pct >= 50) return '#f97316'; // Orange: high deficit
    return '#dc2626';                // Red: critical deficit (< 50%)
  };

  // Style for polygon feature (rendered on dedicated geojsonPane above basemap and raster)
  const styleFeature = (feature: any) => {
    const pct = feature.properties.popCoveredPercent || 0;
    const visible = isThematicVisibleRef.current;
    return {
      pane: 'geojsonPane',
      fillColor: getColor(pct),
      weight: level === 'aires_sante' ? 1.2 : 2,
      opacity: visible ? 1 : 0,
      color: '#ffffff',
      dashArray: '',
      fillOpacity: visible ? thematicOpacityRef.current : 0, // Dynamic opacity controlled by slider
    };
  };

  // Load national data & all upper-tier lookup tables once
  useEffect(() => {
    fetch('/data/nation_5km.json')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setNationalData(data[0]);
        }
      })
      .catch((err) => console.error('Error loading national data:', err));

    // Regions lookup
    fetch('/data/Access5km_region.json')
      .then((res) => res.json())
      .then((data) => {
        const map = new Map<string, any>();
        data.forEach((r: any) => {
          map.set(normalizeName(r.NAME_1), {
            name: r.NAME_1,
            popTotal: r.popTotal,
            popCoveredPercent: r.popCoveredPercent_60 ?? r.popCoveredPercent ?? 0,
          });
        });
        setRegionsLookup(map);
      })
      .catch((err) => console.error('Error loading Access5km_region.json:', err));

    // Departements lookup
    fetch('/data/Access5km_departement.json')
      .then((res) => res.json())
      .then((data) => {
        const map = new Map<string, any>();
        data.forEach((d: any) => {
          map.set(normalizeName(d.NAME_2), {
            name: d.NAME_2,
            popTotal: d.popTotal,
            popCoveredPercent: d.popCoveredPercent_60 ?? d.popCoveredPercent ?? 0,
          });
        });
        setDeptsLookup(map);
      })
      .catch((err) => console.error('Error loading Access5km_departement.json:', err));

    // Arrondissements lookup
    fetch('/data/Access5km_arrondissement.json')
      .then((res) => res.json())
      .then((data) => {
        const map = new Map<string, any>();
        data.forEach((a: any) => {
          map.set(normalizeName(a.NAME_3), {
            name: a.NAME_3,
            popTotal: a.popTotal,
            popCoveredPercent: a.popCoveredPercent_60 ?? a.popCoveredPercent ?? 0,
          });
        });
        setArrsLookup(map);
      })
      .catch((err) => console.error('Error loading Access5km_arrondissement.json:', err));

    // Districts de santé lookup
    fetch('/data/Access5km_districts_sante.json')
      .then((res) => res.json())
      .then((data) => {
        const map = new Map<string, any>();
        data.forEach((d: any) => {
          map.set(normalizeName(d.District_S), {
            name: d.District_S,
            popTotal: d.popTotal,
            popCoveredPercent: d.popCoveredPercent_60 ?? d.popCoveredPercent ?? 0,
          });
        });
        setDistsLookup(map);
      })
      .catch((err) => console.error('Error loading Access5km_districts_sante.json:', err));

    // Départements pour la recherche libre et le filtrage
    fetch('/data/departements_5km.geojson')
      .then((r) => r.json())
      .then((d) => setDepartementsFeatures(d.features || []))
      .catch((e) => console.error('Erreur chargement departements:', e));

    // Districts pour la recherche libre et le filtrage
    fetch('/data/districts_sante_5km.geojson')
      .then((r) => r.json())
      .then((d) => setDistrictsFeatures(d.features || []))
      .catch((e) => console.error('Erreur chargement districts:', e));
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

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      // Centered on Cameroon [7.3697° N, 12.3547° E]
      const map = L.map(mapContainerRef.current, {
        center: [7.36, 12.35],
        zoom: 7,
        zoomControl: false,
      });

      // Dedicated custom pane for Population Raster overlay (z-index 420: above basemap at 200, below vector boundaries at 450)
      const rasterPane = map.createPane('rasterPane');
      rasterPane.style.zIndex = '420';

      // Dedicated custom pane for GeoJSON divisions to guarantee they render in front of basemap and raster (z-index 450)
      const geojsonPane = map.createPane('geojsonPane');
      geojsonPane.style.zIndex = '450';

      // Dedicated high-priority pane for the selected/highlighted division (z-index 500)
      const highlightPane = map.createPane('highlightPane');
      highlightPane.style.zIndex = '500';

      // Instantiate Uncovered Population Raster ImageOverlay ([ [south, west], [north, east] ])
      const rasterBounds: L.LatLngBoundsExpression = [
        [1.64752, 8.42112],
        [13.12005, 16.3138]
      ];
      const rasterLayer = L.imageOverlay('/data/pop_uncovered_raster.png', rasterBounds, {
        pane: 'rasterPane',
        opacity: isRasterVisible ? rasterOpacity : 0,
        interactive: false,
        crossOrigin: true,
      });

      rasterLayer.on('load', () => {
        const el = rasterLayer.getElement();
        if (el) {
          el.style.filter = 'saturate(260%) contrast(190%) brightness(0.92)';
        }
        console.log('Population raster overlay loaded and color-boosted successfully.');
      });
      rasterLayer.on('error', (e) => {
        console.error('Failed to load population raster overlay:', e);
      });

      if (isRasterVisible) {
        rasterLayer.addTo(map);
        const el = rasterLayer.getElement();
        if (el) {
          el.style.filter = 'saturate(260%) contrast(190%) brightness(0.92)';
        }
      }
      rasterLayerRef.current = rasterLayer;

      L.control.zoom({ position: 'topright' }).addTo(map);

      // Tile layer (remains on default tilePane with z-index 200)
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
        attribution: '&copy; OpenStreetMap contributors | DOSTS / WBG',
      }).addTo(map);

      tileLayerRef.current = tileLayer;
      mapInstanceRef.current = map;
    }

    return () => {
      // cleanup handled if unmounted
    };
  }, []);



  // Update tile layer when basemap changes
  useEffect(() => {
    if (!mapInstanceRef.current || !tileLayerRef.current) return;
    mapInstanceRef.current.removeLayer(tileLayerRef.current);

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

    const newTile = L.tileLayer(getTileUrl(basemap), {
      maxZoom: 18,
      attribution: '&copy; OpenStreetMap contributors | DOSTS / WBG',
    }).addTo(mapInstanceRef.current);

    tileLayerRef.current = newTile;
  }, [basemap]);

  // Update Raster Layer opacity & visibility dynamically
  useEffect(() => {
    if (!mapInstanceRef.current || !rasterLayerRef.current) return;
    const map = mapInstanceRef.current;
    const rLayer = rasterLayerRef.current;

    if (!isRasterVisible) {
      if (map.hasLayer(rLayer)) {
        map.removeLayer(rLayer);
      }
    } else {
      if (!map.hasLayer(rLayer)) {
        rLayer.addTo(map);
      }
      rLayer.setOpacity(rasterOpacity);
    }
  }, [rasterOpacity, isRasterVisible]);

  // Keep isThematicVisibleRef in sync with state
  useEffect(() => {
    isThematicVisibleRef.current = isThematicVisible && thematicOpacity > 0;
  }, [isThematicVisible, thematicOpacity]);

  // Update Thematic GeoJSON layer style when opacity or visibility changes
  useEffect(() => {
    if (geojsonLayerRef.current) {
      geojsonLayerRef.current.setStyle(styleFeature);
    }
  }, [thematicOpacity, isThematicVisible]);

  // Load GeoJSON for the active level
  useEffect(() => {
    setLoading(true);
    const fileMap: Record<SubdivisionLevel, string> = {
      regions: '/data/regions_5km.geojson',
      departements: '/data/departements_5km.geojson',
      arrondissements: '/data/arrondissements_5km.geojson',
      districts_sante: '/data/districts_sante_5km.geojson',
      aires_sante: '/data/aires_sante_5km.geojson',
    };

    fetch(fileMap[level])
      .then((res) => res.json())
      .then((data) => {
        setGeoData(data);
        setAllFeatures(data.features || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Error loading GeoJSON layer:', err);
        setLoading(false);
      });
  }, [level]);

  // Render GeoJSON layer with territorial filter and auto-zoom
  useEffect(() => {
    if (!mapInstanceRef.current || !geoData) return;
    const map = mapInstanceRef.current;
    featureLayersRef.current.clear();

    // Remove previous highlight and old geojson layer
    if (selectedHighlightLayerRef.current) {
      map.removeLayer(selectedHighlightLayerRef.current);
      selectedHighlightLayerRef.current = null;
    }
    if (geojsonLayerRef.current) {
      map.removeLayer(geojsonLayerRef.current);
    }

    // Create new Leaflet GeoJSON layer filtered by selectedRegion & selectedSubdivision
    const layer = L.geoJSON(geoData, {
      filter: (feature) => {
        return isFeatureInTerritorialFilter(feature, selectedRegion, selectedSubdivision, level);
      },
      style: styleFeature,
      onEachFeature: (feature, l) => {
        const props = feature.properties;
        const name = getFeatureNameForLevel(level, props);
        const pct = props.popCoveredPercent || 0;
        const pop = props.popTotal ? Math.round(props.popTotal).toLocaleString('fr-FR') : '0';

        // Store layer reference for zoom-to-feature lookup
        featureLayersRef.current.set(normalizeName(name), l);

        // Tooltip on hover (Concise: Name, Coverage %, Pop)
        l.bindTooltip(
          `<div class="font-mono text-xs p-1">
            <strong>${name}</strong><br/>
            <span style="color: ${getColor(pct)}">${language === 'fr' ? 'Couverture' : 'Coverage'}: <strong>${pct}%</strong></span><br/>
            <span>${language === 'fr' ? 'Pop. totale' : 'Total pop'}: ${pop} ${language === 'fr' ? 'hab.' : 'pop.'}</span>
          </div>`,
          { sticky: true, className: 'leaflet-custom-tooltip' }
        );

        // Hover & Click listeners
        l.on({
          mouseover: (e) => {
            if (!isThematicVisibleRef.current) return;

            const target = e.target;
            target.setStyle({
              weight: 3,
              color: '#0f172a',
              fillOpacity: 0.9,
            });
            target.bringToFront();
          },
          mouseout: (e) => {
            layer.resetStyle(e.target);
          },
          click: () => {
            setSelectedFeature(props);

            // Highlight the selected division on the dedicated highlightPane (z-index 500)
            if (mapInstanceRef.current) {
              if (selectedHighlightLayerRef.current) {
                mapInstanceRef.current.removeLayer(selectedHighlightLayerRef.current);
                selectedHighlightLayerRef.current = null;
              }
              const hl = L.geoJSON(feature, {
                pane: 'highlightPane',
                style: {
                  fillColor: getColor(pct),
                  fillOpacity: 0.95,
                  color: '#0f172a',
                  weight: 4,
                  opacity: 1,
                  dashArray: '',
                },
              }).addTo(mapInstanceRef.current);
              selectedHighlightLayerRef.current = hl;
            }

            // User Requirement 2 & 3: Zoom into polygon on click
            try {
              const b = (l as any).getBounds();
              if (b && b.isValid()) {
                mapInstanceRef.current?.fitBounds(b, {
                  padding: [60, 60],
                  maxZoom: level === 'aires_sante' ? 13 : level === 'districts_sante' ? 11 : 9,
                  animate: true,
                });
              }
            } catch (err) {
              console.error('Error zooming to layer bounds on click:', err);
            }
          },
        });
      },
    });

    layer.addTo(map);
    geojsonLayerRef.current = layer;

    // Auto-fit bounds on Cameroon or filtered territory
    try {
      const bounds = layer.getBounds();
      if (bounds.isValid()) {
        if (selectedSubdivision || selectedRegion) {
          map.fitBounds(bounds, {
            padding: [50, 50],
            maxZoom: level === 'aires_sante' ? 12 : 10,
            animate: true,
          });
        } else {
          const fitZoom = map.getBoundsZoom(bounds, false, L.point(20, 20));
          map.setView(bounds.getCenter(), fitZoom);
        }
      }
    } catch (e) {
      console.error(e);
    }
  }, [geoData, selectedRegion, selectedSubdivision, level]);

  // Entités du découpage actif filtrées par le territoire sélectionné
  const territorialFeatures = useMemo(() => {
    return allFeatures.filter((f) =>
      isFeatureInTerritorialFilter(f, selectedRegion, selectedSubdivision, level)
    );
  }, [allFeatures, selectedRegion, selectedSubdivision, level]);

  // Synthèse statistique du territoire actif (national ou sélectionné)
  const territoryStats = useMemo(() => {
    if (!selectedRegion && !selectedSubdivision) {
      return {
        isTerritory: false,
        title: language === 'fr' ? 'Statistiques Nationales' : 'National Statistics',
        subtitle: language === 'fr' ? 'Cameroun • Synthèse FOSA' : 'Cameroon • HF Summary',
        popTotal: nationalData?.popTotal || 0,
        popCovered: nationalData?.popTravelTime_60 || 0,
        popCoveredPercent: nationalData?.popCoveredPercent_60 || 0,
        popIsolated: (nationalData?.popTotal || 0) - (nationalData?.popTravelTime_60 || 0),
        popIsolatedPercent: nationalData ? 100 - nationalData.popCoveredPercent_60 : 0,
        zonesCount: allFeatures.length,
      };
    }

    let totalPop = 0;
    let coveredPop = 0;
    territorialFeatures.forEach((f) => {
      const p = f.properties || {};
      const pop = p.popTotal || 0;
      const pct = p.popCoveredPercent || 0;
      totalPop += pop;
      coveredPop += (pop * pct) / 100;
    });

    const coveredPct = totalPop > 0 ? (coveredPop / totalPop) * 100 : 0;
    const isolatedPop = totalPop - coveredPop;
    const isolatedPct = 100 - coveredPct;

    let subTitle = '';
    if (selectedSubdivision) {
      subTitle = `${selectedSubdivision.type === 'district' ? (language === 'fr' ? 'District' : 'District') : (language === 'fr' ? 'Département' : 'Department')} : ${selectedSubdivision.name}`;
      if (selectedSubdivision.region) subTitle += ` (${selectedSubdivision.region})`;
    } else if (selectedRegion) {
      subTitle = `${language === 'fr' ? 'Région' : 'Region'} : ${selectedRegion}`;
    }

    return {
      isTerritory: true,
      title: language === 'fr' ? 'Statistiques Territoriales' : 'Territorial Statistics',
      subtitle: subTitle,
      popTotal: totalPop,
      popCovered: coveredPop,
      popCoveredPercent: coveredPct,
      popIsolated: isolatedPop,
      popIsolatedPercent: isolatedPct,
      zonesCount: territorialFeatures.length,
    };
  }, [nationalData, selectedRegion, selectedSubdivision, territorialFeatures, allFeatures.length]);

  // Function to select and zoom to a feature (used by the search bar)
  const handleSelectAndZoom = (props: any) => {
    setSelectedFeature(props);
    setSearchTerm('');

    const name = getFeatureNameForLevel(level, props);
    const l = featureLayersRef.current.get(normalizeName(name));

    // Find the feature object to highlight in highlightPane
    const feat = territorialFeatures.find(f => {
      const p = f.properties;
      const fn = getFeatureNameForLevel(level, p);
      return normalizeName(fn) === normalizeName(name);
    });

    if (mapInstanceRef.current && feat) {
      if (selectedHighlightLayerRef.current) {
        mapInstanceRef.current.removeLayer(selectedHighlightLayerRef.current);
        selectedHighlightLayerRef.current = null;
      }
      const pct = props.popCoveredPercent || 0;
      const hl = L.geoJSON(feat, {
        pane: 'highlightPane',
        style: {
          fillColor: getColor(pct),
          fillOpacity: 0.95,
          color: '#0f172a',
          weight: 4,
          opacity: 1,
          dashArray: '',
        }
      }).addTo(mapInstanceRef.current);
      selectedHighlightLayerRef.current = hl;
    }

    if (l && mapInstanceRef.current) {
      try {
        const b = (l as any).getBounds();
        if (b && b.isValid()) {
          mapInstanceRef.current.fitBounds(b, {
            padding: [60, 60],
            maxZoom: level === 'aires_sante' ? 13 : level === 'districts_sante' ? 11 : 9,
            animate: true,
          });
        }
      } catch (err) {
        console.error('Error zooming to searched feature:', err);
      }
    }
  };

  // Export CSV of active level table and filtered territory
  const handleExportCsv = () => {
    if (!territorialFeatures.length) return;
    const header = "Nom;Region;Departement;District;Population Totale;Pop Couverte (<5km) %;Pop Non Couverte (>5km) %;Cible Prioritaire (<80%)\n";
    const rows = territorialFeatures.map(f => {
      const p = f.properties;
      const name = getFeatureNameForLevel(level, p);
      const reg = p.region || p.Nom_Region || p.NAME_1 || '';
      const dep = p.dept || p.Nom_Dept || p.NAME_2 || '';
      const dist = p.district || p.District_S || '';
      const pop = p.popTotal || 0;
      const pct = p.popCoveredPercent || 0;
      const uncov = p.popUncoveredPercent || (100 - pct);
      const isPrio = pct < 80 ? 'OUI' : 'NON';
      return `"${name}";"${reg}";"${dep}";"${dist}";${pop};${pct};${uncov};${isPrio}`;
    }).join("\n");

    const dateStr = new Date().toISOString().split('T')[0];
    let filterStr = 'national';
    if (selectedSubdivision) {
      filterStr = `${selectedSubdivision.type}_${selectedSubdivision.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    } else if (selectedRegion) {
      filterStr = selectedRegion.toLowerCase().replace(/[^a-z0-9]/g, '_');
    }

    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `CiblageASC_Couverture_5km_FOSA_${level}_${filterStr}_${dateStr}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    triggerToast(language === 'fr' ? `Export CSV généré (${territorialFeatures.length} zones)` : `CSV export generated (${territorialFeatures.length} zones)`);
  };

  // Filter features based on search within territorial selection
  const filteredSubdivisions = territorialFeatures.filter(f => {
    const name = getFeatureNameForLevel(level, f.properties);
    return name.toLowerCase().includes(searchTerm.toLowerCase());
  });

  // User Requirement 3: Build the multi-tier upper hierarchy breakdown on click
  const upperTiersHierarchy = useMemo((): HierarchyItem[] => {
    if (!selectedFeature) return [];
    const items: HierarchyItem[] = [];

    // 1. National tier is always present at the very top
    if (nationalData) {
      items.push({
        levelLabel: language === 'fr' ? 'National (Cameroun)' : 'National (Cameroon)',
        name: 'National',
        popTotal: nationalData.popTotal,
        popCoveredPercent: nationalData.popCoveredPercent_60,
      });
    }

    const regName = selectedFeature.region || selectedFeature.Nom_Region || selectedFeature.NAME_1;
    const deptName = selectedFeature.dept || selectedFeature.Nom_Dept || selectedFeature.NAME_2;
    const distName = selectedFeature.district || selectedFeature.District_S;
    const arrName = selectedFeature.Nom_Arrond || (level === 'arrondissements' ? selectedFeature.NAME_3 : null);

    // 2. Region Tier (if active level is below region)
    if (level !== 'regions' && regName) {
      const regData = regionsLookup.get(normalizeName(regName));
      if (regData) {
        items.push({
          levelLabel: language === 'fr' ? 'Région' : 'Region',
          name: regData.name,
          popTotal: regData.popTotal,
          popCoveredPercent: regData.popCoveredPercent,
        });
      } else {
        items.push({
          levelLabel: language === 'fr' ? 'Région' : 'Region',
          name: regName,
          popTotal: 0,
          popCoveredPercent: 0,
        });
      }
    }

    // 3. Department Tier (for Arrondissements and Aires de Santé)
    if ((level === 'arrondissements' || level === 'aires_sante') && deptName) {
      const deptData = deptsLookup.get(normalizeName(deptName));
      if (deptData) {
        items.push({
          levelLabel: language === 'fr' ? 'Département' : 'Department',
          name: deptData.name,
          popTotal: deptData.popTotal,
          popCoveredPercent: deptData.popCoveredPercent,
        });
      }
    }

    // 4. Arrondissement Tier (for Aires de Santé if mapped)
    if (level === 'aires_sante' && arrName) {
      const arrData = arrsLookup.get(normalizeName(arrName));
      if (arrData) {
        items.push({
          levelLabel: language === 'fr' ? 'Arrondissement' : 'Sub-district',
          name: arrData.name,
          popTotal: arrData.popTotal,
          popCoveredPercent: arrData.popCoveredPercent,
        });
      }
    }

    // 5. District de Santé Tier (for Aires de Santé)
    if (level === 'aires_sante' && distName) {
      const distData = distsLookup.get(normalizeName(distName));
      if (distData) {
        items.push({
          levelLabel: language === 'fr' ? 'District de Santé' : 'Health District',
          name: distData.name,
          popTotal: distData.popTotal,
          popCoveredPercent: distData.popCoveredPercent,
        });
      }
    }

    // 6. District de Santé Tier when inspecting a District
    if (level === 'districts_sante') {
      // Upper tiers for district are already Region and National
    }

    return items;
  }, [selectedFeature, level, nationalData, regionsLookup, deptsLookup, arrsLookup, distsLookup]);

  return (
    <div className="relative w-full h-[calc(100vh-4rem)] bg-[#f8fafc] overflow-hidden select-none flex flex-col font-sans">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 bg-[#0f172a] text-white px-4 py-2.5 rounded-2xl shadow-2xl flex items-center gap-2.5 font-mono text-xs animate-in slide-in-from-top-2 duration-200 border border-white/20">
          <Sparkles className="w-4 h-4 text-[#86efac]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 
        1. TOP HEADER CONTAINER
        Streamlined to keep the map spacious: subdivision levels and basemap switches are on the persistent sidebar!
      */}
      <div className="z-20 bg-white border-b border-[#e2e8f0] shadow-2xs">
        <div>
          <div className="px-4 py-2 flex flex-wrap items-center justify-between gap-3">
            {/* Title & Directive */}
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#006948]/10 text-[#006948] flex items-center justify-center font-bold shrink-0">
                <Activity className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[9px] font-bold uppercase bg-[#be123c]/10 text-[#be123c] px-2 py-0.5 rounded-full border border-[#fecdd3]">
                    {language === 'fr' ? 'Ciblage ASC • Zones de Déficit FOSA' : 'CHW Targeting • HF Deficit Zones'}
                  </span>
                  <span className="text-xs font-mono text-[#64748b] hidden md:inline">
                    {language === 'fr'
                      ? 'Les zones rouges/orange indiquent un faible accès FOSA et un besoin prioritaire en ASC'
                      : 'Red/orange zones indicate low HF access and priority CHW need'}
                  </span>
                </div>
                <h1 className="font-display font-bold text-sm text-[#0f172a] leading-tight">
                  {language === 'fr'
                    ? 'Ciblage Prioritaire des ASC dans les Zones à Faible Accès aux FOSA'
                    : 'Priority CHW Targeting in Low Health Facility Access Zones'}
                </h1>
              </div>
            </div>

              {/* Action Buttons & Territorial Filters */}
              <div data-tour="horizontal-filter-bar" className="flex items-center gap-2 flex-wrap">
                {/* 1. Filtre Régional */}
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

                {/* 2. Filtre Libre : Département ou District (Recherche libre demandée par l'utilisateur) */}
                <div ref={subdivDropdownRef} className="relative flex items-center">
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
                      className="bg-transparent border-none text-[#0f172a] text-xs font-mono font-semibold placeholder:text-[#94a3b8] placeholder:font-normal focus:outline-none w-36 sm:w-44 md:w-52"
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
                                  ? `${language === 'fr' ? 'District' : 'District'} • ${language === 'fr' ? 'Dép.' : 'Dept.'} ${item.dept || '-'} • ${item.region}`
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

                {/* Export CSV */}
                <div data-tour="ciblage-stats-csv" className="flex items-center gap-2">
                <button
                  onClick={handleExportCsv}
                  className="inline-flex items-center gap-1.5 px-3 py-1 bg-white hover:bg-[#f1f5f9] text-[#0f172a] border border-[#cbd5e1] rounded-xl text-xs font-semibold transition-all shadow-2xs"
                  title={language === 'fr' ? 'Exporter les indicateurs en CSV' : 'Export indicators as CSV'}
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-[#006948]" />
                  <span className="hidden sm:inline">Export CSV</span>
                </button>
                </div>
              </div>
            </div>
          </div>
        </div>

      {/* 
        2. MAIN LEAFLET MAP VIEWPORT WITH FLOATING CONTROLS & INSPECTOR
      */}
      <div className="flex-1 relative overflow-hidden">
        {/* Loading Spinner */}
        {loading && (
          <div className="absolute inset-0 z-30 bg-white/60 backdrop-blur-xs flex items-center justify-center">
            <div className="bg-white p-4 rounded-2xl shadow-xl border border-[#cbd5e1] flex items-center gap-3 font-mono text-xs">
              <div className="w-5 h-5 border-2 border-[#006948] border-t-transparent rounded-full animate-spin"></div>
              <span>{language === 'fr' ? `Chargement de la couche vectorielle (${level})...` : `Loading vector layer (${level})...`}</span>
            </div>
          </div>
        )}

        {/* The Leaflet Container - z-0 isolates Leaflet internal panes (z-index: 200..1000) */}
        <div ref={mapContainerRef} className="w-full h-full z-0" />

        {/* 
          FLOATING DUAL LEGEND (Bottom-Left)
          Visible by default, collapsible via isLegendOpen button.
          Translucent glassmorphism (bg-white/85 backdrop-blur-xl) so map is visible behind.
        */}
        {!isLegendOpen ? (
          <button
            type="button"
            onClick={() => setIsLegendOpen(true)}
            className="absolute bottom-6 left-4 z-30 bg-white/95 hover:bg-white text-[#0f172a] border border-[#cbd5e1] rounded-2xl px-3.5 py-2.5 shadow-xl font-sans text-xs font-bold flex items-center gap-2.5 transition-all hover:scale-105 backdrop-blur-md group cursor-pointer"
            title={language === 'fr' ? 'Afficher la légende' : 'Show legend'}
          >
            <div className="w-6 h-6 rounded-lg bg-[#006948]/10 text-[#006948] flex items-center justify-center font-bold">
              <Layers className="w-3.5 h-3.5" />
            </div>
            <div className="flex items-center gap-1.5 font-sans font-semibold text-xs text-[#0f172a]">
              <span>{language === 'fr' ? 'Légende' : 'Legend'}</span>
              <span className="w-2.5 h-2.5 rounded-full bg-[#006948]" title={language === 'fr' ? 'Couverture FOSA' : 'HF Coverage'} />
              <span className="w-2.5 h-2.5 rounded-full bg-[#e11d48]" title={language === 'fr' ? 'Raster Pop. Isolée' : 'Isolated Pop. Raster'} />
            </div>
            <ChevronUp className="w-4 h-4 text-[#64748b] group-hover:text-[#006948] transition-colors" />
          </button>
        ) : (
          <div className="absolute bottom-6 left-4 z-30 pointer-events-auto flex flex-col gap-2.5 w-72 sm:w-80 bg-white/85 backdrop-blur-xl rounded-2xl shadow-2xl border border-[#cbd5e1]/80 p-3.5 text-xs font-mono animate-in fade-in zoom-in-95 duration-150">
            {/* Header Légende avec titre épuré et bouton réduire */}
            <div className="flex items-center justify-between pb-2 border-b border-[#e2e8f0]">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-[#006948]/10 text-[#006948] flex items-center justify-center font-bold">
                  <Layers className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-xs text-[#0f172a] leading-tight">
                    {language === 'fr' ? 'Légende' : 'Legend'}
                  </h3>
                  <span className="text-[9.5px] font-mono text-[#64748b] block">
                    {language === 'fr' ? 'Rayon d’accès FOSA : ≤ 5 km' : 'HF Access radius: ≤ 5 km'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsLegendOpen(false)}
                className="p-1 rounded-lg hover:bg-[#e2e8f0] text-[#64748b] hover:text-[#0f172a] transition-colors cursor-pointer"
                title={language === 'fr' ? 'Réduire la légende' : 'Collapse legend'}
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Légende 1: Carte Thématique (% Pop <= 5 km) */}
            <div className="bg-white/75 backdrop-blur-sm rounded-xl p-2.5 border border-[#e2e8f0] space-y-1.5 shadow-2xs">
              <div className="flex items-center justify-between pb-1.5 border-b border-[#e2e8f0]/80">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setIsThematicVisible(!isThematicVisible)}
                    className={`p-1 rounded-md transition-colors cursor-pointer ${
                      isThematicVisible ? 'text-[#006948] hover:bg-[#e0f2fe]' : 'text-[#94a3b8] hover:bg-[#f1f5f9]'
                    }`}
                    title={isThematicVisible ? (language === 'fr' ? "Masquer la couche thématique" : 'Hide thematic layer') : (language === 'fr' ? "Afficher la couche thématique" : 'Show thematic layer')}
                  >
                    {isThematicVisible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                  </button>
                  <div className="flex flex-col">
                    <span className="font-bold text-[11px] text-[#0f172a] leading-tight">
                      {language === 'fr' 
                        ? 'Pourcentage de population à ≤ 5 km d’une FOSA' 
                        : 'Population percentage within ≤ 5 km of a health facility'}
                    </span>
                    <span className="text-[9px] text-[#64748b]">
                      {language === 'fr' 
                        ? 'Accès direct aux soins • Déduction du besoin en ASC' 
                        : 'Direct healthcare access • Derivation of CHW need'}
                    </span>
                  </div>
                </div>
                <span className="text-[9px] bg-[#f1f5f9] px-1.5 py-0.5 rounded font-bold text-[#006948]">
                  {Math.round(thematicOpacity * 100)}%
                </span>
              </div>

              {/* Classes thématiques */}
              {isThematicVisible && (
                <div className="pt-1 space-y-1 text-[10px]">
                  <div className="flex items-center gap-2">
                    <span className="w-3.5 h-2.5 rounded shrink-0 shadow-2xs" style={{ backgroundColor: '#006948' }}></span>
                    <span className="text-[#334155]">
                      {language === 'fr'
                        ? '≥ 90% (Accès optimal → Besoin ASC très résiduel)'
                        : '≥ 90% (Optimal access → Minimal CHW need)'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3.5 h-2.5 rounded shrink-0 shadow-2xs" style={{ backgroundColor: '#22c55e' }}></span>
                    <span className="text-[#334155]">
                      {language === 'fr'
                        ? '80% - 89.9% (Accès satisfaisant → Faible besoin en ASC)'
                        : '80% - 89.9% (Adequate access → Low CHW need)'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3.5 h-2.5 rounded shrink-0 shadow-2xs" style={{ backgroundColor: '#eab308' }}></span>
                    <span className="text-[#334155]">
                      {language === 'fr'
                        ? '65% - 79.9% (Déficit modéré → Besoin ASC modéré)'
                        : '65% - 79.9% (Moderate deficit → Moderate CHW need)'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3.5 h-2.5 rounded shrink-0 shadow-2xs" style={{ backgroundColor: '#f97316' }}></span>
                    <span className="text-[#334155]">
                      {language === 'fr'
                        ? '50% - 64.9% (Déficit élevé → Fort besoin en ASC)'
                        : '50% - 64.9% (High deficit → High CHW need)'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3.5 h-2.5 rounded shrink-0 shadow-2xs" style={{ backgroundColor: '#dc2626' }}></span>
                    <span className="text-[#dc2626] font-bold">
                      {language === 'fr'
                        ? '< 50% (Déficit critique → Besoin ASC prioritaire)'
                        : '< 50% (Critical deficit → Priority CHW need)'}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Légende 2: Distribution de la population non couverte (> 5 km de toute FOSA) */}
            <div className="bg-white/75 backdrop-blur-sm rounded-xl p-2.5 border border-[#fecdd3]/70 space-y-1.5 shadow-2xs">
              <div className="flex items-center justify-between pb-1.5 border-b border-[#e2e8f0]/80">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setIsRasterVisible(!isRasterVisible)}
                    className={`p-1 rounded-md transition-colors cursor-pointer ${
                      isRasterVisible ? 'text-[#e11d48] hover:bg-[#ffe4e6]' : 'text-[#94a3b8] hover:bg-[#f1f5f9]'
                    }`}
                    title={isRasterVisible ? (language === 'fr' ? "Masquer la distribution de la population non couverte" : 'Hide uncovered population distribution') : (language === 'fr' ? "Afficher la distribution" : 'Show distribution')}
                  >
                    {isRasterVisible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                  </button>
                  <div className="flex flex-col">
                    <span 
                      className="font-bold text-[11px] text-[#0f172a] leading-tight" 
                      title="Distribution de la population non couverte / Grid distribution of uncovered population > 5 km de toute FOSA"
                    >
                      {language === 'fr' 
                        ? 'Distribution pop. non couverte (> 5 km FOSA)' 
                        : 'Grid distribution of uncovered pop. (> 5 km from FOSA)'}
                    </span>
                    <span className="text-[9px] text-[#94a3b8] font-mono">{language === 'fr' ? 'Grille spatiale continue' : 'Continuous spatial grid'}</span>
                  </div>
                </div>
                <span className="text-[9px] bg-[#fef2f2] text-[#e11d48] px-1.5 py-0.5 rounded font-bold border border-[#fecdd3]">
                  {Math.round(rasterOpacity * 100)}%
                </span>
              </div>

              {/* Échelle du Raster de Population (hab / pixel) */}
              {isRasterVisible && (
                <div className="pt-1 space-y-1.5 text-[10px]">
                  <div className="text-[9px] text-[#64748b]">{language === 'fr' ? 'Densité continue (hab / pixel) :' : 'Continuous density (pop / pixel):'}</div>
                  <div
                    className="w-full h-2.5 rounded-full shadow-inner"
                    style={{
                      background: 'linear-gradient(to right, #fef08a, #fdba74, #f97316, #ef4444, #a855f7, #581c87)'
                    }}
                  />
                  <div className="flex items-center justify-between text-[8px] text-[#475569] font-bold px-0.5">
                    <span>&lt; 1 hab</span>
                    <span>3.5 hab</span>
                    <span>8 hab</span>
                    <span>18 hab</span>
                    <span>&gt; 35 hab</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 
          DEDICATED FLOATING NATIONAL STATISTICS CARD (Top-Right or Floating Side Card)
          User Requirement: "la barre horizontale la plus haute ou u as mis les informations nationales, 
          je prefere que tu fasse une carte statistique de cote"
        */}
        {/* 
          DEDICATED FLOATING STATISTICS CARD (Top-Right or Floating Side Card)
        */}

        {/* 
          SEARCH & QUICK JUMP FLOATING BOX (Top-Left)
          User Requirement 2: Search truly finds zone, centers and zooms into it!
        */}
        <div className="absolute top-4 left-4 z-20 pointer-events-auto flex flex-col gap-1.5">
          {/* Badge territorial actif si filtre en cours */}
          {(selectedSubdivision || selectedRegion) && (
            <div className="flex items-center gap-1.5 bg-[#0f172a] text-white px-2.5 py-1 rounded-xl shadow-lg border border-white/20 font-mono text-[11px] w-fit animate-in fade-in slide-in-from-top-1">
              <span className="text-[#86efac]">
                {selectedSubdivision
                  ? (selectedSubdivision.type === 'district' ? '🏥 District :' : (language === 'fr' ? '🏢 Dép. :' : '🏢 Dept.:'))
                  : (language === 'fr' ? '📍 Région :' : '📍 Region:')}
              </span>
              <span className="font-bold">
                {selectedSubdivision ? selectedSubdivision.name : selectedRegion}
              </span>
              <button
                type="button"
                onClick={() => {
                  setSelectedSubdivision(null);
                  setSelectedRegion(null);
                  setSearchSubdivText('');
                }}
                className="ml-1 hover:text-[#f87171] p-0.5 rounded cursor-pointer transition-colors"
                title={language === 'fr' ? 'Effacer le filtre territorial' : 'Clear territorial filter'}
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          <div data-tour="ciblage-map-search" className="bg-white/95 backdrop-blur-md p-1.5 rounded-2xl shadow-xl border border-[#cbd5e1] flex items-center gap-2 w-76">
            <Search className="w-4 h-4 text-[#006948] ml-1.5 shrink-0" />
            <input
              type="text"
              placeholder={language === 'fr' ? `Rechercher et zoomer (${territorialFeatures.length} zones)...` : `Search and zoom (${territorialFeatures.length} zones)...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-transparent text-xs text-[#0f172a] focus:outline-none font-mono placeholder:text-[#94a3b8]"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="text-[#94a3b8] hover:text-[#0f172a] p-1 text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* Autocomplete Results Dropdown */}
          {searchTerm && filteredSubdivisions.length > 0 && (
            <div className="mt-1.5 max-h-60 overflow-y-auto bg-white rounded-2xl shadow-2xl border border-[#cbd5e1] p-1.5 space-y-1 font-mono text-xs w-76">
              {filteredSubdivisions.slice(0, 20).map((f, i) => {
                const p = f.properties;
                const name = getFeatureNameForLevel(level, p);
                const pct = p.popCoveredPercent || 0;
                const parent = p.region || p.Nom_Region || p.dept || p.Nom_Dept || p.district || p.District_S;
                return (
                  <button
                    key={i}
                    onClick={() => handleSelectAndZoom(p)}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-[#f1f5f9] flex items-center justify-between text-[11px] group transition-colors"
                  >
                    <div className="truncate pr-2">
                      <span className="truncate font-semibold text-[#0f172a] block">{name}</span>
                      {parent && (
                        <span className="text-[9px] text-[#64748b] block">
                          {parent}
                        </span>
                      )}
                    </div>
                    <span className="font-bold shrink-0 text-xs px-1.5 py-0.5 rounded bg-[#f8fafc]" style={{ color: getColor(pct) }}>
                      {pct}%
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Panneau d'analyse latéral (idem onglet 1) */}
        <CiblageAscSidePanel
          isOpen={isPanelOpen}
          onToggleOpen={() => setIsPanelOpen(!isPanelOpen)}
          level={level}
          language={language}
          selectedFeature={selectedFeature}
          onClearSelectedFeature={() => {
            setSelectedFeature(null);
            if (mapInstanceRef.current && selectedHighlightLayerRef.current) {
              mapInstanceRef.current.removeLayer(selectedHighlightLayerRef.current);
              selectedHighlightLayerRef.current = null;
            }
          }}
          territorialFeatures={territorialFeatures}
          upperTiersHierarchy={upperTiersHierarchy}
          territoryStats={territoryStats}
        />

        {/* Sélecteur Flottant de Fond de Carte (en bas à droite) */}
        <FloatingBasemapSwitcher
          basemap={basemap}
          onBasemapChange={onBasemapChange}
          language={language}
          className="bottom-5 right-4"
        />
      </div>

      {/* Modal configuration export */}
      {showExportModal && !isExporting && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-[#cbd5e1] max-w-md w-full p-5 space-y-4 font-sans animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-[#e2e8f0]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#006948]/10 text-[#006948] flex items-center justify-center">
                  <Download className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-sm text-[#0f172a]">
                  {language === 'fr' ? 'Exporter la carte actuelle' : 'Export current map'}
                </h3>
              </div>
              <button type="button" onClick={() => setShowExportModal(false)} className="p-1 rounded-lg hover:bg-[#f1f5f9] text-[#64748b] cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="bg-[#f8fafc] rounded-2xl p-3 space-y-1.5 text-xs font-mono text-[#334155] border border-[#e2e8f0]">
              <div className="flex justify-between">
                <span className="text-[#64748b]">{language === 'fr' ? 'Carte active :' : 'Active map:'}</span>
                <strong>{language === 'fr' ? 'Besoin Réel ASC (< 5 km FOSA)' : 'Real CHW Need (< 5 km HF)'}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748b]">{language === 'fr' ? 'Résolution :' : 'Resolution:'}</span>
                <strong className="text-[#0284c7]">A4 — 300 DPI ({exportOrientation === 'portrait' ? '2480 x 3508 px' : '3508 x 2480 px'})</strong>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-mono text-[#475569]">{language === 'fr' ? 'Orientation :' : 'Orientation:'}</p>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setExportOrientation('portrait')}
                  className={`py-2 px-3 rounded-xl border flex flex-col items-center gap-1 transition-all cursor-pointer ${exportOrientation === 'portrait' ? 'border-[#006948] bg-[#f0fdf4] text-[#006948] font-bold shadow-xs' : 'border-[#cbd5e1] bg-white text-[#475569] hover:bg-[#f8fafc]'}`}>
                  <div className="w-5 h-7 border-2 rounded-sm border-current" />
                  <span className="text-[10px] font-mono">{language === 'fr' ? 'Portrait' : 'Portrait'}</span>
                </button>
                <button type="button" onClick={() => setExportOrientation('landscape')}
                  className={`py-2 px-3 rounded-xl border flex flex-col items-center gap-1 transition-all cursor-pointer ${exportOrientation === 'landscape' ? 'border-[#006948] bg-[#f0fdf4] text-[#006948] font-bold shadow-xs' : 'border-[#cbd5e1] bg-white text-[#475569] hover:bg-[#f8fafc]'}`}>
                  <div className="w-7 h-5 border-2 rounded-sm border-current" />
                  <span className="text-[10px] font-mono">{language === 'fr' ? 'Paysage' : 'Landscape'}</span>
                </button>
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => setShowExportModal(false)}
                className="flex-1 py-2.5 px-4 bg-[#f1f5f9] hover:bg-[#e2e8f0] text-[#475569] font-mono font-bold text-xs rounded-xl transition-all cursor-pointer">
                {language === 'fr' ? 'Annuler' : 'Cancel'}
              </button>
              <button type="button" onClick={() => { setShowExportModal(false); handleExportMap(exportOrientation); }}
                className="flex-1 py-2.5 px-4 bg-[#006948] hover:bg-[#005238] text-white font-mono font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer">
                <Download className="w-3.5 h-3.5" />
                {language === 'fr' ? 'Générer PNG A4' : 'Generate A4 PNG'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Indicateur de progression export */}
      {isExporting && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-[#cbd5e1] max-w-sm w-full p-5 space-y-3 font-sans text-center animate-in fade-in zoom-in-95 duration-150">
            <div className="w-10 h-10 mx-auto rounded-2xl bg-[#006948]/10 text-[#006948] flex items-center justify-center">
              <Download className="w-5 h-5 animate-pulse" />
            </div>
            <h3 className="font-bold text-sm text-[#0f172a]">
              {language === 'fr' ? "Génération de l'export cartographique" : 'Generating map export'}
            </h3>
            <div className="w-full bg-[#f1f5f9] rounded-full h-2.5 overflow-hidden">
              <div className="bg-[#006948] h-2.5 rounded-full transition-all duration-300" style={{ width: `${exportProgress}%` }} />
            </div>
            <p className="text-[11px] font-mono text-[#64748b]">{exportStatus}</p>
            <p className="text-[10px] font-mono text-[#94a3b8]">{exportProgress}% — A4 300 DPI</p>
          </div>
        </div>
      )}
    </div>
  );
};
