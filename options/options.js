// options.js - Gestion des options et équipes TempoList

document.addEventListener('DOMContentLoaded', async () => {
    await initializeOptions();
    setupEventListeners();
    // setupTabNavigation(); // plus besoin de navigation par onglet
    await loadAutomationConfig();
});

// Variables globales
let teams = [];
let currentEditingTeam = null;
let dailyTarget = 40;

// Initialisation de la page options
async function initializeOptions() {
    try {
        await loadSettings();
        displayTeams();
        updateTargetInput();
    } catch (error) {
        console.error('Erreur d\'initialisation des options:', error);
    }
}

// Configuration des événements
function setupEventListeners() {
    // Gestion des paramètres
    document.getElementById('dailyTarget').addEventListener('input', updateDailyTarget);

    // Mode d'assistance
    document.getElementById('assistModeNone').addEventListener('change', handleAssistModeChange);
    document.getElementById('assistModeNormal').addEventListener('change', handleAssistModeChange);
    document.getElementById('assistModeAdmin').addEventListener('change', handleAssistModeChange);
    
    // Vitesse d'automatisation
    document.getElementById('speedModeFast').addEventListener('change', handleSpeedModeChange);
    document.getElementById('speedModeNormal').addEventListener('change', handleSpeedModeChange);
    document.getElementById('speedModeSlow').addEventListener('change', handleSpeedModeChange);
    
    // === GESTION DU POPUP MODAL DES ÉQUIPES ===
    
    // Bouton pour créer une équipe
    document.getElementById('createTeamBtn').addEventListener('click', openCreateTeamModal);
    
    // Boutons du modal
    document.getElementById('closeModalBtn').addEventListener('click', closeTeamModal);
    document.getElementById('modalCancelBtn').addEventListener('click', closeTeamModal);
    document.getElementById('modalSaveBtn').addEventListener('click', saveTeamFromModal);
    document.getElementById('modalAddScheduleBtn').addEventListener('click', addModalScheduleInput);
    
    // Fermer le modal en cliquant sur l'overlay
    document.getElementById('teamManagementModal').addEventListener('click', (e) => {
        if (e.target.id === 'teamManagementModal') {
            closeTeamModal();
        }
    });
    
    // Échapper pour fermer le modal
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && document.getElementById('teamManagementModal').classList.contains('show')) {
            closeTeamModal();
        }
    });
}

// Fonction pour afficher des notifications modernes
function showNotification(message, type = 'success') {
    const container = document.getElementById('notificationsContainer');
    const template = document.getElementById('notificationTemplate');
    
    if (!container || !template) return;
    
    // Cloner le template
    const notification = template.content.cloneNode(true);
    const notificationElement = notification.querySelector('.notification');
    
    // Configurer la notification
    notificationElement.classList.add(type);
    notification.querySelector('.notification-text').textContent = message;
    
    // Ajouter l'événement de fermeture
    const closeBtn = notification.querySelector('.notification-close');
    closeBtn.addEventListener('click', () => {
        hideNotification(notificationElement);
    });
    
    // Ajouter au container
    container.appendChild(notification);
    
    // Animation d'entrée
    setTimeout(() => {
        notificationElement.classList.add('show');
    }, 10);
    
    // Auto-fermeture après 3 secondes
    setTimeout(() => {
        hideNotification(notificationElement);
    }, 3000);
}

function hideNotification(notificationElement) {
    if (!notificationElement || !notificationElement.parentNode) return;
    
    notificationElement.classList.remove('show');
    notificationElement.classList.add('hide');
    
    setTimeout(() => {
        if (notificationElement.parentNode) {
            notificationElement.parentNode.removeChild(notificationElement);
        }
    }, 300);
}

function handleAssistModeChange() {
    let mode = 'none';
    let modeName = 'Aucun';
    let notificationType = 'warning';
    let message = 'Mode d\'assistance désactivé !';
    
    if (document.getElementById('assistModeAdmin').checked) {
        mode = 'admin';
        modeName = 'SuperEncodeur Admin';
        notificationType = 'success';
        message = 'Mode d\'assistance "SuperEncodeur Admin" activé !';
    } else if (document.getElementById('assistModeNormal').checked) {
        mode = 'normal';
        modeName = 'SuperEncodeur';
        notificationType = 'success';
        message = 'Mode d\'assistance "SuperEncodeur" activé !';
    }
    
    // Mettre à jour le slider animé
    const modernRadioGroup = document.querySelector('.modern-radio-group');
    if (modernRadioGroup) {
        modernRadioGroup.setAttribute('data-value', mode);
    }
    
    // Sauvegarder immédiatement
    chrome.storage.local.set({ assistMode: mode }, () => {
        showNotification(message, notificationType);
    });
}

function handleSpeedModeChange() {
    let speed = 'normal';
    let speedName = 'Normal';
    
    if (document.getElementById('speedModeFast').checked) {
        speed = 'fast';
        speedName = 'Rapide';
    } else if (document.getElementById('speedModeSlow').checked) {
        speed = 'slow';
        speedName = 'Lent';
    }
    
    // Mettre à jour le slider animé - utiliser un sélecteur plus spécifique
    const speedRadioGroups = document.querySelectorAll('.modern-radio-group');
    const speedRadioGroup = speedRadioGroups[1]; // Le deuxième groupe radio (vitesse)
    if (speedRadioGroup) {
        speedRadioGroup.setAttribute('data-value', speed);
    }
    
    // Appliquer et sauvegarder la configuration
    applyPreset(speed);
    chrome.storage.sync.set({ automationConfig: { ...SPEED_PRESETS[speed] } }, () => {
        showNotification(`Vitesse d'automatisation "${speedName}" sélectionnée !`, 'success');
    });
    currentAutomationConfig = { ...SPEED_PRESETS[speed] };
}

// Charger les paramètres depuis le stockage
async function loadSettings() {
    const result = await chrome.storage.local.get(['teams', 'dailyTarget', 'assistMode']);
    
    teams = result.teams || [];
    dailyTarget = result.dailyTarget || 40;
    // Charger le mode assist
    const mode = result.assistMode || 'none';
    if (mode === 'admin') {
        document.getElementById('assistModeAdmin').checked = true;
    } else if (mode === 'normal') {
        document.getElementById('assistModeNormal').checked = true;
    } else {
        document.getElementById('assistModeNone').checked = true;
    }
    
    // Mettre à jour le slider animé
    const modernRadioGroup = document.querySelector('.modern-radio-group');
    if (modernRadioGroup) {
        modernRadioGroup.setAttribute('data-value', mode);
    }
}

// Mettre à jour l'input de l'objectif
function updateTargetInput() {
    document.getElementById('dailyTarget').value = dailyTarget;
}

// Ajouter un nouveau créneau horaire (pour l'ancien formulaire - plus utilisé)
function addScheduleInput() {
    const template = document.getElementById('scheduleTemplate');
    const clone = template.content.cloneNode(true);
    
    // Ajouter l'événement de suppression
    const removeBtn = clone.querySelector('.remove-schedule-btn');
    removeBtn.addEventListener('click', function() {
        this.closest('.schedule-item').remove();
    });
    
    document.getElementById('schedulesList').appendChild(clone);
}

// === NOUVELLES FONCTIONS POUR LE POPUP MODAL ===

// Ajouter un nouveau créneau horaire dans le modal
function addModalScheduleInput() {
    const template = document.getElementById('scheduleTemplate');
    const clone = template.content.cloneNode(true);
    
    // Ajouter l'événement de suppression
    const removeBtn = clone.querySelector('.remove-schedule-btn');
    removeBtn.addEventListener('click', function() {
        this.closest('.schedule-item').remove();
    });
    
    document.getElementById('modalSchedulesList').appendChild(clone);
}

// Ouvrir le modal pour créer une nouvelle équipe
function openCreateTeamModal() {
    currentEditingTeam = null;
    document.getElementById('modalTitle').innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" class="bi bi-people" viewBox="0 0 16 16">
          <path d="M15 14s1 0 1-1-1-4-5-4-5 3-5 4 1 1 1 1zm-7.978-1L7 12.996c.001-.264.167-1.03.76-1.72C8.312 10.629 9.282 10 11 10c1.717 0 2.687.63 3.24 1.276.593.69.758 1.457.76 1.72l-.008.002-.014.002zM11 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4m3-2a3 3 0 1 1-6 0 3 3 0 0 1 6 0M6.936 9.28a6 6 0 0 0-1.23-.247A7 7 0 0 0 5 9c-4 0-5 3-5 4q0 1 1 1h4.216A2.24 2.24 0 0 1 5 13c0-1.01.377-2.042 1.09-2.904.243-.294.526-.569.846-.816M4.92 10A5.5 5.5 0 0 0 4 13H1c0-.26.164-1.03.76-1.724.545-.636 1.492-1.256 3.16-1.275ZM1.5 5.5a3 3 0 1 1 6 0 3 3 0 0 1-6 0m3-2a2 2 0 1 0 0 4 2 2 0 0 0 0-4"/>
        </svg>
        Créer une équipe
    `;
    
    resetModalForm();
    showTeamModal();
}

// Ouvrir le modal pour éditer une équipe existante
function openEditTeamModal(team) {
    currentEditingTeam = team;
    document.getElementById('modalTitle').innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" class="bi bi-pencil-square" viewBox="0 0 16 16">
          <path d="M15.502 1.94a.5.5 0 0 1 0 .706L14.459 3.69l-2-2L13.502.646a.5.5 0 0 1 .707 0l1.293 1.293zm-1.75 2.456-2-2L4.939 9.21a.5.5 0 0 0-.121.196l-.805 2.414a.25.25 0 0 0 .316.316l2.414-.805a.5.5 0 0 0 .196-.12l6.813-6.814z"/>
          <path fill-rule="evenodd" d="M1 13.5A1.5 1.5 0 0 0 2.5 15h11a1.5 1.5 0 0 0 1.5-1.5v-6a.5.5 0 0 0-1 0v6a.5.5 0 0 1-.5.5h-11a.5.5 0 0 1-.5-.5v-11a.5.5 0 0 1 .5-.5H9a.5.5 0 0 0 0-1H2.5A1.5 1.5 0 0 0 1 2.5z"/>
        </svg>
        Modifier l'équipe
    `;
    
    // Remplir le formulaire avec les données de l'équipe
    document.getElementById('modalTeamName').value = team.name;
    
    // Vider et remplir les horaires
    document.getElementById('modalSchedulesList').innerHTML = '';
    
    team.schedules.forEach(schedule => {
        addModalScheduleInput();
        const scheduleItems = document.querySelectorAll('#modalSchedulesList .schedule-item');
        const lastItem = scheduleItems[scheduleItems.length - 1];
        
        lastItem.querySelector('.start-time').value = schedule.start;
        lastItem.querySelector('.end-time').value = schedule.end;
    });
    
    showTeamModal();
}

// Afficher le modal
function showTeamModal() {
    const modal = document.getElementById('teamManagementModal');
    modal.classList.add('show');
    
    // Focus sur le champ nom d'équipe
    setTimeout(() => {
        document.getElementById('modalTeamName').focus();
    }, 300);
}

// Fermer le modal
function closeTeamModal() {
    const modal = document.getElementById('teamManagementModal');
    modal.classList.remove('show');
    currentEditingTeam = null;
}

// Réinitialiser le formulaire du modal
function resetModalForm() {
    document.getElementById('modalTeamName').value = '';
    document.getElementById('modalSchedulesList').innerHTML = '';
    addModalScheduleInput(); // Ajouter un créneau par défaut
}

// Sauvegarder l'équipe depuis le modal
async function saveTeamFromModal() {
    const teamName = document.getElementById('modalTeamName').value.trim();
    
    if (!teamName) {
        showNotification('Veuillez saisir un nom d\'équipe.', 'warning');
        return;
    }
    
    // Récupérer les horaires
    const schedules = [];
    const scheduleItems = document.querySelectorAll('#modalSchedulesList .schedule-item');
    
    for (const item of scheduleItems) {
        const startTime = item.querySelector('.start-time').value;
        const endTime = item.querySelector('.end-time').value;
        
        if (startTime && endTime) {
            if (startTime >= endTime) {
                showNotification('L\'heure de fin doit être après l\'heure de début.', 'warning');
                return;
            }
            schedules.push({ start: startTime, end: endTime });
        }
    }
    
    if (schedules.length === 0) {
        showNotification('Veuillez ajouter au moins un créneau horaire.', 'warning');
        return;
    }
    
    // Vérifier si l'équipe existe déjà (pour l'édition)
    let team;
    let actionMessage;
    
    if (currentEditingTeam) {
        team = currentEditingTeam;
        team.name = teamName;
        team.schedules = schedules;
        actionMessage = 'Équipe modifiée avec succès !';
    } else {
        // Nouvelle équipe
        team = {
            id: generateTeamId(),
            name: teamName,
            schedules: schedules
        };
        teams.push(team);
        actionMessage = 'Équipe créée avec succès !';
    }
    
    try {
        await chrome.storage.local.set({ teams: teams });
        showNotification(actionMessage, 'success');
        
        // Mettre à jour l'affichage des équipes
        displayTeams();
        
        // Fermer le modal
        closeTeamModal();
        
    } catch (error) {
        console.error('Erreur lors de la sauvegarde:', error);
        showNotification('Erreur lors de la sauvegarde.', 'warning');
    }
}

// FONCTION OBSOLÈTE - Sauvegarder une équipe (remplacée par saveTeamFromModal)
// async function saveTeam() { ... }

// Générer un ID unique pour une équipe
function generateTeamId() {
    return 'team_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// FONCTIONS OBSOLÈTES - Remplacées par les fonctions du modal
// function resetTeamForm() { ... }
// function cancelEdit() { ... }

// Afficher les équipes existantes
function displayTeams() {
    const teamsList = document.getElementById('teamsList');
    
    if (teams.length === 0) {
        teamsList.innerHTML = '<p class="no-teams">Aucune équipe configurée</p>';
        return;
    }
    
    teamsList.innerHTML = '';
    
    teams.forEach(team => {
        const teamCard = createTeamCard(team);
        teamsList.appendChild(teamCard);
    });
}

// Créer une carte d'équipe
function createTeamCard(team) {
    const template = document.getElementById('teamDisplayTemplate');
    const clone = template.content.cloneNode(true);
    
    // Remplir les informations
    clone.querySelector('.team-name').textContent = team.name;
    
    // Ajouter les horaires
    const schedulesContainer = clone.querySelector('.team-schedules');
    team.schedules.forEach(schedule => {
        const scheduleDiv = document.createElement('div');
        scheduleDiv.className = 'schedule-display';
        scheduleDiv.textContent = `${schedule.start} - ${schedule.end}`;
        schedulesContainer.appendChild(scheduleDiv);
    });
    
    // Ajouter les événements
    const editBtn = clone.querySelector('.edit-team-btn');
    editBtn.addEventListener('click', () => openEditTeamModal(team));
    
    const deleteBtn = clone.querySelector('.delete-team-btn');
    deleteBtn.addEventListener('click', () => deleteTeam(team));
    
    return clone;
}

// FONCTION OBSOLÈTE - Éditer une équipe (remplacée par openEditTeamModal)
// function editTeam(team) { ... }

// Supprimer une équipe
async function deleteTeam(team) {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer l'équipe "${team.name}" ?`)) {
        return;
    }
    
    try {
        teams = teams.filter(t => t.id !== team.id);
        await chrome.storage.local.set({ teams: teams });
        
        showMessage('Équipe supprimée avec succès !', 'success');
        displayTeams();
        
        // Si c'était l'équipe en cours d'édition, réinitialiser la variable
        if (currentEditingTeam && currentEditingTeam.id === team.id) {
            currentEditingTeam = null;
        }
        
    } catch (error) {
        console.error('Erreur lors de la suppression:', error);
        showMessage('Erreur lors de la suppression.', 'error');
    }
}

// Mettre à jour l'objectif journalier
function updateDailyTarget() {
    const newTarget = parseInt(document.getElementById('dailyTarget').value, 10) || 40;
    dailyTarget = newTarget;
    
    // Sauvegarde automatique avec notification
    chrome.storage.local.set({ dailyTarget }, () => {
        showNotification(`Objectif journalier mis à jour : ${dailyTarget} listes`, 'success');
    });
}

// FONCTION OBSOLÈTE - Sauvegarder tous les paramètres (remplacée par la sauvegarde automatique)
// async function saveAllSettings() { ... }

// Afficher un message
function showMessage(text, type) {
    const messageDiv = document.getElementById('message');
    messageDiv.textContent = text;
    messageDiv.className = `message ${type}`;
    
    // Faire disparaître le message après 3 secondes
    setTimeout(() => {
        messageDiv.style.display = 'none';
        setTimeout(() => {
            messageDiv.className = 'message';
            messageDiv.style.display = 'block';
        }, 300);
    }, 3000);
}

// Fonctions utilitaires

// Valider un format d'heure
function isValidTime(timeStr) {
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    return timeRegex.test(timeStr);
}

// Convertir l'heure en minutes pour comparaison
function timeToMinutes(timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
}

// === GESTION DES ONGLETS ===

function setupTabNavigation() {
    const tabButtons = document.querySelectorAll('.tab-button');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            const targetTab = e.currentTarget.dataset.tab;
            switchTab(targetTab);
        });
    });
}

function switchTab(tabName) {
    // Désactiver tous les onglets
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    // Activer l'onglet sélectionné
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    document.getElementById(`${tabName}-tab`).classList.add('active');
}

// === GESTION DE L'AUTOMATISATION ===

const SPEED_PRESETS = {
    fast: {
        delayBetweenActions: 100,
        delayBetweenCycles: 400
    },
    normal: {
        delayBetweenActions: 200,
        delayBetweenCycles: 800
    },
    slow: {
        delayBetweenActions: 500,
        delayBetweenCycles: 1500
    }
};

let currentAutomationConfig = { ...SPEED_PRESETS.normal };

async function loadAutomationConfig() {
    try {
        const result = await chrome.storage.sync.get('automationConfig');
        if (result.automationConfig) {
            currentAutomationConfig = result.automationConfig;
        }
        updateAutomationUI();
        // setupAutomationEventListeners(); // plus besoin car géré dans setupEventListeners
    } catch (error) {
        console.error('Erreur lors du chargement de la configuration d\'automatisation:', error);
    }
}

function updateAutomationUI() {
    // Met à jour l'état actif des boutons radio
    const activePreset = detectActivePreset();
    
    // Cocher le bon radio button
    if (activePreset === 'fast') {
        document.getElementById('speedModeFast').checked = true;
    } else if (activePreset === 'slow') {
        document.getElementById('speedModeSlow').checked = true;
    } else {
        document.getElementById('speedModeNormal').checked = true;
    }
    
    // Mettre à jour le slider animé - utiliser un sélecteur plus spécifique
    const speedRadioGroups = document.querySelectorAll('.modern-radio-group');
    const speedRadioGroup = speedRadioGroups[1]; // Le deuxième groupe radio (vitesse)
    if (speedRadioGroup) {
        speedRadioGroup.setAttribute('data-value', activePreset || 'normal');
    }
}

function detectActivePreset() {
    for (const [presetName, presetValues] of Object.entries(SPEED_PRESETS)) {
        if (presetValues.delayBetweenActions === currentAutomationConfig.delayBetweenActions &&
            presetValues.delayBetweenCycles === currentAutomationConfig.delayBetweenCycles) {
            return presetName;
        }
    }
    return 'normal'; // Par défaut
}

function applyPreset(presetName) {
    if (SPEED_PRESETS[presetName]) {
        currentAutomationConfig = { ...SPEED_PRESETS[presetName] };
        updateAutomationUI();
    }
} 