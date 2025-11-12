const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'hierarchy.json');

// Ensure the JSON file exists
if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify({}));
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
        return {};
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

/**
 * Gets the stored role hierarchy for a specific guild.
 * @param {string} guildId The ID of the guild.
 * @returns {Array<string>|null} An array of role IDs (lowest to highest), or null if not set.
 */
function getHierarchyRoles(guildId) {
    const db = readDb();
    // Roles are stored as an array of IDs, lowest index is lowest rank.
    return db[guildId] || null;
}

/**
 * Sets the role hierarchy for a specific guild.
 * @param {string} guildId The ID of the guild.
 * @param {Array<string>} roleIds An array of role IDs (lowest to highest).
 */
function setHierarchyRoles(guildId, roleIds) {
    const db = readDb();
    db[guildId] = roleIds;
    writeDb(db);
}

module.exports = {
    getHierarchyRoles,
    setHierarchyRoles,
};