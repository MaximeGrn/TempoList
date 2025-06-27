// popup.js - Logique principale du popup TempoList

document.addEventListener('DOMContentLoaded', async () => {
    await initializePopup();
    setupEventListeners();
});

// Initialisation du popup
async function initializePopup() {
    try {
        await loadTeams();
        await loadCurrentDay();
        updateDisplay();
    } catch (error) {
        console.error('Erreur d\'initialisation:', error);
    }
}

// Configuration des événements
function setupEventListeners() {
    // Boutons + et -
    document.getElementById('incrementBtn').addEventListener('click', incrementCount);
    document.getElementById('decrementBtn').addEventListener('click', decrementCount);
    
    // Bouton de réinitialisation
    document.getElementById('resetDayBtn').addEventListener('click', resetDay);
    
    // Boutons de navigation
    document.getElementById('optionsBtn').addEventListener('click', () => {
        chrome.tabs.create({ url: 'options/options.html' });
    });
    
    document.getElementById('historyBtn').addEventListener('click', () => {
        chrome.tabs.create({ url: 'history/history.html' });
    });
    
    // Changement d'équipe active
    document.getElementById('activeTeam').addEventListener('change', changeActiveTeam);
}

// Variables globales pour stocker les données
let currentData = {
    teams: [],
    dailyTarget: 40,
    currentDay: {
        date: new Date().toDateString(),
        count: 0,
        timestamps: [],
        activeTeam: null
    }
};

// Charger les équipes depuis le stockage
async function loadTeams() {
    const result = await chrome.storage.local.get(['teams']);
    currentData.teams = result.teams || [];
    
    const teamSelect = document.getElementById('activeTeam');
    teamSelect.innerHTML = '<option value="">Sélectionner une équipe</option>';
    
    currentData.teams.forEach(team => {
        const option = document.createElement('option');
        option.value = team.id;
        option.textContent = team.name;
        teamSelect.appendChild(option);
    });
}

// Charger les données du jour actuel
async function loadCurrentDay() {
    const result = await chrome.storage.local.get(['currentDay', 'dailyTarget']);
    
    if (result.currentDay) {
        currentData.currentDay = result.currentDay;
    }
    
    if (result.dailyTarget) {
        currentData.dailyTarget = result.dailyTarget;
    }
    
    // Sélectionner l'équipe active
    if (currentData.currentDay.activeTeam) {
        document.getElementById('activeTeam').value = currentData.currentDay.activeTeam;
    }
}

// Mettre à jour l'affichage
function updateDisplay() {
    updateCounter();
    updateProgressCircle();
    updateStats();
    updateStatus();
    updateTeamSelection();
    updateButtons();
}

// Mettre à jour le compteur
function updateCounter() {
    document.getElementById('currentCount').textContent = currentData.currentDay.count;
    document.getElementById('targetCount').textContent = currentData.dailyTarget;
    
    const percentage = currentData.dailyTarget > 0 
        ? Math.round((currentData.currentDay.count / currentData.dailyTarget) * 100)
        : 0;
    document.getElementById('percentageText').textContent = `${percentage}%`;
}

// Mettre à jour l'anneau de progression (canvas)
function updateProgressCircle() {
    const canvas = document.getElementById('progressCanvas');
    const ctx = canvas.getContext('2d');
    
    // Utiliser une résolution plus élevée pour un rendu plus net
    const dpr = window.devicePixelRatio || 1;
    const displaySize = 120;
    const actualSize = displaySize * dpr;
    
    // Redimensionner le canvas pour la haute résolution
    canvas.width = actualSize;
    canvas.height = actualSize;
    canvas.style.width = displaySize + 'px';
    canvas.style.height = displaySize + 'px';
    
    // Mettre à l'échelle le contexte pour la haute résolution
    ctx.scale(dpr, dpr);
    
    const centerX = displaySize / 2;
    const centerY = displaySize / 2;
    const radius = 45;
    
    // Effacer le canvas
    ctx.clearRect(0, 0, displaySize, displaySize);
    
    // Calculer le pourcentage
    const percentage = currentData.dailyTarget > 0 
        ? currentData.currentDay.count / currentData.dailyTarget
        : 0;
    const angle = percentage * 2 * Math.PI;
    
    // Fond de l'anneau
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.strokeStyle = '#e9ecef';
    ctx.lineWidth = 8;
    ctx.stroke();
    
    // Progression
    if (percentage > 0) {
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, -Math.PI / 2, angle - Math.PI / 2);
        
        // Couleur basée sur le statut
        const status = calculateStatus();
        let color = '#3498db'; // Par défaut
        if (status === 'ahead') color = '#27ae60';
        else if (status === 'ontime') color = '#f39c12';
        else if (status === 'behind') color = '#e74c3c';
        
        ctx.strokeStyle = color;
        ctx.lineWidth = 8;
        ctx.lineCap = 'round';
        ctx.stroke();
    }
}

// Mettre à jour les statistiques
function updateStats() {
    const avgRealTime = calculateAverageRealTime();
    const avgTheoTime = calculateTheoreticalTime();
    const projection = calculateProjection();
    
    document.getElementById('avgRealTime').textContent = formatTime(avgRealTime);
    document.getElementById('avgTheoTime').textContent = formatTime(avgTheoTime);
    document.getElementById('projection').textContent = projection;
}

// Obtenir l'heure de début de travail de l'équipe active pour aujourd'hui
function getWorkStartTime() {
    const activeTeam = getActiveTeam();
    if (!activeTeam || !activeTeam.schedules || activeTeam.schedules.length === 0) {
        return null;
    }
    
    // Prendre le premier créneau de la journée comme heure de début
    const firstSchedule = activeTeam.schedules[0];
    const today = new Date();
    const [startHours, startMinutes] = firstSchedule.start.split(':').map(Number);
    
    const workStartTime = new Date(today);
    workStartTime.setHours(startHours, startMinutes, 0, 0);
    
    return workStartTime;
}

// Calculer le temps moyen réel depuis le début de la journée de travail
function calculateAverageRealTime() {
    const timestamps = currentData.currentDay.timestamps;
    
    if (timestamps.length === 0) {
        return 0;
    }
    
    const workStartTime = getWorkStartTime();
    if (!workStartTime) {
        // Si pas d'équipe définie, utiliser l'ancien calcul
        if (timestamps.length < 2) {
            return 0;
        }
        
        let totalTime = 0;
        for (let i = 1; i < timestamps.length; i++) {
            totalTime += timestamps[i] - timestamps[i - 1];
        }
        
        return totalTime / (timestamps.length - 1);
    }
    
    // Calculer le temps écoulé depuis le début de travail jusqu'à la dernière validation
    const lastTimestamp = timestamps[timestamps.length - 1];
    const elapsedTime = lastTimestamp - workStartTime.getTime();
    
    // Temps moyen = temps écoulé / nombre de listes validées
    return currentData.currentDay.count > 0 ? elapsedTime / currentData.currentDay.count : 0;
}

// Calculer le temps théorique par liste
function calculateTheoreticalTime() {
    const activeTeam = getActiveTeam();
    if (!activeTeam || !activeTeam.schedules || activeTeam.schedules.length === 0) {
        return 0;
    }
    
    // Calculer la durée totale de travail en millisecondes
    let totalWorkTime = 0;
    activeTeam.schedules.forEach(schedule => {
        const start = timeToMinutes(schedule.start);
        const end = timeToMinutes(schedule.end);
        if (end > start) {
            totalWorkTime += (end - start) * 60 * 1000; // Convertir en millisecondes
        }
    });
    
    return currentData.dailyTarget > 0 ? totalWorkTime / currentData.dailyTarget : 0;
}

// Calculer la projection (heure de fin estimée)
function calculateProjection() {
    const workStartTime = getWorkStartTime();
    
    if (currentData.currentDay.count === 0) {
        return '--';
    }
    
    const remaining = currentData.dailyTarget - currentData.currentDay.count;
    if (remaining <= 0) {
        return 'Objectif atteint !';
    }
    
    // Si on a une équipe avec horaires
    if (workStartTime) {
        const avgRealTime = calculateAverageRealTime();
        if (avgRealTime === 0) {
            return '--';
        }
        
        // Calculer le temps nécessaire pour terminer les listes restantes
        const timePerList = avgRealTime; // Temps moyen par liste depuis le début
        const timeNeeded = remaining * timePerList;
        
        // Heure de fin estimée = maintenant + temps nécessaire
        const finishTime = new Date(Date.now() + timeNeeded);
        
        const hours = finishTime.getHours().toString().padStart(2, '0');
        const minutes = finishTime.getMinutes().toString().padStart(2, '0');
        
        return `Fin vers ${hours}h${minutes}`;
    } else {
        // Méthode de calcul original si pas d'équipe
        const avgRealTime = calculateAverageRealTime();
        
        if (avgRealTime === 0) {
            return '--';
        }
        
        const timeNeeded = remaining * avgRealTime;
        const finishTime = new Date(Date.now() + timeNeeded);
        
        const hours = finishTime.getHours().toString().padStart(2, '0');
        const minutes = finishTime.getMinutes().toString().padStart(2, '0');
        
        return `Fin vers ${hours}h${minutes}`;
    }
}

// Calculer le statut (avance/à l'heure/retard)
function calculateStatus() {
    const workStartTime = getWorkStartTime();
    const now = new Date();
    
    // Si pas d'équipe définie, utiliser l'ancien calcul
    if (!workStartTime) {
        const avgRealTime = calculateAverageRealTime();
        const avgTheoTime = calculateTheoreticalTime();
        
        if (avgRealTime === 0 || avgTheoTime === 0) {
            return 'neutral';
        }
        
        const ratio = avgRealTime / avgTheoTime;
        
        if (ratio < 0.9) return 'ahead';      // 10% plus rapide
        if (ratio > 1.1) return 'behind';     // 10% plus lent
        return 'ontime';
    }
    
    // Temps écoulé depuis le début de travail
    const elapsedTime = now.getTime() - workStartTime.getTime();
    
    // Si la journée n'a pas encore commencé
    if (elapsedTime < 0) {
        return 'neutral';
    }
    
    // Si aucune liste n'a été validée
    if (currentData.currentDay.count === 0) {
        // Calculer le temps théorique pour la première liste
        const avgTheoTime = calculateTheoreticalTime();
        if (avgTheoTime > 0 && elapsedTime > avgTheoTime) {
            return 'behind'; // En retard pour la première liste
        }
        return 'neutral';
    }
    
    // Comparer le temps moyen réel avec le temps théorique
    const avgRealTime = calculateAverageRealTime();
    const avgTheoTime = calculateTheoreticalTime();
    
    if (avgTheoTime === 0) {
        return 'neutral';
    }
    
    const ratio = avgRealTime / avgTheoTime;
    
    if (ratio < 0.9) return 'ahead';      // 10% plus rapide
    if (ratio > 1.1) return 'behind';     // 10% plus lent
    return 'ontime';
}

// Mettre à jour l'indicateur de statut
function updateStatus() {
    const status = calculateStatus();
    const statusText = document.getElementById('statusText');
    const statusColor = document.getElementById('statusColor');
    const workStartTime = getWorkStartTime();
    const now = new Date();
    
    // Retirer les classes existantes
    statusColor.classList.remove('ahead', 'ontime', 'behind', 'started');
    
    // Si on a une équipe et que la journée n'a pas encore commencé
    if (workStartTime && now < workStartTime) {
        statusText.textContent = 'Pas encore commencé';
        return;
    }
    
    // Si aucune liste n'a été validée mais qu'on devrait avoir commencé
    if (currentData.currentDay.count === 0) {
        if (status === 'behind') {
            statusText.textContent = 'En retard';
            statusColor.classList.add('behind');
        } else {
            statusText.textContent = 'Pas encore commencé';
        }
        return;
    }
    
    // Si on a au moins une liste, afficher le statut approprié
    switch (status) {
        case 'ahead':
            statusText.textContent = 'En avance';
            statusColor.classList.add('ahead');
            break;
        case 'behind':
            statusText.textContent = 'En retard';
            statusColor.classList.add('behind');
            break;
        case 'ontime':
            statusText.textContent = 'À l\'heure';
            statusColor.classList.add('ontime');
            break;
        default:
            statusText.textContent = 'Commencé';
            statusColor.classList.add('started');
            break;
    }
}

// Obtenir l'équipe active
function getActiveTeam() {
    const activeTeamId = currentData.currentDay.activeTeam;
    return currentData.teams.find(team => team.id === activeTeamId);
}

// Incrémenter le compteur
async function incrementCount() {
    try {
        const now = Date.now();
        currentData.currentDay.count += 1;
        currentData.currentDay.timestamps.push(now);
        
        // Sauvegarder
        await chrome.storage.local.set({ currentDay: currentData.currentDay });
        
        // Mettre à jour l'affichage
        updateDisplay();
        
        // Animation du bouton
        const btn = document.getElementById('incrementBtn');
        btn.style.transform = 'scale(0.95)';
        setTimeout(() => {
            btn.style.transform = 'scale(1)';
        }, 150);
        
    } catch (error) {
        console.error('Erreur lors de l\'ajout:', error);
    }
}

// Décrémenter le compteur
async function decrementCount() {
    try {
        if (currentData.currentDay.count <= 0) {
            return; // Pas de décrémentation en dessous de 0
        }
        
        currentData.currentDay.count -= 1;
        
        // Supprimer le dernier timestamp si il existe
        if (currentData.currentDay.timestamps.length > 0) {
            currentData.currentDay.timestamps.pop();
        }
        
        // Sauvegarder
        await chrome.storage.local.set({ currentDay: currentData.currentDay });
        
        // Mettre à jour l'affichage
        updateDisplay();
        
        // Animation du bouton
        const btn = document.getElementById('decrementBtn');
        btn.style.transform = 'scale(0.95)';
        setTimeout(() => {
            btn.style.transform = 'scale(1)';
        }, 150);
        
    } catch (error) {
        console.error('Erreur lors de la soustraction:', error);
    }
}

// Réinitialiser la journée
async function resetDay() {
    if (!confirm('Êtes-vous sûr de vouloir réinitialiser la journée ? Cette action est irréversible.')) {
        return;
    }
    
    try {
        // Sauvegarder dans l'historique si il y a des données
        if (currentData.currentDay.count > 0) {
            const history = await chrome.storage.local.get('history');
            const historyData = history.history || [];
            
            historyData.push({
                date: currentData.currentDay.date,
                count: currentData.currentDay.count,
                timestamps: currentData.currentDay.timestamps,
                activeTeam: currentData.currentDay.activeTeam,
                dailyTarget: currentData.dailyTarget || 0 // Inclure l'objectif quotidien
            });
            
            await chrome.storage.local.set({ history: historyData });
        }
        
        // Réinitialiser
        const today = new Date().toDateString();
        currentData.currentDay = {
            date: today,
            count: 0,
            timestamps: [],
            activeTeam: currentData.currentDay.activeTeam // Garder l'équipe active
        };
        
        await chrome.storage.local.set({ currentDay: currentData.currentDay });
        updateDisplay();
        
    } catch (error) {
        console.error('Erreur lors de la réinitialisation:', error);
    }
}

// Changer l'équipe active
async function changeActiveTeam() {
    // Empêcher le changement d'équipe si la journée a commencé
    if (currentData.currentDay.count > 0) {
        alert('Vous ne pouvez pas changer d\'équipe une fois que vous avez commencé à compter les listes.');
        // Remettre la sélection précédente
        document.getElementById('activeTeam').value = currentData.currentDay.activeTeam || '';
        return;
    }
    
    const teamId = document.getElementById('activeTeam').value;
    currentData.currentDay.activeTeam = teamId || null;
    
    await chrome.storage.local.set({ currentDay: currentData.currentDay });
    updateDisplay();
}

// Mettre à jour l'état de la sélection d'équipe
function updateTeamSelection() {
    const teamSelect = document.getElementById('activeTeam');
    const hasStarted = currentData.currentDay.count > 0;
    
    teamSelect.disabled = hasStarted;
    
    if (hasStarted) {
        teamSelect.style.opacity = '0.6';
        teamSelect.title = 'Vous ne pouvez pas changer d\'équipe une fois que vous avez commencé';
    } else {
        teamSelect.style.opacity = '1';
        teamSelect.title = '';
    }
}

// Mettre à jour l'état des boutons
function updateButtons() {
    const decrementBtn = document.getElementById('decrementBtn');
    const canDecrement = currentData.currentDay.count > 0;
    
    decrementBtn.disabled = !canDecrement;
}

// Fonctions utilitaires

// Convertir l'heure en minutes
function timeToMinutes(timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
}

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