# Revue de Performance 2025 - Walkthrough

## Vue d'ensemble
J'ai ajouté un nouveau module "Revue de Performance" qui vous permet de présenter les résultats de 2025 comparés à 2024 sous forme de slides interactifs.

## Comment y accéder
1.  Ouvrez l'application.
2.  Dans le menu latéral, cliquez sur **"Revue 2025"** (avec l'icône de lecture).

<img src="/Users/ly/Desktop/antigravity project/suivi-ca-app/src/components/ui/revue-link.png" alt="Lien Revue 2025" />

## Fonctionnalités
-   **Slide 1 (Couverture)** : Affiche le CA global et le Volume Total de 2025 avec la croissance par rapport à 2024.
-   **Slide 2 (Analyse CA)** : Graphique comparatif mensuel du chiffre d'affaires.
-   **Slide 3 (Détail Catégories)** : Grille détaillée avec montants en **KDH**, écart en valeur exact, et icônes visuelles.
-   **Slide 4 (Analyse Volume)** : Vue scindée (Gasoil / SSP) avec comparaison barres side-by-side et tableau mensuel détaillé en **m³** avec séparateurs de milliers.

## Navigation
-   Utilisez les flèches en haut à droite pour changer de slide.
-   Cliquez sur la croix (X) en haut à gauche pour revenir au tableau de bord.

## Vérification Technique
-   **Données** : Les graphiques utilisent les mêmes données que vos statistiques habituelles (`fuel_sales`, `sales`, `historical_sales`).
-   **Sécurité** : La page est protégée et nécessite d'être connecté.
