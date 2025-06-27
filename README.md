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

### 🎯 Remplissage automatique par pattern (NOUVEAU)
Cette fonctionnalité permet de remplir automatiquement toute une liste en propageant intelligemment les matières déjà sélectionnées.

#### Comment utiliser :

1. **Sur votre site de liste de fournitures :**
   - Faites un **clic droit** n'importe où sur la page
   - Sélectionnez **"🎯 Remplissage automatique"** dans le menu contextuel

2. **L'automatisation intelligente par pattern démarre :**
   - Commence toujours par la **première ligne** du tableau
   - Prend la **première matière trouvée** comme référence
   - Remplit toutes les **lignes vides suivantes** avec cette matière
   - **Change de matière** quand une nouvelle est rencontrée
   - Continue le pattern jusqu'à la **fin de la liste**

3. **Exemple de fonctionnement :**
   ```
   AVANT :                          APRÈS :
   Article 1 : Maths         →      Article 1 : Maths
   Article 2 : (vide)        →      Article 2 : Maths  
   Article 3 : (vide)        →      Article 3 : Maths
   Article 4 : Français      →      Article 4 : Français
   Article 5 : (vide)        →      Article 5 : Français
   Article 6 : Musique       →      Article 6 : Musique
   Article 7 : Histoire      →      Article 7 : Histoire
   Article 8 : (vide)        →      Article 8 : Histoire
   Article 9 : (vide)        →      Article 9 : Histoire
   ```

4. **Pour arrêter :**
   - Appuyez sur la touche **Échap** ⚠️
   - Ou cliquez sur **✕** dans le panneau de débogage
   - **Fermeture automatique** 2 secondes après la fin

#### Avantages du remplissage automatique :
- **Traitement complet** : Parcourt toute la liste d'un coup
- **Intelligence contextuelle** : Adapte la matière selon ce qui est déjà rempli
- **Propagation automatique** : Étend chaque matière jusqu'à la suivante
- **Gain de temps maximal** : Idéal pour les listes partiellement pré-remplies

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
- **Options :** Configuration des équipes, objectifs et **vitesses d'automatisation**
- **Historique :** Consultation des journées précédentes
- **Enregistrer la journée :** Sauvegarde et réinitialise pour le lendemain

### ⚙️ Configuration de l'automatisation
Dans l'onglet **🔄 Automatisation** des options, vous pouvez personnaliser :

#### Préréglages de vitesse :
- **🚀 Rapide** : 100ms entre actions, 400ms entre lignes
- **⚡ Normal** : 200ms entre actions, 800ms entre lignes (défaut)
- **🐌 Lent** : 500ms entre actions, 1500ms entre lignes

#### Configuration manuelle :
- **Délai entre actions** : Temps d'attente entre chaque action individuelle (minimum 100ms)
- **Délai entre lignes** : Temps d'attente avant de passer à la ligne suivante (minimum 300ms)

💡 **Conseil :** Utilisez une vitesse plus lente si le site web est lent ou instable.

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
// Tester l'automatisation Commune
tempoListTest()

// Tester le remplissage automatique par pattern
tempoListTestPattern()

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