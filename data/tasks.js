const fs = require('fs').promises;
const path = require('path');

const filePath = path.join(__dirname, 'tasks.json');
let tasks = [];

// Asynchronously initialize tasks data from file
async function initializeTasks() {
    try {
        const data = await fs.readFile(filePath, 'utf8');
        tasks = JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            await fs.writeFile(filePath, JSON.stringify([], null, 2));
        } else {
            console.error('Failed to initialize tasks data:', error);
            process.exit(1);
        }
    }
}

// Function to save data asynchronously
function saveTasks() {
    fs.writeFile(filePath, JSON.stringify(tasks, null, 2)).catch(err => {
        console.error('Failed to save tasks data:', err);
    });
}

// Initialize data on module load
initializeTasks();

function getAllTasks() {
    return tasks;
}

function addTask(title, difficulty, assignedTo, completed = false, repeat = null, dueDate = null, hasParent = null) {
    if (![1, 2, 3].includes(parseInt(difficulty))) {
        throw new Error('Difficulty must be 1, 2, or 3');
    }

    if (!dueDate) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        dueDate = tomorrow.toISOString();
    }

    const newTask = {
        id: Date.now().toString(),
        title,
        difficulty: parseInt(difficulty),
        assignedTo: assignedTo || null,
        completed: completed,
        repeat: repeat || { enabled: false, interval: 3, nextDate: new Date().toISOString() },
        dueDate: dueDate,
        hasParent: hasParent || null,
        createdAt: new Date().toISOString()
    };

    tasks.push(newTask);
    saveTasks();
    return newTask;
}

function updateTask(id, title, difficulty, assignedTo, completed, repeat, dueDate, hasParent) {
    const taskIndex = tasks.findIndex(task => task.id === id);

    if (taskIndex === -1) {
        throw new Error('Task not found');
    }

    if (difficulty !== undefined && ![1, 2, 3].includes(parseInt(difficulty))) {
        throw new Error('Difficulty must be 1, 2, or 3');
    }

    const task = tasks[taskIndex];
    if (title !== undefined) task.title = title;
    if (difficulty !== undefined) task.difficulty = parseInt(difficulty);
    if (assignedTo !== undefined) task.assignedTo = assignedTo;
    if (completed !== undefined) task.completed = completed;
    if (repeat !== undefined) task.repeat = repeat;
    if (dueDate !== undefined) task.dueDate = dueDate;
    if (hasParent !== undefined) task.hasParent = hasParent;

    saveTasks();
    return task;
}

function deleteTask(id, cascade = false) {
    const initialLength = tasks.length;

    if (cascade) {
        // Delete the task AND all tasks that have this task as parent
        tasks = tasks.filter(task => task.id !== id && task.hasParent !== id);
    } else {
        tasks = tasks.filter(task => task.id !== id);
    }

    if (tasks.length === initialLength) {
        // If nothing was deleted, maybe the ID was a child task?
        // If cascade is true, we might want to try deleting by parent ID if the ID passed was a parent?
        // But for now, let's stick to the ID passed.
        // If we are deleting a child task, we just delete that child.
        // If we are deleting a parent task with cascade, we delete parent + children.
        throw new Error('Task not found');
    }
    saveTasks();
    return true;
}

function updateTaskCompletion(id, completed) {
    const taskIndex = tasks.findIndex(task => task.id === id);

    if (taskIndex === -1) {
        throw new Error('Task not found');
    }

    const task = tasks[taskIndex];
    const pointsChange = completed ? task.difficulty * 10 : -task.difficulty * 10;
    task.completed = completed;

    if (task.assignedTo) {
        const membersManager = require('./members');
        membersManager.updateMemberPoints(task.assignedTo, pointsChange);
    }

    if (completed && task.repeat && task.repeat.enabled) {
        createNextRepeatTask(task);
    }

    saveTasks();
    return task;
}

function createNextRepeatTask(originalTask) {
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + originalTask.repeat.interval);

    const newDueDate = new Date();
    newDueDate.setDate(newDueDate.getDate() + originalTask.repeat.interval);

    const newTask = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        title: originalTask.title,
        difficulty: originalTask.difficulty,
        assignedTo: originalTask.assignedTo,
        completed: false,
        dueDate: newDueDate.toISOString(),
        repeat: { ...originalTask.repeat, nextDate: nextDate.toISOString() },
        createdAt: new Date().toISOString()
    };

    tasks.push(newTask);
    saveTasks();
}

function updateTasksForMemberDeletion(memberId) {
    tasks.forEach(task => {
        if (task.assignedTo === memberId) {
            task.assignedTo = null;
        }
    });
    saveTasks();
}

function generateFutureTasks(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (!task || !task.repeat || !task.repeat.enabled) return;

    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();

    // Calculate end date: end of next month
    const endDate = new Date(currentYear, currentMonth + 2, 0);

    let nextDate = new Date(task.dueDate);
    // Start from the next interval
    nextDate.setDate(nextDate.getDate() + task.repeat.interval);

    const newTasks = [];

    while (nextDate <= endDate) {
        const dateStr = nextDate.toISOString().split('T')[0];

        // Check if instance already exists
        const exists = tasks.some(t =>
            t.hasParent === task.id &&
            t.dueDate.split('T')[0] === dateStr
        );

        if (!exists) {
            const newTask = {
                id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
                title: task.title,
                difficulty: task.difficulty,
                assignedTo: null, // Will be distributed later
                completed: false,
                dueDate: nextDate.toISOString(),
                repeat: { ...task.repeat, nextDate: nextDate.toISOString() },
                hasParent: task.id,
                createdAt: new Date().toISOString()
            };
            tasks.push(newTask);
            newTasks.push(newTask);
        }

        nextDate.setDate(nextDate.getDate() + task.repeat.interval);
    }

    if (newTasks.length > 0) {
        // If the parent task has an assignee, use it for all new tasks
        if (task.assignedTo) {
            newTasks.forEach(t => t.assignedTo = task.assignedTo);
        } else {
            // Otherwise distribute fairly
            distributeTasksFairly(newTasks);
        }
        saveTasks();
    }

    return newTasks;
}

function distributeTasksFairly(newTasks) {
    const membersManager = require('./members');
    const members = membersManager.getAllMembers();

    if (members.length === 0) return;

    // Sort members by points (ascending)
    // We create a local copy of points to simulate distribution without saving yet
    const memberPoints = members.map(m => ({ id: m.id, points: m.points }));

    newTasks.forEach(task => {
        // Sort to find member with least points currently
        memberPoints.sort((a, b) => a.points - b.points);
        const targetMember = memberPoints[0];

        task.assignedTo = targetMember.id;

        // Simulate point addition for next iteration
        targetMember.points += task.difficulty * 10;
    });
}

module.exports = {
    getAllTasks,
    addTask,
    updateTask,
    deleteTask,
    updateTaskCompletion,
    updateTasksForMemberDeletion,
    generateFutureTasks
};