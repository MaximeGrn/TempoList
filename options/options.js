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

// Variables pour le filtrage par date
let selectedFilterDate = null; // null = toutes les dates
let currentCalendarDate = new Date(); // Date affichée dans le calendrier
let dateFilterMode = 'all'; // 'all' ou 'specific'

// Initialisation de la page options
async function initializeOptions() {
    try {
        await loadSettings();
        await loadAttachmentExtensionsConfig();
        await loadSubjectCompletionConfig();
    await loadAutomaticValidationConfig();
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
    
    // Statistiques encodeurs
    document.getElementById('enableEncoderStats').addEventListener('change', handleEncoderStatsChange);
    document.getElementById('enableTableStats').addEventListener('change', handleTableStatsChange);
    document.getElementById('viewStatsBtn').addEventListener('click', openStatsModal);
    document.getElementById('closeStatsBtn').addEventListener('click', closeStatsModal);
    
    // Extensions de pièces jointes
    document.getElementById('enableAttachmentExtensions').addEventListener('change', handleAttachmentExtensionsChange);
    
    // Complétion des matières
    document.getElementById('enableSubjectCompletion').addEventListener('change', handleSubjectCompletionChange);
    
    // Validation automatique
    document.getElementById('enableAutomaticValidation').addEventListener('change', handleAutomaticValidationChange);
    

    document.getElementById('viewDataBtn').addEventListener('click', openDataViewer);
    document.getElementById('dateFilterBtn').addEventListener('click', openDatePicker);
    document.getElementById('resetStatsBtn').addEventListener('click', resetAllStats);
    
    // Modal de sélection de date
    document.getElementById('closeDatePickerBtn').addEventListener('click', closeDatePicker);
    document.getElementById('cancelDatePickerBtn').addEventListener('click', closeDatePicker);
    document.getElementById('applyDateFilterBtn').addEventListener('click', applyDateFilter);
    document.getElementById('showAllDatesBtn').addEventListener('click', () => toggleDateFilterMode('all'));
    document.getElementById('selectSpecificDateBtn').addEventListener('click', () => toggleDateFilterMode('specific'));
    document.getElementById('prevMonthBtn').addEventListener('click', () => navigateMonth(-1));
    document.getElementById('nextMonthBtn').addEventListener('click', () => navigateMonth(1));
    
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
    
    // Gérer l'état des switches selon le mode d'assistance
    const isAssistEnabled = mode !== 'none';
    setSwitchEnabled('enableEncoderStats', isAssistEnabled);
    setSwitchEnabled('enableTableStats', isAssistEnabled);
    setSwitchEnabled('enableSubjectCompletion', isAssistEnabled);
    setSwitchEnabled('enableAutomaticValidation', isAssistEnabled);
    
    // Si le mode d'assistance est désactivé, désactiver aussi les switches
    if (!isAssistEnabled) {
        if (document.getElementById('enableEncoderStats').checked) {
            document.getElementById('enableEncoderStats').checked = false;
            updateSwitchAppearance('enableEncoderStats', false);
            chrome.storage.local.set({ enableEncoderStats: false });
        }
        if (document.getElementById('enableTableStats').checked) {
            document.getElementById('enableTableStats').checked = false;
            updateSwitchAppearance('enableTableStats', false);
            chrome.storage.local.set({ enableTableStats: false });
        }
        if (document.getElementById('enableSubjectCompletion').checked) {
            document.getElementById('enableSubjectCompletion').checked = false;
            updateSwitchAppearance('enableSubjectCompletion', false);
            chrome.storage.local.set({ subjectCompletionEnabled: false });
        }
        if (document.getElementById('enableAutomaticValidation').checked) {
            document.getElementById('enableAutomaticValidation').checked = false;
            updateSwitchAppearance('enableAutomaticValidation', false);
            chrome.storage.local.set({ automaticValidationEnabled: false });
        }
        // Cacher l'option du tableau des stats
        document.getElementById('tableStatsOption').classList.add('hidden');
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

// Fonctions utilitaires pour les checkboxes iOS (remplace les switches)
function updateSwitchAppearance(switchId, isChecked) {
    const switchInput = document.getElementById(switchId);
    if (switchInput) {
        switchInput.checked = isChecked;
    }
}

function setSwitchEnabled(switchId, isEnabled) {
    const switchElement = document.getElementById(switchId + 'Switch');
    const switchInput = document.getElementById(switchId);
    
    if (isEnabled) {
        if (switchElement) switchElement.classList.remove('disabled');
        if (switchInput) switchInput.disabled = false;
    } else {
        if (switchElement) switchElement.classList.add('disabled');
        if (switchInput) switchInput.disabled = true;
    }
}

function handleEncoderStatsChange() {
    const isEnabled = document.getElementById('enableEncoderStats').checked;
    const tableStatsOption = document.getElementById('tableStatsOption');
    const message = isEnabled ? 'Statistiques encodeurs activées !' : 'Statistiques encodeurs désactivées !';
    const notificationType = isEnabled ? 'success' : 'warning';
    
    // Mettre à jour l'apparence du switch
    updateSwitchAppearance('enableEncoderStats', isEnabled);
    
    // Afficher/cacher l'option des stats dans le tableau selon l'activation des stats générales
    if (isEnabled) {
        tableStatsOption.classList.remove('hidden');
    } else {
        tableStatsOption.classList.add('hidden');
        // Désactiver aussi les stats du tableau si les stats générales sont désactivées
        document.getElementById('enableTableStats').checked = false;
        updateSwitchAppearance('enableTableStats', false);
        chrome.storage.local.set({ enableTableStats: false });
    }
    
    // Sauvegarder immédiatement
    chrome.storage.local.set({ enableEncoderStats: isEnabled }, () => {
        showNotification(message, notificationType);
    });
}

// Gestion des statistiques dans les listes à valider
function handleTableStatsChange() {
    const isEnabled = document.getElementById('enableTableStats').checked;
    const message = isEnabled ? 'Affichage dans les listes à valider activé !' : 'Affichage dans les listes à valider désactivé !';
    const notificationType = isEnabled ? 'success' : 'info';
    
    // Mettre à jour l'apparence du switch
    updateSwitchAppearance('enableTableStats', isEnabled);
    
    chrome.storage.local.set({ enableTableStats: isEnabled }, () => {
        showNotification(message, notificationType);
    });
}

// ========================================
// GESTION DES EXTENSIONS DE PIÈCES JOINTES
// ========================================

// Gestion de l'affichage des extensions de pièces jointes
function handleAttachmentExtensionsChange() {
    const isEnabled = document.getElementById('enableAttachmentExtensions').checked;
    const message = isEnabled ? 'Affichage des extensions de PJ activé !' : 'Affichage des extensions de PJ désactivé !';
    const notificationType = isEnabled ? 'success' : 'info';
    
    // Sauvegarder immédiatement
    const config = { enabled: isEnabled };
    chrome.storage.sync.set({ attachmentExtensionsConfig: config }, () => {
        showNotification(message, notificationType);
        
        // Envoyer un message aux content scripts pour mettre à jour la fonctionnalité
        chrome.tabs.query({ url: "*://crealiste.com/*" }, (tabs) => {
            tabs.forEach(tab => {
                chrome.tabs.sendMessage(tab.id, {
                    action: 'updateAttachmentExtensions',
                    config: config
                }).catch(() => {
                    // Ignorer les erreurs si l'onglet n'est pas prêt
                });
            });
        });
    });
}

// Charger la configuration des extensions de PJ
async function loadAttachmentExtensionsConfig() {
    try {
        const result = await chrome.storage.sync.get('attachmentExtensionsConfig');
        const config = result.attachmentExtensionsConfig || { enabled: true };
        
        const checkbox = document.getElementById('enableAttachmentExtensions');
        if (checkbox) {
            checkbox.checked = config.enabled;
        }
    } catch (error) {
        console.error('Erreur lors du chargement de la configuration des extensions de PJ:', error);
    }
}

// ========================================
// GESTION DE LA COMPLÉTION DES MATIÈRES
// ========================================

// Gestion de l'affichage du pourcentage de complétion des matières
function handleSubjectCompletionChange() {
    const isEnabled = document.getElementById('enableSubjectCompletion').checked;
    const message = isEnabled ? 'Affichage % de complétion des matières activé !' : 'Affichage % de complétion des matières désactivé !';
    const notificationType = isEnabled ? 'success' : 'info';
    
    // Sauvegarder immédiatement
    chrome.storage.local.set({ subjectCompletionEnabled: isEnabled }, () => {
        showNotification(message, notificationType);
        
        // Envoyer un message aux content scripts pour mettre à jour la fonctionnalité
        chrome.tabs.query({ url: "*://crealiste.com/*" }, (tabs) => {
            tabs.forEach(tab => {
                chrome.tabs.sendMessage(tab.id, {
                    action: 'updateSubjectCompletion',
                    config: { enabled: isEnabled }
                }).catch(() => {
                    // Ignorer les erreurs si l'onglet n'est pas prêt
                });
            });
        });
    });
}

// Charger la configuration de la complétion des matières
async function loadSubjectCompletionConfig() {
    try {
        const result = await chrome.storage.local.get('subjectCompletionEnabled');
        const isEnabled = result.subjectCompletionEnabled !== false; // true par défaut
        
        const checkbox = document.getElementById('enableSubjectCompletion');
        if (checkbox) {
            checkbox.checked = isEnabled;
        }
    } catch (error) {
        console.error('Erreur lors du chargement de la configuration de la complétion des matières:', error);
    }
}

// ========================================
// GESTION DE LA VALIDATION AUTOMATIQUE
// ========================================

// Gestion de la validation automatique des listes avec options
function handleAutomaticValidationChange() {
    const isEnabled = document.getElementById('enableAutomaticValidation').checked;
    const message = isEnabled ? 'Validation automatique des listes activée !' : 'Validation automatique des listes désactivée !';
    const notificationType = isEnabled ? 'success' : 'info';
    
    // Sauvegarder immédiatement
    chrome.storage.local.set({ automaticValidationEnabled: isEnabled }, () => {
        showNotification(message, notificationType);
        
        // Envoyer un message aux content scripts pour mettre à jour la fonctionnalité
        chrome.tabs.query({ url: "*://crealiste.com/*" }, (tabs) => {
            tabs.forEach(tab => {
                chrome.tabs.sendMessage(tab.id, {
                    action: 'updateAutomaticValidation',
                    config: { enabled: isEnabled }
                }).catch(() => {
                    // Ignorer les erreurs si l'onglet n'est pas prêt
                });
            });
        });
    });
}

// Charger la configuration de la validation automatique
async function loadAutomaticValidationConfig() {
    try {
        const result = await chrome.storage.local.get('automaticValidationEnabled');
        const isEnabled = result.automaticValidationEnabled !== false; // true par défaut
        
        const checkbox = document.getElementById('enableAutomaticValidation');
        if (checkbox) {
            checkbox.checked = isEnabled;
        }
    } catch (error) {
        console.error('Erreur lors du chargement de la configuration de la validation automatique:', error);
    }
}

// Charger les paramètres depuis le stockage
async function loadSettings() {
    const result = await chrome.storage.local.get(['teams', 'dailyTarget', 'assistMode', 'enableEncoderStats', 'enableTableStats']);
    
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
    
    // Charger les statistiques encodeurs
    const isEncoderStatsEnabled = result.enableEncoderStats || false;
    document.getElementById('enableEncoderStats').checked = isEncoderStatsEnabled;
    updateSwitchAppearance('enableEncoderStats', isEncoderStatsEnabled);
    
    // Charger l'option d'affichage dans les listes à valider
    const isTableStatsEnabled = result.enableTableStats || false;
    document.getElementById('enableTableStats').checked = isTableStatsEnabled;
    updateSwitchAppearance('enableTableStats', isTableStatsEnabled);
    
    // Gérer l'état des switches selon le mode d'assistance
    const isAssistEnabled = mode !== 'none';
    setSwitchEnabled('enableEncoderStats', isAssistEnabled);
    setSwitchEnabled('enableTableStats', isAssistEnabled);
    setSwitchEnabled('enableSubjectCompletion', isAssistEnabled);
    setSwitchEnabled('enableAutomaticValidation', isAssistEnabled);
    
    // Afficher/cacher l'option tableau selon l'activation des stats générales
    const tableStatsOption = document.getElementById('tableStatsOption');
    if (isEncoderStatsEnabled && isAssistEnabled) {
        tableStatsOption.classList.remove('hidden');
    } else {
        tableStatsOption.classList.add('hidden');
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

// === GESTION DES STATISTIQUES DES ENCODEURS ===

// Ouvrir la modal des statistiques
async function openStatsModal() {
    // Vérifier si les statistiques sont activées
    const result = await chrome.storage.local.get(['enableEncoderStats']);
    if (!result.enableEncoderStats) {
        showNotification('Les statistiques des encodeurs ne sont pas activées !', 'warning');
        return;
    }

    // Charger et afficher les statistiques
    await loadAndDisplayStats();
    
    // Afficher la modal
    const modal = document.getElementById('statsModal');
    modal.classList.add('show');
}

// Fermer la modal des statistiques
function closeStatsModal() {
    const modal = document.getElementById('statsModal');
    modal.classList.remove('show');
}

// Réinitialiser toutes les statistiques des encodeurs
async function resetAllStats() {
    const confirmed = confirm(
        '⚠️ ATTENTION ⚠️\n\n' +
        'Vous êtes sur le point de supprimer TOUTES les statistiques des encodeurs.\n\n' +
        '• Historique complet des votes\n' +
        '• Statistiques agrégées\n' +
        '• Classements\n\n' +
        'Cette action est IRRÉVERSIBLE !\n\n' +
        'Voulez-vous vraiment continuer ?'
    );

    if (!confirmed) {
        return;
    }

    try {
        // Vider les deux tableaux dans le storage
        await chrome.storage.local.set({ 
            voteHistory: [],
            encoderStats: {}
        });

        // Supprimer aussi les anciennes données si elles existent
        await chrome.storage.local.remove(['encoderVotes']);

        // Fermer la modal
        closeStatsModal();

        // Notification de succès
        showNotification('✅ Toutes les statistiques ont été supprimées !', 'success');

        console.log('[TempoList] Statistiques réinitialisées avec succès');

    } catch (error) {
        console.error('[TempoList] Erreur lors de la réinitialisation:', error);
        showNotification('❌ Erreur lors de la réinitialisation des statistiques', 'error');
    }
}

// Ouvrir le visualiseur de données brutes
async function openDataViewer() {
    // Créer l'URL pour ouvrir la page de données
    const dataViewerUrl = chrome.runtime.getURL('data-viewer/data-viewer.html');
    
    // Ouvrir dans un nouvel onglet
    chrome.tabs.create({ url: dataViewerUrl });
}

// Charger et afficher les statistiques - NOUVEAU SYSTÈME avec filtrage par date
async function loadAndDisplayStats() {
    try {
        const result = await chrome.storage.local.get(['voteHistory', 'encoderStats']);
        let voteHistory = result.voteHistory || [];
        const encoderStats = result.encoderStats || {};
        
        // Filtrer par date si nécessaire
        if (selectedFilterDate) {
            voteHistory = filterVotesByDate(voteHistory, selectedFilterDate);
        }
        
        // Si pas de données après filtrage
        if (voteHistory.length === 0) {
            document.getElementById('noStatsMessage').style.display = 'block';
            document.querySelector('.stats-summary').style.display = 'none';
            document.querySelector('.encoders-ranking').style.display = 'none';
            
            // Message adapté selon le filtre
            const noStatsMsg = document.getElementById('noStatsMessage');
            if (selectedFilterDate) {
                const dateStr = formatDateForDisplay(selectedFilterDate);
                noStatsMsg.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" fill="currentColor" class="bi bi-calendar-x" viewBox="0 0 16 16" style="opacity: 0.3;">
                      <path d="M6.146 7.146a.5.5 0 0 1 .708 0L8 8.293l1.146-1.147a.5.5 0 1 1 .708.708L8.707 9l1.147 1.146a.5.5 0 0 1-.708.708L8 9.707l-1.146 1.147a.5.5 0 0 1-.708-.708L7.293 9 6.146 7.854a.5.5 0 0 1 0-.708"/>
                      <path d="M3.5 0a.5.5 0 0 1 .5.5V1h8V.5a.5.5 0 0 1 1 0V1h1a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V5h16V4H0V3a2 2 0 0 1 2-2h1V.5a.5.5 0 0 1 .5-.5"/>
                    </svg>
                    <h3>Aucun vote pour le ${dateStr}</h3>
                    <p>Il n'y a pas de votes enregistrés pour cette date spécifique.</p>
                `;
            }
            return;
        }

        // Cacher le message "pas de stats"
        document.getElementById('noStatsMessage').style.display = 'none';
        document.querySelector('.stats-summary').style.display = 'grid';
        document.querySelector('.encoders-ranking').style.display = 'block';

        // Recalculer les statistiques avec les données filtrées
        const filteredEncoderStats = recalculateStatsFromFilteredHistory(voteHistory);
        
        // Calculer les statistiques globales
        const stats = calculateGlobalStats(voteHistory, filteredEncoderStats);
        
        // Mettre à jour l'affichage des statistiques générales
        document.getElementById('totalEncoders').textContent = stats.totalEncoders;
        document.getElementById('totalVotes').textContent = stats.totalVotes;
        document.getElementById('avgScore').textContent = stats.avgScore + '%';

        // Générer le classement des encodeurs
        generateEncodersRanking(voteHistory, filteredEncoderStats);

    } catch (error) {
        console.error('Erreur lors du chargement des statistiques:', error);
        showNotification('Erreur lors du chargement des statistiques', 'error');
    }
}

// Calculer les statistiques globales - NOUVEAU SYSTÈME
function calculateGlobalStats(voteHistory, encoderStats) {
    const totalEncoders = Object.keys(encoderStats).length;
    const totalVotes = voteHistory.length;
    
    let totalScore = 0;
    let encodersWithVotes = 0;

    for (const encoderName in encoderStats) {
        const stats = encoderStats[encoderName];
        if (stats.totalVotes > 0) {
            totalScore += stats.percentage;
            encodersWithVotes++;
        }
    }

    const avgScore = encodersWithVotes > 0 ? Math.round(totalScore / encodersWithVotes) : 0;

    return {
        totalEncoders,
        totalVotes,
        avgScore
    };
}

// Générer le classement des encodeurs - NOUVEAU SYSTÈME
function generateEncodersRanking(voteHistory, encoderStats) {
    const rankingContainer = document.getElementById('encodersRanking');
    
    // Créer un tableau des encodeurs avec leurs scores
    const encodersWithScores = [];
    
    for (const encoderName in encoderStats) {
        const stats = encoderStats[encoderName];
        
        if (stats.totalVotes > 0) {
            // Compter le nombre de listes uniques votées pour cet encodeur
            const listsCount = voteHistory.filter(vote => vote.encoderName === encoderName).length;
            
            encodersWithScores.push({
                name: encoderName,
                score: stats.percentage,
                positiveVotes: stats.positiveScore,
                negativeVotes: stats.negativeScore,
                totalVotes: stats.totalVotes,
                listsCount: listsCount
            });
        }
    }

    // Trier par score décroissant, puis par nombre de votes décroissant en cas d'égalité
    encodersWithScores.sort((a, b) => {
        // D'abord par pourcentage (score)
        if (b.score !== a.score) {
            return b.score - a.score;
        }
        // En cas d'égalité de pourcentage, par nombre de votes
        return b.totalVotes - a.totalVotes;
    });

    // Générer le HTML du classement
    let rankingHTML = '';
    
    encodersWithScores.forEach((encoder, index) => {
        const rank = index + 1;
        let rankIcon = '📊';
        let rankColor = '#6b7280';
        
        if (rank === 1) {
            rankIcon = '🥇';
            rankColor = '#d97706';
        } else if (rank === 2) {
            rankIcon = '🥈';
            rankColor = '#6b7280';
        } else if (rank === 3) {
            rankIcon = '🥉';
            rankColor = '#92400e';
        }

        let scoreColor = '#6b7280';
        if (encoder.score >= 80) scoreColor = '#059669';
        else if (encoder.score >= 60) scoreColor = '#d97706';
        else scoreColor = '#dc2626';

        const progressWidth = Math.max(encoder.score, 5); // Minimum 5% pour la visibilité

        rankingHTML += `
            <div style="display: flex; align-items: center; padding: 12px 16px; border-bottom: 1px solid var(--border-color);">
                <div style="font-size: 20px; margin-right: 12px; color: ${rankColor};">${rankIcon}</div>
                <div style="flex: 1; min-width: 0;">
                    <div style="font-weight: 600; color: var(--text-color); margin-bottom: 4px; truncate;">
                        ${encoder.name}
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
                        <div style="flex: 1; height: 8px; background: #e5e7eb; border-radius: 4px; overflow: hidden;">
                            <div style="height: 100%; background: ${scoreColor}; width: ${progressWidth}%; transition: width 0.3s ease;"></div>
                        </div>
                        <div style="font-weight: 700; color: ${scoreColor}; font-size: 16px; min-width: 50px;">
                            ${encoder.score.toFixed(1)}%
                        </div>
                    </div>
                    <div style="font-size: 12px; color: var(--text-muted);">
                        ${encoder.totalVotes.toFixed(1)} votes • ${encoder.listsCount} listes • 
                        ✅ ${encoder.positiveVotes.toFixed(1)} • ❌ ${encoder.negativeVotes.toFixed(1)}
                    </div>
                </div>
            </div>
        `;
    });

    if (rankingHTML === '') {
        rankingHTML = `
            <div style="padding: 20px; text-align: center; color: var(--text-muted);">
                Aucun encodeur avec des votes
            </div>
        `;
    }

    rankingContainer.innerHTML = rankingHTML;
}

// Fermer la modal en cliquant sur l'overlay
document.addEventListener('click', (e) => {
    if (e.target.id === 'statsModal') {
        closeStatsModal();
    }
    if (e.target.id === 'datePickerModal') {
        closeDatePicker();
    }
});

// Échapper pour fermer la modal des stats
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.getElementById('statsModal').classList.contains('show')) {
        closeStatsModal();
    }
    if (e.key === 'Escape' && document.getElementById('datePickerModal').classList.contains('show')) {
        closeDatePicker();
    }
});

// === GESTION DU FILTRAGE PAR DATE ===

// Ouvrir le modal de sélection de date
function openDatePicker() {
    // Réinitialiser le calendrier à la date actuelle
    currentCalendarDate = new Date();
    
    // Mettre à jour l'affichage initial
    updateDateFilterMode();
    updateCalendarDisplay();
    
    // Afficher le modal
    const modal = document.getElementById('datePickerModal');
    modal.classList.add('show');
}

// Fermer le modal de sélection de date
function closeDatePicker() {
    const modal = document.getElementById('datePickerModal');
    modal.classList.remove('show');
}

// Basculer le mode de filtre (toutes dates / date spécifique)
function toggleDateFilterMode(mode) {
    dateFilterMode = mode;
    updateDateFilterMode();
}

// Mettre à jour l'interface selon le mode de filtre
function updateDateFilterMode() {
    const allDatesBtn = document.getElementById('showAllDatesBtn');
    const specificDateBtn = document.getElementById('selectSpecificDateBtn');
    const calendarContainer = document.getElementById('calendarContainer');
    
    // Mettre à jour les boutons
    allDatesBtn.classList.toggle('active', dateFilterMode === 'all');
    specificDateBtn.classList.toggle('active', dateFilterMode === 'specific');
    
    // Afficher/cacher le calendrier
    calendarContainer.style.display = dateFilterMode === 'specific' ? 'block' : 'none';
    
    // Mettre à jour le texte d'information
    updateSelectedDateInfo();
}

// Naviguer dans les mois du calendrier
function navigateMonth(direction) {
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() + direction);
    updateCalendarDisplay();
}

// Mettre à jour l'affichage du calendrier
function updateCalendarDisplay() {
    const monthNames = [
        'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
        'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
    ];
    
    // Mettre à jour le titre du mois
    const monthYearElement = document.getElementById('currentMonthYear');
    monthYearElement.textContent = `${monthNames[currentCalendarDate.getMonth()]} ${currentCalendarDate.getFullYear()}`;
    
    // Générer les jours du calendrier
    generateCalendarDays();
}

// Générer les jours du calendrier
function generateCalendarDays() {
    const calendarDays = document.getElementById('calendarDays');
    calendarDays.innerHTML = '';
    
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();
    
    // Premier jour du mois et nombre de jours
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    
    // Premier jour de la semaine (0 = dimanche, 1 = lundi, etc.)
    let startDate = firstDay.getDay();
    
    // Jours du mois précédent pour compléter la première semaine
    const prevMonth = new Date(year, month - 1, 0);
    const daysInPrevMonth = prevMonth.getDate();
    
    for (let i = startDate - 1; i >= 0; i--) {
        const dayElement = createCalendarDay(daysInPrevMonth - i, true, false);
        calendarDays.appendChild(dayElement);
    }
    
    // Jours du mois actuel
    const today = new Date();
    for (let day = 1; day <= daysInMonth; day++) {
        const currentDate = new Date(year, month, day);
        const isToday = isSameDate(currentDate, today);
        const isSelected = selectedFilterDate && isSameDate(currentDate, selectedFilterDate);
        
        const dayElement = createCalendarDay(day, false, isToday, isSelected, currentDate);
        calendarDays.appendChild(dayElement);
    }
    
    // Jours du mois suivant pour compléter la dernière semaine
    const totalCells = calendarDays.children.length;
    const remainingCells = 42 - totalCells; // 6 semaines × 7 jours
    
    for (let day = 1; day <= remainingCells; day++) {
        const dayElement = createCalendarDay(day, true, false);
        calendarDays.appendChild(dayElement);
    }
}

// Créer un élément jour du calendrier
function createCalendarDay(day, isOutside, isToday, isSelected = false, date = null) {
    const dayElement = document.createElement('div');
    dayElement.className = 'calendar-day';
    dayElement.textContent = day;
    
    if (isOutside) {
        dayElement.classList.add('outside');
    } else {
        if (isToday) dayElement.classList.add('today');
        if (isSelected) dayElement.classList.add('selected');
        
        // Ajouter l'événement de clic seulement pour les jours du mois actuel
        if (date) {
            dayElement.addEventListener('click', () => selectDate(date));
        }
    }
    
    return dayElement;
}

// Sélectionner une date
function selectDate(date) {
    selectedFilterDate = new Date(date);
    updateCalendarDisplay();
    updateSelectedDateInfo();
}

// Mettre à jour l'information de la date sélectionnée
function updateSelectedDateInfo() {
    const currentFilterText = document.getElementById('currentFilterText');
    
    if (dateFilterMode === 'all') {
        currentFilterText.innerHTML = 'Affichage : <strong>Toutes les dates</strong>';
    } else if (selectedFilterDate) {
        const dateStr = formatDateForDisplay(selectedFilterDate);
        currentFilterText.innerHTML = `Affichage : <strong>${dateStr}</strong>`;
    } else {
        currentFilterText.innerHTML = 'Affichage : <strong>Sélectionnez une date</strong>';
    }
}

// Appliquer le filtre de date
function applyDateFilter() {
    if (dateFilterMode === 'all') {
        selectedFilterDate = null;
    }
    
    // Fermer le modal
    closeDatePicker();
    
    // Recharger les statistiques avec le nouveau filtre
    loadAndDisplayStats();
    
    console.log('[TempoList] Filtre de date appliqué:', selectedFilterDate ? formatDateForDisplay(selectedFilterDate) : 'Toutes les dates');
}

// Filtrer les votes par date
function filterVotesByDate(voteHistory, filterDate) {
    if (!filterDate) {
        return voteHistory;
    }
    
    return voteHistory.filter(vote => {
        const voteDate = new Date(vote.timestamp);
        return isSameDate(voteDate, filterDate);
    });
}

// Recalculer les statistiques à partir d'un historique filtré
function recalculateStatsFromFilteredHistory(filteredHistory) {
    const stats = {};
    
    filteredHistory.forEach(vote => {
        const { encoderName, isPositive, coefficient } = vote;
        
        if (!stats[encoderName]) {
            stats[encoderName] = {
                totalVotes: 0,
                positiveScore: 0,
                negativeScore: 0,
                percentage: 0
            };
        }
        
        stats[encoderName].totalVotes++;
        if (isPositive) {
            stats[encoderName].positiveScore += coefficient;
        } else {
            stats[encoderName].negativeScore += coefficient;
        }
    });
    
    // Calculer les pourcentages
    Object.keys(stats).forEach(encoderName => {
        const encoderStats = stats[encoderName];
        const totalScore = encoderStats.positiveScore + encoderStats.negativeScore;
        encoderStats.percentage = totalScore > 0 ? (encoderStats.positiveScore / totalScore) * 100 : 0;
    });
    
    return stats;
}

// Vérifier si deux dates sont identiques (même jour)
function isSameDate(date1, date2) {
    return date1.getDate() === date2.getDate() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getFullYear() === date2.getFullYear();
}

// Formater une date pour l'affichage
function formatDateForDisplay(date) {
    const options = { 
        day: '2-digit', 
        month: 'long', 
        year: 'numeric',
        weekday: 'long'
    };
    return date.toLocaleDateString('fr-FR', options);
} 