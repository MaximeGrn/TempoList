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
});

// Créer le menu contextuel
function createContextMenu() {
    chrome.contextMenus.removeAll(() => {
        chrome.contextMenus.create({
            id: "autoFillCommune",
            title: "🔄 Auto-remplir Commune",
            contexts: ["all"]
        });
        
        chrome.contextMenus.create({
            id: "stopAutomation",
            title: "⏹️ Arrêter l'automatisation",
            contexts: ["all"]
        });
    });
}

// Variables pour stocker les informations de l'élément cible
let currentElementInfo = null;

// Gestionnaire pour les clics sur le menu contextuel
chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "autoFillCommune") {
        // Démarrer l'automatisation
        if (currentElementInfo) {
            chrome.tabs.sendMessage(tab.id, {
                action: 'startAutomation',
                element: currentElementInfo
            });
        } else {
            // Essayer de démarrer sans élément spécifique
            chrome.tabs.sendMessage(tab.id, {
                action: 'startAutomation',
                element: { tagName: 'SELECT' } // Par défaut, chercher un select
            });
        }
    } else if (info.menuItemId === "stopAutomation") {
        // Arrêter l'automatisation
        chrome.tabs.sendMessage(tab.id, {
            action: 'stopAutomation'
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