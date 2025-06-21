/**
 * src/observability/stream-trace-wrapper.js
 *
 * Streaming response tracing wrapper for Langfuse integration.
 * Provides progressive token counting and timing measurement for AI SDK streams.
 *
 * @module StreamTraceWrapper
 */

import { calculateAiCost } from '../utils/cost-calculator.js';
import {
	checkCostThresholds,
	shouldSkipCostTracking
} from '../utils/cost-monitor.js';
import { createStandardLogger } from '../utils/logger-utils.js';

// Logger instance for this module
const logger = createStandardLogger();

/**
 * Utility class for token counting with provider-specific estimation and verification
 */
export class TokenCounter {
	constructor(providerName) {
		this.providerName = providerName;
		this.estimationBuffer = '';
	}

	/**
	 * Estimate tokens for streaming text delta using word-based calculation
	 * Optimized for performance (<1ms per chunk)
	 * @param {string} textDelta - New text chunk to count
	 * @returns {number} Estimated token count for this chunk
	 */
	estimateTokens(textDelta) {
		if (!textDelta || typeof textDelta !== 'string') {
			return 0;
		}

		// Accumulate text for better estimation accuracy
		this.estimationBuffer += textDelta;

		// Use word-based estimation for real-time updates
		// More accurate than character counting, faster than full tokenization
		const words = textDelta.split(/\s+/).filter(Boolean);

		// Rough token-to-word ratio varies by provider
		// Conservative estimate: ~1.3 tokens per word for most providers
		return Math.ceil(words.length * 1.3);
	}

	/**
	 * Get accurate final token count using provider-specific tokenization
	 * Called once at stream completion for verification
	 * @param {string} finalText - Complete accumulated text
	 * @returns {Promise<number>} Accurate token count
	 */
	async getActualTokenCount(finalText) {
		if (!finalText || typeof finalText !== 'string') {
			return 0;
		}

		try {
			// Provider-specific tokenization where available
			switch (this.providerName?.toLowerCase()) {
				case 'openai':
					return await this.openAITokenCount(finalText);
				case 'anthropic':
					return await this.anthropicTokenCount(finalText);
				default:
					// Fallback to improved word counting
					return this.fallbackTokenCount(finalText);
			}
		} catch (error) {
			logger.debug(`Token counting failed for ${this.providerName}:`, error);
			return this.fallbackTokenCount(finalText);
		}
	}

	/**
	 * OpenAI-specific token counting (placeholder for future implementation)
	 * @private
	 */
	async openAITokenCount(text) {
		// TODO: Implement tiktoken integration if available
		return this.fallbackTokenCount(text);
	}

	/**
	 * Anthropic-specific token counting (placeholder for future implementation)
	 * @private
	 */
	async anthropicTokenCount(text) {
		// TODO: Implement Anthropic tokenization if available
		return this.fallbackTokenCount(text);
	}

	/**
	 * Fallback token counting using improved word-based estimation
	 * @private
	 */
	fallbackTokenCount(text) {
		const words = text.split(/\s+/).filter(Boolean);
		return Math.ceil(words.length * 1.3);
	}
}

/**
 * Streaming trace wrapper that instruments AI SDK streams with Langfuse tracing
 * Implements async iterator pattern to preserve original stream behavior
 */
export class StreamTraceWrapper {
	constructor(originalStream, trace, providerName, inputParams) {
		this.originalStream = originalStream;
		this.trace = trace;
		this.providerName = providerName;
		this.inputParams = inputParams;

		// Timing tracking
		this.startTime = performance.now();
		this.firstTokenTime = null;

		// Token and text accumulation
		this.tokenCounter = new TokenCounter(providerName);
		this.estimatedTokens = 0;
		this.textAccumulator = '';
		this.chunkCount = 0;

		// Span for progressive updates
		this.span = null;
		this.completed = false;

		// Performance optimization - batched updates
		this.lastUpdate = 0;
		this.UPDATE_INTERVAL = 1000; // Update every 1 second max
		this.MAX_TEXT_LENGTH = 50000; // Limit memory usage for long streams

		// Initialize span
		this.initializeSpan();
	}

	/**
	 * Initialize Langfuse span for streaming session
	 * @private
	 */
	async initializeSpan() {
		try {
			if (this.trace) {
				this.span = this.trace.span({
					name: `${this.providerName} streamText`,
					input: this.inputParams?.messages || this.inputParams,
					metadata: {
						provider: this.providerName,
						model: this.inputParams?.modelId,
						streaming: true,
						temperature: this.inputParams?.temperature,
						maxTokens: this.inputParams?.maxTokens
					}
				});

				logger.debug(`Streaming span created for ${this.providerName}`);
			}
		} catch (error) {
			logger.debug('Span initialization failed:', error);
			// Continue without span - never break streaming for tracing errors
		}
	}

	/**
	 * Process a streaming chunk for tracing
	 * @private
	 */
	processChunk(chunk) {
		try {
			this.chunkCount++;

			// Track first token time (TTFT)
			if (this.firstTokenTime === null && chunk.textDelta) {
				this.firstTokenTime = performance.now();
				this.safeSpanUpdate({
					ttft: this.firstTokenTime - this.startTime,
					status: 'streaming'
				});
			}

			// Accumulate text and count tokens
			if (chunk.textDelta) {
				this.textAccumulator += chunk.textDelta;
				this.estimatedTokens += this.tokenCounter.estimateTokens(
					chunk.textDelta
				);

				// Memory management for long streams
				if (this.textAccumulator.length > this.MAX_TEXT_LENGTH) {
					// Keep only last portion for final token count
					this.textAccumulator = this.textAccumulator.slice(
						-this.MAX_TEXT_LENGTH / 2
					);
				}
			}

			// Batched span updates for performance
			const now = Date.now();
			if (now - this.lastUpdate > this.UPDATE_INTERVAL) {
				this.queueSpanUpdate();
				this.lastUpdate = now;
			}
		} catch (error) {
			logger.debug('Chunk processing failed:', error);
			// Never break streaming for tracing errors
		}
	}

	/**
	 * Queue async span update (non-blocking)
	 * @private
	 */
	queueSpanUpdate() {
		if (this.span) {
			setImmediate(() => {
				this.safeSpanUpdate({
					estimatedTokens: this.estimatedTokens,
					chunkCount: this.chunkCount,
					duration: performance.now() - this.startTime
				});
			});
		}
	}

	/**
	 * Safe span update that never throws
	 * @private
	 */
	safeSpanUpdate(metadata) {
		try {
			if (this.span) {
				this.span.update(metadata);
			}
		} catch (error) {
			logger.debug('Span update failed:', error);
			// Never break streaming for tracing errors
		}
	}

	/**
	 * Complete the trace with final metrics
	 * @private
	 */
	async completeTrace() {
		if (this.completed || !this.span) return;

		try {
			const endTime = performance.now();
			const totalDuration = endTime - this.startTime;
			const ttft = this.firstTokenTime
				? this.firstTokenTime - this.startTime
				: null;

			// Get accurate final token count
			const finalTokenCount = await this.tokenCounter.getActualTokenCount(
				this.textAccumulator
			);

			// Calculate cost for this streaming generation
			let costData = null;
			try {
				costData = calculateAiCost(
					this.providerName?.toLowerCase(),
					this.inputParams?.modelId,
					0, // Input tokens not available in streaming context
					finalTokenCount
				);
			} catch (costError) {
				logger.debug(
					`Cost calculation failed for ${this.providerName}: ${costError.message}`
				);
			}

			// Check cost thresholds and log alerts if needed
			if (costData && !shouldSkipCostTracking()) {
				try {
					const taskId = this.inputParams?.taskMasterContext?.taskId;
					const projectRoot = this.inputParams?.taskMasterContext?.projectRoot;
					checkCostThresholds(
						costData,
						taskId,
						this.providerName?.toLowerCase(),
						projectRoot
					);
				} catch (thresholdError) {
					logger.debug(
						`Cost threshold check failed for ${this.providerName}: ${thresholdError.message}`
					);
				}
			}

			// Prepare span end data with cost information
			const spanEndData = {
				output: this.textAccumulator,
				usage: {
					completionTokens: finalTokenCount,
					totalTokens: finalTokenCount // Input tokens would need to be calculated separately
				},
				metadata: {
					ttft: ttft,
					totalDuration: totalDuration,
					chunkCount: this.chunkCount,
					estimatedTokens: this.estimatedTokens,
					actualTokens: finalTokenCount,
					estimationAccuracy:
						this.estimatedTokens > 0
							? finalTokenCount / this.estimatedTokens
							: 1
				}
			};

			// Add cost metadata if calculation was successful
			if (costData && costData.totalCost !== undefined) {
				spanEndData.metadata.cost = {
					totalCost: costData.totalCost,
					inputCost: costData.inputCost,
					outputCost: costData.outputCost,
					currency: costData.currency,
					breakdown: costData.metadata,
					note: 'Input token costs not included in streaming calculation'
				};
			}

			// Complete the span with final metrics
			await this.span.end(spanEndData);

			this.completed = true;
			logger.debug(
				`Streaming trace completed: ${this.chunkCount} chunks, ${finalTokenCount} tokens, ${ttft}ms TTFT`
			);
		} catch (error) {
			logger.debug('Trace completion failed:', error);
			// Log but don't throw - tracing errors should never affect streaming
		}
	}

	/**
	 * Record error in span if available
	 * @private
	 */
	safeRecordError(error) {
		try {
			if (this.span) {
				this.span.update({
					error: error.message,
					errorType: error.constructor.name,
					status: 'error'
				});
			}
		} catch (tracingError) {
			logger.debug('Error recording failed:', tracingError);
		}
	}

	/**
	 * Async iterator implementation that preserves original stream behavior
	 * This is the core method that wraps the stream with tracing
	 */
	async *[Symbol.asyncIterator]() {
		try {
			// Iterate through original stream
			for await (const chunk of this.originalStream) {
				try {
					// Process chunk for tracing (never throw)
					this.processChunk(chunk);
				} catch (tracingError) {
					logger.debug('Chunk processing failed:', tracingError);
					// Continue streaming even if tracing fails
				}

				// Always yield chunk unchanged
				yield chunk;
			}

			// Complete tracing when stream ends normally
			await this.completeTrace();
		} catch (streamError) {
			// Record error in span if available
			this.safeRecordError(streamError);

			// Re-throw original error unchanged
			throw streamError;
		}
	}
}
