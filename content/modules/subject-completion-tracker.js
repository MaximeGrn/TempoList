// === CALCUL DU TAUX DE REMPLISSAGE DES MATIÈRES ===
// Module pour calculer et surveiller le taux de remplissage des matières dans les listes de fournitures

// Configuration par défaut
let SUBJECT_COMPLETION_CONFIG = {
    enabled: true
};

// Charger la configuration
async function loadSubjectCompletionConfig() {
    try {
        const result = await chrome.storage.local.get(['subjectCompletionEnabled']);
        SUBJECT_COMPLETION_CONFIG.enabled = result.subjectCompletionEnabled !== false; // true par défaut
    } catch (error) {
        // En cas d'erreur, utiliser la configuration par défaut
    }
}

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
        return null;
    }
}

// Fonction pour vérifier si c'est une liste d'option
function isOptionList() {
    try {
        const codeRefElements = document.querySelectorAll('.lineCodeRef');
        for (const element of codeRefElements) {
            const text = element.textContent.trim();
            if (text.includes('Code référence :')) {
                // Extraire le code référence
                const codeRef = text.replace('Code référence :', '').trim();
                // Vérifier si le code contient "-O-"
                return codeRef.includes('-O-');
            }
        }
        return false;
    } catch (error) {
        return false;
    }
}

// Fonction pour calculer le taux de remplissage des matières
function calculateSubjectCompletionRate() {
    // Vérifier que la fonctionnalité est activée
    if (!SUBJECT_COMPLETION_CONFIG.enabled) {
        return null;
    }
    
    // Vérifier que nous sommes sur la bonne page
    if (!isListEditPage()) {
        return null;
    }
    
    // Extraire le niveau de la liste
    const level = extractListLevel();
    if (!level) {
        return null;
    }
    
    // Exclure les listes primaires et maternelles
    if (level.includes('primaire') || level.includes('maternelle')) {
        return null;
    }
    
    // Exclure les listes d'options
    if (isOptionList()) {
        return null;
    }
    
    // Trouver tous les selects de matières
    const subjectSelects = document.querySelectorAll('.selectSubject');
    
    if (subjectSelects.length === 0) {
        return null;
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
    
    return {
        totalLines,
        filledSubjects,
        emptySubjects,
        completionRate: parseFloat(completionRate.toFixed(1))
    };
}

// Fonction pour créer l'étiquette de pourcentage
function createCompletionBadge(completionRate) {
    // Supprimer l'étiquette existante si elle existe
    const existingBadge = document.querySelector('.tempolist-completion-badge');
    if (existingBadge) {
        existingBadge.remove();
    }
    
    // Créer la nouvelle étiquette
    const badge = document.createElement('span');
    badge.className = 'tempolist-completion-badge';
    badge.textContent = `Matières : ${completionRate.toFixed(1)}%`;
    
    // Style de l'étiquette amélioré
    const isHighCompletion = completionRate > 70;
    badge.style.cssText = `
        display: inline-block;
        background-color: ${isHighCompletion ? '#28a745' : '#dc3545'};
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        font-size: 16px;

        margin-left: 20px;
        border: none;
        vertical-align: middle;
        font-family: Arial, sans-serif;
    `;
    
    return badge;
}

// Fonction pour pré-remplir le commentaire d'erreur si le taux est faible
function fillErrorMessageIfNeeded(completionRate) {
    // Seulement si le taux est inférieur à 70% (étiquette rouge)
    if (completionRate >= 70) {
        return;
    }
    
    // Trouver le textarea d'erreur
    const messageErrorTextarea = document.getElementById('messageError');
    if (!messageErrorTextarea) {
        return;
    }
    
    // Vérifier si le textarea est vide ou contient déjà notre message
    const currentMessage = messageErrorTextarea.value.trim();
    const predefinedMessage = "Est-ce que tu peux rajouter les matières pour les articles stp ;)\nMerci !";
    
    // Ne remplir que si le textarea est vide
    if (currentMessage === '') {
        messageErrorTextarea.value = predefinedMessage;
        
        // Déclencher l'événement 'input' pour notifier d'autres scripts potentiels
        const inputEvent = new Event('input', { bubbles: true });
        messageErrorTextarea.dispatchEvent(inputEvent);
    }
}

// Fonction pour mettre à jour l'étiquette de completion
function updateCompletionBadge() {
    // Calculer le taux de completion
    const result = calculateSubjectCompletionRate();
    
    // Trouver l'élément h2 contenant "Produits de la liste"
    const h2Elements = document.querySelectorAll('h2');
    
    let h2Element = null;
    h2Elements.forEach((h2) => {
        if (h2.textContent.includes('Produits de la liste')) {
            h2Element = h2;
        }
    });
    
    if (!h2Element) {
        return;
    }
    
    if (result === null) {
        // Supprimer l'étiquette si elle existe (cas primaire, option, désactivé, ou erreur)
        const existingBadge = document.querySelector('.tempolist-completion-badge');
        if (existingBadge) {
            existingBadge.remove();
        }
        return;
    }
    
    // Créer et ajouter l'étiquette
    const badge = createCompletionBadge(result.completionRate);
    
    // Vérifier si une étiquette existe déjà
    const existingBadge = document.querySelector('.tempolist-completion-badge');
    if (existingBadge) {
        existingBadge.replaceWith(badge);
    } else {
        h2Element.appendChild(badge);
    }
    
    // Pré-remplir le commentaire d'erreur si nécessaire
    fillErrorMessageIfNeeded(result.completionRate);
}

// Fonction pour surveiller les changements et recalculer automatiquement
function startSubjectCompletionMonitoring() {
    if (!SUBJECT_COMPLETION_CONFIG.enabled || !isListEditPage()) {
        return;
    }
    
    const level = extractListLevel();
    if (!level || level.includes('primaire') || level.includes('maternelle')) {
        return;
    }
    
    if (isOptionList()) {
        return;
    }
    
    // Mise à jour initiale
    updateCompletionBadge();
    
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
            setTimeout(updateCompletionBadge, 500);
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
            setTimeout(updateCompletionBadge, 100);
        }
    });
}

// Écouter les messages pour activer/désactiver la fonctionnalité
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'updateSubjectCompletion') {
        SUBJECT_COMPLETION_CONFIG = { ...SUBJECT_COMPLETION_CONFIG, ...request.config };
        
        if (SUBJECT_COMPLETION_CONFIG.enabled) {
            // Redémarrer la surveillance
            setTimeout(startSubjectCompletionMonitoring, 100);
        } else {
            // Supprimer l'étiquette si elle existe
            const existingBadge = document.querySelector('.tempolist-completion-badge');
            if (existingBadge) {
                existingBadge.remove();
            }
        }
        
        sendResponse({ success: true });
    }
});

// Initialiser la surveillance du taux de remplissage des matières
async function initSubjectCompletionTracking() {
    await loadSubjectCompletionConfig();
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(startSubjectCompletionMonitoring, 1000);
        });
    } else {
        setTimeout(startSubjectCompletionMonitoring, 1000);
    }
}

// Fonction de vérification de validité de l'extension
function checkExtensionValidity() {
    try {
        return chrome && chrome.runtime && chrome.runtime.id;
    } catch (error) {
        return false;
    }
}

// Démarrer le suivi du taux de remplissage si l'extension est valide
if (checkExtensionValidity()) {
    initSubjectCompletionTracking();
} 