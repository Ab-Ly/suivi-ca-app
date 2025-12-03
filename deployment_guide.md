# Guide de Déploiement - Suivi CA App

Votre application est prête à être déployée sur Netlify. Voici les étapes à suivre pour finaliser la mise en ligne.

## 1. Pré-requis (Déjà fait ✅)
- Le code est poussé sur GitHub (`main` branch).
- Le fichier `netlify.toml` est configuré.
- Le build local fonctionne (`npm run build`).

## 2. Configuration sur Netlify

1.  Connectez-vous à votre compte [Netlify](https://app.netlify.com/).
2.  Cliquez sur **"Add new site"** > **"Import an existing project"**.
3.  Sélectionnez **GitHub**.
4.  Choisissez le dépôt **`suivi-ca-app`**.

## 3. Paramètres de Build

Netlify devrait détecter automatiquement les paramètres grâce au fichier `netlify.toml`, mais vérifiez-les :
-   **Build command** : `npm run build`
-   **Publish directory** : `dist`

## 4. Variables d'Environnement (CRITIQUE ⚠️)

Vous devez ajouter les variables de Supabase dans Netlify pour que l'application fonctionne en ligne.

Allez dans **Site settings** > **Environment variables** et ajoutez :

| Key | Value |
| :--- | :--- |
| `VITE_SUPABASE_URL` | `votre_url_supabase` (voir fichier .env) |
| `VITE_SUPABASE_ANON_KEY` | `votre_clé_anon` (voir fichier .env) |

> **Note** : Vous pouvez copier ces valeurs depuis votre fichier `.env` local.

## 5. Déploiement

Une fois les variables ajoutées, cliquez sur **"Deploy site"**.
Netlify va construire l'application et vous donnera une URL (ex: `https://votre-projet.netlify.app`).

## 6. Vérification

1.  Accédez à l'URL fournie par Netlify.
2.  Connectez-vous avec le compte gérant (`gerant@petrom.ma` / `password123`).
3.  Vérifiez que les données s'affichent correctement.
