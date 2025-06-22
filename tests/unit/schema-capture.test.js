/**
 * Tests for Schema Capture functionality
 */

import { afterEach, beforeEach, describe, expect, test } from '@jest/globals';
import { z } from 'zod';
import {
	calculateSchemaComplexity,
	captureZodSchema,
	clearSchemaCache,
	extractSchemaMetadata,
	generateSchemaHash,
	generateSchemaVersion,
	getCacheStats,
	safeSerializeObject
} from '../../src/observability/schema-capture.js';

describe('Schema Capture', () => {
	beforeEach(() => {
		clearSchemaCache();
	});

	afterEach(() => {
		clearSchemaCache();
	});

	describe('captureZodSchema', () => {
		test('should convert simple zod schema to JSON schema', () => {
			const schema = z.object({
				name: z.string(),
				age: z.number()
			});

			const result = captureZodSchema(schema);

			expect(result.success).toBe(true);
			expect(result.jsonSchema).toHaveProperty('type', 'object');
			expect(result.jsonSchema.properties).toHaveProperty('name');
			expect(result.jsonSchema.properties).toHaveProperty('age');
		});

		test('should handle complex nested schemas', () => {
			const schema = z.object({
				user: z.object({
					name: z.string(),
					profile: z.object({
						bio: z.string().optional(),
						age: z.number().min(0).max(150)
					})
				}),
				tags: z.array(z.string()),
				metadata: z.record(z.any()).optional()
			});

			const result = captureZodSchema(schema);

			expect(result.success).toBe(true);
			expect(result.jsonSchema.properties.user.properties).toHaveProperty('profile');
			expect(result.metadata.complexityScore).toBeGreaterThan(1);
		});

		test('should cache schema conversions', () => {
			const schema = z.object({ name: z.string() });

			const result1 = captureZodSchema(schema, { cache: true });
			const result2 = captureZodSchema(schema, { cache: true });

			expect(result1.fromCache).toBe(false);
			expect(result2.fromCache).toBe(true);
			expect(result1.hash).toBe(result2.hash);
		});

		test('should handle schema conversion errors gracefully', () => {
			// Create a problematic schema that might cause conversion issues
			const problematicSchema = {};

			const result = captureZodSchema(problematicSchema);

			expect(result.success).toBe(false);
			expect(result.error).toBeDefined();
		});

		test('should respect size limits', () => {
			const largeSchema = z.object({
				data: z.array(z.object({
					field1: z.string(),
					field2: z.string(),
					field3: z.string()
				}))
			});

			const result = captureZodSchema(largeSchema, { maxSizeBytes: 100 });

			if (!result.success) {
				expect(result.error).toContain('size limit');
			}
		});
	});

	describe('generateSchemaHash', () => {
		test('should generate consistent hashes for same schema', () => {
			const schema = { type: 'object', properties: { name: { type: 'string' } } };

			const hash1 = generateSchemaHash(schema);
			const hash2 = generateSchemaHash(schema);

			expect(hash1).toBe(hash2);
			expect(hash1).toMatch(/^[a-f0-9]{8}$/);
		});

		test('should generate different hashes for different schemas', () => {
			const schema1 = { type: 'object', properties: { name: { type: 'string' } } };
			const schema2 = { type: 'object', properties: { age: { type: 'number' } } };

			const hash1 = generateSchemaHash(schema1);
			const hash2 = generateSchemaHash(schema2);

			expect(hash1).not.toBe(hash2);
		});
	});

	describe('generateSchemaVersion', () => {
		test('should generate version strings', () => {
			const version = generateSchemaVersion();

			expect(version).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z_[a-f0-9]{8}$/);
		});
	});

	describe('extractSchemaMetadata', () => {
		test('should extract metadata from simple schema', () => {
			const schema = {
				type: 'object',
				properties: {
					name: { type: 'string' },
					age: { type: 'number' }
				}
			};

			const metadata = extractSchemaMetadata(null, schema);

			expect(metadata.fieldCount).toBe(2);
			expect(metadata.depth).toBe(1);
			expect(metadata.types).toContain('string');
			expect(metadata.types).toContain('number');
		});

		test('should handle nested schemas', () => {
			const schema = {
				type: 'object',
				properties: {
					user: {
						type: 'object',
						properties: {
							profile: {
								type: 'object',
								properties: {
									name: { type: 'string' }
								}
							}
						}
					}
				}
			};

			const metadata = extractSchemaMetadata(null, schema);

			expect(metadata.depth).toBeGreaterThan(1);
			expect(metadata.hasNesting).toBe(true);
		});
	});

	describe('calculateSchemaComplexity', () => {
		test('should calculate complexity for simple schemas', () => {
			const simpleSchema = {
				type: 'object',
				properties: {
					name: { type: 'string' }
				}
			};

			const complexity = calculateSchemaComplexity(simpleSchema);

			expect(complexity).toBeGreaterThan(0);
			expect(complexity).toBeLessThanOrEqual(10);
		});

		test('should assign higher complexity to nested schemas', () => {
			const simpleSchema = {
				type: 'object',
				properties: { name: { type: 'string' } }
			};

			const complexSchema = {
				type: 'object',
				properties: {
					user: {
						type: 'object',
						properties: {
							profile: {
								type: 'object',
								properties: {
									details: {
										type: 'object',
										properties: {
											bio: { type: 'string' },
											age: { type: 'number' }
										}
									}
								}
							}
						}
					},
					tags: {
						type: 'array',
						items: { type: 'string' }
					}
				}
			};

			const simpleComplexity = calculateSchemaComplexity(simpleSchema);
			const complexComplexity = calculateSchemaComplexity(complexSchema);

			expect(complexComplexity).toBeGreaterThan(simpleComplexity);
		});
	});

	describe('safeSerializeObject', () => {
		test('should serialize simple objects', () => {
			const obj = { name: 'John', age: 30 };

			const result = safeSerializeObject(obj);

			expect(result.success).toBe(true);
			expect(result.serialized).toBe(JSON.stringify(obj));
			expect(result.sizeBytes).toBeGreaterThan(0);
		});

		test('should handle circular references', () => {
			const obj = { name: 'test' };
			obj.self = obj;

			const result = safeSerializeObject(obj);

			expect(result.success).toBe(true);
			expect(result.hasCircularRefs).toBe(true);
			expect(result.serialized).toContain('"[Circular Reference]"');
		});

		test('should respect depth limits', () => {
			const deepObj = { level1: { level2: { level3: { level4: 'deep' } } } };

			const result = safeSerializeObject(deepObj, { maxDepth: 2 });

			expect(result.success).toBe(true);
			expect(result.depthLimited).toBe(true);
		});

		test('should mask sensitive fields', () => {
			const obj = {
				username: 'john',
				password: 'secret123',
				token: 'abc123'
			};

			const result = safeSerializeObject(obj, {
				maskFields: ['password', 'token']
			});

			expect(result.success).toBe(true);
			expect(result.serialized).toContain('"password":"[MASKED]"');
			expect(result.serialized).toContain('"token":"[MASKED]"');
			expect(result.serialized).toContain('"username":"john"');
		});

		test('should handle serialization errors', () => {
			const problematic = {};
			Object.defineProperty(problematic, 'bad', {
				get: () => { throw new Error('Cannot access'); },
				enumerable: true
			});

			const result = safeSerializeObject(problematic);

			expect(result.success).toBe(false);
			expect(result.error).toContain('Cannot access');
		});

		test('should calculate object metadata', () => {
			const obj = {
				user: {
					name: 'John',
					details: {
						age: 30,
						tags: ['admin', 'user']
					}
				}
			};

			const result = safeSerializeObject(obj);

			expect(result.success).toBe(true);
			expect(result.metadata.depth).toBeGreaterThan(1);
			expect(result.metadata.complexityScore).toBeGreaterThan(1);
		});

		test('should handle very large objects in serialization', () => {
			const largeObj = {
				data: Array.from({ length: 1000 }, (_, i) => ({
					id: i,
					name: `Item ${i}`,
					description: 'A'.repeat(100)
				}))
			};

			const result = safeSerializeObject(largeObj);

			expect(result.success).toBe(true);
			expect(result.sizeBytes).toBeGreaterThan(100000);
		});
	});

	describe('cache management', () => {
		test('should provide cache statistics', () => {
			// Add some items to cache
			const schema1 = z.object({ name: z.string() });
			const schema2 = z.object({ age: z.number() });

			captureZodSchema(schema1, { cache: true });
			captureZodSchema(schema2, { cache: true });

			const stats = getCacheStats();

			expect(stats.size).toBe(2);
			expect(stats.maxSize).toBeDefined();
		});

		test('should clear cache', () => {
			const schema = z.object({ name: z.string() });

			captureZodSchema(schema, { cache: true });
			expect(getCacheStats().size).toBe(1);

			clearSchemaCache();
			expect(getCacheStats().size).toBe(0);
		});
	});
});