import React, { useState, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  BarChart3,
  Users,
  UserMinus,
  ShieldAlert,
  AlertTriangle,
  ArrowLeft,
  TrendingUp,
  MapPin,
  Filter,
  Layers,
  Activity,
  CheckCircle2,
  X,
  Building,
  Target
} from 'lucide-react';
import { SubdivisionLevel } from '../types';
import {
  COVERAGE_CONFIG,
  getPopulationForLevel,
  getFeatureNameForLevel,
  getCanonicalRegionName,
  normalizeString,
  AscCategoryDef,
  TerritorialFilter,
  isFeatureInTerritorialFilter
} from '../config/coverageConfig';

interface CouvertureAscSidePanelProps {
  isOpen: boolean;
  onToggleOpen: () => void;
  level: SubdivisionLevel;
  selectedRegion: string | null;
  onSelectRegion: (reg: string | null) => void;
  selectedSubdivision: TerritorialFilter | null;
  onSelectSubdivision: (subdiv: TerritorialFilter | null) => void;
  departmentsList?: Array<{ name: string; region: string }>;
  districtsList?: Array<{ name: string; region: string; dept?: string }>;
  selectedFeature: any | null;
  onClearSelectedFeature: () => void;
  onSelectFeatureFromList: (feature: any) => void;
  currentLevelFeatures: any[];
  allAiresFeatures: any[];
  regionsFeatures: any[];
  districtsFeatures: any[];
  language: 'fr' | 'en';
}

export const CouvertureAscSidePanel: React.FC<CouvertureAscSidePanelProps> = ({
  isOpen,
  onToggleOpen,
  level,
  selectedRegion,
  onSelectRegion,
  selectedSubdivision,
  onSelectSubdivision,
  departmentsList = [],
  districtsList = [],
  selectedFeature,
  onClearSelectedFeature,
  onSelectFeatureFromList,
  currentLevelFeatures,
  allAiresFeatures,
  regionsFeatures,
  districtsFeatures,
  language,
}) => {
  const isFr = language === 'fr';

  // Bascule Graphique 1 : 'zones' | 'population'
  const [chart1Metric, setChart1Metric] = useState<'zones' | 'population'>('zones');

  // Onglet pour les deux listes du Mode 1 : 'under_covered' | 'inactives'
  const [activeListTab, setActiveListTab] = useState<'under_covered' | 'inactives'>('under_covered');

  const levelLabels: Record<SubdivisionLevel, string> = isFr
    ? {
        regions: 'régions',
        departements: 'départements',
        arrondissements: 'arrondissements',
        districts_sante: 'districts de santé',
        aires_sante: 'aires de santé',
      }
    : {
        regions: 'regions',
        departements: 'departments',
        arrondissements: 'sub-districts',
        districts_sante: 'health districts',
        aires_sante: 'health areas',
      };

  // -------------------------------------------------------------
  // 1. CALCULS MODE 1 (RÉSUMÉ DU TERRITOIRE AFFICHÉ)
  // -------------------------------------------------------------

  const filteredAires = useMemo(() => {
    if (!allAiresFeatures || allAiresFeatures.length === 0) return [];
    return allAiresFeatures.filter((f) =>
      isFeatureInTerritorialFilter(f, selectedRegion, selectedSubdivision, 'aires_sante')
    );
  }, [allAiresFeatures, selectedRegion, selectedSubdivision]);

  const territoryTotals = useMemo(() => {
    let totActifs = 0;
    let totAscp = 0;
    let totInact = 0;
    let totPop = 0;

    const catSums: Record<string, number> = {
      EFF_ASCP_A: 0,
      EFF_ACC_A: 0,
      EFF_APS_A: 0,
      EFF_PE_A: 0,
      EFF_MM_A: 0,
      EFF_RC_A: 0,
    };

    filteredAires.forEach((f) => {
      const p = f.properties || {};
      if (typeof p.EFF_TOT_A === 'number') totActifs += p.EFF_TOT_A;
      if (typeof p.EFF_ASCP_A === 'number') totAscp += p.EFF_ASCP_A;
      if (typeof p.EFF_TOT_I === 'number') totInact += p.EFF_TOT_I;
      if (typeof p.popTotal === 'number') totPop += p.popTotal;

      Object.keys(catSums).forEach((k) => {
        if (typeof p[k] === 'number') {
          catSums[k] += p[k];
        }
      });
    });

    return {
      totActifs,
      totAscp,
      totInact,
      totPop,
      catSums,
    };
  }, [filteredAires]);

  const filteredCurrentLevelFeatures = useMemo(() => {
    if (!currentLevelFeatures || currentLevelFeatures.length === 0) return [];
    return currentLevelFeatures.filter((f) =>
      isFeatureInTerritorialFilter(f, selectedRegion, selectedSubdivision, level)
    );
  }, [currentLevelFeatures, selectedRegion, selectedSubdivision, level]);

  const sousCouvertesSummary = useMemo(() => {
    let countZones = 0;
    let countSous = 0;
    let popSous = 0;
    let totalLevelPop = 0;

    filteredCurrentLevelFeatures.forEach((f) => {
      const p = f.properties || {};
      const classe = p[COVERAGE_CONFIG.FIELDS.CLASSE_CVG];
      const pop = getPopulationForLevel(level, p) || 0;

      if (classe) {
        countZones++;
        totalLevelPop += pop;
        if (classe === 'sous_couverte' || classe === 'aucun_ascp_actif') {
          countSous++;
          popSous += pop;
        }
      }
    });

    const pctSousZones = countZones > 0 ? (countSous / countZones) * 100 : 0;
    const refPop = territoryTotals.totPop > 0 ? territoryTotals.totPop : totalLevelPop;
    const pctPopSous = refPop > 0 ? (popSous / refPop) * 100 : 0;

    return {
      countZones,
      countSous,
      pctSousZones,
      popSous,
      pctPopSous,
    };
  }, [filteredCurrentLevelFeatures, level, territoryTotals.totPop]);

  const classeDistribution = useMemo(() => {
    const counts: Record<string, { zones: number; population: number }> = {
      couverte: { zones: 0, population: 0 },
      couverte_si_urbain: { zones: 0, population: 0 },
      sous_couverte: { zones: 0, population: 0 },
      aucun_ascp_actif: { zones: 0, population: 0 },
      pop_manquante: { zones: 0, population: 0 },
    };

    let totalZones = 0;
    let totalPop = 0;

    filteredCurrentLevelFeatures.forEach((f) => {
      const p = f.properties || {};
      const c = p[COVERAGE_CONFIG.FIELDS.CLASSE_CVG];
      const pop = getPopulationForLevel(level, p) || 0;

      if (c && counts[c]) {
        counts[c].zones += 1;
        counts[c].population += pop;
        totalZones += 1;
        totalPop += pop;
      }
    });

    return Object.entries(COVERAGE_CONFIG.NORMATIVE_CLASSES).map(([key, def]) => {
      const data = counts[key] || { zones: 0, population: 0 };
      const zonePct = totalZones > 0 ? (data.zones / totalZones) * 100 : 0;
      const popPct = totalPop > 0 ? (data.population / totalPop) * 100 : 0;
      return {
        key,
        ...def,
        zones: data.zones,
        zonePct,
        population: data.population,
        popPct,
      };
    });
  }, [filteredCurrentLevelFeatures, level]);

  const topSousCouvertes = useMemo(() => {
    const list = filteredCurrentLevelFeatures.filter((f) => {
      const c = f.properties?.[COVERAGE_CONFIG.FIELDS.CLASSE_CVG];
      return c !== null && c !== undefined && c !== 'pop_manquante';
    });

    list.sort((a, b) => {
      const pa = a.properties || {};
      const pb = b.properties || {};
      const zeroA = pa.CLASSE_CVG === 'aucun_ascp_actif' || !pa.EFF_ASCP_A ? 1 : 0;
      const zeroB = pb.CLASSE_CVG === 'aucun_ascp_actif' || !pb.EFF_ASCP_A ? 1 : 0;
      if (zeroA !== zeroB) return zeroB - zeroA;

      if (zeroA === 1 && zeroB === 1) {
        const popA = getPopulationForLevel(level, pa) || 0;
        const popB = getPopulationForLevel(level, pb) || 0;
        return popB - popA;
      }

      const ratioA = typeof pa.RATIO_ASCP === 'number' ? pa.RATIO_ASCP : 0;
      const ratioB = typeof pb.RATIO_ASCP === 'number' ? pb.RATIO_ASCP : 0;
      return ratioB - ratioA;
    });

    return list.slice(0, 10);
  }, [filteredCurrentLevelFeatures, level]);

  const topInactifs = useMemo(() => {
    const list = filteredCurrentLevelFeatures.filter((f) => {
      return typeof f.properties?.[COVERAGE_CONFIG.FIELDS.EFF_TOT_I] === 'number';
    });

    list.sort((a, b) => {
      const inactA = a.properties?.[COVERAGE_CONFIG.FIELDS.EFF_TOT_I] || 0;
      const inactB = b.properties?.[COVERAGE_CONFIG.FIELDS.EFF_TOT_I] || 0;
      return inactB - inactA;
    });

    return list.slice(0, 10);
  }, [filteredCurrentLevelFeatures]);

  // -------------------------------------------------------------
  // 2. DONNÉES MODE 2 (FICHE D'UNE ZONE SÉLECTIONNÉE)
  // -------------------------------------------------------------
  const zoneProps = selectedFeature?.properties || null;

  const zoneHierarchy = useMemo(() => {
    if (!zoneProps) return null;
    const name = getFeatureNameForLevel(level, zoneProps);
    const region = zoneProps.region || zoneProps.Nom_Region || zoneProps.NAME_1 || '';
    const district = zoneProps.district || zoneProps.District_S || '';
    const dept = zoneProps.dept || zoneProps.Nom_Dept || zoneProps.NAME_2 || '';

    let items: string[] = [];
    if (level === 'aires_sante') {
      items = [region, district, name].filter(Boolean);
    } else if (level === 'districts_sante') {
      items = [region, name].filter(Boolean);
    } else if (level === 'departements') {
      items = [region, name].filter(Boolean);
    } else {
      items = [name].filter(Boolean);
    }

    return {
      name,
      region,
      district,
      dept,
      path: items.join(' > '),
    };
  }, [zoneProps, level]);

  const parentRegionRatio = useMemo(() => {
    if (!zoneHierarchy || !regionsFeatures || regionsFeatures.length === 0) return null;
    const canReg = getCanonicalRegionName(zoneHierarchy.region);
    const regFeat = regionsFeatures.find((f) => {
      const r = getCanonicalRegionName(f.properties?.name || f.properties?.NAME_1);
      return r === canReg;
    });
    if (!regFeat || typeof regFeat.properties?.RATIO_ASCP !== 'number') return null;
    return regFeat.properties.RATIO_ASCP;
  }, [zoneHierarchy, regionsFeatures]);

  const parentDistrictRatio = useMemo(() => {
    if (level !== 'aires_sante' || !zoneHierarchy || !districtsFeatures || districtsFeatures.length === 0) return null;
    const normDist = normalizeString(zoneHierarchy.district);
    const distFeat = districtsFeatures.find((f) => {
      const dName = normalizeString(f.properties?.name || f.properties?.District_S);
      return dName === normDist;
    });
    if (!distFeat || typeof distFeat.properties?.RATIO_ASCP !== 'number') return null;
    return distFeat.properties.RATIO_ASCP;
  }, [level, zoneHierarchy, districtsFeatures]);

  const zoneCategoryComposition = useMemo(() => {
    if (!zoneProps) return [];
    return COVERAGE_CONFIG.ASC_CATEGORIES.map((cat) => {
      const val = typeof zoneProps[cat.field] === 'number' ? zoneProps[cat.field] : 0;
      return {
        ...cat,
        value: val,
      };
    });
  }, [zoneProps]);

  const maxZoneCatVal = useMemo(() => {
    if (!zoneCategoryComposition.length) return 1;
    let m = 0;
    zoneCategoryComposition.forEach((c) => {
      if (c.value > m) m = c.value;
    });
    return m > 0 ? m : 1;
  }, [zoneCategoryComposition]);

  const maxTerritoryCatVal = useMemo(() => {
    let m = 0;
    Object.values(territoryTotals.catSums).forEach((v) => {
      if (v > m) m = v;
    });
    return m > 0 ? m : 1;
  }, [territoryTotals]);

  const locale = isFr ? 'fr-FR' : 'en-US';
  const popUnit = isFr ? 'hab.' : 'pop.';
  const naText = isFr ? 'Non disponible' : 'N/A';

  // -------------------------------------------------------------
  // RENDU DU COMPOSANT
  // -------------------------------------------------------------

  if (!isOpen) {
    return (
      <button
        type="button"
        data-tour="analysis-panel-btn"
        onClick={onToggleOpen}
        className="absolute top-[102px] right-0 z-30 bg-white/85 hover:bg-white backdrop-blur-md text-[#0f172a] border-l-2 border-y border-[#006948] rounded-l-2xl px-3 py-2.5 shadow-xl font-mono text-xs font-bold flex items-center gap-2 transition-all hover:pr-4"
        title={isFr ? "Ouvrir le panneau d'analyse" : 'Open analysis panel'}
      >
        <ChevronLeft className="w-4 h-4 text-[#006948]" />
        <span className="hidden sm:inline">{isFr ? "Panneau d'analyse" : 'Analysis panel'}</span>
      </button>
    );
  }

  return (
    <div className="absolute top-[102px] right-0 bottom-6 z-30 w-88 sm:w-96 max-w-[92vw] bg-white/80 backdrop-blur-xl rounded-l-3xl shadow-2xl border-l border-y border-[#cbd5e1]/70 flex flex-col font-sans text-xs text-[#0f172a] overflow-hidden transition-all duration-200">

      {/* 1. EN-TÊTE DU PANNEAU */}
      <div className="bg-white/70 backdrop-blur-md border-b border-[#e2e8f0]/80 px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-[#006948]/10 text-[#006948] flex items-center justify-center font-bold">
            <BarChart3 className="w-3.5 h-3.5" />
          </div>
          <div>
            <h3 className="font-bold text-xs text-[#0f172a] leading-tight">
              {selectedFeature
                ? (isFr ? 'Fiche territoriale' : 'Zone profile')
                : (isFr ? 'Synthèse territoriale' : 'Territory summary')}
            </h3>
            <span className="text-[10px] font-mono text-[#64748b]">
              {isFr ? 'Niveau :' : 'Level:'}{' '}
              <strong className="text-[#006948]">{levelLabels[level]}</strong>
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={onToggleOpen}
          className="p-1 rounded-lg hover:bg-[#e2e8f0] text-[#64748b] transition-colors"
          title={isFr ? 'Replier le panneau' : 'Collapse panel'}
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* 2. CORPS DÉROULANT DU PANNEAU */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 font-sans">

        {/* ======================================================== */}
        {/* MODE 2 : UNE ZONE EST SÉLECTIONNÉE (FICHE)              */}
        {/* ======================================================== */}
        {selectedFeature && zoneProps ? (
          <div className="space-y-4">
            {/* Bouton Retour */}
            <button
              type="button"
              onClick={onClearSelectedFeature}
              className="w-full py-1.5 px-3 bg-[#f1f5f9] hover:bg-[#e2e8f0] text-[#0f172a] font-mono text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all border border-[#cbd5e1]/70"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-[#006948]" />
              <span>{isFr ? 'Retour au résumé' : 'Back to summary'}</span>
            </button>

            {/* Cartouche d'identité de la zone */}
            <div className="bg-white p-3 rounded-2xl border border-[#cbd5e1] space-y-2 shadow-2xs">
              <div>
                <span className="text-[9px] font-mono uppercase tracking-wider text-[#64748b] block">
                  {isFr ? 'Zone sélectionnée' : 'Selected zone'}
                </span>
                <h4 className="font-bold text-sm text-[#0f172a] leading-tight">
                  {zoneHierarchy?.name}
                </h4>
                <div className="text-[10px] font-mono text-[#64748b] mt-0.5">
                  {zoneHierarchy?.path}
                </div>
              </div>

              {/* Badge de classe de couverture */}
              {(() => {
                const cKey = zoneProps[COVERAGE_CONFIG.FIELDS.CLASSE_CVG];
                const cDef = cKey ? COVERAGE_CONFIG.NORMATIVE_CLASSES[cKey] : null;
                return (
                  <div
                    className="p-2 rounded-xl text-[11px] font-medium border flex items-center gap-2"
                    style={{
                      backgroundColor: cDef ? `${cDef.color}12` : '#f1f5f9',
                      borderColor: cDef ? `${cDef.color}40` : '#cbd5e1',
                      color: cDef ? cDef.color : '#64748b',
                    }}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: cDef?.color || '#94a3b8' }}
                    ></span>
                    <span className="font-bold">
                      {cDef
                        ? (isFr ? cDef.label : (cDef as any).labelEn || cDef.label)
                        : (isFr ? 'Données non disponibles' : 'Data not available')}
                    </span>
                  </div>
                );
              })()}
            </div>

            {/* Chiffres clés de la zone */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-mono uppercase font-bold text-[#64748b] tracking-wider">
                {isFr ? 'Chiffres clés de la zone' : 'Key zone figures'}
              </span>
              <div className="grid grid-cols-2 gap-2 font-mono">
                {/* Population */}
                <div className="bg-[#f8fafc] border border-[#e2e8f0] p-2.5 rounded-xl">
                  <span className="text-[10px] text-[#64748b] block">
                    {isFr ? 'Population' : 'Population'}
                  </span>
                  <span className="font-bold text-xs text-[#0f172a]">
                    {(() => {
                      const pop = getPopulationForLevel(level, zoneProps);
                      return pop !== null
                        ? `${Math.round(pop).toLocaleString(locale)} ${popUnit}`
                        : naText;
                    })()}
                  </span>
                  {level !== 'aires_sante' && typeof zoneProps.NB_AIRES === 'number' && (
                    <span className="text-[9px] text-[#64748b] block mt-0.5">
                      {isFr
                        ? `sur ${zoneProps.NB_AIRES} aires`
                        : `over ${zoneProps.NB_AIRES} areas`}
                    </span>
                  )}
                </div>

                {/* Total Actifs */}
                <div className="bg-[#f8fafc] border border-[#e2e8f0] p-2.5 rounded-xl">
                  <span className="text-[10px] text-[#64748b] block">
                    {isFr ? 'Total ASC actifs' : 'Total active CHWs'}
                  </span>
                  <span className="font-bold text-xs text-[#0284c7]">
                    {typeof zoneProps.EFF_TOT_A === 'number'
                      ? zoneProps.EFF_TOT_A.toLocaleString(locale)
                      : naText}
                  </span>
                  <span className="text-[9px] text-[#64748b] block mt-0.5">
                    {isFr ? 'toutes catégories' : 'all categories'}
                  </span>
                </div>

                {/* ASCp Actifs */}
                <div className="bg-[#f0fdf4] border border-[#bbf7d0] p-2.5 rounded-xl">
                  <span className="text-[10px] text-[#166534] block">
                    {isFr ? 'ASC polyvalents (ASCp)' : 'Multipurpose CHWs (CHWp)'}
                  </span>
                  <span className="font-bold text-xs text-[#006948]">
                    {typeof zoneProps.EFF_ASCP_A === 'number'
                      ? zoneProps.EFF_ASCP_A.toLocaleString(locale)
                      : naText}
                  </span>
                  <span className="text-[9px] text-[#166534] block mt-0.5">
                    {isFr ? 'actifs sur le terrain' : 'active in the field'}
                  </span>
                </div>

                {/* Inactifs */}
                <div className="bg-[#fff7ed] border border-[#fed7aa] p-2.5 rounded-xl">
                  <span className="text-[10px] text-[#9a3412] block">
                    {isFr ? 'ASC inactifs' : 'Inactive CHWs'}
                  </span>
                  <span className="font-bold text-xs text-[#c2410c]">
                    {typeof zoneProps.EFF_TOT_I === 'number'
                      ? `${zoneProps.EFF_TOT_I.toLocaleString(locale)} (${zoneProps.PCT_INACT ?? 0} %)`
                      : naText}
                  </span>
                  <span className="text-[9px] text-[#9a3412] block mt-0.5">
                    {isFr ? 'à remplacer' : 'to replace'}
                  </span>
                </div>
              </div>
            </div>

            {/* Comparaison avec la Région et le District */}
            <div className="bg-[#f8fafc] p-3 rounded-2xl border border-[#cbd5e1] space-y-2.5">
              <div className="flex items-center gap-1.5 pb-1 border-b border-[#e2e8f0]">
                <Target className="w-3.5 h-3.5 text-[#006948]" />
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#0f172a]">
                  {isFr
                    ? 'Comparaisons de ratio (1 ASCp pour X hab.)'
                    : 'Ratio comparisons (1 CHWp per X pop.)'}
                </span>
              </div>

              {/* Ratio de la zone */}
              <div className="flex items-center justify-between text-xs font-mono bg-white p-2 rounded-xl border border-[#e2e8f0]">
                <span className="text-[#475569] font-medium">
                  {isFr ? `Zone (${zoneHierarchy?.name}) :` : `Zone (${zoneHierarchy?.name}):`}
                </span>
                <span className="font-bold text-[#0f172a]">
                  {typeof zoneProps.RATIO_ASCP === 'number'
                    ? (isFr
                        ? `1 ASCp pour ${Math.round(zoneProps.RATIO_ASCP).toLocaleString(locale)} hab.`
                        : `1 CHWp per ${Math.round(zoneProps.RATIO_ASCP).toLocaleString(locale)} pop.`)
                    : naText}
                </span>
              </div>

              {/* Ratio Région */}
              {parentRegionRatio !== null && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-mono bg-white p-2 rounded-xl border border-[#e2e8f0]">
                    <span className="text-[#475569]">
                      {isFr
                        ? `Région (${zoneHierarchy?.region}) :`
                        : `Region (${zoneHierarchy?.region}):`}
                    </span>
                    <span className="font-bold text-[#006948]">
                      {isFr
                        ? `1 ASCp pour ${Math.round(parentRegionRatio).toLocaleString(locale)} hab.`
                        : `1 CHWp per ${Math.round(parentRegionRatio).toLocaleString(locale)} pop.`}
                    </span>
                  </div>

                  {typeof zoneProps.RATIO_ASCP === 'number' && (
                    <div className="text-[10px] font-mono text-[#64748b] px-1">
                      {zoneProps.RATIO_ASCP > parentRegionRatio ? (
                        <span className="text-[#ea580c]">
                          {isFr
                            ? `Charge plus lourde (+${Math.round(((zoneProps.RATIO_ASCP - parentRegionRatio) / parentRegionRatio) * 100)} %) que la région`
                            : `Heavier burden (+${Math.round(((zoneProps.RATIO_ASCP - parentRegionRatio) / parentRegionRatio) * 100)} %) than the region`}
                        </span>
                      ) : (
                        <span className="text-[#16a34a]">
                          {isFr
                            ? `Couverture plus favorable (-${Math.round(((parentRegionRatio - zoneProps.RATIO_ASCP) / parentRegionRatio) * 100)} %) que la région`
                            : `Better coverage (-${Math.round(((parentRegionRatio - zoneProps.RATIO_ASCP) / parentRegionRatio) * 100)} %) than the region`}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Ratio District (pour les aires de santé) */}
              {level === 'aires_sante' && parentDistrictRatio !== null && (
                <div className="space-y-1 pt-1 border-t border-[#e2e8f0]">
                  <div className="flex items-center justify-between text-xs font-mono bg-white p-2 rounded-xl border border-[#e2e8f0]">
                    <span className="text-[#475569]">
                      {isFr
                        ? `District (${zoneHierarchy?.district}) :`
                        : `District (${zoneHierarchy?.district}):`}
                    </span>
                    <span className="font-bold text-[#0284c7]">
                      {isFr
                        ? `1 ASCp pour ${Math.round(parentDistrictRatio).toLocaleString(locale)} hab.`
                        : `1 CHWp per ${Math.round(parentDistrictRatio).toLocaleString(locale)} pop.`}
                    </span>
                  </div>

                  {typeof zoneProps.RATIO_ASCP === 'number' && (
                    <div className="text-[10px] font-mono text-[#64748b] px-1">
                      {zoneProps.RATIO_ASCP > parentDistrictRatio ? (
                        <span className="text-[#ea580c]">
                          {isFr
                            ? `Charge plus lourde (+${Math.round(((zoneProps.RATIO_ASCP - parentDistrictRatio) / parentDistrictRatio) * 100)} %) que le district`
                            : `Heavier burden (+${Math.round(((zoneProps.RATIO_ASCP - parentDistrictRatio) / parentDistrictRatio) * 100)} %) than the district`}
                        </span>
                      ) : (
                        <span className="text-[#16a34a]">
                          {isFr
                            ? `Couverture plus favorable (-${Math.round(((parentDistrictRatio - zoneProps.RATIO_ASCP) / parentDistrictRatio) * 100)} %) que le district`
                            : `Better coverage (-${Math.round(((parentDistrictRatio - zoneProps.RATIO_ASCP) / parentDistrictRatio) * 100)} %) than the district`}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Graphique 2 restreint à la zone : Composition des ASC actifs */}
            <div className="bg-white p-3 rounded-2xl border border-[#cbd5e1] space-y-2">
              <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#64748b] block">
                {isFr
                  ? `Composition des ASC actifs (${zoneProps.EFF_TOT_A ?? 0})`
                  : `Active CHW composition (${zoneProps.EFF_TOT_A ?? 0})`}
              </span>
              <div className="space-y-1.5 pt-1">
                {zoneCategoryComposition.map((cat) => {
                  const pct = maxZoneCatVal > 0 ? (cat.value / maxZoneCatVal) * 100 : 0;
                  const catLabel = isFr ? cat.label : ((cat as any).labelEn || cat.label);
                  return (
                    <div key={cat.field} className="space-y-0.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-[#475569] truncate pr-2 font-medium" title={catLabel}>
                          {catLabel}
                        </span>
                        <span className="font-bold font-mono text-[#0f172a] shrink-0">
                          {cat.value.toLocaleString(locale)}
                        </span>
                      </div>
                      <div className="w-full h-2 bg-[#f1f5f9] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: cat.color,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          /* ======================================================== */
          /* MODE 1 : AUCUNE ZONE SÉLECTIONNÉE (RÉSUMÉ)              */
          /* ======================================================== */
          <div className="space-y-4">

            {/* Sélecteur de Région */}
            <div className="bg-white p-2.5 rounded-2xl border border-[#cbd5e1] space-y-2 shadow-2xs">
              <label className="text-[10px] font-mono uppercase font-bold text-[#64748b] flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Filter className="w-3 h-3 text-[#006948]" />
                  <span>{isFr ? 'Filtrer par région' : 'Filter by region'}</span>
                </span>
                {selectedRegion && (
                  <button
                    type="button"
                    onClick={() => {
                      onSelectRegion(null);
                      if (selectedSubdivision) onSelectSubdivision(null);
                    }}
                    className="text-[#dc2626] hover:underline normal-case text-[10px]"
                  >
                    {isFr ? 'Effacer le filtre' : 'Clear filter'}
                  </button>
                )}
              </label>
              <select
                value={selectedRegion || ''}
                onChange={(e) => {
                  onSelectRegion(e.target.value ? e.target.value : null);
                  if (selectedSubdivision) onSelectSubdivision(null);
                }}
                className="w-full bg-[#f8fafc] border border-[#cbd5e1] text-[#0f172a] text-xs font-mono font-semibold rounded-xl px-2.5 py-1.5 focus:ring-1 focus:ring-[#006948] focus:outline-none"
              >
                <option value="">
                  {isFr ? 'Toutes les régions (National)' : 'All regions (National)'}
                </option>
                {COVERAGE_CONFIG.REGIONS_LIST.map((reg) => (
                  <option key={reg} value={reg}>
                    {reg}
                  </option>
                ))}
              </select>

              {/* Badge d'activation Département / District sélectionné */}
              {selectedSubdivision && (
                <div className="flex items-center justify-between bg-[#f0fdf4] border border-[#bbf7d0] px-2.5 py-1.5 rounded-xl font-mono text-xs">
                  <span className="text-[#006948] font-bold flex items-center gap-1.5 truncate">
                    <span>
                      {selectedSubdivision.type === 'district'
                        ? (isFr ? '🏥 District' : '🏥 District')
                        : (isFr ? '🏢 Dép.' : '🏢 Dept.')}{' '}:
                    </span>
                    <strong className="text-[#0f172a] truncate">{selectedSubdivision.name}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => onSelectSubdivision(null)}
                    className="text-[#dc2626] hover:underline text-[10px] font-bold shrink-0 ml-1 cursor-pointer"
                  >
                    {isFr ? '✕ Retirer' : '✕ Remove'}
                  </button>
                </div>
              )}
            </div>

            {/* Chiffres clés du Territoire */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase font-bold text-[#64748b] tracking-wider truncate pr-2">
                  {isFr ? 'Chiffres clés' : 'Key figures'}{' '}
                  ({selectedSubdivision
                    ? (selectedSubdivision.type === 'district'
                        ? `${isFr ? 'District' : 'District'} : ${selectedSubdivision.name}`
                        : `${isFr ? 'Dép.' : 'Dept.'} : ${selectedSubdivision.name}`)
                    : (selectedRegion || (isFr ? 'Cameroun' : 'Cameroon'))})
                </span>
                <span className="text-[9px] font-mono text-[#94a3b8] shrink-0">
                  {isFr ? 'Base : aires de santé' : 'Base: health areas'}
                </span>
              </div>

              {/* Grille 3 blocs effectifs */}
              <div className="grid grid-cols-3 gap-1.5 font-mono">
                {/* Total Actifs */}
                <div className="bg-[#f0f9ff] border border-[#bae6fd] p-2 rounded-xl text-center">
                  <span className="text-[9px] text-[#0369a1] block">
                    {isFr ? 'Total actifs' : 'Total active'}
                  </span>
                  <span className="font-bold text-xs sm:text-sm text-[#0284c7]">
                    {territoryTotals.totActifs.toLocaleString(locale)}
                  </span>
                </div>

                {/* Total ASCp */}
                <div className="bg-[#f0fdf4] border border-[#bbf7d0] p-2 rounded-xl text-center">
                  <span className="text-[9px] text-[#166534] block">
                    {isFr ? 'ASCp actifs' : 'Active CHWp'}
                  </span>
                  <span className="font-bold text-xs sm:text-sm text-[#006948]">
                    {territoryTotals.totAscp.toLocaleString(locale)}
                  </span>
                </div>

                {/* Total Inactifs */}
                <div className="bg-[#fff7ed] border border-[#fed7aa] p-2 rounded-xl text-center">
                  <span className="text-[9px] text-[#9a3412] block">
                    {isFr ? 'ASC inactifs' : 'Inactive CHWs'}
                  </span>
                  <span className="font-bold text-xs sm:text-sm text-[#c2410c]">
                    {territoryTotals.totInact.toLocaleString(locale)}
                  </span>
                </div>
              </div>

              {/* Blocs Zones Sous-couvertes & Population concernée */}
              <div className="bg-[#fef2f2] border border-[#fecdd3] p-3 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-[#be123c] flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 text-[#e11d48]" />
                    <span>{isFr ? 'Déficit de couverture' : 'Coverage deficit'}</span>
                  </span>
                  <span className="text-[10px] font-mono font-bold text-[#991b1b] bg-[#fee2e2] px-2 py-0.5 rounded-full">
                    {sousCouvertesSummary.pctSousZones.toFixed(1)} % {isFr ? `des ${levelLabels[level]}` : `of ${levelLabels[level]}`}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs font-mono pt-1 border-t border-[#fecdd3]">
                  <div>
                    <span className="text-[9px] text-[#991b1b] block">
                      {isFr ? 'Zones sous-couvertes :' : 'Under-covered zones:'}
                    </span>
                    <strong className="text-[#be123c] text-xs">
                      {sousCouvertesSummary.countSous.toLocaleString(locale)} / {sousCouvertesSummary.countZones.toLocaleString(locale)}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[9px] text-[#991b1b] block">
                      {isFr ? 'Population touchée :' : 'Affected population:'}
                    </span>
                    <strong className="text-[#be123c] text-xs">
                      {Math.round(sousCouvertesSummary.popSous).toLocaleString(locale)} {popUnit}
                    </strong>
                    <span className="text-[9px] text-[#64748b] block">
                      ({sousCouvertesSummary.pctPopSous.toFixed(1)} % {isFr ? 'de la pop.' : 'of pop.'})
                    </span>
                  </div>
                </div>

                <div className="text-[9px] text-[#9f1239] leading-tight bg-white/70 p-1.5 rounded-lg border border-[#fecdd3]/60">
                  {isFr
                    ? <>Regroupe les classes <em>sous_couverte</em> et <em>aucun_ascp_actif</em>.</>
                    : <>Combines <em>under_covered</em> and <em>no_active_chwp</em> classes.</>}
                </div>
              </div>
            </div>

            {/* GRAPHIQUE 1 : Répartition par classe de couverture */}
            <div className="bg-white p-3 rounded-2xl border border-[#cbd5e1] space-y-2 shadow-2xs">
              <div className="flex items-center justify-between pb-1.5 border-b border-[#e2e8f0]">
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#0f172a]">
                  {isFr
                    ? `Classes de couverture (${levelLabels[level]})`
                    : `Coverage classes (${levelLabels[level]})`}
                </span>

                {/* Bascule Zones / Population */}
                <div className="flex bg-[#f1f5f9] p-0.5 rounded-lg text-[10px] font-mono font-semibold">
                  <button
                    type="button"
                    onClick={() => setChart1Metric('zones')}
                    className={`px-1.5 py-0.5 rounded-md transition-all ${
                      chart1Metric === 'zones'
                        ? 'bg-white text-[#006948] shadow-xs'
                        : 'text-[#64748b] hover:text-[#0f172a]'
                    }`}
                  >
                    {isFr ? 'Zones' : 'Zones'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setChart1Metric('population')}
                    className={`px-1.5 py-0.5 rounded-md transition-all ${
                      chart1Metric === 'population'
                        ? 'bg-white text-[#006948] shadow-xs'
                        : 'text-[#64748b] hover:text-[#0f172a]'
                    }`}
                  >
                    {isFr ? 'Pop.' : 'Pop.'}
                  </button>
                </div>
              </div>

              {/* Barres horizontales de classes */}
              <div className="space-y-2 pt-1">
                {classeDistribution.map((item) => {
                  const pct = chart1Metric === 'zones' ? item.zonePct : item.popPct;
                  const labelVal =
                    chart1Metric === 'zones'
                      ? `${item.zones.toLocaleString(locale)} (${item.zonePct.toFixed(1)} %)`
                      : `${Math.round(item.population).toLocaleString(locale)} ${popUnit} (${item.popPct.toFixed(1)} %)`;
                  const shortLabel = isFr ? item.shortLabel : ((item as any).shortLabelEn || item.shortLabel);

                  return (
                    <div key={item.key} className="space-y-0.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-[#334155] font-medium flex items-center gap-1.5 truncate pr-2">
                          <span
                            className="w-2.5 h-2.5 rounded-sm shrink-0 border border-black/10"
                            style={{ backgroundColor: item.color }}
                          ></span>
                          <span className="truncate">{shortLabel}</span>
                        </span>
                        <span className="font-mono text-[10px] font-bold text-[#0f172a] shrink-0">
                          {labelVal}
                        </span>
                      </div>
                      <div className="w-full h-2 bg-[#f1f5f9] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: item.color,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* GRAPHIQUE 2 : Composition des ASC actifs par catégorie */}
            <div className="bg-white p-3 rounded-2xl border border-[#cbd5e1] space-y-2 shadow-2xs">
              <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#0f172a] block pb-1 border-b border-[#e2e8f0]">
                {isFr ? 'Composition des ASC actifs par catégorie' : 'Active CHW composition by category'}
              </span>

              <div className="space-y-2 pt-1">
                {COVERAGE_CONFIG.ASC_CATEGORIES.map((cat) => {
                  const val = territoryTotals.catSums[cat.field] || 0;
                  const pct = maxTerritoryCatVal > 0 ? (val / maxTerritoryCatVal) * 100 : 0;
                  const pctOfTotal = territoryTotals.totActifs > 0 ? (val / territoryTotals.totActifs) * 100 : 0;
                  const catLabel = isFr ? cat.label : ((cat as any).labelEn || cat.label);

                  return (
                    <div key={cat.field} className="space-y-0.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-[#334155] truncate pr-2 font-medium" title={catLabel}>
                          {catLabel}
                        </span>
                        <span className="font-bold font-mono text-[#0f172a] shrink-0">
                          {val.toLocaleString(locale)}{' '}
                          <span className="text-[#64748b] font-normal text-[10px]">
                            ({pctOfTotal.toFixed(1)} %)
                          </span>
                        </span>
                      </div>
                      <div className="w-full h-2 bg-[#f1f5f9] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: cat.color,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* DEUX LISTES CLIQUABLES (TOP 10) */}
            <div className="bg-white rounded-2xl border border-[#cbd5e1] overflow-hidden shadow-2xs">
              {/* Onglets des listes */}
              <div className="grid grid-cols-2 border-b border-[#e2e8f0] bg-[#f8fafc] text-[11px] font-mono font-bold">
                <button
                  type="button"
                  onClick={() => setActiveListTab('under_covered')}
                  className={`py-2 px-2 text-center transition-all ${
                    activeListTab === 'under_covered'
                      ? 'bg-white text-[#dc2626] border-b-2 border-[#dc2626]'
                      : 'text-[#64748b] hover:bg-[#f1f5f9]'
                  }`}
                >
                  {isFr ? 'Plus sous-couvertes (10)' : 'Most under-covered (10)'}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveListTab('inactives')}
                  className={`py-2 px-2 text-center transition-all ${
                    activeListTab === 'inactives'
                      ? 'bg-white text-[#c2410c] border-b-2 border-[#c2410c]'
                      : 'text-[#64748b] hover:bg-[#f1f5f9]'
                  }`}
                >
                  {isFr ? "Plus d'inactifs (10)" : 'Most inactive (10)'}
                </button>
              </div>

              {/* Contenu Liste 1 : Zones les plus sous-couvertes */}
              {activeListTab === 'under_covered' && (
                <div className="divide-y divide-[#f1f5f9] max-h-72 overflow-y-auto">
                  {topSousCouvertes.length === 0 ? (
                    <div className="p-3 text-center text-[#64748b] font-mono text-[11px]">
                      {isFr ? 'Aucune zone sous-couverte identifiée.' : 'No under-covered zones identified.'}
                    </div>
                  ) : (
                    topSousCouvertes.map((f, idx) => {
                      const p = f.properties || {};
                      const name = getFeatureNameForLevel(level, p);
                      const parentDist = level === 'aires_sante' && p.District_S ? ` (${p.District_S})` : '';
                      const ascp = typeof p.EFF_ASCP_A === 'number' ? p.EFF_ASCP_A : 0;
                      const pop = getPopulationForLevel(level, p) || 0;
                      const popStr = Math.round(pop).toLocaleString(locale);
                      const ratio = p.RATIO_ASCP;
                      const isZero = p.CLASSE_CVG === 'aucun_ascp_actif' || ascp === 0;

                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => onSelectFeatureFromList(f)}
                          className="w-full text-left p-2.5 hover:bg-[#fef2f2] transition-colors flex items-center justify-between gap-2 group"
                        >
                          <div className="flex items-start gap-2 min-w-0">
                            <span className="font-mono font-bold text-[10px] text-[#94a3b8] w-4 shrink-0 pt-0.5">
                              {idx + 1}.
                            </span>
                            <div className="min-w-0">
                              <span className="font-bold text-xs text-[#0f172a] block truncate group-hover:text-[#dc2626]">
                                {name}{parentDist}
                              </span>
                              <span className="text-[10px] font-mono text-[#64748b] block mt-0.5">
                                {ascp.toLocaleString(locale)} {isFr ? `ASCp pour ${popStr} hab.` : `CHWp per ${popStr} pop.`}
                              </span>
                            </div>
                          </div>

                          <div className="shrink-0 text-right font-mono">
                            {isZero ? (
                              <span className="text-[9px] bg-[#fee2e2] text-[#991b1b] font-bold px-1.5 py-0.5 rounded">
                                0 {isFr ? 'ASCp' : 'CHWp'}
                              </span>
                            ) : (
                              <span className="text-[10px] text-[#dc2626] font-bold">
                                {isFr
                                  ? `1 ASCp / ${Math.round(ratio).toLocaleString(locale)} hab.`
                                  : `1 CHWp / ${Math.round(ratio).toLocaleString(locale)} pop.`}
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              )}

              {/* Contenu Liste 2 : Zones avec le plus d'ASC inactifs */}
              {activeListTab === 'inactives' && (
                <div className="divide-y divide-[#f1f5f9] max-h-72 overflow-y-auto">
                  {topInactifs.length === 0 ? (
                    <div className="p-3 text-center text-[#64748b] font-mono text-[11px]">
                      {isFr ? 'Aucune zone avec inactifs.' : 'No zones with inactive CHWs.'}
                    </div>
                  ) : (
                    topInactifs.map((f, idx) => {
                      const p = f.properties || {};
                      const name = getFeatureNameForLevel(level, p);
                      const parentDist = level === 'aires_sante' && p.District_S ? ` (${p.District_S})` : '';
                      const inact = p.EFF_TOT_I || 0;
                      const pct = p.PCT_INACT;

                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => onSelectFeatureFromList(f)}
                          className="w-full text-left p-2.5 hover:bg-[#fff7ed] transition-colors flex items-center justify-between gap-2 group"
                        >
                          <div className="flex items-start gap-2 min-w-0">
                            <span className="font-mono font-bold text-[10px] text-[#94a3b8] w-4 shrink-0 pt-0.5">
                              {idx + 1}.
                            </span>
                            <div className="min-w-0">
                              <span className="font-bold text-xs text-[#0f172a] block truncate group-hover:text-[#c2410c]">
                                {name}{parentDist}
                              </span>
                              <span className="text-[10px] font-mono text-[#64748b] block mt-0.5">
                                {inact.toLocaleString(locale)} {isFr ? 'ASC inactifs' : 'inactive CHWs'}
                              </span>
                            </div>
                          </div>

                          <div className="shrink-0 text-right font-mono">
                            <span className="text-[10px] bg-[#ffedd5] text-[#9a3412] font-bold px-1.5 py-0.5 rounded">
                              {pct !== undefined && pct !== null ? `${pct} %` : 'N/D'}
                            </span>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 3. PIED DE PAGE AVEC MENTION SOURCE */}
      <div className="bg-[#f8fafc] border-t border-[#e2e8f0] px-4 py-2 font-mono text-[9px] text-[#94a3b8] shrink-0 leading-tight">
        {isFr
          ? `Source : ${COVERAGE_CONFIG.SOURCES.MAP_SOURCE}`
          : `Source: ${(COVERAGE_CONFIG.SOURCES as any).MAP_SOURCE_EN || COVERAGE_CONFIG.SOURCES.MAP_SOURCE}`}
      </div>
    </div>
  );
};
