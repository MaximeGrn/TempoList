// === VALIDATION AUTOMATIQUE DES LISTES ===
// Module pour valider automatiquement une liste mère et toutes ses listes options

// Configuration par défaut
let VALIDATION_AUTO_CONFIG = {
    enabled: true,
    delayBetweenActions: 1500, // Délai entre chaque action (ms)
    validationDelay: 3000, // Délai après validation d'une option (3s)
    maxRetries: 3
};

// Variable pour suivre l'état de l'automatisation
let isValidationRunning = false;
let currentValidationProcess = null;

// Clés de stockage pour maintenir l'état entre les pages
const STORAGE_KEYS = {
    VALIDATION_RUNNING: 'validationAutoRunning',
    CURRENT_STEP: 'validationCurrentStep', 
    OPTIONS_LIST: 'validationOptionsList',
    CURRENT_OPTION_INDEX: 'validationCurrentOptionIndex',
    LISTE_MERE_URL: 'validationListeMereUrl',
    OPTION_BEING_VALIDATED: 'validationOptionBeingValidated' // ID de l'option en cours de validation
};

// Charger la configuration
async function loadValidationAutoConfig() {
    try {
        const result = await chrome.storage.local.get(['validationAutoEnabled']);
        VALIDATION_AUTO_CONFIG.enabled = result.validationAutoEnabled !== false; // true par défaut
    } catch (error) {
        console.log('[ValidationAuto] Erreur lors du chargement de la configuration:', error);
    }
}

// Fonctions pour gérer l'état persistant
async function saveValidationState(state) {
    try {
        await chrome.storage.local.set(state);
        console.log('[ValidationAuto] État sauvegardé:', state);
    } catch (error) {
        console.error('[ValidationAuto] Erreur lors de la sauvegarde:', error);
    }
}

async function getValidationState() {
    try {
        const result = await chrome.storage.local.get(Object.values(STORAGE_KEYS));
        console.log('[ValidationAuto] État récupéré:', result);
        return result;
    } catch (error) {
        console.error('[ValidationAuto] Erreur lors de la récupération:', error);
        return {};
    }
}

async function clearValidationState() {
    try {
        await chrome.storage.local.remove(Object.values(STORAGE_KEYS));
        console.log('[ValidationAuto] État effacé');
    } catch (error) {
        console.error('[ValidationAuto] Erreur lors de l\'effacement:', error);
    }
}

// Fonction pour vérifier si nous sommes sur une page de liste mère
function isListeMerePage() {
    const url = window.location.href;
    // Pattern: https://crealiste.com/encodeur/listeFournitures/XXXXX
    if (!/\/encodeur\/listeFournitures\/\d+$/.test(url)) {
        return false;
    }
    
    // Vérifier qu'on n'est pas sur une page d'option (code référence avec "-O-")
    if (isOptionPage()) {
        return false; // C'est une page d'option, pas une page mère
    }
    
    // Vérifier s'il y a le conteneur de listes options sur cette page
    const listeOptionsContainer = document.querySelector('.listeOption');
    
    // Si on trouve le conteneur, c'est probablement une liste mère
    // (même s'il n'y a pas encore d'options, on peut en ajouter)
    return !!listeOptionsContainer;
}

// Fonction pour vérifier si nous sommes sur une page d'option
function isOptionPage() {
    const url = window.location.href;
    if (!/\/encodeur\/listeFournitures\/\d+$/.test(url)) {
        return false;
    }
    
    // Chercher le code référence avec "-O-" qui indique une option
    const codeRefElements = document.querySelectorAll('.lineCodeRef');
    for (const element of codeRefElements) {
        const text = element.textContent.trim();
        if (text.includes('Code référence :') && text.includes('-O-')) {
            console.log('[ValidationAuto] Page d\'option détectée via code référence:', text);
            return true;
        }
    }
    
    return false;
}

// Fonction pour extraire les informations des listes options
function getListesOptions() {
    const optionItems = document.querySelectorAll('li[id^="option-"]');
    const options = [];
    
    optionItems.forEach(item => {
        const optionId = item.id.replace('option-', '');
        const nameElement = item.querySelector('.nameOption');
        const viewLink = item.querySelector('.viewOption');
        
        if (nameElement && viewLink) {
            const name = nameElement.textContent.trim();
            
            options.push({
                id: optionId,
                name: name,
                needsValidation: name.includes('(A Valider)'),
                viewUrl: viewLink.href,
                element: item
            });
        }
    });
    
    return options;
}

// Fonction pour récupérer uniquement les options qui nécessitent une validation
function getOptionsToValidate() {
    const allOptions = getListesOptions();
    const toValidate = allOptions.filter(option => option.needsValidation);
    
    console.log('[ValidationAuto] 📋 Options trouvées:', allOptions.length);
    console.log('[ValidationAuto] 🎯 Options à valider:', toValidate.length);
    console.log('[ValidationAuto] 📝 Détail des options à valider:', toValidate.map(o => o.name));
    
    return toValidate;
}

// Fonction pour créer le bouton de validation automatique
function createValidationAutoButton() {
    console.log('[ValidationAuto] Création du bouton de validation automatique...');
    
    // Chercher le conteneur des boutons
    const btnContainer = document.querySelector('.divBtnListTeacher.divBtnListTeacher2');
    console.log('[ValidationAuto] Conteneur de boutons trouvé:', !!btnContainer);
    
    if (!btnContainer) {
        // Essayer d'autres sélecteurs possibles
        const altContainer = document.querySelector('.divBtnListTeacher');
        console.log('[ValidationAuto] Conteneur alternatif trouvé:', !!altContainer);
        
        if (!altContainer) {
            console.log('[ValidationAuto] Aucun conteneur de boutons trouvé');
            return;
        }
    }
    
    const container = btnContainer || document.querySelector('.divBtnListTeacher');
    
    // Vérifier si le bouton existe déjà
    if (document.querySelector('#btnValidationAuto')) {
        console.log('[ValidationAuto] Le bouton existe déjà');
        return;
    }
    
    // Chercher le bouton "Valider la liste"
    const btnValidation = document.querySelector('#btnValidationListe');
    console.log('[ValidationAuto] Bouton de validation trouvé:', !!btnValidation);
    
    if (!btnValidation) {
        console.log('[ValidationAuto] Bouton de validation de la liste non trouvé, impossible d\'ajouter le bouton automatique');
        return;
    }
    
    // Créer le nouveau bouton
    const newButton = document.createElement('a');
    newButton.id = 'btnValidationAuto';
    newButton.className = 'col-md-3 text-left listBtnResponsive3 btnTeacher deleteListSimilaire';
    newButton.style.marginRight = '10px';
    newButton.innerHTML = '<i class="fas fa-magic" style="margin-left: 14%;"></i>Valider Automatiquement';
    
    // Ajouter l'événement click
    newButton.addEventListener('click', handleValidationAutoClick);
    
    // Insérer le bouton avant le bouton "Valider la liste"
    container.insertBefore(newButton, btnValidation);
    console.log('[ValidationAuto] Bouton de validation automatique ajouté avec succès !');
}

// Fonction pour gérer le clic sur le bouton de validation automatique
async function handleValidationAutoClick(event) {
    event.preventDefault();
    
    console.log('[ValidationAuto] 👆 Clic sur le bouton de validation automatique détecté');
    
    // Nettoyer d'abord tout état résiduel pour être sûr
    await clearValidationState();
    
    // Vérifier s'il y a déjà une automatisation en cours
    const state = await getValidationState();
    if (state[STORAGE_KEYS.VALIDATION_RUNNING]) {
        showNotification('Une validation automatique est déjà en cours...', 'warning');
        return;
    }
    
    if (isValidationRunning) {
        showNotification('Une validation automatique est déjà en cours...', 'warning');
        return;
    }
    
    console.log('[ValidationAuto] 🚀 Démarrage de la validation automatique');
    isValidationRunning = true;
    await startValidationAutomatique();
}

// Fonction principale pour démarrer la validation automatique
async function startValidationAutomatique() {
    console.log('[ValidationAuto] 🚀 Démarrage de la validation automatique');
    showNotification('Début de la validation automatique...', 'info');
    
    try {
        // Récupérer les options qui nécessitent une validation
        const optionsToValidate = getOptionsToValidate();
        
        if (optionsToValidate.length === 0) {
            showNotification('Aucune option "(A Valider)" trouvée. Validation de la liste mère...', 'info');
            setTimeout(() => {
                validateListeMere();
            }, 1000);
            return;
        }
        
        // Sauvegarder l'état de l'automatisation
        await saveValidationState({
            [STORAGE_KEYS.VALIDATION_RUNNING]: true,
            [STORAGE_KEYS.CURRENT_STEP]: 'validating_options',
            [STORAGE_KEYS.OPTIONS_LIST]: optionsToValidate,
            [STORAGE_KEYS.CURRENT_OPTION_INDEX]: 0,
            [STORAGE_KEYS.LISTE_MERE_URL]: window.location.href,
            [STORAGE_KEYS.OPTION_BEING_VALIDATED]: null // Reset au démarrage
        });
        
        // Démarrer la validation de la première option
        await proceedToNextOption();
        
    } catch (error) {
        console.error('[ValidationAuto] Erreur lors de la validation automatique:', error);
        showNotification('Erreur lors de la validation automatique: ' + error.message, 'error');
        await clearValidationState();
    }
}

// Fonction pour continuer vers l'option suivante
async function proceedToNextOption() {
    console.log('[ValidationAuto] 🔍 Vérification des options restantes à valider...');
    
    // Vérifier dynamiquement les options qui restent à valider
    const currentOptionsToValidate = getOptionsToValidate();
    
    if (currentOptionsToValidate.length === 0) {
        // Plus d'options à valider
        console.log('[ValidationAuto] ✅ Plus d\'options "(A Valider)" trouvées, validation de la liste mère');
        showNotification('Toutes les options ont été validées. Validation de la liste mère...', 'info');
        
        await saveValidationState({
            [STORAGE_KEYS.CURRENT_STEP]: 'validating_main_list',
            [STORAGE_KEYS.OPTION_BEING_VALIDATED]: null
        });
        
        setTimeout(() => {
            validateListeMere();
        }, 1000);
        return;
    }
    
    // Prendre la première option qui nécessite une validation
    const nextOption = currentOptionsToValidate[0];
    console.log('[ValidationAuto] 🎯 Prochaine option à valider:', nextOption.name);
    showNotification(`Validation de l'option: ${nextOption.name}`, 'info');
    
    // Sauvegarder l'option en cours de validation
    await saveValidationState({
        [STORAGE_KEYS.CURRENT_OPTION_INDEX]: nextOption.id,
        [STORAGE_KEYS.OPTION_BEING_VALIDATED]: nextOption.id
    });
    
    // Naviguer vers l'option
    console.log('[ValidationAuto] 🔗 Navigation vers:', nextOption.viewUrl);
    window.location.href = nextOption.viewUrl;
}

// Fonction pour obtenir l'ID de l'option actuelle depuis l'URL
function getCurrentOptionId() {
    const url = window.location.href;
    const match = url.match(/\/listeFournitures\/(\d+)$/);
    return match ? match[1] : null;
}

// Fonction pour valider l'option courante (appelée quand on est sur une page d'option)
async function validateCurrentOption() {
    console.log('[ValidationAuto] 🔍 Tentative de validation de l\'option courante');
    
    // Vérifier qu'on est bien sur une page d'option
    if (!isOptionPage()) {
        console.log('[ValidationAuto] ❌ Pas sur une page d\'option, abandon');
        return false;
    }
    
    // Vérifier qu'une automatisation est en cours
    const state = await getValidationState();
    if (!state[STORAGE_KEYS.VALIDATION_RUNNING]) {
        console.log('[ValidationAuto] ❌ Aucune automatisation en cours, abandon');
        return false;
    }
    
    // Obtenir l'ID de l'option actuelle
    const currentOptionId = getCurrentOptionId();
    const optionBeingValidated = state[STORAGE_KEYS.OPTION_BEING_VALIDATED];
    
    console.log('[ValidationAuto] 📍 Option actuelle ID:', currentOptionId);
    console.log('[ValidationAuto] 🎯 Option à valider ID:', optionBeingValidated);
    
    // Vérifier si c'est bien l'option qu'on doit valider
    if (!currentOptionId || currentOptionId !== optionBeingValidated) {
        console.log('[ValidationAuto] ❌ Cette option ne correspond pas à celle à valider, retour à la liste mère...');
        
        // Retourner directement à la liste mère
        const listeMereUrl = state[STORAGE_KEYS.LISTE_MERE_URL];
        if (listeMereUrl) {
            console.log('[ValidationAuto] 🔄 Retour à la liste mère:', listeMereUrl);
            window.location.href = listeMereUrl;
        }
        return false;
    }
    
    // Chercher le bouton de validation
    const btnValidation = document.querySelector('#btnValidationListe');
    if (!btnValidation) {
        console.log('[ValidationAuto] ❌ Bouton de validation non trouvé');
        return false;
    }
    
    console.log('[ValidationAuto] ✅ Bouton de validation trouvé, clic en cours...');
    console.log('[ValidationAuto] Bouton validation - texte:', btnValidation.textContent.trim());
    console.log('[ValidationAuto] Bouton validation - visible:', btnValidation.offsetParent !== null);
    
    // Marquer que cette option a été validée (pour éviter de la revalider)
    await saveValidationState({
        [STORAGE_KEYS.OPTION_BEING_VALIDATED]: 'validated_' + currentOptionId
    });
    
    // Utiliser la fonction de clic robuste
    const clickSuccess = simulateRobustClick(btnValidation);
    console.log('[ValidationAuto] Résultat du clic:', clickSuccess ? '✅ SUCCÈS' : '❌ ÉCHEC');
    
    if (clickSuccess) {
        console.log('[ValidationAuto] ⏱️ Attente de 2 secondes après validation...');
        showNotification('Option validée, retour à la liste mère dans 2 secondes...', 'info');
        
        // Attendre 2 secondes puis retourner à la liste mère
        setTimeout(async () => {
            const listeMereUrl = state[STORAGE_KEYS.LISTE_MERE_URL];
            console.log('[ValidationAuto] 🔄 Retour à la liste mère:', listeMereUrl);
            window.location.href = listeMereUrl;
        }, 2000); // 2 secondes au lieu de 3
        
        return true;
    }
    
    return false;
}



// Fonction pour valider la liste mère
async function validateListeMere() {
    console.log('[ValidationAuto] 🎯 Validation de la liste mère...');
    const btnValidation = document.querySelector('#btnValidationListe');
    console.log('[ValidationAuto] Bouton de validation de la liste mère trouvé:', !!btnValidation);
    
    if (btnValidation) {
        console.log('[ValidationAuto] Clic sur le bouton de validation de la liste mère');
        const clickSuccess = simulateRobustClick(btnValidation);
        
        if (clickSuccess) {
            showNotification('🎉 Validation automatique terminée avec succès !', 'success');
            console.log('[ValidationAuto] ✅ Validation automatique terminée !');
        } else {
            showNotification('Erreur lors du clic sur le bouton de validation', 'error');
            console.error('[ValidationAuto] ❌ Échec du clic sur le bouton de validation');
        }
    } else {
        console.error('[ValidationAuto] ❌ Bouton de validation de la liste mère non trouvé');
        showNotification('Erreur: Bouton de validation de la liste mère non trouvé', 'error');
    }
    
    // Nettoyer complètement l'état de l'automatisation
    await clearValidationState();
    isValidationRunning = false;
    
    console.log('[ValidationAuto] 🧹 État de l\'automatisation complètement nettoyé');
}

// Fonction utilitaire pour attendre
function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Fonction pour simuler un clic robuste
function simulateRobustClick(element) {
    console.log('[ValidationAuto] 🎯 Simulation de clic robuste sur:', element);
    
    try {
        // Méthode 1: Focus + Click
        if (element.focus) {
            element.focus();
            console.log('[ValidationAuto] ✅ Focus appliqué');
        }
        
        // Méthode 2: Click simple
        element.click();
        console.log('[ValidationAuto] ✅ Click() exécuté');
        
        // Méthode 3: MouseDown + MouseUp
        const mouseDownEvent = new MouseEvent('mousedown', {
            view: window,
            bubbles: true,
            cancelable: true,
            clientX: element.getBoundingClientRect().left + element.offsetWidth / 2,
            clientY: element.getBoundingClientRect().top + element.offsetHeight / 2
        });
        
        const mouseUpEvent = new MouseEvent('mouseup', {
            view: window,
            bubbles: true,
            cancelable: true,
            clientX: element.getBoundingClientRect().left + element.offsetWidth / 2,
            clientY: element.getBoundingClientRect().top + element.offsetHeight / 2
        });
        
        const clickEvent = new MouseEvent('click', {
            view: window,
            bubbles: true,
            cancelable: true,
            clientX: element.getBoundingClientRect().left + element.offsetWidth / 2,
            clientY: element.getBoundingClientRect().top + element.offsetHeight / 2
        });
        
        element.dispatchEvent(mouseDownEvent);
        element.dispatchEvent(mouseUpEvent);
        element.dispatchEvent(clickEvent);
        console.log('[ValidationAuto] ✅ Événements mousedown/mouseup/click dispatchés');
        
        // Méthode 4: Trigger change si c'est un input
        if (element.tagName === 'INPUT') {
            const changeEvent = new Event('change', { bubbles: true });
            element.dispatchEvent(changeEvent);
            console.log('[ValidationAuto] ✅ Événement change dispatché');
        }
        
        return true;
        
    } catch (error) {
        console.error('[ValidationAuto] ❌ Erreur lors de la simulation de clic:', error);
        return false;
    }
}

// Fonction pour afficher des notifications
function showNotification(message, type = 'info') {
    // Créer une notification simple
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px;
        border-radius: 5px;
        color: white;
        font-weight: bold;
        z-index: 10000;
        max-width: 300px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    `;
    
    // Couleurs selon le type
    switch (type) {
        case 'success':
            notification.style.backgroundColor = '#4CAF50';
            break;
        case 'warning':
            notification.style.backgroundColor = '#FF9800';
            break;
        case 'error':
            notification.style.backgroundColor = '#F44336';
            break;
        default:
            notification.style.backgroundColor = '#2196F3';
    }
    
    notification.textContent = message;
    document.body.appendChild(notification);
    
    // Supprimer après 4 secondes
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 4000);
    
    console.log(`[ValidationAuto] ${type.toUpperCase()}: ${message}`);
}

// Fonction pour vérifier si l'automatisation en cours est valide
async function isAutomationValid() {
    const state = await getValidationState();
    const isRunning = state[STORAGE_KEYS.VALIDATION_RUNNING];
    
    if (!isRunning) {
        return false;
    }
    
    // Vérifier si l'URL de la liste mère correspond à la page actuelle
    const listeMereUrl = state[STORAGE_KEYS.LISTE_MERE_URL];
    const currentStep = state[STORAGE_KEYS.CURRENT_STEP];
    
    // Si on est sur une liste mère différente de celle sauvegardée, l'automatisation n'est plus valide
    if (isListeMerePage() && listeMereUrl && !window.location.href.includes(listeMereUrl)) {
        console.log('[ValidationAuto] ❌ Automatisation obsolète détectée (liste mère différente)');
        await clearValidationState();
        return false;
    }
    
    return true;
}

// Fonction pour continuer l'automatisation si elle est en cours
async function continueAutomationIfRunning() {
    const isValid = await isAutomationValid();
    
    if (!isValid) {
        console.log('[ValidationAuto] 🔍 Aucune automatisation valide en cours');
        return false;
    }
    
    const state = await getValidationState();
    console.log('[ValidationAuto] 🔄 Automatisation valide détectée, continuité...');
    const currentStep = state[STORAGE_KEYS.CURRENT_STEP];
    
    if (currentStep === 'validating_options') {
        if (isOptionPage()) {
            // Vérifier si cette option a déjà été validée
            const currentOptionId = getCurrentOptionId();
            const optionBeingValidated = state[STORAGE_KEYS.OPTION_BEING_VALIDATED];
            
            console.log('[ValidationAuto] 📍 Sur une page d\'option');
            console.log('[ValidationAuto] 🔍 Option actuelle:', currentOptionId);
            console.log('[ValidationAuto] 🎯 Option en cours:', optionBeingValidated);
            
            // Si l'option a déjà été validée (prefixe "validated_"), retourner à la liste mère
            if (optionBeingValidated && optionBeingValidated.startsWith('validated_')) {
                const validatedOptionId = optionBeingValidated.replace('validated_', '');
                if (currentOptionId === validatedOptionId) {
                    console.log('[ValidationAuto] ✅ Option déjà validée, retour direct à la liste mère...');
                    const listeMereUrl = state[STORAGE_KEYS.LISTE_MERE_URL];
                    if (listeMereUrl) {
                        setTimeout(() => {
                            window.location.href = listeMereUrl;
                        }, 1000);
                    }
                    return true;
                }
            }
            
            // Sinon, valider l'option
            console.log('[ValidationAuto] 🔧 Validation de l\'option...');
            setTimeout(() => {
                validateCurrentOption();
            }, 2000); // Attendre que la page soit complètement chargée
            return true;
        } else if (isListeMerePage()) {
            // On est sur la liste mère, continuer vers l'option suivante
            console.log('[ValidationAuto] 📍 Sur la liste mère, passage à l\'option suivante...');
            setTimeout(() => {
                proceedToNextOption();
            }, 1500);
            return true;
        }
    } else if (currentStep === 'validating_main_list') {
        if (isListeMerePage()) {
            // On est sur la liste mère, la valider
            console.log('[ValidationAuto] 📍 Sur la liste mère, validation finale...');
            setTimeout(() => {
                validateListeMere();
            }, 2000);
            return true;
        }
    }
    
    return false;
}

// Fonction pour nettoyer l'état si on arrive sur une nouvelle liste mère
async function cleanStateIfNewListeMere() {
    const state = await getValidationState();
    const savedListeMereUrl = state[STORAGE_KEYS.LISTE_MERE_URL];
    const currentUrl = window.location.href;
    
    // Si on est sur une liste mère et qu'elle est différente de celle sauvegardée
    if (isListeMerePage() && savedListeMereUrl && savedListeMereUrl !== currentUrl) {
        console.log('[ValidationAuto] 🧹 Nouvelle liste mère détectée, nettoyage de l\'ancien état');
        console.log('[ValidationAuto] Ancienne URL:', savedListeMereUrl);
        console.log('[ValidationAuto] Nouvelle URL:', currentUrl);
        await clearValidationState();
    }
}

// Fonction d'initialisation du module
async function initValidationAuto() {
    console.log('[ValidationAuto] 🚀 Initialisation du module...');
    console.log('[ValidationAuto] URL actuelle:', window.location.href);
    
    // Charger la configuration
    await loadValidationAutoConfig();
    
    // Nettoyer l'état si on arrive sur une nouvelle liste mère
    await cleanStateIfNewListeMere();
    
    // D'abord, ajouter le bouton si nous sommes sur une page de liste mère
    const isListeMere = isListeMerePage();
    console.log('[ValidationAuto] Page de liste mère détectée:', isListeMere);
    
    if (isListeMere) {
        console.log('[ValidationAuto] Tentative d\'ajout du bouton...');
        // Attendre un peu que la page soit complètement chargée
        setTimeout(() => {
            createValidationAutoButton();
        }, 1000);
        
        // Essayer plusieurs fois si le bouton n'apparaît pas
        let retryCount = 0;
        const maxRetries = 5;
        const retryInterval = setInterval(() => {
            if (document.querySelector('#btnValidationAuto') || retryCount >= maxRetries) {
                clearInterval(retryInterval);
                if (retryCount >= maxRetries) {
                    console.log('[ValidationAuto] Échec après', maxRetries, 'tentatives');
                }
                return;
            }
            retryCount++;
            console.log('[ValidationAuto] Nouvelle tentative d\'ajout du bouton (', retryCount, '/', maxRetries, ')');
            createValidationAutoButton();
        }, 2000);
    }
    
    // ENSUITE seulement, vérifier si une automatisation était en cours (après nettoyage)
    setTimeout(async () => {
        const automationContinued = await continueAutomationIfRunning();
        if (automationContinued) {
            console.log('[ValidationAuto] 🔄 Automatisation en cours détectée et reprise');
        } else {
            console.log('[ValidationAuto] ✅ Aucune automatisation en cours, prêt pour utilisation manuelle');
        }
    }, 3000); // Attendre 3 secondes pour être sûr que l'initialisation est terminée
}

// Observer les changements de page pour réinitialiser le module si nécessaire
let lastUrlValidation = location.href;
new MutationObserver(() => {
    const currentUrl = location.href;
    if (currentUrl !== lastUrlValidation) {
        lastUrlValidation = currentUrl;
        console.log('[ValidationAuto] 🔄 Changement de page détecté:', currentUrl);
        
        // Nouvelle page détectée, nettoyer d'abord puis vérifier automatisation
        setTimeout(async () => {
            // Nettoyer l'état si on arrive sur une nouvelle liste mère
            await cleanStateIfNewListeMere();
            
            // Vérifier si une automatisation est en cours
            const automationContinued = await continueAutomationIfRunning();
            
            // Ajouter le bouton si on est sur une liste mère ET qu'aucune automatisation n'est en cours
            if (!automationContinued && isListeMerePage() && !document.querySelector('#btnValidationAuto')) {
                createValidationAutoButton();
            }
        }, 1500);
    }
}).observe(document, { subtree: true, childList: true });

// Initialiser le module quand le DOM est prêt
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        initValidationAuto();
    });
} else {
    initValidationAuto();
}

// Aussi initialiser après que tout soit chargé
window.addEventListener('load', () => {
    setTimeout(async () => {
        console.log('[ValidationAuto] 🔄 Initialisation après chargement complet de la page');
        
        // Nettoyer l'état si on arrive sur une nouvelle liste mère
        await cleanStateIfNewListeMere();
        
        // Vérifier si une automatisation est en cours
        const automationContinued = await continueAutomationIfRunning();
        
        // Ajouter le bouton si nécessaire et si aucune automatisation n'est en cours
        if (!automationContinued && isListeMerePage() && !document.querySelector('#btnValidationAuto')) {
            createValidationAutoButton();
        }
    }, 2000);
});

// Fonction de débogage pour analyser la page
function debugPageStructure() {
    console.log('[ValidationAuto] === ANALYSE DE LA PAGE ===');
    console.log('[ValidationAuto] URL:', window.location.href);
    console.log('[ValidationAuto] Pattern URL match:', /\/encodeur\/listeFournitures\/\d+$/.test(window.location.href));
    
    // Vérifier les codes références
    const codeRefElements = document.querySelectorAll('.lineCodeRef');
    console.log('[ValidationAuto] Éléments code référence trouvés:', codeRefElements.length);
    codeRefElements.forEach((element, index) => {
        const text = element.textContent.trim();
        console.log('[ValidationAuto] Code ref', index + 1, ':', text);
        if (text.includes('Code référence :')) {
            console.log('[ValidationAuto] -> Contient "-O-":', text.includes('-O-'));
        }
    });
    
    console.log('[ValidationAuto] Est une page d\'option:', isOptionPage());
    console.log('[ValidationAuto] Est une page de liste mère:', isListeMerePage());
    
    const listeOptionsContainer = document.querySelector('.listeOption');
    console.log('[ValidationAuto] Container .listeOption:', !!listeOptionsContainer);
    
    const btnContainer1 = document.querySelector('.divBtnListTeacher.divBtnListTeacher2');
    console.log('[ValidationAuto] Container boutons (.divBtnListTeacher.divBtnListTeacher2):', !!btnContainer1);
    
    const btnContainer2 = document.querySelector('.divBtnListTeacher');
    console.log('[ValidationAuto] Container boutons alternatif (.divBtnListTeacher):', !!btnContainer2);
    
    const btnValidation = document.querySelector('#btnValidationListe');
    console.log('[ValidationAuto] Bouton validation (#btnValidationListe):', !!btnValidation);
    
    const optionItems = document.querySelectorAll('li[id^="option-"]');
    console.log('[ValidationAuto] Options trouvées:', optionItems.length);
    
    if (isListeMerePage()) {
        const allOptions = getListesOptions();
        const optionsToValidate = getOptionsToValidate();
        console.log('[ValidationAuto] Options détaillées:', allOptions);
        console.log('[ValidationAuto] Options à valider:', optionsToValidate);
    }
    
    console.log('[ValidationAuto] === FIN ANALYSE ===');
}

console.log('[ValidationAuto] Module de validation automatique chargé');

// Fonction de débogage accessible depuis la console
window.debugValidationAuto = debugPageStructure; 