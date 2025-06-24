# ✅ To-Do List TempoList Extension (Chrome)

## 🔧 Initialisation du projet
- [x] Créer la structure de base de l'extension (dossier avec manifest V3)
- [x] Ajouter le fichier `manifest.json` avec :
  - [x] nom, description, permissions, popup, options, background (si besoin)
- [x] Créer les fichiers HTML :
  - [x] popup.html
  - [x] options.html
- [x] Créer les fichiers CSS et JS associés

---

## 🧪 Interface : Popup
- [x] Afficher la sélection de l'équipe active
- [x] Bouton "J'ai rempli une liste"
- [x] Afficher :
  - [x] Compteur (ex. 18 / 40)
  - [x] Anneau de progression (canvas/svg ou équivalent)
  - [x] Pourcentage de progression
  - [x] Temps moyen réel par liste
  - [x] Temps théorique par liste
  - [x] Projection : combien de listes à la fin de la journée
  - [x] Indicateur couleur : avance / à l'heure / en retard
- [x] Bouton "Réinitialiser la journée"

---

## ⚙️ Interface : Options
- [x] Interface pour créer/éditer/supprimer des équipes
- [x] Pour chaque équipe :
  - [x] Ajouter plusieurs horaires dans la journée
- [x] Enregistrer les paramètres avec `chrome.storage.local`
- [x] Saisir et modifier l'objectif journalier

---

## 📊 Données & logique
- [x] Stocker chaque action "j'ai rempli une liste" avec timestamp
- [x] Calculer :
  - [x] Temps moyen réel (intervalle entre clics)
  - [x] Temps théorique (durée des horaires / objectif)
  - [x] Projection (en rythme actuel)
- [x] Comparer pour afficher l'indicateur couleur

---

## 🗃️ Historique
- [x] Stocker l'historique journalier (date, nb listes, durée, temps moyen)
- [x] Afficher l'historique dans une section ou popup dédiée
- [x] Permettre consultation des jours précédents

---

## 🎨 UI / UX
- [x] Créer un anneau de progression fluide (canvas ou SVG)
- [x] Interface propre, intuitive et compacte
- [x] Adaptée à une fenêtre popup Chrome

---

## 🧹 Nettoyage final
- [x] Supprimer le code mort ou inutilisé
- [x] Vérifier que toutes les données sont persistées correctement
- [x] Vérification manuelle des fonctionnalités

---

## ✅ Extension terminée et fonctionnelle !
Toutes les fonctionnalités demandées ont été implémentées :
- Extension Chrome avec Manifest V3
- Interface popup avec anneau de progression, compteurs et statistiques
- Page options pour configurer équipes et objectifs
- Suivi en temps réel avec calculs automatiques
- Historique des journées précédentes
- Persistance des données avec chrome.storage.local

## 🚀 Améliorations ajoutées :
- [x] **Projection modifiée** : Affiche l'heure de fin estimée (ex: "Fin vers 17h30")
- [x] **Page historique dédiée** : Interface complète avec tableau, filtres, édition et suppression
- [x] **Blocage changement d'équipe** : Impossible de changer d'équipe une fois la journée commencée
- [x] **Boutons +/-** : Remplacement du bouton unique par des boutons d'incrémentation/décrémentation
- [x] **Fonctionnalités historique** :
  - Filtrage par équipe et période (7 jours, 30 jours)
  - Édition des entrées existantes
  - Suppression d'entrées individuelles
  - Export CSV
  - Statistiques résumées (total, moyenne, meilleur jour)
  - Modal d'édition avec validation

