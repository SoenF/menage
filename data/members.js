const fs = require('fs').promises;
const path = require('path');

const membersCache = {};

async function getMembers(familyId) {
    if (membersCache[familyId]) {
        return membersCache[familyId];
    }

    const filePath = path.join(__dirname, familyId, 'members.json');
    try {
        const data = await fs.readFile(filePath, 'utf8');
        membersCache[familyId] = JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            membersCache[familyId] = [];
            // Ensure directory exists
            await fs.mkdir(path.join(__dirname, familyId), { recursive: true });
            await fs.writeFile(filePath, JSON.stringify([], null, 2));
        } else {
            console.error(`Failed to initialize members data for family ${familyId}:`, error);
            throw error;
        }
    }
    return membersCache[familyId];
}

function saveMembers(familyId) {
    if (!membersCache[familyId]) return;

    const filePath = path.join(__dirname, familyId, 'members.json');
    fs.writeFile(filePath, JSON.stringify(membersCache[familyId], null, 2)).catch(err => {
        console.error(`Failed to save members data for family ${familyId}:`, err);
    });
}

async function getAllMembers(familyId) {
    return await getMembers(familyId);
}

async function addMember(familyId, name) {
    const members = await getMembers(familyId);
    const newMember = {
        id: Date.now().toString(),
        name,
        points: 0
    };
    members.push(newMember);
    saveMembers(familyId);
    return newMember;
}

async function deleteMember(familyId, id) {
    const members = await getMembers(familyId);
    const initialLength = members.length;
    membersCache[familyId] = members.filter(member => member.id !== id);

    if (membersCache[familyId].length === initialLength) {
        throw new Error('Member not found');
    }
    saveMembers(familyId);

    // Also update tasks assigned to this member
    const tasksManager = require('./tasks');
    await tasksManager.updateTasksForMemberDeletion(familyId, id);
}

async function updateMemberPoints(familyId, memberId, pointsChange) {
    const members = await getMembers(familyId);
    const member = members.find(m => m.id === memberId);

    if (member) {
        member.points = Math.max(0, member.points + pointsChange);
        saveMembers(familyId);
        return member;
    }

    return null;
}

module.exports = {
    getAllMembers,
    addMember,
    deleteMember,
    updateMemberPoints
};