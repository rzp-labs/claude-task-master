/**
 * Unit tests for cost-aggregator.js
 * Tests cost aggregation functionality for Langfuse traces
 */

import {
	aggregateTraceCosts,
	formatCostSummary,
	getCostsBySession,
	getCostsByTask,
	getCostsByTimeRange,
	getCurrentSessionCosts
} from '../../../src/utils/cost-aggregator.js';

describe('cost-aggregator', () => {
	describe('getCostsByTask', () => {
		test('should return placeholder implementation', async () => {
			const result = await getCostsByTask('task-1', '/test/root');

			expect(result).toHaveProperty('taskId', 'task-1');
			expect(result).toHaveProperty('totalCost', 0);
			expect(result).toHaveProperty('breakdown');
			expect(result).toHaveProperty('traceCount', 0);
			expect(result).toHaveProperty('status', 'placeholder');
			expect(result).toHaveProperty('note');
			expect(result.note).toContain('placeholder implementation');
		});

		test('should handle missing taskId gracefully', async () => {
			const result1 = await getCostsByTask(null, '/test/root');
			const result2 = await getCostsByTask(undefined, '/test/root');
			const result3 = await getCostsByTask('', '/test/root');

			expect(result1.taskId).toBe('unknown');
			expect(result2.taskId).toBe('unknown');
			expect(result3.taskId).toBe('unknown');
		});

		test('should handle missing projectRoot gracefully', async () => {
			const result = await getCostsByTask('task-1', null);

			expect(result.taskId).toBe('task-1');
			expect(result.status).toBe('placeholder');
		});
	});

	describe('getCostsBySession', () => {
		test('should return placeholder implementation', async () => {
			const result = await getCostsBySession('session-1', '/test/root');

			expect(result).toHaveProperty('sessionId', 'session-1');
			expect(result).toHaveProperty('totalCost', 0);
			expect(result).toHaveProperty('breakdown');
			expect(result).toHaveProperty('traceCount', 0);
			expect(result).toHaveProperty('status', 'placeholder');
			expect(result).toHaveProperty('note');
		});

		test('should handle missing sessionId gracefully', async () => {
			const result = await getCostsBySession(null, '/test/root');

			expect(result.sessionId).toBe('unknown');
		});
	});

	describe('getCostsByTimeRange', () => {
		test('should return placeholder implementation with valid time range', async () => {
			const startTime = new Date('2024-01-01T00:00:00Z');
			const endTime = new Date('2024-01-01T23:59:59Z');

			const result = await getCostsByTimeRange(
				startTime,
				endTime,
				'/test/root'
			);

			expect(result).toHaveProperty('startTime', startTime.toISOString());
			expect(result).toHaveProperty('endTime', endTime.toISOString());
			expect(result).toHaveProperty('totalCost', 0);
			expect(result).toHaveProperty('breakdown');
			expect(result).toHaveProperty('traceCount', 0);
			expect(result).toHaveProperty('status', 'placeholder');
		});

		test('should handle invalid time ranges gracefully', async () => {
			const startTime = new Date('2024-01-02T00:00:00Z');
			const endTime = new Date('2024-01-01T00:00:00Z'); // End before start

			const result = await getCostsByTimeRange(
				startTime,
				endTime,
				'/test/root'
			);

			expect(result.status).toBe('placeholder');
			expect(result.note).toContain('placeholder implementation');
		});

		test('should handle null/undefined time parameters', async () => {
			const result1 = await getCostsByTimeRange(null, null, '/test/root');
			const result2 = await getCostsByTimeRange(
				undefined,
				undefined,
				'/test/root'
			);

			expect(result1.status).toBe('placeholder');
			expect(result2.status).toBe('placeholder');
		});

		test('should handle non-Date objects gracefully', async () => {
			const result = await getCostsByTimeRange(
				'invalid-date',
				'invalid-date',
				'/test/root'
			);

			expect(result.status).toBe('placeholder');
		});
	});

	describe('getCurrentSessionCosts', () => {
		test('should return placeholder implementation', async () => {
			const result = await getCurrentSessionCosts('/test/root');

			expect(result).toHaveProperty('sessionId', 'current');
			expect(result).toHaveProperty('totalCost', 0);
			expect(result).toHaveProperty('breakdown');
			expect(result).toHaveProperty('traceCount', 0);
			expect(result).toHaveProperty('status', 'placeholder');
			expect(result).toHaveProperty('startTime');
		});

		test('should handle missing projectRoot gracefully', async () => {
			const result = await getCurrentSessionCosts(null);

			expect(result.status).toBe('placeholder');
		});
	});

	describe('aggregateTraceCosts', () => {
		test('should aggregate empty trace array', () => {
			const traces = [];

			const result = aggregateTraceCosts(traces);

			expect(result).toHaveProperty('totalCost', 0);
			expect(result).toHaveProperty('breakdown');
			expect(result.breakdown).toHaveProperty('inputCost', 0);
			expect(result.breakdown).toHaveProperty('outputCost', 0);
			expect(result.breakdown).toHaveProperty('byProvider', {});
			expect(result.breakdown).toHaveProperty('byModel', {});
			expect(result).toHaveProperty('traceCount', 0);
		});

		test('should aggregate single trace with cost metadata', () => {
			const traces = [
				{
					id: 'trace-1',
					metadata: {
						cost: {
							totalCost: 0.05,
							inputCost: 0.02,
							outputCost: 0.03,
							currency: 'USD',
							breakdown: {
								provider: 'anthropic',
								model: 'claude-3-5-sonnet'
							}
						}
					}
				}
			];

			const result = aggregateTraceCosts(traces);

			expect(result.totalCost).toBe(0.05);
			expect(result.breakdown.inputCost).toBe(0.02);
			expect(result.breakdown.outputCost).toBe(0.03);
			expect(result.breakdown.byProvider.anthropic).toBe(0.05);
			expect(result.breakdown.byModel['claude-3-5-sonnet']).toBe(0.05);
			expect(result.traceCount).toBe(1);
		});

		test('should aggregate multiple traces with different providers', () => {
			const traces = [
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
				{
					id: 'trace-2',
					metadata: {
						cost: {
							totalCost: 0.08,
							inputCost: 0.03,
							outputCost: 0.05,
							breakdown: { provider: 'openai', model: 'gpt-4o' }
						}
					}
				}
			];

			const result = aggregateTraceCosts(traces);

			expect(result.totalCost).toBeCloseTo(0.13, 6);
			expect(result.breakdown.inputCost).toBeCloseTo(0.05, 6);
			expect(result.breakdown.outputCost).toBeCloseTo(0.08, 6);
			expect(result.breakdown.byProvider.anthropic).toBe(0.05);
			expect(result.breakdown.byProvider.openai).toBe(0.08);
			expect(result.breakdown.byModel['claude-3-5-sonnet']).toBe(0.05);
			expect(result.breakdown.byModel['gpt-4o']).toBe(0.08);
			expect(result.traceCount).toBe(2);
		});

		test('should handle traces without cost metadata gracefully', () => {
			const traces = [
				{ id: 'trace-1' }, // No metadata
				{ id: 'trace-2', metadata: {} }, // No cost metadata
				{ id: 'trace-3', metadata: { cost: null } }, // Null cost
				{
					id: 'trace-4',
					metadata: {
						cost: {
							totalCost: 0.05,
							inputCost: 0.02,
							outputCost: 0.03,
							breakdown: { provider: 'anthropic', model: 'claude-3-5-sonnet' }
						}
					}
				}
			];

			const result = aggregateTraceCosts(traces);

			expect(result.totalCost).toBe(0.05);
			expect(result.traceCount).toBe(4);
			expect(result.breakdown.skippedTraces).toBe(3);
		});

		test('should handle invalid cost values gracefully', () => {
			const traces = [
				{
					id: 'trace-1',
					metadata: {
						cost: {
							totalCost: 'invalid',
							inputCost: null,
							outputCost: undefined,
							breakdown: { provider: 'anthropic', model: 'claude-3-5-sonnet' }
						}
					}
				},
				{
					id: 'trace-2',
					metadata: {
						cost: {
							totalCost: 0.05,
							inputCost: 0.02,
							outputCost: 0.03,
							breakdown: { provider: 'openai', model: 'gpt-4o' }
						}
					}
				}
			];

			const result = aggregateTraceCosts(traces);

			expect(result.totalCost).toBe(0.05);
			expect(result.traceCount).toBe(2);
			expect(result.breakdown.skippedTraces).toBe(1);
		});

		test('should accumulate costs for same provider/model correctly', () => {
			const traces = [
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
				{
					id: 'trace-2',
					metadata: {
						cost: {
							totalCost: 0.03,
							inputCost: 0.01,
							outputCost: 0.02,
							breakdown: { provider: 'anthropic', model: 'claude-3-5-sonnet' }
						}
					}
				}
			];

			const result = aggregateTraceCosts(traces);

			expect(result.totalCost).toBeCloseTo(0.08, 6);
			expect(result.breakdown.byProvider.anthropic).toBeCloseTo(0.08, 6);
			expect(result.breakdown.byModel['claude-3-5-sonnet']).toBeCloseTo(
				0.08,
				6
			);
		});

		test('should handle null/undefined traces parameter', () => {
			expect(() => aggregateTraceCosts(null)).not.toThrow();
			expect(() => aggregateTraceCosts(undefined)).not.toThrow();

			const result1 = aggregateTraceCosts(null);
			const result2 = aggregateTraceCosts(undefined);

			expect(result1.totalCost).toBe(0);
			expect(result2.totalCost).toBe(0);
		});
	});

	describe('formatCostSummary', () => {
		test('should format basic cost summary correctly', () => {
			const costSummary = {
				totalCost: 0.156789,
				breakdown: {
					inputCost: 0.075432,
					outputCost: 0.081357,
					byProvider: {
						anthropic: 0.1,
						openai: 0.056789
					},
					byModel: {
						'claude-3-5-sonnet': 0.1,
						'gpt-4o': 0.056789
					}
				},
				traceCount: 15
			};

			const formatted = formatCostSummary(costSummary);

			expect(formatted).toContain('Total Cost: $0.157'); // Rounded to 3 decimals
			expect(formatted).toContain('Input: $0.075');
			expect(formatted).toContain('Output: $0.081');
			expect(formatted).toContain('Traces: 15');
			expect(formatted).toContain('anthropic: $0.100');
			expect(formatted).toContain('openai: $0.057');
		});

		test('should handle zero costs gracefully', () => {
			const costSummary = {
				totalCost: 0,
				breakdown: {
					inputCost: 0,
					outputCost: 0,
					byProvider: {},
					byModel: {}
				},
				traceCount: 0
			};

			const formatted = formatCostSummary(costSummary);

			expect(formatted).toContain('Total Cost: $0.000');
			expect(formatted).toContain('Traces: 0');
			expect(formatted).toContain('No provider breakdown available');
		});

		test('should handle very small costs correctly', () => {
			const costSummary = {
				totalCost: 0.000123,
				breakdown: {
					inputCost: 0.00005,
					outputCost: 0.000073,
					byProvider: {
						anthropic: 0.000123
					},
					byModel: {}
				},
				traceCount: 1
			};

			const formatted = formatCostSummary(costSummary);

			expect(formatted).toContain('Total Cost: $0.000');
			expect(formatted).toContain('anthropic: $0.000');
		});

		test('should handle large costs correctly', () => {
			const costSummary = {
				totalCost: 123.456789,
				breakdown: {
					inputCost: 50.123456,
					outputCost: 73.333333,
					byProvider: {
						anthropic: 123.456789
					},
					byModel: {}
				},
				traceCount: 1000
			};

			const formatted = formatCostSummary(costSummary);

			expect(formatted).toContain('Total Cost: $123.457');
			expect(formatted).toContain('anthropic: $123.457');
		});

		test('should handle missing breakdown gracefully', () => {
			const costSummary = {
				totalCost: 0.05,
				traceCount: 1
			};

			const formatted = formatCostSummary(costSummary);

			expect(formatted).toContain('Total Cost: $0.050');
			expect(formatted).toContain('No provider breakdown available');
		});

		test('should handle null/undefined cost summary', () => {
			const formatted1 = formatCostSummary(null);
			const formatted2 = formatCostSummary(undefined);

			expect(formatted1).toContain('No cost data available');
			expect(formatted2).toContain('No cost data available');
		});

		test('should truncate long provider/model lists', () => {
			const manyProviders = {};
			const manyModels = {};

			// Create 20 providers and models
			for (let i = 1; i <= 20; i++) {
				manyProviders[`provider-${i}`] = 0.01 * i;
				manyModels[`model-${i}`] = 0.01 * i;
			}

			const costSummary = {
				totalCost: 2.1,
				breakdown: {
					inputCost: 1.0,
					outputCost: 1.1,
					byProvider: manyProviders,
					byModel: manyModels
				},
				traceCount: 20
			};

			const formatted = formatCostSummary(costSummary);

			// Should show top 10 and indicate truncation
			expect(formatted).toContain('provider-20'); // Highest cost provider
			expect(formatted).toContain('(and 10 more)'); // Truncation indicator
		});
	});

	describe('error handling and edge cases', () => {
		test('should handle async function errors gracefully', async () => {
			// Test that async functions don't throw even with extreme inputs
			await expect(
				getCostsByTask(''.repeat(10000), null)
			).resolves.toBeDefined();
			await expect(getCostsBySession(123, {})).resolves.toBeDefined();
			await expect(
				getCostsByTimeRange('invalid', 'invalid', [])
			).resolves.toBeDefined();
		});

		test('should handle very large trace arrays', () => {
			const largeTraceArray = [];

			// Create 10,000 traces
			for (let i = 0; i < 10000; i++) {
				largeTraceArray.push({
					id: `trace-${i}`,
					metadata: {
						cost: {
							totalCost: 0.001,
							inputCost: 0.0005,
							outputCost: 0.0005,
							breakdown: { provider: 'test', model: 'test-model' }
						}
					}
				});
			}

			const startTime = performance.now();
			const result = aggregateTraceCosts(largeTraceArray);
			const endTime = performance.now();

			expect(result.totalCost).toBeCloseTo(10.0, 3);
			expect(result.traceCount).toBe(10000);
			expect(endTime - startTime).toBeLessThan(1000); // Should complete in under 1 second
		});

		test('should handle circular references in trace data', () => {
			const circularTrace = {
				id: 'trace-1',
				metadata: {
					cost: {
						totalCost: 0.05,
						inputCost: 0.02,
						outputCost: 0.03,
						breakdown: { provider: 'test', model: 'test-model' }
					}
				}
			};

			// Create circular reference
			circularTrace.self = circularTrace;
			circularTrace.metadata.parent = circularTrace;

			expect(() => aggregateTraceCosts([circularTrace])).not.toThrow();

			const result = aggregateTraceCosts([circularTrace]);
			expect(result.totalCost).toBe(0.05);
		});
	});

	describe('performance', () => {
		test('should handle large cost summaries efficiently', () => {
			const largeCostSummary = {
				totalCost: 1000.0,
				breakdown: {
					inputCost: 500.0,
					outputCost: 500.0,
					byProvider: {},
					byModel: {}
				},
				traceCount: 50000
			};

			// Add 1000 providers and models
			for (let i = 0; i < 1000; i++) {
				largeCostSummary.breakdown.byProvider[`provider-${i}`] = Math.random();
				largeCostSummary.breakdown.byModel[`model-${i}`] = Math.random();
			}

			const startTime = performance.now();
			const formatted = formatCostSummary(largeCostSummary);
			const endTime = performance.now();

			expect(formatted).toContain('Total Cost: $1000.000');
			expect(endTime - startTime).toBeLessThan(100); // Should complete in under 100ms
		});
	});
});
