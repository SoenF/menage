const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const familiesManager = require('../data/families');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';

router.post('/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }

        const family = await familiesManager.createFamily(username, password);
        const token = jwt.sign({ familyId: family.id, username: family.username }, JWT_SECRET, { expiresIn: '30d' });

        res.status(201).json({ token, family });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }

        const family = await familiesManager.verifyFamily(username, password);
        if (!family) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign({ familyId: family.id, username: family.username }, JWT_SECRET, { expiresIn: '30d' });

        res.json({ token, family });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
