# TempoList - Extension Chrome

Extension Chrome pour le suivi de l'avancement du remplissage de listes de fournitures scolaires avec automatisation pour la sélection "Commune".

## 🚀 Fonctionnalités

### Suivi de progression
- Compteur de listes complétées
- Visualisation du progrès avec anneau de progression
- Gestion par équipes
- Historique des journées

### 🔄 Automatisation "Commune" (NOUVEAU)
Cette fonctionnalité vous permet d'automatiser la sélection de l'option "Commune" dans les listes déroulantes et **progresse automatiquement de ligne en ligne**.

#### Comment utiliser :

1. **Sur votre site de liste de fournitures :**
   - Faites un **clic droit** sur le champ de liste déroulante où vous voulez commencer
   - Sélectionnez **"🔄 Auto-remplir Commune"** dans le menu contextuel

2. **L'automatisation intelligente démarre :**
   - Une notification apparaît en haut à droite
   - Un panneau de débogage s'affiche en haut à gauche
   - L'extension répète automatiquement pour chaque ligne :
     - ✅ Sélection directe de "Commune" (sans navigation clavier)
     - ➡️ **Passage automatique à la ligne suivante**
     - 📜 Défilement automatique si nécessaire
     - ⏭️ **Ignore les lignes déjà remplies**

3. **Progression automatique :**
   - **Détection AG-Grid** : Reconnait les lignes de votre grille
   - **Navigation intelligente** : Passe de row-index 28 → 29 → 30...
   - **Défilement adaptatif** : Charge de nouvelles lignes si nécessaire
   - **Arrêt intelligent** : S'arrête automatiquement quand une matière est déjà sélectionnée
   - **Commence à la ligne cliquée** : Plus de démarrage à la première ligne !

4. **Pour arrêter :**
   - Appuyez sur la touche **Échap** ⚠️
   - Ou faites clic droit → **"⏹️ Arrêter l'automatisation"**
   - Ou cliquez sur **✕** dans le panneau de débogage

#### Fonctionnalités intelligentes :
- **Démarrage précis** : Commence exactement à la ligne sur laquelle vous cliquez
- **Sélection directe** : Plus besoin de navigation clavier (R + flèches)
- **Arrêt automatique** : Détecte la fin du bloc "Commune" quand une autre matière est sélectionnée
- **Gestion des lignes déjà remplies** : Ignore automatiquement les lignes déjà traitées
- **Délai optimisé** : 800ms entre chaque ligne pour une vitesse idéale

## 📦 Installation

1. Téléchargez ou clonez le projet
2. Ouvrez Chrome et allez dans `chrome://extensions/`
3. Activez le "Mode développeur"
4. Cliquez sur "Charger l'extension non empaquetée"
5. Sélectionnez le dossier du projet

## 🛠️ Utilisation

### Interface principale
- **Compteur central :** Affiche le nombre de listes complétées / objectif
- **Boutons +/- :** Incrémente/décrémente le compteur
- **Sélection d'équipe :** Active une équipe pour les calculs de temps
- **Statistiques :** Temps moyen, temps théorique, projection

### Navigation
- **Options :** Configuration des équipes et objectifs
- **Historique :** Consultation des journées précédentes
- **Enregistrer la journée :** Sauvegarde et réinitialise pour le lendemain

## ⚠️ Notes importantes

- L'automatisation fonctionne sur tous les sites web
- Assurez-vous que l'option "Commune" se trouve bien à la position "R" + 2 flèches vers le bas
- L'extension est optimisée pour les listes de fournitures scolaires
- La touche Échap arrête immédiatement l'automatisation

## 🔧 Support et Débogage

### 🐛 En cas de problème avec l'automatisation :

1. **Vérification de base :**
   - Vérifiez que l'extension est bien installée et activée
   - Assurez-vous que l'élément ciblé est bien une liste déroulante
   - Testez manuellement : R + flèche bas x2 + Entrée

2. **Débogage avancé :**
   - Un panneau de débogage apparaît maintenant en haut à gauche lors de l'automatisation
   - Ouvrez la console du navigateur (F12) pour voir les logs détaillés
   - Tous les actions sont affichées en temps réel

3. **Page de test :**
   - Ouvrez le fichier `test-page.html` dans votre navigateur
   - Testez l'automatisation sur des listes déroulantes de test
   - Utilisez la fonction `tempoListTest()` dans la console

4. **Solutions courantes :**
   - Rechargez l'extension dans `chrome://extensions/`
   - Rechargez la page web si nécessaire
   - Vérifiez les permissions de l'extension

### 🧪 Tests manuels :

**Dans la console du navigateur (F12) :**
```javascript
// Tester l'automatisation
tempoListTest()

// Vérifier si le script est chargé
console.log(window.tempoListTest ? "✅ TempoList OK" : "❌ TempoList manquant")
```

### 📊 Panneau de débogage :

Le panneau affiche en temps réel :
- 🚀 Début/fin d'automatisation  
- 🔍 Recherche d'éléments
- 👆 Actions de clic
- ⌨️ Frappes clavier
- ⬇️ Navigation dans les listes
- ✅ Succès/❌ Erreurs 