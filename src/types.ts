export type Language = 'fr' | 'en';

export type ActiveModule =
  | 'ciblage-asc'     // Ciblage du besoin en ASC (population couverte FOSA < 5 km)
  | 'couverture-asc'; // Couverture en ASC (Cartes thématiques, effectifs & ratios)

export type CoverageMapType = 
  | 'map-1'   // Effectifs d'ASC actifs (symboles proportionnels)
  | 'map-2a'  // Couverture normative en ASCp (choroplèthe catégorielle, CLASSE_CVG)
  | 'map-2b'  // Couverture toutes catégories (choroplèthe, RATIO_TOT)
  | 'map-3a'  // Effectif d'ASC inactifs (symboles proportionnels, EFF_TOT_I)
  | 'map-3b'; // Part d'ASC inactifs (choroplèthe, PCT_INACT)

export type SubdivisionLevel = 
  | 'regions' 
  | 'departements' 
  | 'arrondissements' 
  | 'districts_sante' 
  | 'aires_sante';

export type BasemapType = 'osm' | 'hot' | 'satellite';
