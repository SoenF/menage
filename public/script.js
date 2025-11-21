document.addEventListener('DOMContentLoaded', function () {
    // Auth Check
    const token = localStorage.getItem('sweepy_token');
    if (!token) {
        window.location.href = '/login.html';
        return;
    }

    // Override fetch to include token
    const originalFetch = window.fetch;
    window.fetch = function (url, options = {}) {
        options.headers = options.headers || {};
        options.headers['Authorization'] = `Bearer ${token}`;

        return originalFetch(url, options).then(response => {
            if (response.status === 401 || response.status === 403) {
                localStorage.removeItem('sweepy_token');
                localStorage.removeItem('sweepy_family');
                window.location.href = '/login.html';
            }
            return response;
        });
    };

    // Logout function
    window.logout = function () {
        localStorage.removeItem('sweepy_token');
        localStorage.removeItem('sweepy_family');
        window.location.href = '/login.html';
    };

    // Éléments DOM
    const membersList = document.getElementById('members-list');
    const tasksList = document.getElementById('tasks-list');
    const pointsBoard = document.getElementById('points-board');
    // const taskAssignee = document.getElementById('task-assignee'); // Removed
    const scheduleElement = document.getElementById('schedule');

    // Boutons
    const addMemberBtn = document.getElementById('add-member-btn');
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', window.logout);
    }

    // Champs de saisie
    const memberNameInput = document.getElementById('member-name');

    // Initialiser l'application
    function initApp() {
        loadMembers();

        // Charger la vue hebdomadaire par défaut
        setTimeout(() => {
            fetch('/api/members')
                .then(response => response.json())
                .then(members => {
                    loadSchedule(members);
                })
                .catch(error => console.error('Erreur lors du chargement du calendrier hebdomadaire:', error));
        }, 500);

        // Setup Quick Add Button
        const quickAddBtn = document.getElementById('quick-add-task-btn');
        if (quickAddBtn) {
            quickAddBtn.addEventListener('click', quickAddTask);
        }
    }

    // Charger et afficher les membres de la famille
    function loadMembers() {
        fetch('/api/members')
            .then(response => response.json())
            .then(members => {
                membersList.innerHTML = '';
                membersList.innerHTML = '';
                // taskAssignee.innerHTML = '<option value="">Non assigné</option>'; // Removed

                members.forEach(member => {
                    // Ajouter à la liste des membres
                    const memberCard = document.createElement('div');
                    memberCard.className = 'member-card';
                    memberCard.innerHTML = `
                        <div class="member-info">
                            <div class="member-name">${member.name}</div>
                            <div class="member-points">Points: ${member.points}</div>
                        </div>
                        <button class="delete-btn" data-id="${member.id}">Supprimer</button>
                    `;

                    membersList.appendChild(memberCard);

                    // Ajouter au menu déroulant des assignations
                    // Ajouter au menu déroulant des assignations - Removed
                    // const option = document.createElement('option');
                    // option.value = member.id;
                    // option.textContent = member.name;
                    // taskAssignee.appendChild(option);

                    // Ajouter un écouteur d'événements au bouton de suppression
                    const deleteBtn = memberCard.querySelector('.delete-btn');
                    deleteBtn.addEventListener('click', () => deleteMember(member.id));
                });
            })
            .catch(error => console.error('Erreur lors du chargement des membres:', error));
    }

    // Charger et afficher la liste des tâches (Configuration & Historique)
    function loadTasks() {
        fetch('/api/tasks')
            .then(response => response.json())
            .then(tasks => {
                tasksList.innerHTML = '';

                // Filtrer pour n'afficher que les tâches "parents" ou uniques par titre/config
                // Pour simplifier, on affiche les tâches qui ont une récurrence activée et qui sont des "modèles"
                // Ou on affiche tout mais groupé.
                // Ici on va afficher les tâches uniques basées sur le titre pour la config

                const uniqueTasks = {};
                tasks.forEach(task => {
                    if (!uniqueTasks[task.title]) {
                        uniqueTasks[task.title] = task;
                    }
                });

                Object.values(uniqueTasks).forEach(task => {
                    const taskElement = document.createElement('div');
                    taskElement.className = 'task-item';

                    let frequencyText = 'Une fois';
                    if (task.repeat && task.repeat.enabled) {
                        const interval = task.repeat.interval;
                        if (interval === 1) frequencyText = 'Quotidien';
                        else if (interval === 7) frequencyText = 'Hebdomadaire';
                        else if (interval === 30) frequencyText = 'Mensuel';
                        else frequencyText = `Tous les ${interval} jours`;
                    }

                    taskElement.innerHTML = `
                        <div class="task-info">
                            <div class="task-title">${task.title}</div>
                            <div class="task-details">
                                <span>Difficulté: ${task.difficulty}</span><br>
                                <span>Fréquence: ${frequencyText}</span>
                            </div>
                        </div>
                        <div class="task-actions">
                            <button onclick="deleteTaskFromCalendar('${task.id}', event, true)">Supprimer</button>
                        </div>
                    `;
                    tasksList.appendChild(taskElement);
                });
            })
            .catch(error => console.error('Erreur lors du chargement des tâches:', error));
    }

    // Charger et afficher les points
    function loadPoints() {
        fetch('/api/members')
            .then(response => response.json())
            .then(members => {
                pointsBoard.innerHTML = '';

                members.forEach(member => {
                    const pointsCard = document.createElement('div');
                    pointsCard.className = 'points-member';
                    pointsCard.innerHTML = `
                        <h3>${member.name}</h3>
                        <div class="points-value">${member.points}</div>
                        <div>Points</div>
                    `;

                    pointsBoard.appendChild(pointsCard);
                });
            })
            .catch(error => console.error('Erreur lors du chargement des points:', error));
    }

    // Générer et afficher le calendrier hebdomadaire
    function loadSchedule(members) {
        // Calculer la plage de dates pour la requête API
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const startDate = new Date(today);
        startDate.setDate(today.getDate() - 2); // -2 jours

        const endDate = new Date(today);
        endDate.setDate(today.getDate() + 2); // +2 jours

        const startDateStr = startDate.toISOString();
        const endDateStr = endDate.toISOString();

        fetch(`/api/tasks?startDate=${startDateStr}&endDate=${endDateStr}`)
            .then(response => response.json())
            .then(tasks => {
                // Utiliser un DocumentFragment pour minimiser les reflows
                const fragment = document.createDocumentFragment();

                // Regrouper les tâches par date d'échéance pour un accès O(1)
                const tasksByDate = {};

                // Générer les dates : -2 jours, aujourd'hui, +2 jours (5 jours au total)
                const weekDates = [];

                for (let i = -2; i <= 2; i++) {
                    const date = new Date();
                    date.setDate(date.getDate() + i);
                    date.setHours(0, 0, 0, 0);
                    const dateStr = date.toISOString().split('T')[0]; // Format YYYY-MM-DD

                    // Formater la date différemment pour aujourd'hui
                    let formattedDate;
                    if (i === 0) {
                        formattedDate = 'Aujourd\'hui';
                    } else {
                        formattedDate = date.toLocaleDateString('fr-FR', { weekday: 'short' });
                    }

                    weekDates.push({
                        date: date,
                        dateStr: dateStr,
                        formattedDate: formattedDate,
                        timeDiff: date.getTime() - today.getTime()
                    });
                    tasksByDate[dateStr] = [];
                }

                // Indexer les tâches par date (optimisation)
                tasks.forEach(task => {
                    if (task.dueDate && !task.completed) {
                        const taskDateStr = task.dueDate.split('T')[0];
                        if (tasksByDate[taskDateStr]) {
                            tasksByDate[taskDateStr].push(task);
                        }
                    }
                });

                // Créer le tableau du calendrier
                const table = document.createElement('table');
                table.className = 'schedule-table';

                // En-tête
                const headerRow = document.createElement('tr');
                headerRow.innerHTML = '<th>Membres</th>' + weekDates.map(d => `<th>${d.formattedDate}</th>`).join('');
                table.appendChild(headerRow);

                // Helper pour générer le HTML d'une tâche
                const getTaskHtml = (task, timeDiff) => {
                    const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
                    let taskStyle = '';

                    if (daysDiff === 0) {
                        taskStyle = 'style="border-left: 3px solid red; background-color: #ffebee;"';
                    } else if (daysDiff === 1) {
                        taskStyle = 'style="border-left: 3px solid orange; background-color: #fff3e0;"';
                    } else if (daysDiff > 1) {
                        taskStyle = 'style="border-left: 3px solid green; background-color: #e8f5e8;"';
                    } else {
                        taskStyle = 'style="border-left: 3px solid darkred; background-color: #ffcdd2;"';
                    }

                    return `<div class="schedule-task" ${taskStyle} 
                        draggable="true" 
                        ondragstart="drag(event, '${task.id}')"
                        onclick="event.stopPropagation();">
                        <strong>${task.title}</strong>
                        <div>Points : ${task.difficulty * 10}</div>
                        <div class="calendar-task-actions">
                            <button class="cal-action-btn cal-btn-complete" onclick="toggleTaskCompletion('${task.id}', true)" title="Terminer">✅</button>
                            <button class="cal-action-btn cal-btn-move" onclick="promptMoveTask('${task.id}')" title="Décaler">📅</button>
                            <button class="cal-action-btn cal-btn-delete" onclick="deleteTask('${task.id}')" title="Supprimer">🗑️</button>
                        </div>
                    </div>`;
                };

                // Lignes pour chaque membre
                members.forEach(member => {
                    const row = document.createElement('tr');
                    let html = `<td class="schedule-member">${member.name}</td>`;

                    weekDates.forEach(weekDate => {
                        const tasksForDate = tasksByDate[weekDate.dateStr].filter(t => t.assignedTo === member.id);

                        let taskContent = '<em>Aucune tâche</em>';
                        if (tasksForDate.length > 0) {
                            taskContent = tasksForDate.map(t => getTaskHtml(t, weekDate.timeDiff)).join('');
                        }

                        html += `<td class="schedule-day" 
                            ondrop="drop(event, '${weekDate.dateStr}')" 
                            ondragover="allowDrop(event)">
                            <div class="day-number">${weekDate.date.getDate()}</div>${taskContent}
                        </td>`;
                    });

                    row.innerHTML = html;
                    table.appendChild(row);
                });

                // Ligne pour les non assignés
                const unassignedRow = document.createElement('tr');
                let unassignedHtml = '<td class="schedule-member"><strong>Non assigné</strong></td>';

                weekDates.forEach(weekDate => {
                    const unassignedTasks = tasksByDate[weekDate.dateStr].filter(t => !t.assignedTo);

                    let taskContent = '<em>Aucune tâche</em>';
                    if (unassignedTasks.length > 0) {
                        taskContent = unassignedTasks.map(t => getTaskHtml(t, weekDate.timeDiff)).join('');
                    }

                    unassignedHtml += `<td class="schedule-day"
                        ondrop="drop(event, '${weekDate.dateStr}')" 
                        ondragover="allowDrop(event)">
                        <div class="day-number">${weekDate.date.getDate()}</div>${taskContent}
                    </td>`;
                });

                unassignedRow.innerHTML = unassignedHtml;
                table.appendChild(unassignedRow);

                fragment.appendChild(table);

                // Mise à jour unique du DOM
                scheduleElement.innerHTML = '';
                scheduleElement.appendChild(fragment);
            })
            .catch(error => console.error('Erreur lors du chargement du calendrier:', error));
    }

    // Fonction d'ajout rapide de tâche
    function quickAddTask() {
        const title = document.getElementById('new-task-title').value.trim();
        const difficulty = document.getElementById('new-task-difficulty').value;
        const frequency = document.getElementById('new-task-frequency').value;

        if (!title || !difficulty) {
            alert('Veuillez entrer un titre et sélectionner une difficulté');
            return;
        }

        // Utiliser la fonction existante addTask mais avec les valeurs du nouveau formulaire
        // On simule les valeurs dans les anciens champs (ou on refactorise, mais ici on adapte)
        // Pour faire propre, on appelle l'API directement ici

        let interval = 1;
        switch (frequency) {
            case 'daily': interval = 1; break;
            case 'every3days': interval = 3; break;
            case 'weekly': interval = 7; break;
            case 'biweekly': interval = 14; break;
            case 'monthly': interval = 30; break;
        }

        const today = new Date();
        const nextDueDate = new Date(today);
        nextDueDate.setDate(nextDueDate.getDate() + 1); // Demain par défaut

        // Pour les fréquences bi-hebdomadaires et mensuelles, attendre au moins une semaine
        if (frequency === 'biweekly' || frequency === 'monthly') {
            nextDueDate.setDate(nextDueDate.getDate() + 6); // +1 (demain) + 6 = +7 jours (une semaine)
        }

        fetch('/api/tasks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title,
                difficulty,
                assignedTo: null,
                completed: false,
                dueDate: nextDueDate.toISOString(),
                createdAt: today.toISOString(),
                repeat: {
                    enabled: !!frequency,
                    interval: interval,
                    nextDate: nextDueDate.toISOString()
                }
            })
        })
            .then(response => response.json())
            .then(newTask => {
                // Reset form
                document.getElementById('new-task-title').value = '';
                document.getElementById('new-task-difficulty').value = '';
                document.getElementById('new-task-frequency').value = '';

                // Générer les tâches futures si récurrent
                if (newTask.repeat && newTask.repeat.enabled) {
                    fetch('/api/tasks/generate-future', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ taskId: newTask.id })
                    })
                        .then(() => {
                            assignTasksAutomatically();
                            loadTasks(); // Rafraîchir la liste
                            // Recharger le calendrier
                            setTimeout(() => {
                                fetch('/api/members')
                                    .then(r => r.json())
                                    .then(members => loadSchedule(members));
                            }, 500);
                        });
                } else {
                    assignTasksAutomatically();
                    loadTasks();
                    setTimeout(() => {
                        fetch('/api/members')
                            .then(r => r.json())
                            .then(members => loadSchedule(members));
                    }, 500);
                }
            })
            .catch(err => console.error(err));
    }

    // Prompt pour déplacer une tâche
    window.promptMoveTask = function (taskId) {
        const days = prompt("De combien de jours voulez-vous repousser cette tâche ?", "1");
        if (days && !isNaN(days)) {
            updateTaskDueDate(taskId, days);
        }
    };

    // Ajouter un nouveau membre
    function addMember() {
        const name = memberNameInput.value.trim();
        if (!name) {
            alert('Veuillez entrer un nom de membre');
            return;
        }

        fetch('/api/members', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name })
        })
            .then(response => {
                if (!response.ok) {
                    return response.json().then(err => {
                        throw new Error(err.error || 'Erreur lors de l\'ajout du membre');
                    });
                }
                return response.json();
            })
            .then(() => {
                memberNameInput.value = '';
                loadMembers();
                loadPoints();
            })
            .catch(error => {
                console.error('Erreur lors de l\'ajout du membre:', error);
                alert(error.message || 'Erreur lors de l\'ajout du membre');
            });
    }

    // Supprimer un membre
    function deleteMember(id) {
        if (confirm('Êtes-vous sûr(e) de vouloir supprimer ce membre ?')) {
            fetch(`/api/members/${id}`, {
                method: 'DELETE'
            })
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Erreur lors de la suppression du membre');
                    }
                    loadMembers();
                    loadPoints();
                })
                .catch(error => {
                    console.error('Erreur lors de la suppression du membre:', error);
                    alert(error.message || 'Erreur lors de la suppression du membre');
                });
        }
    }

    // Fonction addTask supprimée car remplacée par quickAddTask

    // Basculer la complétion de la tâche
    function toggleTaskCompletion(id, completed) {
        console.log('Tentative de mise à jour de la tâche', id, 'à l\'état:', completed);
        fetch(`/api/tasks/${id}/complete`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ completed })
        })
            .then(response => {
                if (!response.ok) {
                    return response.json().then(err => {
                        throw new Error(err.error || 'Erreur lors de la mise à jour de la tâche');
                    });
                }
                return response.json();
            })
            .then(data => {
                assignTasksAutomatically(); // Réattribuer les tâches après changement de statut
                loadPoints();
            })
            .catch(error => {
                console.error('Erreur lors de la mise à jour de la complétion de la tâche:', error);
                alert(error.message || 'Erreur lors de la mise à jour de la tâche');
            });
    }

    // Supprimer une tâche
    function deleteTask(id) {
        if (confirm('Êtes-vous sûr(e) de vouloir supprimer cette tâche ?')) {
            fetch(`/api/tasks/${id}`, {
                method: 'DELETE'
            })
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Erreur lors de la suppression de la tâche');
                    }
                    loadPoints();
                })
                .catch(error => {
                    console.error('Erreur lors de la suppression de la tâche:', error);
                    alert(error.message || 'Erreur lors de la suppression de la tâche');
                });
        }
    }

    // Distribuer les tâches de manière équitable
    function distributeTaskFairly(taskId) {
        fetch('/api/tasks')
            .then(response => response.json())
            .then(tasks => {
                const task = tasks.find(t => t.id === taskId);
                if (!task) return;

                // Trouver le membre avec le moins de points
                fetch('/api/members')
                    .then(response => response.json())
                    .then(members => {
                        const memberWithLeastPoints = [...members].sort((a, b) => a.points - b.points)[0];
                        if (memberWithLeastPoints) {
                            assignTaskToMember(taskId, memberWithLeastPoints.id);
                        }
                    })
                    .catch(error => console.error('Erreur lors de la récupération des membres:', error));
            })
            .catch(error => console.error('Erreur lors de la récupération des tâches:', error));
    }

    // Attribuer une tâche à un membre spécifique
    function assignTaskToMember(taskId, memberId) {
        fetch(`/api/tasks/${taskId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ assignedTo: memberId })
        })
            .then(response => {
                if (!response.ok) {
                    return response.json().then(err => {
                        throw new Error(err.error || 'Erreur lors de l\'attribution de la tâche');
                    });
                }
                return response.json();
            })
            .then(() => {
                loadPoints();
            })
            .catch(error => {
                console.error('Erreur lors de l\'attribution de la tâche:', error);
                alert(error.message || 'Erreur lors de l\'attribution de la tâche');
            });
    }

    // Fonction pour échanger des tâches entre membres
    function swapTasks(taskId1, taskId2) {
        Promise.all([
            fetch(`/api/tasks/${taskId1}`).then(response => response.json()),
            fetch(`/api/tasks/${taskId2}`).then(response => response.json())
        ])
            .then(([task1, task2]) => {
                // Échanger les assignations
                const updatedTask1 = { ...task1, assignedTo: task2.assignedTo };
                const updatedTask2 = { ...task2, assignedTo: task1.assignedTo };

                // Mettre à jour les deux tâches
                Promise.all([
                    fetch(`/api/tasks/${taskId1}`, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(updatedTask1)
                    }),
                    fetch(`/api/tasks/${taskId2}`, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(updatedTask2)
                    })
                ])
                    .then(() => {
                        loadPoints();
                        // Rafraîchir la vue actuelle
                    })
                    .catch(error => console.error('Erreur lors de l\'échange des tâches:', error));
            })
            .catch(error => console.error('Erreur lors de la récupération des tâches:', error));
    }

    // Fonction pour permettre à un membre de prendre une tâche d'un autre membre
    function takeTask(taskId, newMemberId) {
        fetch(`/api/tasks/${taskId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ assignedTo: newMemberId })
        })
            .then(response => {
                if (!response.ok) {
                    return response.json().then(err => {
                        throw new Error(err.error || 'Erreur lors de la prise de la tâche');
                    });
                }
                return response.json();
            })
            .then(() => {
                loadPoints();
            })
            .catch(error => {
                console.error('Erreur lors de la prise de la tâche:', error);
                alert(error.message || 'Erreur lors de la prise de la tâche');
            });
    }

    // Fonction pour attribuer automatiquement les tâches de manière équitable
    function assignTasksAutomatically() {
        // Récupérer les tâches et les membres
        fetch('/api/members')
            .then(response => response.json())
            .then(members => {
                if (members.length === 0) return; // Aucun membre à qui assigner des tâches

                fetch('/api/tasks')
                    .then(response => response.json())
                    .then(tasks => {
                        // Filtrer les tâches non assignées et non terminées
                        const unassignedTasks = tasks.filter(task => !task.assignedTo && !task.completed);

                        unassignedTasks.forEach(task => {
                            // Obtenir les tâches récentes pour tous les membres
                            fetch('/api/tasks')
                                .then(response => response.json())
                                .then(allTasks => {
                                    // Créer un tableau trié des membres par points (ordre croissant)
                                    const sortedMembers = [...members].sort((a, b) => a.points - b.points);

                                    // Trouver la tâche la plus ancienne assignée à chaque membre
                                    const lastAssignedTasks = {};

                                    // Filtrer les tâches assignées non terminées
                                    const assignedTasks = allTasks.filter(t =>
                                        t.assignedTo && !t.completed
                                    );

                                    // Pour chaque membre, trouver sa tâche la plus récente
                                    members.forEach(member => {
                                        const memberTasks = assignedTasks.filter(t => t.assignedTo === member.id);
                                        if (memberTasks.length > 0) {
                                            // Tri par date de création décroissante
                                            const latestTask = memberTasks.sort((a, b) =>
                                                new Date(b.createdAt) - new Date(a.createdAt)
                                            )[0];
                                            lastAssignedTasks[member.id] = latestTask;
                                        } else {
                                            lastAssignedTasks[member.id] = null;
                                        }
                                    });

                                    // Utiliser l'ordre des points pour déterminer le prochain membre
                                    // Le membre avec le moins de points est prioritaire
                                    const nextMember = sortedMembers[0]; // Membre avec le moins de points

                                    // Si on a un membre, assigner la tâche
                                    if (nextMember) {
                                        assignTaskToMember(task.id, nextMember.id);
                                    }
                                })
                                .catch(error => console.error('Erreur lors de l\'attribution automatique des tâches:', error));
                        });
                    })
                    .catch(error => console.error('Erreur lors de la récupération des tâches pour attribution automatique:', error));
            })
            .catch(error => console.error('Erreur lors de la récupération des membres pour attribution automatique:', error));
    }



    // Fonction pour modifier la date d'échéance d'une tâche
    function updateTaskDueDate(taskId, daysToAdd) {
        console.log('updateTaskDueDate appelée avec', taskId, daysToAdd);
        const days = parseInt(daysToAdd, 10);
        if (isNaN(days) || days < 0) {
            alert("Veuillez entrer un nombre de jours valide");
            return;
        }

        // Calculer la nouvelle date d'échéance (jours à partir d'aujourd'hui)
        const newDueDate = new Date();
        newDueDate.setDate(newDueDate.getDate() + days);

        console.log('Nouvelle date calculée:', newDueDate.toISOString());

        fetch(`/api/tasks/${taskId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ dueDate: newDueDate.toISOString() })
        })
            .then(response => {
                if (!response.ok) {
                    return response.json().then(err => {
                        throw new Error(err.error || 'Erreur lors de la mise à jour de la date d\'échéance');
                    });
                }
                return response.json();
            })
            .then(data => {
                loadPoints();
            })
            .catch(error => {
                console.error('Erreur lors de la mise à jour de la date d\'échéance:', error);
                alert(error.message || 'Erreur lors de la mise à jour de la date d\'échéance');
            });
    }

    // Écouteurs d'événements
    addMemberBtn.addEventListener('click', addMember);
    memberNameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addMember();
    });

    // addTaskBtn.addEventListener('click', addTask); // Removed
    // taskTitleInput.addEventListener('keypress', (e) => { // Removed
    //     if (e.key === 'Enter') addTask();
    // });

    // Variables pour gérer le mois affiché dans le calendrier mensuel
    let currentMonthView = new Date().getMonth();
    let currentYearView = new Date().getFullYear();

    // Fonction pour charger le calendrier mensuel
    function loadMonthlySchedule(members) {
        fetch('/api/tasks')
            .then(response => response.json())
            .then(tasks => {
                // Générer les dates du mois à afficher
                const year = currentYearView;
                const month = currentMonthView;

                // Calculer le premier et dernier jour du mois
                const firstDay = new Date(year, month, 1);
                const lastDay = new Date(year, month + 1, 0);
                const daysInMonth = lastDay.getDate();

                // Effacer le contenu précédent
                scheduleElement.innerHTML = '';

                // Créer l'en-tête du mois avec navigation
                const headerDiv = document.createElement('div');
                headerDiv.className = 'calendar-header';
                const monthNames = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
                    "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
                headerDiv.innerHTML = `
                    <button id="prev-month" class="nav-btn">&lt;</button>
                    <h3>${monthNames[month]} ${year}</h3>
                    <button id="next-month" class="nav-btn">&gt;</button>
                `;
                scheduleElement.appendChild(headerDiv);

                // Gestion des événements de navigation
                document.getElementById('prev-month').addEventListener('click', () => {
                    currentMonthView--;
                    if (currentMonthView < 0) {
                        currentMonthView = 11;
                        currentYearView--;
                    }
                    loadMonthlySchedule(members);
                });

                document.getElementById('next-month').addEventListener('click', () => {
                    currentMonthView++;
                    if (currentMonthView > 11) {
                        currentMonthView = 0;
                        currentYearView++;
                    }
                    loadMonthlySchedule(members);
                });

                // Créer un conteneur
                const calendarContainer = document.createElement('div');
                calendarContainer.className = 'monthly-calendar-view';

                // En-tête des jours de la semaine (commençant par Lundi)
                const weekdaysHeader = document.createElement('div');
                weekdaysHeader.className = 'weekdays-header';
                const weekdays = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

                weekdays.forEach(day => {
                    const dayEl = document.createElement('div');
                    dayEl.className = 'weekday';
                    dayEl.textContent = day;
                    weekdaysHeader.appendChild(dayEl);
                });

                calendarContainer.appendChild(weekdaysHeader);

                // Grille des jours
                const weeksContainer = document.createElement('div');
                weeksContainer.className = 'weeks-container';

                // Calculer le premier jour du mois et le nombre de jours
                const firstDayOfMonth = new Date(year, month, 1);
                // Ajuster pour que Lundi soit 0 et Dimanche soit 6
                // getDay(): Dim=0, Lun=1, ..., Sam=6
                // On veut: Lun=0, ..., Sam=5, Dim=6
                let firstDayOfWeek = firstDayOfMonth.getDay() - 1;
                if (firstDayOfWeek === -1) firstDayOfWeek = 6; // Dimanche devient 6



                // Créer les cellules pour chaque jour
                // 42 cellules pour couvrir 6 semaines max (7 * 6)
                for (let i = 0; i < 42; i++) {
                    const dayCell = document.createElement('div');
                    dayCell.className = 'day-cell';

                    // Si on est avant le premier jour du mois ou après le dernier jour
                    if (i < firstDayOfWeek) {
                        // Cellule vide avant le début du mois
                        dayCell.classList.add('empty');
                    } else {
                        const dayOfMonth = i - firstDayOfWeek + 1;

                        if (dayOfMonth <= daysInMonth) {
                            // Calculer la date pour ce jour
                            const dateStr = `${year}-${(month + 1).toString().padStart(2, '0')}-${dayOfMonth.toString().padStart(2, '0')}`;

                            // Obtenir les tâches pour ce jour
                            // Pour éviter les doublons, on affiche soit les tâches originales (si pas d'instances)
                            // soit les instances (si elles existent)
                            const allDailyTasks = tasks.filter(task => {
                                const taskDate = new Date(task.dueDate);
                                const taskDateStr = taskDate.toISOString().split('T')[0];
                                return taskDateStr === dateStr;
                            });

                            // Filtrer pour n'afficher que les instances (tâches avec hasParent) ou les tâches originales sans instances
                            const dailyTasks = allDailyTasks.filter(task => {
                                // Si la tâche a un parent (c'est une instance), l'inclure
                                if (task.hasParent) {
                                    return true;
                                }
                                // Si c'est une tâche originale (sans parent), ne l'inclure que si aucune instance existe pour cette date
                                else {
                                    const hasInstance = allDailyTasks.some(otherTask =>
                                        otherTask.hasParent === task.id
                                    );
                                    return !hasInstance;
                                }
                            });

                            // Déterminer la date pour le style de couleur
                            const today = new Date();
                            today.setHours(0, 0, 0, 0);
                            const thisDate = new Date(year, month, dayOfMonth);
                            thisDate.setHours(0, 0, 0, 0);
                            const timeDiff = thisDate.getTime() - today.getTime();
                            const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));

                            // Couleur de fond selon la proximité de la date
                            let bgColor = '';
                            if (daysDiff < 0) {
                                bgColor = '#ffcdd2'; // Rouge pâle pour les dates passées
                            } else if (daysDiff === 0) {
                                bgColor = '#ffebee'; // Rouge plus foncé pour aujourd'hui
                            } else if (daysDiff === 1) {
                                bgColor = '#fff3e0'; // Orange pour demain
                            } else if (daysDiff <= 3) {
                                bgColor = '#e3f2fd'; // Bleu pâle pour les prochains jours
                            } else {
                                bgColor = '#f5f5f5'; // Gris pâle pour les dates lointaines
                            }

                            // Structure de la cellule
                            dayCell.style.backgroundColor = bgColor;
                            dayCell.innerHTML = `
                                <div class="day-number">${dayOfMonth}</div>
                                <div class="day-tasks">
                                    ${dailyTasks.map(task => {
                                // Récupérer le nom du membre assigné
                                let assigneeName = 'Non assigné';
                                if (task.assignedTo) {
                                    const member = members.find(m => m.id === task.assignedTo);
                                    if (member) {
                                        assigneeName = member.name;
                                    }
                                }

                                // Déterminer la couleur de la tâche selon l'urgence
                                let taskBgColor = '';
                                if (daysDiff < 0) {
                                    taskBgColor = '#ffcdd2'; // Rouge pour passées
                                } else if (daysDiff === 0) {
                                    taskBgColor = '#ffcdd2'; // Rouge pour aujourd'hui
                                } else if (daysDiff === 1) {
                                    taskBgColor = '#ffe0b2'; // Orange pour demain
                                } else if (daysDiff <= 3) {
                                    taskBgColor = '#c8e6c9'; // Vert pour les 3 prochains jours
                                } else {
                                    taskBgColor = '#e0e0e0'; // Gris pour plus loin
                                }

                                return `
                                            <div class="task-item" style="background-color: ${taskBgColor}" data-task-id="${task.id}">
                                                <div class="task-header">
                                                    <input type="checkbox" class="task-complete-checkbox" ${task.completed ? 'checked' : ''} onchange="toggleTaskCompletionDirect('${task.id}', this.checked)" title="Marquer comme terminé">
                                                    <div class="task-title">${task.title}</div>
                                                </div>
                                                <div class="task-assignee">${assigneeName}</div>
                                                <div class="task-actions">
                                                    <button class="delete-task-btn-calendar" onclick="deleteTaskFromCalendar('${task.id}', event)" title="Supprimer la tâche">×</button>
                                                </div>
                                                ${task.completed ? '<span class="completed-badge">Terminé</span>' : ''}
                                            </div>
                                        `;
                            }).join('')}
                                </div>
                            `;
                        } else {
                            // Cellule vide après la fin du mois
                            dayCell.classList.add('empty');
                        }
                    }

                    weeksContainer.appendChild(dayCell);
                }

                calendarContainer.appendChild(weeksContainer);
                scheduleElement.appendChild(calendarContainer);
            })
            .catch(error => console.error('Erreur lors du chargement du calendrier mensuel:', error));
    }

    // Variables pour suivre la vue actuelle
    let currentView = 'weekly'; // 'weekly' ou 'monthly'

    // Fonction pour charger la vue en fonction de l'état actuel
    function loadCurrentView() {
        fetch('/api/members')
            .then(response => response.json())
            .then(members => {
                if (currentView === 'weekly') {
                    loadSchedule(members);
                } else {
                    loadMonthlySchedule(members);
                }
            })
            .catch(error => console.error('Erreur lors du chargement de la vue courante:', error));
    }

    // Fonction pour basculer entre les vues
    function switchToWeeklyView() {
        currentView = 'weekly';

        // Mettre à jour l'UI
        document.getElementById('weekly-view-btn').classList.add('active');
        document.getElementById('monthly-view-btn').classList.remove('active');
        document.getElementById('calendar-title').textContent = '📅 Calendrier hebdomadaire';

        // Recharger avec la vue hebdomadaire
        loadCurrentView();
    }

    function switchToMonthlyView() {
        currentView = 'monthly';

        // Mettre à jour l'UI
        document.getElementById('monthly-view-btn').classList.add('active');
        document.getElementById('weekly-view-btn').classList.remove('active');
        document.getElementById('calendar-title').textContent = '📅 Calendrier mensuel';

        // Charger la vue mensuelle
        loadCurrentView();
    }

    // Fonction pour marquer une tâche comme terminée directement depuis le calendrier
    function toggleTaskCompletionDirect(taskId, completed) {
        fetch(`/api/tasks/${taskId}/complete`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ completed })
        })
            .then(response => {
                if (!response.ok) {
                    return response.json().then(err => {
                        throw new Error(err.error || 'Erreur lors de la mise à jour de la tâche');
                    });
                }
                return response.json();
            })
            .then(data => {
                // Rafraîchir l'affichage
                setTimeout(() => {
                    loadCurrentView();
                }, 100);
            })
            .catch(error => {
                console.error('Erreur lors de la mise à jour de la complétion de la tâche:', error);
                alert(error.message || 'Erreur lors de la mise à jour de la tâche');
            });
    }

    // Fonction pour supprimer une tâche directement depuis le calendrier
    function deleteTaskFromCalendar(taskId, event, cascade = false) {
        event.stopPropagation(); // Empêcher le clic de se propager

        const message = cascade
            ? 'Êtes-vous sûr(e) de vouloir supprimer cette tâche et toutes ses occurrences futures ?'
            : 'Êtes-vous sûr(e) de vouloir supprimer cette tâche ?';

        if (confirm(message)) {
            const url = cascade ? `/api/tasks/${taskId}?cascade=true` : `/api/tasks/${taskId}`;

            fetch(url, {
                method: 'DELETE'
            })
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Erreur lors de la suppression de la tâche');
                    }
                    // Rafraîchir l'affichage
                    setTimeout(() => {
                        loadTasks(); // Refresh list
                        loadCurrentView(); // Refresh calendar
                    }, 100);
                })
                .catch(error => {
                    console.error('Erreur lors de la suppression de la tâche:', error);
                    alert(error.message || 'Erreur lors de la suppression de la tâche');
                });
        }
    }

    // Drag and Drop Functions
    window.drag = function (ev, taskId) {
        ev.dataTransfer.setData("text", taskId);
        ev.target.style.opacity = "0.5";
    }

    window.allowDrop = function (ev) {
        ev.preventDefault();
    }

    window.drop = function (ev, dateStr) {
        ev.preventDefault();
        const taskId = ev.dataTransfer.getData("text");
        const taskElement = document.querySelector(`.schedule-task[onclick*="${taskId}"]`);
        if (taskElement) taskElement.style.opacity = "1";

        // Calculate days difference
        const targetDate = new Date(dateStr);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // We need to calculate the difference in days from TODAY to the TARGET DATE
        // Because updateTaskDueDate expects "days from today" (based on current implementation)
        // OR we should update updateTaskDueDate to accept a specific date.
        // Let's check updateTaskDueDate implementation.
        // It takes "daysToAdd".

        const diffTime = targetDate - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays < 0) {
            alert("Vous ne pouvez pas déplacer une tâche dans le passé !");
            return;
        }

        updateTaskDueDate(taskId, diffDays);
    }

    // Rendre les fonctions accessibles globalement pour les onclick
    window.toggleTaskCompletion = toggleTaskCompletion;
    window.distributeTaskFairly = distributeTaskFairly;
    window.takeTask = takeTask;
    window.updateTaskDueDate = updateTaskDueDate;
    window.toggleTaskCompletionDirect = toggleTaskCompletionDirect;
    window.deleteTaskFromCalendar = deleteTaskFromCalendar;
    window.loadTasks = loadTasks; // Expose loadTasks

    // Ajouter les écouteurs d'événements pour les onglets du calendrier
    document.getElementById('weekly-view-btn').addEventListener('click', switchToWeeklyView);
    document.getElementById('monthly-view-btn').addEventListener('click', switchToMonthlyView);

    // Ajouter l'écouteur d'événement pour le bouton de chargement manuel des tâches
    document.getElementById('load-tasks-btn').addEventListener('click', () => {
        loadTasks();
    });

    // Afficher le bouton de chargement manuel des tâches
    document.getElementById('manual-load-container').style.display = 'block';

    // Initialiser l'application
    initApp();
    loadTasks(); // Load tasks on startup
});