/**
 * tests/unit/ai-providers/stream-tracing.test.js
 *
 * Comprehensive test suite for streaming response tracing
 * Tests StreamTraceWrapper, TokenCounter, and BaseAIProvider integration
 */

import { jest } from '@jest/globals';
import {
	StreamTraceWrapper,
	TokenCounter
} from '../../../src/observability/stream-trace-wrapper.js';

describe('StreamTraceWrapper', () => {
	let mockTrace;
	let mockSpan;
	let mockStream;

	beforeEach(() => {
		// Mock Langfuse span
		mockSpan = {
			update: jest.fn(),
			end: jest.fn()
		};

		// Mock Langfuse trace
		mockTrace = {
			span: jest.fn(() => mockSpan),
			update: jest.fn()
		};

		// Reset all mocks
		jest.clearAllMocks();
	});

	describe('TokenCounter', () => {
		test('should estimate tokens using word-based calculation', () => {
			const tokenCounter = new TokenCounter('TestProvider');

			// Test basic word counting
			const tokens1 = tokenCounter.estimateTokens('Hello world');
			expect(tokens1).toBe(3); // 2 words * 1.3 = 2.6, ceil = 3

			// Test empty input
			const tokens2 = tokenCounter.estimateTokens('');
			expect(tokens2).toBe(0);

			// Test null input
			const tokens3 = tokenCounter.estimateTokens(null);
			expect(tokens3).toBe(0);
		});

		test('should accumulate text for better estimation', () => {
			const tokenCounter = new TokenCounter('TestProvider');

			tokenCounter.estimateTokens('Hello ');
			tokenCounter.estimateTokens('beautiful ');
			tokenCounter.estimateTokens('world');

			expect(tokenCounter.estimationBuffer).toBe('Hello beautiful world');
		});

		test('should handle provider-specific token counting', async () => {
			const tokenCounter = new TokenCounter('TestProvider');

			const finalCount =
				await tokenCounter.getActualTokenCount('Hello world test');
			expect(finalCount).toBeGreaterThan(0);
		});
	});

	describe('StreamTraceWrapper Constructor', () => {
		test('should initialize with correct properties', () => {
			const mockOriginalStream = createMockStream(['chunk1', 'chunk2']);
			const inputParams = { modelId: 'test-model', temperature: 0.7 };

			const wrapper = new StreamTraceWrapper(
				mockOriginalStream,
				mockTrace,
				'TestProvider',
				inputParams
			);

			expect(wrapper.providerName).toBe('TestProvider');
			expect(wrapper.inputParams).toBe(inputParams);
			expect(wrapper.estimatedTokens).toBe(0);
			expect(wrapper.textAccumulator).toBe('');
			expect(wrapper.chunkCount).toBe(0);
			expect(wrapper.completed).toBe(false);
		});

		test('should create span with correct metadata', async () => {
			const mockOriginalStream = createMockStream(['chunk1']);
			const inputParams = {
				modelId: 'test-model',
				temperature: 0.7,
				maxTokens: 100,
				messages: [{ role: 'user', content: 'test' }]
			};

			const wrapper = new StreamTraceWrapper(
				mockOriginalStream,
				mockTrace,
				'TestProvider',
				inputParams
			);

			// Wait for async initialization
			await new Promise((resolve) => setTimeout(resolve, 0));

			expect(mockTrace.span).toHaveBeenCalledWith({
				name: 'TestProvider streamText',
				input: inputParams.messages,
				metadata: {
					provider: 'TestProvider',
					model: 'test-model',
					streaming: true,
					temperature: 0.7,
					maxTokens: 100
				}
			});
		});
	});

	describe('Stream Processing', () => {
		test('should process chunks and update metrics', async () => {
			const chunks = [
				{ textDelta: 'Hello ' },
				{ textDelta: 'world' },
				{ textDelta: '!' }
			];
			const mockOriginalStream = createMockStream(chunks);

			const wrapper = new StreamTraceWrapper(
				mockOriginalStream,
				mockTrace,
				'TestProvider',
				{ modelId: 'test-model' }
			);

			const results = [];
			for await (const chunk of wrapper) {
				results.push(chunk);
			}

			expect(results).toEqual(chunks);
			expect(wrapper.textAccumulator).toBe('Hello world!');
			expect(wrapper.chunkCount).toBe(3);
			expect(wrapper.estimatedTokens).toBeGreaterThan(0);
		});

		test('should track first token time (TTFT)', async () => {
			const chunks = [{ textDelta: 'First' }, { textDelta: 'Second' }];
			const mockOriginalStream = createMockStream(chunks, [10, 10]); // 10ms delays

			const wrapper = new StreamTraceWrapper(
				mockOriginalStream,
				mockTrace,
				'TestProvider',
				{ modelId: 'test-model' }
			);

			const startTime = performance.now();
			const results = [];
			for await (const chunk of wrapper) {
				results.push(chunk);
			}

			expect(wrapper.firstTokenTime).not.toBeNull();
			expect(wrapper.firstTokenTime).toBeGreaterThan(startTime);
		});

		test('should handle empty or null textDelta', async () => {
			const chunks = [
				{ textDelta: null },
				{ textDelta: '' },
				{ textDelta: 'valid text' }
			];
			const mockOriginalStream = createMockStream(chunks);

			const wrapper = new StreamTraceWrapper(
				mockOriginalStream,
				mockTrace,
				'TestProvider',
				{ modelId: 'test-model' }
			);

			const results = [];
			for await (const chunk of wrapper) {
				results.push(chunk);
			}

			expect(wrapper.textAccumulator).toBe('valid text');
			expect(wrapper.chunkCount).toBe(3);
		});
	});

	describe('Error Handling', () => {
		test('should preserve original stream errors', async () => {
			const mockOriginalStream = createMockStreamWithError('Test error', 1);

			const wrapper = new StreamTraceWrapper(
				mockOriginalStream,
				mockTrace,
				'TestProvider',
				{ modelId: 'test-model' }
			);

			await expect(async () => {
				for await (const chunk of wrapper) {
					// Should throw before we get here
				}
			}).rejects.toThrow('Test error');
		});

		test('should continue streaming if span creation fails', async () => {
			// Mock trace.span to throw an error
			mockTrace.span.mockImplementation(() => {
				throw new Error('Span creation failed');
			});

			const chunks = [{ textDelta: 'Hello' }];
			const mockOriginalStream = createMockStream(chunks);

			const wrapper = new StreamTraceWrapper(
				mockOriginalStream,
				mockTrace,
				'TestProvider',
				{ modelId: 'test-model' }
			);

			const results = [];
			for await (const chunk of wrapper) {
				results.push(chunk);
			}

			expect(results).toEqual(chunks);
		});

		test('should continue streaming if span updates fail', async () => {
			mockSpan.update.mockImplementation(() => {
				throw new Error('Span update failed');
			});

			const chunks = [{ textDelta: 'Hello' }];
			const mockOriginalStream = createMockStream(chunks);

			const wrapper = new StreamTraceWrapper(
				mockOriginalStream,
				mockTrace,
				'TestProvider',
				{ modelId: 'test-model' }
			);

			const results = [];
			for await (const chunk of wrapper) {
				results.push(chunk);
			}

			expect(results).toEqual(chunks);
		});
	});

	describe('Performance Optimization', () => {
		test('should limit memory usage for long streams', async () => {
			const largeText = 'x'.repeat(30000); // Create large text
			const chunks = Array(10).fill({ textDelta: largeText });
			const mockOriginalStream = createMockStream(chunks);

			const wrapper = new StreamTraceWrapper(
				mockOriginalStream,
				mockTrace,
				'TestProvider',
				{ modelId: 'test-model' }
			);

			const results = [];
			for await (const chunk of wrapper) {
				results.push(chunk);
			}

			// Text accumulator should be limited to MAX_TEXT_LENGTH
			expect(wrapper.textAccumulator.length).toBeLessThanOrEqual(
				wrapper.MAX_TEXT_LENGTH
			);
		});

		test('should batch span updates for performance', async () => {
			const chunks = Array(10).fill({ textDelta: 'test ' });
			const mockOriginalStream = createMockStream(chunks);

			const wrapper = new StreamTraceWrapper(
				mockOriginalStream,
				mockTrace,
				'TestProvider',
				{ modelId: 'test-model' }
			);

			const results = [];
			for await (const chunk of wrapper) {
				results.push(chunk);
			}

			// Should not update span for every chunk (batched updates)
			expect(mockSpan.update.mock.calls.length).toBeLessThan(chunks.length);
		});
	});

	describe('Integration with Various Stream Sizes', () => {
		test('should handle small streams (1-10 tokens)', async () => {
			const chunks = [{ textDelta: 'Hello world' }];
			await testStreamSize(chunks, 'small');
		});

		test('should handle medium streams (100-1000 tokens)', async () => {
			const chunks = Array(100).fill({ textDelta: 'word ' });
			await testStreamSize(chunks, 'medium');
		});

		test('should handle large streams (1000+ tokens)', async () => {
			const chunks = Array(1000).fill({ textDelta: 'token ' });
			await testStreamSize(chunks, 'large');
		});

		async function testStreamSize(chunks, size) {
			const mockOriginalStream = createMockStream(chunks);

			const wrapper = new StreamTraceWrapper(
				mockOriginalStream,
				mockTrace,
				'TestProvider',
				{ modelId: 'test-model' }
			);

			const startTime = performance.now();
			const results = [];
			for await (const chunk of wrapper) {
				results.push(chunk);
			}
			const endTime = performance.now();

			expect(results).toHaveLength(chunks.length);
			expect(wrapper.chunkCount).toBe(chunks.length);

			// Performance check: should complete within reasonable time
			const duration = endTime - startTime;
			console.log(
				`${size} stream (${chunks.length} chunks) processed in ${duration}ms`
			);

			// Basic performance assertion (adjust based on system capabilities)
			if (size === 'small') expect(duration).toBeLessThan(100);
			if (size === 'medium') expect(duration).toBeLessThan(500);
			if (size === 'large') expect(duration).toBeLessThan(2000);
		}
	});

	describe('Trace Completion', () => {
		test('should complete trace with final metrics', async () => {
			const chunks = [{ textDelta: 'Hello ' }, { textDelta: 'world' }];
			const mockOriginalStream = createMockStream(chunks);

			const wrapper = new StreamTraceWrapper(
				mockOriginalStream,
				mockTrace,
				'TestProvider',
				{ modelId: 'test-model' }
			);

			const results = [];
			for await (const chunk of wrapper) {
				results.push(chunk);
			}

			expect(mockSpan.end).toHaveBeenCalledWith(
				expect.objectContaining({
					output: 'Hello world',
					usage: expect.objectContaining({
						completionTokens: expect.any(Number),
						totalTokens: expect.any(Number)
					}),
					metadata: expect.objectContaining({
						ttft: expect.any(Number),
						totalDuration: expect.any(Number),
						chunkCount: 2,
						estimatedTokens: expect.any(Number),
						actualTokens: expect.any(Number),
						estimationAccuracy: expect.any(Number)
					})
				})
			);
		});
	});
});

// Helper functions for creating mock streams
function createMockStream(chunks, delays = []) {
	return {
		async *[Symbol.asyncIterator]() {
			for (let i = 0; i < chunks.length; i++) {
				if (delays[i]) {
					await sleep(delays[i]);
				}
				yield chunks[i];
			}
		}
	};
}

function createMockStreamWithError(errorMessage, errorAtIndex) {
	return {
		async *[Symbol.asyncIterator]() {
			for (let i = 0; i < 5; i++) {
				if (i === errorAtIndex) {
					throw new Error(errorMessage);
				}
				yield { textDelta: `chunk${i}` };
			}
		}
	};
}

function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
