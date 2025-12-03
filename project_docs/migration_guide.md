# Guide de Migration du Projet (Via GitHub)

Ce guide vous explique comment transférer votre projet "SUIVI CA APP" vers un nouvel ordinateur en utilisant GitHub.

## Étape 1 : Créer le dépôt sur GitHub (Sur ce PC)

1.  Connectez-vous à votre compte [GitHub](https://github.com).
2.  Cliquez sur le bouton **+** en haut à droite et sélectionnez **New repository**.
3.  Nommez le dépôt (ex: `suivi-ca-app`).
4.  Laissez-le en **Private** (Privé) pour sécuriser votre code.
5.  Ne cochez **aucune** case (pas de README, pas de .gitignore).
6.  Cliquez sur **Create repository**.

## Étape 2 : Envoyer le code (Sur ce PC)

J'ai déjà préparé le code sur votre ordinateur actuel. Il vous suffit de le lier à GitHub.
Copiez et exécutez ces commandes dans votre terminal (l'une après l'autre) :

```bash
# Remplacez l'URL ci-dessous par celle de VOTRE nouveau dépôt GitHub
git remote add origin https://github.com/VOTRE_NOM_UTILISATEUR/suivi-ca-app.git

# Envoyez le code
git branch -M main
git push -u origin main
```

> **Note** : Une fenêtre de connexion GitHub peut s'ouvrir. Connectez-vous pour autoriser l'envoi.

## Étape 3 : Récupérer le projet (Sur le NOUVEAU PC)

1.  Installez **Node.js** (version LTS) et **Git** sur le nouvel ordinateur.
2.  Ouvrez un terminal (ou Git Bash) dans le dossier où vous voulez mettre le projet.
3.  Clonez le dépôt :

```bash
git clone https://github.com/VOTRE_NOM_UTILISATEUR/suivi-ca-app.git
```

4.  Entrez dans le dossier :

```bash
cd suivi-ca-app
```

## Étape 4 : Configuration Finale (Sur le NOUVEAU PC)

C'est l'étape la plus importante. Vos clés secrètes ne sont pas sur GitHub.

1.  Créez un nouveau fichier nommé `.env` à la racine du projet.
2.  Ouvrez le fichier `.env` de **ce PC** (l'ancien), copiez tout son contenu.
3.  Collez ce contenu dans le fichier `.env` du **nouveau PC**.
4.  Installez les dépendances :

```bash
npm install
```

5.  Lancez l'application :

```bash
npm run dev
```

Votre application est maintenant prête sur le nouvel ordinateur !
