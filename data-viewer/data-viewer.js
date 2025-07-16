// Variables globales
let voteHistory = [];
let encoderStats = {};

// Initialisation au chargement de la page
document.addEventListener('DOMContentLoaded', function() {
    // Événements
    document.getElementById('refreshBtn').addEventListener('click', loadAndDisplayData);
    
    // Charger les données au démarrage
    loadAndDisplayData();
});

// Charger et afficher toutes les données
async function loadAndDisplayData() {
    try {
        // Mettre à jour l'indicateur de chargement
        updateLastUpdate('Chargement...');
        
        // Charger depuis chrome.storage
        const result = await chrome.storage.local.get(['voteHistory', 'encoderStats']);
        voteHistory = result.voteHistory || [];
        encoderStats = result.encoderStats || {};
        
        console.log('[DataViewer] Données chargées:', { voteHistory, encoderStats });
        
        // Afficher les données
        displayVoteHistory();
        displayEncoderStats();
        
        // Mettre à jour l'heure de dernière mise à jour
        updateLastUpdate();
        
        // Cacher le message "pas de données" si on a des données
        const noDataMessage = document.getElementById('noDataMessage');
        if (voteHistory.length > 0 || Object.keys(encoderStats).length > 0) {
            noDataMessage.style.display = 'none';
        } else {
            noDataMessage.style.display = 'block';
            // Cacher les sections si pas de données
            document.querySelectorAll('.data-section').forEach(section => {
                section.style.display = 'none';
            });
        }
        
    } catch (error) {
        console.error('[DataViewer] Erreur lors du chargement des données:', error);
        showError('Erreur lors du chargement des données');
    }
}

// Afficher l'historique des votes
function displayVoteHistory() {
    const tableBody = document.querySelector('#voteHistoryTable tbody');
    const voteCount = document.getElementById('voteCount');
    
    // Mettre à jour le compteur
    voteCount.textContent = voteHistory.length;
    
    if (voteHistory.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="6" class="loading">Aucun vote enregistré</td></tr>';
        return;
    }
    
    // Trier par timestamp décroissant (plus récent en premier)
    const sortedVotes = [...voteHistory].sort((a, b) => b.timestamp - a.timestamp);
    
    // Générer les lignes du tableau
    const rows = sortedVotes.map(vote => {
        const date = new Date(vote.timestamp);
        const formattedDate = formatDateTime(date);
        
        const voteText = vote.isPositive ? '✅ Positif' : '❌ Négatif';
        const voteClass = vote.isPositive ? 'vote-positive' : 'vote-negative';
        
        return `
            <tr>
                <td class="timestamp-cell">${formattedDate}</td>
                <td class="encoder-cell">${escapeHtml(vote.encoderName)}</td>
                <td><span class="reference-cell">${escapeHtml(vote.listReference)}</span></td>
                <td class="${voteClass}">${voteText}</td>
                <td><span class="level-cell">${escapeHtml(vote.level)}</span></td>
                <td class="coefficient-cell">×${vote.coefficient}</td>
            </tr>
        `;
    }).join('');
    
    tableBody.innerHTML = rows;
}

// Afficher les statistiques des encodeurs
function displayEncoderStats() {
    const tableBody = document.querySelector('#encoderStatsTable tbody');
    const statsCount = document.getElementById('statsCount');
    
    const encoderNames = Object.keys(encoderStats);
    
    // Mettre à jour le compteur
    statsCount.textContent = encoderNames.length;
    
    if (encoderNames.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5" class="loading">Aucune statistique disponible</td></tr>';
        return;
    }
    
    // Créer un tableau avec les données et trier
    const encodersData = encoderNames.map(name => ({
        name,
        ...encoderStats[name]
    }));
    
    // Trier par pourcentage décroissant, puis par nombre de votes décroissant
    encodersData.sort((a, b) => {
        if (b.percentage !== a.percentage) {
            return b.percentage - a.percentage;
        }
        return b.totalVotes - a.totalVotes;
    });
    
    // Générer les lignes du tableau
    const rows = encodersData.map(encoder => {
        const percentageClass = getPercentageClass(encoder.percentage);
        
        return `
            <tr>
                <td class="encoder-cell">${escapeHtml(encoder.name)}</td>
                <td>${encoder.totalVotes}</td>
                <td class="vote-positive">${encoder.positiveScore.toFixed(2)}</td>
                <td class="vote-negative">${encoder.negativeScore.toFixed(2)}</td>
                <td class="percentage-cell ${percentageClass}">${encoder.percentage.toFixed(1)}%</td>
            </tr>
        `;
    }).join('');
    
    tableBody.innerHTML = rows;
}

// Formater la date et l'heure
function formatDateTime(date) {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    
    return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
}

// Obtenir la classe CSS pour le pourcentage
function getPercentageClass(percentage) {
    if (percentage >= 80) return 'percentage-high';
    if (percentage >= 60) return 'percentage-medium';
    return 'percentage-low';
}

// Échapper le HTML pour éviter les injections
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Mettre à jour l'heure de dernière mise à jour
function updateLastUpdate(customText = null) {
    const lastUpdateElement = document.getElementById('lastUpdate');
    
    if (customText) {
        lastUpdateElement.textContent = customText;
        return;
    }
    
    const now = new Date();
    const formatted = formatDateTime(now);
    lastUpdateElement.textContent = `Dernière mise à jour: ${formatted}`;
}

// Afficher une erreur
function showError(message) {
    const lastUpdateElement = document.getElementById('lastUpdate');
    lastUpdateElement.textContent = `Erreur: ${message}`;
    lastUpdateElement.style.color = 'var(--error-color)';
    
    // Remettre la couleur normale après 5 secondes
    setTimeout(() => {
        lastUpdateElement.style.color = '';
    }, 5000);
}

// Fonction accessible globalement pour debug
window.getDebugData = function() {
    return {
        voteHistory,
        encoderStats,
        totalVotes: voteHistory.length,
        totalEncoders: Object.keys(encoderStats).length
    };
};

// Console info
console.log('[DataViewer] Page de visualisation des données chargée');
console.log('[DataViewer] Utilisez getDebugData() pour voir les données actuelles'); 