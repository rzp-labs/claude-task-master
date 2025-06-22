/**
 * Tests for Object Generation with Schema Capture Integration
 */

import {
	afterEach,
	beforeEach,
	describe,
	expect,
	jest,
	test
} from '@jest/globals';
import { z } from 'zod';

// Mock dependencies
jest.mock('../../src/observability/langfuse-tracer.js', () => ({
	isEnabled: jest.fn(() => true),
	createTrace: jest.fn(() =>
		Promise.resolve({
			generation: jest.fn(() => ({
				end: jest.fn()
			}))
		})
	)
}));

jest.mock('../../src/utils/cost-calculator.js', () => ({
	calculateAiCost: jest.fn(() => ({
		totalCost: 0.001,
		inputCost: 0.0005,
		outputCost: 0.0005,
		currency: 'USD'
	}))
}));

jest.mock('../../src/utils/cost-monitor.js', () => ({
	checkCostThresholds: jest.fn(),
	shouldSkipCostTracking: jest.fn(() => false)
}));

describe('Object Generation Schema Capture Integration', () => {
	let BaseAIProvider;

	beforeEach(async () => {
		jest.clearAllMocks();
		const providerModule = await import(
			'../../src/ai-providers/base-provider.js'
		);
		BaseAIProvider = providerModule.BaseAIProvider;
	});

	afterEach(() => {
		jest.resetAllMocks();
	});

	test('should have object metrics calculation method', () => {
		class TestProvider extends BaseAIProvider {
			getClient() {
				return (modelId) => ({ modelId });
			}
		}

		const provider = new TestProvider();
		expect(typeof provider._calculateObjectMetrics).toBe('function');
	});

	test('should calculate metrics for simple objects', () => {
		class TestProvider extends BaseAIProvider {
			getClient() {
				return (modelId) => ({ modelId });
			}
		}

		const provider = new TestProvider();
		const testObject = { name: 'John', age: 30 };
		const metrics = provider._calculateObjectMetrics(testObject);

		expect(metrics).toHaveProperty('sizeBytes');
		expect(metrics).toHaveProperty('depth');
		expect(metrics).toHaveProperty('type', 'object');
		expect(metrics).toHaveProperty('fieldCount', 2);
		expect(metrics).toHaveProperty('complexityScore');
		expect(metrics.sizeBytes).toBeGreaterThan(0);
	});

	test('should calculate metrics for nested objects', () => {
		class TestProvider extends BaseAIProvider {
			getClient() {
				return (modelId) => ({ modelId });
			}
		}

		const provider = new TestProvider();
		const testObject = {
			user: {
				profile: { name: 'John', age: 30 },
				settings: { theme: 'dark' }
			},
			tags: ['admin', 'user']
		};
		const metrics = provider._calculateObjectMetrics(testObject);

		expect(metrics.type).toBe('object');
		expect(metrics.depth).toBeGreaterThan(1);
		expect(metrics.complexityScore).toBeGreaterThan(1);
	});

	test('should calculate metrics for arrays', () => {
		class TestProvider extends BaseAIProvider {
			getClient() {
				return (modelId) => ({ modelId });
			}
		}

		const provider = new TestProvider();
		const testArray = [{ id: 1 }, { id: 2 }, { id: 3 }];
		const metrics = provider._calculateObjectMetrics(testArray);

		expect(metrics.type).toBe('array');
		expect(metrics.length).toBe(3);
		expect(metrics.complexityScore).toBeGreaterThan(1);
	});

	test('should detect circular references', () => {
		class TestProvider extends BaseAIProvider {
			getClient() {
				return (modelId) => ({ modelId });
			}
		}

		const provider = new TestProvider();

		// Object with circular reference
		const circular = { name: 'test' };
		circular.self = circular;
		expect(provider._detectCircularReferences(circular)).toBe(true);

		// Object without circular reference
		const normal = { name: 'test', nested: { prop: 'value' } };
		expect(provider._detectCircularReferences(normal)).toBe(false);
	});

	test('should calculate complexity scores', () => {
		class TestProvider extends BaseAIProvider {
			getClient() {
				return (modelId) => ({ modelId });
			}
		}

		const provider = new TestProvider();

		const simple = { name: 'test' };
		const complex = {
			level1: { level2: { level3: { data: ['a', 'b'] } } },
			other: { more: { fields: true } }
		};

		const simpleScore = provider._calculateObjectComplexity(simple);
		const complexScore = provider._calculateObjectComplexity(complex);

		expect(simpleScore).toBeGreaterThan(1);
		expect(complexScore).toBeGreaterThan(simpleScore);
		expect(complexScore).toBeLessThanOrEqual(10);
	});

	test('should handle metrics calculation errors', () => {
		class TestProvider extends BaseAIProvider {
			getClient() {
				return (modelId) => ({ modelId });
			}
		}

		const provider = new TestProvider();

		// Object that throws during enumeration
		const problematic = {};
		Object.defineProperty(problematic, 'bad', {
			get: () => {
				throw new Error('Test error');
			},
			enumerable: true
		});

		const metrics = provider._calculateObjectMetrics(problematic);
		expect(metrics).toHaveProperty('error');
		expect(metrics.fallback).toBe(true);
	});

	test('should validate generateObject parameters', async () => {
		class TestProvider extends BaseAIProvider {
			getClient() {
				return (modelId) => ({ modelId });
			}
		}

		const provider = new TestProvider();
		const validMessages = [{ role: 'user', content: 'test' }];

		// Missing schema
		await expect(
			provider.generateObject({
				modelId: 'test',
				apiKey: 'test',
				messages: validMessages,
				objectName: 'Test'
			})
		).rejects.toThrow('Schema is required');

		// Missing objectName
		await expect(
			provider.generateObject({
				modelId: 'test',
				apiKey: 'test',
				messages: validMessages,
				schema: z.object({})
			})
		).rejects.toThrow('Object name is required');

		// Missing messages (should fail with messages validation)
		await expect(
			provider.generateObject({
				modelId: 'test',
				apiKey: 'test',
				messages: [],
				schema: z.object({}),
				objectName: 'Test'
			})
		).rejects.toThrow('Invalid or empty messages array');
	});

	test('should have instrumentation methods when enabled', () => {
		class TestProvider extends BaseAIProvider {
			getClient() {
				return (modelId) => ({ modelId });
			}
		}

		const provider = new TestProvider();
		expect(typeof provider._instrumentedGenerateObject).toBe('function');

		if (provider._instrumentationEnabled) {
			expect(typeof provider._originalGenerateObject).toBe('function');
		}
	});
});
