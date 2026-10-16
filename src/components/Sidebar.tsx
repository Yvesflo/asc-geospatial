import React, { useState } from 'react';
import {
  Activity,
  ChevronLeft,
  ChevronRight,
  Building2,
  Users,
  Filter,
  Globe2,
  Sliders,
  Eye,
  EyeOff,
  Layers,
  ShieldCheck,
  BarChart3,
  BookOpen
} from 'lucide-react';
import { ActiveModule, Language, SubdivisionLevel, BasemapType, CoverageMapType } from '../types';
import { TRANSLATIONS } from '../data/mockGisData';
import { COVERAGE_CONFIG } from '../config/coverageConfig';

interface SidebarProps {
  activeModule: ActiveModule;
  setActiveModule: (mod: ActiveModule) => void;
  language: Language;
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  ciblageLevel?: SubdivisionLevel;
  setCiblageLevel?: (level: SubdivisionLevel) => void;
  ciblageBasemap?: BasemapType;
  setCiblageBasemap?: (bm: BasemapType) => void;
  ciblageThematicOpacity?: number;
  setCiblageThematicOpacity?: (val: number) => void;
  ciblageIsThematicVisible?: boolean;
  setCiblageIsThematicVisible?: (vis: boolean) => void;
  ciblageRasterOpacity?: number;
  setCiblageRasterOpacity?: (val: number) => void;
  ciblageIsRasterVisible?: boolean;
  setCiblageIsRasterVisible?: (vis: boolean) => void;
  coverageActiveMap?: CoverageMapType;
  onCoverageActiveMapChange?: (map: CoverageMapType) => void;
  coverageCategoryField?: string;
  onCoverageCategoryFieldChange?: (field: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeModule,
  setActiveModule,
  language,
  collapsed,
  setCollapsed,
  ciblageLevel = 'regions',
  setCiblageLevel,
  ciblageThematicOpacity = 0.85,
  setCiblageThematicOpacity,
  ciblageIsThematicVisible = true,
  setCiblageIsThematicVisible,
  ciblageRasterOpacity = 0.85,
  setCiblageRasterOpacity,
  ciblageIsRasterVisible = true,
  setCiblageIsRasterVisible,
  coverageActiveMap = 'map-1',
  onCoverageActiveMapChange,
  coverageCategoryField = COVERAGE_CONFIG.FIELDS.EFF_TOT_A,
  onCoverageCategoryFieldChange,
}) => {
  const t = TRANSLATIONS[language];
  const isFr = language === 'fr';
  const [ciblageCategory, setCiblageCategory] = useState<'sanitary' | 'administrative' | 'all'>('sanitary');

  const navItems = [
    {
      id: 'couverture-asc' as ActiveModule,
      label: t.navCouvertureAsc,
      description: t.navCouvertureAscDesc,
      icon: Users,
    },
    {
      id: 'ciblage-asc' as ActiveModule,
      label: t.navCiblageAsc,
      description: t.navCiblageAscDesc,
      icon: Activity,
    },
  ];

  return (
    <aside
      className={`fixed left-0 top-16 bottom-0 ${
        collapsed ? 'w-16' : 'w-72 sm:w-80'
      } bg-white border-r border-[#bccac0]/40 z-40 flex flex-col justify-between shadow-[0_2px_12px_rgba(0,0,0,0.03)] transition-all duration-300 select-none`}
    >
      <div className="flex flex-col flex-1 overflow-y-auto">
        {/* Deliverables Header Bar */}
        <div className="px-3 py-2.5 border-b border-[#bccac0]/20 flex items-center justify-between bg-[#f8fafc]">
          {!collapsed && (
            <span className="font-mono text-[11px] uppercase tracking-wider text-[#006948] font-bold flex items-center gap-1.5">
              <Globe2 className="w-3.5 h-3.5" />
              {t.modulesCarto}
            </span>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="text-[#6d7a72] hover:text-[#0f172a] p-1.5 rounded-lg hover:bg-white transition-colors ml-auto shadow-xs border border-transparent hover:border-[#cbd5e1] cursor-pointer"
            title={isFr ? (collapsed ? 'Développer le menu' : 'Réduire le menu') : (collapsed ? 'Expand menu' : 'Collapse menu')}
            type="button"
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Module Navigation */}
        <nav data-tour="sidebar-nav" className="p-2 space-y-1.5 border-b border-[#bccac0]/20">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeModule === item.id;
            return (
              <button
                key={item.id}
                data-tour={item.id === 'ciblage-asc' ? 'ciblage-tab' : item.id === 'couverture-asc' ? 'couverture-tab' : undefined}
                onClick={() => setActiveModule(item.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#006948] text-white font-semibold shadow-sm'
                    : 'text-[#334155] hover:bg-[#f1f5f9] hover:text-[#0f172a]'
                }`}
                title={collapsed ? `${item.label} • ${item.description}` : undefined}
                type="button"
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-[#006948]'}`} />
                {!collapsed && (
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-bold block truncate leading-snug">{item.label}</span>
                    {item.description && (
                      <span className={`text-[10px] block truncate font-mono mt-0.5 ${isActive ? 'text-white/80' : 'text-[#64748b]'}`}>
                        {item.description}
                      </span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </nav>

        {/* Dynamic Controls */}
        {!collapsed && (
          <div className="p-3 space-y-4">
            {/* 1. Territorial Disaggregation */}
            <div data-tour="level-selector" className="bg-[#f8fafc] border border-[#cbd5e1]/70 rounded-2xl p-3 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase font-bold text-[#475569] flex items-center gap-1.5">
                  <Filter className="w-3.5 h-3.5 text-[#006948]" />
                  <span>{t.territorialDisagg}</span>
                </span>
              </div>

              {/* Regions pivot */}
              <div>
                <button
                  onClick={() => setCiblageLevel && setCiblageLevel('regions')}
                  className={`w-full py-2 px-2.5 rounded-xl text-left font-semibold transition-all flex items-center justify-between cursor-pointer ${
                    ciblageLevel === 'regions'
                      ? 'bg-[#006948] text-white shadow-xs'
                      : 'bg-white hover:bg-[#f1f5f9] text-[#1e293b] border border-[#cbd5e1]'
                  }`}
                  type="button"
                >
                  <div className="flex items-center gap-2">
                    <Globe2 className={`w-4 h-4 shrink-0 ${ciblageLevel === 'regions' ? 'text-white' : 'text-[#006948]'}`} />
                    <div>
                      <span className="text-xs font-bold block">{t.regions10}</span>
                      <span className={`text-[10px] font-mono block ${ciblageLevel === 'regions' ? 'text-white/80' : 'text-[#64748b]'}`}>
                        {t.nationalBase}
                      </span>
                    </div>
                  </div>
                  {ciblageLevel === 'regions' && <span className="w-2 h-2 rounded-full bg-white shrink-0"></span>}
                </button>
              </div>

              {/* Category toggle */}
              <div className="space-y-2 pt-1 border-t border-[#e2e8f0]">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase font-bold text-[#64748b]">
                    {t.subdivCategories}
                  </span>
                  <div className="flex gap-1 text-[10px] font-mono">
                    <button
                      type="button"
                      onClick={() => setCiblageCategory('all')}
                      className={`px-1.5 py-0.5 rounded transition-all cursor-pointer ${
                        ciblageCategory === 'all'
                          ? 'bg-[#0f172a] text-white font-bold'
                          : 'text-[#64748b] hover:text-[#0f172a] hover:bg-[#e2e8f0]'
                      }`}
                      title={isFr ? 'Afficher toutes les catégories' : 'Show all categories'}
                    >
                      {t.all}
                    </button>
                  </div>
                </div>

                {/* Admin / Health pills */}
                <div className="grid grid-cols-2 gap-1 bg-[#f1f5f9] p-1 rounded-xl text-xs font-mono border border-[#cbd5e1]/60">
                  <button
                    type="button"
                    onClick={() => {
                      setCiblageCategory('administrative');
                      if (ciblageLevel === 'districts_sante' || ciblageLevel === 'aires_sante') {
                        setCiblageLevel && setCiblageLevel('departements');
                      }
                    }}
                    className={`py-1.5 px-2 rounded-lg font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      ciblageCategory === 'administrative' || (ciblageCategory !== 'all' && (ciblageLevel === 'departements' || ciblageLevel === 'arrondissements'))
                        ? 'bg-[#006948] text-white shadow-xs'
                        : 'text-[#475569] hover:text-[#0f172a]'
                    }`}
                  >
                    <Building2 className="w-3.5 h-3.5" />
                    <span>{t.administrative}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setCiblageCategory('sanitary');
                      if (ciblageLevel === 'departements' || ciblageLevel === 'arrondissements') {
                        setCiblageLevel && setCiblageLevel('districts_sante');
                      }
                    }}
                    className={`py-1.5 px-2 rounded-lg font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      ciblageCategory === 'sanitary' || (ciblageCategory !== 'all' && (ciblageLevel === 'districts_sante' || ciblageLevel === 'aires_sante'))
                        ? 'bg-[#006948] text-white shadow-xs'
                        : 'text-[#475569] hover:text-[#0f172a]'
                    }`}
                  >
                    <Activity className="w-3.5 h-3.5" />
                    <span>{t.sanitary}</span>
                  </button>
                </div>

                {/* Level list */}
                <div className="space-y-2 pt-1 font-mono text-xs">
                  {/* Administrative branch */}
                  {(ciblageCategory === 'administrative' || ciblageCategory === 'all' || ciblageLevel === 'departements' || ciblageLevel === 'arrondissements') && (
                    <div className="space-y-1">
                      {ciblageCategory === 'all' && (
                        <span className="text-[10px] font-bold text-[#475569] flex items-center gap-1 px-1">
                          <Building2 className="w-3 h-3 text-[#64748b]" />
                          <span>{t.adminSubdiv}</span>
                        </span>
                      )}
                      <div className="grid grid-cols-1 gap-1">
                        {[
                          { id: 'departements' as SubdivisionLevel, label: t.departments58 },
                          ...((activeModule !== 'couverture-asc' || COVERAGE_CONFIG.ENABLE_ARRONDISSEMENTS)
                            ? [{ id: 'arrondissements' as SubdivisionLevel, label: t.arrondissements360 }]
                            : []),
                        ].map((lvl) => (
                          <button
                            key={lvl.id}
                            onClick={() => setCiblageLevel && setCiblageLevel(lvl.id)}
                            className={`w-full py-1.5 px-2.5 rounded-xl text-left font-semibold transition-all flex items-center justify-between cursor-pointer ${
                              ciblageLevel === lvl.id
                                ? 'bg-[#006948] text-white shadow-xs'
                                : 'bg-white hover:bg-[#f1f5f9] text-[#334155] border border-[#e2e8f0]'
                            }`}
                            type="button"
                          >
                            <span className="text-xs">{lvl.label}</span>
                            {ciblageLevel === lvl.id && <span className="w-1.5 h-1.5 rounded-full bg-white shrink-0"></span>}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Health branch */}
                  {(ciblageCategory === 'sanitary' || ciblageCategory === 'all' || ciblageLevel === 'districts_sante' || ciblageLevel === 'aires_sante') && (
                    <div className="space-y-1">
                      {ciblageCategory === 'all' && (
                        <span className="text-[10px] font-bold text-[#006948] flex items-center gap-1 px-1 pt-1 border-t border-[#e2e8f0]">
                          <Activity className="w-3 h-3 text-[#006948]" />
                          <span>{t.sanitarySubdiv}</span>
                        </span>
                      )}
                      <div className="grid grid-cols-1 gap-1">
                        {[
                          { id: 'districts_sante' as SubdivisionLevel, label: t.districtsSante211 },
                          { id: 'aires_sante' as SubdivisionLevel, label: t.airesSante1922 },
                        ].map((lvl) => (
                          <button
                            key={lvl.id}
                            onClick={() => setCiblageLevel && setCiblageLevel(lvl.id)}
                            className={`w-full py-1.5 px-2.5 rounded-xl text-left font-semibold transition-all flex items-center justify-between cursor-pointer ${
                              ciblageLevel === lvl.id
                                ? 'bg-[#006948] text-white shadow-xs'
                                : 'bg-white hover:bg-[#f1f5f9] text-[#334155] border border-[#e2e8f0]'
                            }`}
                            type="button"
                          >
                            <span className="text-xs">{lvl.label}</span>
                            {ciblageLevel === lvl.id && <span className="w-1.5 h-1.5 rounded-full bg-white shrink-0"></span>}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 2. Layer settings (Livrable 3 only) */}
            {activeModule === 'ciblage-asc' && (
              <div data-tour="ciblage-layer-controls" className="bg-[#f8fafc] border border-[#cbd5e1]/70 rounded-2xl p-3 space-y-3">
                <div className="flex items-center justify-between pb-1.5 border-b border-[#e2e8f0]">
                  <span className="font-mono text-[10px] uppercase font-bold text-[#0f172a] flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-[#006948]" />
                    <span>{t.layerSettings}</span>
                  </span>
                  <span className="text-[9px] font-mono font-bold bg-[#e0f2fe] text-[#0369a1] px-1.5 py-0.5 rounded">
                    {t.transparency}
                  </span>
                </div>

                {/* Thematic layer */}
                <div className="bg-white p-2.5 rounded-xl border border-[#e2e8f0] space-y-2 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-[#0f172a]">{t.thematicMapLayer}</span>
                    <button
                      type="button"
                      onClick={() => setCiblageIsThematicVisible && setCiblageIsThematicVisible(!ciblageIsThematicVisible)}
                      className={`p-1 rounded-lg transition-colors cursor-pointer ${
                        ciblageIsThematicVisible ? 'text-[#006948] bg-[#f0fdf4]' : 'text-[#94a3b8] bg-[#f1f5f9]'
                      }`}
                      title={ciblageIsThematicVisible ? t.hideLayer : t.showLayer}
                    >
                      {ciblageIsThematicVisible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </button>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[10px] font-mono text-[#64748b]">
                      <span>{t.opacity}</span>
                      <span className="font-bold text-[#0f172a]">{Math.round(ciblageThematicOpacity * 100)}%</span>
                    </div>
                    <input
                      type="range" min="0" max="1" step="0.05"
                      value={ciblageThematicOpacity}
                      disabled={!ciblageIsThematicVisible}
                      onChange={(e) => setCiblageThematicOpacity && setCiblageThematicOpacity(parseFloat(e.target.value))}
                      className="w-full h-1.5 bg-[#e2e8f0] rounded-lg appearance-none cursor-pointer accent-[#006948]"
                    />
                  </div>
                </div>

                {/* Raster layer */}
                <div className="bg-white p-2.5 rounded-xl border border-[#fecdd3]/80 space-y-2 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span
                      className="font-bold text-xs text-[#be123c] leading-tight"
                      title={isFr
                        ? 'Distribution de la population non couverte / Grid distribution of uncovered population > 5 km de toute FOSA'
                        : 'Grid distribution of uncovered population > 5 km from any health facility'}
                    >
                      {isFr ? '2. Distribution Pop. Non Couverte' : '2. Uncovered Pop. Grid'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setCiblageIsRasterVisible && setCiblageIsRasterVisible(!ciblageIsRasterVisible)}
                      className={`p-1 rounded-lg transition-colors cursor-pointer ${
                        ciblageIsRasterVisible ? 'text-[#e11d48] bg-[#fff1f2]' : 'text-[#94a3b8] bg-[#f1f5f9]'
                      }`}
                      title={ciblageIsRasterVisible ? t.hideRaster : t.showRaster}
                    >
                      {ciblageIsRasterVisible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </button>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[10px] font-mono text-[#64748b]">
                      <span>{t.opacity}</span>
                      <span className="font-bold text-[#be123c]">{Math.round(ciblageRasterOpacity * 100)}%</span>
                    </div>
                    <input
                      type="range" min="0" max="1" step="0.05"
                      value={ciblageRasterOpacity}
                      disabled={!ciblageIsRasterVisible}
                      onChange={(e) => setCiblageRasterOpacity && setCiblageRasterOpacity(parseFloat(e.target.value))}
                      className="w-full h-1.5 bg-[#e2e8f0] rounded-lg appearance-none cursor-pointer accent-[#e11d48]"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* 3. Indicators & Maps (Coverage module only) */}
            {activeModule === 'couverture-asc' && (
              <div data-tour="map-selector" className="bg-[#f8fafc] border border-[#cbd5e1]/70 rounded-2xl p-3 space-y-3">
                <div className="flex items-center justify-between pb-1.5 border-b border-[#e2e8f0]">
                  <span className="font-mono text-[10px] uppercase font-bold text-[#0f172a] flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-[#006948]" />
                    <span>{t.indicatorsMaps}</span>
                  </span>
                  <span className="text-[9px] font-mono font-bold bg-[#ecfdf5] text-[#006948] px-1.5 py-0.5 rounded border border-[#a7f3d0]">
                    {t.maps5}
                  </span>
                </div>

                {/* Proportional symbols category */}
                <div data-tour="coverage-proportional" className="space-y-1.5">
                  <div className="text-[10px] font-mono uppercase font-bold text-[#0284c7] flex items-center gap-1.5 px-1">
                    <span className="w-2 h-2 rounded-full bg-[#0284c7]"></span>
                    <span>{t.propSymbols}</span>
                  </div>

                  {/* Map 1 */}
                  <div className="space-y-1">
                    <button
                      type="button"
                      onClick={() => onCoverageActiveMapChange && onCoverageActiveMapChange('map-1')}
                      className={`w-full py-2 px-2.5 rounded-xl text-left font-semibold transition-all flex items-center justify-between cursor-pointer ${
                        coverageActiveMap === 'map-1'
                          ? 'bg-[#006948] text-white shadow-xs'
                          : 'bg-white hover:bg-[#f1f5f9] text-[#1e293b] border border-[#cbd5e1]'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Users className={`w-3.5 h-3.5 shrink-0 ${coverageActiveMap === 'map-1' ? 'text-white' : 'text-[#0284c7]'}`} />
                        <div className="truncate">
                          <span className="text-xs font-bold block truncate">{t.map1Label}</span>
                          <span className={`text-[10px] font-mono block truncate ${coverageActiveMap === 'map-1' ? 'text-white/80' : 'text-[#64748b]'}`}>
                            {isFr
                              ? (COVERAGE_CONFIG.ASC_CATEGORIES.find(c => c.field === coverageCategoryField)?.shortLabel || 'Total actifs')
                              : (COVERAGE_CONFIG.ASC_CATEGORIES.find(c => c.field === coverageCategoryField)?.shortLabelEn || 'Total active')}
                          </span>
                        </div>
                      </div>
                      {coverageActiveMap === 'map-1' && <span className="w-2 h-2 rounded-full bg-white shrink-0"></span>}
                    </button>

                    {coverageActiveMap === 'map-1' && (
                      <div className="pt-1 pb-1 space-y-1 bg-white rounded-xl p-1.5 border border-[#cbd5e1]">
                        <span className="text-[9px] font-mono font-bold text-[#64748b] block px-1">
                          {t.effCategory}
                        </span>
                        <div className="grid grid-cols-1 gap-0.5">
                          {COVERAGE_CONFIG.ASC_CATEGORIES.map((cat) => {
                            const isCatActive = coverageCategoryField === cat.field;
                            return (
                              <button
                                key={cat.field}
                                type="button"
                                onClick={() => onCoverageCategoryFieldChange && onCoverageCategoryFieldChange(cat.field)}
                                className={`w-full text-left px-2 py-1.5 rounded-lg text-[10.5px] font-mono transition-all flex items-center justify-between cursor-pointer ${
                                  isCatActive
                                    ? 'bg-[#006948]/10 text-[#006948] font-bold border border-[#006948]/30'
                                    : 'text-[#475569] hover:bg-[#f1f5f9] hover:text-[#0f172a]'
                                }`}
                              >
                                <div className="flex items-center gap-1.5 truncate">
                                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                                  <span className="truncate">{isFr ? cat.shortLabel : cat.shortLabelEn}</span>
                                </div>
                                {isCatActive && <span className="text-[10px] font-bold text-[#006948]">✓</span>}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                </div>

                {/* Choropleth category */}
                <div data-tour="coverage-choropleth" className="space-y-1.5 pt-2 border-t border-[#e2e8f0]">
                  <div className="text-[10px] font-mono uppercase font-bold text-[#059669] flex items-center gap-1.5 px-1">
                    <span className="w-2 h-2 rounded-full bg-[#059669]"></span>
                    <span>{t.choroMaps}</span>
                  </div>

                  {/* Map 2a */}
                  <button
                    type="button"
                    onClick={() => onCoverageActiveMapChange && onCoverageActiveMapChange('map-2a')}
                    className={`w-full py-2 px-2.5 rounded-xl text-left font-semibold transition-all flex items-center justify-between cursor-pointer ${
                      coverageActiveMap === 'map-2a'
                        ? 'bg-[#006948] text-white shadow-xs'
                        : 'bg-white hover:bg-[#f1f5f9] text-[#1e293b] border border-[#cbd5e1]'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <ShieldCheck className={`w-3.5 h-3.5 shrink-0 ${coverageActiveMap === 'map-2a' ? 'text-white' : 'text-[#16a34a]'}`} />
                      <div className="truncate">
                        <span className="text-xs font-bold block truncate">{t.map2aLabel}</span>
                        <span className={`text-[10px] font-mono block truncate ${coverageActiveMap === 'map-2a' ? 'text-white/80' : 'text-[#64748b]'}`}>
                          {t.map2aDesc}
                        </span>
                      </div>
                    </div>
                    {coverageActiveMap === 'map-2a' && <span className="w-2 h-2 rounded-full bg-white shrink-0"></span>}
                  </button>

                  {/* Map 2b */}
                  <button
                    type="button"
                    onClick={() => onCoverageActiveMapChange && onCoverageActiveMapChange('map-2b')}
                    className={`w-full py-2 px-2.5 rounded-xl text-left font-semibold transition-all flex items-center justify-between cursor-pointer ${
                      coverageActiveMap === 'map-2b'
                        ? 'bg-[#006948] text-white shadow-xs'
                        : 'bg-white hover:bg-[#f1f5f9] text-[#1e293b] border border-[#cbd5e1]'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <BarChart3 className={`w-3.5 h-3.5 shrink-0 ${coverageActiveMap === 'map-2b' ? 'text-white' : 'text-[#8b5cf6]'}`} />
                      <div className="truncate">
                        <span className="text-xs font-bold block truncate">{t.map2bLabel}</span>
                        <span className={`text-[10px] font-mono block truncate ${coverageActiveMap === 'map-2b' ? 'text-white/80' : 'text-[#64748b]'}`}>
                          {t.map2bDesc}
                        </span>
                      </div>
                    </div>
                    {coverageActiveMap === 'map-2b' && <span className="w-2 h-2 rounded-full bg-white shrink-0"></span>}
                  </button>

                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      {!collapsed && (
        <div className="p-3 border-t border-[#bccac0]/20 bg-[#f8fafc] text-[10px] font-mono text-[#64748b] space-y-2">
          <div className="flex items-center justify-between">
            <span>MINSANTE • DOSTS</span>
            <span className="text-[#006948] font-bold">WGS 84 / UTM 32N</span>
          </div>
          <button
            type="button"
            onClick={() => {
              localStorage.removeItem('sig_asc_tour_v1_completed');
              window.location.reload();
            }}
            className="w-full flex items-center justify-center gap-1.5 text-[10px] font-mono text-[#64748b] hover:text-[#006948] py-1 rounded-lg hover:bg-white transition-colors border border-transparent hover:border-[#bccac0]/40 cursor-pointer"
            title={isFr ? 'Relancer le tour guidé de la plateforme' : 'Restart the platform guided tour'}
          >
            <BookOpen className="w-3 h-3" />
            {isFr ? 'Revoir le tour de la plateforme' : 'Replay the platform tour'}
          </button>
        </div>
      )}
    </aside>
  );
};
