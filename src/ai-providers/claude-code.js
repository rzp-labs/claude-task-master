/**
 * Claude Code SDK Provider for Task Master
 *
 * This provider integrates Claude Code's natural language processing capabilities
 * directly into Task Master without requiring API keys, using the free subscription model.
 *
 * Key Features:
 * - No API key required (uses Claude Code's OAuth2 authentication)
 * - Environment-aware execution
 * - Streaming responses
 * - Multi-turn conversation support
 * - Codebase understanding
 */

import { BaseAIProvider } from './base-provider.js';

export class ClaudeCodeProvider extends BaseAIProvider {
	constructor() {
		super();
		this.providerName = 'claude-code';
		this.requiresApiKey = false; // Uses SDK's internal OAuth2 auth
		this.supportsStreaming = true;
		this.supportsTools = true;
		this._sdkModule = null;
	}

	/**
	 * Lazily load the Claude Code SDK to avoid import errors if not installed
	 */
	async loadSDK() {
		if (!this._sdkModule) {
			try {
				// Import from the SDK module path
				this._sdkModule = await import('@anthropic-ai/claude-code/sdk.mjs');
			} catch (error) {
				const errorMessage = error.message || error.toString();
				
				// Provide detailed installation guidance
				if (errorMessage.includes('Cannot find module') || errorMessage.includes('MODULE_NOT_FOUND')) {
					throw new Error(
						'Claude Code SDK not installed. Please install it with:\n' +
						'npm install @anthropic-ai/claude-code\n\n' +
						'Note: This SDK requires Node.js 18+ and uses the same authentication as Claude desktop app.'
					);
				}
				
				// Re-throw other errors with context
				throw new Error(`Failed to load Claude Code SDK: ${errorMessage}`);
			}
		}
		return this._sdkModule;
	}

	/**
	 * Get the Claude Code SDK client
	 * @param {Object} params - Parameters (unused for Claude Code)
	 * @returns {Promise<Object>} The SDK module
	 */
	async getClient(params = {}) {
		return this.loadSDK();
	}

	/**
	 * Check if Claude Code is properly authenticated
	 */
	async checkAuthentication() {
		// Claude Code SDK uses transparent authentication (same as Claude desktop app)
		// No API keys needed - authentication is handled by the SDK internally
		// The SDK will provide apiKeySource: "none" but still work correctly
		return true;
	}

	/**
	 * Convert Task Master message format to Claude Code prompt
	 */
	convertMessagesToPrompt(messages) {
		const parts = [];
		let systemPrompt = null;

		for (const msg of messages) {
			if (msg.role === 'system') {
				systemPrompt = msg.content;
			} else if (msg.role === 'user') {
				parts.push(msg.content);
			} else if (msg.role === 'assistant') {
				parts.push(`Previous response: ${msg.content}`);
			}
		}

		return {
			prompt: parts.join('\n\n'),
			systemPrompt
		};
	}

	/**
	 * Extract text content from Claude Code SDK message
	 */
	extractTextFromMessage(message) {
		const textParts = [];

		// Handle SDKMessage format based on actual SDK behavior
		if (message.type === 'assistant' && message.message) {
			// message.message is the Anthropic Message object
			const content = message.message.content;
			if (Array.isArray(content)) {
				for (const block of content) {
					if (block.type === 'text') {
						textParts.push(block.text);
					}
				}
			} else if (typeof content === 'string') {
				textParts.push(content);
			}
		} else if (message.type === 'result') {
			// Result messages contain cost and usage information
			// We don't extract text from these
		} else if (message.type === 'system') {
			// System messages contain initialization info
			// We don't extract text from these
		}

		return textParts.join('\n');
	}
	
	/**
	 * Extract usage information from SDK messages
	 */
	extractUsageFromMessages(messages) {
		// Look for result message which contains actual usage data
		for (const message of messages) {
			if (message.type === 'result' && message.result) {
				const result = message.result;
				return {
					promptTokens: result.input_tokens || 0,
					completionTokens: result.output_tokens || 0,
					totalTokens: (result.input_tokens || 0) + (result.output_tokens || 0),
					costUSD: message.total_cost_usd || 0
				};
			}
		}
		
		// Fallback to estimation if no result message
		return null;
	}

	/**
	 * Generate text using Claude Code SDK
	 */
	async generateText(params) {
		await this.checkAuthentication();

		const {
			messages,
			temperature,
			model = 'claude-opus-4-20250514', // Default to Claude Opus 4
			maxTokens,
			systemPrompt: additionalSystemPrompt,
			abortSignal // Support for AbortController
		} = params;
		const { query } = await this.loadSDK();

		const { prompt, systemPrompt } = this.convertMessagesToPrompt(messages);
		const finalSystemPrompt = additionalSystemPrompt
			? `${systemPrompt || ''}\n\n${additionalSystemPrompt}`.trim()
			: systemPrompt;

		const results = [];
		const allMessages = [];

		try {
			// Create AbortController if signal provided
			const abortController = abortSignal ? { signal: abortSignal } : undefined;
			
			for await (const message of query({
				prompt,
				abortController,
				options: {
					maxTurns: 1, // Single turn for text generation
					model, // Use the specified model
					systemPrompt:
						finalSystemPrompt ||
						'You are a helpful AI assistant for Task Master, a task management system for software projects.',
					cwd: process.cwd(),
					allowedTools: [], // No tools for pure text generation
					permissionMode: 'default'
					// Note: temperature and maxTokens not directly supported by SDK
				}
			})) {
				allMessages.push(message);
				const text = this.extractTextFromMessage(message);
				if (text) {
					results.push(text);
				}
			}

			const fullText = results.join('\n');
			
			// Try to get actual usage from SDK, fallback to estimation
			const usage = this.extractUsageFromMessages(allMessages) || {
				promptTokens: Math.floor(prompt.split(/\s+/).length * 1.3),
				completionTokens: Math.floor(fullText.split(/\s+/).length * 1.3),
				totalTokens: Math.floor(
					(prompt.split(/\s+/).length + fullText.split(/\s+/).length) * 1.3
				)
			};

			return {
				text: fullText,
				usage
			};
		} catch (error) {
			throw this.handleError(error);
		}
	}

	/**
	 * Generate structured object using Claude Code SDK
	 */
	async generateObject(params) {
		await this.checkAuthentication();

		const {
			messages,
			schema,
			temperature,
			model = 'claude-opus-4-20250514',
			systemPrompt: additionalSystemPrompt,
			abortSignal
		} = params;
		const { query } = await this.loadSDK();

		const { prompt, systemPrompt } = this.convertMessagesToPrompt(messages);

		// Enhance prompt to request JSON output
		const enhancedPrompt = `${prompt}\n\nIMPORTANT: Respond ONLY with a valid JSON object that matches this schema:\n${JSON.stringify(schema, null, 2)}\n\nDo not include any explanatory text, markdown formatting, or code blocks. Just the raw JSON.`;

		const jsonSystemPrompt = `${systemPrompt || 'You are a helpful AI assistant.'}\n\nYou must always respond with valid JSON that matches the provided schema. No additional text or formatting.`;
		const finalSystemPrompt = additionalSystemPrompt
			? `${jsonSystemPrompt}\n\n${additionalSystemPrompt}`.trim()
			: jsonSystemPrompt;

		const results = [];
		const allMessages = [];

		try {
			// Create AbortController if signal provided
			const abortController = abortSignal ? { signal: abortSignal } : undefined;

			for await (const message of query({
				prompt: enhancedPrompt,
				abortController,
				options: {
					maxTurns: 1,
					model,
					systemPrompt: finalSystemPrompt,
					cwd: process.cwd(),
					allowedTools: [], // No tools for JSON generation
					permissionMode: 'default'
				}
			})) {
				allMessages.push(message);
				const text = this.extractTextFromMessage(message);
				if (text) {
					results.push(text);
				}
			}

			const jsonText = results.join('\n').trim();

			// Clean up common JSON formatting issues
			let cleanedJson = jsonText;
			// Remove markdown code blocks if present
			cleanedJson = cleanedJson
				.replace(/^```json\s*/i, '')
				.replace(/\s*```$/, '');
			cleanedJson = cleanedJson.replace(/^```\s*/i, '').replace(/\s*```$/, '');

			const parsed = JSON.parse(cleanedJson);
			
			// Try to get actual usage from SDK, fallback to estimation
			const usage = this.extractUsageFromMessages(allMessages) || {
				promptTokens: Math.floor(enhancedPrompt.split(/\s+/).length * 1.3),
				completionTokens: Math.floor(jsonText.split(/\s+/).length * 1.3),
				totalTokens: Math.floor(
					(enhancedPrompt.split(/\s+/).length + jsonText.split(/\s+/).length) * 1.3
				)
			};

			return {
				object: parsed,
				usage
			};
		} catch (error) {
			if (error instanceof SyntaxError) {
				throw new Error(
					`Failed to parse JSON response: ${error.message}\nResponse: ${results.join('\n')}`
				);
			}
			throw this.handleError(error);
		}
	}

	/**
	 * Stream text using Claude Code SDK
	 */
	async streamText(params) {
		await this.checkAuthentication();

		const {
			messages,
			onChunk,
			temperature,
			model = 'claude-opus-4-20250514',
			systemPrompt: additionalSystemPrompt,
			abortSignal
		} = params;
		const { query } = await this.loadSDK();

		const { prompt, systemPrompt } = this.convertMessagesToPrompt(messages);
		const finalSystemPrompt = additionalSystemPrompt
			? `${systemPrompt || ''}\n\n${additionalSystemPrompt}`.trim()
			: systemPrompt;

		const chunks = [];
		const allMessages = [];

		try {
			// Create AbortController if signal provided
			const abortController = abortSignal ? { signal: abortSignal } : undefined;
			
			for await (const message of query({
				prompt,
				abortController,
				options: {
					maxTurns: 1,
					model,
					systemPrompt:
						finalSystemPrompt ||
						'You are a helpful AI assistant for Task Master.',
					cwd: process.cwd(),
					allowedTools: [],
					permissionMode: 'default'
				}
			})) {
				allMessages.push(message);
				const text = this.extractTextFromMessage(message);
				if (text) {
					chunks.push(text);
					if (onChunk) {
						onChunk(text);
					}
				}
			}

			const fullText = chunks.join('');
			
			// Try to get actual usage from SDK, fallback to estimation
			const usage = this.extractUsageFromMessages(allMessages) || {
				promptTokens: Math.floor(prompt.split(/\s+/).length * 1.3),
				completionTokens: Math.floor(fullText.split(/\s+/).length * 1.3),
				totalTokens: Math.floor(
					(prompt.split(/\s+/).length + fullText.split(/\s+/).length) * 1.3
				)
			};

			return {
				text: fullText,
				usage
			};
		} catch (error) {
			throw this.handleError(error);
		}
	}

	/**
	 * Enhanced error handling for Claude Code specific errors
	 */
	handleError(error) {
		const errorMessage = error.message || error.toString();

		// Authentication errors - SDK uses transparent auth but may fail if not set up
		if (
			errorMessage.includes('credentials') ||
			errorMessage.includes('unauthorized') ||
			errorMessage.includes('authentication')
		) {
			return new Error(
				'Claude Code authentication failed. The SDK uses the same authentication as Claude desktop app. ' +
				'Please ensure Claude desktop app is installed and authenticated.'
			);
		}

		// SDK not installed
		if (errorMessage.includes('Cannot find module') || errorMessage.includes('MODULE_NOT_FOUND')) {
			return new Error(
				'Claude Code SDK not found. Please install it with:\n' +
				'npm install @anthropic-ai/claude-code\n\n' +
				'Note: This SDK is published by Anthropic and requires Node.js 18+'
			);
		}

		// Claude CLI/Desktop not installed
		if (
			errorMessage.includes('claude: command not found') ||
			errorMessage.includes('Claude desktop app')
		) {
			return new Error(
				'Claude desktop app not found. The SDK requires Claude desktop app for authentication. ' +
				'Please install it from: https://claude.ai/download'
			);
		}
		
		// Aborted requests
		if (errorMessage.includes('aborted') || errorMessage.includes('AbortError')) {
			return new Error('Request was aborted');
		}

		// Generic SDK errors
		if (errorMessage.includes('Claude Code')) {
			return error;
		}

		// Wrap other errors
		return new Error(`Claude Code Provider Error: ${errorMessage}`);
	}

	/**
	 * Get provider capabilities
	 */
	getCapabilities() {
		return {
			streaming: true,
			tools: true,
			functionCalling: false, // Not directly, but could be implemented via tools
			vision: true, // Claude Code supports images
			maxContextTokens: 200000, // Claude's context window
			costPerMillionTokens: {
				input: 0, // Free with Claude desktop app
				output: 0
			},
			supportedModels: [
				'claude-opus-4-20250514', // Claude Opus 4
				'claude-3-opus-20240229',
				'claude-3-sonnet-20240229',
				'claude-3-haiku-20240307'
			],
			defaultModel: 'claude-opus-4-20250514'
		};
	}
	
	/**
	 * Generate text with tool support
	 */
	async generateTextWithTools(params) {
		await this.checkAuthentication();

		const {
			messages,
			tools = [],
			model = 'claude-opus-4-20250514',
			systemPrompt: additionalSystemPrompt,
			abortSignal
		} = params;
		const { query } = await this.loadSDK();

		const { prompt, systemPrompt } = this.convertMessagesToPrompt(messages);
		const finalSystemPrompt = additionalSystemPrompt
			? `${systemPrompt || ''}\n\n${additionalSystemPrompt}`.trim()
			: systemPrompt;

		const results = [];
		const allMessages = [];
		const toolCalls = [];

		try {
			// Create AbortController if signal provided
			const abortController = abortSignal ? { signal: abortSignal } : undefined;
			
			// Convert tools to Claude Code format if needed
			const allowedTools = tools.map(tool => tool.name || tool.function?.name).filter(Boolean);
			
			for await (const message of query({
				prompt,
				abortController,
				options: {
					maxTurns: 1,
					model,
					systemPrompt: finalSystemPrompt || 'You are a helpful AI assistant.',
					cwd: process.cwd(),
					allowedTools,
					permissionMode: 'default'
				}
			})) {
				allMessages.push(message);
				
				// Extract text content
				const text = this.extractTextFromMessage(message);
				if (text) {
					results.push(text);
				}
				
				// Check for tool calls in the message
				if (message.type === 'assistant' && message.message?.tool_calls) {
					toolCalls.push(...message.message.tool_calls);
				}
			}

			const fullText = results.join('\n');
			
			// Try to get actual usage from SDK
			const usage = this.extractUsageFromMessages(allMessages) || {
				promptTokens: Math.floor(prompt.split(/\s+/).length * 1.3),
				completionTokens: Math.floor(fullText.split(/\s+/).length * 1.3),
				totalTokens: Math.floor(
					(prompt.split(/\s+/).length + fullText.split(/\s+/).length) * 1.3
				)
			};

			return {
				text: fullText,
				toolCalls,
				usage
			};
		} catch (error) {
			throw this.handleError(error);
		}
	}
}

// Export for use in the provider registry
export default ClaudeCodeProvider;
