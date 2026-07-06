# Continuer le travail sur un autre ordinateur

Pour installer et continuer à travailler sur ce projet depuis une autre machine, suivez ces étapes simples :

## 1. Prérequis
Assurez-vous que les outils suivants sont installés sur le nouvel ordinateur :
- **Git** : pour cloner le projet.
- **Node.js** (version 18 ou supérieure recommandée) : pour installer les dépendances et exécuter l'application.

## 2. Cloner le projet
Ouvrez un terminal et exécutez la commande suivante :
```bash
git clone https://github.com/Ab-Ly/suivi-ca-app.git
cd suivi-ca-app
```

## 3. Installer les dépendances
Installez les packages Node.js nécessaires :
```bash
npm install
```

## 4. Configurer les variables d'environnement (Crucial ⚠️)
Créez un fichier nommé `.env` à la racine du projet et collez-y les informations de connexion Supabase suivantes :
```env
VITE_SUPABASE_URL=votre_url_supabase_ici
VITE_SUPABASE_ANON_KEY=votre_cle_anon_supabase_ici
```

> 💡 **Sécurité** : Le fichier `.env` est ignoré par Git (défini dans `.gitignore`) pour protéger vos accès confidentiels. Il doit donc être recréé manuellement sur chaque nouvel ordinateur.

## 5. Lancer l'application localement
Pour démarrer le serveur de développement local :
```bash
npm run dev
```
L'application sera accessible par défaut à l'adresse : `http://localhost:5173`.
