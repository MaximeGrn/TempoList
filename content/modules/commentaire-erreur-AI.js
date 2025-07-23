// Configuration par défaut
let AI_COMMENT_CONFIG = {
    enabled: true
};

// Charger la configuration
async function loadAiCommentConfig() {
    try {
        const result = await chrome.storage.local.get(['aiErrorCommentEnabled']);
        AI_COMMENT_CONFIG.enabled = result.aiErrorCommentEnabled !== false; // true par défaut
    } catch (error) {
        // En cas d'erreur, utiliser la configuration par défaut
    }
}

// Fonction pour vérifier si nous sommes sur une page d'édition de liste de fournitures
function isListPage() {
    const url = window.location.href;
    return url.startsWith('https://crealiste.com/encodeur/listeFournitures/');
}

// Fonction pour trouver le nom de l'encodeur
function findEncoderName() {
    if (!isListPage()) {
        return null;
    }

    const liElements = document.querySelectorAll('.lineCodeRef');
    for (const li of liElements) {
        const span = li.querySelector('span');
        if (span && span.textContent.trim() === 'Encodeur :') {
            return li.textContent.replace('Encodeur :', '').trim();
        }
    }
    return null;
}

// Fonction pour remplir le commentaire si l'encodeur est l'IA
function fillIAComment() {
    if (!AI_COMMENT_CONFIG.enabled || !isListPage()) {
        return;
    }

    const encoderName = findEncoderName();

    if (encoderName === 'encodeur IA') {
        const commentBox = document.getElementById('messageError');
        if (commentBox && commentBox.value.trim() === '') {
            commentBox.value = "Liste faite par l'IA, à revoir entièrement s'il te plaît";
            
            // Simuler un événement 'input' pour que la page réagisse au changement
            const event = new Event('input', { bubbles: true });
            commentBox.dispatchEvent(event);
        }
    }
}

// Écouter les messages pour activer/désactiver la fonctionnalité
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'updateAiErrorComment') {
        AI_COMMENT_CONFIG.enabled = request.config.enabled;
        // Relancer la fonction au cas où la page est déjà chargée et l'option vient d'être activée
        fillIAComment();
        sendResponse({ success: true });
    }
});

// Initialiser
async function initAiComment() {
    await loadAiCommentConfig();
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', fillIAComment);
    } else {
        fillIAComment();
    }
}

initAiComment(); 