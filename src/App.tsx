import React, { useState } from 'react';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { Livrable3RealNeed } from './components/Livrable3RealNeed';
import { CouvertureAscMap } from './components/CouvertureAscMap';
import { ActiveModule, Language, SubdivisionLevel, BasemapType, CoverageMapType } from './types';
import { COVERAGE_CONFIG } from './config/coverageConfig';

export default function App() {
  const [language, setLanguage] = useState<Language>('fr');
  const [activeModule, setActiveModule] = useState<ActiveModule>('couverture-asc');
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);

  // Échelon spatial partagé entre barre latérale et cartes
  const [spatialLevel, setSpatialLevel] = useState<SubdivisionLevel>('regions');
  const [activeBasemap, setActiveBasemap] = useState<BasemapType>('hot');

  // Paramètres d'affichage spécifiques Livrable 3
  const [l3ThematicOpacity, setL3ThematicOpacity] = useState<number>(0.85);
  const [l3IsThematicVisible, setL3IsThematicVisible] = useState<boolean>(true);
  const [l3RasterOpacity, setL3RasterOpacity] = useState<number>(0.85);
  const [l3IsRasterVisible, setL3IsRasterVisible] = useState<boolean>(true);

  // Paramètres spécifiques Couverture en ASC (5 cartes thématiques et sous-catégories)
  const [coverageActiveMap, setCoverageActiveMap] = useState<CoverageMapType>('map-1');
  const [coverageCategoryField, setCoverageCategoryField] = useState<string>(
    COVERAGE_CONFIG.FIELDS.EFF_TOT_A
  );

  // Déclencheur d'export depuis le bouton officiel de l'en-tête
  const [coverageExportTrigger, setCoverageExportTrigger] = useState<number>(0);

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#0f172a] font-sans antialiased flex flex-col">
      {/* Barre Supérieure Épurée */}
      <Header
        language={language}
        setLanguage={setLanguage}
        activeModule={activeModule}
        onExportMap={() => setCoverageExportTrigger((prev) => prev + 1)}
      />

      {/* Disposition Principale */}
      <div className="flex-1 flex pt-16">
        {/* Barre Latérale Épurée */}
        <Sidebar
          activeModule={activeModule}
          setActiveModule={setActiveModule}
          language={language}
          collapsed={sidebarCollapsed}
          setCollapsed={setSidebarCollapsed}
          l3Level={spatialLevel}
          setL3Level={setSpatialLevel}
          l3ThematicOpacity={l3ThematicOpacity}
          setL3ThematicOpacity={setL3ThematicOpacity}
          l3IsThematicVisible={l3IsThematicVisible}
          setL3IsThematicVisible={setL3IsThematicVisible}
          l3RasterOpacity={l3RasterOpacity}
          setL3RasterOpacity={setL3RasterOpacity}
          l3IsRasterVisible={l3IsRasterVisible}
          setL3IsRasterVisible={setL3IsRasterVisible}
          coverageActiveMap={coverageActiveMap}
          onCoverageActiveMapChange={setCoverageActiveMap}
          coverageCategoryField={coverageCategoryField}
          onCoverageCategoryFieldChange={setCoverageCategoryField}
        />

        {/* Espace Cartographique & Analytique */}
        <main
          className={`flex-1 transition-all duration-300 ${
            sidebarCollapsed ? 'ml-16' : 'ml-72 sm:ml-80'
          } min-h-[calc(100vh-4rem)] overflow-hidden relative`}
        >
          {/* Livrable 3: Analyse du Besoin Réel (> 5 km FOSA / AccessMod) */}
          {activeModule === 'livrable-3' && (
            <Livrable3RealNeed 
              language={language}
              level={spatialLevel}
              onLevelChange={setSpatialLevel}
              basemap={activeBasemap}
              onBasemapChange={setActiveBasemap}
              thematicOpacity={l3ThematicOpacity}
              onThematicOpacityChange={setL3ThematicOpacity}
              isThematicVisible={l3IsThematicVisible}
              onIsThematicVisibleChange={setL3IsThematicVisible}
              rasterOpacity={l3RasterOpacity}
              onRasterOpacityChange={setL3RasterOpacity}
              isRasterVisible={l3IsRasterVisible}
              onIsRasterVisibleChange={setL3IsRasterVisible}
            />
          )}

          {/* Module Couverture en ASC (5 Cartes thématiques, effectifs & ratios) */}
          {activeModule === 'couverture-asc' && (
            <CouvertureAscMap
              language={language}
              level={spatialLevel}
              onLevelChange={setSpatialLevel}
              basemap={activeBasemap}
              onBasemapChange={setActiveBasemap}
              exportTrigger={coverageExportTrigger}
              activeMap={coverageActiveMap}
              onActiveMapChange={setCoverageActiveMap}
              selectedCategoryField={coverageCategoryField}
              onSelectedCategoryFieldChange={setCoverageCategoryField}
            />
          )}
        </main>
      </div>
    </div>
  );
}
