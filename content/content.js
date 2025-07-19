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
    '3344304',
    '3346802',
    '3342802',
    'CLA03-0024',
    'EXA85103E',
    'EXA85109E',
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
    // 2. Grammage : 8g, 20g, 21g, 40g, 125g, 150g, 160g, 180g, 224g, 250g
    const regexGrammage = /\b(8|20|21|40|125|150|160|180|224|250)\s*[gG]\b/;
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

// Initialiser le système de statistiques - OPTIMISÉ
async function initEncoderStats() {
    try {
        // OPTIMISATION 1: Détecter le type de page via l'URL
        const isListPage = isListPageByURL();
        const isValidationTablePage = isValidationTablePageByURL();
        
        if (!isListPage && !isValidationTablePage) {
            return; // Pas une page concernée par les statistiques
        }
        
        // Vérifier les options activées
        const result = await chrome.storage.local.get(['enableEncoderStats', 'enableTableStats']);
        if (!result.enableEncoderStats) {
            return; // Fonctionnalité désactivée
        }
        
        // Charger les données en arrière-plan
        const dataResult = await chrome.storage.local.get(['voteHistory', 'encoderStats']);
        voteHistory = dataResult.voteHistory || [];
        encoderStats = dataResult.encoderStats || {};
        
        // Si on a des anciennes données encoderVotes, les migrer
        const oldVotesResult = await chrome.storage.local.get(['encoderVotes']);
        if (oldVotesResult.encoderVotes && voteHistory.length === 0) {
            console.log('[TempoList] Migration des anciennes données...');
            await migrateOldData(oldVotesResult.encoderVotes);
        }

        // TRAITEMENT SELON LE TYPE DE PAGE
        if (isListPage) {
            // Page de liste individuelle - comportement existant
            extractListInfo();
            if (currentListInfo) {
                setupEncoderStatsUIImmediate();
                updateEncoderStatsUIWithData();
            }
        } else if (isValidationTablePage && result.enableTableStats) {
            // Page des listes à valider - nouveau comportement
            setupValidationTableStats();
        }
    } catch (error) {
        console.error('[TempoList] Erreur lors de l\'initialisation des statistiques:', error);
    }
}

// OPTIMISATION: Détecter une page de liste via l'URL (plus rapide)
function isListPageByURL() {
    const url = window.location.href;
    // Pattern: https://crealiste.com/encodeur/listeFournitures/148469
    return url.includes('/encodeur/listeFournitures/') || url.includes('/encodeur/listeLibrairie/');
}

// NOUVEAU: Détecter la page des listes à valider
function isValidationTablePageByURL() {
    const url = window.location.href;
    // Pattern: https://crealiste.com/encodeur/listesAValider
    return url.includes('/encodeur/listesAValider');
}

// Détecter si on est sur une page de correction de liste (méthode DOM - backup)
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

// OPTIMISÉ: Afficher immédiatement l'UI avec un skeleton
function setupEncoderStatsUIImmediate() {
    if (!currentListInfo) return;

    // Afficher immédiatement le bloc avec état de chargement
    displayConfidenceScoreSkeleton();
    
    // Afficher immédiatement les boutons avec état de chargement
    addVotingButtonsSkeleton();
}

// OPTIMISÉ: Mettre à jour l'UI avec les vraies données
function updateEncoderStatsUIWithData() {
    if (!currentListInfo) return;

    // Mettre à jour avec les vraies données
    displayConfidenceScore();
    addVotingButtons();
}

// Mettre en place l'interface utilisateur (ancienne méthode - conservée pour compatibilité)
function setupEncoderStatsUI() {
    if (!currentListInfo) return;

    // Calculer et afficher le score de confiance
    displayConfidenceScore();
    
    // Ajouter les boutons de vote
    addVotingButtons();
}

// SKELETON: Afficher immédiatement le score avec un état de chargement
function displayConfidenceScoreSkeleton() {
    const encoderName = currentListInfo.encoderName;
    
    // Trouver l'endroit où afficher le score (sous les boutons)
    const buttonBlock = document.querySelector('.blockListChange');
    if (!buttonBlock) return;

    // Créer le bloc de score avec skeleton
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

    // Afficher le skeleton avec animation de chargement
    scoreDiv.innerHTML = `
        <div style="font-weight: 600; color: #1e293b; margin-bottom: 4px;">
            📊 Score de confiance
        </div>
        <div style="font-size: 24px; font-weight: 700; color: #64748b;">
            Chargement...
        </div>
        <div style="font-size: 12px; color: #64748b; margin-top: 4px;">
            Calcul en cours • Niveau: ${currentListInfo.level} (×${currentListInfo.coefficient})
        </div>
        <div style="font-size: 13px; color: #475569; margin-top: 6px; font-weight: 500; padding: 4px 8px; background: rgba(71, 85, 105, 0.1); border-radius: 4px;">
            👤 ${encoderName}
        </div>
    `;
}

// Afficher le score de confiance avec les vraies données
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

// SKELETON: Afficher immédiatement les boutons avec état de chargement
function addVotingButtonsSkeleton() {
    // Trouver l'endroit où ajouter les boutons
    const buttonBlock = document.querySelector('.blockListChange');
    if (!buttonBlock) return;

    // Créer le container des boutons
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

    // Afficher des boutons skeleton en attendant les données (ordre: Erreurs puis Correcte)
    votingDiv.innerHTML = `
        <button style="
            padding: 10px 16px;
            background: #e2e8f0;
            color: #64748b;
            border: none;
            border-radius: 8px;
            font-weight: 600;
            font-size: 14px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            flex: 1;
            min-width: 140px;
            opacity: 0.7;
            cursor: wait;
        " disabled>
            <div style="width: 16px; height: 16px; background: #cbd5e1; border-radius: 3px;"></div>
            Erreurs...
        </button>
        <button style="
            padding: 10px 16px;
            background: #e2e8f0;
            color: #64748b;
            border: none;
            border-radius: 8px;
            font-weight: 600;
            font-size: 14px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            flex: 1;
            min-width: 140px;
            opacity: 0.7;
            cursor: wait;
        " disabled>
            <div style="width: 16px; height: 16px; background: #cbd5e1; border-radius: 3px;"></div>
            Correcte...
        </button>
    `;
}

// Ajouter les boutons de vote avec nouveaux designs
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
        // Message "Vous avez déjà voté" avec nouveau design
        const votedMessage = document.createElement('div');
        votedMessage.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
              <path d="M4 0a2 2 0 0 0-2 2v1.133l-.941.502A2 2 0 0 0 0 5.4V14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V5.4a2 2 0 0 0-1.059-1.765L14 3.133V2a2 2 0 0 0-2-2zm10 4.267.47.25A1 1 0 0 1 15 5.4v.817l-1 .6zm-1 3.15-3.75 2.25L8 8.917l-1.25.75L3 7.417V2a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1zm-11-.6-1-.6V5.4a1 1 0 0 1 .53-.882L2 4.267zm13 .566v5.734l-4.778-2.867zm-.035 6.88A1 1 0 0 1 14 15H2a1 1 0 0 1-.965-.738L8 10.083zM1 13.116V7.383l4.778 2.867L1 13.117Z"/>
            </svg>
            Vous avez déjà voté
        `;
        votedMessage.style.cssText = `
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
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
        `;

        // Bouton "Annuler" avec nouveau design - HAUTEUR HARMONISÉE
        const unlockBtn = document.createElement('button');
        unlockBtn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
              <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14m0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16"/>
              <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708"/>
            </svg>
            Annuler
        `;
        unlockBtn.style.cssText = `
            padding: 10px 16px;
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
            gap: 8px;
            flex: 1;
            min-width: 140px;
        `;
        unlockBtn.onmouseover = () => unlockBtn.style.background = '#d97706';
        unlockBtn.onmouseout = () => unlockBtn.style.background = '#f59e0b';
        unlockBtn.onclick = () => unlockVote();

        votingDiv.appendChild(votedMessage);
        votingDiv.appendChild(unlockBtn);
        return;
    }

    // INVERSION: Bouton "Correcte" EN PREMIER (avant c'était en second)
    const positiveBtn = document.createElement('button');
    positiveBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
          <path fill-rule="evenodd" d="M10.854 8.146a.5.5 0 0 1 0 .708l-3 3a.5.5 0 0 1-.708 0l-1.5-1.5a.5.5 0 0 1 .708-.708L7.5 10.793l2.646-2.647a.5.5 0 0 1 .708 0"/>
          <path d="M8 1a2.5 2.5 0 0 1 2.5 2.5V4h-5v-.5A2.5 2.5 0 0 1 8 1m3.5 3v-.5a3.5 3.5 0 1 0-7 0V4H1v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V4zM2 5h12v9a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1z"/>
        </svg>
        Correcte
    `;
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
        gap: 8px;
        flex: 1;
        min-width: 140px;
    `;
    positiveBtn.onmouseover = () => positiveBtn.style.background = '#047857';
    positiveBtn.onmouseout = () => positiveBtn.style.background = '#059669';
    positiveBtn.onclick = () => voteForEncoder(true);

    // INVERSION: Bouton "Erreurs" EN SECOND (avant c'était en premier)
    const negativeBtn = document.createElement('button');
    negativeBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
          <path fill-rule="evenodd" d="M6.146 8.146a.5.5 0 0 1 .708 0L8 9.293l1.146-1.147a.5.5 0 1 1 .708.708L8.707 10l1.147 1.146a.5.5 0 0 1-.708.708L8 10.707l-1.146 1.147a.5.5 0 0 1-.708-.708L7.293 10 6.146 8.854a.5.5 0 0 1 0-.708"/>
          <path d="M8 1a2.5 2.5 0 0 1 2.5 2.5V4h-5v-.5A2.5 2.5 0 0 1 8 1m3.5 3v-.5a3.5 3.5 0 1 0-7 0V4H1v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V4zM2 5h12v9a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1z"/>
        </svg>
        Erreurs
    `;
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
        gap: 8px;
        flex: 1;
        min-width: 140px;
    `;
    negativeBtn.onmouseover = () => negativeBtn.style.background = '#b91c1c';
    negativeBtn.onmouseout = () => negativeBtn.style.background = '#dc2626';
    negativeBtn.onclick = () => voteForEncoder(false);

    // INVERSION: Ajouter d'abord "Erreurs" puis "Correcte" (Erreurs à gauche, Correcte à droite)
    votingDiv.appendChild(negativeBtn);
    votingDiv.appendChild(positiveBtn);
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



// === GESTION DES STATISTIQUES DANS LE TABLEAU DES LISTES À VALIDER ===

// Configuration pour analyser le tableau avec surveillance des changements dynamiques
function setupValidationTableStats() {
    console.log('[TempoList] Configuration des statistiques pour le tableau des listes à valider');
    
    // Attendre que le tableau soit chargé
    const checkTableLoaded = () => {
        const tableBody = document.querySelector('tbody.listesTable');
        if (tableBody && tableBody.children.length > 0) {
            processValidationTable(tableBody);
            setupTableObserver(tableBody);
        } else {
            // Réessayer dans 500ms si le tableau n'est pas encore chargé
            setTimeout(checkTableLoaded, 500);
        }
    };
    
    checkTableLoaded();
}

// Surveiller les changements dynamiques du tableau (sélection super-encodeur)
function setupTableObserver(tableBody) {
    // Éviter les observateurs multiples
    if (tableBody.hasAttribute('data-tempolist-observer')) {
        return;
    }
    tableBody.setAttribute('data-tempolist-observer', 'true');
    
    console.log('[TempoList] Installation de l\'observateur de changements du tableau');
    
    // Variable pour le debounce (éviter trop de traitements)
    let reprocessTimeout = null;
    
    const observer = new MutationObserver((mutations) => {
        let shouldReprocess = false;
        
        // Vérifier si le contenu du tableau a changé significativement
        mutations.forEach((mutation) => {
            if (mutation.type === 'childList') {
                // Si des lignes ont été ajoutées/supprimées
                if (mutation.addedNodes.length > 0 || mutation.removedNodes.length > 0) {
                    shouldReprocess = true;
                }
            }
        });
        
        if (shouldReprocess) {
            console.log('[TempoList] Changement détecté dans le tableau...');
            
            // Annuler le traitement précédent s'il existe (debounce)
            if (reprocessTimeout) {
                clearTimeout(reprocessTimeout);
            }
            
            // Programmer un nouveau traitement avec délai
            reprocessTimeout = setTimeout(() => {
                console.log('[TempoList] Retraitement des statistiques après stabilisation');
                processValidationTable(tableBody);
                reprocessTimeout = null;
            }, 500); // Délai augmenté pour plus de stabilité
        }
    });
    
    // Observer les changements avec des options appropriées
    observer.observe(tableBody, {
        childList: true,
        subtree: true
    });
    
    console.log('[TempoList] Observateur installé avec succès');
}

// Traiter le tableau des listes à valider avec protection contre les erreurs
function processValidationTable(tableBody) {
    try {
        console.log('[TempoList] Traitement du tableau des listes à valider');
        
        // Vérification de sécurité
        if (!tableBody || !tableBody.children) {
            console.warn('[TempoList] Tableau invalide, arrêt du traitement');
            return;
        }
        
        const rows = Array.from(tableBody.children);
        let currentEncoder = null;
        let processedCount = 0;
        
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            
            // Protection supplémentaire
            if (!row || !row.children) {
                continue;
            }
            
            // Vérifier si c'est une ligne d'en-tête (contient les infos de l'encodeur)
            if (row.children.length === 1 && row.children[0] && row.children[0].getAttribute('colspan') === '8') {
                // Extraire le nom de l'encodeur de cette ligne
                const cellContent = row.children[0].textContent || '';
                const encoderMatch = cellContent.match(/Encodeur\s*:\s*([^,]+)/);
                if (encoderMatch && encoderMatch[1]) {
                    currentEncoder = encoderMatch[1].trim();
                    console.log('[TempoList] Encodeur détecté:', currentEncoder);
                }
            } 
            // Vérifier si c'est une ligne de données (6 cellules ou plus)
            else if (row.children.length >= 6 && currentEncoder) {
                // Trouver la cellule dateCreate pour y ajouter les statistiques
                const dateCreateCell = row.querySelector('td.dateCreate');
                if (dateCreateCell) {
                    addEncoderStatsToTableRow(dateCreateCell, currentEncoder);
                    processedCount++;
                }
            }
        }
        
        console.log(`[TempoList] Traitement terminé: ${processedCount} blocs de statistiques traités`);
        
    } catch (error) {
        console.error('[TempoList] Erreur lors du traitement du tableau:', error);
        // Ne pas faire planter l'application, continuer silencieusement
    }
}

// Ajouter les statistiques d'un encodeur à une ligne du tableau
function addEncoderStatsToTableRow(dateCreateCell, encoderName) {
    // Vérifier si les stats ont déjà été ajoutées
    if (dateCreateCell.querySelector('.tempolist-table-stats')) {
        return;
    }
    
    // Calculer les statistiques de l'encodeur
    const score = calculateConfidenceScore(encoderName);
    const stats = encoderStats[encoderName];
    const totalVotes = stats ? stats.totalVotes : 0;
    
    // Déterminer la couleur du score
    let scoreColor = '#64748b'; // Gris par défaut
    let scoreText = 'Aucun vote';
    
    if (totalVotes > 0) {
        if (score >= 80) scoreColor = '#059669'; // Vert
        else if (score >= 60) scoreColor = '#d97706'; // Orange
        else scoreColor = '#dc2626'; // Rouge
        scoreText = `${score.toFixed(1)}%`;
    }
    
    // Créer le bloc de statistiques (version allégée pour le tableau)
    const statsDiv = document.createElement('div');
    statsDiv.className = 'tempolist-table-stats';
    statsDiv.style.cssText = `
        margin-top: 12px;
        padding: 10px 14px;
        background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
        border-radius: 8px;
        border: 1px solid #cbd5e1;
        text-align: center;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        box-shadow: 0 2px 4px rgba(0,0,0,0.08);
        font-size: 12px;
    `;
    
    statsDiv.innerHTML = `
        <div style="font-weight: 600; color: #1e293b; margin-bottom: 3px; font-size: 13px;">
            📊 Score de confiance
        </div>
        <div style="font-size: 20px; font-weight: 700; color: ${scoreColor};">
            ${scoreText}
        </div>
        <div style="font-size: 12px; color: #64748b; margin-top: 3px;">
            ${totalVotes} vote${totalVotes > 1 ? 's' : ''}
        </div>
        <div style="font-size: 13px; color: #475569; margin-top: 5px; font-weight: 500; padding: 3px 8px; background: rgba(71, 85, 105, 0.1); border-radius: 4px;">
            👤 ${encoderName}
        </div>
    `;
    
    // Ajouter le bloc à la cellule
    dateCreateCell.appendChild(statsDiv);
    
    console.log(`[TempoList] Statistiques ajoutées pour ${encoderName}: ${scoreText} (${totalVotes} votes)`);
}

// OPTIMISÉ: Initialiser le système rapidement avec affichage immédiat
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(initEncoderStats, 100); // Réduit de 1000ms à 100ms grâce à l'optimisation
    });
} else {
    setTimeout(initEncoderStats, 100); // Réduit de 1000ms à 100ms grâce à l'optimisation
}

// Réinitialiser si la page change (SPA) - OPTIMISÉ
let lastUrl = location.href;
new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
        lastUrl = url;
        currentListInfo = null;
        setTimeout(initEncoderStats, 100); // Réduit de 1000ms à 100ms grâce à l'optimisation
    }
}).observe(document, { subtree: true, childList: true });

// ========================================
// FONCTIONNALITÉ D'AFFICHAGE DES EXTENSIONS DE PIÈCES JOINTES
// ========================================

// Configuration par défaut pour l'affichage des extensions
let ATTACHMENT_EXTENSIONS_CONFIG = {
    enabled: true // Activée par défaut
};

// Charger la configuration des extensions de PJ
async function loadAttachmentExtensionsConfig() {
    try {
        const result = await chrome.storage.sync.get('attachmentExtensionsConfig');
        if (result.attachmentExtensionsConfig) {
            ATTACHMENT_EXTENSIONS_CONFIG = { ...ATTACHMENT_EXTENSIONS_CONFIG, ...result.attachmentExtensionsConfig };
        }
    } catch (error) {
        console.log(`[TempoList] Erreur lors du chargement de la configuration des extensions de PJ: ${error.message}`);
    }
}

// Fonction pour extraire l'extension d'un fichier à partir d'une URL
function getFileExtension(url) {
    try {
        // Supprimer les paramètres d'URL et extraire le nom de fichier
        const urlPart = url.split('?')[0];
        const fileName = urlPart.split('/').pop();
        const extension = fileName.split('.').pop().toLowerCase();
        
        // Vérifier que ce n'est pas juste le nom du fichier sans extension
        if (extension && extension !== fileName && extension.length <= 6) {
            return extension;
        }
        return null;
    } catch (error) {
        console.log(`[TempoList] Erreur lors de l'extraction de l'extension: ${error.message}`);
        return null;
    }
}

// Fonction pour obtenir une couleur en fonction de l'extension
function getExtensionColor(extension) {
    const colorMap = {
        // Images
        'png': '#10b981',
        'jpg': '#10b981', 
        'jpeg': '#10b981',
        'gif': '#10b981',
        'bmp': '#10b981',
        'webp': '#10b981',
        'svg': '#10b981',
        
        // Documents
        'pdf': '#dc2626',
        'doc': '#3b82f6',
        'docx': '#3b82f6',
        'xls': '#059669',
        'xlsx': '#059669',
        'ppt': '#ea580c',
        'pptx': '#ea580c',
        'txt': '#6b7280',
        'rtf': '#6b7280',
        
        // Archives
        'zip': '#7c3aed',
        'rar': '#7c3aed',
        '7z': '#7c3aed',
        
        // Audio/Vidéo
        'mp3': '#f59e0b',
        'mp4': '#f59e0b',
        'avi': '#f59e0b',
        'mov': '#f59e0b',
        'wav': '#f59e0b',
        
        // Par défaut
        'default': '#6b7280'
    };
    
    return colorMap[extension] || colorMap['default'];
}

// Fonction pour créer l'étiquette d'extension
function createExtensionBadge(extension) {
    const badge = document.createElement('span');
    badge.className = 'tempolist-extension-badge';
    badge.textContent = extension.toUpperCase();
    badge.style.cssText = `
        display: inline-block;
        background-color: ${getExtensionColor(extension)};
        color: white;
        font-size: 10px;
        font-weight: bold;
        padding: 4px 8px;
        border-radius: 4px;
        margin: 0 8px;
        vertical-align: 7px;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
        line-height: 1;
        position: relative;
        top: -1px;
    `;
    
    return badge;
}

// Fonction principale pour ajouter les badges d'extension aux pièces jointes
function addExtensionBadgesToAttachments() {
    // Vérifier si la fonctionnalité est activée
    if (!ATTACHMENT_EXTENSIONS_CONFIG.enabled) {
        return;
    }
    
    // Vérifier qu'on est sur une page crealiste.com avec des pièces jointes
    if (!window.location.hostname.includes('crealiste.com')) {
        return;
    }
    
    // Chercher tous les boutons de suppression de pièces jointes
    const deleteButtons = document.querySelectorAll('.buttonSupImgpjNew');
    
    deleteButtons.forEach(deleteButton => {
        // Vérifier si un badge n'a pas déjà été ajouté
        if (deleteButton.parentNode.querySelector('.tempolist-extension-badge')) {
            return;
        }
        
        // Trouver le lien de l'œil (bouton de visualisation) dans la même ligne
        const row = deleteButton.closest('tr');
        if (!row) return;
        
        const eyeLink = row.querySelector('a[href][title]:not(.buttonSupImgpjNew)');
        if (!eyeLink) return;
        
        const fileUrl = eyeLink.getAttribute('href');
        if (!fileUrl) return;
        
        const extension = getFileExtension(fileUrl);
        if (!extension) return;
        
        // Créer et ajouter le badge avec un espacement équilibré
        const badge = createExtensionBadge(extension);
        
        // S'assurer que le badge est correctement positionné entre l'œil et la corbeille
        const actionCell = deleteButton.parentNode;
        const eyeLinkForPosition = actionCell.querySelector('a[href][title]:not(.buttonSupImgpjNew)');
        
        if (eyeLinkForPosition && eyeLinkForPosition.nextSibling) {
            // Insérer le badge après le lien de l'œil
            eyeLinkForPosition.parentNode.insertBefore(badge, eyeLinkForPosition.nextSibling);
        } else {
            // Fallback : insérer avant le bouton de suppression
            actionCell.insertBefore(badge, deleteButton);
        }
        
        console.log(`[TempoList] Badge d'extension "${extension}" ajouté pour ${fileUrl}`);
    });
}

// Observer pour détecter les changements dans le DOM
let attachmentObserver = null;

// Fonction pour démarrer l'observation des pièces jointes
function startAttachmentObserver() {
    if (!ATTACHMENT_EXTENSIONS_CONFIG.enabled) {
        return;
    }
    
    // Arrêter l'observateur existant s'il y en a un
    if (attachmentObserver) {
        attachmentObserver.disconnect();
    }
    
    // Ajouter les badges aux éléments existants
    addExtensionBadgesToAttachments();
    
    // Créer un nouvel observateur pour les nouveaux éléments
    attachmentObserver = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'childList') {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        // Vérifier si des boutons de suppression de PJ ont été ajoutés
                        if (node.querySelector && node.querySelector('.buttonSupImgpjNew')) {
                            setTimeout(() => addExtensionBadgesToAttachments(), 100);
                        }
                    }
                });
            }
        });
    });
    
    // Commencer l'observation
    attachmentObserver.observe(document.body, {
        childList: true,
        subtree: true
    });
    
    console.log('[TempoList] Observateur des pièces jointes démarré');
}

// Fonction pour arrêter l'observation des pièces jointes
function stopAttachmentObserver() {
    if (attachmentObserver) {
        attachmentObserver.disconnect();
        attachmentObserver = null;
        console.log('[TempoList] Observateur des pièces jointes arrêté');
    }
    
    // Supprimer tous les badges existants
    document.querySelectorAll('.tempolist-extension-badge').forEach(badge => {
        badge.remove();
    });
}

// Écouter les messages pour activer/désactiver la fonctionnalité
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'updateAttachmentExtensions') {
        ATTACHMENT_EXTENSIONS_CONFIG = { ...ATTACHMENT_EXTENSIONS_CONFIG, ...request.config };
        
        if (ATTACHMENT_EXTENSIONS_CONFIG.enabled) {
            startAttachmentObserver();
        } else {
            stopAttachmentObserver();
        }
        
        sendResponse({ success: true });
    }
});

// Initialiser la fonctionnalité au chargement de la page
async function initializeAttachmentExtensions() {
    await loadAttachmentExtensionsConfig();
    
    // Démarrer seulement si on est sur crealiste.com
    if (window.location.hostname.includes('crealiste.com')) {
        if (ATTACHMENT_EXTENSIONS_CONFIG.enabled) {
            startAttachmentObserver();
        }
    }
}

// Lancer l'initialisation
if (checkExtensionValidity()) {
    // Attendre que le DOM soit chargé
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeAttachmentExtensions);
    } else {
        initializeAttachmentExtensions();
    }
}