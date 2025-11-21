const fs = require('fs').promises;
const path = require('path');

const filePath = path.join(__dirname, 'members.json');
let members = [];

// Asynchronously initialize members data from file
async function initializeMembers() {
    try {
        const data = await fs.readFile(filePath, 'utf8');
        members = JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            // File doesn't exist, initialize with an empty array
            await fs.writeFile(filePath, JSON.stringify([], null, 2));
        } else {
            console.error('Failed to initialize members data:', error);
            process.exit(1); // Exit if we can't read the data file
        }
    }
}

// Function to save data asynchronously
function saveMembers() {
    // No need to wait for this to complete. Fire and forget.
    fs.writeFile(filePath, JSON.stringify(members, null, 2)).catch(err => {
        console.error('Failed to save members data:', err);
    });
}

function getAllMembers() {
    return members;
}

function addMember(name) {
    const newMember = {
        id: Date.now().toString(),
        name,
        points: 0
    };
    members.push(newMember);
    saveMembers();
    return newMember;
}

function deleteMember(id) {
    const initialLength = members.length;
    members = members.filter(member => member.id !== id);
    if (members.length === initialLength) {
        throw new Error('Member not found');
    }
    saveMembers();

    // Also update tasks assigned to this member
    const tasksManager = require('./tasks');
    tasksManager.updateTasksForMemberDeletion(id);
}

function updateMemberPoints(memberId, pointsChange) {
    const member = members.find(m => m.id === memberId);

    if (member) {
        member.points = Math.max(0, member.points + pointsChange);
        saveMembers();
        return member;
    }

    return null;
}

// Initialize data on module load and export functions
initializeMembers();

module.exports = {
    getAllMembers,
    addMember,
    deleteMember,
    updateMemberPoints
};