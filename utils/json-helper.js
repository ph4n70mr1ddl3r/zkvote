import fs from 'fs';
import path from 'path';

export function readAndValidateJsonFile(filePath, schema) {
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

function validateSchema(data, schema) {
    if (schema.requiredFields) {
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
}
