// options.js - Gestion des options et équipes TempoList

document.addEventListener('DOMContentLoaded', async () => {
    await initializeOptions();
    setupEventListeners();
    setupTabNavigation();
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
    // Gestion des équipes
    document.getElementById('addScheduleBtn').addEventListener('click', addScheduleInput);
    document.getElementById('saveTeamBtn').addEventListener('click', saveTeam);
    document.getElementById('cancelEditBtn').addEventListener('click', cancelEdit);
    
    // Gestion des paramètres
    document.getElementById('dailyTarget').addEventListener('input', updateDailyTarget);
    document.getElementById('saveSettingsBtn').addEventListener('click', saveAllSettings);
    
    // Navigation
    document.getElementById('backToPopupBtn').addEventListener('click', () => {
        window.close();
    });
    
    // Ajouter un premier créneau par défaut
    addScheduleInput();

    document.getElementById('assistModeNone').addEventListener('change', handleAssistModeChange);
    document.getElementById('assistModeNormal').addEventListener('change', handleAssistModeChange);
    document.getElementById('assistModeAdmin').addEventListener('change', handleAssistModeChange);
}

function handleAssistModeChange() {
    let mode = 'none';
    if (document.getElementById('assistModeAdmin').checked) mode = 'admin';
    else if (document.getElementById('assistModeNormal').checked) mode = 'normal';
    // Sauvegarder immédiatement
    chrome.storage.local.set({ assistMode: mode }, () => {
        // Optionnel : afficher un message ou recharger la page si besoin
    });
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
}

// Mettre à jour l'input de l'objectif
function updateTargetInput() {
    document.getElementById('dailyTarget').value = dailyTarget;
}

// Ajouter un nouveau créneau horaire
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

// Sauvegarder une équipe
async function saveTeam() {
    const teamName = document.getElementById('teamName').value.trim();
    
    if (!teamName) {
        showMessage('Veuillez saisir un nom d\'équipe.', 'error');
        return;
    }
    
    // Récupérer les horaires
    const schedules = [];
    const scheduleItems = document.querySelectorAll('#schedulesList .schedule-item');
    
    for (const item of scheduleItems) {
        const startTime = item.querySelector('.start-time').value;
        const endTime = item.querySelector('.end-time').value;
        
        if (startTime && endTime) {
            if (startTime >= endTime) {
                showMessage('L\'heure de fin doit être après l\'heure de début.', 'error');
                return;
            }
            schedules.push({ start: startTime, end: endTime });
        }
    }
    
    if (schedules.length === 0) {
        showMessage('Veuillez ajouter au moins un créneau horaire.', 'error');
        return;
    }
    
    // Vérifier si l'équipe existe déjà (pour l'édition)
    let team;
    if (currentEditingTeam) {
        team = currentEditingTeam;
        team.name = teamName;
        team.schedules = schedules;
    } else {
        // Nouvelle équipe
        team = {
            id: generateTeamId(),
            name: teamName,
            schedules: schedules
        };
        teams.push(team);
    }
    
    try {
        await chrome.storage.local.set({ teams: teams });
        showMessage('Équipe sauvegardée avec succès !', 'success');
        
        // Réinitialiser le formulaire
        resetTeamForm();
        displayTeams();
        
    } catch (error) {
        console.error('Erreur lors de la sauvegarde:', error);
        showMessage('Erreur lors de la sauvegarde.', 'error');
    }
}

// Générer un ID unique pour une équipe
function generateTeamId() {
    return 'team_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Réinitialiser le formulaire d'équipe
function resetTeamForm() {
    document.getElementById('teamName').value = '';
    document.getElementById('schedulesList').innerHTML = '';
    addScheduleInput();
    
    currentEditingTeam = null;
    document.getElementById('cancelEditBtn').style.display = 'none';
    
    const saveBtn = document.getElementById('saveTeamBtn');
    saveBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-floppy2-fill" viewBox="0 0 16 16">
          <path d="M12 2h-2v3h2z"/>
          <path d="M1.5 0A1.5 1.5 0 0 0 0 1.5v13A1.5 1.5 0 0 0 1.5 16h13a1.5 1.5 0 0 0 1.5-1.5V2.914a1.5 1.5 0 0 0-.44-1.06L14.147.439A1.5 1.5 0 0 0 13.086 0zM4 6a1 1 0 0 1-1-1V1h10v4a1 1 0 0 1-1 1zM3 9h10a1 1 0 0 1 1 1v5H2v-5a1 1 0 0 1 1-1"/>
        </svg>
        Sauvegarder l'équipe
    `;
}

// Annuler l'édition
function cancelEdit() {
    resetTeamForm();
}

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
    editBtn.addEventListener('click', () => editTeam(team));
    
    const deleteBtn = clone.querySelector('.delete-team-btn');
    deleteBtn.addEventListener('click', () => deleteTeam(team));
    
    return clone;
}

// Éditer une équipe
function editTeam(team) {
    currentEditingTeam = team;
    
    // Remplir le formulaire
    document.getElementById('teamName').value = team.name;
    
    // Vider et remplir les horaires
    document.getElementById('schedulesList').innerHTML = '';
    
    team.schedules.forEach(schedule => {
        addScheduleInput();
        const scheduleItems = document.querySelectorAll('#schedulesList .schedule-item');
        const lastItem = scheduleItems[scheduleItems.length - 1];
        
        lastItem.querySelector('.start-time').value = schedule.start;
        lastItem.querySelector('.end-time').value = schedule.end;
    });
    
    // Modifier l'interface
    document.getElementById('cancelEditBtn').style.display = 'inline-block';
    
    const saveBtn = document.getElementById('saveTeamBtn');
    saveBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-pencil-square" viewBox="0 0 16 16">
          <path d="M15.502 1.94a.5.5 0 0 1 0 .706L14.459 3.69l-2-2L13.502.646a.5.5 0 0 1 .707 0l1.293 1.293zm-1.75 2.456-2-2L4.939 9.21a.5.5 0 0 0-.121.196l-.805 2.414a.25.25 0 0 0 .316.316l2.414-.805a.5.5 0 0 0 .196-.12l6.813-6.814z"/>
          <path fill-rule="evenodd" d="M1 13.5A1.5 1.5 0 0 0 2.5 15h11a1.5 1.5 0 0 0 1.5-1.5v-6a.5.5 0 0 0-1 0v6a.5.5 0 0 1-.5.5h-11a.5.5 0 0 1-.5-.5v-11a.5.5 0 0 1 .5-.5H9a.5.5 0 0 0 0-1H2.5A1.5 1.5 0 0 0 1 2.5z"/>
        </svg>
        Modifier l'équipe
    `;
    
    // Faire défiler vers le formulaire
    document.querySelector('.team-form').scrollIntoView({ behavior: 'smooth' });
}

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
        
        // Si c'était l'équipe en cours d'édition, réinitialiser le formulaire
        if (currentEditingTeam && currentEditingTeam.id === team.id) {
            resetTeamForm();
        }
        
    } catch (error) {
        console.error('Erreur lors de la suppression:', error);
        showMessage('Erreur lors de la suppression.', 'error');
    }
}

// Mettre à jour l'objectif journalier
function updateDailyTarget() {
    const value = parseInt(document.getElementById('dailyTarget').value);
    if (value && value > 0) {
        dailyTarget = value;
    }
}

// Sauvegarder tous les paramètres
async function saveAllSettings() {
    dailyTarget = parseInt(document.getElementById('dailyTarget').value, 10) || 40;
    await chrome.storage.local.set({ dailyTarget });
    showMessage('Paramètres sauvegardés !', 'success');
}

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

// Préréglages de vitesse
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

let currentAutomationConfig = {
    delayBetweenActions: 200,
    delayBetweenCycles: 800
};

async function loadAutomationConfig() {
    try {
        const result = await chrome.storage.sync.get('automationConfig');
        if (result.automationConfig) {
            currentAutomationConfig = result.automationConfig;
        }
        
        // Mettre à jour l'interface
        updateAutomationUI();
        setupAutomationEventListeners();
        
    } catch (error) {
        console.error('Erreur lors du chargement de la configuration d\'automatisation:', error);
    }
}

function setupAutomationEventListeners() {
    // Préréglages
    document.querySelectorAll('.preset-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const preset = e.currentTarget.dataset.preset;
            applyPreset(preset);
        });
    });
    
    // Sauvegarde
    document.getElementById('saveAutomationBtn').addEventListener('click', saveAutomationConfig);
    
    // Réinitialisation
    document.getElementById('resetAutomationBtn').addEventListener('click', resetAutomationConfig);
    
    // Mise à jour en temps réel des inputs
    document.getElementById('delayBetweenActions').addEventListener('input', updateConfigFromInputs);
    document.getElementById('delayBetweenCycles').addEventListener('input', updateConfigFromInputs);
}

function updateAutomationUI() {
    // Mettre à jour les inputs
    document.getElementById('delayBetweenActions').value = currentAutomationConfig.delayBetweenActions;
    document.getElementById('delayBetweenCycles').value = currentAutomationConfig.delayBetweenCycles;
    
    // Détecter et marquer le préréglage actuel
    const activePreset = detectActivePreset();
    updatePresetButtons(activePreset);
}

function detectActivePreset() {
    for (const [presetName, presetValues] of Object.entries(SPEED_PRESETS)) {
        if (presetValues.delayBetweenActions === currentAutomationConfig.delayBetweenActions &&
            presetValues.delayBetweenCycles === currentAutomationConfig.delayBetweenCycles) {
            return presetName;
        }
    }
    return null; // Configuration personnalisée
}

function updatePresetButtons(activePreset) {
    document.querySelectorAll('.preset-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.preset === activePreset) {
            btn.classList.add('active');
        }
    });
}

function applyPreset(presetName) {
    if (SPEED_PRESETS[presetName]) {
        currentAutomationConfig = { ...SPEED_PRESETS[presetName] };
        updateAutomationUI();
    }
}

function updateConfigFromInputs() {
    const delayBetweenActions = parseInt(document.getElementById('delayBetweenActions').value);
    const delayBetweenCycles = parseInt(document.getElementById('delayBetweenCycles').value);
    
    currentAutomationConfig.delayBetweenActions = delayBetweenActions;
    currentAutomationConfig.delayBetweenCycles = delayBetweenCycles;
    
    // Mettre à jour les boutons de préréglage
    const activePreset = detectActivePreset();
    updatePresetButtons(activePreset);
}

async function saveAutomationConfig() {
    try {
        await chrome.storage.sync.set({ automationConfig: currentAutomationConfig });
        showMessage('Configuration d\'automatisation sauvegardée avec succès !', 'success');
    } catch (error) {
        console.error('Erreur lors de la sauvegarde:', error);
        showMessage('Erreur lors de la sauvegarde de la configuration.', 'error');
    }
}

async function resetAutomationConfig() {
    if (confirm('Êtes-vous sûr de vouloir réinitialiser la configuration d\'automatisation ?')) {
        currentAutomationConfig = { ...SPEED_PRESETS.normal };
        updateAutomationUI();
        showMessage('Configuration réinitialisée aux valeurs par défaut.', 'success');
    }
} 

function updateAssistModeUI() {
    const modeNormal = document.getElementById('assistModeNormal').checked;
    const modeAdmin = document.getElementById('assistModeAdmin').checked;
    // Si aucun mode n'est sélectionné, on désactive la case à cocher
    document.getElementById('showAssistColumn').disabled = !(modeNormal || modeAdmin);
    // Si la case est décochée, on ne sauvegarde pas le mode
    if (!document.getElementById('showAssistColumn').checked) return;
    // Sauvegarder le mode dans le storage
    let mode = 'normal';
    if (modeAdmin) mode = 'admin';
    chrome.storage.local.set({ assistMode: mode });
} 