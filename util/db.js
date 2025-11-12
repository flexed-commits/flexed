const fs = require('fs');
const path = require('path');

// The single persistent data file for all configurations and user data
const DB_PATH = path.join(__dirname, '..', 'data.json'); 

// Ensure the JSON file exists with a base structure
if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify({
        hierarchy: {}, // Stores the role hierarchy (guildId: roleId[])
        settings: {},  // Stores break/resign settings (guildId: {settings})
        user_data: {}  // Stores resigned user's roles (userId: {data})
    }, null, 2));
}

/**
 * Reads the entire database state from the JSON file.
 * @returns {object} The database object.
 */
function readDb() {
    try {
        const data = fs.readFileSync(DB_PATH, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error("Error reading database file:", error);
        // Return a default, empty structure on error to prevent crashes
        return { hierarchy: {}, settings: {}, user_data: {} };
    }
}

/**
 * Writes the entire database state to the JSON file.
 * @param {object} data The database object to write.
 */
function writeDb(data) {
    try {
        fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
    } catch (error) {
        console.error("Error writing database file:", error);
    }
}

// --- Hierarchy Functions (for Promote/Demote) ---

function getHierarchyRoles(guildId) {
    const db = readDb();
    return db.hierarchy[guildId] || null;
}

function setHierarchyRoles(guildId, roleIds) {
    const db = readDb();
    db.hierarchy[guildId] = roleIds;
    writeDb(db);
}

// --- Break/Resign Settings Functions ---

function getResignBreakSettings(guildId) {
    const db = readDb();
    return db.settings[guildId] || null;
}

function setResignBreakSettings(guildId, settings) {
    const db = readDb();
    db.settings[guildId] = settings;
    writeDb(db);
}

// --- User Resignation Data Functions ---

/**
 * Saves a user's roles when they resign, along with the ID of the DM message 
 * that contains the comeback button, allowing it to be disabled later.
 */
function saveUserHierarchyAndRoles(userId, rolesToSave, messageId, guildId) {
    const db = readDb();
    db.user_data[userId] = {
        saved_roles: rolesToSave,
        comeback_request_message_id: messageId,
        resignation_timestamp: Date.now(),
        guild_id: guildId // Store guild context for comeback
    };
    writeDb(db);
}

function getUserHierarchyAndRoles(userId) {
    const db = readDb();
    return db.user_data[userId] || null;
}

function deleteUserResignationData(userId) {
    const db = readDb();
    delete db.user_data[userId];
    writeDb(db);
}


module.exports = {
    getHierarchyRoles,
    setHierarchyRoles,
    
    getResignBreakSettings,
    setResignBreakSettings,
    
    saveUserHierarchyAndRoles,
    getUserHierarchyAndRoles,
    deleteUserResignationData
};