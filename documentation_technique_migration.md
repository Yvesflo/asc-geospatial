# Migration des données cartographiques vers une source dynamique côté serveur

## 1. Objet

Le présent document décrit la structure actuelle des données cartographiques du module, les points d’intégration techniques existants et les recommandations pour la migration vers une source dynamique côté serveur.

Le but est de permettre à une équipe de développement d’alimenter les cartes à partir d’une base de données ou d’un backend, sans réécrire la logique d’affichage actuelle.

### État actuel

La version actuelle du module est basée sur Leaflet. Les cartes opérationnelles utilisent les fichiers GeoJSON décrits dans ce document.

## 2. Contexte

Le module cartographique actuel est une application front-end développée en React/Vite avec Leaflet pour l’affichage de couches géographiques. Les cartes sont alimentées par des fichiers GeoJSON statiques stockés dans le dossier public/data.

Les fichiers principaux concernés sont :
- src/config/coverageConfig.ts
- src/components/CouvertureAscMap.tsx
- public/data/

## 3. Points d’intégration techniques

Les éléments clés à connaître pour la migration sont :

- configuration des niveaux et des champs :
  src/config/coverageConfig.ts

- chargement des données GeoJSON selon le niveau :
  src/components/CouvertureAscMap.tsx

- logique de rendu cartographique selon la carte active :
  src/components/CouvertureAscMap.tsx

## 4. Source de données actuelle

Les cartes utilisent actuellement des fichiers GeoJSON de type :

- regions_5km.geojson
- departements_5km.geojson
- districts_sante_5km.geojson
- aires_sante_5km.geojson

Ces fichiers sont chargés côté client avec des appels fetch, à partir du composant principal de la carte.

## 5. Schéma de données attendu par le front

Les GeoJSON doivent contenir des propriétés avec les champs suivants.

### 5.1 Champs de population
- POP_TOT
- popTotal

### 5.2 Champs d’effectifs actifs
- EFF_TOT_A
- EFF_ASCP_A
- EFF_ACC_A
- EFF_APS_A
- EFF_PE_A
- EFF_MM_A
- EFF_RC_A

### 5.3 Champs d’effectifs inactifs
- EFF_TOT_I
- PCT_INACT

### 5.4 Champs de couverture
- RATIO_ASCP
- RATIO_TOT
- CLASSE_CVG

### 5.5 Champs de libellés / hiérarchie
- NAME_1
- NAME_2
- NAME_3
- District_S
- Nom_AS

Les clés exactes sont centralisées dans le fichier de configuration :
- src/config/coverageConfig.ts

## 6. Mappage actuel entre cartes et champs affichés

Le module affiche une information différente selon la carte active.

### Carte 1 – Effectifs
- source : selectedCategoryField
- valeurs possibles :
  - EFF_TOT_A
  - EFF_ASCP_A
  - EFF_ACC_A
  - EFF_APS_A
  - EFF_PE_A
  - EFF_MM_A
  - EFF_RC_A

### Carte 2a – Couverture normative ASCp
- source : CLASSE_CVG

### Carte 2b – Ratios toutes catégories
- source : RATIO_TOT

### Carte 3a – ASC inactifs à remplacer
- source : EFF_TOT_I

### Carte 3b – Part d’ASC inactifs
- source : PCT_INACT

Cette logique est implémentée dans le composant de rendu cartographique :
- src/components/CouvertureAscMap.tsx

## 7. Problème actuel

L’application est actuellement alimentée par des fichiers statiques internes. Elle ne dispose pas encore d’une source de données centralisée, évolutive et persistante côté serveur. Cela limite la mise à jour des métriques et la prise en charge d’un système de gestion des données plus robuste.

## 8. Besoin fonctionnel

Le système cible doit permettre :
- la mise à jour des données depuis un backend,
- la mise à jour automatique des cartes sans reconstruire le front,
- la maintenance des données sans modifier la logique de rendu,
- l’extension future vers d’autres sources ou niveaux de données.

## 9. Recommandation d’architecture

Le backend doit exposer des données au même format que celui attendu par le front :
- GeoJSON valide
- features avec propriétés structurées
- mêmes noms de champs que ceux définis dans la configuration

Le backend peut proposer :
- un endpoint par niveau géographique,
- ou un endpoint unique avec paramètre level.

Exemples :
- /api/coverage?level=regions
- /api/coverage?level=departements
- /api/coverage?level=districts_sante
- /api/coverage?level=aires_sante

## 10. Contrat de données à respecter

Le backend doit garantir que chaque objet GeoJSON renvoyé contient :
- des propriétés nommées exactement comme attendu par le front,
- des valeurs numériques cohérentes,
- les libellés et hiérarchies géographiques nécessaires,
- des données mises à jour sans rupture de contrat.

## 11. Point d’intégration recommandé

Le point d’intégration idéal pour l’alimentation dynamique est :
- configuration des champs et des fichiers : src/config/coverageConfig.ts
- chargement des données : src/components/CouvertureAscMap.tsx

Ces deux points doivent rester la couche d’abstraction entre le front et la source de données. La logique de rendu ne doit pas être réécrite pour s’adapter à une nouvelle source.

## 12. Conclusion

Le système actuel est déjà construit pour supporter une source de données dynamique. Il suffit de maintenir le même contrat de données côté backend afin de garantir la cohérence du rendu cartographique.

La migration ne doit donc pas consister à reconstruire les cartes, mais à remplacer la source de données, tout en conservant :
- la structure existante,
- les champs attendus,
- la logique de rendu et de catégorisation,
- la hiérarchie territoriale.

---

# Mail de transfert

Objet : Migration des cartes vers une source de données dynamique

Bonjour,

Je vous transmet ci-joint la documentation technique du module cartographique ainsi que le code associé.

Le but est de migrer l’alimentation des cartes depuis des fichiers statiques vers une source de données dynamique côté serveur, sans modifier la logique actuelle de rendu et de symbologie.

## Contexte

Le module cartographique actuel est alimenté par des fichiers GeoJSON présents dans le dossier public/data. Ces fichiers sont chargés côté front dans le composant principal de la carte.

Les éléments de référence sont :
- src/config/coverageConfig.ts
- src/components/CouvertureAscMap.tsx
- public/data/

## Données attendues par le front

Les GeoJSON doivent contenir les propriétés suivantes :

### Population
- POP_TOT
- popTotal

### Effectifs actifs
- EFF_TOT_A
- EFF_ASCP_A
- EFF_ACC_A
- EFF_APS_A
- EFF_PE_A
- EFF_MM_A
- EFF_RC_A

### Effectifs inactifs
- EFF_TOT_I
- PCT_INACT

### Couverture
- RATIO_ASCP
- RATIO_TOT
- CLASSE_CVG

### Noms / hiérarchie
- NAME_1
- NAME_2
- NAME_3
- District_S
- Nom_AS

Le mapping exact des cartes est le suivant :
- Carte 1 : selectedCategoryField
- Carte 2a : CLASSE_CVG
- Carte 2b : RATIO_TOT
- Carte 3a : EFF_TOT_I
- Carte 3b : PCT_INACT

Le point important est que le front n’attend pas un CSV unique, mais des GeoJSON structurés avec des propriétés cohérentes.

## Objectif de migration

Le backend devra fournir les mêmes données au même format afin de permettre :
- la mise à jour des informations depuis le serveur,
- la mise à jour automatique des cartes,
- la conservation du comportement fonctionnel actuel.

Le backend peut exposer :
- un endpoint par niveau territorial,
- ou un endpoint unique avec paramètre level.

Exemples :
- /api/coverage?level=regions
- /api/coverage?level=departements
- /api/coverage?level=districts_sante
- /api/coverage?level=aires_sante

Le contrat de données doit rester compatible avec le front existant.

Le point d’intégration clé est :
- src/config/coverageConfig.ts
- src/components/CouvertureAscMap.tsx

Ces éléments doivent rester le point de contact entre le front et la donnée, sans recoder la logique du rendu.

Merci de regarder cette documentation avant de proposer l’architecture backend de données.

Cordialement,

[Votre nom]
