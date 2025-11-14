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
            return {};
        }
        const data = fs.readFileSync(DB_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error(`[DB] Error reading database file: ${error.message}. Returning empty object.`);
        return {};
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

module.exports = { readData, writeData };
