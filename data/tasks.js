const fs = require('fs').promises;
const path = require('path');

const tasksCache = {};

async function getTasks(familyId) {
    if (tasksCache[familyId]) {
        return tasksCache[familyId];
    }

    const filePath = path.join(__dirname, familyId, 'tasks.json');
    try {
        const data = await fs.readFile(filePath, 'utf8');
        tasksCache[familyId] = JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            tasksCache[familyId] = [];
            await fs.mkdir(path.join(__dirname, familyId), { recursive: true });
            await fs.writeFile(filePath, JSON.stringify([], null, 2));
        } else {
            console.error(`Failed to initialize tasks data for family ${familyId}:`, error);
            throw error;
        }
    }
    return tasksCache[familyId];
}

function saveTasks(familyId) {
    if (!tasksCache[familyId]) return;

    const filePath = path.join(__dirname, familyId, 'tasks.json');
    fs.writeFile(filePath, JSON.stringify(tasksCache[familyId], null, 2)).catch(err => {
        console.error(`Failed to save tasks data for family ${familyId}:`, err);
    });
}

async function getAllTasks(familyId) {
    return await getTasks(familyId);
}

async function addTask(familyId, title, difficulty, assignedTo, completed = false, repeat = null, dueDate = null, hasParent = null) {
    const tasks = await getTasks(familyId);

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
    saveTasks(familyId);
    return newTask;
}

async function updateTask(familyId, id, title, difficulty, assignedTo, completed, repeat, dueDate, hasParent) {
    const tasks = await getTasks(familyId);
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

    saveTasks(familyId);
    return task;
}

async function deleteTask(familyId, id, cascade = false) {
    const tasks = await getTasks(familyId);
    const initialLength = tasks.length;

    if (cascade) {
        tasksCache[familyId] = tasks.filter(task => task.id !== id && task.hasParent !== id);
    } else {
        tasksCache[familyId] = tasks.filter(task => task.id !== id);
    }

    if (tasksCache[familyId].length === initialLength) {
        throw new Error('Task not found');
    }
    saveTasks(familyId);
    return true;
}

async function updateTaskCompletion(familyId, id, completed) {
    const tasks = await getTasks(familyId);
    const taskIndex = tasks.findIndex(task => task.id === id);

    if (taskIndex === -1) {
        throw new Error('Task not found');
    }

    const task = tasks[taskIndex];
    const pointsChange = completed ? task.difficulty * 10 : -task.difficulty * 10;
    task.completed = completed;

    if (task.assignedTo) {
        const membersManager = require('./members');
        await membersManager.updateMemberPoints(familyId, task.assignedTo, pointsChange);
    }

    if (completed && task.repeat && task.repeat.enabled) {
        await createNextRepeatTask(familyId, task);
    }

    saveTasks(familyId);
    return task;
}

async function createNextRepeatTask(familyId, originalTask) {
    const tasks = await getTasks(familyId);
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
    saveTasks(familyId);
}

async function updateTasksForMemberDeletion(familyId, memberId) {
    const tasks = await getTasks(familyId);
    tasks.forEach(task => {
        if (task.assignedTo === memberId) {
            task.assignedTo = null;
        }
    });
    saveTasks(familyId);
}

async function generateFutureTasks(familyId, taskId) {
    const tasks = await getTasks(familyId);
    const task = tasks.find(t => t.id === taskId);
    if (!task || !task.repeat || !task.repeat.enabled) return;

    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();

    const endDate = new Date(currentYear, currentMonth + 2, 0);

    let nextDate = new Date(task.dueDate);
    nextDate.setDate(nextDate.getDate() + task.repeat.interval);

    const newTasks = [];

    while (nextDate <= endDate) {
        const dateStr = nextDate.toISOString().split('T')[0];

        const exists = tasks.some(t =>
            t.hasParent === task.id &&
            t.dueDate.split('T')[0] === dateStr
        );

        if (!exists) {
            const newTask = {
                id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
                title: task.title,
                difficulty: task.difficulty,
                assignedTo: null,
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
        if (task.assignedTo) {
            newTasks.forEach(t => t.assignedTo = task.assignedTo);
        } else {
            await distributeTasksFairly(familyId, newTasks);
        }
        saveTasks(familyId);
    }

    return newTasks;
}

async function distributeTasksFairly(familyId, newTasks) {
    const membersManager = require('./members');
    const members = await membersManager.getAllMembers(familyId);

    if (members.length === 0) return;

    const memberPoints = members.map(m => ({ id: m.id, points: m.points }));

    newTasks.forEach(task => {
        memberPoints.sort((a, b) => a.points - b.points);
        const targetMember = memberPoints[0];

        task.assignedTo = targetMember.id;
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