import { jest } from '@jest/globals';

// Mock the base provider to avoid circular dependency issues
jest.unstable_mockModule('../../../src/ai-providers/base-provider.js', () => ({
	BaseAIProvider: class MockBaseAIProvider {
		constructor() {
			this.name = this.constructor.name;
		}
		validateParams() {}
		prepareMessages() {
			return [];
		}
	}
}));

// Import after mocking base provider
const { ClaudeCodeProvider } = await import(
	'../../../src/ai-providers/claude-code.js'
);

describe('ClaudeCodeProvider', () => {
	let provider;
	let mockQuery;

	beforeEach(() => {
		// Create a fresh mock for each test
		mockQuery = jest.fn();

		// Create provider instance
		provider = new ClaudeCodeProvider();

		// Mock the loadSDK method to return our mocked module
		provider.loadSDK = jest.fn().mockResolvedValue({
			query: mockQuery
		});

		jest.clearAllMocks();
	});

	describe('constructor', () => {
		it('should initialize with correct properties', () => {
			expect(provider.providerName).toBe('claude-code');
			expect(provider.requiresApiKey).toBe(false);
			expect(provider.supportsStreaming).toBe(true);
			expect(provider.supportsTools).toBe(true);
		});
	});

	describe('checkAuthentication', () => {
		it('should always return true (relies on SDK auth)', async () => {
			const result = await provider.checkAuthentication();
			expect(result).toBe(true);
		});
	});

	describe('generateText', () => {
		it('should generate text from assistant messages', async () => {
			// Mock the async iterator response
			const mockMessages = [
				{
					type: 'system',
					message: { content: 'System message' }
				},
				{
					type: 'assistant',
					message: {
						content: [{ type: 'text', text: 'Hello, this is a test response' }]
					}
				},
				{
					type: 'result',
					result: {
						input_tokens: 10,
						output_tokens: 20
					}
				}
			];

			mockQuery.mockImplementation(async function* () {
				for (const msg of mockMessages) {
					yield msg;
				}
			});

			const params = {
				messages: [{ role: 'user', content: 'Test prompt' }],
				temperature: 0.7,
				maxTokens: 1000
			};

			const result = await provider.generateText(params);

			expect(mockQuery).toHaveBeenCalledWith({
				prompt: 'Test prompt',
				options: expect.objectContaining({
					maxTurns: 1,
					allowedTools: [],
					permissionMode: 'default'
				})
			});

			expect(result.text).toBe('Hello, this is a test response');
			expect(result.usage).toBeDefined();
			expect(result.usage.promptTokens).toBeGreaterThan(0);
		});

		it('should handle system prompts correctly', async () => {
			const mockMessages = [
				{
					type: 'assistant',
					message: {
						content: [{ type: 'text', text: 'Response with system prompt' }]
					}
				}
			];

			mockQuery.mockImplementation(async function* () {
				for (const msg of mockMessages) {
					yield msg;
				}
			});

			const params = {
				messages: [
					{ role: 'system', content: 'You are a helpful assistant' },
					{ role: 'user', content: 'Test prompt' }
				],
				systemPrompt: 'Additional system context'
			};

			await provider.generateText(params);

			expect(mockQuery).toHaveBeenCalledWith({
				prompt: 'Test prompt',
				options: expect.objectContaining({
					systemPrompt: expect.stringContaining('You are a helpful assistant')
				})
			});
		});
	});

	describe('generateObject', () => {
		it('should parse JSON response correctly', async () => {
			const expectedObject = {
				tasks: [{ id: 1, title: 'Test Task', description: 'Test description' }],
				metadata: { totalTasks: 1 }
			};

			const mockMessages = [
				{
					type: 'assistant',
					message: {
						content: [{ type: 'text', text: JSON.stringify(expectedObject) }]
					}
				}
			];

			mockQuery.mockImplementation(async function* () {
				for (const msg of mockMessages) {
					yield msg;
				}
			});

			const params = {
				messages: [{ role: 'user', content: 'Generate tasks' }],
				schema: { type: 'object' }
			};

			const result = await provider.generateObject(params);

			expect(result.object).toEqual(expectedObject);
			expect(result.usage).toBeDefined();
		});

		it('should handle JSON with markdown code blocks', async () => {
			const expectedObject = { test: 'value' };

			const mockMessages = [
				{
					type: 'assistant',
					message: {
						content: [{ type: 'text', text: '```json\n{"test": "value"}\n```' }]
					}
				}
			];

			mockQuery.mockImplementation(async function* () {
				for (const msg of mockMessages) {
					yield msg;
				}
			});

			const params = {
				messages: [{ role: 'user', content: 'Test' }],
				schema: {}
			};

			const result = await provider.generateObject(params);
			expect(result.object).toEqual(expectedObject);
		});

		it('should throw error for invalid JSON', async () => {
			const mockMessages = [
				{
					type: 'assistant',
					message: {
						content: [{ type: 'text', text: 'This is not valid JSON' }]
					}
				}
			];

			mockQuery.mockImplementation(async function* () {
				for (const msg of mockMessages) {
					yield msg;
				}
			});

			const params = {
				messages: [{ role: 'user', content: 'Test' }],
				schema: {}
			};

			await expect(provider.generateObject(params)).rejects.toThrow(
				'Failed to parse JSON response'
			);
		});
	});

	describe('streamText', () => {
		it('should stream text chunks correctly', async () => {
			const chunks = ['Hello', ' ', 'world'];
			const mockMessages = chunks.map((chunk) => ({
				type: 'assistant',
				message: {
					content: [{ type: 'text', text: chunk }]
				}
			}));

			mockQuery.mockImplementation(async function* () {
				for (const msg of mockMessages) {
					yield msg;
				}
			});

			const receivedChunks = [];
			const params = {
				messages: [{ role: 'user', content: 'Test' }],
				onChunk: (chunk) => receivedChunks.push(chunk)
			};

			const result = await provider.streamText(params);

			expect(receivedChunks).toEqual(chunks);
			expect(result.text).toBe('Hello world');
			expect(result.usage).toBeDefined();
		});
	});

	describe('error handling', () => {
		it('should handle SDK not installed error', async () => {
			// Override the mock to simulate SDK not found
			provider.loadSDK = jest
				.fn()
				.mockRejectedValue(
					new Error('Cannot find module @anthropic-ai/claude-code')
				);

			await expect(provider.generateText({ messages: [] })).rejects.toThrow(
				'Cannot find module @anthropic-ai/claude-code'
			);
		});

		it('should handle authentication errors', async () => {
			mockQuery.mockImplementation(() => {
				throw new Error('unauthorized: credentials not found');
			});

			await expect(
				provider.generateText({ messages: [{ role: 'user', content: 'test' }] })
			).rejects.toThrow(
				'Claude Code authentication failed'
			);
		});

		it('should handle aborted requests', async () => {
			mockQuery.mockImplementation(() => {
				throw new Error('Request aborted');
			});

			await expect(
				provider.generateText({ messages: [{ role: 'user', content: 'test' }] })
			).rejects.toThrow('Request was aborted');
		});
	});

	describe('extractUsageFromMessages', () => {
		it('should extract usage from result message', () => {
			const messages = [
				{
					type: 'result',
					result: {
						input_tokens: 100,
						output_tokens: 50
					},
					total_cost_usd: 0.001
				}
			];

			const usage = provider.extractUsageFromMessages(messages);
			expect(usage).toEqual({
				promptTokens: 100,
				completionTokens: 50,
				totalTokens: 150,
				costUSD: 0.001
			});
		});

		it('should return null if no result message', () => {
			const messages = [
				{
					type: 'assistant',
					message: { content: [{ type: 'text', text: 'Hello' }] }
				}
			];

			const usage = provider.extractUsageFromMessages(messages);
			expect(usage).toBeNull();
		});
	});

	describe('generateTextWithTools', () => {
		it('should generate text with tool support', async () => {
			const mockMessages = [
				{
					type: 'assistant',
					message: {
						content: [{ type: 'text', text: 'I will list the files for you.' }],
						tool_calls: [
							{
								id: 'call_123',
								type: 'function',
								function: {
									name: 'list_files',
									arguments: '{}'
								}
							}
						]
					}
				},
				{
					type: 'result',
					result: {
						input_tokens: 100,
						output_tokens: 50
					}
				}
			];

			mockQuery.mockImplementation(async function* () {
				for (const msg of mockMessages) {
					yield msg;
				}
			});

			const params = {
				messages: [{ role: 'user', content: 'List files in current directory' }],
				tools: [
					{
						name: 'list_files',
						description: 'List files in a directory'
					}
				],
				model: 'claude-opus-4-20250514'
			};

			const result = await provider.generateTextWithTools(params);

			expect(mockQuery).toHaveBeenCalledWith({
				prompt: 'List files in current directory',
				options: expect.objectContaining({
					allowedTools: ['list_files'],
					model: 'claude-opus-4-20250514'
				})
			});

			expect(result.text).toBe('I will list the files for you.');
			expect(result.toolCalls).toHaveLength(1);
			expect(result.toolCalls[0].function.name).toBe('list_files');
			expect(result.usage).toBeDefined();
		});
	});

	describe('getCapabilities', () => {
		it('should return provider capabilities', () => {
			const capabilities = provider.getCapabilities();
			
			expect(capabilities).toEqual({
				streaming: true,
				tools: true,
				functionCalling: false,
				vision: true,
				maxContextTokens: 200000,
				costPerMillionTokens: {
					input: 0,
					output: 0
				},
				supportedModels: expect.arrayContaining([
					'claude-opus-4-20250514',
					'claude-3-opus-20240229',
					'claude-3-sonnet-20240229',
					'claude-3-haiku-20240307'
				]),
				defaultModel: 'claude-opus-4-20250514'
			});
		});
	});

	describe('AbortController support', () => {
		it('should pass abort signal to SDK', async () => {
			const abortController = new AbortController();
			const mockMessages = [
				{
					type: 'assistant',
					message: {
						content: [{ type: 'text', text: 'Test response' }]
					}
				}
			];

			mockQuery.mockImplementation(async function* (args) {
				// Verify abort controller was passed
				expect(args.abortController).toBeDefined();
				expect(args.abortController.signal).toBe(abortController.signal);
				
				for (const msg of mockMessages) {
					yield msg;
				}
			});

			const params = {
				messages: [{ role: 'user', content: 'Test' }],
				abortSignal: abortController.signal
			};

			await provider.generateText(params);
		});
	});

	describe('model parameter support', () => {
		it('should use specified model', async () => {
			const mockMessages = [
				{
					type: 'assistant',
					message: {
						content: [{ type: 'text', text: 'Model test' }]
					}
				}
			];

			mockQuery.mockImplementation(async function* () {
				for (const msg of mockMessages) {
					yield msg;
				}
			});

			const params = {
				messages: [{ role: 'user', content: 'Test' }],
				model: 'claude-3-opus-20240229'
			};

			await provider.generateText(params);

			expect(mockQuery).toHaveBeenCalledWith({
				prompt: 'Test',
				options: expect.objectContaining({
					model: 'claude-3-opus-20240229'
				})
			});
		});

		it('should use default model if not specified', async () => {
			const mockMessages = [
				{
					type: 'assistant',
					message: {
						content: [{ type: 'text', text: 'Default model test' }]
					}
				}
			];

			mockQuery.mockImplementation(async function* () {
				for (const msg of mockMessages) {
					yield msg;
				}
			});

			const params = {
				messages: [{ role: 'user', content: 'Test' }]
			};

			await provider.generateText(params);

			expect(mockQuery).toHaveBeenCalledWith({
				prompt: 'Test',
				options: expect.objectContaining({
					model: 'claude-opus-4-20250514'
				})
			});
		});
	});
});
