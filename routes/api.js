const express = require('express');
const router = express.Router();

// Import data managers
const membersManager = require('../data/members');
const tasksManager = require('../data/tasks');

// Members routes
router.get('/members', (req, res) => {
    try {
        const members = membersManager.getAllMembers();
        res.json(members);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/members', (req, res) => {
    try {
        const { name } = req.body;
        const newMember = membersManager.addMember(name);
        res.status(201).json(newMember);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

router.delete('/members/:id', (req, res) => {
    try {
        const { id } = req.params;
        membersManager.deleteMember(id);
        res.status(204).send();
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Tasks routes
router.get('/tasks', (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        let tasks = tasksManager.getAllTasks();

        if (startDate && endDate) {
            const start = new Date(startDate);
            const end = new Date(endDate);
            // Set end date to end of day to include tasks on that day
            end.setHours(23, 59, 59, 999);

            tasks = tasks.filter(task => {
                if (!task.dueDate) return false;
                const taskDate = new Date(task.dueDate);
                return taskDate >= start && taskDate <= end;
            });
        }

        res.json(tasks);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/tasks', (req, res) => {
    try {
        const { title, difficulty, assignedTo, completed, repeat, dueDate, hasParent } = req.body;
        const newTask = tasksManager.addTask(title, difficulty, assignedTo, completed, repeat, dueDate, hasParent);
        res.status(201).json(newTask);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

router.put('/tasks/:id', (req, res) => {
    try {
        const { id } = req.params;
        const { title, difficulty, assignedTo, completed, repeat, dueDate, hasParent } = req.body;
        const updatedTask = tasksManager.updateTask(id, title, difficulty, assignedTo, completed, repeat, dueDate, hasParent);

        res.json(updatedTask);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

router.delete('/tasks/:id', (req, res) => {
    try {
        const { id } = req.params;
        const { cascade } = req.query;
        tasksManager.deleteTask(id, cascade === 'true');
        res.status(204).send();
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

router.put('/tasks/:id/complete', (req, res) => {
    try {
        const { id } = req.params;
        const { completed } = req.body;
        const updatedTask = tasksManager.updateTaskCompletion(id, completed);
        res.json(updatedTask);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

router.post('/tasks/generate-future', (req, res) => {
    try {
        const { taskId } = req.body;
        const newTasks = tasksManager.generateFutureTasks(taskId);
        res.status(201).json(newTasks || []);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

module.exports = router;