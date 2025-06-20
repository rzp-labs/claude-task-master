import { generateObject, generateText, streamText } from 'ai';
import { log } from '../../scripts/init.js';
import { createTrace, isEnabled } from '../observability/langfuse-tracer.js';

/**
 * Base class for all AI providers
 */
export class BaseAIProvider {
	constructor() {
		if (this.constructor === BaseAIProvider) {
			throw new Error('BaseAIProvider cannot be instantiated directly');
		}

		// Each provider must set their name
		this.name = this.constructor.name;

		// Initialize instrumentation if Langfuse is enabled
		this._initializeInstrumentation();
	}

	/**
	 * Validates authentication parameters - can be overridden by providers
	 * @param {object} params - Parameters to validate
	 */
	validateAuth(params) {
		// Default: require API key (most providers need this)
		if (!params.apiKey) {
			throw new Error(`${this.name} API key is required`);
		}
	}

	/**
	 * Validates common parameters across all methods
	 * @param {object} params - Parameters to validate
	 */
	validateParams(params) {
		// Validate authentication (can be overridden by providers)
		this.validateAuth(params);

		// Validate required model ID
		if (!params.modelId) {
			throw new Error(`${this.name} Model ID is required`);
		}

		// Validate optional parameters
		this.validateOptionalParams(params);
	}

	/**
	 * Validates optional parameters like temperature and maxTokens
	 * @param {object} params - Parameters to validate
	 */
	validateOptionalParams(params) {
		if (
			params.temperature !== undefined &&
			(params.temperature < 0 || params.temperature > 1)
		) {
			throw new Error('Temperature must be between 0 and 1');
		}
		if (params.maxTokens !== undefined && params.maxTokens <= 0) {
			throw new Error('maxTokens must be greater than 0');
		}
	}

	/**
	 * Validates message array structure
	 */
	validateMessages(messages) {
		if (!messages || !Array.isArray(messages) || messages.length === 0) {
			throw new Error('Invalid or empty messages array provided');
		}

		for (const msg of messages) {
			if (!msg.role || !msg.content) {
				throw new Error(
					'Invalid message format. Each message must have role and content'
				);
			}
		}
	}

	/**
	 * Common error handler
	 */
	handleError(operation, error) {
		const errorMessage = error.message || 'Unknown error occurred';
		log('error', `${this.name} ${operation} failed: ${errorMessage}`, {
			error
		});
		throw new Error(
			`${this.name} API error during ${operation}: ${errorMessage}`
		);
	}

	/**
	 * Creates and returns a client instance for the provider
	 * @abstract
	 */
	getClient(params) {
		throw new Error('getClient must be implemented by provider');
	}

	/**
	 * Generates text using the provider's model
	 */
	async generateText(params) {
		try {
			this.validateParams(params);
			this.validateMessages(params.messages);

			log(
				'debug',
				`Generating ${this.name} text with model: ${params.modelId}`
			);

			const client = this.getClient(params);
			const result = await generateText({
				model: client(params.modelId),
				messages: params.messages,
				maxTokens: params.maxTokens,
				temperature: params.temperature
			});

			log(
				'debug',
				`${this.name} generateText completed successfully for model: ${params.modelId}`
			);

			return {
				text: result.text,
				usage: {
					inputTokens: result.usage?.promptTokens,
					outputTokens: result.usage?.completionTokens,
					totalTokens: result.usage?.totalTokens
				}
			};
		} catch (error) {
			this.handleError('text generation', error);
		}
	}

	/**
	 * Streams text using the provider's model
	 */
	async streamText(params) {
		try {
			this.validateParams(params);
			this.validateMessages(params.messages);

			log('debug', `Streaming ${this.name} text with model: ${params.modelId}`);

			const client = this.getClient(params);
			const stream = await streamText({
				model: client(params.modelId),
				messages: params.messages,
				maxTokens: params.maxTokens,
				temperature: params.temperature
			});

			log(
				'debug',
				`${this.name} streamText initiated successfully for model: ${params.modelId}`
			);

			return stream;
		} catch (error) {
			this.handleError('text streaming', error);
		}
	}

	/**
	 * Generates a structured object using the provider's model
	 */
	async generateObject(params) {
		try {
			this.validateParams(params);
			this.validateMessages(params.messages);

			if (!params.schema) {
				throw new Error('Schema is required for object generation');
			}
			if (!params.objectName) {
				throw new Error('Object name is required for object generation');
			}

			log(
				'debug',
				`Generating ${this.name} object ('${params.objectName}') with model: ${params.modelId}`
			);

			const client = this.getClient(params);
			const result = await generateObject({
				model: client(params.modelId),
				messages: params.messages,
				schema: params.schema,
				mode: 'auto',
				maxTokens: params.maxTokens,
				temperature: params.temperature
			});

			log(
				'debug',
				`${this.name} generateObject completed successfully for model: ${params.modelId}`
			);

			return {
				object: result.object,
				usage: {
					inputTokens: result.usage?.promptTokens,
					outputTokens: result.usage?.completionTokens,
					totalTokens: result.usage?.totalTokens
				}
			};
		} catch (error) {
			this.handleError('object generation', error);
		}
	}

	/**
	 * Instrumented version of generateText with Langfuse tracing
	 * @private
	 * @param {object} params - Parameters for text generation
	 * @returns {Promise<object>} Generated text result with usage metrics
	 */
	async _instrumentedGenerateText(params) {
		// Double-check that instrumentation is still enabled (defensive programming)
		if (!this._instrumentationEnabled || !isEnabled()) {
			// Fall back to original method if instrumentation was disabled
			return await this._originalGenerateText(params);
		}

		// Start timing
		const startTime = performance.now();
		let trace = null;
		let generation = null;
		let result = null;
		let error = null;

		try {
			// Create Langfuse trace for this generation (never throw on failure)
			try {
				// Prepare base metadata
				const traceMetadata = {
					provider: this.name,
					model: params.modelId,
					temperature: params.temperature,
					maxTokens: params.maxTokens
				};

				// Add Task Master context if available
				if (params.taskMasterContext) {
					traceMetadata.taskMaster = {
						taskId: params.taskMasterContext.taskId,
						tag: params.taskMasterContext.tag,
						command: params.taskMasterContext.command,
						role: params.taskMasterContext.role,
						projectRoot: params.taskMasterContext.projectRoot
					};
				}

				trace = await createTrace({
					name: `${this.name} generateText`,
					metadata: traceMetadata,
					tags: ['ai-generation', 'generateText', this.name.toLowerCase()]
				});
			} catch (traceError) {
				// Log but never propagate Langfuse trace creation errors
				log(
					'debug',
					`${this.name} Langfuse trace creation failed: ${traceError.message}`
				);
				trace = null;
			}

			// Create generation within the trace if trace was created successfully
			if (trace) {
				try {
					// Prepare generation metadata
					const generationMetadata = {
						provider: this.name,
						temperature: params.temperature,
						maxTokens: params.maxTokens
					};

					// Add Task Master context to generation metadata if available
					if (params.taskMasterContext) {
						generationMetadata.taskMaster = {
							taskId: params.taskMasterContext.taskId,
							tag: params.taskMasterContext.tag,
							command: params.taskMasterContext.command,
							role: params.taskMasterContext.role
						};
					}

					generation = trace.generation({
						name: `${this.name}-${params.modelId}`,
						model: params.modelId,
						input: params.messages,
						metadata: generationMetadata
					});
				} catch (generationError) {
					// Log but never propagate Langfuse generation creation errors
					log(
						'debug',
						`${this.name} Langfuse generation creation failed: ${generationError.message}`
					);
					generation = null;
				}
			}

			// Call original generateText method (this is the critical operation)
			result = await this._originalGenerateText(params);

			// Record successful generation if trace exists (never throw on failure)
			if (generation && result) {
				try {
					const endTime = performance.now();
					const latencyMs = endTime - startTime;

					generation.end({
						output: result.text,
						usage: {
							input: result.usage?.inputTokens || 0,
							output: result.usage?.outputTokens || 0,
							total: result.usage?.totalTokens || 0
						},
						metadata: {
							latencyMs: Math.round(latencyMs * 100) / 100,
							completedAt: new Date().toISOString()
						}
					});
				} catch (endError) {
					// Log but never propagate Langfuse generation end errors
					log(
						'debug',
						`${this.name} Langfuse generation end failed: ${endError.message}`
					);
				}
			}

			return result;
		} catch (err) {
			error = err;

			// Record error in generation if trace exists (never throw on failure)
			if (generation) {
				try {
					const endTime = performance.now();
					const latencyMs = endTime - startTime;

					generation.end({
						level: 'ERROR',
						statusMessage: err.message,
						metadata: {
							error: err.message,
							latencyMs: Math.round(latencyMs * 100) / 100,
							failedAt: new Date().toISOString()
						}
					});
				} catch (endError) {
					// Log but never propagate Langfuse generation end errors
					log(
						'debug',
						`${this.name} Langfuse error generation end failed: ${endError.message}`
					);
				}
			}

			// Re-throw the original error to preserve exact error handling behavior
			throw err;
		} finally {
			// Log tracing attempt for debugging (only if trace was attempted)
			if (trace) {
				const endTime = performance.now();
				const latencyMs = endTime - startTime;

				log(
					'debug',
					`${this.name} generateText trace recorded - ` +
						`latency: ${Math.round(latencyMs)}ms, ` +
						`success: ${!error}, ` +
						`model: ${params.modelId}`
				);
			}
		}
	}

	/**
	 * Initialize Langfuse instrumentation if enabled
	 * Feature flag integration: Uses isEnabled() check to conditionally activate instrumentation.
	 * When disabled, provides zero overhead by not wrapping the original method.
	 * @private
	 */
	_initializeInstrumentation() {
		// Check if Langfuse is enabled (feature flag check)
		if (!isEnabled()) {
			log(
				'debug',
				`${this.name} Langfuse instrumentation disabled - skipping initialization`
			);
			this._instrumentationEnabled = false;
			return; // Zero overhead when disabled - no method wrapping occurs
		}

		log(
			'debug',
			`${this.name} Langfuse instrumentation enabled - wrapping generateText method`
		);

		// Store reference to original generateText method
		this._originalGenerateText = this.generateText.bind(this);

		// Replace generateText with instrumented version
		this.generateText = this._instrumentedGenerateText.bind(this);

		// Set flag to indicate instrumentation is active
		this._instrumentationEnabled = true;

		log(
			'debug',
			`${this.name} generateText method successfully wrapped with Langfuse instrumentation`
		);
	}
}
