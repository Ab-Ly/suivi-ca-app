# Rapport d'exécution - Script d'extraction Petrom (Version Playwright)

Le script de scraping a été entièrement migré vers **Playwright** pour automatiser l'interaction avec le navigateur comme demandé, tout en assurant une compatibilité à 100% avec les restrictions du serveur.

---

## 🔍 Architecture de l'automatisation Playwright

### 1. Contournement des erreurs TLS v1.0 par protocole HTTP
* **Problème** : Le serveur utilise un protocole HTTPS obsolète (TLS v1.0 avec certificat de 2005) qui bloque le moteur Chromium de Playwright (`ERR_SSL_VERSION_OR_CIPHER_MISMATCH`).
* **Solution** : Le script a été configuré pour naviguer exclusivement en **HTTP** (port 80) : `http://portail.petrom.ma`. Puisque le protocole HTTP n'utilise pas de chiffrement SSL/TLS, la connexion se fait instantanément et sans aucune restriction de navigateur.

### 2. Gestion de l'authentification et de la session
* **Séquence d'automatisation** :
  1. Chargement de `http://portail.petrom.ma/index.php` (page contenant le formulaire de connexion).
  2. Remplissage des champs `username` et `password` via `page.fill()`.
  3. Soumission directe du formulaire en JavaScript : `document.getElementById('login_form').submit()`.
  4. Boucle de surveillance active pour attendre que l'URL devienne `home.php`. Cela permet à la redirection JavaScript de se terminer proprement avant de naviguer vers d'autres pages.
  5. Chargement de `http://portail.petrom.ma/Rapports-Journaliers/rapports.php`.

### 3. Saisie de la date en lecture seule (Readonly)
* Le champ de saisie de la date `RapDate` sur le portail possède un attribut HTML `READONLY`, ce qui empêche d'utiliser la fonction standard `page.fill()`.
* **Solution** : Le script injecte la date cible directement en modifiant la propriété du DOM via JavaScript : `document.getElementById('RapDate').value = '01/06/2026'`.

### 4. Filtrage et fusion des transactions
* Le script récupère le contenu HTML complet après soumission de la recherche.
* Il utilise Pandas pour parser le HTML et ne filtre que les tableaux de données contenant `N° Trns` et `Heure` (qui correspondent aux transactions par cartes, contenant la colonne temporelle à nettoyer).
* Les heures (ex: `11:53:59`) sont automatiquement converties en **heures décimales** (ex: `11.900`) et les guillemets parasites sont supprimés.

---

## 🧪 Résultats de validation en Production (Playwright)

### Lancement pour le 01-06-2026 :
```bash
./run.sh --date 01-06-2026
```
* **Journal d'exécution** :
  ```text
  Extraction programmée pour la date: 01/06/2026
  Lancement de Playwright (Headed=False)...
  1. Connexion au portail index.php...
  2. Saisie des identifiants...
  3. Soumission du formulaire de connexion...
  Connexion réussie.
  4. Chargement de la page de rapports: http://portail.petrom.ma/Rapports-Journaliers/rapports.php
  5. Saisie de la date du rapport: 01/06/2026
  6. Soumission de la recherche...
  7. Analyse du contenu de la page...
     Nombre de tableaux HTML détectés: 18
     Tableau de transactions identifié (Tableau #12, 4 lignes).
     Tableau de transactions identifié (Tableau #13, 2 lignes).
     Tableau de transactions identifié (Tableau #14, 1 lignes).
     Fusion des 3 tableaux réussie. Total de 7 transactions.
  8. Nettoyage et formatage des données...
  9. Exportation vers le fichier Excel...
  Chargement du fichier existant: Rapport_Petrom_Insert_Carte.xlsx
  Données fusionnées. Doublons supprimés: 7 lignes.
  Sauvegarde réussie dans Rapport_Petrom_Insert_Carte.xlsx (Total: 13 lignes).

  Extraction et exportation terminées avec succès.
  ```

### Lancement pour le 02-06-2026 :
```bash
./run.sh --date 02-06-2026
```
* **Journal d'exécution** :
  ```text
  Extraction programmée pour la date: 02/06/2026
  Lancement de Playwright (Headed=False)...
  1. Connexion au portail index.php...
  ...
  Analyse du contenu de la page...
     Nombre de tableaux HTML détectés: 17
     Tableau de transactions identifié (Tableau #12, 1 lignes).
     Tableau de transactions identifié (Tableau #13, 2 lignes).
     Fusion des 2 tableaux réussie. Total de 3 transactions.
  ...
  Chargement du fichier existant: Rapport_Petrom_Insert_Carte.xlsx
  Données fusionnées. Doublons supprimés: 3 lignes.
  Sauvegarde réussie dans Rapport_Petrom_Insert_Carte.xlsx (Total: 13 lignes).
  ```

---

## 🚀 Utilisation de production

* **Lancer l'extraction pour hier (production quotidienne en arrière-plan)** :
  ```bash
  ./run.sh
  ```

* **Lancer l'extraction pour une date historique spécifique** :
  ```bash
  ./run.sh --date DD-MM-YYYY
  ```

* **Lancer l'extraction avec le navigateur visible à l'écran (Headed Mode)** :
  Si vous souhaitez voir le robot ouvrir le navigateur, taper les identifiants et cliquer à l'écran, rajoutez le paramètre `--headed` :
  ```bash
  ./run.sh --date 02-06-2026 --headed
  ```
