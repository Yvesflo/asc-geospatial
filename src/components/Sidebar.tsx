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
  UserMinus,
  Percent
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
  l3Level?: SubdivisionLevel;
  setL3Level?: (level: SubdivisionLevel) => void;
  l3Basemap?: BasemapType;
  setL3Basemap?: (bm: BasemapType) => void;
  l3ThematicOpacity?: number;
  setL3ThematicOpacity?: (val: number) => void;
  l3IsThematicVisible?: boolean;
  setL3IsThematicVisible?: (vis: boolean) => void;
  l3RasterOpacity?: number;
  setL3RasterOpacity?: (val: number) => void;
  l3IsRasterVisible?: boolean;
  setL3IsRasterVisible?: (vis: boolean) => void;
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
  l3Level = 'regions',
  setL3Level,
  l3ThematicOpacity = 0.85,
  setL3ThematicOpacity,
  l3IsThematicVisible = true,
  setL3IsThematicVisible,
  l3RasterOpacity = 0.85,
  setL3RasterOpacity,
  l3IsRasterVisible = true,
  setL3IsRasterVisible,
  coverageActiveMap = 'map-1',
  onCoverageActiveMapChange,
  coverageCategoryField = COVERAGE_CONFIG.FIELDS.EFF_TOT_A,
  onCoverageCategoryFieldChange,
}) => {
  const t = TRANSLATIONS[language];
  const [l3Category, setL3Category] = useState<'sanitary' | 'administrative' | 'all'>('sanitary');

  // Les 2 modules cartographiques actifs (Couverture en premier, puis L3)
  const navItems = [
    {
      id: 'couverture-asc' as ActiveModule,
      label: t.navCouvertureAsc,
      description: t.navCouvertureAscDesc,
      icon: Users,
      badge: '5 Cartes & Ratios',
    },
    {
      id: 'livrable-3' as ActiveModule,
      label: t.navLivrable3,
      description: t.navLivrable3Desc,
      icon: Activity,
      badge: 'AccessMod 5 km',
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
            title={collapsed ? 'Développer le menu' : 'Réduire le menu'}
            type="button"
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Deliverable Module Navigation Pills */}
        <nav className="p-2 space-y-1.5 border-b border-[#bccac0]/20">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeModule === item.id;

            return (
              <button
                key={item.id}
                onClick={() => setActiveModule(item.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#006948] text-white font-semibold shadow-sm'
                    : 'text-[#334155] hover:bg-[#f1f5f9] hover:text-[#0f172a]'
                }`}
                title={collapsed ? `${item.label} • ${item.description}` : undefined}
                type="button"
              >
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    isActive ? 'text-white' : 'text-[#006948]'
                  }`}
                />
                {!collapsed && (
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs truncate font-bold">{item.label}</span>
                      {item.badge && (
                        <span
                          className={`text-[9px] font-mono px-1.5 py-0.5 rounded-md font-semibold shrink-0 ${
                            isActive
                              ? 'bg-white/20 text-white'
                              : 'bg-[#f1f5f9] text-[#475569] border border-[#cbd5e1]'
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </div>
                    {item.description && (
                      <span
                        className={`text-[10px] block truncate font-mono mt-0.5 ${
                          isActive ? 'text-white/80' : 'text-[#64748b]'
                        }`}
                      >
                        {item.description}
                      </span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </nav>

        {/* Dynamic Controls & Filters (Visible when not collapsed) */}
        {!collapsed && (
          <div className="p-3 space-y-4">
            {/* 1. Niveau de Désagrégation Territoriale */}
            <div className="bg-[#f8fafc] border border-[#cbd5e1]/70 rounded-2xl p-3 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase font-bold text-[#475569] flex items-center gap-1.5">
                  <Filter className="w-3.5 h-3.5 text-[#006948]" />
                  <span>Désagrégation Territoriale</span>
                </span>
              </div>

              {/* Niveau Pivot / Socle Commun : Régions (10) */}
              <div>
                <button
                  onClick={() => setL3Level && setL3Level('regions')}
                  className={`w-full py-2 px-2.5 rounded-xl text-left font-semibold transition-all flex items-center justify-between cursor-pointer ${
                    l3Level === 'regions'
                      ? 'bg-[#006948] text-white shadow-xs'
                      : 'bg-white hover:bg-[#f1f5f9] text-[#1e293b] border border-[#cbd5e1]'
                  }`}
                  type="button"
                >
                  <div className="flex items-center gap-2">
                    <Globe2 className={`w-4 h-4 shrink-0 ${l3Level === 'regions' ? 'text-white' : 'text-[#006948]'}`} />
                    <div>
                      <span className="text-xs font-bold block">Régions (10)</span>
                      <span className={`text-[10px] font-mono block ${l3Level === 'regions' ? 'text-white/80' : 'text-[#64748b]'}`}>
                        Socle national commun
                      </span>
                    </div>
                  </div>
                  {l3Level === 'regions' && <span className="w-2 h-2 rounded-full bg-white shrink-0"></span>}
                </button>
              </div>

              {/* Catégories de Découpage : Administratif & Sanitaire */}
              <div className="space-y-2 pt-1 border-t border-[#e2e8f0]">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase font-bold text-[#64748b]">
                    Catégories de découpage
                  </span>
                  <div className="flex gap-1 text-[10px] font-mono">
                    <button
                      type="button"
                      onClick={() => setL3Category('all')}
                      className={`px-1.5 py-0.5 rounded transition-all cursor-pointer ${
                        l3Category === 'all'
                          ? 'bg-[#0f172a] text-white font-bold'
                          : 'text-[#64748b] hover:text-[#0f172a] hover:bg-[#e2e8f0]'
                      }`}
                      title="Afficher toutes les catégories"
                    >
                      Tous
                    </button>
                  </div>
                </div>

                {/* Toggle Pills Administratif vs Sanitaire */}
                <div className="grid grid-cols-2 gap-1 bg-[#f1f5f9] p-1 rounded-xl text-xs font-mono border border-[#cbd5e1]/60">
                  <button
                    type="button"
                    onClick={() => {
                      setL3Category('administrative');
                      if (l3Level === 'districts_sante' || l3Level === 'aires_sante') {
                        setL3Level && setL3Level('departements');
                      }
                    }}
                    className={`py-1.5 px-2 rounded-lg font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      l3Category === 'administrative' || (l3Category !== 'all' && (l3Level === 'departements' || l3Level === 'arrondissements'))
                        ? 'bg-[#006948] text-white shadow-xs'
                        : 'text-[#475569] hover:text-[#0f172a]'
                    }`}
                  >
                    <Building2 className="w-3.5 h-3.5" />
                    <span>Administratif</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setL3Category('sanitary');
                      if (l3Level === 'departements' || l3Level === 'arrondissements') {
                        setL3Level && setL3Level('districts_sante');
                      }
                    }}
                    className={`py-1.5 px-2 rounded-lg font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      l3Category === 'sanitary' || (l3Category !== 'all' && (l3Level === 'districts_sante' || l3Level === 'aires_sante'))
                        ? 'bg-[#006948] text-white shadow-xs'
                        : 'text-[#475569] hover:text-[#0f172a]'
                    }`}
                  >
                    <Activity className="w-3.5 h-3.5" />
                    <span>Sanitaire</span>
                  </button>
                </div>

                {/* Liste des Niveaux selon Catégorie */}
                <div className="space-y-2 pt-1 font-mono text-xs">
                  {/* Branche Découpage Administratif */}
                  {(l3Category === 'administrative' || l3Category === 'all' || l3Level === 'departements' || l3Level === 'arrondissements') && (
                    <div className="space-y-1">
                      {l3Category === 'all' && (
                        <span className="text-[10px] font-bold text-[#475569] flex items-center gap-1 px-1">
                          <Building2 className="w-3 h-3 text-[#64748b]" />
                          <span>Découpage Administratif</span>
                        </span>
                      )}
                      <div className="grid grid-cols-1 gap-1">
                        {[
                          { id: 'departements' as SubdivisionLevel, label: 'Départements (58)' },
                          ...((activeModule !== 'couverture-asc' || COVERAGE_CONFIG.ENABLE_ARRONDISSEMENTS)
                            ? [{ id: 'arrondissements' as SubdivisionLevel, label: 'Arrondissements (360)' }]
                            : []),
                        ].map((lvl) => (
                          <button
                            key={lvl.id}
                            onClick={() => setL3Level && setL3Level(lvl.id)}
                            className={`w-full py-1.5 px-2.5 rounded-xl text-left font-semibold transition-all flex items-center justify-between cursor-pointer ${
                              l3Level === lvl.id
                                ? 'bg-[#006948] text-white shadow-xs'
                                : 'bg-white hover:bg-[#f1f5f9] text-[#334155] border border-[#e2e8f0]'
                            }`}
                            type="button"
                          >
                            <span className="text-xs">{lvl.label}</span>
                            {l3Level === lvl.id && <span className="w-1.5 h-1.5 rounded-full bg-white shrink-0"></span>}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Branche Découpage Sanitaire */}
                  {(l3Category === 'sanitary' || l3Category === 'all' || l3Level === 'districts_sante' || l3Level === 'aires_sante') && (
                    <div className="space-y-1">
                      {l3Category === 'all' && (
                        <span className="text-[10px] font-bold text-[#006948] flex items-center gap-1 px-1 pt-1 border-t border-[#e2e8f0]">
                          <Activity className="w-3 h-3 text-[#006948]" />
                          <span>Découpage Sanitaire</span>
                        </span>
                      )}
                      <div className="grid grid-cols-1 gap-1">
                        {[
                          { id: 'districts_sante' as SubdivisionLevel, label: 'Districts de Santé (211)' },
                          { id: 'aires_sante' as SubdivisionLevel, label: 'Aires de Santé (1 922)' },
                        ].map((lvl) => (
                          <button
                            key={lvl.id}
                            onClick={() => setL3Level && setL3Level(lvl.id)}
                            className={`w-full py-1.5 px-2.5 rounded-xl text-left font-semibold transition-all flex items-center justify-between cursor-pointer ${
                              l3Level === lvl.id
                                ? 'bg-[#006948] text-white shadow-xs'
                                : 'bg-white hover:bg-[#f1f5f9] text-[#334155] border border-[#e2e8f0]'
                            }`}
                            type="button"
                          >
                            <span className="text-xs">{lvl.label}</span>
                            {l3Level === lvl.id && <span className="w-1.5 h-1.5 rounded-full bg-white shrink-0"></span>}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 2. Réglages des Couches & Opacités (Spécifique Livrable 3) */}
            {activeModule === 'livrable-3' && (
              <div className="bg-[#f8fafc] border border-[#cbd5e1]/70 rounded-2xl p-3 space-y-3">
                <div className="flex items-center justify-between pb-1.5 border-b border-[#e2e8f0]">
                  <span className="font-mono text-[10px] uppercase font-bold text-[#0f172a] flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-[#006948]" />
                    <span>Réglage des Couches</span>
                  </span>
                  <span className="text-[9px] font-mono font-bold bg-[#e0f2fe] text-[#0369a1] px-1.5 py-0.5 rounded">
                    Transparence
                  </span>
                </div>

                {/* Contrôle Carte Thématique */}
                <div className="bg-white p-2.5 rounded-xl border border-[#e2e8f0] space-y-2 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-[#0f172a]">
                      1. Carte Thématique (% Pop)
                    </span>
                    <button
                      type="button"
                      onClick={() => setL3IsThematicVisible && setL3IsThematicVisible(!l3IsThematicVisible)}
                      className={`p-1 rounded-lg transition-colors cursor-pointer ${
                        l3IsThematicVisible ? 'text-[#006948] bg-[#f0fdf4]' : 'text-[#94a3b8] bg-[#f1f5f9]'
                      }`}
                      title={l3IsThematicVisible ? "Masquer la couche" : "Afficher la couche"}
                    >
                      {l3IsThematicVisible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </button>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[10px] font-mono text-[#64748b]">
                      <span>Opacité :</span>
                      <span className="font-bold text-[#0f172a]">{Math.round(l3ThematicOpacity * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={l3ThematicOpacity}
                      disabled={!l3IsThematicVisible}
                      onChange={(e) => setL3ThematicOpacity && setL3ThematicOpacity(parseFloat(e.target.value))}
                      className="w-full h-1.5 bg-[#e2e8f0] rounded-lg appearance-none cursor-pointer accent-[#006948]"
                    />
                  </div>
                </div>

                {/* Contrôle Raster Population Non Couverte */}
                <div className="bg-white p-2.5 rounded-xl border border-[#fecdd3]/80 space-y-2 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-[#be123c]">
                      2. Raster Pop. Non Couverte
                    </span>
                    <button
                      type="button"
                      onClick={() => setL3IsRasterVisible && setL3IsRasterVisible(!l3IsRasterVisible)}
                      className={`p-1 rounded-lg transition-colors cursor-pointer ${
                        l3IsRasterVisible ? 'text-[#e11d48] bg-[#fff1f2]' : 'text-[#94a3b8] bg-[#f1f5f9]'
                      }`}
                      title={l3IsRasterVisible ? "Masquer le raster" : "Afficher le raster"}
                    >
                      {l3IsRasterVisible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </button>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[10px] font-mono text-[#64748b]">
                      <span>Opacité :</span>
                      <span className="font-bold text-[#be123c]">{Math.round(l3RasterOpacity * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={l3RasterOpacity}
                      disabled={!l3IsRasterVisible}
                      onChange={(e) => setL3RasterOpacity && setL3RasterOpacity(parseFloat(e.target.value))}
                      className="w-full h-1.5 bg-[#e2e8f0] rounded-lg appearance-none cursor-pointer accent-[#e11d48]"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* 2. Indicateurs & Cartes (Spécifique Couverture en ASC : Catégorisés en Symboles Proportionnels et Choroplèthes) */}
            {activeModule === 'couverture-asc' && (
              <div className="bg-[#f8fafc] border border-[#cbd5e1]/70 rounded-2xl p-3 space-y-3">
                <div className="flex items-center justify-between pb-1.5 border-b border-[#e2e8f0]">
                  <span className="font-mono text-[10px] uppercase font-bold text-[#0f172a] flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-[#006948]" />
                    <span>Indicateurs & Cartes</span>
                  </span>
                  <span className="text-[9px] font-mono font-bold bg-[#ecfdf5] text-[#006948] px-1.5 py-0.5 rounded border border-[#a7f3d0]">
                    5 Cartes
                  </span>
                </div>

                {/* Catégorie 1 : Symboles Proportionnels (Effectifs bruts & Volumes) */}
                <div className="space-y-1.5">
                  <div className="text-[10px] font-mono uppercase font-bold text-[#0284c7] flex items-center gap-1.5 px-1">
                    <span className="w-2 h-2 rounded-full bg-[#0284c7]"></span>
                    <span>Symboles Proportionnels</span>
                  </div>

                  {/* Carte 1 : Effectifs d'ASC Actifs */}
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
                          <span className="text-xs font-bold block truncate">1. Effectifs d'ASC Actifs</span>
                          <span className={`text-[10px] font-mono block truncate ${coverageActiveMap === 'map-1' ? 'text-white/80' : 'text-[#64748b]'}`}>
                            {COVERAGE_CONFIG.ASC_CATEGORIES.find(c => c.field === coverageCategoryField)?.shortLabel || 'Total actifs'}
                          </span>
                        </div>
                      </div>
                      {coverageActiveMap === 'map-1' && <span className="w-2 h-2 rounded-full bg-white shrink-0"></span>}
                    </button>

                    {/* Déroulé des sous-catégories lorsque Carte 1 est active */}
                    {coverageActiveMap === 'map-1' && (
                      <div className="pt-1 pb-1 space-y-1 bg-white rounded-xl p-1.5 border border-[#cbd5e1]">
                        <span className="text-[9px] font-mono font-bold text-[#64748b] block px-1">
                          Catégorie d'effectif :
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
                                  <span
                                    className="w-2 h-2 rounded-full shrink-0"
                                    style={{ backgroundColor: cat.color }}
                                  />
                                  <span className="truncate">{cat.shortLabel}</span>
                                </div>
                                {isCatActive && <span className="text-[10px] font-bold text-[#006948]">✓</span>}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Carte 3a : ASC inactifs à remplacer */}
                  <button
                    type="button"
                    onClick={() => onCoverageActiveMapChange && onCoverageActiveMapChange('map-3a')}
                    className={`w-full py-2 px-2.5 rounded-xl text-left font-semibold transition-all flex items-center justify-between cursor-pointer ${
                      coverageActiveMap === 'map-3a'
                        ? 'bg-[#006948] text-white shadow-xs'
                        : 'bg-white hover:bg-[#f1f5f9] text-[#1e293b] border border-[#cbd5e1]'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <UserMinus className={`w-3.5 h-3.5 shrink-0 ${coverageActiveMap === 'map-3a' ? 'text-white' : 'text-[#ea580c]'}`} />
                      <div className="truncate">
                        <span className="text-xs font-bold block truncate">3a. Inactifs à Remplacer</span>
                        <span className={`text-[10px] font-mono block truncate ${coverageActiveMap === 'map-3a' ? 'text-white/80' : 'text-[#64748b]'}`}>
                          Volume d'inactifs (besoin)
                        </span>
                      </div>
                    </div>
                    {coverageActiveMap === 'map-3a' && <span className="w-2 h-2 rounded-full bg-white shrink-0"></span>}
                  </button>
                </div>

                {/* Catégorie 2 : Cartes Choroplèthes (Taux, Couverture & Ratios) */}
                <div className="space-y-1.5 pt-2 border-t border-[#e2e8f0]">
                  <div className="text-[10px] font-mono uppercase font-bold text-[#059669] flex items-center gap-1.5 px-1">
                    <span className="w-2 h-2 rounded-full bg-[#059669]"></span>
                    <span>Cartes Choroplèthes</span>
                  </div>

                  {/* Carte 2a : Couverture normative ASCp */}
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
                        <span className="text-xs font-bold block truncate">2a. Couverture ASCp</span>
                        <span className={`text-[10px] font-mono block truncate ${coverageActiveMap === 'map-2a' ? 'text-white/80' : 'text-[#64748b]'}`}>
                          Norme 1 ASCp / 1 000 hab.
                        </span>
                      </div>
                    </div>
                    {coverageActiveMap === 'map-2a' && <span className="w-2 h-2 rounded-full bg-white shrink-0"></span>}
                  </button>

                  {/* Carte 2b : Ratios toutes catégories */}
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
                        <span className="text-xs font-bold block truncate">2b. Ratios Toutes Cat.</span>
                        <span className={`text-[10px] font-mono block truncate ${coverageActiveMap === 'map-2b' ? 'text-white/80' : 'text-[#64748b]'}`}>
                          1 ASC pour X habitants
                        </span>
                      </div>
                    </div>
                    {coverageActiveMap === 'map-2b' && <span className="w-2 h-2 rounded-full bg-white shrink-0"></span>}
                  </button>

                  {/* Carte 3b : Part d'ASC inactifs (%) */}
                  <button
                    type="button"
                    onClick={() => onCoverageActiveMapChange && onCoverageActiveMapChange('map-3b')}
                    className={`w-full py-2 px-2.5 rounded-xl text-left font-semibold transition-all flex items-center justify-between cursor-pointer ${
                      coverageActiveMap === 'map-3b'
                        ? 'bg-[#006948] text-white shadow-xs'
                        : 'bg-white hover:bg-[#f1f5f9] text-[#1e293b] border border-[#cbd5e1]'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Percent className={`w-3.5 h-3.5 shrink-0 ${coverageActiveMap === 'map-3b' ? 'text-white' : 'text-[#dc2626]'}`} />
                      <div className="truncate">
                        <span className="text-xs font-bold block truncate">3b. Part d'Inactifs (%)</span>
                        <span className={`text-[10px] font-mono block truncate ${coverageActiveMap === 'map-3b' ? 'text-white/80' : 'text-[#64748b]'}`}>
                          Taux de déperdition
                        </span>
                      </div>
                    </div>
                    {coverageActiveMap === 'map-3b' && <span className="w-2 h-2 rounded-full bg-white shrink-0"></span>}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer Info / Versioning */}
      {!collapsed && (
        <div className="p-3 border-t border-[#bccac0]/20 bg-[#f8fafc] text-[10px] font-mono text-[#64748b] flex items-center justify-between">
          <span>MINSANTE • DOSTS</span>
          <span className="text-[#006948] font-bold">WGS 84 / UTM 32N</span>
        </div>
      )}
    </aside>
  );
};
