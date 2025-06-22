/**
 * Schema Capture Module
 * 
 * This module provides functionality for capturing and converting Zod schemas
 * to JSON Schema format with comprehensive metadata extraction, caching,
 * and safe object serialization for AI observability.
 * 
 * Key Features:
 * - Zod to JSON Schema conversion with error handling
 * - Schema metadata extraction (complexity, field analysis)
 * - LRU caching for performance optimization
 * - Safe object serialization with circular reference detection
 * - Configurable size limits and depth controls
 */

import { createHash } from 'crypto';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { log } from '../../scripts/modules/utils.js';

// Cache management
const schemaCache = new Map();
const CACHE_MAX_SIZE = 100;
const cacheStats = { hits: 0, misses: 0 };

function getCachedSchema(key) {
	if (schemaCache.has(key)) {
		cacheStats.hits++;
		return schemaCache.get(key);
	}
	cacheStats.misses++;
	return null;
}

function cacheSchemaConversion(key, result) {
	if (schemaCache.size >= CACHE_MAX_SIZE) {
		// Simple LRU: remove oldest entry
		const firstKey = schemaCache.keys().next().value;
		schemaCache.delete(firstKey);
	}
	schemaCache.set(key, result);
}

// Helper functions for object analysis
function calculateObjectDepth(obj, visited = new WeakSet(), depth = 0) {
	if (depth > 20 || obj === null || typeof obj !== 'object' || visited.has(obj)) {
		return depth;
	}
	
	visited.add(obj);
	let maxDepth = depth;
	
	try {
		if (Array.isArray(obj)) {
			for (const item of obj) {
				maxDepth = Math.max(maxDepth, calculateObjectDepth(item, visited, depth + 1));
			}
		} else {
			for (const value of Object.values(obj)) {
				maxDepth = Math.max(maxDepth, calculateObjectDepth(value, visited, depth + 1));
			}
		}
	} finally {
		visited.delete(obj);
	}
	
	return maxDepth;
}

function calculateObjectComplexity(obj, depth = 0) {
	if (depth > 10 || obj === null || typeof obj !== 'object') {
		return 1;
	}
	
	let complexity = 1;
	
	if (Array.isArray(obj)) {
		complexity += Math.min(obj.length * 0.1, 2);
		for (const item of obj.slice(0, 10)) {
			complexity += calculateObjectComplexity(item, depth + 1) * 0.3;
		}
	} else {
		const keys = Object.keys(obj);
		complexity += Math.min(keys.length * 0.1, 2);
		for (const key of keys.slice(0, 20)) {
			complexity += calculateObjectComplexity(obj[key], depth + 1) * 0.5;
		}
	}
	
	if (depth > 3) {
		complexity += (depth - 3) * 0.5;
	}
	
	return Math.min(Math.round(complexity * 10) / 10, 10);
}

function calculateSchemaDepth(schema, depth = 0) {
	if (depth > 20 || !schema || typeof schema !== 'object') {
		return depth;
	}
	
	let maxDepth = depth;
	
	if (schema.type === 'object' && schema.properties) {
		for (const prop of Object.values(schema.properties)) {
			maxDepth = Math.max(maxDepth, calculateSchemaDepth(prop, depth + 1));
		}
	} else if (schema.type === 'array' && schema.items) {
		maxDepth = Math.max(maxDepth, calculateSchemaDepth(schema.items, depth + 1));
	}
	
	return maxDepth;
}

/**
 * Converts a Zod schema to JSON Schema format with error handling and caching
 */
export function captureZodSchema(zodSchema, options = {}) {
	const opts = {
		name: 'anonymous',
		cache: false,
		maxSize: 10000,
		...options
	};

	try {
		// Validate input
		if (!zodSchema || typeof zodSchema !== 'object') {
			return {
				success: false,
				error: 'Invalid Zod schema provided',
				fallbackReason: 'invalid_schema'
			};
		}

		// Check if schema is cached
		const cacheKey = generateSchemaHash(zodSchema);
		if (opts.cache) {
			const cached = getCachedSchema(cacheKey);
			if (cached) {
				return {
					success: true,
					...cached,
					fromCache: true,
					timestamp: new Date().toISOString()
				};
			}
		}

		// Convert schema to JSON Schema
		const jsonSchema = zodToJsonSchema(zodSchema, {
			name: opts.name,
			target: 'jsonSchema7',
			strictUnions: true,
			errorMessages: true,
			markdownDescription: true,
			$refStrategy: 'seen'
		});

		// Check size limits
		const serialized = JSON.stringify(jsonSchema);
		if (serialized.length > opts.maxSize) {
			return {
				success: false,
				error: `Schema size (${serialized.length} bytes) exceeds limit (${opts.maxSize} bytes)`,
				fallbackReason: 'size_limit_exceeded'
			};
		}

		// Extract schema metadata
		const metadata = extractSchemaMetadata(zodSchema, jsonSchema);

		// Create result object
		const result = {
			success: true,
			jsonSchema,
			metadata,
			schemaHash: cacheKey,
			schemaVersion: generateSchemaVersion(jsonSchema),
			sizeBytes: serialized.length,
			conversionTimestamp: new Date().toISOString(),
			fromCache: false
		};

		// Cache the result if enabled
		if (opts.cache) {
			cacheSchemaConversion(cacheKey, result);
		}

		return result;
	} catch (error) {
		return {
			success: false,
			error: error.message,
			fallbackReason: 'conversion_failed'
		};
	}
}

/**
 * Generates a stable hash for a Zod schema to use as cache key
 */
export function generateSchemaHash(schema) {
	try {
		const schemaString = JSON.stringify(schema, Object.keys(schema).sort());
		const hash = createHash('md5').update(schemaString).digest('hex');
		return hash.substring(0, 8);
	} catch (error) {
		const fallback = createHash('md5').update(Date.now().toString()).digest('hex');
		return fallback.substring(0, 8);
	}
}

/**
 * Generates a semantic version for a schema based on its structure
 */
export function generateSchemaVersion(jsonSchema) {
	try {
		const timestamp = new Date().toISOString();
		const hash = createHash('md5').update(JSON.stringify(jsonSchema || {})).digest('hex').substring(0, 8);
		return `${timestamp}_${hash}`;
	} catch (error) {
		const timestamp = new Date().toISOString();
		const fallbackHash = createHash('md5').update(Date.now().toString()).digest('hex').substring(0, 8);
		return `${timestamp}_${fallbackHash}`;
	}
}

/**
 * Extracts comprehensive metadata from Zod and JSON schemas
 */
export function extractSchemaMetadata(zodSchema, jsonSchema) {
	if (!jsonSchema) {
		return {
			zodType: 'unknown',
			jsonSchemaType: 'unknown',
			timestamp: new Date().toISOString(),
			fieldCount: 0,
			depth: 0,
			types: [],
			hasNesting: false
		};
	}

	const metadata = {
		zodType: zodSchema?._def?.typeName || 'unknown',
		jsonSchemaType: jsonSchema.type || 'unknown',
		timestamp: new Date().toISOString()
	};

	// Extract field information
	if (jsonSchema.type === 'object' && jsonSchema.properties) {
		const properties = jsonSchema.properties;
		metadata.fieldCount = Object.keys(properties).length;
		metadata.requiredFields = jsonSchema.required?.length || 0;
		metadata.optionalFields = metadata.fieldCount - metadata.requiredFields;

		// Analyze field types
		const fieldTypes = {};
		for (const [key, prop] of Object.entries(properties)) {
			const type = prop.type || 'unknown';
			fieldTypes[type] = (fieldTypes[type] || 0) + 1;
		}
		metadata.fieldTypes = fieldTypes;
		metadata.types = Object.keys(fieldTypes);

		// Check for nesting
		metadata.hasNesting = Object.values(properties).some(
			(prop) => prop.type === 'object' || prop.type === 'array'
		);
		metadata.depth = calculateSchemaDepth(jsonSchema);
	} else if (jsonSchema.type === 'array') {
		metadata.fieldCount = 1;
		metadata.types = ['array'];
		metadata.hasNesting = jsonSchema.items?.type === 'object';
		metadata.depth = calculateSchemaDepth(jsonSchema);
	} else {
		metadata.fieldCount = 1;
		metadata.types = [jsonSchema.type || 'unknown'];
		metadata.hasNesting = false;
		metadata.depth = 1;
	}

	// Calculate complexity score
	metadata.complexityScore = calculateSchemaComplexity(jsonSchema);

	return metadata;
}

/**
 * Calculates a complexity score for a schema
 */
export function calculateSchemaComplexity(jsonSchema, depth = 0) {
	if (depth > 10) return 10;
	
	if (!jsonSchema || typeof jsonSchema !== 'object') {
		return 1;
	}

	let complexity = 1;

	try {
		if (jsonSchema.type === 'object' && jsonSchema.properties) {
			const properties = Object.keys(jsonSchema.properties);
			complexity += properties.length * 0.2;

			// Add complexity for nested objects
			for (const prop of Object.values(jsonSchema.properties)) {
				complexity += calculateSchemaComplexity(prop, depth + 1) * 0.5;
			}
		} else if (jsonSchema.type === 'array' && jsonSchema.items) {
			complexity += 0.5; // Arrays add some complexity
			complexity += calculateSchemaComplexity(jsonSchema.items, depth + 1) * 0.7;
		}

		// Penalize deep nesting exponentially
		if (depth > 3) {
			complexity += (depth - 3) ** 1.5;
		}
	} catch (error) {
		// Fallback complexity if calculation fails
		return Math.min(5, complexity);
	}

	return Math.min(Math.round(complexity * 10) / 10, 10);
}

/**
 * Safely serializes objects with circular reference detection and masking
 */
export function safeSerializeObject(obj, options = {}) {
	const opts = {
		maxDepth: 10,
		maskFields: [],
		...options
	};

	try {
		const visited = new WeakSet();
		const path = [];
		let hasCircularRefs = false;
		let depthLimited = false;

		function serialize(value, depth = 0) {
			if (depth >= opts.maxDepth) {
				depthLimited = true;
				return '[MAX_DEPTH_EXCEEDED]';
			}

			if (value === null) return null;
			if (value === undefined) return '[UNDEFINED]';

			if (typeof value !== 'object') {
				return value;
			}

			if (visited.has(value)) {
				hasCircularRefs = true;
				return '[Circular Reference]';
			}

			visited.add(value);

			try {
				if (Array.isArray(value)) {
					return value.map((item, index) => {
						path.push(`[${index}]`);
						const result = serialize(item, depth + 1);
						path.pop();
						return result;
					});
				}

				const result = {};
				for (const [key, val] of Object.entries(value)) {
					path.push(key);
					
					if (opts.maskFields.includes(key)) {
						result[key] = '[MASKED]';
					} else {
						result[key] = serialize(val, depth + 1);
					}
					
					path.pop();
				}
				return result;
			} finally {
				visited.delete(value);
			}
		}

		const serializedObj = serialize(obj);
		const serialized = JSON.stringify(serializedObj);
		const sizeBytes = new TextEncoder().encode(serialized).length;

		const metadata = {
			depth: calculateObjectDepth(obj),
			complexityScore: calculateObjectComplexity(obj)
		};

		return {
			success: true,
			serialized,
			sizeBytes,
			depth: metadata.depth,
			hasCircularRefs,
			depthLimited,
			metadata,
			timestamp: new Date().toISOString()
		};
	} catch (error) {
		return {
			success: false,
			error: error.message,
			serialized: null,
			sizeBytes: 0,
			timestamp: new Date().toISOString()
		};
	}
}

/**
 * Gets cache statistics
 */
export function getCacheStats() {
	return {
		size: schemaCache.size,
		maxSize: CACHE_MAX_SIZE,
		hitRate: cacheStats.hits / (cacheStats.hits + cacheStats.misses) || 0,
		hits: cacheStats.hits,
		misses: cacheStats.misses
	};
}

/**
 * Clears the schema cache
 */
export function clearSchemaCache() {
	schemaCache.clear();
	cacheStats.hits = 0;
	cacheStats.misses = 0;
}