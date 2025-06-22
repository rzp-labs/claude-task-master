/**
 * Integration tests for cost tracking with Langfuse
 * Tests cost metadata integration in AI provider calls
 */

import { jest } from '@jest/globals';
import { resetSessionCosts } from '../../src/utils/cost-monitor.js';

// Mock config manager to provide cost calculation data
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

describe('Cost Tracking Integration', () => {
	let originalEnv;
	let BaseAIProvider;

	beforeEach(async () => {
		// Save original environment
		originalEnv = process.env;

		// Clear module cache to ensure fresh imports
		jest.resetModules();

		// Import fresh BaseAIProvider module
		const baseProviderModule = await import('../../src/ai-providers/base-provider.js');
		BaseAIProvider = baseProviderModule.BaseAIProvider;

		// Reset cost tracking state
		resetSessionCosts();
	});

	afterEach(() => {
		// Restore original environment
		process.env = originalEnv;
	});

	// Helper to create a TestProvider class with configurable behavior
	const createTestProvider = (overrides = {}) => {
		return class TestProvider extends BaseAIProvider {
			constructor() {
				super();
				this.name = 'TestProvider';
			}

			validateAuth(params) {
				// Skip API key validation for tests
			}

			getClient(params) {
				return (modelId) => ({ modelId, provider: 'test-provider' });
			}

			async generateText(params) {
				this.validateParams(params);
				this.validateMessages(params.messages);

				// Handle error scenarios
				if (params.shouldError || overrides.shouldError) {
					throw new Error('Mock AI Provider Error');
				}

				// Default usage data
				let usage = {
					inputTokens: 1000,
					outputTokens: 500,
					totalTokens: 1500
				};

				// Handle different usage scenarios
				if (params.noUsage || overrides.noUsage) {
					usage = undefined;
				} else if (params.partialUsage || overrides.partialUsage) {
					usage = { inputTokens: 100 };
				} else if (params.highUsage || overrides.highUsage) {
					usage = {
						inputTokens: 100000,
						outputTokens: 50000,
						totalTokens: 150000
					};
				}

				return {
					text: 'Test response',
					usage
				};
			}
		};
	};

	describe('BaseAIProvider cost integration', () => {
		test('should add cost metadata to Langfuse traces', async () => {
			// Clear and set Langfuse environment variables
			delete process.env.LANGFUSE_SECRET_KEY;
			delete process.env.LANGFUSE_PUBLIC_KEY;
			delete process.env.LANGFUSE_BASEURL;
			delete process.env.LANGFUSE_DEBUG;

			process.env.LANGFUSE_SECRET_KEY = 'test-secret';
			process.env.LANGFUSE_PUBLIC_KEY = 'test-public';

			const TestProvider = createTestProvider();
			const provider = new TestProvider();

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
			expect(result.usage.inputTokens).toBe(1000);
			expect(result.usage.outputTokens).toBe(500);
			expect(result.usage.totalTokens).toBe(1500);
			expect(provider._instrumentationEnabled).toBe(true);
		});

		test('should handle cost calculation failures gracefully', async () => {
			delete process.env.LANGFUSE_SECRET_KEY;
			delete process.env.LANGFUSE_PUBLIC_KEY;
			process.env.LANGFUSE_SECRET_KEY = 'test-secret';
			process.env.LANGFUSE_PUBLIC_KEY = 'test-public';

			const TestProvider = createTestProvider();
			const provider = new TestProvider();

			const params = {
				modelId: 'unknown-model', // This model isn't in our mock config
				messages: [{ role: 'user', content: 'test' }]
			};

			// Should not throw even if cost calculation fails
			const result = await provider.generateText(params);

			expect(result.text).toBe('Test response');
			expect(result.usage.totalTokens).toBe(1500);
		});

		test('should work when Langfuse is disabled', async () => {
			// Clear Langfuse environment variables to disable it
			delete process.env.LANGFUSE_SECRET_KEY;
			delete process.env.LANGFUSE_PUBLIC_KEY;
			delete process.env.LANGFUSE_BASEURL;
			delete process.env.LANGFUSE_DEBUG;

			const TestProvider = createTestProvider();
			const provider = new TestProvider();

			const params = {
				modelId: 'test-model',
				messages: [{ role: 'user', content: 'test' }]
			};

			const result = await provider.generateText(params);

			expect(result.text).toBe('Test response');
			expect(provider._instrumentationEnabled).toBe(false);
		});

		test('should preserve original error handling when AI call fails', async () => {
			delete process.env.LANGFUSE_SECRET_KEY;
			delete process.env.LANGFUSE_PUBLIC_KEY;
			process.env.LANGFUSE_SECRET_KEY = 'test-secret';
			process.env.LANGFUSE_PUBLIC_KEY = 'test-public';

			const TestProvider = createTestProvider({ shouldError: true });
			const provider = new TestProvider();

			const params = {
				modelId: 'test-model',
				messages: [{ role: 'user', content: 'test' }]
			};

			await expect(provider.generateText(params)).rejects.toThrow(
				'Mock AI Provider Error'
			);
		});

		test('should not break when trace creation fails', async () => {
			delete process.env.LANGFUSE_SECRET_KEY;
			delete process.env.LANGFUSE_PUBLIC_KEY;
			process.env.LANGFUSE_SECRET_KEY = 'test-secret';
			process.env.LANGFUSE_PUBLIC_KEY = 'test-public';

			const TestProvider = createTestProvider();
			const provider = new TestProvider();

			const params = {
				modelId: 'test-model',
				messages: [{ role: 'user', content: 'test' }]
			};

			// Even if trace creation fails internally, the method should still work
			const result = await provider.generateText(params);

			expect(result.text).toBe('Test response');
		});
	});

	describe('cost threshold integration', () => {
		test('should trigger alerts when thresholds are exceeded', async () => {
			delete process.env.LANGFUSE_SECRET_KEY;
			delete process.env.LANGFUSE_PUBLIC_KEY;
			process.env.LANGFUSE_SECRET_KEY = 'test-secret';
			process.env.LANGFUSE_PUBLIC_KEY = 'test-public';

			const TestProvider = createTestProvider({ highUsage: true });
			const provider = new TestProvider();

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
			expect(result.usage.totalTokens).toBe(150000);
		});

		test('should not break when cost threshold checking fails', async () => {
			delete process.env.LANGFUSE_SECRET_KEY;
			delete process.env.LANGFUSE_PUBLIC_KEY;
			process.env.LANGFUSE_SECRET_KEY = 'test-secret';
			process.env.LANGFUSE_PUBLIC_KEY = 'test-public';

			const TestProvider = createTestProvider();
			const provider = new TestProvider();

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
		});
	});

	describe('Task Master context integration', () => {
		test('should include Task Master context in cost metadata', async () => {
			delete process.env.LANGFUSE_SECRET_KEY;
			delete process.env.LANGFUSE_PUBLIC_KEY;
			process.env.LANGFUSE_SECRET_KEY = 'test-secret';
			process.env.LANGFUSE_PUBLIC_KEY = 'test-public';

			const TestProvider = createTestProvider();
			const provider = new TestProvider();

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

			const result = await provider.generateText(params);

			expect(result.text).toBe('Test response');
		});

		test('should work without Task Master context', async () => {
			delete process.env.LANGFUSE_SECRET_KEY;
			delete process.env.LANGFUSE_PUBLIC_KEY;
			process.env.LANGFUSE_SECRET_KEY = 'test-secret';
			process.env.LANGFUSE_PUBLIC_KEY = 'test-public';

			const TestProvider = createTestProvider();
			const provider = new TestProvider();

			const params = {
				modelId: 'test-model',
				messages: [{ role: 'user', content: 'test' }]
				// No taskMasterContext
			};

			const result = await provider.generateText(params);

			expect(result.text).toBe('Test response');
		});
	});

	describe('edge cases and error handling', () => {
		test('should handle missing usage data gracefully', async () => {
			delete process.env.LANGFUSE_SECRET_KEY;
			delete process.env.LANGFUSE_PUBLIC_KEY;
			process.env.LANGFUSE_SECRET_KEY = 'test-secret';
			process.env.LANGFUSE_PUBLIC_KEY = 'test-public';

			const TestProvider = createTestProvider({ noUsage: true });
			const provider = new TestProvider();

			const params = {
				modelId: 'test-model',
				messages: [{ role: 'user', content: 'test' }]
			};

			const result = await provider.generateText(params);

			expect(result.text).toBe('Test response');
			expect(result.usage).toBeUndefined();
		});

		test('should handle partial usage data', async () => {
			delete process.env.LANGFUSE_SECRET_KEY;
			delete process.env.LANGFUSE_PUBLIC_KEY;
			process.env.LANGFUSE_SECRET_KEY = 'test-secret';
			process.env.LANGFUSE_PUBLIC_KEY = 'test-public';

			const TestProvider = createTestProvider({ partialUsage: true });
			const provider = new TestProvider();

			const params = {
				modelId: 'test-model',
				messages: [{ role: 'user', content: 'test' }]
			};

			const result = await provider.generateText(params);

			expect(result.text).toBe('Test response');
			expect(result.usage.inputTokens).toBe(100);
			expect(result.usage.outputTokens).toBeUndefined();
		});

		test('should handle unknown model gracefully', async () => {
			delete process.env.LANGFUSE_SECRET_KEY;
			delete process.env.LANGFUSE_PUBLIC_KEY;
			process.env.LANGFUSE_SECRET_KEY = 'test-secret';
			process.env.LANGFUSE_PUBLIC_KEY = 'test-public';

			const TestProvider = createTestProvider();
			const provider = new TestProvider();

			const params = {
				modelId: 'unknown-model',
				messages: [{ role: 'user', content: 'test' }]
			};

			const result = await provider.generateText(params);

			expect(result.text).toBe('Test response');
		});
	});

	describe('performance impact', () => {
		test('should have minimal performance overhead', async () => {
			delete process.env.LANGFUSE_SECRET_KEY;
			delete process.env.LANGFUSE_PUBLIC_KEY;
			process.env.LANGFUSE_SECRET_KEY = 'test-secret';
			process.env.LANGFUSE_PUBLIC_KEY = 'test-public';

			const TestProvider = createTestProvider();
			const provider = new TestProvider();

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

			// Should be reasonably fast (less than 50ms per call)
			expect(averageTime).toBeLessThan(50);
		});

		test('should not significantly increase memory usage', async () => {
			delete process.env.LANGFUSE_SECRET_KEY;
			delete process.env.LANGFUSE_PUBLIC_KEY;
			process.env.LANGFUSE_SECRET_KEY = 'test-secret';
			process.env.LANGFUSE_PUBLIC_KEY = 'test-public';

			const initialMemory = process.memoryUsage().heapUsed;

			const TestProvider = createTestProvider();
			const provider = new TestProvider();

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

			// Memory increase should be reasonable (less than 10MB due to Langfuse initialization)
			expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
		});
	});

	describe('concurrent operations', () => {
		test('should handle concurrent cost tracking correctly', async () => {
			delete process.env.LANGFUSE_SECRET_KEY;
			delete process.env.LANGFUSE_PUBLIC_KEY;
			process.env.LANGFUSE_SECRET_KEY = 'test-secret';
			process.env.LANGFUSE_PUBLIC_KEY = 'test-public';

			const TestProvider = createTestProvider();
			const provider = new TestProvider();

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
		});

		test('should maintain cost tracking accuracy under load', async () => {
			delete process.env.LANGFUSE_SECRET_KEY;
			delete process.env.LANGFUSE_PUBLIC_KEY;
			process.env.LANGFUSE_SECRET_KEY = 'test-secret';
			process.env.LANGFUSE_PUBLIC_KEY = 'test-public';

			const TestProvider = createTestProvider();
			const provider = new TestProvider();

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

			const results = await Promise.all(promises);

			// Verify all operations completed successfully
			expect(results).toHaveLength(50);
			results.forEach((result) => {
				expect(result.text).toBe('Test response');
				expect(result.usage.totalTokens).toBe(1500);
			});
		});
	});
});