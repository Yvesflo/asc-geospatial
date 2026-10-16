import React, { useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  BarChart3,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Target,
  ArrowLeft,
  Users,
  MapPin,
  Activity,
} from 'lucide-react';
import { SubdivisionLevel } from '../types';
import { getFeatureNameForLevel } from '../config/coverageConfig';

interface HierarchyItem {
  levelLabel: string;
  name: string;
  popTotal: number;
  popCoveredPercent: number;
}

interface TerritoryStats {
  popTotal: number;
  popCovered: number;
  popIsolated: number;
  popCoveredPercent: number;
  popIsolatedPercent: number;
  zonesCount: number;
  subtitle?: string;
}

interface CiblageAscSidePanelProps {
  isOpen: boolean;
  onToggleOpen: () => void;
  level: SubdivisionLevel;
  language: 'fr' | 'en';
  selectedFeature: any | null;
  onClearSelectedFeature: () => void;
  territorialFeatures: any[];
  upperTiersHierarchy: HierarchyItem[];
  territoryStats: TerritoryStats | null;
}

const getColor = (pct: number): string => {
  if (pct >= 90) return '#006948';
  if (pct >= 80) return '#22c55e';
  if (pct >= 65) return '#eab308';
  if (pct >= 50) return '#f97316';
  return '#dc2626';
};

export const CiblageAscSidePanel: React.FC<CiblageAscSidePanelProps> = ({
  isOpen,
  onToggleOpen,
  level,
  language,
  selectedFeature,
  onClearSelectedFeature,
  territorialFeatures,
  upperTiersHierarchy,
  territoryStats,
}) => {
  const isFr = language === 'fr';
  const locale = isFr ? 'fr-FR' : 'en-US';

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

  const levelSingular: Record<SubdivisionLevel, string> = isFr
    ? {
        regions: 'Région',
        departements: 'Département',
        arrondissements: 'Arrondissement',
        districts_sante: 'District de Santé',
        aires_sante: 'Aire de Santé',
      }
    : {
        regions: 'Region',
        departements: 'Department',
        arrondissements: 'Sub-district',
        districts_sante: 'Health District',
        aires_sante: 'Health Area',
      };

  // Priority zones: below 80% coverage, sorted worst first
  const priorityZones = useMemo(() => {
    return territorialFeatures
      .filter((f) => typeof f.properties?.popCoveredPercent === 'number' && f.properties.popCoveredPercent < 80)
      .sort((a, b) => (a.properties.popCoveredPercent || 0) - (b.properties.popCoveredPercent || 0))
      .slice(0, 12);
  }, [territorialFeatures]);

  // Coverage class distribution
  const coverageDistrib = useMemo(() => {
    const classes = [
      { min: 90, label: isFr ? '≥ 90 %' : '≥ 90%', color: '#006948' },
      { min: 80, label: isFr ? '80–89 %' : '80–89%', color: '#22c55e' },
      { min: 65, label: isFr ? '65–79 %' : '65–79%', color: '#eab308' },
      { min: 50, label: isFr ? '50–64 %' : '50–64%', color: '#f97316' },
      { min: 0,  label: isFr ? '< 50 %' : '< 50%',  color: '#dc2626' },
    ];
    const total = territorialFeatures.filter((f) => typeof f.properties?.popCoveredPercent === 'number').length;
    return classes.map((cls, i) => {
      const next = classes[i - 1];
      const count = territorialFeatures.filter((f) => {
        const pct = f.properties?.popCoveredPercent;
        if (typeof pct !== 'number') return false;
        if (next) return pct >= cls.min && pct < next.min;
        return pct >= cls.min;
      }).length;
      return { ...cls, count, pct: total > 0 ? (count / total) * 100 : 0 };
    });
  }, [territorialFeatures, isFr]);

  if (!isOpen) {
    return (
      <button
        type="button"
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

      {/* Header */}
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

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 font-sans">

        {/* ── MODE 2: ZONE SÉLECTIONNÉE ── */}
        {selectedFeature ? (
          <div className="space-y-4">
            {/* Back button */}
            <button
              type="button"
              onClick={onClearSelectedFeature}
              className="flex items-center gap-1.5 text-[11px] font-mono text-[#475569] hover:text-[#006948] transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              {isFr ? 'Retour à la synthèse' : 'Back to summary'}
            </button>

            {/* Zone identity */}
            <div className="bg-gradient-to-br from-[#f0fdf4] to-[#f8fafc] rounded-2xl p-3.5 border border-[#86efac]/50 space-y-1">
              <span className="text-[10px] font-bold uppercase text-[#006948] tracking-wide block">
                {levelSingular[level]}
              </span>
              <h3 className="font-bold text-base text-[#0f172a] leading-tight">
                {getFeatureNameForLevel(level, selectedFeature)}
              </h3>
              {(selectedFeature.region || selectedFeature.Nom_Region) && (
                <span className="text-[10px] text-[#64748b] flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {selectedFeature.region || selectedFeature.Nom_Region}
                  {selectedFeature.district || selectedFeature.District_S
                    ? ` • ${selectedFeature.district || selectedFeature.District_S}`
                    : ''}
                </span>
              )}
            </div>

            {/* Coverage KPI gauge */}
            <div className="bg-[#f8fafc] rounded-2xl p-3.5 border border-[#e2e8f0] space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-[#475569]">
                  {isFr ? 'Couverture FOSA (< 5 km)' : 'HF Coverage (< 5 km)'}
                </span>
                <span className="font-bold text-lg" style={{ color: getColor(selectedFeature.popCoveredPercent || 0) }}>
                  {(selectedFeature.popCoveredPercent || 0).toFixed(1)}%
                </span>
              </div>
              <div className="h-3 w-full bg-[#e2e8f0] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(selectedFeature.popCoveredPercent || 0, 100)}%`,
                    backgroundColor: getColor(selectedFeature.popCoveredPercent || 0),
                  }}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] font-mono text-[#64748b]">
                <span>0 %</span>
                <span className="text-[#16a34a] font-bold">{isFr ? 'Cible OMS : 80 %' : 'WHO target: 80%'}</span>
                <span>100 %</span>
              </div>
              {/* WHO target marker */}
              <div className="relative h-1 -mt-1">
                <div className="absolute top-0 w-0.5 h-3 bg-[#16a34a] rounded" style={{ left: '80%', transform: 'translateX(-50%)' }} />
              </div>
            </div>

            {/* Pop stats */}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-[#f0fdf4] p-2.5 rounded-xl border border-[#86efac]/60">
                <span className="text-[10px] text-[#166534] font-semibold block">
                  {isFr ? 'Population totale' : 'Total population'}
                </span>
                <span className="font-bold text-sm text-[#0f172a]">
                  {Math.round(selectedFeature.popTotal || 0).toLocaleString(locale)}
                </span>
                <span className="text-[10px] text-[#64748b]">{isFr ? 'hab.' : 'pop.'}</span>
              </div>
              <div className="bg-[#fff1f2] p-2.5 rounded-xl border border-[#fecdd3]">
                <span className="text-[10px] text-[#be123c] font-semibold block">
                  {isFr ? 'Pop. isolée (> 5 km)' : 'Isolated pop. (> 5 km)'}
                </span>
                <span className="font-bold text-sm text-[#e11d48]">
                  {Math.round(
                    (selectedFeature.popTotal || 0) * (1 - (selectedFeature.popCoveredPercent || 0) / 100)
                  ).toLocaleString(locale)}
                </span>
                <span className="text-[10px] text-[#be123c]">{isFr ? 'hab.' : 'pop.'}</span>
              </div>
              <div className="bg-[#f8fafc] p-2.5 rounded-xl border border-[#e2e8f0] col-span-2">
                <span className="text-[10px] text-[#64748b] font-semibold block">
                  {isFr ? 'Pop. couverte (< 5 km)' : 'Covered pop. (< 5 km)'}
                </span>
                <span className="font-bold text-sm" style={{ color: getColor(selectedFeature.popCoveredPercent || 0) }}>
                  {Math.round(
                    (selectedFeature.popTotal || 0) * (selectedFeature.popCoveredPercent || 0) / 100
                  ).toLocaleString(locale)}
                </span>
                <span className="text-[10px] text-[#64748b] ml-1">{isFr ? 'hab.' : 'pop.'}</span>
              </div>
            </div>

            {/* Status badge */}
            <div className={`rounded-xl p-2.5 text-[11px] font-semibold flex items-center gap-2 ${
              (selectedFeature.popCoveredPercent || 0) >= 80
                ? 'bg-[#f0fdf4] text-[#166534] border border-[#86efac]'
                : 'bg-[#fff1f2] text-[#be123c] border border-[#fecdd3]'
            }`}>
              {(selectedFeature.popCoveredPercent || 0) >= 80
                ? <CheckCircle2 className="w-4 h-4 shrink-0" />
                : <AlertTriangle className="w-4 h-4 shrink-0" />}
              <span>
                {(selectedFeature.popCoveredPercent || 0) >= 80
                  ? (isFr ? 'Couverture conforme (≥ 80 %)' : 'Compliant coverage (≥ 80%)')
                  : (isFr ? 'Ciblage prioritaire ASC requis' : 'Priority CHW deployment required')}
              </span>
            </div>

            {/* Upper tiers hierarchy */}
            {upperTiersHierarchy.length > 0 && (
              <div className="bg-gradient-to-br from-[#f8fafc] to-[#f0fdf4] rounded-2xl p-3 border border-[#86efac]/50 space-y-2">
                <div className="flex items-center gap-1.5 pb-1.5 border-b border-[#cbd5e1]/50">
                  <TrendingUp className="w-3.5 h-3.5 text-[#16a34a]" />
                  <span className="text-[10px] font-bold uppercase text-[#166534]">
                    {isFr ? 'Désagrégation paliers supérieurs' : 'Upper-tier disaggregation'}
                  </span>
                </div>
                <div className="space-y-1.5">
                  {upperTiersHierarchy.map((tier, idx) => (
                    <div key={idx} className="bg-white/90 rounded-xl border border-[#e2e8f0] p-2 flex items-center justify-between gap-2 shadow-2xs">
                      <div className="min-w-0">
                        <span className="text-[9px] font-bold uppercase text-[#64748b] block">{tier.levelLabel}</span>
                        <span className="font-semibold text-[11px] text-[#0f172a] truncate block">{tier.name}</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <div className="text-right">
                          <span className="font-bold text-sm" style={{ color: getColor(tier.popCoveredPercent) }}>
                            {tier.popCoveredPercent.toFixed(1)}%
                          </span>
                          <span className="text-[9px] text-[#64748b] block">{isFr ? 'couvert' : 'covered'}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

        ) : (
          /* ── MODE 1: SYNTHÈSE TERRITOIRE ── */
          <div className="space-y-4">

            {/* Territory KPIs */}
            {territoryStats && (
              <div className="space-y-2.5">
                {/* Context subtitle */}
                {territoryStats.subtitle && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#f0fdf4] rounded-xl border border-[#86efac]/50">
                    <MapPin className="w-3 h-3 text-[#006948] shrink-0" />
                    <span className="text-[10px] font-mono font-bold text-[#006948] truncate">{territoryStats.subtitle}</span>
                  </div>
                )}

                {/* Population couverte */}
                <div className="bg-[#f0fdf4] border border-[#86efac]/80 rounded-2xl p-2.5 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-[#166534] font-semibold">{isFr ? 'Population couverte (< 5 km)' : 'Covered population (< 5 km)'}</span>
                    <span className="font-bold text-sm text-[#006948]">{territoryStats.popCoveredPercent.toFixed(2)}%</span>
                  </div>
                  <div className="h-2.5 w-full bg-[#dcfce7] rounded-full overflow-hidden relative">
                    <div className="h-full bg-[#006948] rounded-full transition-all duration-500" style={{ width: `${Math.min(territoryStats.popCoveredPercent, 100)}%` }} />
                    <div className="absolute top-0 bottom-0 w-0.5 bg-[#16a34a]" style={{ left: '80%' }} title="Cible OMS 80%" />
                  </div>
                  <div className="flex items-center justify-between text-[10px] font-mono text-[#166534] font-semibold">
                    <span>{Math.round(territoryStats.popCovered).toLocaleString(locale)} {isFr ? 'hab.' : 'pop.'}</span>
                    <span>{isFr ? 'Cible OMS : ≥ 80 %' : 'WHO target: ≥ 80%'}</span>
                  </div>
                </div>

                {/* Besoin réel */}
                <div className="bg-[#fff1f2] border border-[#fecdd3] rounded-2xl p-2.5 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-[#be123c] font-semibold">{isFr ? 'Besoin réel ASC (> 5 km)' : 'Real CHW need (> 5 km)'}</span>
                    <span className="font-bold text-sm text-[#e11d48]">{territoryStats.popIsolatedPercent.toFixed(2)}%</span>
                  </div>
                  <div className="h-2.5 w-full bg-[#ffe4e6] rounded-full overflow-hidden">
                    <div className="h-full bg-[#e11d48] rounded-full transition-all duration-500" style={{ width: `${Math.min(territoryStats.popIsolatedPercent, 100)}%` }} />
                  </div>
                  <div className="flex items-center justify-between text-[10px] font-mono text-[#be123c] font-semibold">
                    <span>{Math.round(territoryStats.popIsolated).toLocaleString(locale)} {isFr ? 'hab.' : 'pop.'}</span>
                    <span>{isFr ? 'À couvrir par ASC' : 'To cover by CHWs'}</span>
                  </div>
                </div>

                {/* Pop totale + zones */}
                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  <div className="bg-[#f8fafc] border border-[#e2e8f0] p-2 rounded-xl">
                    <span className="text-[#64748b] block">{isFr ? 'Population totale' : 'Total population'}</span>
                    <span className="font-bold text-[#0f172a] text-[11px]">{Math.round(territoryStats.popTotal).toLocaleString(locale)} {isFr ? 'hab.' : 'pop.'}</span>
                  </div>
                  <div className="bg-[#f8fafc] border border-[#e2e8f0] p-2 rounded-xl">
                    <span className="text-[#64748b] block">{isFr ? 'Zones incluses' : 'Included zones'}</span>
                    <span className="font-bold text-[#006948] text-[11px]">{territoryStats.zonesCount} {levelLabels[level]}</span>
                  </div>
                </div>

                {/* Source */}
                <div className="p-2 rounded-xl bg-[#f8fafc] border border-[#e2e8f0] text-[9px] text-[#64748b] leading-tight">
                  {isFr
                    ? "Source : Analyse d'accessibilité géographique aux soins • Base FOSA MINSANTE 2023 • Raster 100m WorldPop"
                    : 'Source: Geographic healthcare accessibility analysis • MINSANTE HF Database 2023 • WorldPop 100m'}
                </div>
              </div>
            )}

            {/* Coverage class distribution */}
            <div className="bg-[#f8fafc] rounded-2xl p-3 border border-[#e2e8f0] space-y-2">
              <div className="flex items-center gap-2 pb-1.5 border-b border-[#e2e8f0]">
                <BarChart3 className="w-3.5 h-3.5 text-[#006948]" />
                <span className="font-bold text-xs text-[#0f172a]">
                  {isFr ? 'Distribution par classe' : 'Class distribution'}
                </span>
                <span className="text-[10px] font-mono text-[#64748b] ml-auto">{territorialFeatures.length} {isFr ? 'zones' : 'zones'}</span>
              </div>
              <div className="space-y-1.5">
                {coverageDistrib.map((cls, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: cls.color }} />
                    <span className="text-[11px] text-[#334155] flex-1 truncate">{cls.label}</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <div className="w-16 h-1.5 bg-[#e2e8f0] rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${cls.pct}%`, backgroundColor: cls.color }} />
                      </div>
                      <span className="text-[10px] font-mono text-[#475569] w-5 text-right">{cls.count}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Priority zones list */}
            {priorityZones.length > 0 && (
              <div className="bg-[#fff7ed] rounded-2xl p-3 border border-[#fed7aa] space-y-2">
                <div className="flex items-center gap-2 pb-1.5 border-b border-[#fed7aa]">
                  <Target className="w-3.5 h-3.5 text-[#ea580c]" />
                  <span className="font-bold text-xs text-[#9a3412]">
                    {isFr ? 'Zones prioritaires (< 80 %)' : 'Priority zones (< 80%)'}
                  </span>
                  <span className="text-[10px] font-mono text-[#ea580c] ml-auto font-bold">{priorityZones.length}</span>
                </div>
                <div className="space-y-1.5 max-h-64 overflow-y-auto pr-0.5">
                  {priorityZones.map((f, i) => {
                    const p = f.properties || {};
                    const name = getFeatureNameForLevel(level, p);
                    const pct = p.popCoveredPercent || 0;
                    const pop = Math.round(p.popTotal || 0);
                    return (
                      <div key={i} className="bg-white/80 rounded-xl border border-[#fed7aa]/60 p-2 flex items-center justify-between gap-2 shadow-2xs">
                        <div className="min-w-0">
                          <span className="font-semibold text-[11px] text-[#0f172a] block truncate">{name}</span>
                          <span className="text-[10px] font-mono text-[#64748b]">{pop.toLocaleString(locale)} {isFr ? 'hab.' : 'pop.'}</span>
                        </div>
                        <span className="font-bold text-sm shrink-0" style={{ color: getColor(pct) }}>
                          {pct.toFixed(1)}%
                        </span>
                      </div>
                    );
                  })}
                </div>
                {priorityZones.length === 12 && (
                  <p className="text-[10px] font-mono text-[#ea580c] text-center pt-1">
                    {isFr ? '(Affichage limité aux 12 premières)' : '(Showing top 12 only)'}
                  </p>
                )}
              </div>
            )}

            {priorityZones.length === 0 && territorialFeatures.length > 0 && (
              <div className="bg-[#f0fdf4] rounded-2xl p-3 border border-[#86efac] flex items-center gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-[#16a34a] shrink-0" />
                <p className="text-[11px] font-semibold text-[#166534]">
                  {isFr
                    ? 'Toutes les zones atteignent la cible OMS (≥ 80 %).'
                    : 'All zones meet the WHO target (≥ 80%).'}
                </p>
              </div>
            )}

            {/* Hint */}
            <p className="text-[10px] font-mono text-[#94a3b8] text-center pt-1">
              {isFr ? 'Cliquez sur une zone pour afficher sa fiche.' : 'Click a zone to view its profile.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
