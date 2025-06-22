import { generateObject, generateText, streamText } from 'ai';
import {
	generateObject as aiGenerateObject,
	generateText as aiGenerateText,
	streamText as aiStreamText
} from 'ai';
import { log } from '../../scripts/init.js';
import { createTrace, isEnabled } from '../observability/langfuse-tracer.js';
import {
	captureZodSchema,
	safeSerializeObject
} from '../observability/schema-capture.js';
import { StreamTraceWrapper } from '../observability/stream-trace-wrapper.js';
import { calculateAiCost } from '../utils/cost-calculator.js';
import {
	checkCostThresholds,
	shouldSkipCostTracking
} from '../utils/cost-monitor.js';

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
			const result = await aiGenerateObject({
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
	 * Instrumented version of generateObject with Langfuse tracing and schema capture
	 * @private
	 * @param {object} params - Parameters for object generation
	 * @returns {Promise<object>} Generated object result with usage metrics
	 */
	async _instrumentedGenerateObject(params) {
		// Double-check that instrumentation is still enabled (defensive programming)
		if (!this._instrumentationEnabled || !isEnabled()) {
			// Fall back to original method if instrumentation was disabled
			return await this._originalGenerateObject(params);
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
					maxTokens: params.maxTokens,
					objectName: params.objectName
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

				// Capture comprehensive schema information safely
				try {
					if (params.schema) {
						const schemaCapture = captureZodSchema(params.schema, {
							name: params.objectName || 'anonymous',
							cache: true
						});
						traceMetadata.schema = schemaCapture;
					}
				} catch (schemaError) {
					log(
						'debug',
						`${this.name} Schema capture failed: ${schemaError.message}`
					);
					// Continue without schema metadata
				}

				trace = await createTrace({
					name: `${this.name} generateObject`,
					metadata: traceMetadata,
					tags: ['ai-generation', 'generateObject', this.name.toLowerCase()]
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
						maxTokens: params.maxTokens,
						objectName: params.objectName
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
						name: `${this.name}-${params.modelId}-object`,
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

			// Call original generateObject method (this is the critical operation)
			result = await this._originalGenerateObject(params);

			// Record successful generation if trace exists (never throw on failure)
			if (generation && result) {
				try {
					const endTime = performance.now();
					const latencyMs = endTime - startTime;

					// Calculate cost for this generation
					let costData = null;
					try {
						costData = calculateAiCost(
							this.name.toLowerCase(),
							params.modelId,
							result.usage?.inputTokens || 0,
							result.usage?.outputTokens || 0
						);
					} catch (costError) {
						log(
							'debug',
							`${this.name} Cost calculation failed: ${costError.message}`
						);
					}

					// Check cost thresholds and log alerts if needed
					if (costData && !shouldSkipCostTracking()) {
						try {
							const taskId = params.taskMasterContext?.taskId;
							const projectRoot = params.taskMasterContext?.projectRoot;
							checkCostThresholds(
								costData,
								taskId,
								this.name.toLowerCase(),
								projectRoot
							);
						} catch (thresholdError) {
							log(
								'debug',
								`${this.name} Cost threshold check failed: ${thresholdError.message}`
							);
						}
					}

					// Calculate object size metrics and serialize safely
					let objectMetrics = null;
					try {
						objectMetrics = this._calculateObjectMetrics(result.object);
					} catch (metricsError) {
						log(
							'debug',
							`${this.name} Object metrics calculation failed: ${metricsError.message}`
						);
					}

					// Prepare generation end data with cost and object information
					const generationEndData = {
						output: JSON.stringify(result.object),
						usage: {
							input: result.usage?.inputTokens || 0,
							output: result.usage?.outputTokens || 0,
							total: result.usage?.totalTokens || 0
						},
						metadata: {
							latencyMs: Math.round(latencyMs * 100) / 100,
							completedAt: new Date().toISOString(),
							objectName: params.objectName,
							generationSuccess: true
						}
					};

					// Add cost metadata if calculation was successful
					if (costData && costData.totalCost !== undefined) {
						generationEndData.metadata.cost = {
							totalCost: costData.totalCost,
							inputCost: costData.inputCost,
							outputCost: costData.outputCost,
							currency: costData.currency,
							breakdown: costData.metadata
						};
					}

					// Add object metrics if calculation was successful
					if (objectMetrics) {
						generationEndData.metadata.objectMetrics = objectMetrics;
					}

					generation.end(generationEndData);
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
							failedAt: new Date().toISOString(),
							objectName: params.objectName,
							generationSuccess: false
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
					`${this.name} generateObject trace recorded - ` +
						`latency: ${Math.round(latencyMs)}ms, ` +
						`success: ${!error}, ` +
						`model: ${params.modelId}, ` +
						`object: ${params.objectName}`
				);
			}
		}
	}

	/**
	 * Calculates comprehensive metrics for generated objects
	 * @private
	 * @param {any} obj - Generated object to analyze
	 * @returns {object} Object metrics including size, depth, and complexity
	 */
	_calculateObjectMetrics(obj) {
		try {
			// Use safe serialization to handle circular references and calculate size
			const serialization = safeSerializeObject(obj, {
				maxDepth: 20, // Allow deeper analysis for metrics
				maskFields: [] // Don't mask for metrics calculation
			});

			if (!serialization.success) {
				return {
					error: serialization.error,
					fallback: true,
					sizeBytes: 0,
					depth: 0,
					fieldCount: 0,
					timestamp: new Date().toISOString()
				};
			}

			// Calculate additional metrics
			const metrics = {
				sizeBytes: serialization.sizeBytes,
				depth: serialization.depth,
				isCircular: this._detectCircularReferences(obj),
				timestamp: new Date().toISOString()
			};

			// Add type-specific metrics
			if (Array.isArray(obj)) {
				metrics.type = 'array';
				metrics.length = obj.length;
			} else if (obj !== null && typeof obj === 'object') {
				metrics.type = 'object';
				metrics.fieldCount = Object.keys(obj).length;

				// Calculate field type distribution
				const fieldTypes = {};
				for (const [key, value] of Object.entries(obj)) {
					const type = Array.isArray(value) ? 'array' : typeof value;
					fieldTypes[type] = (fieldTypes[type] || 0) + 1;
				}
				metrics.fieldTypes = fieldTypes;
			} else {
				metrics.type = typeof obj;
			}

			// Calculate complexity score based on structure
			metrics.complexityScore = this._calculateObjectComplexity(obj);

			return metrics;
		} catch (error) {
			return {
				error: error.message,
				fallback: true,
				sizeBytes: 0,
				depth: 0,
				fieldCount: 0,
				timestamp: new Date().toISOString()
			};
		}
	}

	/**
	 * Detects circular references in an object
	 * @private
	 * @param {any} obj - Object to check
	 * @returns {boolean} True if circular references are detected
	 */
	_detectCircularReferences(obj) {
		const visited = new WeakSet();

		function check(value) {
			if (value === null || typeof value !== 'object') {
				return false;
			}

			if (visited.has(value)) {
				return true;
			}

			visited.add(value);

			try {
				if (Array.isArray(value)) {
					return value.some((item) => check(item));
				} else {
					return Object.values(value).some((val) => check(val));
				}
			} finally {
				visited.delete(value);
			}
		}

		return check(obj);
	}

	/**
	 * Calculates complexity score for an object based on its structure
	 * @private
	 * @param {any} obj - Object to analyze
	 * @param {number} depth - Current depth (for recursion tracking)
	 * @returns {number} Complexity score (1-10)
	 */
	_calculateObjectComplexity(obj, depth = 0) {
		if (depth > 10) return 10; // Prevent infinite recursion

		if (obj === null || typeof obj !== 'object') {
			return 1; // Primitive values have minimal complexity
		}

		let complexity = 1;

		if (Array.isArray(obj)) {
			complexity += Math.min(obj.length * 0.1, 2); // Array length adds complexity

			// Add complexity for nested elements
			for (const item of obj.slice(0, 10)) {
				// Limit analysis to first 10 items
				complexity += this._calculateObjectComplexity(item, depth + 1) * 0.3;
			}
		} else {
			const keys = Object.keys(obj);
			complexity += Math.min(keys.length * 0.1, 2); // Field count adds complexity

			// Add complexity for nested objects
			for (const key of keys.slice(0, 20)) {
				// Limit analysis to first 20 fields
				complexity +=
					this._calculateObjectComplexity(obj[key], depth + 1) * 0.5;
			}
		}

		// Add penalty for deep nesting
		if (depth > 3) {
			complexity += (depth - 3) * 0.5;
		}

		return Math.min(Math.round(complexity * 10) / 10, 10); // Round and cap at 10
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

					// Calculate cost for this generation
					let costData = null;
					try {
						costData = calculateAiCost(
							this.name.toLowerCase(),
							params.modelId,
							result.usage?.inputTokens || 0,
							result.usage?.outputTokens || 0
						);
					} catch (costError) {
						log(
							'debug',
							`${this.name} Cost calculation failed: ${costError.message}`
						);
					}

					// Check cost thresholds and log alerts if needed
					if (costData && !shouldSkipCostTracking()) {
						try {
							const taskId = params.taskMasterContext?.taskId;
							const projectRoot = params.taskMasterContext?.projectRoot;
							checkCostThresholds(
								costData,
								taskId,
								this.name.toLowerCase(),
								projectRoot
							);
						} catch (thresholdError) {
							log(
								'debug',
								`${this.name} Cost threshold check failed: ${thresholdError.message}`
							);
						}
					}

					// Prepare generation end data with cost information
					const generationEndData = {
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
					};

					// Add cost metadata if calculation was successful
					if (costData && costData.totalCost !== undefined) {
						generationEndData.metadata.cost = {
							totalCost: costData.totalCost,
							inputCost: costData.inputCost,
							outputCost: costData.outputCost,
							currency: costData.currency,
							breakdown: costData.metadata
						};
					}

					generation.end(generationEndData);
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
	 * Instrumented version of streamText with Langfuse tracing
	 * @private
	 * @param {object} params - Parameters for streaming text generation
	 * @returns {Promise<StreamTraceWrapper>} Instrumented stream with tracing capabilities
	 */
	async _instrumentedStreamText(params) {
		// Double-check that instrumentation is still enabled (defensive programming)
		if (!this._instrumentationEnabled || !isEnabled()) {
			// Fall back to original method if instrumentation was disabled
			return await this._originalStreamText(params);
		}

		let trace = null;
		let originalStream = null;

		try {
			// Create Langfuse trace for this streaming session (never throw on failure)
			try {
				trace = await createTrace({
					name: `${this.name} streamText`,
					metadata: {
						provider: this.name,
						model: params.modelId,
						temperature: params.temperature,
						maxTokens: params.maxTokens,
						streaming: true
					},
					tags: ['ai-generation', 'streamText', this.name.toLowerCase()]
				});
			} catch (traceError) {
				// Log but never propagate Langfuse trace creation errors
				log(
					'debug',
					`${this.name} Langfuse streaming trace creation failed: ${traceError.message}`
				);
				trace = null;
			}

			// Call original streamText method (this is the critical operation)
			originalStream = await this._originalStreamText(params);

			// Return instrumented stream wrapper if trace was created successfully
			if (trace) {
				try {
					log(
						'debug',
						`${this.name} streamText trace created - returning instrumented stream`
					);
					return new StreamTraceWrapper(
						originalStream,
						trace,
						this.name,
						params
					);
				} catch (wrapperError) {
					// If wrapper creation fails, log error and return original stream
					log(
						'debug',
						`${this.name} StreamTraceWrapper creation failed: ${wrapperError.message}`
					);
					return originalStream;
				}
			}

			// Return original stream if tracing setup failed
			return originalStream;
		} catch (streamError) {
			// Record error in trace if available (never throw on failure)
			if (trace) {
				try {
					trace.update({
						level: 'ERROR',
						statusMessage: streamError.message,
						metadata: {
							error: streamError.message,
							failedAt: new Date().toISOString()
						}
					});
				} catch (traceUpdateError) {
					// Log but never propagate Langfuse trace update errors
					log(
						'debug',
						`${this.name} Langfuse error trace update failed: ${traceUpdateError.message}`
					);
				}
			}

			// Re-throw the original error to preserve exact error handling behavior
			throw streamError;
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
			`${this.name} Langfuse instrumentation enabled - wrapping generateText, streamText, and generateObject methods`
		);

		// Store reference to original generateText method
		this._originalGenerateText = this.generateText.bind(this);

		// Replace generateText with instrumented version
		this.generateText = this._instrumentedGenerateText.bind(this);

		// Store reference to original streamText method and replace with instrumented version
		if (this.streamText) {
			this._originalStreamText = this.streamText.bind(this);
			this.streamText = this._instrumentedStreamText.bind(this);
		}

		// Store reference to original generateObject method and replace with instrumented version
		if (this.generateObject) {
			this._originalGenerateObject = this.generateObject.bind(this);
			this.generateObject = this._instrumentedGenerateObject.bind(this);
		}

		// Set flag to indicate instrumentation is active
		this._instrumentationEnabled = true;

		log(
			'debug',
			`${this.name} generateText, streamText, and generateObject methods successfully wrapped with Langfuse instrumentation`
		);
	}
}
