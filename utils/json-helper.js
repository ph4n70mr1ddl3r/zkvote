import fs from 'fs';
import path from 'path';
import { MAX_JSON_FILE_SIZE_BYTES } from './constants.js';

/**
 * Read and validate a JSON file with schema checking and path traversal protection.
 * Ensures file is within project directory and doesn't exceed size limits.
 * @param {string} filePath - Path to JSON file (relative to project root or absolute)
 * @param {Object} [schema] - Validation schema object (optional)
 * @param {Array<string>} [schema.requiredFields] - Fields that must be present in object
 * @param {boolean} [schema.isArray] - If true, data must be an array
 * @param {boolean} [schema.nonEmpty] - If true, array must not be empty
 * @returns {*} Parsed and validated JSON data
 * @throws {TypeError} If filePath is not a string
 * @throws {Error} If path traversal detected, file not found, or validation fails
 */
export function readAndValidateJsonFile(filePath, schema) {
    if (!filePath || typeof filePath !== 'string') {
        throw new TypeError('File path must be a non-empty string');
    }

    const resolvedPath = path.resolve(filePath);
    const cwd = process.cwd();
    if (!resolvedPath.startsWith(cwd)) {
        throw new Error('Path traversal detected: file path must be within project directory');
    }

    let realPath;
    try {
        realPath = fs.realpathSync(resolvedPath);
    } catch (/** @type {Error} */ error) {
        throw new Error(`Cannot resolve real path: ${error.message}`);
    }
    if (!realPath.startsWith(cwd)) {
        throw new Error('Path traversal detected via symlink');
    }

    if (!fs.existsSync(realPath)) {
        throw new Error(`File not found: ${filePath}`);
    }

    const stats = fs.statSync(realPath);
    if (stats.size > MAX_JSON_FILE_SIZE_BYTES) {
        throw new Error(
            `JSON file exceeds maximum size of ${MAX_JSON_FILE_SIZE_BYTES / 1024 / 1024}MB`
        );
    }
    if (stats.size === 0) {
        throw new Error(`JSON file is empty: ${filePath}`);
    }

    let data;
    try {
        data = JSON.parse(fs.readFileSync(realPath, 'utf8'));
    } catch (/** @type {SyntaxError} */ error) {
        throw new Error(`Failed to parse JSON file ${path.basename(realPath)}: ${error.message}`);
    }

    if (schema) {
        validateSchema(data, schema);
    }

    return data;
}

/**
 * Validate parsed JSON data against a schema.
 * @param {*} data - Parsed JSON data to validate
 * @param {Object} schema - Schema to validate against
 * @throws {Error} If validation fails
 */
function validateSchema(data, schema) {
    if (schema.requiredFields) {
        if (!Array.isArray(schema.requiredFields)) {
            throw new Error('Schema requiredFields must be an array');
        }
        if (typeof data !== 'object' || data === null) {
            throw new Error('Cannot validate requiredFields on non-object data');
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

    if (schema.nonEmpty && Array.isArray(data) && data.length === 0) {
        throw new Error('Expected data to be non-empty array');
    }
}

/**
 * Write data to a JSON file with pretty formatting.
 * Creates parent directories if they don't exist.
 * Includes path traversal protection.
 * @param {string} filePath - Path to write JSON file to
 * @param {*} data - Data to serialize as JSON
 * @throws {TypeError} If filePath is not a string
 * @throws {Error} If path traversal detected or write fails
 */
export function writeJsonFile(filePath, data) {
    if (!filePath || typeof filePath !== 'string') {
        throw new TypeError('File path must be a non-empty string');
    }

    const resolvedPath = path.resolve(filePath);
    const cwd = process.cwd();
    if (!resolvedPath.startsWith(cwd)) {
        throw new Error('Path traversal detected: file path must be within project directory');
    }

    const dir = path.dirname(resolvedPath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    try {
        fs.writeFileSync(resolvedPath, JSON.stringify(data, null, 2));
    } catch (/** @type {Error} */ error) {
        throw new Error(
            `Failed to write JSON file ${path.basename(resolvedPath)}: ${error.message}`
        );
    }
}

/**
 * Perform a constant-time string comparison to prevent timing attacks.
 * Compares two strings character by character regardless of where they differ.
 * @param {string} a - First string to compare
 * @param {string} b - Second string to compare
 * @returns {boolean} True if strings are identical, false otherwise
 */
export function constantTimeCompare(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string') {
        return false;
    }

    const maxLen = Math.max(a.length, b.length);
    let result = a.length ^ b.length;

    for (let i = 0; i < maxLen; i++) {
        const aChar = i < a.length ? a.charCodeAt(i) : 0;
        const bChar = i < b.length ? b.charCodeAt(i) : 0;
        result |= aChar ^ bChar;
    }

    return result === 0;
}
