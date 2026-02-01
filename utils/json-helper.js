import fs from 'fs';
import path from 'path';

/**
 * Read and validate a JSON file from the filesystem
 * @param {string} filePath - Path to the JSON file
 * @param {Object} schema - Validation schema with optional fields: requiredFields, isArray, objectType
 * @returns {Object|Array} Parsed and validated JSON data
 * @throws {Error} If file doesn't exist, cannot be parsed, or fails validation
 */
export function readAndValidateJsonFile(filePath, schema) {
    if (!filePath || typeof filePath !== 'string') {
        throw new TypeError('File path must be a non-empty string');
    }
    if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
    }

    let data;
    try {
        data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (error) {
        throw new Error(`Failed to parse JSON file ${path.basename(filePath)}: ${error.message}`);
    }

    if (schema) {
        validateSchema(data, schema);
    }

    return data;
}

/**
 * Validate data against a schema
 * @param {*} data - Data to validate
 * @param {Object} schema - Validation schema
 * @throws {Error} If validation fails
 */
function validateSchema(data, schema) {
    if (schema.requiredFields) {
        if (!Array.isArray(schema.requiredFields)) {
            throw new Error('Schema requiredFields must be an array');
        }
        for (const field of schema.requiredFields) {
            if (!(field in data)) {
                throw new Error(`Missing required field: ${field}`);
            }
        }
    }

    if (schema.isArray && !Array.isArray(data)) {
        throw new Error('Expected data to be an array');
    }

    if (schema.objectType && typeof data !== 'object') {
        throw new Error(`Expected data to be an object, got ${typeof data}`);
    }

    if (schema.nonEmpty && Array.isArray(data) && data.length === 0) {
        throw new Error('Expected data to be non-empty array');
    }
}

/**
 * Write JSON data to a file
 * @param {string} filePath - Path to the file
 * @param {Object|Array} data - Data to write
 * @throws {Error} If file cannot be written
 */
export function writeJsonFile(filePath, data) {
    if (!filePath || typeof filePath !== 'string') {
        throw new TypeError('File path must be a non-empty string');
    }

    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    } catch (error) {
        throw new Error(`Failed to write JSON file ${path.basename(filePath)}: ${error.message}`);
    }
}
