const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');

// Import data managers
const membersManager = require('../data/members');
const tasksManager = require('../data/tasks');
const familiesManager = require('../data/families');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';

// Authentication Middleware
const authenticate = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized: No token provided' });
    }

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);

        // Verify that the family still exists
        const family = await familiesManager.findFamilyById(decoded.familyId);
        if (!family) {
            return res.status(401).json({ error: 'Unauthorized: Family not found' });
        }

        req.familyId = decoded.familyId;
        next();
    } catch (error) {
        return res.status(403).json({ error: 'Forbidden: Invalid token' });
    }
};

// Apply middleware to all API routes
router.use(authenticate);

// Members routes
router.get('/members', async (req, res) => {
    try {
        const members = await membersManager.getAllMembers(req.familyId);
        res.json(members);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/members', async (req, res) => {
    try {
        const { name } = req.body;
        const newMember = await membersManager.addMember(req.familyId, name);
        res.status(201).json(newMember);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

router.delete('/members/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await membersManager.deleteMember(req.familyId, id);
        res.status(204).send();
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Tasks routes
router.get('/tasks', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        let tasks = await tasksManager.getAllTasks(req.familyId);

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

router.post('/tasks', async (req, res) => {
    try {
        const { title, difficulty, assignedTo, completed, repeat, dueDate, hasParent } = req.body;
        const newTask = await tasksManager.addTask(req.familyId, title, difficulty, assignedTo, completed, repeat, dueDate, hasParent);
        res.status(201).json(newTask);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

router.put('/tasks/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { title, difficulty, assignedTo, completed, repeat, dueDate, hasParent } = req.body;
        const updatedTask = await tasksManager.updateTask(req.familyId, id, title, difficulty, assignedTo, completed, repeat, dueDate, hasParent);

        res.json(updatedTask);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

router.delete('/tasks/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { cascade } = req.query;
        await tasksManager.deleteTask(req.familyId, id, cascade === 'true');
        res.status(204).send();
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

router.put('/tasks/:id/complete', async (req, res) => {
    try {
        const { id } = req.params;
        const { completed } = req.body;
        const updatedTask = await tasksManager.updateTaskCompletion(req.familyId, id, completed);
        res.json(updatedTask);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

router.post('/tasks/generate-future', async (req, res) => {
    try {
        const { taskId } = req.body;
        const newTasks = await tasksManager.generateFutureTasks(req.familyId, taskId);
        res.status(201).json(newTasks || []);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

module.exports = router;