/**
 * Unit tests for cost-calculator.js
 * Tests cost calculation functionality for AI provider calls
 */

import { calculateAiCost } from '../../../src/utils/cost-calculator.js';

// Mock MODEL_MAP for testing
const TEST_MODEL_MAP = {
	anthropic: [
		{
			id: 'claude-3-5-sonnet',
			cost_per_1m_tokens: {
				input: 3.0,
				output: 15.0
			}
		}
	],
	openai: [
		{
			id: 'gpt-4o',
			cost_per_1m_tokens: {
				input: 5.0,
				output: 15.0
			}
		}
	],
	ollama: [], // No cost data
	'test-provider': [
		{
			id: 'test-model',
			cost_per_1m_tokens: {
				input: 10.0,
				output: 20.0
			}
		}
	]
};

describe('calculateAiCost', () => {
	describe('valid inputs', () => {
		test('should calculate cost for known provider and model', () => {
			const result = calculateAiCost(
				'anthropic',
				'claude-3-5-sonnet',
				1000,
				500,
				TEST_MODEL_MAP
			);

			expect(result).toHaveProperty('inputCost');
			expect(result).toHaveProperty('outputCost');
			expect(result).toHaveProperty('totalCost');
			expect(result).toHaveProperty('currency', 'USD');
			expect(result).toHaveProperty('metadata');

			// Validate cost calculations are positive numbers
			expect(typeof result.inputCost).toBe('number');
			expect(typeof result.outputCost).toBe('number');
			expect(typeof result.totalCost).toBe('number');
			expect(result.inputCost).toBeGreaterThanOrEqual(0);
			expect(result.outputCost).toBeGreaterThanOrEqual(0);
			expect(result.totalCost).toBeGreaterThanOrEqual(0);

			// Total should equal sum of input and output costs
			expect(result.totalCost).toBeCloseTo(
				result.inputCost + result.outputCost,
				6
			);
		});

		test('should handle zero tokens gracefully', () => {
			const result = calculateAiCost(
				'anthropic',
				'claude-3-5-sonnet',
				0,
				0,
				TEST_MODEL_MAP
			);

			expect(result.inputCost).toBe(0);
			expect(result.outputCost).toBe(0);
			expect(result.totalCost).toBe(0);
		});

		test('should handle only input tokens', () => {
			const result = calculateAiCost(
				'openai',
				'gpt-4o',
				1000,
				0,
				TEST_MODEL_MAP
			);

			expect(result.inputCost).toBeGreaterThan(0);
			expect(result.outputCost).toBe(0);
			expect(result.totalCost).toBe(result.inputCost);
		});

		test('should handle only output tokens', () => {
			const result = calculateAiCost(
				'openai',
				'gpt-4o',
				0,
				500,
				TEST_MODEL_MAP
			);

			expect(result.inputCost).toBe(0);
			expect(result.outputCost).toBeGreaterThan(0);
			expect(result.totalCost).toBe(result.outputCost);
		});

		test('should calculate different costs for different models', () => {
			const claude = calculateAiCost(
				'anthropic',
				'claude-3-5-sonnet',
				1000,
				500,
				TEST_MODEL_MAP
			);
			const gpt4 = calculateAiCost(
				'openai',
				'gpt-4o',
				1000,
				500,
				TEST_MODEL_MAP
			);

			// Different models should have different costs (unless coincidentally identical)
			expect(claude.totalCost).not.toBe(gpt4.totalCost);
		});
	});

	describe('edge cases and error handling', () => {
		test('should handle unknown provider gracefully', () => {
			const result = calculateAiCost(
				'unknown-provider',
				'some-model',
				1000,
				500,
				TEST_MODEL_MAP
			);

			expect(result.totalCost).toBe(0);
			expect(result.inputCost).toBe(0);
			expect(result.outputCost).toBe(0);
		});

		test('should handle unknown model for known provider gracefully', () => {
			const result = calculateAiCost(
				'anthropic',
				'unknown-model',
				1000,
				500,
				TEST_MODEL_MAP
			);

			expect(result.totalCost).toBe(0);
			expect(result.inputCost).toBe(0);
			expect(result.outputCost).toBe(0);
		});

		test('should handle negative token counts', () => {
			// The function should handle negative values by treating them as 0
			const result = calculateAiCost(
				'anthropic',
				'claude-3-5-sonnet',
				-100,
				-50,
				TEST_MODEL_MAP
			);

			expect(result.inputCost).toBe(0);
			expect(result.outputCost).toBe(0);
			expect(result.totalCost).toBe(0);
		});

		test('should handle null/undefined parameters', () => {
			expect(() =>
				calculateAiCost(null, 'claude-3-5-sonnet', 1000, 500, TEST_MODEL_MAP)
			).not.toThrow();
			expect(() =>
				calculateAiCost('anthropic', null, 1000, 500, TEST_MODEL_MAP)
			).not.toThrow();
			expect(() =>
				calculateAiCost(
					'anthropic',
					'claude-3-5-sonnet',
					null,
					500,
					TEST_MODEL_MAP
				)
			).not.toThrow();
			expect(() =>
				calculateAiCost(
					'anthropic',
					'claude-3-5-sonnet',
					1000,
					null,
					TEST_MODEL_MAP
				)
			).not.toThrow();
		});

		test('should handle non-numeric token counts', () => {
			const result = calculateAiCost(
				'anthropic',
				'claude-3-5-sonnet',
				'invalid',
				'invalid',
				TEST_MODEL_MAP
			);

			expect(result.inputCost).toBe(0);
			expect(result.outputCost).toBe(0);
			expect(result.totalCost).toBe(0);
		});

		test('should handle very large token counts', () => {
			const result = calculateAiCost(
				'anthropic',
				'claude-3-5-sonnet',
				1000000,
				1000000,
				TEST_MODEL_MAP
			);

			expect(result.totalCost).toBeGreaterThan(0);
			expect(Number.isFinite(result.totalCost)).toBe(true);
		});
	});

	describe('custom model map handling', () => {
		test('should use custom model map when provided', () => {
			const customModelMap = {
				'test-provider': [
					{
						id: 'test-model',
						cost_per_1m_tokens: {
							input: 1.0,
							output: 2.0
						}
					}
				]
			};

			const result = calculateAiCost(
				'test-provider',
				'test-model',
				1000,
				1000,
				customModelMap
			);

			expect(result.totalCost).toBeCloseTo(0.003, 6); // (1000 * 1.0 + 1000 * 2.0) / 1000000
			expect(result.inputCost).toBeCloseTo(0.001, 6);
			expect(result.outputCost).toBeCloseTo(0.002, 6);
		});

		test("should fall back to default behavior when custom map doesn't have provider", () => {
			const customModelMap = {
				'other-provider': []
			};

			const result = calculateAiCost(
				'anthropic',
				'claude-3-5-sonnet',
				1000,
				500,
				customModelMap
			);

			// Should return zero cost since provider not in custom map
			expect(result.totalCost).toBe(0);
		});
	});

	describe('metadata validation', () => {
		test('should include comprehensive metadata', () => {
			const result = calculateAiCost(
				'anthropic',
				'claude-3-5-sonnet',
				1000,
				500,
				TEST_MODEL_MAP
			);

			expect(result.metadata).toHaveProperty('providerName', 'anthropic');
			expect(result.metadata).toHaveProperty('modelId', 'claude-3-5-sonnet');
			expect(result.metadata).toHaveProperty('inputTokens', 1000);
			expect(result.metadata).toHaveProperty('outputTokens', 500);
			expect(result.metadata).toHaveProperty('calculationTimestamp');
			expect(result.metadata).toHaveProperty('pricingRates');

			// Validate timestamp format
			expect(new Date(result.metadata.calculationTimestamp)).toBeInstanceOf(
				Date
			);
		});

		test('should include rate information in metadata', () => {
			const result = calculateAiCost(
				'anthropic',
				'claude-3-5-sonnet',
				1000,
				500,
				TEST_MODEL_MAP
			);

			expect(result.metadata.pricingRates).toHaveProperty('inputCostPer1M');
			expect(result.metadata.pricingRates).toHaveProperty('outputCostPer1M');
			expect(typeof result.metadata.pricingRates.inputCostPer1M).toBe('number');
			expect(typeof result.metadata.pricingRates.outputCostPer1M).toBe(
				'number'
			);
		});
	});

	describe('performance', () => {
		test('should complete calculation quickly', () => {
			const startTime = performance.now();

			// Run multiple calculations
			for (let i = 0; i < 100; i++) {
				calculateAiCost(
					'anthropic',
					'claude-3-5-sonnet',
					1000,
					500,
					TEST_MODEL_MAP
				);
			}

			const endTime = performance.now();
			const totalTime = endTime - startTime;

			// Should complete 100 calculations in under 100ms (1ms per calc on average)
			expect(totalTime).toBeLessThan(100);
		});

		test('should not leak memory with repeated calls', () => {
			const initialMemory = process.memoryUsage().heapUsed;

			// Run many calculations
			for (let i = 0; i < 1000; i++) {
				calculateAiCost(
					'anthropic',
					'claude-3-5-sonnet',
					1000,
					500,
					TEST_MODEL_MAP
				);
			}

			// Force garbage collection if available
			if (global.gc) {
				global.gc();
			}

			const finalMemory = process.memoryUsage().heapUsed;
			const memoryIncrease = finalMemory - initialMemory;

			// Memory increase should be minimal (less than 1MB)
			expect(memoryIncrease).toBeLessThan(1024 * 1024);
		});
	});

	describe('real provider data validation', () => {
		test('should work with all providers in TEST_MODEL_MAP', () => {
			const providers = Object.keys(TEST_MODEL_MAP);

			providers.forEach((provider) => {
				const models = TEST_MODEL_MAP[provider];
				if (models.length > 0) {
					const firstModel = models[0];
					if (firstModel.cost_per_1m_tokens) {
						const result = calculateAiCost(
							provider,
							firstModel.id,
							1000,
							500,
							TEST_MODEL_MAP
						);
						expect(result.totalCost).toBeGreaterThan(0);
						expect(result.metadata.error).toBeUndefined();
					}
				}
			});
		});

		test('should handle providers without cost data', () => {
			// Test with ollama which has no models/cost data
			const result = calculateAiCost(
				'ollama',
				'any-model',
				1000,
				500,
				TEST_MODEL_MAP
			);

			expect(result.totalCost).toBe(0);
		});
	});
});
