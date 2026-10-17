# Documentation Technique de Migration — SIG-ASC (MINSANTE / DOSTS)

**Destinataire :** Équipe technique de la plateforme hôte  
**Objet :** Transfert, intégration et personnalisation du module cartographique SIG-ASC  
**Date :** Octobre 2026  
**Version du code :** 1.0.0

---

## 1. Présentation de l'application

### 1.1 Contexte fonctionnel

Le SIG-ASC est une plateforme de tableau de bord géospatial développée pour la **Direction de l'Organisation des Soins et de la Technologie Sanitaire (DOSTS)** du Ministère de la Santé du Cameroun (MINSANTE).

Elle comprend deux modules cartographiques distincts :

| Module | Identifiant interne | Objet |
|--------|---------------------|-------|
| Couverture en ASC | `couverture-asc` | 5 cartes thématiques sur les effectifs, ratios et normes de couverture des Agents de Santé Communautaire |
| Ciblage du besoin en ASC | `ciblage-asc` | Population non couverte par les FOSA dans un rayon de 5 km (données AccessMod) |

L'application est **bilingue** (Français / Anglais). Le changement de langue est accessible depuis l'en-tête.

### 1.2 Stack technique

| Composant | Technologie | Version |
|-----------|-------------|---------|
| Framework UI | React | 19.0.1 |
| Build tool | Vite | 6.2.3 |
| Langage | TypeScript | 5.8.2 |
| Cartographie | Leaflet | 1.9.4 |
| Styles | Tailwind CSS | 4.1.14 |
| Icônes | Lucide React | 0.546.0 |

### 1.3 Structure du projet

```
SIG_ASC_DOSTS/
├── src/
│   ├── App.tsx                          # Composant racine, état global de l'application
│   ├── types.ts                         # Types TypeScript (Language, ActiveModule, etc.)
│   ├── config/
│   │   └── coverageConfig.ts            # ★ FICHIER CENTRAL — Configuration des données et de la carte
│   ├── components/
│   │   ├── Header.tsx                   # Barre supérieure (logo, titre, sélecteur de langue, export)
│   │   ├── Sidebar.tsx                  # Menu latéral (navigation modules, niveaux territoriaux)
│   │   ├── CouvertureAscMap.tsx         # Module Couverture ASC (carte Leaflet + logique rendu)
│   │   ├── CouvertureAscSidePanel.tsx   # Panneau d'analyse latéral (fiche détaillée par zone)
│   │   ├── Livrable3RealNeed.tsx        # Module Ciblage ASC (accessibilité FOSA < 5 km)
│   │   ├── Livrable3SidePanel.tsx       # Panneau du module Ciblage
│   │   ├── FloatingBasemapSwitcher.tsx  # Sélecteur flottant de fond de carte
│   │   └── GuidedTour.tsx               # Tour guidé de bienvenue (première visite)
│   ├── data/
│   │   └── mockGisData.ts               # ★ Toutes les traductions FR/EN de l'interface
│   └── utils/
│       └── coverageExportUtils.ts       # Fonctions d'export PNG (A4 300 DPI) et CSV
├── public/
│   └── data/                            # Fichiers de données statiques actuels
│       ├── regions_5km.geojson          # Couche régions (Couverture ASC)
│       ├── departements_5km.geojson     # Couche départements
│       ├── arrondissements_5km.geojson  # Couche arrondissements (désactivée par défaut)
│       ├── districts_sante_5km.geojson  # Couche districts de santé
│       ├── aires_sante_5km.geojson      # Couche aires de santé
│       ├── Access5km_nation.json        # Données AccessMod nationales (Ciblage)
│       ├── Access5km_region.json        # Données AccessMod par région
│       ├── Access5km_departement.json   # Données AccessMod par département
│       ├── Access5km_arrondissement.json
│       ├── Access5km_districts_sante.json
│       ├── Access5km_aires_sante.json
│       ├── pop_uncovered_raster.png     # Raster : distribution population non couverte
│       └── pop_uncovered_raster.json    # Métadonnées du raster (emprise, résolution)
├── package.json
├── vite.config.ts
└── tsconfig.json
```

---

## 2. Guide d'adaptation visuelle (personnalisation à votre charte graphique)

> **Objectif :** Adapter l'interface pour qu'elle s'intègre visuellement à votre plateforme existante, sans réécrire la logique cartographique.

### 2.1 Couleur principale (vert institutionnel MINSANTE)

La couleur dominante `#006948` (vert MINSANTE) est utilisée dans **l'ensemble des composants**. Pour adopter la couleur de votre organisation, remplacez toutes les occurrences de cette valeur.

**Fichiers concernés :**
- [src/components/Header.tsx](src/components/Header.tsx) — couleur du bouton actif, bordures
- [src/components/Sidebar.tsx](src/components/Sidebar.tsx) — boutons de navigation actifs, accents
- [src/components/CouvertureAscMap.tsx](src/components/CouvertureAscMap.tsx) — badges, boutons, accents de la carte
- [src/components/Livrable3RealNeed.tsx](src/components/Livrable3RealNeed.tsx) — idem pour le module Ciblage

**Méthode recommandée** — Recherche/remplacement global dans le projet entier :
```
Chercher :   #006948
Remplacer :  <votre couleur principale hex>
```

Faire de même avec la variante sombre `#005238` (hover de la couleur principale) :
```
Chercher :   #005238
Remplacer :  <votre couleur sombre hex>
```

### 2.2 Logo de l'application

Le logo actuel est chargé depuis une URL externe dans [src/components/Header.tsx](src/components/Header.tsx) **ligne 26** :

```tsx
<img
  src="https://lh3.googleusercontent.com/aida/..."
  alt="SIG-ASC Logo"
  className="h-10 w-10 object-contain rounded-xl p-0.5 bg-[#006948]/5 border border-[#006948]/10"
/>
```

**Pour remplacer le logo :**
1. Déposer votre logo dans `public/` (ex. : `public/logo_org.png`)
2. Modifier la ligne `src` :
   ```tsx
   src="/logo_org.png"
   ```

### 2.3 Titre et sous-titre de l'application

Les textes affichés dans l'en-tête sont définis dans [src/data/mockGisData.ts](src/data/mockGisData.ts) — objet `TRANSLATIONS` :

```ts
// Français
appTitle:    "SIG-ASC • Système d'Information Géographique ASC"
appSubtitle: "Direction de l'Organisation des Soins et de la Technologie Sanitaire (DOSTS) • MINSANTE"

// Anglais
appTitle:    "CHW-GIS • Geographic Information System for CHWs"
appSubtitle: "Department of Health Care Organization & Health Technology (DOSTS) • MINSANTE"
```

Modifier ces quatre chaînes pour refléter le nom et l'organisation de votre plateforme.

### 2.4 Mentions institutionnelles du pied de carte

Les mentions affichées sous chaque carte exportée (et dans le pied de carte) sont configurées dans [src/config/coverageConfig.ts](src/config/coverageConfig.ts) — section `SOURCES` :

```ts
SOURCES: {
  MAP_SOURCE:      'Population : WorldPop. Effectifs ASC : cartographie et profilage des ASC, MINSANTE.',
  MAP_SOURCE_EN:   'Population: WorldPop. CHW workforce: CHW mapping & profiling, MINSANTE.',
  NORMATIVE_NOTE:  'Norme nationale : 1 ASCp pour 1 000 habitants en milieu rural, ...',
  ...
}
```

Ces textes s'affichent dans les exports PNG et dans les panneaux d'analyse.

Également dans [src/data/mockGisData.ts](src/data/mockGisData.ts) :
```ts
sourcesNotice: "Sources : Données SNT, DOSTS, WorldPop 2024, AccessMod"
verifiedBadge: "VALIDÉ MINSANTE"
projectionNotice: "Système de projection : WGS 84 / UTM Zone 32N (EPSG: 32632)"
```

### 2.5 Pied de page de la barre latérale

Le pied de la barre latérale ([src/components/Sidebar.tsx](src/components/Sidebar.tsx), lignes 534-552) affiche en dur :
```tsx
<span>MINSANTE • DOSTS</span>
<span>WGS 84 / UTM 32N</span>
```

Modifier ces deux chaînes selon vos besoins.

### 2.6 Fond de carte par défaut

L'application propose trois fonds de carte. La valeur par défaut est `'hot'` (OpenStreetMap Humanitarian). Pour changer le fond par défaut, modifier la ligne dans [src/App.tsx](src/App.tsx) :

```tsx
// Ligne 17
const [activeBasemap, setActiveBasemap] = useState<BasemapType>('hot');
// Valeurs possibles : 'osm' | 'hot' | 'satellite'
```

### 2.7 Attribution cartographique

L'attribution Leaflet (visible en bas à droite de la carte) est définie dans [src/components/CouvertureAscMap.tsx](src/components/CouvertureAscMap.tsx) **ligne 609** :
```ts
attribution: '&copy; OpenStreetMap contributors | DOSTS / MINSANTE'
```

Adapter la mention à votre organisation.

---

## 3. Sources de données — État actuel (données factices)

### 3.1 Module Couverture ASC

Les données actuelles sont des **fichiers GeoJSON statiques fictifs**, placés dans `public/data/`. Ils sont chargés côté client via `fetch()` dans [src/components/CouvertureAscMap.tsx](src/components/CouvertureAscMap.tsx), à partir des chemins définis dans [src/config/coverageConfig.ts](src/config/coverageConfig.ts) — section `GEOJSON_FILES` :

```ts
GEOJSON_FILES: {
  regions:          '/data/regions_5km.geojson',
  departements:     '/data/departements_5km.geojson',
  arrondissements:  '/data/arrondissements_5km.geojson',   // désactivé par défaut
  districts_sante:  '/data/districts_sante_5km.geojson',
  aires_sante:      '/data/aires_sante_5km.geojson',
}
```

### 3.2 Module Ciblage ASC (Livrable 3)

Ce module utilise :
- Des fichiers JSON d'accessibilité calculés par **AccessMod** (population couverte FOSA < 5 km par niveau territorial)
- Un fichier raster PNG (`pop_uncovered_raster.png`) représentant la distribution spatiale de la population non couverte

---

## 4. Schéma de données — Contrat strict pour la migration

> **IMPORTANT :** Le front-end ne fait aucune transformation des données. Il lit les propriétés GeoJSON telles quelles. Le respect exact des noms de champs suivants est **obligatoire**.

### 4.1 Champs attendus dans chaque feature GeoJSON

#### Champs d'effectifs actifs (Carte 1 — symboles proportionnels)

| Champ | Type | Description |
|-------|------|-------------|
| `EFF_TOT_A` | `number` | Effectif total de tous les ASC actifs |
| `EFF_ASCP_A` | `number` | ASC polyvalents actifs (ASCp) |
| `EFF_ACC_A` | `number` | Agents de Communication et Relais (ACCRA) actifs |
| `EFF_APS_A` | `number` | Agents Polyvalents de Santé (APS) actifs |
| `EFF_PE_A` | `number` | Pairs Éducateurs (PE) actifs |
| `EFF_MM_A` | `number` | Mères Mentors (MM) actives |
| `EFF_RC_A` | `number` | Relais Communautaires (RC) actifs |

#### Champs d'effectifs inactifs (Cartes 3a et 3b)

| Champ | Type | Description |
|-------|------|-------------|
| `EFF_TOT_I` | `number` | Effectif total d'ASC inactifs à remplacer |
| `PCT_INACT` | `number` | Pourcentage d'inactifs (0–100). Ne pas calculer si EFF_TOT_A + EFF_TOT_I < 5 |

#### Champs de couverture normative (Cartes 2a et 2b)

| Champ | Type | Description | Valeurs attendues |
|-------|------|-------------|-------------------|
| `CLASSE_CVG` | `string` | Classe normative de couverture en ASCp | Voir tableau ci-dessous |
| `RATIO_ASCP` | `number` | Ratio : habitants pour 1 ASCp actif | ex. : `1250` = 1 ASCp pour 1 250 hab. |
| `RATIO_TOT` | `number` | Ratio : habitants pour 1 ASC (toutes catégories) | ex. : `450` |

**Valeurs obligatoires pour `CLASSE_CVG` :**

| Valeur | Signification | Couleur |
|--------|---------------|---------|
| `couverte` | 1 ASCp pour ≤ 1 000 habitants : conforme | `#16a34a` (vert) |
| `couverte_si_urbain` | 1 ASCp pour 1 000 à 2 499 habitants : conforme en urbain | `#ea580c` (orange) |
| `sous_couverte` | 1 ASCp pour ≥ 2 500 habitants : sous-couverte | `#dc2626` (rouge) |
| `aucun_ascp_actif` | Aucun ASCp actif recensé | `#7f1d1d` (bordeaux) |
| `pop_manquante` | Données de population non disponibles | `#94a3b8` (gris) |

Toute valeur hors de cette liste génère un motif gris hachuré ("zone sans données") et un avertissement dans la console.

#### Champs de population

| Champ | Type | Couches concernées |
|-------|------|---------------------|
| `POP_TOT` | `number` | Régions, Départements, Arrondissements, Districts de santé |
| `popTotal` | `number` | Aires de santé **uniquement** |

> **Règle absolue :** pas de fallback entre `POP_TOT` et `popTotal`. Chaque couche utilise exclusivement son propre champ population. Un mélange causerait des calculs de ratio incorrects.

#### Champs de noms et de hiérarchie territoriale

| Champ | Type | Couche | Description |
|-------|------|--------|-------------|
| `NAME_1` | `string` | Régions | Nom de la région |
| `NAME_2` | `string` | Départements, Arrondissements | Nom du département |
| `NAME_3` | `string` | Arrondissements | Nom de l'arrondissement |
| `District_S` | `string` | Districts de santé, Aires de santé | Nom du district de santé |
| `Nom_AS` | `string` | Aires de santé | Nom de l'aire de santé |

**Champs de rattachement hiérarchique (pour les filtres et popups) :**

| Champ | Couches concernées | Valeur |
|-------|--------------------|--------|
| `NAME_1` ou `region` | Toutes sauf régions | Nom de la région parente |
| `NAME_2` ou `Nom_Dept` | Districts et Aires | Nom du département de rattachement |
| `Nom_Region` | Districts et Aires | Variante du nom de région |

### 4.2 Champs optionnels mais attendus

| Champ | Couches | Description |
|-------|---------|-------------|
| `NB_AIRES` | Régions, Districts | Nombre d'aires de santé agrégées |

### 4.3 Exemple de feature GeoJSON valide (niveau Districts de santé)

```json
{
  "type": "Feature",
  "geometry": {
    "type": "MultiPolygon",
    "coordinates": [...]
  },
  "properties": {
    "District_S": "Mbalmayo",
    "NAME_1": "Centre",
    "Nom_Region": "Centre",
    "Nom_Dept": "Nyong-et-So'o",
    "POP_TOT": 132400,
    "NB_AIRES": 18,
    "EFF_TOT_A": 214,
    "EFF_ASCP_A": 98,
    "EFF_ACC_A": 42,
    "EFF_APS_A": 31,
    "EFF_PE_A": 18,
    "EFF_MM_A": 15,
    "EFF_RC_A": 10,
    "EFF_TOT_I": 27,
    "PCT_INACT": 11.2,
    "RATIO_ASCP": 1351,
    "RATIO_TOT": 619,
    "CLASSE_CVG": "sous_couverte"
  }
}
```

---

## 5. Migration vers la base de données réelle

### 5.1 Principe d'intégration partagée

> Les deux plateformes (la vôtre et le SIG-ASC MINSANTE) accèdent **à la même base de données**. Chacune interroge la source et reçoit les données qu'elle affiche. Le front-end ne connaît que des GeoJSON : il ne fait pas la différence entre un fichier statique et une réponse d'API.

### 5.2 Point d'intégration unique dans le code

Le **seul fichier à modifier** pour connecter le front à votre base de données est :

**[src/config/coverageConfig.ts](src/config/coverageConfig.ts) — section `GEOJSON_FILES`** (lignes 73–79)

```ts
GEOJSON_FILES: {
  regions:         '/data/regions_5km.geojson',       // ← remplacer par votre URL
  departements:    '/data/departements_5km.geojson',
  arrondissements: '/data/arrondissements_5km.geojson',
  districts_sante: '/data/districts_sante_5km.geojson',
  aires_sante:     '/data/aires_sante_5km.geojson',
},
```

Ces chemins sont consommés par `fetch()` dans [src/components/CouvertureAscMap.tsx](src/components/CouvertureAscMap.tsx) à deux endroits :
- **Lignes 206–228** : préchargement des 4 couches auxiliaires au montage du composant
- **Lignes 651–681** : chargement de la couche active selon le niveau sélectionné

### 5.3 Option A — Remplacement par des GeoJSON régénérés (le plus simple)

Si votre base de données peut exporter des fichiers GeoJSON :

1. Générer les 5 fichiers GeoJSON depuis votre BDD avec les champs décrits en section 4
2. Déposer ces fichiers dans `public/data/` en remplaçant les fichiers existants
3. Aucune modification de code requise

**Contrainte :** le rechargement de la page est nécessaire pour voir les nouvelles données.

### 5.4 Option B — Connexion à une API REST (recommandé pour mise à jour en temps réel)

Exposer un endpoint par niveau géographique qui retourne un GeoJSON valide :

```
GET /api/coverage/geojson?level=regions
GET /api/coverage/geojson?level=departements
GET /api/coverage/geojson?level=districts_sante
GET /api/coverage/geojson?level=aires_sante
```

Puis modifier `GEOJSON_FILES` dans [src/config/coverageConfig.ts](src/config/coverageConfig.ts) :

```ts
GEOJSON_FILES: {
  regions:         'https://api.votre-plateforme.cm/coverage/geojson?level=regions',
  departements:    'https://api.votre-plateforme.cm/coverage/geojson?level=departements',
  arrondissements: 'https://api.votre-plateforme.cm/coverage/geojson?level=arrondissements',
  districts_sante: 'https://api.votre-plateforme.cm/coverage/geojson?level=districts_sante',
  aires_sante:     'https://api.votre-plateforme.cm/coverage/geojson?level=aires_sante',
},
```

**Contrainte CORS :** l'API doit autoriser les requêtes depuis le domaine de la plateforme hôte (`Access-Control-Allow-Origin`).

### 5.5 Garanties que le backend doit respecter

1. **Format GeoJSON valide** — `{ "type": "FeatureCollection", "features": [...] }`
2. **Noms de champs exacts** — voir section 4 (pas d'alias, pas de renommage)
3. **Types numériques stricts** — les effectifs et ratios doivent être des `number`, pas des `string`
4. **`PCT_INACT` calculé côté serveur** — le front ne recalcule pas ce pourcentage ; il l'affiche tel quel
5. **`CLASSE_CVG` calculé côté serveur** — le front ne calcule pas la classe normative ; il la lit et lui associe la couleur
6. **Valeur `null` ou champ absent** — toléré, la zone apparaît en gris hachuré ("sans données")
7. **`RATIO_TOT` calculé côté serveur** — le front n'effectue pas de calcul ; il trie les valeurs pour les quintiles dynamiquement

---

## 6. Module Ciblage ASC — Sources de données spécifiques

Ce module ([src/components/Livrable3RealNeed.tsx](src/components/Livrable3RealNeed.tsx)) utilise des données différentes des GeoJSON de couverture.

### 6.1 Fichiers JSON AccessMod

Ces fichiers contiennent, pour chaque zone et chaque niveau, la population couverte par au moins une FOSA dans un rayon de 5 km :

| Fichier | Niveau |
|---------|--------|
| `public/data/Access5km_nation.json` | National |
| `public/data/Access5km_region.json` | Région |
| `public/data/Access5km_departement.json` | Département |
| `public/data/Access5km_arrondissement.json` | Arrondissement |
| `public/data/Access5km_districts_sante.json` | District de santé |
| `public/data/Access5km_aires_sante.json` | Aire de santé |

Pour alimenter ce module depuis votre BDD, ces fichiers peuvent être remplacés par des exports JSON de votre source, avec le même schéma interne.

### 6.2 Raster de population non couverte

Le fichier `public/data/pop_uncovered_raster.png` est une image raster (grille kilométrique) représentant la densité de population vivant à plus de 5 km de toute FOSA. Il est accompagné de `pop_uncovered_raster.json` qui contient ses métadonnées géospatiales (emprise, résolution, système de projection).

Pour le remplacer par des données actualisées, générer un nouveau raster depuis AccessMod et remplacer les deux fichiers.

---

## 7. Paramètres de configuration supplémentaires

Tous ces paramètres sont dans [src/config/coverageConfig.ts](src/config/coverageConfig.ts) :

### 7.1 Bannière "Données factices"

```ts
SHOW_MOCK_BANNER: false,          // Passer à true pour afficher un bandeau d'avertissement
MOCK_BANNER_TEXT: "DONNÉES FACTICES : ne pas diffuser",
```

Mettre à `false` (déjà le cas) pour que le bandeau n'apparaisse pas en production.

### 7.2 Niveau Arrondissements

```ts
ENABLE_ARRONDISSEMENTS: false,   // Passer à true pour activer ce niveau dans l'interface
```

Ce niveau est désactivé par défaut pour des raisons de performance (360 entités). Activer uniquement si les données sont disponibles.

### 7.3 Seuil minimum pour le calcul du pourcentage d'inactifs (Carte 3b)

```ts
MIN_TOTAL_ASC_FOR_PCT: 5,
```

Une zone dont l'effectif total (actifs + inactifs) est inférieur à 5 est représentée en hachuré clair plutôt qu'avec une couleur de classe, pour éviter les pourcentages non significatifs.

### 7.4 Liste des régions du Cameroun

```ts
REGIONS_LIST: [
  'Adamaoua', 'Centre', 'Est', 'Extrême-Nord', 'Littoral',
  'Nord', 'Nord-Ouest', 'Ouest', 'Sud', 'Sud-Ouest',
]
```

Utilisée pour peupler le sélecteur de filtre régional dans la barre supérieure de la carte.

---

## 8. Fonctionnalités d'export

### 8.1 Export PNG haute résolution (A4 300 DPI)

Déclenché par le bouton **"Exporter / Imprimer la carte"** dans l'en-tête.

La logique d'export est dans [src/utils/coverageExportUtils.ts](src/utils/coverageExportUtils.ts).

Deux modes disponibles :
- **Carte unique** : export de la carte active dans l'orientation choisie (portrait / paysage)
- **Small Multiples** : planche 2×3 comparant les 6 catégories d'effectifs de la Carte 1

Les exports incluent automatiquement :
- La légende adaptée à la carte active
- Les mentions de source (`SOURCES.MAP_SOURCE`)
- Le niveau de découpage et le filtre territorial actif
- La date d'export dans le nom du fichier

### 8.2 Export CSV

Disponible depuis le panneau latéral d'analyse de la Couverture ASC. Exporte les données tabulaires de la couche active avec tous les champs disponibles.

---

## 9. Installation et déploiement

### 9.1 Prérequis

- **Node.js** ≥ 18.x
- **npm** ≥ 9.x

### 9.2 Installation des dépendances

```bash
cd SIG_ASC_DOSTS
npm install
```

### 9.3 Lancement en développement

```bash
npm run dev
# Accessible sur http://localhost:3000
# (ou http://0.0.0.0:3000 pour accès réseau local)
```

### 9.4 Build de production

```bash
npm run build
# Génère le dossier dist/
```

Le contenu de `dist/` peut être servi par n'importe quel serveur HTTP statique (Nginx, Apache, Caddy, etc.).

### 9.5 Prévisualisation du build

```bash
npm run preview
```

### 9.6 Vérification TypeScript (sans build)

```bash
npm run lint
```

---

## 10. Tableau récapitulatif des points d'action

| Action | Fichier à modifier | Ligne(s) | Priorité |
|--------|-------------------|----------|----------|
| Changer la couleur principale | Tous les composants | Global (chercher `#006948`) | Adaptation visuelle |
| Changer le logo | [src/components/Header.tsx](src/components/Header.tsx) | 26 | Adaptation visuelle |
| Changer le titre de l'app | [src/data/mockGisData.ts](src/data/mockGisData.ts) | `appTitle`, `appSubtitle` | Adaptation visuelle |
| Changer les mentions de source | [src/config/coverageConfig.ts](src/config/coverageConfig.ts) | Section `SOURCES` | Adaptation visuelle |
| Changer l'attribution Leaflet | [src/components/CouvertureAscMap.tsx](src/components/CouvertureAscMap.tsx) | 609, 643 | Adaptation visuelle |
| Connecter la base de données | [src/config/coverageConfig.ts](src/config/coverageConfig.ts) | Section `GEOJSON_FILES` | Migration données |
| Connecter les données Ciblage ASC | `public/data/Access5km_*.json` | — (remplacement fichiers) | Migration données |
| Activer le niveau arrondissements | [src/config/coverageConfig.ts](src/config/coverageConfig.ts) | `ENABLE_ARRONDISSEMENTS` | Optionnel |
| Désactiver la bannière factice | [src/config/coverageConfig.ts](src/config/coverageConfig.ts) | `SHOW_MOCK_BANNER` | Production |

---

## 11. Architecture des composants React

```
App (état global : langue, module actif, niveau, basemap, export)
 ├── GuidedTour            (tour de bienvenue, localStorage)
 ├── Header                (logo, titre, sélecteur langue, bouton export)
 ├── Sidebar               (navigation modules, niveaux, paramètres couches)
 └── main
      ├── [module=ciblage-asc]    CiblageAscMap (Livrable3RealNeed.tsx)
      │    └── Livrable3SidePanel
      └── [module=couverture-asc] CouvertureAscMap
           ├── CouvertureAscSidePanel (fiche analyse par zone)
           └── FloatingBasemapSwitcher
```

**Flux de données du module Couverture ASC :**

1. `App.tsx` maintient `spatialLevel` (niveau actif) et `coverageActiveMap` (carte active)
2. Ces états descendent comme props dans `CouvertureAscMap`
3. `CouvertureAscMap` lit `COVERAGE_CONFIG.GEOJSON_FILES[level]` pour connaître l'URL à fetcher
4. Le composant appelle `fetch(url)`, parse le GeoJSON, et met à jour `geoData`
5. Le rendu Leaflet s'adapte automatiquement à la carte active (`activeMap`) et aux données reçues

**Aucune couche Redux, Zustand ou contexte global** : l'état est géré uniquement par React `useState` dans `App.tsx`, propagé par props.

---

## 12. Notes pour la mise en production

### 12.1 CORS
Si les GeoJSON sont servis depuis un domaine différent de celui de l'application, configurer les en-têtes CORS sur le serveur de données.

### 12.2 Performance sur les aires de santé
Le niveau **Aires de santé (1 922 entités)** est le plus lourd. Les GeoJSON actuels sont simplifiés à 5 km de précision (`_5km` dans le nom). Conserver cette simplification géométrique pour maintenir les temps de chargement acceptables (< 3 s).

### 12.3 Tour guidé
Le tour guidé de bienvenue ([src/components/GuidedTour.tsx](src/components/GuidedTour.tsx)) s'affiche à la première visite et stocke sa complétion dans `localStorage` (clé `sig_asc_tour_v1_completed`). Il peut être relancé depuis le pied de la barre latérale.

### 12.4 Vérification du contrat de données
Après connexion à la base de données réelle, ouvrir la console du navigateur (F12) et vérifier l'absence d'avertissements du type :
```
[Couverture ASC] Valeur CLASSE_CVG inconnue : "..." pour l'entité ...
```
Ce message indique que le champ `CLASSE_CVG` contient une valeur non reconnue par la configuration.

---

## 13. Contact et livraison du code

Le code source complet est livré tel quel, avec les données fictives en place. Les 5 fichiers GeoJSON de couverture (`public/data/*_5km.geojson`) et les fichiers AccessMod (`public/data/Access5km_*.json`) sont les seules données à remplacer pour passer en production.

L'ensemble de la logique cartographique, de symbologie et d'export est fonctionnel et testé. Aucune réécriture de la logique de rendu n'est nécessaire pour la migration des données.

---

*Document généré à partir de l'analyse complète du code source — Octobre 2026*
