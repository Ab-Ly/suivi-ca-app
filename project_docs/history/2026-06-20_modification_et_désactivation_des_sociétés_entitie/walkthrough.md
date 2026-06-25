# Modification et Désactivation des Sociétés (Entities)

J'ai implémenté l'option permettant de modifier le nom des sociétés et de les désactiver/activer à la demande.

## Modifications apportées

### 1. Supabase Database Migration
* Création du fichier de migration [20260620_add_is_active_to_entities.sql](file:///Users/ly/Desktop/antigravity%20project/suivi-ca-app/supabase/migrations/20260620_add_is_active_to_entities.sql) contenant la requête suivante :
  ```sql
  ALTER TABLE daily_cash_entities ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true NOT NULL;
  ```

> [!IMPORTANT]
> **Action requise :** Étant donné que le CLI Supabase n'est pas lié à votre projet distant en local, vous devez copier et exécuter la requête SQL ci-dessus dans l'éditeur SQL de votre **Console Supabase**.

### 2. Frontend React: DailyCashTracking.jsx
* **Imports :** Ajout de l'icône `Pencil` pour l'édition de société.
* **Filtre & Option d'affichage :**
  * Ajout d'une case à cocher **« Afficher les inactives »** au-dessus du tableau. Par défaut, elle est décochée pour masquer les sociétés inactives.
  * Ajout d'un filtre dans le menu déroulant de saisie de transaction pour n'afficher que les entités actives.
* **Mise à jour visuelle :**
  * Les entités inactives s'affichent en opacité réduite, avec leur nom barré et un badge gris `Inactive` pour une distinction immédiate.
* **Modal de modification :**
  * Ajout d'un nouveau bouton avec un crayon (`Pencil`) dans les actions de chaque ligne.
  * Création du modal **« Modifier la Société »** qui s'ouvre au clic pour renommer la société et activer/désactiver son statut via un interrupteur (toggle switch) fluide.

---

## Validation
* Le build de validation s'est exécuté avec succès.
