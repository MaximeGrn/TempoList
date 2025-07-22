// === VALIDATION AUTOMATIQUE DES LISTES ===
// Module pour valider automatiquement une liste mère et toutes ses listes options

// Configuration par défaut
let VALIDATION_AUTO_CONFIG = {
    enabled: true, // Sera chargé depuis chrome.storage.local
    delayBetweenActions: 1000, // Délai entre chaque action (ms)
    validationDelay: 2000, // Délai après validation d'une option (2s)
    maxRetries: 3
};

// Variable pour suivre l'état de l'automatisation
let isValidationRunning = false;
let currentValidationProcess = null;
let progressPanel = null;
let isMainListValidationScheduled = false; // Protection contre les validations multiples de la liste mère

// Clés de stockage pour maintenir l'état entre les pages
const STORAGE_KEYS = {
    VALIDATION_RUNNING: 'validationAutoRunning',
    CURRENT_STEP: 'validationCurrentStep', 
    OPTIONS_LIST: 'validationOptionsList',
    CURRENT_OPTION_INDEX: 'validationCurrentOptionIndex',
    LISTE_MERE_URL: 'validationListeMereUrl',
    OPTION_BEING_VALIDATED: 'validationOptionBeingValidated', // ID de l'option en cours de validation
    VALIDATED_OPTIONS: 'validationValidatedOptions' // Liste des options déjà validées
};

// Charger la configuration
async function loadValidationAutoConfig() {
    try {
        const result = await chrome.storage.local.get(['automaticValidationEnabled']);
        VALIDATION_AUTO_CONFIG.enabled = result.automaticValidationEnabled !== false; // true par défaut
        console.log('[ValidationAuto] Configuration chargée - enabled:', VALIDATION_AUTO_CONFIG.enabled);
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

// Fonction pour vérifier s'il y a des options rattachées à la liste mère
function hasAttachedOptions() {
    const optionsContainer = document.querySelector('.listeAGarder');
    const optionItems = document.querySelectorAll('li[id^="option-"]');
    
    return optionsContainer && optionItems.length > 0;
}

// Fonction pour vérifier l'état de complétion des matières
async function checkSubjectCompletionStatus() {
    try {
        // Vérifier si l'option de complétion des matières est activée
        const result = await chrome.storage.local.get(['subjectCompletionEnabled']);
        const isCompletionEnabled = result.subjectCompletionEnabled !== false;
        
        if (!isCompletionEnabled) {
            // Si l'option n'est pas activée, pas de vérification nécessaire
            console.log('[ValidationAuto] Option de complétion des matières désactivée, pas de vérification');
            return { enabled: false, isValid: true };
        }
        
        // Chercher l'étiquette de complétion
        const completionBadge = document.querySelector('.tempolist-completion-badge');
        
        if (!completionBadge) {
            // Pas d'étiquette trouvée, peut-être que le calcul n'est pas encore fait
            console.log('[ValidationAuto] Aucune étiquette de complétion trouvée');
            return { enabled: true, isValid: true }; // On autorise par défaut
        }
        
        // Vérifier la couleur de fond pour déterminer si c'est valide
        const backgroundColor = window.getComputedStyle(completionBadge).backgroundColor;
        
        // Convertir les couleurs RGB en format lisible
        const isGreen = backgroundColor.includes('40, 167, 69') || backgroundColor.includes('#28a745'); // Vert
        const isRed = backgroundColor.includes('220, 53, 69') || backgroundColor.includes('#dc3545'); // Rouge
        
        console.log('[ValidationAuto] Couleur de l\'étiquette de complétion:', backgroundColor);
        console.log('[ValidationAuto] Complétion valide (verte):', isGreen);
        console.log('[ValidationAuto] Complétion en erreur (rouge):', isRed);
        
        return {
            enabled: true,
            isValid: isGreen || !isRed, // Valide si vert ou pas rouge
            badgeText: completionBadge.textContent.trim()
        };
        
    } catch (error) {
        console.error('[ValidationAuto] Erreur lors de la vérification de complétion:', error);
        return { enabled: false, isValid: true }; // En cas d'erreur, autoriser par défaut
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
async function createValidationAutoButton() {
    console.log('[ValidationAuto] Création du bouton de validation automatique...');
    
    // Vérifier si la fonctionnalité est activée
    if (!VALIDATION_AUTO_CONFIG.enabled) {
        console.log('[ValidationAuto] Fonctionnalité désactivée dans les paramètres, pas d\'ajout de bouton');
        return;
    }
    
    // Vérifier s'il y a des options rattachées à la liste mère
    if (!hasAttachedOptions()) {
        console.log('[ValidationAuto] Aucune option rattachée trouvée, pas d\'ajout de bouton');
        return;
    }
    
    // Vérifier l'état de complétion des matières
    const completionStatus = await checkSubjectCompletionStatus();
    console.log('[ValidationAuto] État de complétion:', completionStatus);
    
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
    
    // Créer un conteneur pour le bouton en dessous
    const bottomContainer = document.createElement('div');
    bottomContainer.style.cssText = `
        width: 100%;
        display: flex;
        justify-content: center;
        margin-top: 25px;
        padding-top: 10px;
    `;
    
    // Créer le nouveau bouton avec le nouveau design
    const newButton = document.createElement('a');
    newButton.id = 'btnValidationAuto';
    newButton.className = 'text-center listBtnResponsive3 btnTeacher deleteListSimilaire';
    
    // Déterminer si le bouton doit être désactivé
    const isDisabled = completionStatus.enabled && !completionStatus.isValid;
    
    newButton.style.cssText = `
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        height: 80px;
        padding: 10px 30px;
        text-decoration: none;
        cursor: ${isDisabled ? 'not-allowed' : 'pointer'};
        min-width: 280px;
        opacity: ${isDisabled ? '0.5' : '1'};
        filter: ${isDisabled ? 'grayscale(1)' : 'none'};
    `;
    
    // Utiliser le SVG Bootstrap Icons cart-check
    newButton.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" class="bi bi-cart-check" viewBox="0 0 16 16" style="margin-bottom: 5px;">
            <path d="M11.354 6.354a.5.5 0 0 0-.708-.708L8 8.293 6.854 7.146a.5.5 0 1 0-.708.708l1.5 1.5a.5.5 0 0 0 .708 0z"/>
            <path d="M.5 1a.5.5 0 0 0 0 1h1.11l.401 1.607 1.498 7.985A.5.5 0 0 0 4 12h1a2 2 0 1 0 0 4 2 2 0 0 0 0-4h7a2 2 0 1 0 0 4 2 2 0 0 0 0-4h1a.5.5 0 0 0 .491-.408l1.5-8A.5.5 0 0 0 14.5 3H2.89l-.405-1.621A.5.5 0 0 0 2 1zm3.915 10L3.102 4h10.796l-1.313 7zM6 14a1 1 0 1 1-2 0 1 1 0 0 1 2 0m7 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0"/>
        </svg>
        <span style="font-size: 14px; line-height: 1.2;">Valider Automatiquement</span>
    `;
    
    // Ajouter l'événement click ou un message d'erreur
    if (isDisabled) {
        newButton.title = `Validation automatique bloquée : Taux de remplissage des matières insuffisant (${completionStatus.badgeText || 'Erreur'})`;
        newButton.addEventListener('click', (e) => {
            e.preventDefault();
            showNotification('⚠️ Validation automatique bloquée : Taux de remplissage des matières insuffisant', 'warning');
        });
        console.log('[ValidationAuto] Bouton désactivé à cause de la complétion insuffisante');
    } else {
        newButton.addEventListener('click', handleValidationAutoClick);
        console.log('[ValidationAuto] Bouton activé - complétion OK ou vérification désactivée');
    }
    
    // Ajouter le bouton au conteneur inférieur
    bottomContainer.appendChild(newButton);
    
    // Insérer le conteneur après le conteneur principal
    container.parentNode.insertBefore(bottomContainer, container.nextSibling);
    console.log('[ValidationAuto] Bouton de validation automatique ajouté avec succès en dessous !');
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
        
        // Créer le panneau de progression
        createProgressPanel(optionsToValidate);
        
        // Sauvegarder l'état de l'automatisation
        await saveValidationState({
            [STORAGE_KEYS.VALIDATION_RUNNING]: true,
            [STORAGE_KEYS.CURRENT_STEP]: 'validating_options',
            [STORAGE_KEYS.OPTIONS_LIST]: optionsToValidate,
            [STORAGE_KEYS.CURRENT_OPTION_INDEX]: 0,
            [STORAGE_KEYS.LISTE_MERE_URL]: window.location.href,
            [STORAGE_KEYS.OPTION_BEING_VALIDATED]: null, // Reset au démarrage
            [STORAGE_KEYS.VALIDATED_OPTIONS]: [] // Reset de la liste des options validées
        });
        
        // Démarrer la validation de la première option
        await proceedToNextOption();
        
    } catch (error) {
        console.error('[ValidationAuto] Erreur lors de la validation automatique:', error);
        showNotification('Erreur lors de la validation automatique: ' + error.message, 'error');
        await clearValidationState();
        removeProgressPanel();
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
        
        // Vérifier si la validation de la liste mère n'est pas déjà programmée
        if (isMainListValidationScheduled) {
            console.log('[ValidationAuto] ⚠️ Validation de la liste mère déjà programmée, abandon');
            return;
        }
        
        isMainListValidationScheduled = true;
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
    
    // S'assurer que le panneau existe et mettre à jour
    if (!progressPanel) {
        const state = await getValidationState();
        const optionsList = state[STORAGE_KEYS.OPTIONS_LIST] || [];
        if (optionsList.length > 0) {
            await createProgressPanel(optionsList);
        }
    }
    
    // Mettre à jour le panneau de progression
    updateProgressPanel(nextOption.id, 'validating');
    
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
        
        // Mettre à jour le panneau de progression
        updateProgressPanel(currentOptionId, 'completed');
        
        // Ajouter cette option à la liste des options validées
        const validatedOptions = state[STORAGE_KEYS.VALIDATED_OPTIONS] || [];
        if (!validatedOptions.includes(currentOptionId)) {
            validatedOptions.push(currentOptionId);
            await saveValidationState({
                [STORAGE_KEYS.VALIDATED_OPTIONS]: validatedOptions,
                [STORAGE_KEYS.OPTION_BEING_VALIDATED]: null // Reset après validation
            });
        }
        
        // Attendre 2 secondes puis retourner à la liste mère
        setTimeout(async () => {
            const listeMereUrl = state[STORAGE_KEYS.LISTE_MERE_URL];
            console.log('[ValidationAuto] 🔄 Retour à la liste mère:', listeMereUrl);
            window.location.href = listeMereUrl;
        }, 1500); // 2 secondes au lieu de 3
        
        return true;
    } else {
        // Mettre à jour le panneau de progression avec erreur
        updateProgressPanel(currentOptionId, 'error');
    }
    
    return false;
}



// Fonction pour valider la liste mère
async function validateListeMere() {
    console.log('[ValidationAuto] 🎯 Validation de la liste mère...');
    
    // Mettre à jour le statut de la liste principale
    updateMainListProgress('validating');
    
    const btnValidation = document.querySelector('#btnValidationListe');
    console.log('[ValidationAuto] Bouton de validation de la liste mère trouvé:', !!btnValidation);
    
    if (btnValidation) {
        console.log('[ValidationAuto] Clic sur le bouton de validation de la liste mère');
        const clickSuccess = simulateRobustClick(btnValidation);
        
        if (clickSuccess) {
            updateMainListProgress('completed');
            showNotification('🎉 Validation automatique terminée avec succès !', 'success');
            console.log('[ValidationAuto] ✅ Validation automatique terminée !');
        } else {
            updateMainListProgress('error');
            showNotification('Erreur lors du clic sur le bouton de validation', 'error');
            console.error('[ValidationAuto] ❌ Échec du clic sur le bouton de validation');
        }
    } else {
        updateMainListProgress('error');
        console.error('[ValidationAuto] ❌ Bouton de validation de la liste mère non trouvé');
        showNotification('Erreur: Bouton de validation de la liste mère non trouvé', 'error');
    }
    
    // Nettoyer complètement l'état de l'automatisation
    await clearValidationState();
    isValidationRunning = false;
    isMainListValidationScheduled = false; // Réinitialiser le flag de protection
    
    // Supprimer le panneau de progression
    setTimeout(() => {
        removeProgressPanel();
    }, 2000); // Laisser 2 secondes pour voir le succès
    
    console.log('[ValidationAuto] 🧹 État de l\'automatisation complètement nettoyé');
}

// Fonction utilitaire pour attendre
function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Fonction pour simuler un clic simple (un seul clic, pas de spam)
function simulateRobustClick(element) {
    console.log('[ValidationAuto] 🎯 Clic simple sur:', element);
    
    try {
        // Focus optionnel pour s'assurer que l'élément est prêt
        if (element.focus) {
            element.focus();
            console.log('[ValidationAuto] ✅ Focus appliqué');
        }
        
        // UN SEUL clic simple - pas de multiple events
        element.click();
        console.log('[ValidationAuto] ✅ Click() unique exécuté');
        
        return true;
        
    } catch (error) {
        console.error('[ValidationAuto] ❌ Erreur lors du clic:', error);
        return false;
    }
}

// Fonction pour créer l'encart de progression de façon persistante
async function createProgressPanel(optionsToValidate) {
    // Supprimer l'ancien panneau s'il existe
    removeProgressPanel();
    
    progressPanel = document.createElement('div');
    progressPanel.id = 'validationProgressPanel';
    progressPanel.style.cssText = `
        position: fixed;
        top: 20px;
        left: 20px;
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 20px;
        border-radius: 10px;
        font-family: Arial, sans-serif;
        z-index: 10001;
        min-width: 450px;
        max-width: 500px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    `;
    
    const title = document.createElement('div');
    title.style.cssText = `
        font-size: 16px;
        font-weight: bold;
        margin-bottom: 15px;
        display: flex;
        align-items: center;
        justify-content: space-between;
    `;
    title.innerHTML = `
        <span>🔄 Validation automatique</span>
        <span style="font-size: 12px; opacity: 0.7;">Échap pour arrêter</span>
    `;
    
    const optionsList = document.createElement('div');
    optionsList.id = 'validationOptionsList';
    
    // Ajouter la liste principale en premier
    const mainListItem = document.createElement('div');
    mainListItem.id = 'progress-main-list';
    mainListItem.style.cssText = `
        display: flex;
        align-items: center;
        padding: 8px 0;
        border-bottom: 2px solid rgba(255, 255, 255, 0.4);
        margin-bottom: 10px;
        font-weight: bold;
    `;
    
    mainListItem.innerHTML = `
        <span id="check-main-list" style="margin-right: 10px; font-size: 16px;">⏳</span>
        <span style="flex-grow: 1; font-size: 14px;">Liste principale</span>
    `;
    
    optionsList.appendChild(mainListItem);
    
    // Récupérer la liste des options déjà validées
    const state = await getValidationState();
    const validatedOptions = state[STORAGE_KEYS.VALIDATED_OPTIONS] || [];
    const currentOptionBeingValidated = state[STORAGE_KEYS.OPTION_BEING_VALIDATED];
    
    // Créer la liste des options
    optionsToValidate.forEach((option, index) => {
        const optionItem = document.createElement('div');
        optionItem.id = `progress-option-${option.id}`;
        optionItem.style.cssText = `
            display: flex;
            align-items: center;
            padding: 8px 0;
            border-bottom: 1px solid rgba(255, 255, 255, 0.2);
            margin-left: 20px;
        `;
        
        // Déterminer l'état initial de l'option
        let initialStatus = '⏳';
        if (validatedOptions.includes(option.id)) {
            initialStatus = '✅';
        } else if (currentOptionBeingValidated === option.id) {
            initialStatus = '🔄';
        }
        
        optionItem.innerHTML = `
            <span id="check-${option.id}" style="margin-right: 10px; font-size: 16px;">${initialStatus}</span>
            <span style="flex-grow: 1; font-size: 14px;">${option.name}</span>
        `;
        
        optionsList.appendChild(optionItem);
    });
    
    progressPanel.appendChild(title);
    progressPanel.appendChild(optionsList);
    document.body.appendChild(progressPanel);
    
    console.log('[ValidationAuto] Panneau de progression créé avec', optionsToValidate.length, 'options');
    console.log('[ValidationAuto] Options déjà validées:', validatedOptions);
}

// Fonction pour mettre à jour le statut d'une option dans le panneau
function updateProgressPanel(optionId, status) {
    if (!progressPanel) return;
    
    const checkElement = document.getElementById(`check-${optionId}`);
    if (checkElement) {
        switch (status) {
            case 'validating':
                checkElement.textContent = '🔄';
                checkElement.style.color = '#2196F3';
                break;
            case 'completed':
                checkElement.textContent = '✅';
                checkElement.style.color = '#4CAF50';
                break;
            case 'error':
                checkElement.textContent = '❌';
                checkElement.style.color = '#F44336';
                break;
        }
    }
}

// Fonction pour mettre à jour le statut de la liste principale
function updateMainListProgress(status) {
    if (!progressPanel) return;
    
    const checkElement = document.getElementById('check-main-list');
    if (checkElement) {
        switch (status) {
            case 'validating':
                checkElement.textContent = '🔄';
                checkElement.style.color = '#2196F3';
                break;
            case 'completed':
                checkElement.textContent = '✅';
                checkElement.style.color = '#4CAF50';
                break;
            case 'error':
                checkElement.textContent = '❌';
                checkElement.style.color = '#F44336';
                break;
        }
    }
}

// Fonction pour supprimer l'encart de progression
function removeProgressPanel() {
    if (progressPanel && progressPanel.parentNode) {
        progressPanel.parentNode.removeChild(progressPanel);
        progressPanel = null;
        console.log('[ValidationAuto] Panneau de progression supprimé');
    }
}

// Fonction pour gérer la touche Échap (spécifique à la validation automatique)
async function handleValidationEscapeKey(event) {
    if (event.key === 'Escape' || event.keyCode === 27) { // Support macOS et Windows
        try {
            const state = await getValidationState();
            // Vérifier si une validation est en cours
            if (isValidationRunning || (state && state[STORAGE_KEYS.VALIDATION_RUNNING])) {
                console.log('[ValidationAuto] 🛑 Arrêt de la validation automatique demandé par l\'utilisateur (Échap)');
                await stopValidationAutomatique();
                event.preventDefault();
                event.stopPropagation();
            }
        } catch (error) {
            console.error('[ValidationAuto] Erreur lors de la gestion de la touche Échap:', error);
        }
    }
}

// Fonction pour arrêter la validation automatique
async function stopValidationAutomatique() {
    console.log('[ValidationAuto] 🛑 Arrêt de la validation automatique...');
    
    // Nettoyer l'état
    await clearValidationState();
    isValidationRunning = false;
    isMainListValidationScheduled = false; // Réinitialiser le flag de protection
    
    // Supprimer le panneau de progression
    removeProgressPanel();
    
    // Afficher une notification
    showNotification('🛑 Validation automatique arrêtée par l\'utilisateur', 'warning');
    
    console.log('[ValidationAuto] ✅ Validation automatique arrêtée');
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
    
    // Recréer le panneau de progression si nécessaire
    if (currentStep === 'validating_options' && !progressPanel) {
        const optionsList = state[STORAGE_KEYS.OPTIONS_LIST] || [];
        if (optionsList.length > 0) {
            await createProgressPanel(optionsList);
        }
    } else if (currentStep === 'validating_main_list' && !progressPanel) {
        // Aussi recréer le panneau lors de la validation de la liste principale
        const optionsList = state[STORAGE_KEYS.OPTIONS_LIST] || [];
        if (optionsList.length > 0) {
            await createProgressPanel(optionsList);
            updateMainListProgress('validating');
        }
    }
    
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
            
            // Vérifier si la validation de la liste mère n'est pas déjà programmée
            if (isMainListValidationScheduled) {
                console.log('[ValidationAuto] ⚠️ Validation de la liste mère déjà programmée, abandon');
                return true;
            }
            
            isMainListValidationScheduled = true;
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
        isMainListValidationScheduled = false; // Réinitialiser le flag pour la nouvelle liste mère
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
    
    // Vérifier immédiatement si une automatisation est en cours pour recréer le panneau rapidement
    const state = await getValidationState();
    if (state[STORAGE_KEYS.VALIDATION_RUNNING]) {
        console.log('[ValidationAuto] ⚡ Automatisation en cours détectée, création immédiate du panneau');
        const optionsList = state[STORAGE_KEYS.OPTIONS_LIST] || [];
        if (optionsList.length > 0) {
            await createProgressPanel(optionsList);
        }
    }
    
    // D'abord, ajouter le bouton si nous sommes sur une page de liste mère
    const isListeMere = isListeMerePage();
    console.log('[ValidationAuto] Page de liste mère détectée:', isListeMere);
    
    if (isListeMere) {
        console.log('[ValidationAuto] Tentative d\'ajout du bouton...');
        // Attendre un peu que la page soit complètement chargée
        setTimeout(async () => {
            await createValidationAutoButton();
        }, 1000);
        
        // Essayer plusieurs fois si le bouton n'apparaît pas
        let retryCount = 0;
        const maxRetries = 5;
        const retryInterval = setInterval(async () => {
            if (document.querySelector('#btnValidationAuto') || retryCount >= maxRetries) {
                clearInterval(retryInterval);
                if (retryCount >= maxRetries) {
                    console.log('[ValidationAuto] Échec après', maxRetries, 'tentatives');
                }
                return;
            }
            retryCount++;
            console.log('[ValidationAuto] Nouvelle tentative d\'ajout du bouton (', retryCount, '/', maxRetries, ')');
            await createValidationAutoButton();
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
    }, 1500); // Réduire le délai à 1.5 secondes
}

// Observer les changements de page pour réinitialiser le module si nécessaire
let lastUrlValidation = location.href;
new MutationObserver(() => {
    const currentUrl = location.href;
    if (currentUrl !== lastUrlValidation) {
        lastUrlValidation = currentUrl;
        console.log('[ValidationAuto] 🔄 Changement de page détecté:', currentUrl);
        
        // Recréer immédiatement le panneau s'il y a une automatisation en cours
        setTimeout(async () => {
            const state = await getValidationState();
            if (state[STORAGE_KEYS.VALIDATION_RUNNING] && !progressPanel) {
                console.log('[ValidationAuto] ⚡ Recréation immédiate du panneau après changement de page');
                const optionsList = state[STORAGE_KEYS.OPTIONS_LIST] || [];
                if (optionsList.length > 0) {
                    await createProgressPanel(optionsList);
                }
            }
        }, 25); // Très rapide pour éviter le délai visible
        
        // Nouvelle page détectée, nettoyer d'abord puis vérifier automatisation
        setTimeout(async () => {
            // Nettoyer l'état si on arrive sur une nouvelle liste mère
            await cleanStateIfNewListeMere();
            
            // Vérifier si une automatisation est en cours
            const automationContinued = await continueAutomationIfRunning();
            
            // Ajouter le bouton si on est sur une liste mère ET qu'aucune automatisation n'est en cours
            if (!automationContinued && isListeMerePage() && !document.querySelector('#btnValidationAuto')) {
                await createValidationAutoButton();
            }
        }, 1500);
    }
}).observe(document, { subtree: true, childList: true });

// Ajouter l'écoute de la touche Échap pour la validation automatique
document.addEventListener('keydown', handleValidationEscapeKey);

// Écouter les messages pour activer/désactiver la fonctionnalité
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'updateAutomaticValidation') {
        VALIDATION_AUTO_CONFIG = { ...VALIDATION_AUTO_CONFIG, ...request.config };
        console.log('[ValidationAuto] Configuration mise à jour:', VALIDATION_AUTO_CONFIG);
        
        if (VALIDATION_AUTO_CONFIG.enabled) {
            // Relancer l'initialisation si on est sur une page de liste mère
            if (isListeMerePage() && !document.querySelector('#btnValidationAuto')) {
                createValidationAutoButton().catch(error => {
                    console.error('[ValidationAuto] Erreur lors de la création du bouton:', error);
                });
            }
        } else {
            // Supprimer le bouton s'il existe
            const existingButton = document.querySelector('#btnValidationAuto');
            if (existingButton) {
                existingButton.parentNode.remove(); // Supprimer le conteneur entier
                console.log('[ValidationAuto] Bouton supprimé car fonctionnalité désactivée');
            }
        }
        
        sendResponse({ success: true });
    }
});

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
    // Recréer immédiatement le panneau si nécessaire
    setTimeout(async () => {
        const state = await getValidationState();
        if (state[STORAGE_KEYS.VALIDATION_RUNNING] && !progressPanel) {
            console.log('[ValidationAuto] ⚡ Recréation du panneau après load complet');
            const optionsList = state[STORAGE_KEYS.OPTIONS_LIST] || [];
            if (optionsList.length > 0) {
                await createProgressPanel(optionsList);
            }
        }
    }, 50);
    
    setTimeout(async () => {
        console.log('[ValidationAuto] 🔄 Initialisation après chargement complet de la page');
        
        // Nettoyer l'état si on arrive sur une nouvelle liste mère
        await cleanStateIfNewListeMere();
        
        // Vérifier si une automatisation est en cours
        const automationContinued = await continueAutomationIfRunning();
        
        // Ajouter le bouton si nécessaire et si aucune automatisation n'est en cours
        if (!automationContinued && isListeMerePage() && !document.querySelector('#btnValidationAuto')) {
            await createValidationAutoButton();
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