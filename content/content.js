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
    } else if (request.action === 'rotateImage') {
        rotateImage(request.srcUrl);
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

// === ROTATION D'IMAGE POUR RENTREEDISCOUNT.COM ===

// Map pour stocker les rotations des images (sans persistance)
const imageRotations = new Map();

// Fonction pour faire pivoter une image
function rotateImage(srcUrl) {
    // Vérifier qu'on est bien sur rentreediscount.com ou scoleo.fr
    if (!window.location.hostname.includes('rentreediscount.com') && !window.location.hostname.includes('scoleo.fr')) {
        console.log('[TempoList] Rotation d\'image uniquement disponible sur rentreediscount.com ou scoleo.fr');
        return;
    }
    
    console.log('[TempoList] Rotation de l\'image:', srcUrl);
    
    // Trouver l'image sur la page
    const images = document.querySelectorAll('img');
    let targetImage = null;
    
    for (const img of images) {
        if (img.src === srcUrl) {
            targetImage = img;
            break;
        }
    }
    
    if (!targetImage) {
        console.log('[TempoList] Image non trouvée sur la page');
        return;
    }
    
    // Obtenir la rotation actuelle ou initialiser à 0
    let currentRotation = imageRotations.get(srcUrl) || 0;
    
    // Incrémenter la rotation de 90 degrés
    currentRotation += 90;
    if (currentRotation >= 360) {
        currentRotation = 0;
    }
    
    // Sauvegarder la nouvelle rotation
    imageRotations.set(srcUrl, currentRotation);
    
    // Appliquer la rotation avec une transformation CSS
    applyImageRotation(targetImage, currentRotation);
    
    console.log(`[TempoList] Image pivotée de ${currentRotation} degrés`);
}

// Fonction pour appliquer la rotation à une image
function applyImageRotation(img, rotation) {
    // Sauvegarder les propriétés originales si ce n'est pas déjà fait
    if (!img.dataset.originalData) {
        const computedStyle = window.getComputedStyle(img);
        const rect = img.getBoundingClientRect();
        
        img.dataset.originalData = JSON.stringify({
            width: computedStyle.width,
            height: computedStyle.height,
            maxWidth: computedStyle.maxWidth,
            maxHeight: computedStyle.maxHeight,
            objectFit: computedStyle.objectFit,
            actualWidth: rect.width,
            actualHeight: rect.height
        });
    }
    
    const originalData = JSON.parse(img.dataset.originalData);
    
    // Appliquer la transformation CSS
    img.style.transform = `rotate(${rotation}deg)`;
    img.style.transformOrigin = 'center center';
    img.style.transition = 'transform 0.3s ease-in-out';
    
    // Gestion intelligente des dimensions selon la rotation
    if (rotation === 90 || rotation === 270) {
        // Pour les rotations verticales, adapter les dimensions pour éviter le débordement
        const containerWidth = img.parentElement ? img.parentElement.clientWidth : window.innerWidth;
        const containerHeight = img.parentElement ? img.parentElement.clientHeight : window.innerHeight;
        
        // Calculer les nouvelles dimensions maximales en tenant compte de la rotation
        const maxDimension = Math.min(containerWidth * 0.9, containerHeight * 0.9);
        
        // Appliquer des contraintes pour éviter le débordement
        img.style.maxWidth = `${maxDimension}px`;
        img.style.maxHeight = `${maxDimension}px`;
        img.style.width = 'auto';
        img.style.height = 'auto';
        img.style.objectFit = 'contain';
        
        // S'assurer que l'image reste dans les limites du viewport
        img.style.maxWidth = `min(${maxDimension}px, 90vw)`;
        img.style.maxHeight = `min(${maxDimension}px, 90vh)`;
        
    } else {
        // Pour 0° et 180°, restaurer les dimensions originales
        img.style.width = originalData.width;
        img.style.height = originalData.height;
        img.style.maxWidth = originalData.maxWidth;
        img.style.maxHeight = originalData.maxHeight;
        img.style.objectFit = originalData.objectFit;
    }
    
    // Ajouter une classe pour identifier les images pivotées
    img.classList.add('tempolist-rotated');
    img.dataset.rotation = rotation;
    
    console.log(`[TempoList] Image dimensions ajustées pour rotation ${rotation}°`);
}

// Nettoyer les rotations quand on quitte la page (optionnel)
window.addEventListener('beforeunload', () => {
    imageRotations.clear();
});

console.log('[TempoList] Fonctionnalité de rotation d\'image chargée pour rentreediscount.com'); 

// === COLONNE ASSIST DYNAMIQUE ===
// Fonction utilitaire pour extraire la couleur depuis un texte
function extractColorFromText(text) {
    if (!text) return null;
    // Liste des couleurs françaises courantes (ajoute-en si besoin)
    const colorMap = {
        'noir': '#000',
        'blanc': '#fff',
        'rose': '#e91e63',
        'rouge': '#e53935',
        'bleu': '#1e88e5',
        'vert': '#43a047',
        'jaune': '#fbc02d',
        'violet': '#8e24aa',
        'orange': '#fb8c00',
        'gris': '#757575',
        'incolore': '#bfbfbf',
        'marron': '#795548',
        'beige': '#f5f5dc',
        'turquoise': '#1de9b6',
        'doré': '#ffd700',
        'argent': '#c0c0c0',
        'bordeaux': '#800000',
        'fuchsia': '#ff00ff',
        'fushia': '#ff00ff',
        'anis': '#bfff00',
        'cyan': '#00bcd4',
        'lilas': '#c8a2c8',
        'saumon': '#fa8072',
        'cuivre': '#b87333',
        'kaki': '#bdb76b',
        'ocre': '#cc7722',
        'prune': '#8e4585',
        'aubergine': '#580f41',
        'ivoire': '#fffff0',
        'corail': '#ff7f50',
        'bleu marine': '#001f3f',
        'bleu ciel': '#87ceeb',
        'bleu clair': '#add8e6',
        'bleu foncé': '#0d47a1',
        'vert clair': '#90ee90',
        'vert foncé': '#006400',
        'jaune fluo': '#e6fb04',
        'fluo': '#e6fb04',
    };
    // Recherche de la couleur dans le texte (priorité aux couleurs composées)
    const colorNames = Object.keys(colorMap).sort((a, b) => b.length - a.length);
    const lowerText = text.toLowerCase();
    for (const color of colorNames) {
        if (lowerText.includes(color)) {
            return { name: color, hex: colorMap[color] };
        }
    }
    return null;
}

// Fonction utilitaire pour générer le style arc-en-ciel pour le mot "Vives"
function getRainbowStyle() {
    return 'background: linear-gradient(90deg, red, orange, yellow, green, cyan, blue, violet);\
    -webkit-background-clip: text;\
    -webkit-text-fill-color: transparent;\
    background-clip: text;\
    text-fill-color: transparent; font-weight: bold;';
}

// =====================
// Listes d'exclusion par fonctionnalité
// =====================
// Références à exclure pour la couleur
const exclureRefsCouleur = [
    'JPC570015',
    'CLA1979HOC-2',
    'safb710000',
    'CASLC401LVBUWAEP',
    'BRECRIET70102',
    'P2158700',
    '1545500',
    'MAP244621',
    '3096800',
    'CLA1979HOC',
    'MAP244180',
    'CMPHT1240BVN',
    '7755200',
    '5497200',
    'EXA184072E',
    '0337900',
    'ECR07-0005',
    'EXA184071E',
    'EXA184073E',
    '9471605',
    'CMPHT1076BNB',
    'EXA5610E',
    'CLA03-0010',
    'CATANOFOBAGNOIR',
    'CLA60322C',
    'MAP870102',

    // Ajoute ici d'autres références à exclure pour la couleur
];
// Références à exclure pour la taille
const exclureRefsTaille = [
    '3212199',
    '3233907',
    '3234103',
    '3234001',
    '3346301',
    '3346701',
    '3346903',
    '3344001',
    'EXA8539E',
    '3344203',
    '3342701',
    '3342903',
    'EXA85102E',
    'EXA85105E',
    'CLA03-0013',
    '3345202',
    '3345501',
    '3233805',
    '3345101',
    '3345303',
    '3234308',
    'P3234204',
    'P3072402',
    '3345703',
    '3343804',
    '3099306',
    '3099308',
    'EXA8864E',
    'EXA8866E',
    'EXA8569E',
    'CLA03-0011',
    '3343404',
    'EXA8529E',
    'CLA03-0012',
    '3099406',
    '3346402',
    '3346503',
    '3345602',
    '3099318',
    '3345802',
    '4689600',
    '3343904',
    '3099408',
    '3343604',
    'EXA8519E',
    // Ajoute ici d'autres références à exclure pour la taille
];
// Références à exclure pour Simple/Double
const exclureRefsSimpleDouble = [
    'P5625000',
    'EXA5610E',
    // Ajoute ici d'autres références à exclure pour Simple/Double
];
// Références à exclure pour Détail Fourniture
const exclureRefsDetailFourniture = [
    // Ajoute ici d'autres références à exclure pour le détail fourniture
];
// Liste d'exclusion pour le nombre de pages/vues
const exclureRefsNbPage = [
    '2335600',
    // Ajoute ici les références à exclure pour le nombre de pages/vues
];
// Largeur de la colonne Assist (modifiable facilement)
const assistColumnWidth = 230; // en px
// =====================

// Fonction utilitaire pour extraire Simple/Double depuis un texte
function extractSimpleDoubleFromText(text) {
    if (!text) return null;
    // On cherche "simple(s)" ou "double(s)" (insensible à la casse)
    const regex = /(simple|simples|double|doubles)/i;
    const match = text.match(regex);
    if (match) {
        const val = match[0].toLowerCase();
        if (val.startsWith('double')) return 'Doubles';
        if (val.startsWith('simple')) return 'Simples';
    }
    return null;
}

// Fonction utilitaire pour extraire le détail fourniture
function extractDetailFournitureFromText(text) {
    if (!text) return null;
    // 1. Intercalaires : 6 touches, 12 touches
    const regexInter = /(6|12)\s*touches?/i;
    if (/intercalaire/i.test(text)) {
        const matchInter = text.match(regexInter);
        if (matchInter) {
            return matchInter[1] + ' inter';
        }
    }
    // 2. Grammage : 8g, 20g, 21g, 40g, 150g, 160g, 180g, 224g, 250g
    const regexGrammage = /\b(8|20|21|40|150|160|180|224|250)\s*[gG]\b/;
    const matchGrammage = text.match(regexGrammage);
    if (matchGrammage) {
        return matchGrammage[1] + 'g';
    }
    // Détail diamètre de mine : 0,5 mm, 0,7 mm, 0.5mm, 0.7mm, etc.
    const regexMineDiam = /0[\.,]([57])\s*mm/i;
    const matchMineDiam = text.match(regexMineDiam);
    if (matchMineDiam) {
        // Toujours afficher sous la forme "0,5 mm" ou "0,7 mm"
        return `0,${matchMineDiam[1]} mm`;
    }
    // Détail règle : 15cm, 20cm, 30cm, 40cm (avec ou sans espace, majuscule ou minuscule)
    const regexRegle = /([1-4]0|15|20|30)\s*cm/i;
    const matchRegle = text.match(regexRegle);
    if (matchRegle) {
        // Toujours afficher sans espace, minuscule pour cm
        return matchRegle[0].replace(/\s+/g, '').replace(/CM/i, 'cm');
    }
    // Détail crayon : mine HB, B, 2B, ... et maintenant 2H, 3H, ... 9H
    const regexMine = /mine\s*(HB|[1-9]B|B|[2-9]H|H)/i;
    const matchMine = text.match(regexMine);
    if (matchMine) {
        // Affiche toujours "mine XX" (ex: mine HB, mine 2B, mine 2H)
        return 'mine ' + matchMine[1].toUpperCase();
    }
    // Détail crayon sans le mot "mine" (ex: "CRAYON PAPIER 2B", "CRAYON PAPIER 2H")
    const regexCrayon = /crayon\s+papier.*?\b(HB|[1-9]B|B|[2-9]H|H)\b/i;
    const matchCrayon = text.match(regexCrayon);
    if (matchCrayon) {
        return 'mine ' + matchCrayon[1].toUpperCase();
    }
    return null;
}

function extractNbPageOrVueFromText(text) {
    if (!text) return null;
    // Pages : 32P, 48P, 60P, 96P, 120P, 140P, 196P (insensible à la casse, avec ou sans espace)
    const regexPage = /\b(32|48|60|96|100|120|140|192|196)\s*[pP]\b/;
    const matchPage = text.match(regexPage);
    if (matchPage) {
        return matchPage[1] + 'p';
    }
    // Vues : 32 vues, 48 vues, etc.
    const regexVue = /\b(20|30|40|50|60|80|100|120|140|160|200)\s*vues?\b/i;
    const matchVue = text.match(regexVue);
    if (matchVue) {
        return matchVue[1] + ' vues';
    }
    return null;
}

// Ajout : détection du type d'établissement (public/privé)
let etabType = null;
function detectEtabType() {
    const infoDiv = document.querySelector('.informationEtab');
    if (infoDiv) {
        const text = infoDiv.textContent.toLowerCase();
        if (text.includes('type : public')) etabType = 'public';
        else if (text.includes('type : privé') || text.includes('type : prive')) etabType = 'privé';
    }
}
detectEtabType();

// Liste des références pour lesquelles il ne faut jamais afficher d'alerte agenda (ex: agendas mixtes public/privé)
const exclureRefsAlerteAgenda = [
    'CAT3760399301573',
    // Ajoute ici les références à exclure de l'alerte agenda
];

(async function injectAssistColumnIfNeeded() {
    if (document.readyState === 'loading') {
        await new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve));
    }
    const result = await new Promise(resolve => {
        try {
            chrome.storage.local.get(['assistMode'], resolve);
        } catch (e) { resolve({ assistMode: 'none' }); }
    });
    const assistMode = result.assistMode || 'none';
    if (assistMode === 'none') {
        removeAssistColumn();
        return;
    }
    // --- HEADER ---
    const headerRow = document.querySelector('.ag-header-row');
    if (headerRow && !headerRow.querySelector('[col-id="assist"]')) {
        const imageCell = headerRow.querySelector('[col-id="image"]');
        const codeRefCell = headerRow.querySelector('[col-id="codeRef"]');
        if (imageCell && codeRefCell) {
            const assistCell = imageCell.cloneNode(true);
            assistCell.setAttribute('col-id', 'assist');
            assistCell.setAttribute('aria-colindex', parseInt(imageCell.getAttribute('aria-colindex')) + 1);
            assistCell.querySelector('.ag-header-cell-text').textContent = 'Assist';
            assistCell.style.width = '210px';
            assistCell.style.minWidth = '210px';
            assistCell.style.maxWidth = '210px';
            const leftImage = parseInt(imageCell.style.left || '0');
            const widthImage = parseInt(imageCell.style.width || '0');
            const leftAssist = leftImage + widthImage;
            assistCell.style.left = leftAssist + 'px';
            assistCell.classList.remove('ag-column-first');
            headerRow.insertBefore(assistCell, codeRefCell);
            let found = false;
            headerRow.querySelectorAll('.ag-header-cell').forEach(cell => {
                if (cell === assistCell) found = true;
                else if (found) {
                    let left = parseInt(cell.style.left || '0');
                    cell.style.left = (left + assistColumnWidth) + 'px';
                }
            });
        }
    }
    // --- LIGNES ---
    document.querySelectorAll('.ag-row').forEach(row => {
        const imageCell = row.querySelector('[col-id="image"]');
        const codeRefCell = row.querySelector('[col-id="codeRef"]');
        if (imageCell && codeRefCell && !row.querySelector('[col-id="assist"]')) {
            const assistCell = imageCell.cloneNode(true);
            assistCell.setAttribute('col-id', 'assist');
            assistCell.setAttribute('aria-colindex', parseInt(imageCell.getAttribute('aria-colindex')) + 1);
            assistCell.style.width = assistCell.style.minWidth = assistCell.style.maxWidth = '210px';
            const leftImage = parseInt(imageCell.style.left || '0');
            const widthImage = parseInt(imageCell.style.width || '0');
            const leftAssist = leftImage + widthImage;
            assistCell.style.left = leftAssist + 'px';
            assistCell.classList.remove('ag-column-first');
            const quantityCell = row.querySelector('[col-id="quantity"]');
            let quantityValue = '';
            if (quantityCell) {
                if (assistMode === 'admin') {
                    // Mode admin : lire la valeur de l'input
                    const input = quantityCell.querySelector('input.inputValuProduct[type="number"]');
                    quantityValue = input ? input.value : 'erreur';
                } else {
                    // Mode normal : comportement classique
                    const p = quantityCell.querySelector('p.inputValuProduct');
                    quantityValue = p ? p.textContent : quantityCell.textContent;
                    if (!quantityValue || quantityValue.trim() === '') quantityValue = 'erreur';
                }
            } else {
                quantityValue = 'erreur';
            }
            let refValue = '';
            const refCell = row.querySelector('[col-id="codeRef"]');
            if (refCell) {
                refValue = refCell.textContent.trim();
            }
            const nomCell = row.querySelector('[col-id="nom"]');
            let simpleDoubleValue = '';
            if (nomCell && exclureRefsSimpleDouble.indexOf(refValue) === -1) {
                const nomText = nomCell.textContent;
                const sd = extractSimpleDoubleFromText(nomText);
                if (sd) simpleDoubleValue = sd;
            }
            let detailFournitureValue = '';
            if (nomCell && exclureRefsDetailFourniture.indexOf(refValue) === -1) {
                const nomText = nomCell.textContent;
                const detail = extractDetailFournitureFromText(nomText);
                if (detail) detailFournitureValue = detail;
            }
            let tailleValue = '';
            if (nomCell && exclureRefsTaille.indexOf(refValue) === -1) {
                const nomText = nomCell.textContent;
                const taille = extractTailleFromText(nomText);
                if (taille) {
                    tailleValue = taille;
                }
            }
            let colorValue = '';
            let colorHex = '';
            let showColor = true;
            if (exclureRefsCouleur.includes(refValue)) {
                showColor = false;
            }
            if (nomCell && showColor) {
                const nomText = nomCell.textContent;
                const colorObj = extractColorFromText(nomText);
                if (colorObj) {
                    colorValue = colorObj.name.charAt(0).toUpperCase() + colorObj.name.slice(1);
                    colorHex = colorObj.hex;
                }
            }
            let nbPageOrVue = null;
            if (!exclureRefsNbPage.includes(refValue)) {
                nbPageOrVue = extractNbPageOrVueFromText(nomCell.textContent);
            }
            // Ajout : détection agenda et alerte
            let agendaAlerte = false;
            let agendaType = null;
            if (nomCell) {
                const nomText = nomCell.textContent.toLowerCase();
                if (nomText.includes('agenda')) {
                    if (nomText.includes('privé') || nomText.includes('prive')) agendaType = 'privé';
                    else if (nomText.includes('public')) agendaType = 'public';
                    // Si on a les deux infos, on compare
                    if (agendaType && etabType && agendaType !== etabType) {
                        agendaAlerte = true;
                    }
                }
            }
            // Juste avant d'afficher l'alerte :
            if (exclureRefsAlerteAgenda.indexOf(refValue) !== -1) {
                agendaAlerte = false;
            }
            let assistHtml = '';
            let parts = [`<span class=\"assist-value\" style=\"font-weight: bold;\">${quantityValue}</span>`];
            // Ajout : badge alerte si besoin
            if (agendaAlerte) {
                parts.push(`<span style=\"font-weight: bold;color: #222;\">|</span> <span style=\"background: #e74c3c; color: white; border-radius: 16px; padding: 0 14px; font-weight: bold; display: inline-block; margin-left: 4px; line-height: 1.6;\">Alerte</span>`);
            }
            if (simpleDoubleValue) {
                parts.push(`<span style=\"font-weight: bold;color: #222;\">|</span> <span style=\"font-weight: bold;\">${simpleDoubleValue}</span>`);
            }
            if (detailFournitureValue) {
                parts.push(`<span style=\"font-weight: bold;color: #222;\">|</span> <span style=\"font-weight: bold;\">${detailFournitureValue}</span>`);
            }
            if (tailleValue) {
                parts.push(`<span style=\"font-weight: bold;color: #222;\">|</span> <span style=\"font-weight: bold;\">${tailleValue}</span>`);
            }
            if (nbPageOrVue) {
                parts.push(`<span style=\"font-weight: bold;color: #222;\">|</span> <span style=\"font-weight: bold;\">${nbPageOrVue}</span>`);
            }
            if (colorValue && colorHex && showColor) {
                if (colorValue.toLowerCase() === 'vives') {
                    parts.push(`<span style=\"font-weight: bold;color: #222;\">|</span> <span style=\"${getRainbowStyle()}\">Vives</span>`);
                } else if (colorValue.toLowerCase() === 'blanc') {
                    // Badge spécial pour blanc : texte blanc sur fond gris
                    parts.push(`<span style=\"font-weight: bold;color: #222;\">|</span> <span style=\"background: #e7e7e7; color: #fff; border-radius: 16px; padding: 0 14px; font-weight: bold; display: inline-block; margin-left: 4px; line-height: 1.6; text-shadow: none;\">${colorValue}</span>`);
                } else {
                    parts.push(`<span style=\"font-weight: bold;color: #222;\">|</span> <span style=\"font-weight: bold;color: ${colorHex};text-shadow: 0 1px 1px #fff2;\">${colorValue}</span>`);
                }
            }
            assistHtml = `<div class=\"full-width-panel\" style=\"width: 100%;height: 40px;display: flex;align-items: center;justify-content: center;gap: 6px;\">${parts.join(' ')}</div>`;
            assistCell.innerHTML = assistHtml;
            row.insertBefore(assistCell, codeRefCell);
            // Décaler toutes les colonnes à droite de Assist
            let found = false;
            row.querySelectorAll('.ag-cell').forEach(cell => {
                if (cell === assistCell) found = true;
                else if (found) {
                    let left = parseInt(cell.style.left || '0');
                    cell.style.left = (left + assistColumnWidth) + 'px';
                }
            });
        }
    });
    // --- AJUSTEMENT LARGEUR DES LIGNES ET CONTAINERS ---
    // Ajuster la largeur du container principal des colonnes
    const centerContainer = document.querySelector('.ag-center-cols-container');
    if (centerContainer) {
        const oldWidth = parseInt(centerContainer.style.width || '0');
        if (oldWidth) {
            centerContainer.style.width = (oldWidth + assistColumnWidth) + 'px';
        } else {
            // fallback: calculer la largeur max des cellules
            let maxRight = 0;
            centerContainer.querySelectorAll('.ag-cell').forEach(cell => {
                const left = parseInt(cell.style.left || '0');
                const width = parseInt(cell.style.width || '0');
                if (left + width > maxRight) maxRight = left + width;
            });
            centerContainer.style.width = (maxRight) + 'px';
        }
    }
    // Ajuster la largeur de chaque ligne
    document.querySelectorAll('.ag-row').forEach(row => {
        const oldWidth = parseInt(row.style.width || '0');
        if (oldWidth) {
            row.style.width = (oldWidth + assistColumnWidth) + 'px';
        } else {
            // fallback: largeur du container
            if (centerContainer && centerContainer.style.width) {
                row.style.width = centerContainer.style.width;
            }
        }
    });
})();

// Ajoute "vives" à la liste des couleurs détectables
const oldExtractColorFromText = extractColorFromText;
extractColorFromText = function(text) {
    if (!text) return null;
    const vivesRegex = /vives?/i;
    if (vivesRegex.test(text)) {
        return { name: 'vives', hex: 'rainbow' };
    }
    return oldExtractColorFromText(text);
};

// Fonction utilitaire pour extraire la taille depuis un texte
function extractTailleFromText(text) {
    if (!text) return null;
    // Liste des tailles à détecter (tu peux en ajouter)
    const tailles = ['24x32', '17x22', 'A3', 'A4', 'A5', '11x17'];
    // Accepte aussi les variantes avec X majuscule
    const regexTailles = new RegExp(tailles.map(t => t.replace('x', '[xX]')).join('|'), 'i');
    const match = text.match(regexTailles);
    if (match) {
        let val = match[0];
        // Si c'est une taille du type 24x32, 17x22, 11x17, normalise le x en minuscule
        if (/^(\d{2}|11)[xX]\d{2}$/.test(val)) {
            return val.replace(/[xX]/, 'x');
        }
        // Pour A4/A5, laisse en majuscule
        return val.toUpperCase();
    }
    return null;
}

function removeAssistColumn() {
    document.querySelectorAll('.ag-header-row [col-id="assist"]').forEach(cell => cell.remove());
    document.querySelectorAll('.ag-row [col-id="assist"]').forEach(cell => cell.remove());
} 

// === SYSTÈME DE STATISTIQUES DES ENCODEURS ===

// Structure pour stocker les statistiques - NOUVEAU SYSTÈME
let voteHistory = []; // Historique complet de tous les votes
let encoderStats = {}; // Statistiques agrégées par encodeur
let currentListInfo = null; // Informations sur la liste actuelle

// Coefficients selon le niveau
const LEVEL_COEFFICIENTS = {
    'primaire': 1,
    'maternelle': 1,
    'collège': 2,
    'collge': 2, // Au cas où il y aurait une faute de frappe
    'college': 2,
    'lycée': 2.25,
    'lycee': 2.25
};

// Initialiser le système de statistiques
async function initEncoderStats() {
    try {
        // Vérifier si la fonctionnalité est activée
        const result = await chrome.storage.local.get(['enableEncoderStats']);
        if (!result.enableEncoderStats) {
            return; // Fonctionnalité désactivée
        }

        // Charger les données existantes - NOUVEAU SYSTÈME
        const dataResult = await chrome.storage.local.get(['voteHistory', 'encoderStats']);
        voteHistory = dataResult.voteHistory || [];
        encoderStats = dataResult.encoderStats || {};
        
        // Si on a des anciennes données encoderVotes, les migrer
        const oldVotesResult = await chrome.storage.local.get(['encoderVotes']);
        if (oldVotesResult.encoderVotes && voteHistory.length === 0) {
            console.log('[TempoList] Migration des anciennes données...');
            await migrateOldData(oldVotesResult.encoderVotes);
        }

        // Détecter si on est sur une page de liste
        if (detectListPage()) {
            setupEncoderStatsUI();
        }
    } catch (error) {
        console.error('[TempoList] Erreur lors de l\'initialisation des statistiques:', error);
    }
}

// Détecter si on est sur une page de correction de liste
function detectListPage() {
    // Chercher les éléments caractéristiques d'une page de liste
    const listInfoDiv = document.querySelector('.onelistInfo');
    
    if (listInfoDiv) {
        // Vérifier qu'on a bien les éléments d'une page de liste
        const hasEncoderInfo = Array.from(listInfoDiv.querySelectorAll('li')).some(li => 
            li.textContent.includes('Encodeur :')
        );
        
        if (hasEncoderInfo) {
            extractListInfo();
            return currentListInfo !== null;
        }
    }
    
    return false;
}

// Extraire les informations de la liste actuelle
function extractListInfo() {
    try {
        const infoDiv = document.querySelector('.onelistInfo');
        if (!infoDiv) return;

        let encoderName = '';
        let listReference = '';
        let level = '';

        // Extraire l'encodeur
        const encoderLines = infoDiv.querySelectorAll('li');
        for (const line of encoderLines) {
            const text = line.textContent.trim();
            // Vérification précise pour éviter de confondre avec "SuperEncodeur :"
            if (text.startsWith('Encodeur :') && !text.startsWith('SuperEncodeur :')) {
                encoderName = text.replace('Encodeur :', '').trim();
            } else if (text.includes('Code référence :')) {
                listReference = text.replace('Code référence :', '').trim();
            } else if (text.includes('Niveau, Classe :')) {
                const levelText = text.replace('Niveau, Classe :', '').trim().toLowerCase();
                // Extraire le niveau principal
                if (levelText.includes('primaire')) level = 'primaire';
                else if (levelText.includes('maternelle')) level = 'maternelle';
                else if (levelText.includes('collège') || levelText.includes('college') || levelText.includes('collge')) level = 'collège';
                else if (levelText.includes('lycée') || levelText.includes('lycee')) level = 'lycée';
            }
        }

        if (encoderName && listReference && level) {
            currentListInfo = {
                encoderName: encoderName,
                listReference: listReference,
                level: level,
                coefficient: LEVEL_COEFFICIENTS[level] || 1
            };
            
            console.log('[TempoList] Liste détectée:', currentListInfo);
        }
    } catch (error) {
        console.error('[TempoList] Erreur lors de l\'extraction des infos:', error);
    }
}

// Mettre en place l'interface utilisateur
function setupEncoderStatsUI() {
    if (!currentListInfo) return;

    // Calculer et afficher le score de confiance
    displayConfidenceScore();
    
    // Ajouter les boutons de vote
    addVotingButtons();
}

// Afficher le score de confiance
function displayConfidenceScore() {
    const encoderName = currentListInfo.encoderName;
    const score = calculateConfidenceScore(encoderName);
    
    // Trouver l'endroit où afficher le score (sous les boutons)
    const buttonBlock = document.querySelector('.blockListChange');
    if (!buttonBlock) return;

    // Vérifier si le score existe déjà
    let scoreDiv = document.getElementById('tempolist-confidence-score');
    if (!scoreDiv) {
        scoreDiv = document.createElement('div');
        scoreDiv.id = 'tempolist-confidence-score';
        scoreDiv.style.cssText = `
            margin: 16px auto 8px auto;
            padding: 16px;
            background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
            border-radius: 12px;
            border: 1px solid #cbd5e1;
            text-align: center;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            box-shadow: 0 3px 8px rgba(0,0,0,0.12);
            max-width: 320px;
            width: 100%;
        `;
        buttonBlock.appendChild(scoreDiv);
    }

    // Mettre à jour le contenu - NOUVEAU SYSTÈME
    const stats = encoderStats[encoderName];
    const totalVotes = stats ? stats.totalVotes : 0;
    
    let scoreColor = '#64748b'; // Gris par défaut
    let scoreText = 'Aucun vote';
    
    if (totalVotes > 0) {
        if (score >= 80) scoreColor = '#059669'; // Vert
        else if (score >= 60) scoreColor = '#d97706'; // Orange
        else scoreColor = '#dc2626'; // Rouge
        scoreText = `${score.toFixed(1)}%`;
    }

    scoreDiv.innerHTML = `
        <div style="font-weight: 600; color: #1e293b; margin-bottom: 4px;">
            📊 Score de confiance
        </div>
        <div style="font-size: 24px; font-weight: 700; color: ${scoreColor};">
            ${scoreText}
        </div>
        <div style="font-size: 12px; color: #64748b; margin-top: 4px;">
            ${totalVotes} vote${totalVotes > 1 ? 's' : ''} • Niveau: ${currentListInfo.level} (×${currentListInfo.coefficient})
        </div>
        <div style="font-size: 13px; color: #475569; margin-top: 6px; font-weight: 500; padding: 4px 8px; background: rgba(71, 85, 105, 0.1); border-radius: 4px;">
            👤 ${encoderName}
        </div>
    `;
}

// Calculer le score de confiance d'un encodeur - NOUVEAU SYSTÈME
function calculateConfidenceScore(encoderName) {
    const stats = encoderStats[encoderName];
    if (!stats || stats.totalVotes === 0) {
        return 0; // Aucun vote
    }
    
    return stats.percentage;
}

// Ajouter les boutons de vote
function addVotingButtons() {
    // Vérifier si on a déjà voté pour cette liste - NOUVEAU SYSTÈME
    const encoderName = currentListInfo.encoderName;
    const listReference = currentListInfo.listReference;
    
    const hasVoted = voteHistory.some(vote => vote.listReference === listReference);

    // Trouver l'endroit où ajouter les boutons
    const buttonBlock = document.querySelector('.blockListChange');
    if (!buttonBlock) return;

    // Vérifier si les boutons existent déjà
    let votingDiv = document.getElementById('tempolist-voting-buttons');
    if (!votingDiv) {
        votingDiv = document.createElement('div');
        votingDiv.id = 'tempolist-voting-buttons';
        votingDiv.style.cssText = `
            margin: 12px auto 16px auto;
            display: flex;
            gap: 12px;
            justify-content: center;
            max-width: 320px;
            width: 100%;
        `;
        buttonBlock.appendChild(votingDiv);
    }

    votingDiv.innerHTML = '';

    if (hasVoted) {
        // Afficher un message et un bouton pour annuler le vote
        const unlockBtn = document.createElement('button');
        unlockBtn.innerHTML = '🔓 Annuler le vote';
        unlockBtn.style.cssText = `
            padding: 10px 20px;
            background: #f59e0b;
            color: white;
            border: none;
            border-radius: 8px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s ease;
            font-size: 14px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            flex: 1;
            min-width: 140px;
        `;
        unlockBtn.onmouseover = () => unlockBtn.style.background = '#d97706';
        unlockBtn.onmouseout = () => unlockBtn.style.background = '#f59e0b';
        unlockBtn.onclick = () => unlockVote();

        votingDiv.innerHTML = `
            <div style="
                padding: 10px 16px;
                background: #f1f5f9;
                border: 1px solid #cbd5e1;
                border-radius: 8px;
                color: #475569;
                font-size: 14px;
                text-align: center;
                font-weight: 500;
                margin-bottom: 12px;
                width: 100%;
            ">
                ✅ Vous avez déjà voté pour cette liste
            </div>
        `;
        
        votingDiv.appendChild(unlockBtn);
        return;
    }

    // Créer les boutons de vote
    const positiveBtn = document.createElement('button');
    positiveBtn.innerHTML = '✅ Liste correcte';
    positiveBtn.style.cssText = `
        padding: 10px 16px;
        background: #059669;
        color: white;
        border: none;
        border-radius: 8px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
        font-size: 14px;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        flex: 1;
        min-width: 140px;
    `;
    positiveBtn.onmouseover = () => positiveBtn.style.background = '#047857';
    positiveBtn.onmouseout = () => positiveBtn.style.background = '#059669';
    positiveBtn.onclick = () => voteForEncoder(true);

    const negativeBtn = document.createElement('button');
    negativeBtn.innerHTML = '❌ Liste avec erreurs';
    negativeBtn.style.cssText = `
        padding: 10px 16px;
        background: #dc2626;
        color: white;
        border: none;
        border-radius: 8px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
        font-size: 14px;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        flex: 1;
        min-width: 140px;
    `;
    negativeBtn.onmouseover = () => negativeBtn.style.background = '#b91c1c';
    negativeBtn.onmouseout = () => negativeBtn.style.background = '#dc2626';
    negativeBtn.onclick = () => voteForEncoder(false);

    votingDiv.appendChild(positiveBtn);
    votingDiv.appendChild(negativeBtn);
}

// Annuler un vote pour un encodeur - NOUVEAU SYSTÈME
async function unlockVote() {
    try {
        const listReference = currentListInfo.listReference;

        // Trouver le vote dans l'historique
        const voteIndex = voteHistory.findIndex(vote => vote.listReference === listReference);
        if (voteIndex === -1) {
            alert('Aucun vote à annuler pour cette liste !');
            return;
        }

        // Suppression directe sans confirmation
        const removedVote = voteHistory[voteIndex];
        
        // Supprimer de l'historique
        voteHistory.splice(voteIndex, 1);

        // Recalculer les statistiques à partir de l'historique
        recalculateStats();

        // Sauvegarder
        await saveEncoderData();

        // Mettre à jour l'affichage
        displayConfidenceScore();
        addVotingButtons();

        // Notification
        showNotification('Vote annulé ! Vous pouvez voter à nouveau.', 'success');
        
        console.log(`[TempoList] Vote annulé pour ${removedVote.encoderName} sur la liste ${listReference}`);

    } catch (error) {
        console.error('[TempoList] Erreur lors de l\'annulation du vote:', error);
        showNotification('Erreur lors de l\'annulation du vote', 'error');
    }
}

// Enregistrer un vote pour un encodeur - NOUVEAU SYSTÈME
async function voteForEncoder(isPositive) {
    try {
        const encoderName = currentListInfo.encoderName;
        const listReference = currentListInfo.listReference;
        const coefficient = currentListInfo.coefficient;
        const level = currentListInfo.level;

        // Vérifier si on a déjà voté pour cette liste
        const existingVote = voteHistory.find(vote => vote.listReference === listReference);
        if (existingVote) {
            alert('Vous avez déjà voté pour cette liste !');
            return;
        }

        // Créer le nouveau vote
        const newVote = {
            encoderName: encoderName,
            listReference: listReference,
            isPositive: isPositive,
            level: level,
            coefficient: coefficient,
            timestamp: Date.now()
        };

        // Ajouter à l'historique
        voteHistory.push(newVote);

        // Mettre à jour les statistiques agrégées
        if (!encoderStats[encoderName]) {
            encoderStats[encoderName] = {
                totalVotes: 0,
                positiveScore: 0,
                negativeScore: 0,
                percentage: 0
            };
        }

        const stats = encoderStats[encoderName];
        stats.totalVotes++;
        if (isPositive) {
            stats.positiveScore += coefficient;
        } else {
            stats.negativeScore += coefficient;
        }

        // Recalculer le pourcentage
        const totalScore = stats.positiveScore + stats.negativeScore;
        stats.percentage = totalScore > 0 ? (stats.positiveScore / totalScore) * 100 : 0;

        // Sauvegarder dans le storage
        await saveEncoderData();

        // Mettre à jour l'affichage
        displayConfidenceScore();
        addVotingButtons(); // Rafraîchir les boutons

        // Afficher une notification
        const scoreAfter = stats.percentage;
        const voteType = isPositive ? 'positive' : 'négative';
        showNotification(
            `Vote ${voteType} enregistré ! Score: ${scoreAfter.toFixed(1)}%`,
            isPositive ? 'success' : 'warning'
        );

        console.log(`[TempoList] Vote enregistré pour ${encoderName}: ${isPositive ? '+' : '-'}${coefficient}`);

    } catch (error) {
        console.error('[TempoList] Erreur lors du vote:', error);
        showNotification('Erreur lors de l\'enregistrement du vote', 'error');
    }
}

// Sauvegarder les données dans le storage - NOUVEAU SYSTÈME
async function saveEncoderData() {
    try {
        await chrome.storage.local.set({ 
            voteHistory: voteHistory,
            encoderStats: encoderStats 
        });
        console.log('[TempoList] Données sauvegardées:', { historyCount: voteHistory.length, statsCount: Object.keys(encoderStats).length });
    } catch (error) {
        console.error('[TempoList] Erreur lors de la sauvegarde:', error);
    }
}

// Migrer les anciennes données vers le nouveau système
async function migrateOldData(oldEncoderVotes) {
    console.log('[TempoList] Migration en cours...', oldEncoderVotes);
    // On ne peut pas parfaitement migrer car on n'a pas l'historique détaillé
    // On va juste créer les stats agrégées
    for (const encoderName in oldEncoderVotes) {
        const oldData = oldEncoderVotes[encoderName];
        encoderStats[encoderName] = {
            totalVotes: (oldData.positiveVotes + oldData.negativeVotes) || 0,
            positiveScore: oldData.positiveVotes || 0,
            negativeScore: oldData.negativeVotes || 0,
            percentage: 0
        };
        
        // Calculer le pourcentage
        const total = encoderStats[encoderName].positiveScore + encoderStats[encoderName].negativeScore;
        if (total > 0) {
            encoderStats[encoderName].percentage = (encoderStats[encoderName].positiveScore / total) * 100;
        }
    }
    
    await saveEncoderData();
    console.log('[TempoList] Migration terminée');
}

// Recalculer les statistiques à partir de l'historique
function recalculateStats() {
    // Réinitialiser les stats
    encoderStats = {};
    
    // Parcourir l'historique des votes
    voteHistory.forEach(vote => {
        const { encoderName, isPositive, coefficient } = vote;
        
        // Initialiser l'encodeur s'il n'existe pas
        if (!encoderStats[encoderName]) {
            encoderStats[encoderName] = {
                totalVotes: 0,
                positiveScore: 0,
                negativeScore: 0,
                percentage: 0
            };
        }
        
        // Ajouter le vote
        encoderStats[encoderName].totalVotes++;
        if (isPositive) {
            encoderStats[encoderName].positiveScore += coefficient;
        } else {
            encoderStats[encoderName].negativeScore += coefficient;
        }
    });
    
    // Calculer les pourcentages
    Object.keys(encoderStats).forEach(encoderName => {
        const stats = encoderStats[encoderName];
        const totalScore = stats.positiveScore + stats.negativeScore;
        stats.percentage = totalScore > 0 ? (stats.positiveScore / totalScore) * 100 : 0;
    });
    
    console.log('[TempoList] Statistiques recalculées:', encoderStats);
}

// Fonction de debug pour afficher les données - accessible depuis la console
function debugEncoderData() {
    console.log('=== DONNÉES ENCODEURS DEBUG ===');
    console.log('Historique des votes:', voteHistory);
    console.log('Statistiques agrégées:', encoderStats);
    console.log('Info liste actuelle:', currentListInfo);
    console.log('Total votes dans l\'historique:', voteHistory.length);
    console.log('Nombre d\'encodeurs suivis:', Object.keys(encoderStats).length);
    console.log('===============================');
    return { voteHistory, encoderStats, currentListInfo };
}

// Rendre la fonction accessible globalement pour debug
window.debugTempoListStats = debugEncoderData;



// Initialiser le système au chargement de la page
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(initEncoderStats, 1000); // Attendre que la page soit bien chargée
    });
} else {
    setTimeout(initEncoderStats, 1000);
}

// Réinitialiser si la page change (SPA)
let lastUrl = location.href;
new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
        lastUrl = url;
        currentListInfo = null;
        setTimeout(initEncoderStats, 1000);
    }
}).observe(document, { subtree: true, childList: true });