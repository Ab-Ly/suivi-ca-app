# Walkthrough : Carburant & Lubrifiant - Suivi des Tarifs & Marge Brute

Nous avons implémenté avec succès les fonctionnalités pour le suivi des prix d'achat/vente et le calcul de la marge brute pour le carburant et les lubrifiants. Tout le code compile et build sans erreur.

## Changements apportés

### 1. Base de données (Supabase)
Nous avons préparé le script d'initialisation de la base de données. L'application vérifie automatiquement à chaque chargement si la base de données est prête. Si des éléments manquent, un écran d'avertissement moderne explique comment exécuter le script SQL dans Supabase.
- **Table `fuel_prices`** : Stocke l'historique des prix d'achat et de vente pour le Gasoil et le Sans Plomb (SSP) par date d'effet.
- **Colonne `purchase_price` dans `articles`** : Stocke le prix d'achat unitaire des lubrifiants.

### 2. Interface Utilisateur refactorée
Le fichier [OperatingExpenses.jsx](file:///Users/ly/Desktop/antigravity%20project/suivi-ca-app/src/components/OperatingExpenses.jsx) a été refondu avec des onglets :
- **Charges Générales** : L'interface existante de gestion des coûts d'exploitation généraux (Loyer, Electricité, Eau, etc.).
- **Configuration des Prix** :
  - **Carburants** : Formulaire pour enregistrer les tarifs (Achat/Vente) à une date d'effet et tableau historique.
  - **Lubrifiants** : Tableau éditable avec barre de recherche pour renseigner en direct le prix d'achat et le prix de vente de chaque lubrifiant.
- **Calcul de Marge Brute** :
  - Sélection de la période par filtre de date (Date début / Date fin).
  - KPI Cards : CA Global, Coût d'achat global, Marge brute (MAD), et Taux de marge moyen (%).
  - Tableau d'analyse détaillé : Gasoil, SSP et Lubrifiants avec volumes/quantités vendus, chiffre d'affaires, coût d'achat, marge brute et taux de marge individuel.
  - Graphique à secteurs (Pie/Donut Chart) de répartition de la marge brute.

## Formules de calcul appliquées

1. **Carburants (Gasoil, SSP)** :
   - Pour chaque vente de carburant enregistrée dans `fuel_sales` à une date $D$, le système recherche le prix actif dans `fuel_prices` ($\text{date} \le D$ la plus récente).
   - $\text{Chiffre d'Affaires} = \text{Volume (L)} \times \text{Prix de Vente}$
   - $\text{Coût d'Achat} = \text{Volume (L)} \times \text{Prix d'Achat}$
   - $\text{Marge Brute} = \text{CA} - \text{Coût d'Achat}$

2. **Lubrifiants** :
   - Pour chaque vente enregistrée dans `sales` appartenant aux catégories de lubrifiants :
   - $\text{Chiffre d'Affaires} = \text{Revenu total de la vente}$
   - $\text{Coût d'Achat} = \text{Quantité vendue} \times \text{articles.purchase_price}$
   - $\text{Marge Brute} = \text{CA} - \text{Coût d'Achat}$

## Validation
- **Vérification du Build** : Une compilation complète du projet a été effectuée avec `npm run build` et s'est terminée avec succès.
