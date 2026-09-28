# Guide d'intégration et de maintenance — Module Couverture en ASC

Ce document fournit les spécifications techniques, le schéma de données, la configuration et les procédures opérationnelles pour le module **« Couverture en ASC »** de la plateforme SIG ASC DOSTS (MINSANTE Cameroun).

---

## 1. Schéma des données attendu par couche GeoJSON

Toutes les couches géographiques doivent être fournies au format standard **GeoJSON (WGS84 - EPSG:4326)**.

### 1.1 Fichiers et niveaux territoriaux correspondants

| Niveau administratif / sanitaire | Fichier par défaut dans `public/data/` | Champ de population utilisé |
| :--- | :--- | :--- |
| **Aires de santé** (1 922 entités) | `aires_sante_5km.geojson` | `popTotal` (WorldPop carroyée 100 m) |
| **Districts de santé** (211 entités) | `districts_sante_5km.geojson` | `POP_TOT` (Somme des aires recensées) |
| **Départements** (58 entités) | `departements_5km.geojson` | `POP_TOT` (Somme des aires recensées) |
| **Régions** (10 entités) | `regions_5km.geojson` | `POP_TOT` (Somme des aires recensées) |
| **Arrondissements** (360 entités) | `arrondissements_5km.geojson` | `POP_TOT` *(Désactivé par défaut)* |

> **Règle impérative de calcul de population :**
> - Au niveau **Aires de santé**, la population de référence est obligatoirement extraite du champ `popTotal`.
> - Aux niveaux supérieurs (**Districts, Départements, Régions**), la population de référence est obligatoirement extraite du champ `POP_TOT`.
> - Il n'y a **aucun fallback automatique** d'un champ vers l'autre afin de garantir la cohérence mathématique des ratios.

---

### 1.2 Dictionnaire des attributs requis

| Nom du champ | Type | Unité / Format | Description & Rôle |
| :--- | :--- | :--- | :--- |
| `name` / `Nom_AS` / `District_S` | Chaîne | Texte | Libellé officiel de l'entité territoriale ou sanitaire. |
| `region` / `Nom_Region` | Chaîne | Texte | Région de rattachement administratif / sanitaire. |
| `dept` / `Nom_Dept` | Chaîne | Texte | Département de rattachement. |
| `district` / `Code_DS` | Chaîne | Texte | District de santé de rattachement. |
| `popTotal` | Nombre | Habitants | Population carroyée WorldPop de l'aire de santé. |
| `POP_TOT` | Nombre | Habitants | Population consolidée de la zone (somme des aires composantes). |
| `EFF_TOT_A` | Entier | Personnes | **Total des ASC actifs** (toutes catégories confondues). |
| `EFF_ASCP_A` | Entier | Personnes | **Effectif des Agents de Santé Communautaire Polyvalents (ASCp) actifs**. |
| `EFF_ACC_A` | Entier | Personnes | Effectif des Agents de Communication et Relais (ACCRA) actifs. |
| `EFF_APS_A` | Entier | Personnes | Effectif des Agents Polyvalents de Santé (APS) actifs. |
| `EFF_PE_A` | Entier | Personnes | Effectif des Pairs Éducateurs (PE) actifs. |
| `EFF_MM_A` | Entier | Personnes | Effectif des Mères Mentors (MM) actives. |
| `EFF_RC_A` | Entier | Personnes | Effectif des Relais Communautaires (RC) actifs. |
| `EFF_TOT_I` | Entier | Personnes | **Total des ASC inactifs** (à remplacer). |
| `PCT_INACT` | Flottant | Pourcentage (%) | Part d'inactifs : `(EFF_TOT_I / (EFF_TOT_A + EFF_TOT_I)) * 100`. |
| `RATIO_ASCP` | Flottant | Hab. / ASCp | Ratio de couverture ASCp : `Population / EFF_ASCP_A`. |
| `RATIO_TOT` | Flottant | Hab. / ASC | Ratio de couverture globale : `Population / EFF_TOT_A`. |
| `CLASSE_CVG` | Chaîne | Enumération | Classe normative de couverture en ASCp (voir valeurs autorisées). |
| `NB_AIRES` | Entier | Unités | Nombre d'aires de santé composant l'entité (`null` sur les aires). |

---

### 1.3 Valeurs autorisées pour `CLASSE_CVG`

Le champ `CLASSE_CVG` pilote la sémiologie graphique de la **Carte 2a**. Seules les 5 valeurs ci-dessous sont autorisées :

| Valeur technique | Libellé affiché | Seuil normatif | Couleur HEX |
| :--- | :--- | :--- | :--- |
| `couverte` | Conforme (≤ 1 000) | Ratio ≤ 1 000 habitants par ASCp | `#16a34a` (Vert) |
| `couverte_si_urbain` | Conforme si urbain (1 000 - 2 499) | 1 000 < Ratio < 2 500 habitants par ASCp | `#ea580c` (Orange) |
| `sous_couverte` | Sous-couverte (≥ 2 500) | Ratio ≥ 2 500 habitants par ASCp | `#dc2626` (Rouge) |
| `aucun_ascp_actif` | Aucun ASCp actif | Effectif `EFF_ASCP_A` = 0 | `#7f1d1d` (Bordeaux) |
| `pop_manquante` | Population non disponible | Donnée de population absente ou nulle | `#94a3b8` (Gris) |

*Toute entité ayant `CLASSE_CVG: null` (ex. districts sans découpage en aires) est automatiquement rendue en motif **hachuré gris** (`#94a3b8`) avec la mention « Découpage en aires de santé non disponible ».*

---

## 2. Procédure de remplacement des données factices par les données réelles

Le passage aux données réelles de l'enquête nationale ou de la base MINSANTE ne requiert **aucune modification de code TypeScript / React**.

### Étape 1 : Préparation et vérification des fichiers GeoJSON
Avant le dépôt, exécuter les contrôles de qualité suivants sur les fichiers réels :
1. **Unicité et exactitude des totaux** :
   - Vérifier que `sum(EFF_TOT_A)`, `sum(EFF_ASCP_A)` et `sum(EFF_TOT_I)` sont strictement identiques sur les 4 couches : `aires_sante_5km.geojson`, `districts_sante_5km.geojson`, `departements_5km.geojson` et `regions_5km.geojson`.
2. **Conformité des calculs** :
   - Vérifier que `RATIO_ASCP = round(Population / EFF_ASCP_A)`.
   - Vérifier que `CLASSE_CVG` respecte scrupuleusement les 5 libellés énumérés ci-dessus.
3. **Absence de valeurs textuelles erronées** :
   - Aucune chaîne `"NaN"`, `"null"`, `"undefined"` ne doit être présente dans les propriétés (utiliser `null` natif en JSON).

### Étape 2 : Dépose des fichiers
Remplacer les fichiers dans le répertoire public du projet :
```text
public/data/
├── aires_sante_5km.geojson
├── districts_sante_5km.geojson
├── departements_5km.geojson
├── regions_5km.geojson
└── arrondissements_5km.geojson (lorsque disponible)
```

### Étape 3 : Désactivation du bandeau et du filigrane « Données factices »
Ouvrir le fichier de configuration centralisé [`src/config/coverageConfig.ts`](file:///d:/Courses%20and%20trainings/WebGIS/SIG_ASC_DOSTS/src/config/coverageConfig.ts) et passer le paramètre :
```typescript
// Passer de true à false :
SHOW_MOCK_BANNER: false,
```
Cette modification unique :
- Masque automatiquement le bandeau d'alerte orange au sommet de la carte web.
- Retire automatiquement le filigrane diagonal *"DONNÉES FACTICES : NE PAS DIFFUSER"* sur tous les exports haute définition (PNG A4 300 DPI, cartes uniques et planches comparatives).

---

## 3. Paramètres du fichier de configuration (`coverageConfig.ts`)

Le fichier [`src/config/coverageConfig.ts`](file:///d:/Courses%20and%20trainings/WebGIS/SIG_ASC_DOSTS/src/config/coverageConfig.ts) centralise l'intégralité des règles métier :

| Clé de configuration | Type | Valeur par défaut | Effet / Description |
| :--- | :--- | :--- | :--- |
| `SHOW_MOCK_BANNER` | `boolean` | `true` | Active/désactive le bandeau d'alerte UI et le filigrane d'export. |
| `MOCK_BANNER_TEXT` | `string` | `"DONNÉES FACTICES..."` | Texte affiché dans le bandeau et le filigrane. |
| `ENABLE_ARRONDISSEMENTS` | `boolean` | `false` | Masque (`false`) ou active (`true`) le niveau administratif Arrondissement. |
| `MIN_TOTAL_ASC_FOR_PCT` | `number` | `5` | Seuil d'effectif minimum (actifs + inactifs). Si total < 5, la zone est hachurée clair sur la carte 3b pour éviter les pourcentages trompeurs (ex: 1 inactif sur 1 ASC = 100%). |
| `FIELDS` | `object` | *(Mapping)* | Centralise les noms exacts des champs attributaires dans les GeoJSON. |
| `GEOJSON_FILES` | `object` | *(Chemins)* | Chemins relatifs d'accès aux fichiers GeoJSON dans `/data/`. |
| `ASC_CATEGORIES` | `array` | *(7 catégories)* | Liste, libellés, infobulles et codes couleurs des types d'ASC (Carte 1). |
| `NORMATIVE_CLASSES` | `object` | *(5 classes)* | Définition des paliers et couleurs de la Carte 2a (daltonien-compatibles). |
| `RATIO_TOT_PALETTE` | `string[]` | *(5 bleus)* | Dégradé séquentiel pour la classification par quantiles (Carte 2b). |
| `PCT_INACT_CLASSES` | `array` | *(5 seuils)* | Seuils fixes et palette pour la part d'inactifs (Carte 3b). |
| `LOW_ASC_STYLE` | `object` | *(Libellé)* | Libellé et style de la mention d'effectif trop faible (< 5 ASC). |
| `NO_DATA_STYLE` | `object` | *(Hachures)* | Style de rendu pour absence de données / absence d'aires composantes. |
| `SOURCES` | `object` | *(Mentions)* | Textes des sources officielles et notes normatives intégrées dans les exports. |

---

## 4. Procédure de réactivation du niveau Arrondissement

Le niveau administratif « Arrondissement » (360 entités) est actuellement **désactivé par défaut** conformément aux spécifications DOSTS, car les effectifs d'ASC sont recensés par structure sanitaire (aire de santé) et non par découpage municipal.

Dès que les effectifs réels par arrondissement déclaré seront collectés :
1. Déposer le GeoJSON enrichi avec les attributs requis dans `public/data/arrondissements_5km.geojson`.
2. Ouvrir [`src/config/coverageConfig.ts`](file:///d:/Courses%20and%20trainings/WebGIS/SIG_ASC_DOSTS/src/config/coverageConfig.ts).
3. Modifier la constante :
   ```typescript
   ENABLE_ARRONDISSEMENTS: true,
   ```
4. Le bouton « Arrondissements (360) » réapparaîtra automatiquement dans le sélecteur de découpage territorial du panneau latéral gauche sans aucun changement de composant.

---

## 5. Limites méthodologiques et particularités connues

1. **Les 6 districts de santé sans aires de santé cartographiées** :
   - Les districts suivants : **Gawar**, **Nkolafamba**, **Ngambe Tikar**, **Tourou**, **Kaïkaï**, et **Mayo Baléo** ne disposent pas de polygones d'aires de santé dans le référentiel cartographique national actuel.
   - Par conséquent, leurs attributs d'effectifs agrégés (`EFF_TOT_A`, `EFF_ASCP_A`, etc.) et d'indicateurs de couverture (`CLASSE_CVG`, `RATIO_ASCP`, `PCT_INACT`) ont la valeur `null`.
   - Ils sont conventionnellement rendus en **motif gris hachuré** sur l'ensemble des 5 cartes, avec la mention *"Découpage en aires de santé non disponible"*.
2. **Non-emboîtement strict du niveau Arrondissement et du système Sanitaire** :
   - Les limites des arrondissements administratifs et des districts / aires de santé ne se superposent pas géométriquement.
   - Les totaux par arrondissement ne peuvent pas être obtenus par simple sommation spatiale des aires de santé sans introduire de doubles comptes. Ils doivent provenir d'une affectation directe par lieu de rattachement déclaré de l'ASC.
3. **Seuils de quantiles (Carte 2b)** :
   - Les 5 classes par quantiles de la Carte 2b sont calculées sur l'intégralité des zones du niveau sélectionné (échelle nationale) et demeurent stables lors de l'application d'un filtre régional pour permettre des comparaisons rigoureuses entre territoires.
