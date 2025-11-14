const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, '..', 'data.json');

/**
 * Reads data from the JSON file.
 * @returns {Promise<Object>} The parsed data object.
 */
async function readData() {
    try {
        if (!fs.existsSync(DB_FILE)) {
            console.warn(`[DB] Database file not found at ${DB_FILE}. Creating empty structure.`);
            return {
                hierarchy: {},
                resign_break_settings: {},
                user_resignation_data: {}
            };
        }
        const data = fs.readFileSync(DB_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error(`[DB] Error reading database file: ${error.message}. Returning empty object.`);
        return {
            hierarchy: {},
            resign_break_settings: {},
            user_resignation_data: {}
        };
    }
}

/**
 * Writes data to the JSON file.
 * @param {Object} data The data object to write.
 */
async function writeData(data) {
    try {
        const json = JSON.stringify(data, null, 2);
        fs.writeFileSync(DB_FILE, json, 'utf8');
    } catch (error) {
        console.error(`[DB] Error writing to database file: ${error.message}`);
    }
}

/**
 * Checks if a specific guild has the basic resignation/break settings configured.
 * @param {string} guildId The ID of the guild.
 * @returns {Promise<boolean>} True if settings exist, false otherwise.
 */
async function isGuildSetup(guildId) {
    const data = await readData();
    const settings = data.resign_break_settings[guildId];
    return !!settings && !!settings.break_role && !!settings.resign_role && !!settings.break_resign_channel;
}

module.exports = { readData, writeData, isGuildSetup };
