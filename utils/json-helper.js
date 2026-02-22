import fs from 'fs';
import path from 'path';

const MAX_JSON_FILE_SIZE_BYTES = 50 * 1024 * 1024;

export function readAndValidateJsonFile(filePath, schema) {
    if (!filePath || typeof filePath !== 'string') {
        throw new TypeError('File path must be a non-empty string');
    }
    if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
    }

    const stats = fs.statSync(filePath);
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
        data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (error) {
        throw new Error(`Failed to parse JSON file ${path.basename(filePath)}: ${error.message}`);
    }

    if (schema) {
        validateSchema(data, schema);
    }

    return data;
}

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
