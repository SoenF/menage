const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'data', 'rooms.json');

// Initialize rooms data file if it doesn't exist
function initializeRoomsFile() {
    if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, JSON.stringify([], null, 2));
    }
}

initializeRoomsFile();

function getAllRooms() {
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
}

function addRoom(name) {
    const rooms = getAllRooms();
    const newRoom = {
        id: Date.now().toString(),
        name
    };
    rooms.push(newRoom);
    fs.writeFileSync(filePath, JSON.stringify(rooms, null, 2));
    return newRoom;
}

function deleteRoom(id) {
    const rooms = getAllRooms();
    const filteredRooms = rooms.filter(room => room.id !== id);
    if (rooms.length === filteredRooms.length) {
        throw new Error('Room not found');
    }
    fs.writeFileSync(filePath, JSON.stringify(filteredRooms, null, 2));
    
    // Also update tasks associated with this room
    const tasksManager = require('./tasks');
    tasksManager.updateTasksForRoomDeletion(id);
}

function updateTasksForRoomDeletion(roomId) {
    const tasksManager = require('./tasks');
    const tasks = tasksManager.getAllTasks();
    const updatedTasks = tasks.map(task => {
        if (task.room === roomId) {
            return { ...task, room: null };
        }
        return task;
    });

    fs.writeFileSync(tasksManager.getFilePath(), JSON.stringify(updatedTasks, null, 2));
}

// Helper function to get the file path
function getFilePath() {
    return filePath;
}

module.exports = {
    getAllRooms,
    addRoom,
    deleteRoom,
    updateTasksForRoomDeletion,
    getFilePath
};