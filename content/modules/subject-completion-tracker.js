// === CALCUL DU TAUX DE REMPLISSAGE DES MATIÈRES ===
// Module pour calculer et surveiller le taux de remplissage des matières dans les listes de fournitures

// Fonction pour vérifier si nous sommes sur une page d'édition de liste de fournitures
function isListEditPage() {
    const url = window.location.href;
    // Pattern: https://crealiste.com/encodeur/listeFournitures/315804
    return /\/encodeur\/listeFournitures\/\d+$/.test(url);
}

// Fonction pour extraire le niveau de la liste
function extractListLevel() {
    try {
        const levelElement = document.querySelector('.lineNiveau');
        if (levelElement) {
            const levelText = levelElement.textContent.trim();
            // Extraire le niveau après "Niveau, Classe :"
            const match = levelText.match(/Niveau,\s*Classe\s*:\s*([^,]+)/i);
            if (match) {
                return match[1].trim().toLowerCase();
            }
        }
        return null;
    } catch (error) {
        console.error('[TempoList] Erreur lors de l\'extraction du niveau:', error);
        return null;
    }
}

// Fonction pour calculer le taux de remplissage des matières
function calculateSubjectCompletionRate() {
    console.log('[TempoList] 🎯 Calcul du taux de remplissage des matières');
    
    // Vérifier que nous sommes sur la bonne page
    if (!isListEditPage()) {
        console.log('[TempoList] ❌ Non exécuté : pas sur une page d\'édition de liste');
        return;
    }
    
    // Extraire le niveau de la liste
    const level = extractListLevel();
    if (!level) {
        console.log('[TempoList] ❌ Impossible de déterminer le niveau de la liste');
        return;
    }
    
    console.log(`[TempoList] 📋 Niveau détecté: ${level}`);
    
    // Vérifier que le niveau n'est pas "primaire"
    if (level.includes('primaire')) {
        console.log('[TempoList] ⚠️ Non exécuté : niveau primaire exclu du calcul');
        return;
    }
    
    // Trouver tous les selects de matières
    const subjectSelects = document.querySelectorAll('.selectSubject');
    
    if (subjectSelects.length === 0) {
        console.log('[TempoList] ❌ Aucun select de matière trouvé');
        return;
    }
    
    const totalLines = subjectSelects.length;
    let emptySubjects = 0;
    
    // Compter les matières vides (valeur vide ou "_")
    subjectSelects.forEach((select, index) => {
        const value = select.value.trim();
        if (value === '' || value === '_') {
            emptySubjects++;
        }
    });
    
    const filledSubjects = totalLines - emptySubjects;
    const completionRate = totalLines > 0 ? (filledSubjects / totalLines * 100) : 0;
    
    // Afficher le résultat dans la console
    console.log('[TempoList] 📊 === STATISTIQUES MATIÈRES ===');
    console.log(`[TempoList] 📝 Total lignes: ${totalLines}`);
    console.log(`[TempoList] ✅ Matières remplies: ${filledSubjects}`);
    console.log(`[TempoList] ❌ Matières vides: ${emptySubjects}`);
    console.log(`[TempoList] 🎯 Taux de completion: ${completionRate.toFixed(1)}%`);
    console.log('[TempoList] ================================');
    
    return {
        totalLines,
        filledSubjects,
        emptySubjects,
        completionRate: parseFloat(completionRate.toFixed(1))
    };
}

// Fonction pour surveiller les changements et recalculer automatiquement
function startSubjectCompletionMonitoring() {
    if (!isListEditPage()) {
        return;
    }
    
    const level = extractListLevel();
    if (!level || level.includes('primaire')) {
        return;
    }
    
    console.log('[TempoList] 🎯 Surveillance du taux de remplissage des matières activée');
    
    // Calcul initial
    calculateSubjectCompletionRate();
    
    // Observer les changements sur les selects de matières
    const observer = new MutationObserver((mutations) => {
        let shouldRecalculate = false;
        
        mutations.forEach((mutation) => {
            // Vérifier si des selects de matières ont été modifiés
            if (mutation.type === 'childList') {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === 1 && (
                        node.classList?.contains('selectSubject') ||
                        node.querySelector?.('.selectSubject')
                    )) {
                        shouldRecalculate = true;
                    }
                });
            }
        });
        
        if (shouldRecalculate) {
            // Attendre un peu pour que les modifications soient terminées
            setTimeout(calculateSubjectCompletionRate, 500);
        }
    });
    
    // Observer le conteneur principal du tableau
    const tableContainer = document.querySelector('.ag-root-wrapper') || document.body;
    observer.observe(tableContainer, {
        childList: true,
        subtree: true
    });
    
    // Observer aussi les changements de valeur sur les selects existants
    document.addEventListener('change', (event) => {
        if (event.target.classList.contains('selectSubject')) {
            setTimeout(calculateSubjectCompletionRate, 100);
        }
    });
}

// Initialiser la surveillance du taux de remplissage des matières
function initSubjectCompletionTracking() {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(startSubjectCompletionMonitoring, 1000);
        });
    } else {
        setTimeout(startSubjectCompletionMonitoring, 1000);
    }
}

// Fonction de vérification de validité de l'extension (importée du script principal)
function checkExtensionValidity() {
    try {
        return chrome && chrome.runtime && chrome.runtime.id;
    } catch (error) {
        console.log('[TempoList] Extension context invalidated, script will not run');
        return false;
    }
}

// Démarrer le suivi du taux de remplissage si l'extension est valide
if (checkExtensionValidity()) {
    initSubjectCompletionTracking();
}

// Exposer la fonction pour les tests manuels
window.tempoListCalculateSubjects = calculateSubjectCompletionRate; 