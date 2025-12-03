# Guide de Génération APK Android - Suivi CA App

Votre projet est maintenant configuré pour Android avec Capacitor. Voici comment générer le fichier `.apk` final.

## 1. Pré-requis
-   **Android Studio** doit être installé sur votre ordinateur.
-   Java JDK (généralement inclus avec Android Studio).

## 2. Ouvrir le projet dans Android Studio

1.  Ouvrez un terminal dans le dossier du projet.
2.  Lancez la commande suivante pour ouvrir le projet Android :
    ```bash
    npx cap open android
    ```
    *Ou ouvrez manuellement le dossier `android` situé dans votre projet via Android Studio.*

## 3. Générer l'APK

Une fois Android Studio ouvert et le projet chargé (cela peut prendre quelques minutes la première fois pour télécharger les dépendances Gradle) :

1.  Allez dans le menu **Build**.
2.  Sélectionnez **Build Bundle(s) / APK(s)** > **Build APK(s)**.
3.  Android Studio va compiler l'application.
4.  Une fois terminé, une notification apparaîtra en bas à droite. Cliquez sur **locate** pour trouver votre fichier `app-debug.apk`.

## 4. Mettre à jour l'application

Si vous faites des modifications dans le code React (fichiers `.jsx`, `.css`, etc.) :

1.  Reconstruisez l'application web :
    ```bash
    npm run build
    ```
2.  Synchronisez les changements vers Android :
    ```bash
    npx cap sync
    ```
3.  Relancez la compilation dans Android Studio (étape 3).

## 5. Icône et Splash Screen (Optionnel)

Pour changer l'icône de l'application, vous pouvez utiliser l'outil `capacitor-assets` ou remplacer manuellement les fichiers dans `android/app/src/main/res/`.
