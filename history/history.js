// history.js - Gestion de l'historique TempoList

document.addEventListener('DOMContentLoaded', async () => {
    await initializeHistory();
    setupEventListeners();
});

// Variables globales
let historyData = [];
let teams = [];
let filteredData = [];
let currentEditIndex = -1;

// Initialisation de la page historique
async function initializeHistory() {
    try {
        await loadData();
        await loadTeamFilters();
        applyFilters();
        displayHistory();
        updateStats();
    } catch (error) {
        console.error('Erreur d\'initialisation de l\'historique:', error);
    }
}

// Configuration des événements
function setupEventListeners() {
    // Navigation
    document.getElementById('backBtn').addEventListener('click', () => {
        window.close();
    });

    // Filtres
    document.getElementById('filterTeam').addEventListener('change', applyFilters);
    document.getElementById('filterPeriod').addEventListener('change', applyFilters);

    // Actions principales supprimées (export CSV et clear all)

    // Modal
    document.getElementById('closeModal').addEventListener('click', closeModal);
    document.getElementById('modalOverlay').addEventListener('click', closeModal);
    document.getElementById('saveEditBtn').addEventListener('click', saveEdit);
    document.getElementById('cancelEditBtn').addEventListener('click', closeModal);
}

// Charger les données
async function loadData() {
    const result = await chrome.storage.local.get(['history', 'teams']);
    historyData = result.history || [];
    teams = result.teams || [];
}

// Charger les filtres d'équipes
async function loadTeamFilters() {
    const filterSelect = document.getElementById('filterTeam');
    const editSelect = document.getElementById('editTeam');
    
    // Vider les options existantes (sauf la première)
    filterSelect.innerHTML = '<option value="">Toutes les équipes</option>';
    editSelect.innerHTML = '<option value="">Aucune équipe</option>';
    
    teams.forEach(team => {
        const option1 = document.createElement('option');
        option1.value = team.id;
        option1.textContent = team.name;
        filterSelect.appendChild(option1);
        
        const option2 = document.createElement('option');
        option2.value = team.id;
        option2.textContent = team.name;
        editSelect.appendChild(option2);
    });
}

// Appliquer les filtres
function applyFilters() {
    const teamFilter = document.getElementById('filterTeam').value;
    const periodFilter = document.getElementById('filterPeriod').value;
    
    filteredData = historyData.filter(day => {
        // Filtre par équipe
        if (teamFilter && day.activeTeam !== teamFilter) {
            return false;
        }
        
        // Filtre par période
        if (periodFilter !== 'all') {
            const dayDate = new Date(day.date);
            const now = new Date();
            const diffDays = Math.floor((now - dayDate) / (1000 * 60 * 60 * 24));
            
            if (periodFilter === 'week' && diffDays > 7) return false;
            if (periodFilter === 'month' && diffDays > 30) return false;
        }
        
        return true;
    });
    
    displayHistory();
    updateStats();
}

// Afficher l'historique
function displayHistory() {
    const tbody = document.getElementById('historyTableBody');
    const noHistoryMsg = document.getElementById('noHistoryMessage');
    
    if (filteredData.length === 0) {
        tbody.innerHTML = '';
        noHistoryMsg.style.display = 'block';
        return;
    }
    
    noHistoryMsg.style.display = 'none';
    
    // Trier par date (plus récent en premier)
    const sortedData = [...filteredData].sort((a, b) => new Date(b.date) - new Date(a.date));
    
    tbody.innerHTML = '';
    
    sortedData.forEach((day, index) => {
        const row = createHistoryRow(day, index);
        tbody.appendChild(row);
    });
}

// Créer une ligne de l'historique
function createHistoryRow(day, index) {
    const row = document.createElement('tr');
    
    const date = new Date(day.date).toLocaleDateString('fr-FR');
    const teamName = getTeamName(day.activeTeam);
    const duration = day.timestamps.length > 1 
        ? formatTime(day.timestamps[day.timestamps.length - 1] - day.timestamps[0])
        : '--';
    const avgTime = day.timestamps.length > 1 
        ? formatTime(calculateDayAverageTime(day))
        : '--';

    const dailyTarget = day.dailyTarget || 0;
    const objectiveText = dailyTarget > 0 ? dailyTarget : '--';
    
    let statusText;
    if (dailyTarget > 0) {
        if (day.count >= dailyTarget) {
            statusText = `<span class="status-badge status-success">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-check-circle" viewBox="0 0 16 16">
                              <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14m0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16"/>
                              <path d="m10.97 4.97-.02.022-3.473 4.425-2.093-2.094a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-1.071-1.05"/>
                            </svg>
                            Atteint
                          </span>`;
        } else {
            statusText = `<span class="status-badge status-failure">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-x-circle" viewBox="0 0 16 16">
                              <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14m0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16"/>
                              <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708"/>
                            </svg>
                            Non atteint
                          </span>`;
        }
    } else {
        statusText = '--';
    }
    
    row.innerHTML = `
        <td>${date}</td>
        <td>${teamName ? `<span class="team-badge">${teamName}</span>` : '--'}</td>
        <td><strong>${day.count}</strong></td>
        <td>${objectiveText}</td>
        <td>${statusText}</td>
        <td>${duration}</td>
        <td>${avgTime}</td>
        <td>
            <div class="action-buttons">
                <button class="action-btn edit-btn" data-index="${index}">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-pencil-square" viewBox="0 0 16 16">
                      <path d="M15.502 1.94a.5.5 0 0 1 0 .706L14.459 3.69l-2-2L13.502.646a.5.5 0 0 1 .707 0l1.293 1.293zm-1.75 2.456-2-2L4.939 9.21a.5.5 0 0 0-.121.196l-.805 2.414a.25.25 0 0 0 .316.316l2.414-.805a.5.5 0 0 0 .196-.12l6.813-6.814z"/>
                      <path fill-rule="evenodd" d="M1 13.5A1.5 1.5 0 0 0 2.5 15h11a1.5 1.5 0 0 0 1.5-1.5v-6a.5.5 0 0 0-1 0v6a.5.5 0 0 1-.5.5h-11a.5.5 0 0 1-.5-.5v-11a.5.5 0 0 1 .5-.5H9a.5.5 0 0 0 0-1H2.5A1.5 1.5 0 0 0 1 2.5z"/>
                    </svg>
                </button>
                <button class="action-btn delete-btn" data-index="${index}">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-trash3" viewBox="0 0 16 16">
                      <path d="M6.5 1h3a.5.5 0 0 1 .5.5v1H6v-1a.5.5 0 0 1 .5-.5M11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3A1.5 1.5 0 0 0 5 1.5v1H1.5a.5.5 0 0 0 0 1h.538l.853 10.66A2 2 0 0 0 4.885 16h6.23a2 2 0 0 0 1.994-1.84l.853-10.66h.538a.5.5 0 0 0 0-1zm1.958 1-.846 10.58a1 1 0 0 1-.997.92h-6.23a1 1 0 0 1-.997-.92L3.042 3.5zm-7.487 1a.5.5 0 0 1 .528.47l.5 8.5a.5.5 0 0 1-.998.06L5 5.03a.5.5 0 0 1 .47-.53Zm5.058 0a.5.5 0 0 1 .47.53l-.5 8.5a.5.5 0 1 1-.998-.06l.5-8.5a.5.5 0 0 1 .528-.47M8 4.5a.5.5 0 0 1 .5.5v8.5a.5.5 0 0 1-1 0V5a.5.5 0 0 1 .5-.5"/>
                    </svg>
                </button>
            </div>
        </td>
    `;
    
    // Ajouter les event listeners
    const editBtn = row.querySelector('.edit-btn');
    const deleteBtn = row.querySelector('.delete-btn');
    
    editBtn.addEventListener('click', () => editEntry(index));
    deleteBtn.addEventListener('click', () => deleteEntry(index));
    
    return row;
}

// Obtenir le nom d'une équipe par son ID
function getTeamName(teamId) {
    const team = teams.find(t => t.id === teamId);
    return team ? team.name : null;
}

// Calculer le temps moyen d'une journée
function calculateDayAverageTime(day) {
    if (day.timestamps.length < 2) return 0;
    
    let totalTime = 0;
    for (let i = 1; i < day.timestamps.length; i++) {
        totalTime += day.timestamps[i] - day.timestamps[i - 1];
    }
    
    return totalTime / (day.timestamps.length - 1);
}

// Mettre à jour les statistiques
function updateStats() {
    const totalLists = filteredData.reduce((sum, day) => sum + day.count, 0);
    const avgPerDay = filteredData.length > 0 ? Math.round(totalLists / filteredData.length) : 0;
    
    let bestDay = '--';
    if (filteredData.length > 0) {
        const best = filteredData.reduce((max, day) => day.count > max.count ? day : max);
        bestDay = `${best.count} (${new Date(best.date).toLocaleDateString('fr-FR')})`;
    }
    
    document.getElementById('totalLists').textContent = totalLists;
    document.getElementById('avgPerDay').textContent = avgPerDay;
    document.getElementById('bestDay').textContent = bestDay;
}

// Éditer une entrée
function editEntry(index) {
    const day = filteredData[index];
    currentEditIndex = historyData.findIndex(d => d.date === day.date && d.activeTeam === day.activeTeam);
    
    // Remplir le modal
    document.getElementById('editDate').value = new Date(day.date).toISOString().split('T')[0];
    document.getElementById('editCount').value = day.count;
    document.getElementById('editTeam').value = day.activeTeam || '';
    
    // Afficher le modal
    showModal();
}

// Supprimer une entrée
async function deleteEntry(index) {
    const day = filteredData[index];
    const date = new Date(day.date).toLocaleDateString('fr-FR');
    
    if (!confirm(`Êtes-vous sûr de vouloir supprimer l'entrée du ${date} ?`)) {
        return;
    }
    
    try {
        // Trouver l'index dans les données complètes
        const realIndex = historyData.findIndex(d => d.date === day.date && d.activeTeam === day.activeTeam);
        
        if (realIndex !== -1) {
            historyData.splice(realIndex, 1);
            await chrome.storage.local.set({ history: historyData });
            
            applyFilters(); // Recharger l'affichage
        }
    } catch (error) {
        console.error('Erreur lors de la suppression:', error);
        alert('Erreur lors de la suppression de l\'entrée.');
    }
}

// Afficher le modal
function showModal() {
    document.getElementById('editModal').classList.add('show');
    document.getElementById('modalOverlay').classList.add('show');
}

// Fermer le modal
function closeModal() {
    document.getElementById('editModal').classList.remove('show');
    document.getElementById('modalOverlay').classList.remove('show');
    currentEditIndex = -1;
}

// Sauvegarder les modifications
async function saveEdit() {
    if (currentEditIndex === -1) return;
    
    const newDate = document.getElementById('editDate').value;
    const newCount = parseInt(document.getElementById('editCount').value);
    const newTeam = document.getElementById('editTeam').value || null;
    
    if (!newDate || isNaN(newCount) || newCount < 0) {
        alert('Veuillez saisir des valeurs valides.');
        return;
    }
    
    try {
        // Mettre à jour l'entrée
        const entry = historyData[currentEditIndex];
        entry.date = new Date(newDate).toDateString();
        entry.count = newCount;
        entry.activeTeam = newTeam;
        
        // Ajuster les timestamps si nécessaire
        if (newCount < entry.timestamps.length) {
            entry.timestamps = entry.timestamps.slice(0, newCount);
        } else if (newCount > entry.timestamps.length) {
            // Ajouter des timestamps fictifs
            const baseTime = entry.timestamps.length > 0 ? entry.timestamps[0] : Date.now();
            while (entry.timestamps.length < newCount) {
                entry.timestamps.push(baseTime + (entry.timestamps.length * 10 * 60 * 1000)); // 10 min d'intervalle
            }
        }
        
        await chrome.storage.local.set({ history: historyData });
        
        closeModal();
        applyFilters(); // Recharger l'affichage
        
    } catch (error) {
        console.error('Erreur lors de la sauvegarde:', error);
        alert('Erreur lors de la sauvegarde des modifications.');
    }
}

// Fonctions d'export et de suppression globale supprimées selon la demande utilisateur

// Fonctions utilitaires

// Formater le temps en millisecondes en texte lisible
function formatTime(milliseconds) {
    if (milliseconds === 0) return '--';
    
    const minutes = Math.floor(milliseconds / (1000 * 60));
    const seconds = Math.floor((milliseconds % (1000 * 60)) / 1000);
    
    if (minutes >= 60) {
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;
        return `${hours}h${remainingMinutes.toString().padStart(2, '0')}`;
    }
    
    return `${minutes}min${seconds.toString().padStart(2, '0')}s`;
}

// Les fonctions sont maintenant utilisées via des event listeners, plus besoin de les rendre globales 