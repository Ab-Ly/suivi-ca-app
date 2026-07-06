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
VITE_SUPABASE_URL=https://zzllzyijkwrihxxqucve.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp6bGx6eWlqa3dyaWh4eHF1Y3ZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ3MTA1MzYsImV4cCI6MjA4MDI4NjUzNn0.1cNKh6Bss4fU5RSiw0WPFA0tgasbw3L5F7RFPU_SSJQ
```

> 💡 **Sécurité** : Le fichier `.env` est ignoré par Git (défini dans `.gitignore`) pour protéger vos accès confidentiels. Il doit donc être recréé manuellement sur chaque nouvel ordinateur.

## 5. Lancer l'application localement
Pour démarrer le serveur de développement local :
```bash
npm run dev
```
L'application sera accessible par défaut à l'adresse : `http://localhost:5173`.
