// Script de contenu pour l'automatisation TempoList

// Vérifier que l'extension est toujours valide
function checkExtensionValidity() {
    try {
        return chrome && chrome.runtime && chrome.runtime.id;
    } catch (error) {
        console.log('[TempoList] Extension context invalidated, script will not run');
        return false;
    }
}

// Si l'extension n'est pas valide, arrêter l'exécution
if (!checkExtensionValidity()) {
    console.log('[TempoList] Extension context invalidated, stopping content script');
    // Ne pas continuer l'exécution du script
} else {
    console.log('[TempoList] Extension context valid, content script starting');
}

let isAutomationRunning = false;
let automationInterval = null;
let currentTargetElement = null;
let debugPanel = null;
let actionCount = 0;
let currentRowIndex = -1; // Pour suivre la ligne actuelle dans AG-Grid

// Configuration de l'automatisation (valeurs par défaut)
let AUTOMATION_CONFIG = {
    initialKey: 'r', // Lettre à taper pour commencer
    downArrowCount: 2, // Nombre de flèches vers le bas
    delayBetweenActions: 200, // Délai entre chaque action (ms)
    delayBetweenCycles: 800 // Délai entre chaque cycle complet (ms) - réduit car sélection directe
};

// Charger la configuration depuis le stockage
async function loadConfig() {
    try {
        const result = await chrome.storage.sync.get('automationConfig');
        if (result.automationConfig) {
            AUTOMATION_CONFIG = { ...AUTOMATION_CONFIG, ...result.automationConfig };
            logAction(`Configuration chargée: ${JSON.stringify(AUTOMATION_CONFIG)}`);
        }
    } catch (error) {
        logAction(`Erreur lors du chargement de la configuration: ${error.message}`, 'error');
    }
}

// Charger la configuration au démarrage du script
loadConfig();

// Écouter les messages du background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'startAutomation') {
        startAutomation(request.element, request.mode || 'commune');
        sendResponse({ success: true });
    } else if (request.action === 'startPatternFill') {
        startPatternFill(request.element);
        sendResponse({ success: true });
    } else if (request.action === 'stopAutomation') {
        stopAutomation();
        sendResponse({ success: true });
    }
});

// Fonction pour gérer la touche Échap
function handleEscapeKey(event) {
    if (event.key === 'Escape' && (isAutomationRunning || debugPanel)) {
        if (isAutomationRunning) {
            stopAutomation();
            showNotification('Automatisation arrêtée');
        } else if (debugPanel) {
            removeDebugPanel();
        }
    }
}

// Écouter les événements clavier pour arrêter avec Échap
document.addEventListener('keydown', handleEscapeKey);

// Fonction pour démarrer l'automatisation
function startAutomation(elementInfo, mode = 'commune') {
    logAction(`🚀 Début de l'automatisation (mode: ${mode})`);
    
    if (isAutomationRunning) {
        logAction('⚠️ Arrêt de l\'automatisation précédente');
        stopAutomation();
    }

    // Créer le panneau de débogage
    createDebugPanel();
    
    // Trouver l'élément cible
    logAction('🔍 Recherche de l\'élément cible...');
    currentTargetElement = findTargetElement(elementInfo);
    
    if (!currentTargetElement) {
        logImportant('❌ Impossible de trouver l\'élément à automatiser', 'error');
        showNotification('Impossible de trouver l\'élément à automatiser', 'error');
        return;
    }

    // Identifier la ligne de départ
    currentRowIndex = getRowIndex(currentTargetElement);
    if (currentRowIndex !== -1) {
        logImportant(`🎯 Démarrage ligne ${currentRowIndex} (${mode})`, 'success');
    } else {
        logImportant('⚠️ Impossible de déterminer la ligne de départ', 'error');
    }
    
    isAutomationRunning = true;
    actionCount = 0;
    showNotification('Automatisation démarrée - Appuyez sur Échap pour arrêter', 'success');
    
    // Démarrer le cycle d'automatisation
    logAction('🔄 Début des cycles d\'automatisation');
    runAutomationCycle();
}

// Fonction pour arrêter l'automatisation
function stopAutomation(isAutoStop = false) {
    if (isAutoStop) {
        logImportant(`✅ Automatisation terminée - ${actionCount} lignes traitées`, 'success');
        // Fermer automatiquement après 2 secondes
        setTimeout(() => {
            removeDebugPanel();
        }, 2000);
    } else {
        logAction('🛑 Arrêt de l\'automatisation');
        // Fermer après 5 secondes pour un arrêt manuel
        setTimeout(() => {
            removeDebugPanel();
        }, 5000);
    }
    
    if (automationInterval) {
        clearInterval(automationInterval);
        automationInterval = null;
    }
    isAutomationRunning = false;
    currentTargetElement = null;
}

// Créer le panneau de débogage
function createDebugPanel() {
    // Supprimer l'ancien panneau s'il existe
    removeDebugPanel();
    
    debugPanel = document.createElement('div');
    debugPanel.id = 'tempolist-debug-panel';
    debugPanel.style.cssText = `
        position: fixed;
        top: 10px;
        left: 10px;
        width: 350px;
        max-height: 400px;
        background: rgba(0, 0, 0, 0.9);
        color: white;
        font-family: 'Courier New', monospace;
        font-size: 12px;
        padding: 15px;
        border-radius: 8px;
        z-index: 999999;
        box-shadow: 0 4px 12px rgba(0,0,0,0.5);
        overflow-y: auto;
        border: 2px solid #3498db;
    `;
    
    debugPanel.innerHTML = `
        <div style="border-bottom: 1px solid #555; padding-bottom: 10px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
            <strong>🔧 TempoList Debug</strong>
            <button id="close-debug" style="background: #e74c3c; color: white; border: none; padding: 2px 8px; border-radius: 4px; cursor: pointer;">✕</button>
        </div>
        <div id="debug-log" style="max-height: 300px; overflow-y: auto;"></div>
    `;
    
    document.body.appendChild(debugPanel);
    
    // Bouton de fermeture
    document.getElementById('close-debug').addEventListener('click', () => {
        stopAutomation();
        removeDebugPanel();
    });
    
    logAction('🔧 Panneau de débogage créé');
}

// Supprimer le panneau de débogage
function removeDebugPanel() {
    if (debugPanel && debugPanel.parentNode) {
        debugPanel.remove();
        debugPanel = null;
    }
}

// Fonction pour logger les actions (version simplifiée)
function logAction(message, type = 'info', isImportant = false) {
    console.log(`[TempoList] ${message}`);
    
    // Afficher seulement les messages importants dans le panneau
    if (debugPanel && isImportant) {
        const debugLog = document.getElementById('debug-log');
        if (debugLog) {
            const color = type === 'error' ? '#e74c3c' : type === 'success' ? '#27ae60' : '#3498db';
            
            const logEntry = document.createElement('div');
            logEntry.style.cssText = `
                margin-bottom: 8px;
                padding: 8px;
                color: ${color};
                background: rgba(255,255,255,0.1);
                border-radius: 4px;
                font-weight: bold;
            `;
            logEntry.innerHTML = message;
            
            debugLog.appendChild(logEntry);
            debugLog.scrollTop = debugLog.scrollHeight;
        }
    }
}

// Version simplifiée pour les logs importants
function logImportant(message, type = 'info') {
    logAction(message, type, true);
}

// Cycle principal d'automatisation
function runAutomationCycle() {
    if (!isAutomationRunning || !currentTargetElement) {
        logAction('❌ Cycle interrompu - automatisation arrêtée ou élément manquant', 'error');
        return;
    }

    actionCount++;
    logAction(`🔄 Cycle #${actionCount} - Vérification de l'élément`);

    // Vérifier si l'élément est toujours valide
    if (!document.contains(currentTargetElement)) {
        logAction('⚠️ Élément cible perdu, recherche d\'un élément similaire...');
        // Essayer de retrouver un élément similaire
        currentTargetElement = findSimilarElement();
        if (!currentTargetElement) {
            logAction('❌ Aucun élément similaire trouvé', 'error');
            stopAutomation();
            showNotification('Élément cible perdu - Automatisation arrêtée', 'error');
            return;
        }
        logAction('✅ Nouvel élément trouvé');
    }

    // Exécuter la séquence d'actions
    logAction(`▶️ Exécution de la séquence d'actions pour le cycle #${actionCount}`);
    executeActionSequence()
        .then(() => {
            logAction(`✅ Cycle #${actionCount} terminé avec succès`, 'success');
            // Programmer le prochain cycle
            logAction(`⏳ Attente de ${AUTOMATION_CONFIG.delayBetweenCycles}ms avant le prochain cycle`);
            setTimeout(() => {
                if (isAutomationRunning) {
                    runAutomationCycle();
                }
            }, AUTOMATION_CONFIG.delayBetweenCycles);
        })
        .catch(error => {
            logAction(`❌ Erreur dans le cycle #${actionCount}: ${error.message}`, 'error');
            console.error('Erreur lors de l\'automatisation:', error);
            stopAutomation();
            showNotification('Erreur dans l\'automatisation', 'error');
        });
}

// Exécuter la séquence d'actions
async function executeActionSequence() {
    try {
        // 1. Cliquer sur l'élément pour le focaliser
        logAction('  👆 Clic sur l\'élément');
        await clickElement(currentTargetElement);
        await delay(AUTOMATION_CONFIG.delayBetweenActions);

        // 2. Détecter le type de select et adapter la stratégie
        const options = currentTargetElement.querySelectorAll('option');
        let communeOption = null;
        
        // Chercher l'option "Commune"
        for (let option of options) {
            if (option.textContent.trim().toLowerCase() === 'commune') {
                communeOption = option;
                break;
            }
        }
        
        if (communeOption) {
            // Stratégie directe : sélectionner "Commune" directement
            logAction(`  🎯 Sélection directe de "Commune" (position ${communeOption.index}/${options.length})`);
            currentTargetElement.value = communeOption.value;
            currentTargetElement.selectedIndex = communeOption.index;
            
            // Déclencher les événements
            const inputEvent = new Event('input', { bubbles: true, cancelable: true });
            const changeEvent = new Event('change', { bubbles: true, cancelable: true });
            currentTargetElement.dispatchEvent(inputEvent);
            currentTargetElement.dispatchEvent(changeEvent);
            
            logAction('  📢 Événements déclenchés pour la sélection directe');
            
            // Attendre un peu que les événements soient traités
            await delay(AUTOMATION_CONFIG.delayBetweenActions);
            
            // Marquer la ligne actuelle comme traitée
            logImportant(`🔄 Ligne ${currentRowIndex + actionCount - 1} : Commune sélectionnée`);
            
            // Trouver la ligne suivante
            logAction('  🔍 Recherche de la ligne suivante...');
            const nextElement = findNextRowElement();
            if (nextElement) {
                logAction(`  ✅ Ligne suivante trouvée (row-index: ${getRowIndex(nextElement)})`, 'success');
                currentTargetElement = nextElement;
            } else {
                logAction('  ⚠️ Aucune ligne suivante trouvée - tentative de défilement...', 'error');
                
                // Essayer de faire défiler pour voir plus de lignes
                const gridViewport = document.querySelector('.ag-body-viewport');
                if (gridViewport) {
                    logAction('  📜 Défilement de la grille pour charger plus de lignes');
                    gridViewport.scrollTop = gridViewport.scrollTop + 300; // Descendre de 300px
                    
                    // Attendre que le défilement charge de nouvelles lignes
                    await delay(1000);
                    
                    // Réessayer de trouver une ligne suivante
                    const nextElementAfterScroll = findNextRowElement();
                    if (nextElementAfterScroll) {
                        logAction(`  ✅ Nouvelle ligne trouvée après défilement`, 'success');
                        currentTargetElement = nextElementAfterScroll;
                    } else {
                        // Vérifier si on s'est arrêté à cause d'une matière déjà sélectionnée
                        logImportant(`🔄 Ligne ${currentRowIndex + actionCount - 1} : Commune sélectionnée`);
                        stopAutomation(true); // Auto-stop avec fermeture automatique
                        return;
                    }
                } else {
                    logImportant(`🔄 Ligne ${currentRowIndex + actionCount - 1} : Commune sélectionnée`);
                    stopAutomation(true); // Auto-stop avec fermeture automatique
                    return;
                }
            }
        } else {
            // Stratégie de fallback : méthode clavier classique
            logAction('  ⚠️ Option "Commune" non trouvée, utilisation de la méthode clavier');
            
            // 2. Taper la lettre initiale
            logAction(`  📝 Frappe de la lettre "${AUTOMATION_CONFIG.initialKey.toUpperCase()}"`);
            await sendKeyToElement(currentTargetElement, AUTOMATION_CONFIG.initialKey);
            await delay(AUTOMATION_CONFIG.delayBetweenActions);

            // 3. Appuyer sur flèche du bas le nombre de fois spécifié
            for (let i = 0; i < AUTOMATION_CONFIG.downArrowCount; i++) {
                logAction(`  ⬇️ Flèche bas (${i + 1}/${AUTOMATION_CONFIG.downArrowCount})`);
                await sendKeyToElement(currentTargetElement, 'ArrowDown');
                await delay(AUTOMATION_CONFIG.delayBetweenActions);
            }

            // 4. Appuyer sur Entrée pour valider
            logAction('  ✅ Appui sur Entrée');
            await sendKeyToElement(currentTargetElement, 'Enter');
            await delay(AUTOMATION_CONFIG.delayBetweenActions);
        }
        
        logAction('  🎯 Séquence complète exécutée');
    } catch (error) {
        logAction(`  ❌ Erreur dans la séquence: ${error.message}`, 'error');
        throw error;
    }
}

// Trouver l'élément cible basé sur les informations fournies
function findTargetElement(elementInfo) {
    logAction('🔍 Début de la recherche d\'élément...');
    // Essayer plusieurs méthodes pour trouver l'élément
    let element = null;

    // Méthode prioritaire : Recherche par position de grille si disponible
    if (elementInfo.rowIndex && elementInfo.colId) {
        logAction(`  🎯 Recherche par position grille: ligne ${elementInfo.rowIndex}, colonne ${elementInfo.colId}`);
        const gridElement = document.querySelector(`.ag-row[row-index="${elementInfo.rowIndex}"] [col-id="${elementInfo.colId}"] select`);
        if (gridElement) {
            element = gridElement;
            logAction('  ✅ Trouvé par position dans la grille', 'success');
        }
    }

    // Par ID si disponible et pas encore trouvé
    if (!element && elementInfo.id) {
        logAction(`  🔍 Recherche par ID: "${elementInfo.id}"`);
        element = document.getElementById(elementInfo.id);
        if (element) logAction('  ✅ Trouvé par ID', 'success');
    }

    // Par classe si disponible
    if (!element && elementInfo.className) {
        logAction(`  🔍 Recherche par classe: "${elementInfo.className}"`);
        const elements = document.getElementsByClassName(elementInfo.className);
        element = elements.length > 0 ? elements[0] : null;
        if (element) logAction('  ✅ Trouvé par classe', 'success');
    }

    // Par tag name et position
    if (!element && elementInfo.tagName) {
        logAction(`  🔍 Recherche par tag: "${elementInfo.tagName}"`);
        const elements = document.getElementsByTagName(elementInfo.tagName);
        logAction(`  📊 ${elements.length} éléments "${elementInfo.tagName}" trouvés`);
        
        if (elements.length > 0) {
            // Prendre le premier select/input trouvé
            for (let el of elements) {
                if (el.type === 'select-one' || el.tagName.toLowerCase() === 'select') {
                    element = el;
                    logAction('  ✅ Select trouvé', 'success');
                    break;
                }
            }
        }
    }

    // Recherche par position approximative
    if (!element && elementInfo.rect) {
        logAction(`  🔍 Recherche par position: (${Math.round(elementInfo.rect.x)}, ${Math.round(elementInfo.rect.y)})`);
        element = document.elementFromPoint(elementInfo.rect.x, elementInfo.rect.y);
        if (element) logAction('  ✅ Trouvé par position', 'success');
    }

    // Recherche spécialisée pour l'application de listes de fournitures
    if (!element) {
        logAction('  🔍 Recherche spécialisée pour les selects de matières...');
        
        // PRIORITÉ : Si on a des informations précises sur l'élément cliqué, essayer de le retrouver
        if (elementInfo.rect && elementInfo.rect.x && elementInfo.rect.y) {
            logAction(`  🎯 Tentative de récupération de l'élément exact cliqué...`);
            const clickedElement = document.elementFromPoint(elementInfo.rect.x + 10, elementInfo.rect.y + 10);
            if (clickedElement && (clickedElement.tagName.toLowerCase() === 'select' || clickedElement.closest('select'))) {
                element = clickedElement.tagName.toLowerCase() === 'select' ? clickedElement : clickedElement.closest('select');
                logAction('  ✅ Élément exact récupéré depuis le clic', 'success');
            }
        }
        
        // Si pas trouvé, chercher spécifiquement les selects avec la classe selectSubject
        if (!element) {
            const subjectSelects = document.querySelectorAll('select.selectSubject');
            logAction(`  🎓 ${subjectSelects.length} selects de matières trouvés`);
            
            if (subjectSelects.length > 0) {
                // Prendre le premier select de matière visible
                for (let select of subjectSelects) {
                    if (select.offsetWidth > 0 && select.offsetHeight > 0) {
                        element = select;
                        logAction('  ⚠️ Premier select de matière utilisé (fallback)', 'error');
                        break;
                    }
                }
            }
        }
    }

    // Recherche générale de tous les selects comme fallback
    if (!element) {
        logAction('  🔍 Recherche générale de tous les selects...');
        const allSelects = document.querySelectorAll('select');
        logAction(`  📊 ${allSelects.length} selects trouvés sur la page`);
        
        if (allSelects.length > 0) {
            // Prendre le premier select visible qui contient "Commune" dans ses options
            for (let select of allSelects) {
                if (select.offsetWidth > 0 && select.offsetHeight > 0) {
                    // Vérifier si ce select contient une option "Commune"
                    const hasCommune = Array.from(select.options).some(option => 
                        option.textContent.trim().toLowerCase() === 'commune'
                    );
                    
                    if (hasCommune) {
                        element = select;
                        logAction('  ✅ Select avec option "Commune" trouvé', 'success');
                        break;
                    }
                }
            }
            
            // Si aucun select avec "Commune" n'est trouvé, prendre le premier visible
            if (!element) {
                for (let select of allSelects) {
                    if (select.offsetWidth > 0 && select.offsetHeight > 0) {
                        element = select;
                        logAction('  ✅ Premier select visible utilisé', 'success');
                        break;
                    }
                }
            }
        }
    }

    if (element) {
        logAction(`✅ Élément final trouvé: ${element.tagName} (ID: ${element.id || 'N/A'})`, 'success');
    } else {
        logAction('❌ Aucun élément trouvé', 'error');
    }

    return element;
}

// Trouver un élément similaire si l'original est perdu
function findSimilarElement() {
    // Chercher tous les selects visibles
    const selects = Array.from(document.querySelectorAll('select')).filter(el => {
        return el.offsetWidth > 0 && el.offsetHeight > 0;
    });

    // Retourner le premier select trouvé (logique simple)
    return selects.length > 0 ? selects[0] : null;
}

// Cliquer sur un élément
async function clickElement(element) {
    return new Promise((resolve) => {
        try {
            logAction(`    👆 Focus sur l'élément`);
            element.focus();
            
            logAction(`    🖱️ Clic natif`);
            element.click();
            
            // Déclencher les événements
            logAction(`    🎭 Déclenchement des événements MouseEvent`);
            const events = ['mousedown', 'click', 'mouseup'];
            events.forEach(eventType => {
                const event = new MouseEvent(eventType, {
                    bubbles: true,
                    cancelable: true,
                    view: window
                });
                element.dispatchEvent(event);
            });
            
            logAction(`    ✅ Clic terminé`);
            resolve();
        } catch (error) {
            logAction(`    ❌ Erreur lors du clic: ${error.message}`, 'error');
            resolve(); // Continue même en cas d'erreur
        }
    });
}

// Envoyer une touche à un élément
async function sendKeyToElement(element, key) {
    return new Promise((resolve) => {
        try {
            logAction(`    ⌨️ Envoi de la touche "${key}"`);
            element.focus();
            
            // Essayer avec une approche alternative pour les selects
            if (element.tagName.toLowerCase() === 'select') {
                logAction(`    📋 Élément SELECT détecté, utilisation d'une approche spécifique`);
                
                // Analyser les options disponibles
                const options = element.querySelectorAll('option');
                logAction(`    📊 ${options.length} options trouvées dans le select`);
                
                if (key === 'r' || key === 'R') {
                    // Chercher directement l'option "Commune" d'abord
                    let foundOption = null;
                    
                    // Priorité 1: Chercher exactement "Commune"
                    for (let option of options) {
                        if (option.textContent.trim().toLowerCase() === 'commune') {
                            foundOption = option;
                            logAction(`    🎯 Option "Commune" trouvée directement à l'index ${option.index}`);
                            break;
                        }
                    }
                    
                    // Priorité 2: Chercher une option contenant "commune"
                    if (!foundOption) {
                        for (let option of options) {
                            if (option.textContent.toLowerCase().includes('commune')) {
                                foundOption = option;
                                logAction(`    🎯 Option contenant "commune" trouvée: "${option.textContent}" à l'index ${option.index}`);
                                break;
                            }
                        }
                    }
                    
                    // Priorité 3: Méthode classique - chercher ce qui commence par R
                    if (!foundOption) {
                        for (let option of options) {
                            if (option.textContent.toLowerCase().startsWith('r')) {
                                foundOption = option;
                                logAction(`    📝 Option commençant par "R" trouvée: "${option.textContent}" à l'index ${option.index}`);
                                break;
                            }
                        }
                    }
                    
                    if (foundOption) {
                        logAction(`    ✅ Sélection de l'option: "${foundOption.textContent}" (valeur: ${foundOption.value})`);
                        element.value = foundOption.value;
                        element.selectedIndex = foundOption.index;
                        
                        // Déclencher les événements appropriés
                        const changeEvent = new Event('change', { bubbles: true, cancelable: true });
                        const inputEvent = new Event('input', { bubbles: true, cancelable: true });
                        element.dispatchEvent(inputEvent);
                        element.dispatchEvent(changeEvent);
                        
                        logAction(`    📢 Événements change et input déclenchés`);
                    } else {
                        logAction(`    ❌ Aucune option appropriée trouvée`, 'error');
                        // Lister toutes les options pour le débogage
                        logAction(`    📋 Options disponibles:`);
                        for (let i = 0; i < Math.min(options.length, 10); i++) {
                            logAction(`      ${i}: "${options[i].textContent.trim()}"`);
                        }
                        if (options.length > 10) {
                            logAction(`      ... et ${options.length - 10} autres options`);
                        }
                    }
                } else if (key === 'ArrowDown') {
                    logAction(`    ⬇️ Déplacement vers l'option suivante`);
                    const currentIndex = element.selectedIndex;
                    if (currentIndex < element.options.length - 1) {
                        element.selectedIndex = currentIndex + 1;
                        const changeEvent = new Event('change', { bubbles: true });
                        element.dispatchEvent(changeEvent);
                        logAction(`    📍 Nouvelle position: ${element.selectedIndex} - "${element.options[element.selectedIndex].textContent}"`);
                    } else {
                        logAction(`    ⚠️ Déjà à la dernière option`);
                    }
                } else if (key === 'Enter') {
                    logAction(`    ↩️ Validation de la sélection actuelle: "${element.options[element.selectedIndex]?.textContent || 'N/A'}"`);
                    const changeEvent = new Event('change', { bubbles: true });
                    element.dispatchEvent(changeEvent);
                    element.blur();
                }
            } else {
                // Pour les autres types d'éléments, utiliser les événements clavier normaux
                logAction(`    ⌨️ Envoi d'événements clavier normaux`);
                const keyboardEvents = ['keydown', 'keypress', 'keyup'];
                
                keyboardEvents.forEach(eventType => {
                    const event = new KeyboardEvent(eventType, {
                        key: key,
                        code: key,
                        bubbles: true,
                        cancelable: true
                    });
                    element.dispatchEvent(event);
                });
            }
            
            logAction(`    ✅ Touche "${key}" envoyée`);
            resolve();
        } catch (error) {
            logAction(`    ❌ Erreur lors de l'envoi de la touche "${key}": ${error.message}`, 'error');
            resolve(); // Continue même en cas d'erreur
        }
    });
}

// Obtenir l'index de ligne d'un élément select dans AG-Grid
function getRowIndex(selectElement) {
    // Remonter jusqu'à la div de ligne (ag-row)
    let rowElement = selectElement.closest('.ag-row');
    if (rowElement) {
        const rowIndexAttr = rowElement.getAttribute('row-index');
        if (rowIndexAttr) {
            return parseInt(rowIndexAttr);
        }
    }
    return -1;
}

// Trouver le select de la ligne suivante
function findNextRowElement() {
    // Obtenir l'index de la ligne actuelle
    const currentIndex = getRowIndex(currentTargetElement);
    logAction(`  📍 Ligne actuelle: ${currentIndex}`);
    
    if (currentIndex === -1) {
        logAction('  ❌ Impossible de déterminer l\'index de ligne actuel', 'error');
        return null;
    }
    
    // Chercher la ligne suivante
    const nextRowIndex = currentIndex + 1;
    logAction(`  🔍 Recherche de la ligne ${nextRowIndex}...`);
    
    // Méthode 1: Chercher directement par row-index
    let nextRow = document.querySelector(`.ag-row[row-index="${nextRowIndex}"]`);
    
    if (!nextRow) {
        logAction(`  ⚠️ Ligne ${nextRowIndex} non trouvée directement, recherche alternative...`);
        
        // Méthode 2: Chercher toutes les lignes visibles et trouver la suivante
        const allRows = Array.from(document.querySelectorAll('.ag-row[row-index]'));
        const sortedRows = allRows.sort((a, b) => {
            const aIndex = parseInt(a.getAttribute('row-index'));
            const bIndex = parseInt(b.getAttribute('row-index'));
            return aIndex - bIndex;
        });
        
        // Trouver la première ligne avec un index supérieur à currentIndex
        nextRow = sortedRows.find(row => {
            const rowIndex = parseInt(row.getAttribute('row-index'));
            return rowIndex > currentIndex;
        });
        
        if (nextRow) {
            const foundIndex = parseInt(nextRow.getAttribute('row-index'));
            logAction(`  🔍 Ligne suivante trouvée avec index ${foundIndex}`);
        }
    }
    
    if (!nextRow) {
        logAction('  ❌ Aucune ligne suivante trouvée', 'error');
        return null;
    }
    
    // Chercher le select dans la colonne "subject"
    const nextSelect = nextRow.querySelector('[col-id="subject"] select.selectSubject');
    
    if (!nextSelect) {
        logAction('  ❌ Select non trouvé dans la ligne suivante', 'error');
        return null;
    }
    
    // Vérifier l'état du select de la ligne suivante
    const nextSelectValue = nextSelect.value.trim();
    
    if (nextSelectValue === 'Commune') {
        logAction('  ⚠️ La ligne suivante a déjà "Commune" sélectionné, passage à la suivante...');
        // Temporairement changer currentTargetElement pour chercher encore la suivante
        const tempCurrent = currentTargetElement;
        currentTargetElement = nextSelect;
        const nextNext = findNextRowElement();
        currentTargetElement = tempCurrent;
        return nextNext;
    } else if (nextSelectValue && nextSelectValue !== '') {
        // Une matière est déjà sélectionnée (autre que Commune)
        logAction(`  🛑 ARRÊT : Ligne suivante a déjà une matière sélectionnée ("${nextSelectValue}")`, 'error');
        logAction(`  🎯 Fin du traitement détectée - Toutes les lignes "Commune" ont été traitées`, 'success');
        return null; // Cela déclenchera l'arrêt de l'automatisation
    }
    
    logAction(`  ✅ Select trouvé dans la ligne ${getRowIndex(nextSelect)}`, 'success');
    return nextSelect;
}

// Fonction de délai
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Afficher une notification
function showNotification(message, type = 'info') {
    // Supprimer les notifications existantes
    const existingNotifications = document.querySelectorAll('.tempolist-notification');
    existingNotifications.forEach(notification => notification.remove());

    // Créer la notification
    const notification = document.createElement('div');
    notification.className = 'tempolist-notification';
    notification.textContent = message;
    
    // Styles
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'error' ? '#e74c3c' : type === 'success' ? '#27ae60' : '#3498db'};
        color: white;
        padding: 12px 20px;
        border-radius: 6px;
        font-family: Arial, sans-serif;
        font-size: 14px;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        animation: slideIn 0.3s ease-out;
    `;

    // Ajouter l'animation CSS
    if (!document.querySelector('#tempolist-notification-styles')) {
        const styles = document.createElement('style');
        styles.id = 'tempolist-notification-styles';
        styles.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
        `;
        document.head.appendChild(styles);
    }

    // Ajouter au DOM
    document.body.appendChild(notification);

    // Supprimer après 3 secondes
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 3000);
}

// Fonction utilitaire pour envoyer des messages de manière sécurisée
function safeSendMessage(message, callback) {
    try {
        // Vérifier que l'extension est toujours valide
        if (!checkExtensionValidity()) {
            console.log('[TempoList] Extension context invalidated, cannot send message');
            return;
        }
        
        chrome.runtime.sendMessage(message, (response) => {
            if (chrome.runtime.lastError) {
                console.log('[TempoList] Extension context invalidated, ignoring error:', chrome.runtime.lastError.message);
                return;
            }
            if (callback) callback(response);
        });
    } catch (error) {
        console.log('[TempoList] Extension context error:', error.message);
    }
}

// Écouter les clics droits sur les éléments
document.addEventListener('contextmenu', (e) => {
    const target = e.target;
    
    // Enregistrer les informations de l'élément cliqué
    const elementInfo = {
        tagName: target.tagName,
        id: target.id,
        className: target.className,
        type: target.type,
        rect: target.getBoundingClientRect()
    };
    
    // Si c'est dans AG-Grid, ajouter les informations spécifiques
    const agRow = target.closest('.ag-row');
    if (agRow) {
        elementInfo.rowIndex = agRow.getAttribute('row-index');
        
        const agCell = target.closest('.ag-cell');
        if (agCell) {
            elementInfo.colId = agCell.getAttribute('col-id');
        }
    }
    
    logAction(`Clic droit détecté sur: ${target.tagName}`, 'info', false);
    logAction(`Element info: ${JSON.stringify({
        tagName: elementInfo.tagName,
        id: elementInfo.id,
        className: elementInfo.className,
        rowIndex: elementInfo.rowIndex,
        colId: elementInfo.colId
    })}`);
    
    // Envoyer les informations au background script de manière sécurisée
    safeSendMessage({
        action: 'elementRightClicked',
        elementInfo: elementInfo
    });
});

// Ajouter une vérification initiale pour s'assurer que le script fonctionne
console.log('[TempoList] Script de contenu chargé et prêt');
console.log('[TempoList] URL actuelle:', window.location.href);
console.log('[TempoList] Nombre de selects trouvés:', document.querySelectorAll('select').length);

// Diagnostic initial
setTimeout(() => {
    const selects = document.querySelectorAll('select.selectSubject');
    console.log('[TempoList] Selects de matières trouvés:', selects.length);
    
    if (selects.length > 0) {
        console.log('[TempoList] Premier select trouvé:', selects[0]);
        const row = selects[0].closest('.ag-row');
        if (row) {
            console.log('[TempoList] Row-index du premier select:', row.getAttribute('row-index'));
        }
    }
    
    // Vérifier si le clic droit fonctionne
    document.addEventListener('contextmenu', () => {
        console.log('[TempoList] Clic droit détecté !');
    }, { once: true });
}, 2000);

// Fonction de test pour vérifier que tout fonctionne
function testAutomation() {
    logAction('🧪 Test de l\'automatisation manuelle');
    createDebugPanel();
    
    // Chercher le premier select sur la page
    const selects = document.querySelectorAll('select');
    if (selects.length > 0) {
        const firstSelect = selects[0];
        logAction(`✅ Select trouvé pour le test: ${firstSelect.tagName}`, 'success');
        
        startAutomation({
            tagName: firstSelect.tagName,
            id: firstSelect.id,
            className: firstSelect.className,
            type: firstSelect.type,
            rect: firstSelect.getBoundingClientRect()
        });
    } else {
        logAction('❌ Aucun select trouvé sur la page', 'error');
    }
}

// Exposer les fonctions de test pour la console
window.tempoListTest = testAutomation;
window.tempoListDiagnostic = function() {
    console.log('=== DIAGNOSTIC TEMPOLIST ===');
    console.log('Extension chargée:', typeof chrome !== 'undefined' && chrome.runtime);
    console.log('Selects total:', document.querySelectorAll('select').length);
    console.log('Selects matières:', document.querySelectorAll('select.selectSubject').length);
    console.log('Lignes AG-Grid:', document.querySelectorAll('.ag-row').length);
    
    const allSelects = document.querySelectorAll('select.selectSubject');
    console.log('Analyse des selects de matières:');
    
    allSelects.forEach((select, index) => {
        const row = select.closest('.ag-row');
        const rowIndex = row?.getAttribute('row-index');
        const value = select.value.trim();
        const status = value === '' ? '🟡 VIDE' : value === 'Commune' ? '🟢 COMMUNE' : `🔴 ${value}`;
        
        console.log(`  Ligne ${rowIndex}: ${status}`);
        
        if (index >= 10) {
            console.log(`  ... et ${allSelects.length - 10} autres lignes`);
            return false;
        }
    });
    
    const firstSelect = document.querySelector('select.selectSubject');
    if (firstSelect) {
        // Test de sélection
        const communeOption = Array.from(firstSelect.options).find(opt => 
            opt.textContent.trim().toLowerCase() === 'commune'
        );
        console.log('Option Commune trouvée:', communeOption ? communeOption.textContent : 'NON');
    }
    
    console.log('=== FIN DIAGNOSTIC ===');
};

// Auto-diagnostic au chargement
setTimeout(() => {
    window.tempoListDiagnostic();
}, 3000);

// === REMPLISSAGE AUTOMATIQUE PAR PATTERN ===

// Fonction pour démarrer le remplissage automatique par pattern
async function startPatternFill(elementInfo) {
    logAction('🎯 Début du remplissage automatique par pattern');
    
    if (isAutomationRunning) {
        logAction('⚠️ Arrêt de l\'automatisation précédente');
        stopAutomation();
    }

    // Créer le panneau de débogage
    createDebugPanel();
    
    try {
        // Charger la configuration
        await loadConfig();
        
        // Trouver tous les selects de matières dans l'ordre
        const allSelects = await findAllSubjectSelects();
        
        if (allSelects.length === 0) {
            logImportant('❌ Aucun élément à remplir trouvé', 'error');
            showNotification('Aucun élément à remplir trouvé', 'error');
            return;
        }

        logImportant(`🎯 Démarrage remplissage automatique (${allSelects.length} lignes)`, 'success');
        
        isAutomationRunning = true;
        actionCount = 0;
        showNotification('Remplissage automatique démarré - Appuyez sur Échap pour arrêter', 'success');
        
        // Démarrer le remplissage
        await executePatternFill(allSelects);
        
    } catch (error) {
        logImportant(`❌ Erreur lors du remplissage: ${error.message}`, 'error');
        console.error('Erreur lors du remplissage automatique:', error);
        stopAutomation();
        showNotification('Erreur lors du remplissage automatique', 'error');
    }
}

// Fonction pour trouver tous les selects de matières dans l'ordre
async function findAllSubjectSelects() {
    logAction('🔍 Recherche de tous les selects de matières...');
    
    // Essayer plusieurs sélecteurs pour trouver les selects de matières
    let selects = [];
    
    // Méthode 1: Par classe spécifique
    selects = document.querySelectorAll('select.selectSubject');
    if (selects.length > 0) {
        logAction(`✅ Trouvé ${selects.length} selects via .selectSubject`);
        return Array.from(selects);
    }
    
    // Méthode 2: Par attribut col-id
    selects = document.querySelectorAll('[col-id*="subject"] select, [col-id*="matière"] select, [col-id*="matiere"] select');
    if (selects.length > 0) {
        logAction(`✅ Trouvé ${selects.length} selects via col-id`);
        return Array.from(selects);
    }
    
    // Méthode 3: Tous les selects dans les lignes AG-Grid
    const agRows = document.querySelectorAll('.ag-row');
    if (agRows.length > 0) {
        selects = [];
        agRows.forEach(row => {
            const rowSelects = row.querySelectorAll('select');
            // Prendre le premier select de chaque ligne (supposé être la matière)
            if (rowSelects.length > 0) {
                selects.push(rowSelects[0]);
            }
        });
        
        if (selects.length > 0) {
            logAction(`✅ Trouvé ${selects.length} selects via AG-Grid`);
            return selects;
        }
    }
    
    // Méthode 4: Tous les selects de la page
    selects = document.querySelectorAll('select');
    logAction(`⚠️ Fallback: utilisation de tous les selects (${selects.length})`);
    return Array.from(selects);
}

// Fonction principale de remplissage par pattern
async function executePatternFill(allSelects) {
    logAction(`🎯 Début du remplissage de ${allSelects.length} éléments`);
    
    let currentSubject = '';
    let processedCount = 0;
    
    for (let i = 0; i < allSelects.length; i++) {
        if (!isAutomationRunning) {
            logAction('🛑 Arrêt demandé par l\'utilisateur');
            break;
        }
        
        const select = allSelects[i];
        const rowIndex = getRowIndex(select) || i;
        
        // Vérifier si l'élément est toujours dans le DOM
        if (!document.contains(select)) {
            logAction(`⚠️ Ligne ${rowIndex}: Élément supprimé du DOM, passage à la suivante`);
            continue;
        }
        
        // Obtenir la valeur actuelle
        const currentValue = select.value.trim();
        const selectedText = select.selectedOptions[0]?.textContent?.trim() || '';
        
        logAction(`📝 Ligne ${rowIndex}: Valeur actuelle = "${selectedText || currentValue}"`);
        
        // Si on trouve une nouvelle matière non-vide, on la garde comme référence
        if (currentValue !== '' && selectedText !== '' && selectedText !== currentSubject) {
            currentSubject = selectedText;
            logImportant(`📚 Ligne ${rowIndex}: Nouvelle matière détectée: "${currentSubject}"`);
            processedCount++;
        }
        // Si la ligne est vide et qu'on a une matière de référence, on la remplit
        else if (currentValue === '' && currentSubject !== '') {
            logAction(`🔄 Ligne ${rowIndex}: Remplissage avec "${currentSubject}"`);
            
            try {
                // Sélectionner la matière
                await setSubjectValue(select, currentSubject);
                logImportant(`✅ Ligne ${rowIndex}: "${currentSubject}" appliquée`);
                processedCount++;
                
                // Attendre entre chaque action
                await delay(AUTOMATION_CONFIG.delayBetweenActions);
                
            } catch (error) {
                logAction(`❌ Ligne ${rowIndex}: Erreur - ${error.message}`, 'error');
            }
        }
        // Si la ligne est vide et qu'on n'a pas de matière de référence
        else if (currentValue === '' && currentSubject === '') {
            logAction(`⚠️ Ligne ${rowIndex}: Vide, en attente d'une matière de référence`);
        }
        
        // Attendre entre chaque ligne
        await delay(AUTOMATION_CONFIG.delayBetweenCycles);
    }
    
    // Arrêter l'automatisation
    logImportant(`✅ Remplissage terminé - ${processedCount} lignes traitées`, 'success');
    stopAutomation(true);
}

// Fonction pour définir la valeur d'un select
async function setSubjectValue(select, subjectText) {
    // Chercher l'option correspondante
    const options = select.querySelectorAll('option');
    let targetOption = null;
    
    for (const option of options) {
        if (option.textContent.trim() === subjectText) {
            targetOption = option;
            break;
        }
    }
    
    if (!targetOption) {
        throw new Error(`Option "${subjectText}" non trouvée`);
    }
    
    // Cliquer sur le select pour le focaliser
    await clickElement(select);
    await delay(100);
    
    // Définir la valeur
    select.value = targetOption.value;
    select.selectedIndex = targetOption.index;
    
    // Déclencher les événements
    const inputEvent = new Event('input', { bubbles: true, cancelable: true });
    const changeEvent = new Event('change', { bubbles: true, cancelable: true });
    
    select.dispatchEvent(inputEvent);
    select.dispatchEvent(changeEvent);
    
    logAction(`  📡 Événements déclenchés pour "${subjectText}"`);
}

// Exposer la fonction de test pour le remplissage automatique
window.tempoListTestPattern = function() {
    logAction('🧪 Test du remplissage automatique');
    startPatternFill({ tagName: 'SELECT' });
}; 