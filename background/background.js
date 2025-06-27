// Service Worker pour TempoList
// Gestionnaire d'installation
chrome.runtime.onInstalled.addListener(async () => {
    console.log('TempoList installé');
    
    // Initialiser les données par défaut si elles n'existent pas
    const result = await chrome.storage.local.get(['teams', 'dailyTarget', 'currentDay']);
    
    if (!result.teams) {
        await chrome.storage.local.set({ teams: [] });
    }
    
    if (!result.dailyTarget) {
        await chrome.storage.local.set({ dailyTarget: 40 });
    }
    
    if (!result.currentDay) {
        await chrome.storage.local.set({ 
            currentDay: {
                date: new Date().toDateString(),
                count: 0,
                timestamps: [],
                activeTeam: null
            }
        });
    }
    
    // Créer le menu contextuel pour l'automatisation
    createContextMenu();
    
    // Initialiser le menu pour l'onglet actif après un court délai
    setTimeout(initializeMenuForCurrentTab, 500);
});

// Écouter les changements d'onglet actif
chrome.tabs.onActivated.addListener(async (activeInfo) => {
    await updateContextMenuForTab(activeInfo.tabId);
});

// Écouter les mises à jour d'URL dans les onglets
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    // Mettre à jour seulement si l'URL a changé et que la page est complètement chargée
    if (changeInfo.url || (changeInfo.status === 'complete' && tab.active)) {
        await updateContextMenuForTab(tabId);
    }
});

// Initialiser le menu pour l'onglet actif au démarrage
chrome.runtime.onStartup.addListener(async () => {
    setTimeout(initializeMenuForCurrentTab, 500);
});

// Créer le menu contextuel
function createContextMenu() {
    chrome.contextMenus.removeAll(() => {
        // Les menus contextuels seront créés dynamiquement selon l'URL
        console.log('Menu contextuel initialisé (sera créé selon l\'URL)');
    });
}

// Créer les menus contextuels spécifiques à crealiste.com
function createCrealisteContextMenu() {
    chrome.contextMenus.create({
        id: "autoFillCommune",
        title: "🔄 Auto-remplir Commune",
        contexts: ["all"],
        documentUrlPatterns: ["*://crealiste.com/*", "*://*.crealiste.com/*"]
    });
    
    chrome.contextMenus.create({
        id: "autoFillPattern",
        title: "🎯 Remplissage automatique",
        contexts: ["all"],
        documentUrlPatterns: ["*://crealiste.com/*", "*://*.crealiste.com/*"]
    });
}

// Fonction pour mettre à jour les menus contextuels selon l'URL
async function updateContextMenuForTab(tabId) {
    try {
        const tab = await chrome.tabs.get(tabId);
        const isCrealiste = tab.url && (
            tab.url.includes('crealiste.com') ||
            tab.url.includes('www.crealiste.com')
        );
        
        console.log(`Mise à jour menu contextuel pour: ${tab.url} - Crealiste: ${isCrealiste}`);
        
        // Supprimer tous les menus existants
        chrome.contextMenus.removeAll(() => {
            if (isCrealiste) {
                // Créer les menus spécifiques à crealiste
                createCrealisteContextMenu();
                console.log('Menus contextuels TempoList activés pour crealiste.com');
            } else {
                console.log('Menus contextuels TempoList désactivés (pas sur crealiste.com)');
            }
        });
    } catch (error) {
        console.log('Erreur lors de la mise à jour du menu contextuel:', error);
    }
}

// Initialiser le menu pour l'onglet actif immédiatement
async function initializeMenuForCurrentTab() {
    try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs[0]) {
            await updateContextMenuForTab(tabs[0].id);
        }
    } catch (error) {
        console.log('Erreur lors de l\'initialisation du menu:', error);
    }
}

// Variables pour stocker les informations de l'élément cible
let currentElementInfo = null;

// Gestionnaire pour les clics sur le menu contextuel
chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "autoFillCommune") {
        // Démarrer l'automatisation Commune
        if (currentElementInfo) {
            chrome.tabs.sendMessage(tab.id, {
                action: 'startAutomation',
                element: currentElementInfo,
                mode: 'commune'
            });
        } else {
            chrome.tabs.sendMessage(tab.id, {
                action: 'startAutomation',
                element: { tagName: 'SELECT' },
                mode: 'commune'
            });
        }
    } else if (info.menuItemId === "autoFillPattern") {
        // Démarrer le remplissage automatique par pattern
        chrome.tabs.sendMessage(tab.id, {
            action: 'startPatternFill',
            element: currentElementInfo || { tagName: 'SELECT' }
        });
    }
});

// Gestionnaire pour les messages entre les différentes parties de l'extension
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'resetDay') {
        resetDay().then(sendResponse);
        return true; // Pour indiquer une réponse asynchrone
    }
    
    if (request.action === 'addListCompleted') {
        addListCompleted().then(sendResponse);
        return true;
    }
    
    if (request.action === 'elementRightClicked') {
        // Stocker les informations de l'élément sur lequel l'utilisateur a fait clic droit
        currentElementInfo = request.elementInfo;
        sendResponse({ success: true });
    }
});

// Fonction pour réinitialiser la journée
async function resetDay() {
    try {
        const today = new Date().toDateString();
        
        // Sauvegarder dans l'historique avant de réinitialiser
        const { currentDay: dayData, dailyTarget } = await chrome.storage.local.get(['currentDay', 'dailyTarget']);
        
        if (dayData && dayData.count > 0) {
            const { history } = await chrome.storage.local.get('history');
            const historyData = history || [];
            
            historyData.push({
                date: dayData.date,
                count: dayData.count,
                timestamps: dayData.timestamps,
                activeTeam: dayData.activeTeam,
                dailyTarget: dailyTarget || 0 // Sauvegarder l'objectif du jour
            });
            
            await chrome.storage.local.set({ history: historyData });
        }
        
        // Réinitialiser la journée actuelle
        await chrome.storage.local.set({
            currentDay: {
                date: today,
                count: 0,
                timestamps: [],
                activeTeam: null
            }
        });
        
        return { success: true };
    } catch (error) {
        console.error('Erreur lors de la réinitialisation:', error);
        return { success: false, error: error.message };
    }
}

// Fonction pour ajouter une liste complétée
async function addListCompleted() {
    try {
        const currentDay = await chrome.storage.local.get('currentDay');
        const dayData = currentDay.currentDay;
        
        if (!dayData) {
            throw new Error('Données du jour non trouvées');
        }
        
        const now = Date.now();
        dayData.count += 1;
        dayData.timestamps.push(now);
        
        await chrome.storage.local.set({ currentDay: dayData });
        
        return { success: true, newCount: dayData.count };
    } catch (error) {
        console.error('Erreur lors de l\'ajout:', error);
        return { success: false, error: error.message };
    }
}

// Vérifier quotidiennement si on doit créer une nouvelle journée
// (au cas où l'utilisateur n'utilise pas l'extension pendant plusieurs jours)
function checkNewDay() {
    chrome.storage.local.get('currentDay', (result) => {
        const today = new Date().toDateString();
        const currentDay = result.currentDay;
        
        if (currentDay && currentDay.date !== today) {
            // Nouveau jour détecté, mais on ne réinitialise PAS automatiquement
            // L'utilisateur doit le faire manuellement
            console.log('Nouveau jour détecté, mais pas de réinitialisation automatique');
        }
    });
}

// Vérifier au démarrage
checkNewDay();

// Optionnel : vérifier périodiquement (toutes les heures)
setInterval(checkNewDay, 60 * 60 * 1000); 