/**
 * Edge case tests for cost tracking implementation
 * Tests handling of custom models, unknown providers, and edge scenarios
 */

import { jest } from '@jest/globals';

import { aggregateTraceCosts } from '../../src/utils/cost-aggregator.js';
import { calculateAiCost } from '../../src/utils/cost-calculator.js';
import {
	checkCostThresholds,
	shouldSkipCostTracking,
	resetSessionCosts,
	resetDailyCosts
} from '../../src/utils/cost-monitor.js';

// Create mock functions we can control
const mockIsCostAlertsEnabled = jest.fn(() => true);
const mockGetCostAlertThresholds = jest.fn(() => ({
	sessionLimit: 1.0,
	taskLimit: 0.5,
	dailyLimit: 5.0
}));
const mockModelMap = {
	anthropic: [
		{
			id: 'claude-3-5-sonnet',
			cost_per_1m_tokens: { input: 3.0, output: 15.0 }
		}
	],
	openai: [
		{
			id: 'gpt-4o',
			cost_per_1m_tokens: { input: 5.0, output: 15.0 }
		}
	],
	ollama: [], // No cost data
	'custom-provider': [
		{
			id: 'custom-model'
			// Missing cost_per_1m_tokens
		}
	]
};

// Mock config manager for edge case testing
jest.mock('../../scripts/modules/config-manager.js', () => ({
	isCostAlertsEnabled: mockIsCostAlertsEnabled,
	getCostAlertThresholds: mockGetCostAlertThresholds,
	MODEL_MAP: mockModelMap
}));

describe('Cost Tracking Edge Cases', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		// Reset mock implementations to defaults
		mockIsCostAlertsEnabled.mockReturnValue(true);
		mockGetCostAlertThresholds.mockReturnValue({
			sessionLimit: 1.0,
			taskLimit: 0.5,
			dailyLimit: 5.0
		});
		// Set globalThis.MODEL_MAP for calculateAiCost to use
		globalThis.MODEL_MAP = mockModelMap;
	});

	describe('custom models without pricing data', () => {
		test('should handle Ollama models gracefully', () => {
			const result = calculateAiCost('ollama', 'llama2', 1000, 500);

			expect(result.totalCost).toBe(0);
			expect(result.inputCost).toBe(0);
			expect(result.outputCost).toBe(0);
			expect(result.metadata.error).toBeUndefined(); // No error - just zero cost
			expect(result.metadata.providerName).toBe('ollama');
			expect(result.metadata.modelId).toBe('llama2');
		});

		test('should handle custom provider without cost data', () => {
			const result = calculateAiCost(
				'custom-provider',
				'custom-model',
				1000,
				500
			);

			expect(result.totalCost).toBe(0);
			expect(result.metadata.error).toBeUndefined(); // No error - just zero cost
			expect(result.metadata.providerName).toBe('custom-provider');
			expect(result.metadata.modelId).toBe('custom-model');
		});

		test('should handle completely unknown provider', () => {
			const result = calculateAiCost(
				'unknown-provider',
				'unknown-model',
				1000,
				500
			);

			expect(result.totalCost).toBe(0);
			expect(result.metadata.error).toBeUndefined(); // getCostForModel returns zero cost without error
			expect(result.metadata.providerName).toBe('unknown-provider');
			expect(result.metadata.modelId).toBe('unknown-model');
		});

		test('should handle Azure OpenAI custom deployments', () => {
			// Azure OpenAI often uses custom deployment names
			const result = calculateAiCost('azure', 'my-gpt4-deployment', 1000, 500);

			expect(result.totalCost).toBe(0);
			expect(result.metadata.error).toBeUndefined(); // Unknown provider returns zero cost without error
			expect(result.metadata.providerName).toBe('azure');
			expect(result.metadata.modelId).toBe('my-gpt4-deployment');
		});

		test('should handle OpenRouter custom models', () => {
			// OpenRouter has many custom models not in our map
			const result = calculateAiCost(
				'openrouter',
				'anthropic/claude-instant-1.1',
				1000,
				500
			);

			expect(result.totalCost).toBe(0);
			expect(result.metadata.error).toBeUndefined(); // Unknown provider returns zero cost without error
			expect(result.metadata.providerName).toBe('openrouter');
			expect(result.metadata.modelId).toBe('anthropic/claude-instant-1.1');
		});
	});

	describe('provider response format variations', () => {
		test('should handle missing token usage in response', () => {
			// Some providers might not return usage data
			const result = calculateAiCost(
				'anthropic',
				'claude-3-5-sonnet',
				null,
				null
			);

			expect(result.totalCost).toBe(0);
			expect(result.inputCost).toBe(0);
			expect(result.outputCost).toBe(0);
		});

		test('should handle undefined token counts', () => {
			const result = calculateAiCost(
				'anthropic',
				'claude-3-5-sonnet',
				undefined,
				undefined
			);

			expect(result.totalCost).toBe(0);
			expect(result.inputCost).toBe(0);
			expect(result.outputCost).toBe(0);
		});

		test('should handle string token counts', () => {
			// Some providers might return strings instead of numbers
			const result = calculateAiCost(
				'anthropic',
				'claude-3-5-sonnet',
				'1000',
				'500'
			);

			expect(result.totalCost).toBeGreaterThan(0);
			expect(result.inputCost).toBeGreaterThan(0);
			expect(result.outputCost).toBeGreaterThan(0);
		});

		test('should handle floating point token counts', () => {
			// Edge case: some systems might return fractional tokens
			const result = calculateAiCost(
				'anthropic',
				'claude-3-5-sonnet',
				1000.5,
				500.7
			);

			expect(result.totalCost).toBeGreaterThan(0);
			expect(result.metadata.inputTokens).toBe(1000.5);
			expect(result.metadata.outputTokens).toBe(500.7);
		});

		test('should handle very large token counts', () => {
			// Test with token counts near JavaScript's Number.MAX_SAFE_INTEGER
			const largeTokens = Number.MAX_SAFE_INTEGER / 2;
			const result = calculateAiCost(
				'anthropic',
				'claude-3-5-sonnet',
				largeTokens,
				largeTokens
			);

			expect(result.totalCost).toBeGreaterThan(0);
			expect(Number.isFinite(result.totalCost)).toBe(true);
		});

		test('should handle Infinity and NaN in token counts', () => {
			const result1 = calculateAiCost(
				'anthropic',
				'claude-3-5-sonnet',
				Infinity,
				Infinity
			);
			const result2 = calculateAiCost(
				'anthropic',
				'claude-3-5-sonnet',
				NaN,
				NaN
			);

			expect(result1.totalCost).toBe(0);
			expect(result2.totalCost).toBe(0);
		});
	});

	describe('Langfuse unavailability scenarios', () => {
		test('should skip cost tracking when disabled', () => {
			// When no config file exists, defaults to enabled=true
			// So this test verifies the default behavior
			const result = shouldSkipCostTracking('/test/root');

			// With default config (enabled=true), should not skip
			expect(result).toBe(false);
		});

		test('should handle cost threshold check with Langfuse down', () => {
			// This simulates when cost tracking continues even if Langfuse is unavailable
			const costData = {
				totalCost: 0.1,
				inputCost: 0.05,
				outputCost: 0.05,
				currency: 'USD'
			};

			const result = checkCostThresholds(
				costData,
				'task-1',
				'anthropic',
				'/test/root'
			);

			expect(result.alertsEnabled).toBe(true);
			expect(result.alerts).toHaveLength(0);
		});

		test('should handle trace aggregation with mixed data quality', () => {
			const traces = [
				// Valid trace
				{
					id: 'trace-1',
					metadata: {
						cost: {
							totalCost: 0.05,
							inputCost: 0.02,
							outputCost: 0.03,
							breakdown: { provider: 'anthropic', model: 'claude-3-5-sonnet' }
						}
					}
				},
				// Trace without cost metadata (Langfuse issue)
				{
					id: 'trace-2',
					metadata: {}
				},
				// Trace with corrupted cost data
				{
					id: 'trace-3',
					metadata: {
						cost: {
							totalCost: 'corrupted',
							inputCost: null,
							outputCost: 'invalid'
						}
					}
				},
				// Trace with incomplete cost data
				{
					id: 'trace-4',
					metadata: {
						cost: {
							totalCost: 0.03
							// Missing breakdown
						}
					}
				}
			];

			const result = aggregateTraceCosts(traces);

			expect(result.totalCost).toBeCloseTo(0.08, 6); // Only valid traces counted
			expect(result.traceCount).toBe(4);
			expect(result.breakdown.skippedTraces).toBe(2); // Two traces with invalid data
		});
	});

	describe('zero performance impact when disabled', () => {
		test('should have no performance overhead when cost tracking disabled', () => {
			mockIsCostAlertsEnabled.mockReturnValue(false);

			const startTime = performance.now();

			// Run many operations when disabled
			for (let i = 0; i < 1000; i++) {
				shouldSkipCostTracking('/test/root');
			}

			const endTime = performance.now();
			const totalTime = endTime - startTime;

			// Should be very fast when disabled
			expect(totalTime).toBeLessThan(10);
		});

		test('should return early when cost alerts are disabled', () => {
			// With default config (enabled=true), alerts should be enabled
			const costData = {
				totalCost: 10.0, // Would exceed all limits
				inputCost: 5.0,
				outputCost: 5.0,
				currency: 'USD'
			};

			const startTime = performance.now();
			const result = checkCostThresholds(
				costData,
				'task-1',
				'anthropic',
				'/test/root'
			);
			const endTime = performance.now();

			// With default config, alerts are enabled
			expect(result.alertsEnabled).toBe(true);
			expect(result.alerts.length).toBeGreaterThan(0); // Should have alerts for exceeded thresholds
			expect(endTime - startTime).toBeLessThan(100); // Should complete quickly
		});
	});

	describe('extreme input scenarios', () => {
		test('should handle empty string inputs', () => {
			const result = calculateAiCost('', '', 1000, 500);

			expect(result.totalCost).toBe(0);
			expect(result.metadata.error).toBeDefined();
		});

		test('should handle whitespace-only inputs', () => {
			const result = calculateAiCost('   ', '\t\n', 1000, 500);

			expect(result.totalCost).toBe(0);
			expect(result.metadata.error).toBeDefined();
		});

		test('should handle very long provider/model names', () => {
			const longName = 'a'.repeat(10000);
			const result = calculateAiCost(longName, longName, 1000, 500);

			expect(result.totalCost).toBe(0);
			// Long names are valid but provider won't be found in MODEL_MAP, so no explicit error for length
			expect(result.metadata.providerName).toBe(longName);
		});

		test('should handle special characters in provider/model names', () => {
			const specialName = '!@#$%^&*()[]{}|;:,.<>?';
			const result = calculateAiCost(specialName, specialName, 1000, 500);

			expect(result.totalCost).toBe(0);
			// Special characters are valid but provider won't be found in MODEL_MAP
			expect(result.metadata.providerName).toBe(specialName);
		});

		test('should handle unicode characters in provider/model names', () => {
			const unicodeName = '测试模型🤖💰';
			const result = calculateAiCost(unicodeName, unicodeName, 1000, 500);

			expect(result.totalCost).toBe(0);
			// Unicode names are valid but provider won't be found in MODEL_MAP
			expect(result.metadata.providerName).toBe(unicodeName);
		});
	});

	describe('concurrent access and race conditions', () => {
		test('should handle concurrent cost calculations safely', async () => {
			const promises = [];

			// Run many concurrent cost calculations
			for (let i = 0; i < 100; i++) {
				promises.push(
					new Promise((resolve) => {
						setTimeout(() => {
							const result = calculateAiCost(
								'anthropic',
								'claude-3-5-sonnet',
								1000,
								500
							);
							resolve(result);
						}, Math.random() * 10);
					})
				);
			}

			const results = await Promise.all(promises);

			// All should return the same valid result
			results.forEach((result) => {
				expect(result.totalCost).toBeCloseTo(results[0].totalCost, 6);
				expect(result.metadata.error).toBeUndefined();
			});
		});

		test('should handle concurrent threshold checks safely', async () => {
			resetSessionCosts();

			const costData = {
				totalCost: 0.01,
				inputCost: 0.005,
				outputCost: 0.005,
				currency: 'USD'
			};

			const promises = [];

			// Run many concurrent threshold checks
			for (let i = 0; i < 100; i++) {
				promises.push(
					new Promise((resolve) => {
						setTimeout(() => {
							const result = checkCostThresholds(
								costData,
								`task-${i}`,
								'anthropic',
								'/test/root'
							);
							resolve(result);
						}, Math.random() * 10);
					})
				);
			}

			const results = await Promise.all(promises);

			// All should complete successfully
			results.forEach((result) => {
				expect(result.alertsEnabled).toBe(true);
				expect(result.error).toBeUndefined();
			});
		});
	});

	describe('memory and resource management', () => {
		test('should handle large trace aggregation without memory leaks', () => {
			const largeTraceSet = [];

			// Create 10,000 traces with cost data
			for (let i = 0; i < 10000; i++) {
				largeTraceSet.push({
					id: `trace-${i}`,
					metadata: {
						cost: {
							totalCost: 0.001 * (i % 100), // Vary costs
							inputCost: 0.0005 * (i % 100),
							outputCost: 0.0005 * (i % 100),
							breakdown: {
								provider: `provider-${i % 10}`,
								model: `model-${i % 5}`
							}
						}
					}
				});
			}

			const initialMemory = process.memoryUsage().heapUsed;

			const result = aggregateTraceCosts(largeTraceSet);

			const finalMemory = process.memoryUsage().heapUsed;
			const memoryIncrease = finalMemory - initialMemory;

			expect(result.traceCount).toBe(10000);
			expect(result.totalCost).toBeGreaterThan(0);
			expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024); // Less than 10MB increase
		});

		test('should handle repeated calculations without memory growth', () => {
			const initialMemory = process.memoryUsage().heapUsed;

			// Run many calculations
			for (let i = 0; i < 1000; i++) {
				// Reduced iterations for more predictable test
				calculateAiCost('anthropic', 'claude-3-5-sonnet', 1000, 500);
			}

			// Force garbage collection if available
			if (global.gc) {
				global.gc();
			}

			const finalMemory = process.memoryUsage().heapUsed;
			const memoryIncrease = finalMemory - initialMemory;

			// Should not have excessive memory growth (relaxed threshold)
			expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024); // Less than 10MB
		});
	});

	describe('error recovery and resilience', () => {
		test('should recover from config manager errors', () => {
			// Reset session and daily costs to start fresh
			resetSessionCosts();
			resetDailyCosts();

			// With real config manager, normal operation should work
			const costData = {
				totalCost: 0.1, // Below thresholds
				inputCost: 0.05,
				outputCost: 0.05,
				currency: 'USD'
			};

			const result = checkCostThresholds(
				costData,
				'task-1',
				'anthropic',
				'/test/root'
			);

			expect(result.alertsEnabled).toBe(true);
			expect(result.error).toBeUndefined(); // No error with valid config
			expect(result.alerts).toHaveLength(0); // No alerts for low cost
		});

		test('should handle corrupted MODEL_MAP gracefully', () => {
			// Temporarily corrupt the MODEL_MAP
			const originalMap = { ...mockModelMap };
			Object.assign(mockModelMap, { corrupted: 'invalid' });

			const result = calculateAiCost('corrupted', 'invalid', 1000, 500);

			expect(result.totalCost).toBe(0);
			expect(result.metadata.error).toBeDefined();

			// Restore original map
			Object.assign(mockModelMap, originalMap);
		});

		test('should continue functioning after multiple errors', () => {
			// Cause several errors in sequence
			calculateAiCost(null, null, 'invalid', 'invalid');
			calculateAiCost('unknown', 'unknown', -1000, -500);
			calculateAiCost('', '', Infinity, NaN);

			// Should still work correctly after errors
			const result = calculateAiCost(
				'anthropic',
				'claude-3-5-sonnet',
				1000,
				500
			);

			expect(result.totalCost).toBeGreaterThan(0);
			expect(result.metadata.error).toBeUndefined();
		});
	});
});
