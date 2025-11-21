const fs = require('fs').promises;
const path = require('path');
const bcrypt = require('bcryptjs');

const filePath = path.join(__dirname, 'families.json');
let families = [];

// Asynchronously initialize families data from file
async function initializeFamilies() {
    try {
        const data = await fs.readFile(filePath, 'utf8');
        families = JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            await fs.writeFile(filePath, JSON.stringify([], null, 2));
        } else {
            console.error('Failed to initialize families data:', error);
            process.exit(1);
        }
    }
}

function saveFamilies() {
    fs.writeFile(filePath, JSON.stringify(families, null, 2)).catch(err => {
        console.error('Failed to save families data:', err);
    });
}

initializeFamilies();

function findFamilyByUsername(username) {
    return families.find(f => f.username === username);
}

function findFamilyById(id) {
    return families.find(f => f.id === id);
}

async function createFamily(username, password) {
    if (findFamilyByUsername(username)) {
        throw new Error('Username already exists');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newFamily = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        username,
        password: hashedPassword,
        createdAt: new Date().toISOString()
    };

    families.push(newFamily);
    saveFamilies();
    
    // Create data directory for this family
    const familyDataDir = path.join(__dirname, newFamily.id);
    try {
        await fs.mkdir(familyDataDir, { recursive: true });
    } catch (error) {
        console.error(`Failed to create data directory for family ${newFamily.id}:`, error);
    }

    return { id: newFamily.id, username: newFamily.username };
}

async function verifyFamily(username, password) {
    const family = findFamilyByUsername(username);
    if (!family) return null;

    const isMatch = await bcrypt.compare(password, family.password);
    if (!isMatch) return null;

    return { id: family.id, username: family.username };
}

module.exports = {
    createFamily,
    verifyFamily,
    findFamilyById
};
