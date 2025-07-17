// Variables globales
let voteHistory = [];
let encoderStats = {};
let filteredVoteHistory = [];
let filteredEncoderStats = {};
let selectedEncoders = [];
let dateSort = 'desc'; // 'desc' = plus récent d'abord, 'asc' = plus ancien d'abord
let selectedVoteIndices = new Set();

// Initialisation au chargement de la page
document.addEventListener('DOMContentLoaded', function() {
    // Événements principaux
    document.getElementById('refreshBtn').addEventListener('click', loadAndDisplayData);
    
    // Événements des filtres et contrôles
    document.getElementById('encoderFilter').addEventListener('change', handleEncoderFilterChange);
    document.getElementById('clearFilterBtn').addEventListener('click', clearEncoderFilter);
    document.getElementById('sortDateBtn').addEventListener('click', toggleDateSort);
    document.getElementById('deleteSelectedBtn').addEventListener('click', deleteSelectedVotes);
    document.getElementById('selectAllCheckbox').addEventListener('change', handleSelectAllChange);
    
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
        
        // Initialiser les filtres
        initializeEncoderFilter();
        
        // Appliquer les filtres et afficher les données
        applyFilters();
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
    
    // Mettre à jour le compteur avec les données filtrées
    voteCount.textContent = filteredVoteHistory.length;
    
    if (filteredVoteHistory.length === 0) {
        const colSpan = selectedEncoders.length === 0 ? 'Aucun vote enregistré' : 'Aucun vote pour les encodeurs sélectionnés';
        tableBody.innerHTML = `<tr><td colspan="7" class="loading">${colSpan}</td></tr>`;
        return;
    }
    
    // Trier selon l'ordre choisi
    const sortedVotes = [...filteredVoteHistory].sort((a, b) => {
        return dateSort === 'desc' ? b.timestamp - a.timestamp : a.timestamp - b.timestamp;
    });
    
    // Générer les lignes du tableau avec cases à cocher
    const rows = sortedVotes.map((vote, filteredIndex) => {
        const date = new Date(vote.timestamp);
        const formattedDate = formatDateTime(date);
        
        const voteText = vote.isPositive ? '✅ Positif' : '❌ Négatif';
        const voteClass = vote.isPositive ? 'vote-positive' : 'vote-negative';
        
        // Trouver l'index original dans voteHistory pour la sélection
        // Utilisation d'une correspondance plus stricte pour éviter les erreurs
        const originalIndex = voteHistory.findIndex(v => 
            v.timestamp === vote.timestamp && 
            v.encoderName === vote.encoderName && 
            v.listReference === vote.listReference &&
            v.level === vote.level &&
            v.coefficient === vote.coefficient &&
            v.isPositive === vote.isPositive
        );
        
        if (originalIndex === -1) {
            console.warn('[DataViewer] Impossible de trouver l\'index original pour le vote:', vote);
        }
        
        const isSelected = selectedVoteIndices.has(originalIndex);
        const selectedClass = isSelected ? 'selected' : '';
        
        return `
            <tr class="${selectedClass}" data-original-index="${originalIndex}">
                <td class="checkbox-col">
                    <input type="checkbox" ${isSelected ? 'checked' : ''} 
                           data-original-index="${originalIndex}" class="vote-checkbox">
                </td>
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
    
    // Attacher les event listeners aux checkboxes après avoir inséré le HTML
    attachVoteCheckboxListeners();
    
    // Mettre à jour l'état du bouton supprimer après avoir mis à jour l'affichage
    updateDeleteButton();
}

// Afficher les statistiques des encodeurs
function displayEncoderStats() {
    const tableBody = document.querySelector('#encoderStatsTable tbody');
    const statsCount = document.getElementById('statsCount');
    
    const encoderNames = Object.keys(filteredEncoderStats);
    
    // Mettre à jour le compteur avec les données filtrées
    statsCount.textContent = encoderNames.length;
    
    if (encoderNames.length === 0) {
        const message = selectedEncoders.length === 0 ? 'Aucune statistique disponible' : 'Aucune statistique pour les encodeurs sélectionnés';
        tableBody.innerHTML = `<tr><td colspan="5" class="loading">${message}</td></tr>`;
        return;
    }
    
    // Créer un tableau avec les données filtrées et trier
    const encodersData = encoderNames.map(name => ({
        name,
        ...filteredEncoderStats[name]
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

// Fonctions accessibles globalement pour debug
window.getDebugData = function() {
    return {
        voteHistory,
        encoderStats,
        filteredVoteHistory,
        filteredEncoderStats,
        selectedEncoders,
        selectedVoteIndices: Array.from(selectedVoteIndices),
        totalVotes: voteHistory.length,
        filteredVotes: filteredVoteHistory.length,
        totalEncoders: Object.keys(encoderStats).length
    };
};

// Fonction de test pour la sélection
window.testVoteSelection = function() {
    console.log('=== TEST DE SÉLECTION ===');
    console.log('Votes sélectionnés:', selectedVoteIndices.size);
    console.log('Contenu selectedVoteIndices:', Array.from(selectedVoteIndices));
    
    const deleteBtn = document.getElementById('deleteSelectedBtn');
    console.log('Bouton supprimer disabled:', deleteBtn.disabled);
    
    const checkboxes = document.querySelectorAll('.vote-checkbox:checked');
    console.log('Checkboxes cochées dans le DOM:', checkboxes.length);
    
    checkboxes.forEach((cb, index) => {
        console.log(`Checkbox ${index}: originalIndex=${cb.dataset.originalIndex}, checked=${cb.checked}`);
    });
    console.log('========================');
};

// === FONCTIONS DE FILTRAGE ===

// Initialiser le filtre des encodeurs
function initializeEncoderFilter() {
    const filterSelect = document.getElementById('encoderFilter');
    
    // Récupérer tous les noms d'encodeurs uniques et les trier alphabétiquement
    const allEncoders = [...new Set(voteHistory.map(vote => vote.encoderName))].sort();
    
    // Vider et remplir la liste
    filterSelect.innerHTML = '';
    
    allEncoders.forEach(encoderName => {
        const option = document.createElement('option');
        option.value = encoderName;
        option.textContent = encoderName;
        option.selected = selectedEncoders.includes(encoderName);
        filterSelect.appendChild(option);
    });
    
    console.log('[DataViewer] Filtre encodeurs initialisé avec', allEncoders.length, 'encodeurs');
}

// Gérer le changement de filtre encodeur
function handleEncoderFilterChange() {
    const filterSelect = document.getElementById('encoderFilter');
    selectedEncoders = Array.from(filterSelect.selectedOptions).map(option => option.value);
    
    console.log('[DataViewer] Encodeurs sélectionnés:', selectedEncoders);
    
    // Appliquer les filtres et rafraîchir l'affichage
    applyFilters();
    displayVoteHistory();
    displayEncoderStats();
    
    // Réinitialiser les sélections de lignes
    selectedVoteIndices.clear();
    updateDeleteButton();
    updateSelectAllCheckbox();
}

// Effacer le filtre encodeur
function clearEncoderFilter() {
    const filterSelect = document.getElementById('encoderFilter');
    
    // Désélectionner toutes les options
    Array.from(filterSelect.options).forEach(option => {
        option.selected = false;
    });
    
    selectedEncoders = [];
    
    // Appliquer les filtres et rafraîchir l'affichage
    applyFilters();
    displayVoteHistory();
    displayEncoderStats();
    
    // Réinitialiser les sélections de lignes
    selectedVoteIndices.clear();
    updateDeleteButton();
    updateSelectAllCheckbox();
    
    console.log('[DataViewer] Filtre encodeurs effacé');
}

// Appliquer tous les filtres
function applyFilters() {
    // Filtrer l'historique des votes
    if (selectedEncoders.length === 0) {
        filteredVoteHistory = [...voteHistory];
    } else {
        filteredVoteHistory = voteHistory.filter(vote => selectedEncoders.includes(vote.encoderName));
    }
    
    // Filtrer les statistiques des encodeurs
    if (selectedEncoders.length === 0) {
        filteredEncoderStats = { ...encoderStats };
    } else {
        filteredEncoderStats = {};
        selectedEncoders.forEach(encoderName => {
            if (encoderStats[encoderName]) {
                filteredEncoderStats[encoderName] = encoderStats[encoderName];
            }
        });
    }
    
    console.log('[DataViewer] Filtres appliqués:', {
        votesFiltered: filteredVoteHistory.length,
        encodersFiltered: Object.keys(filteredEncoderStats).length
    });
}

// === FONCTIONS DE TRI ===

// Basculer l'ordre de tri par date
function toggleDateSort() {
    const sortBtn = document.getElementById('sortDateBtn');
    const icon = sortBtn.querySelector('svg');
    
    // Basculer l'ordre
    dateSort = dateSort === 'desc' ? 'asc' : 'desc';
    
    // Mettre à jour l'icône et le texte
    if (dateSort === 'desc') {
        icon.innerHTML = '<path d="M3.5 2.5a.5.5 0 0 0-1 0v8.793l-1.146-1.147a.5.5 0 0 0-.708.708l2 1.999.007.007a.497.497 0 0 0 .7-.006l2-2a.5.5 0 0 0-.707-.708L3.5 11.293zm3.5 1a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7a.5.5 0 0 1-.5-.5M7.5 6a.5.5 0 0 0 0 1h5a.5.5 0 0 0 0-1zm0 3a.5.5 0 0 0 0 1h3a.5.5 0 0 0 0-1zm0 3a.5.5 0 0 0 0 1h1a.5.5 0 0 0 0-1z"/>';
        sortBtn.querySelector('span') ? sortBtn.querySelector('span').textContent = 'Tri par date : Plus récent d\'abord' : sortBtn.lastChild.textContent = 'Tri par date : Plus récent d\'abord';
        sortBtn.title = 'Cliquer pour trier par date croissante';
    } else {
        icon.innerHTML = '<path d="m3.5 13.5a.5.5 0 0 1-1 0V4.707L1.354 5.854a.5.5 0 1 1-.708-.708l2-1.999.007-.007a.497.497 0 0 1 .7.006l2 2a.5.5 0 1 1-.707.708L3.5 4.707zm3.5-9a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7a.5.5 0 0 1-.5-.5M7 6a.5.5 0 0 0 0 1h5a.5.5 0 0 0 0-1zm0 3a.5.5 0 0 0 0 1h3a.5.5 0 0 0 0-1zm0 3a.5.5 0 0 0 0 1h1a.5.5 0 0 0 0-1z"/>';
        sortBtn.querySelector('span') ? sortBtn.querySelector('span').textContent = 'Tri par date : Plus ancien d\'abord' : sortBtn.lastChild.textContent = 'Tri par date : Plus ancien d\'abord';
        sortBtn.title = 'Cliquer pour trier par date décroissante';
    }
    
    // Rafraîchir l'affichage
    displayVoteHistory();
    
    console.log('[DataViewer] Tri par date:', dateSort);
}

// === FONCTIONS DE SÉLECTION ET SUPPRESSION ===

// Gérer la sélection d'un vote
function handleVoteSelection(originalIndex, isSelected) {
    console.log('[DataViewer] handleVoteSelection appelée:', { originalIndex, isSelected });
    
    if (isSelected) {
        selectedVoteIndices.add(originalIndex);
    } else {
        selectedVoteIndices.delete(originalIndex);
    }
    
    // Mettre à jour la ligne visuellement
    const row = document.querySelector(`tr[data-original-index="${originalIndex}"]`);
    if (row) {
        if (isSelected) {
            row.classList.add('selected');
        } else {
            row.classList.remove('selected');
        }
    }
    
    updateDeleteButton();
    updateSelectAllCheckbox();
    
    console.log('[DataViewer] Votes sélectionnés après mise à jour:', selectedVoteIndices.size);
    console.log('[DataViewer] selectedVoteIndices contenu:', Array.from(selectedVoteIndices));
}

// Gérer la sélection/désélection de tout
function handleSelectAllChange() {
    const selectAllCheckbox = document.getElementById('selectAllCheckbox');
    const isSelectAll = selectAllCheckbox.checked;
    
    // Obtenir tous les indices originaux des votes filtrés actuellement visibles
    const visibleOriginalIndices = filteredVoteHistory.map(vote => 
        voteHistory.findIndex(v => 
            v.timestamp === vote.timestamp && 
            v.encoderName === vote.encoderName && 
            v.listReference === vote.listReference
        )
    );
    
    if (isSelectAll) {
        // Sélectionner tous les votes visibles
        visibleOriginalIndices.forEach(index => selectedVoteIndices.add(index));
    } else {
        // Désélectionner tous les votes visibles
        visibleOriginalIndices.forEach(index => selectedVoteIndices.delete(index));
    }
    
    // Rafraîchir l'affichage pour mettre à jour les checkboxes
    displayVoteHistory();
    updateDeleteButton();
    
    console.log('[DataViewer] Sélection globale:', isSelectAll, 'Votes sélectionnés:', selectedVoteIndices.size);
}

// Mettre à jour l'état du bouton de suppression
function updateDeleteButton() {
    const deleteBtn = document.getElementById('deleteSelectedBtn');
    const isDisabled = selectedVoteIndices.size === 0;
    
    console.log('[DataViewer] updateDeleteButton:', { 
        selectedCount: selectedVoteIndices.size, 
        shouldBeDisabled: isDisabled 
    });
    
    deleteBtn.disabled = isDisabled;
    
    if (selectedVoteIndices.size > 0) {
        deleteBtn.textContent = `Supprimer sélection (${selectedVoteIndices.size})`;
    } else {
        deleteBtn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-trash" viewBox="0 0 16 16">
              <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0z"/>
              <path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4zM2.5 3h11V2h-11z"/>
            </svg>
            Supprimer sélection
        `;
    }
}

// Mettre à jour l'état de la checkbox "sélectionner tout"
function updateSelectAllCheckbox() {
    const selectAllCheckbox = document.getElementById('selectAllCheckbox');
    
    if (filteredVoteHistory.length === 0) {
        selectAllCheckbox.checked = false;
        selectAllCheckbox.indeterminate = false;
        return;
    }
    
    // Compter combien de votes visibles sont sélectionnés
    const visibleOriginalIndices = filteredVoteHistory.map(vote => 
        voteHistory.findIndex(v => 
            v.timestamp === vote.timestamp && 
            v.encoderName === vote.encoderName && 
            v.listReference === vote.listReference
        )
    );
    
    const selectedVisibleCount = visibleOriginalIndices.filter(index => selectedVoteIndices.has(index)).length;
    
    if (selectedVisibleCount === 0) {
        selectAllCheckbox.checked = false;
        selectAllCheckbox.indeterminate = false;
    } else if (selectedVisibleCount === visibleOriginalIndices.length) {
        selectAllCheckbox.checked = true;
        selectAllCheckbox.indeterminate = false;
    } else {
        selectAllCheckbox.checked = false;
        selectAllCheckbox.indeterminate = true;
    }
}

// Supprimer les votes sélectionnés
async function deleteSelectedVotes() {
    if (selectedVoteIndices.size === 0) {
        return;
    }
    
    const confirmed = confirm(
        `Êtes-vous sûr de vouloir supprimer ${selectedVoteIndices.size} vote(s) sélectionné(s) ?\n\n` +
        'Cette action est irréversible et recalculera automatiquement les statistiques.'
    );
    
    if (!confirmed) {
        return;
    }
    
    try {
        // Convertir les indices en tableau et trier par ordre décroissant pour éviter les problèmes d'indices
        const indicesToDelete = Array.from(selectedVoteIndices).sort((a, b) => b - a);
        
        console.log('[DataViewer] Suppression de', indicesToDelete.length, 'votes aux indices:', indicesToDelete);
        
        // Supprimer les votes de l'historique (en partant de la fin pour éviter les problèmes d'indices)
        indicesToDelete.forEach(index => {
            voteHistory.splice(index, 1);
        });
        
        // Recalculer les statistiques à partir de l'historique modifié
        recalculateStatsFromHistory();
        
        // Sauvegarder les données modifiées
        await chrome.storage.local.set({ 
            voteHistory: voteHistory,
            encoderStats: encoderStats 
        });
        
        // Réinitialiser les sélections
        selectedVoteIndices.clear();
        
        // Réappliquer les filtres et rafraîchir l'affichage
        initializeEncoderFilter();
        applyFilters();
        displayVoteHistory();
        displayEncoderStats();
        
        updateDeleteButton();
        updateSelectAllCheckbox();
        
        console.log('[DataViewer] Suppression terminée. Nouveaux totaux:', {
            votes: voteHistory.length,
            encoders: Object.keys(encoderStats).length
        });
        
        alert(`${indicesToDelete.length} vote(s) supprimé(s) avec succès !`);
        
    } catch (error) {
        console.error('[DataViewer] Erreur lors de la suppression des votes:', error);
        alert('Erreur lors de la suppression des votes');
    }
}

// Recalculer les statistiques à partir de l'historique
function recalculateStatsFromHistory() {
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
    
    console.log('[DataViewer] Statistiques recalculées:', encoderStats);
}

// Attacher les event listeners aux checkboxes de votes
function attachVoteCheckboxListeners() {
    const checkboxes = document.querySelectorAll('.vote-checkbox');
    console.log('[DataViewer] Attachement des listeners à', checkboxes.length, 'checkboxes');
    
    checkboxes.forEach((checkbox, index) => {
        checkbox.addEventListener('change', function() {
            const originalIndex = parseInt(this.dataset.originalIndex);
            const isSelected = this.checked;
            console.log('[DataViewer] Checkbox changée:', { index, originalIndex, isSelected });
            handleVoteSelection(originalIndex, isSelected);
        });
    });
}

// Console info
console.log('[DataViewer] Page de visualisation des données chargée');
console.log('[DataViewer] Fonctions debug disponibles:');
console.log('  - getDebugData() : voir toutes les données');
console.log('  - testVoteSelection() : tester le système de sélection'); 