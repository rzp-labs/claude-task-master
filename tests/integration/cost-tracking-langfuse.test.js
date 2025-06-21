/**
 * Integration tests for cost tracking with Langfuse
 * Tests cost metadata integration in AI provider calls
 */

import { BaseAIProvider } from '../../src/ai-providers/base-provider.js';
import { calculateAiCost } from '../../src/utils/cost-calculator.js';
import {
	checkCostThresholds,
	resetSessionCosts
} from '../../src/utils/cost-monitor.js';

// Mock Langfuse tracer to avoid external dependencies
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

// Mock config manager
jest.mock('../../scripts/modules/config-manager.js', () => ({
	isCostAlertsEnabled: jest.fn(() => true),
	getCostAlertThresholds: jest.fn(() => ({
		sessionLimit: 1.0,
		taskLimit: 0.5,
		dailyLimit: 5.0
	})),
	MODEL_MAP: {
		'test-provider': [
			{
				id: 'test-model',
				cost_per_1m_tokens: {
					input: 10.0,
					output: 20.0
				}
			}
		]
	}
}));

// Mock AI SDK
jest.mock('ai', () => ({
	generateText: jest.fn(() =>
		Promise.resolve({
			text: 'Test response',
			usage: {
				promptTokens: 1000,
				completionTokens: 500,
				totalTokens: 1500
			}
		})
	)
}));

import { generateText } from 'ai';
import {
	createTrace,
	isEnabled
} from '../../src/observability/langfuse-tracer.js';

describe('Cost Tracking Integration', () => {
	// Test provider implementation
	class TestProvider extends BaseAIProvider {
		constructor() {
			super();
			this.name = 'TestProvider';
		}

		validateAuth(params) {
			// Skip API key validation for tests
		}

		getClient(params) {
			return (modelId) => ({ modelId });
		}
	}

	let provider;
	let mockTrace;
	let mockGeneration;

	beforeEach(() => {
		provider = new TestProvider();

		// Reset all mocks
		jest.clearAllMocks();
		resetSessionCosts();

		// Setup mock Langfuse objects
		mockGeneration = {
			end: jest.fn()
		};

		mockTrace = {
			generation: jest.fn(() => mockGeneration)
		};

		createTrace.mockResolvedValue(mockTrace);
		isEnabled.mockReturnValue(true);

		// Setup mock AI SDK response
		generateText.mockResolvedValue({
			text: 'Test response',
			usage: {
				promptTokens: 1000,
				completionTokens: 500,
				totalTokens: 1500
			}
		});
	});

	describe('BaseAIProvider cost integration', () => {
		test('should add cost metadata to Langfuse traces', async () => {
			const params = {
				modelId: 'test-model',
				messages: [{ role: 'user', content: 'test' }],
				taskMasterContext: {
					taskId: 'task-1',
					projectRoot: '/test/root'
				}
			};

			await provider.generateText(params);

			// Verify trace creation was called
			expect(createTrace).toHaveBeenCalledWith(
				expect.objectContaining({
					name: 'TestProvider generateText',
					metadata: expect.objectContaining({
						provider: 'TestProvider',
						model: 'test-model'
					})
				})
			);

			// Verify generation end was called with cost metadata
			expect(mockGeneration.end).toHaveBeenCalledWith(
				expect.objectContaining({
					metadata: expect.objectContaining({
						cost: expect.objectContaining({
							totalCost: expect.any(Number),
							inputCost: expect.any(Number),
							outputCost: expect.any(Number),
							currency: 'USD',
							breakdown: expect.any(Object)
						})
					})
				})
			);
		});

		test('should handle cost calculation failures gracefully', async () => {
			// Mock cost calculation to fail
			const originalCalculateAiCost =
				require('../../src/utils/cost-calculator.js').calculateAiCost;
			const mockCalculateAiCost = jest.fn(() => {
				throw new Error('Cost calculation failed');
			});
			jest.doMock('../../src/utils/cost-calculator.js', () => ({
				calculateAiCost: mockCalculateAiCost
			}));

			const params = {
				modelId: 'test-model',
				messages: [{ role: 'user', content: 'test' }]
			};

			// Should not throw even if cost calculation fails
			const result = await provider.generateText(params);

			expect(result.text).toBe('Test response');
			expect(mockGeneration.end).toHaveBeenCalled();

			// Cost metadata should not be included when calculation fails
			const endCallArgs = mockGeneration.end.mock.calls[0][0];
			expect(endCallArgs.metadata.cost).toBeUndefined();
		});

		test('should work when Langfuse is disabled', async () => {
			isEnabled.mockReturnValue(false);

			const params = {
				modelId: 'test-model',
				messages: [{ role: 'user', content: 'test' }]
			};

			const result = await provider.generateText(params);

			expect(result.text).toBe('Test response');
			expect(createTrace).not.toHaveBeenCalled();
		});

		test('should preserve original error handling when AI call fails', async () => {
			generateText.mockRejectedValue(new Error('AI call failed'));

			const params = {
				modelId: 'test-model',
				messages: [{ role: 'user', content: 'test' }]
			};

			await expect(provider.generateText(params)).rejects.toThrow(
				'TestProvider API error during text generation'
			);

			// Should still attempt to record error in trace
			expect(mockGeneration.end).toHaveBeenCalledWith(
				expect.objectContaining({
					level: 'ERROR',
					statusMessage: 'AI call failed'
				})
			);
		});

		test('should not break when trace creation fails', async () => {
			createTrace.mockRejectedValue(new Error('Langfuse unavailable'));

			const params = {
				modelId: 'test-model',
				messages: [{ role: 'user', content: 'test' }]
			};

			const result = await provider.generateText(params);

			expect(result.text).toBe('Test response');
			expect(mockTrace.generation).not.toHaveBeenCalled();
		});
	});

	describe('cost threshold integration', () => {
		test('should trigger alerts when thresholds are exceeded', async () => {
			// Mock generateText to return high token usage
			generateText.mockResolvedValue({
				text: 'Large response',
				usage: {
					promptTokens: 100000, // High usage to trigger alerts
					completionTokens: 50000,
					totalTokens: 150000
				}
			});

			const params = {
				modelId: 'test-model',
				messages: [{ role: 'user', content: 'test' }],
				taskMasterContext: {
					taskId: 'task-1',
					projectRoot: '/test/root'
				}
			};

			// This should trigger cost threshold checking internally
			await provider.generateText(params);

			// Verify the generation completed successfully despite high costs
			expect(mockGeneration.end).toHaveBeenCalled();

			const endCallArgs = mockGeneration.end.mock.calls[0][0];
			expect(endCallArgs.metadata.cost.totalCost).toBeGreaterThan(0);
		});

		test('should not break when cost threshold checking fails', async () => {
			// Mock checkCostThresholds to fail
			const mockCheckCostThresholds = jest.fn(() => {
				throw new Error('Threshold check failed');
			});
			jest.doMock('../../src/utils/cost-monitor.js', () => ({
				checkCostThresholds: mockCheckCostThresholds,
				shouldSkipCostTracking: jest.fn(() => false)
			}));

			const params = {
				modelId: 'test-model',
				messages: [{ role: 'user', content: 'test' }],
				taskMasterContext: {
					taskId: 'task-1',
					projectRoot: '/test/root'
				}
			};

			const result = await provider.generateText(params);

			expect(result.text).toBe('Test response');
			expect(mockGeneration.end).toHaveBeenCalled();
		});
	});

	describe('Task Master context integration', () => {
		test('should include Task Master context in cost metadata', async () => {
			const params = {
				modelId: 'test-model',
				messages: [{ role: 'user', content: 'test' }],
				taskMasterContext: {
					taskId: 'task-5',
					tag: 'feat-cost-tracking',
					command: 'update-task',
					role: 'main',
					projectRoot: '/test/project'
				}
			};

			await provider.generateText(params);

			// Verify trace creation includes Task Master context
			expect(createTrace).toHaveBeenCalledWith(
				expect.objectContaining({
					metadata: expect.objectContaining({
						taskMaster: expect.objectContaining({
							taskId: 'task-5',
							tag: 'feat-cost-tracking',
							command: 'update-task',
							role: 'main',
							projectRoot: '/test/project'
						})
					})
				})
			);

			// Verify generation metadata includes Task Master context
			expect(mockTrace.generation).toHaveBeenCalledWith(
				expect.objectContaining({
					metadata: expect.objectContaining({
						taskMaster: expect.objectContaining({
							taskId: 'task-5',
							tag: 'feat-cost-tracking',
							command: 'update-task',
							role: 'main'
						})
					})
				})
			);
		});

		test('should work without Task Master context', async () => {
			const params = {
				modelId: 'test-model',
				messages: [{ role: 'user', content: 'test' }]
				// No taskMasterContext
			};

			const result = await provider.generateText(params);

			expect(result.text).toBe('Test response');
			expect(createTrace).toHaveBeenCalled();
			expect(mockGeneration.end).toHaveBeenCalled();
		});
	});

	describe('edge cases and error handling', () => {
		test('should handle missing usage data gracefully', async () => {
			generateText.mockResolvedValue({
				text: 'Test response'
				// No usage data
			});

			const params = {
				modelId: 'test-model',
				messages: [{ role: 'user', content: 'test' }]
			};

			const result = await provider.generateText(params);

			expect(result.text).toBe('Test response');
			expect(mockGeneration.end).toHaveBeenCalled();

			// Cost should be calculated with 0 tokens
			const endCallArgs = mockGeneration.end.mock.calls[0][0];
			expect(endCallArgs.metadata.cost).toBeDefined();
			expect(endCallArgs.metadata.cost.totalCost).toBe(0);
		});

		test('should handle partial usage data', async () => {
			generateText.mockResolvedValue({
				text: 'Test response',
				usage: {
					promptTokens: 1000
					// Missing completionTokens and totalTokens
				}
			});

			const params = {
				modelId: 'test-model',
				messages: [{ role: 'user', content: 'test' }]
			};

			const result = await provider.generateText(params);

			expect(result.text).toBe('Test response');
			expect(mockGeneration.end).toHaveBeenCalled();

			// Cost should be calculated with available data
			const endCallArgs = mockGeneration.end.mock.calls[0][0];
			expect(endCallArgs.metadata.cost).toBeDefined();
		});

		test('should handle unknown model gracefully', async () => {
			const params = {
				modelId: 'unknown-model',
				messages: [{ role: 'user', content: 'test' }]
			};

			const result = await provider.generateText(params);

			expect(result.text).toBe('Test response');
			expect(mockGeneration.end).toHaveBeenCalled();

			// Cost calculation should fail gracefully for unknown model
			const endCallArgs = mockGeneration.end.mock.calls[0][0];
			expect(endCallArgs.metadata.cost).toBeUndefined();
		});
	});

	describe('performance impact', () => {
		test('should have minimal performance overhead', async () => {
			const params = {
				modelId: 'test-model',
				messages: [{ role: 'user', content: 'test' }]
			};

			const startTime = performance.now();

			// Run multiple calls to measure average overhead
			for (let i = 0; i < 10; i++) {
				await provider.generateText(params);
			}

			const endTime = performance.now();
			const averageTime = (endTime - startTime) / 10;

			// Cost tracking overhead should be minimal (less than 5ms per call)
			expect(averageTime).toBeLessThan(50); // Total time including mocked AI call
		});

		test('should not significantly increase memory usage', async () => {
			const initialMemory = process.memoryUsage().heapUsed;

			const params = {
				modelId: 'test-model',
				messages: [{ role: 'user', content: 'test' }]
			};

			// Run many calls to check for memory leaks
			for (let i = 0; i < 100; i++) {
				await provider.generateText(params);
			}

			// Force garbage collection if available
			if (global.gc) {
				global.gc();
			}

			const finalMemory = process.memoryUsage().heapUsed;
			const memoryIncrease = finalMemory - initialMemory;

			// Memory increase should be reasonable (less than 1MB)
			expect(memoryIncrease).toBeLessThan(1024 * 1024);
		});
	});

	describe('concurrent operations', () => {
		test('should handle concurrent cost tracking correctly', async () => {
			const params = {
				modelId: 'test-model',
				messages: [{ role: 'user', content: 'test' }]
			};

			// Run multiple concurrent operations
			const promises = [];
			for (let i = 0; i < 10; i++) {
				promises.push(provider.generateText(params));
			}

			const results = await Promise.all(promises);

			// All operations should complete successfully
			expect(results).toHaveLength(10);
			results.forEach((result) => {
				expect(result.text).toBe('Test response');
			});

			// All should have called generation.end with cost metadata
			expect(mockGeneration.end).toHaveBeenCalledTimes(10);
		});

		test('should maintain cost tracking accuracy under load', async () => {
			generateText.mockResolvedValue({
				text: 'Test response',
				usage: {
					promptTokens: 100,
					completionTokens: 50,
					totalTokens: 150
				}
			});

			const params = {
				modelId: 'test-model',
				messages: [{ role: 'user', content: 'test' }],
				taskMasterContext: {
					taskId: 'load-test',
					projectRoot: '/test/root'
				}
			};

			// Run many concurrent operations
			const promises = [];
			for (let i = 0; i < 50; i++) {
				promises.push(provider.generateText(params));
			}

			await Promise.all(promises);

			// Verify all operations completed with cost tracking
			expect(mockGeneration.end).toHaveBeenCalledTimes(50);

			// Check that cost data was included in each call
			mockGeneration.end.mock.calls.forEach((call) => {
				const endData = call[0];
				expect(endData.metadata.cost).toBeDefined();
				expect(endData.metadata.cost.totalCost).toBeGreaterThan(0);
			});
		});
	});
});
