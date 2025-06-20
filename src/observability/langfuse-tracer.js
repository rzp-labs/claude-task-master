/**
 * src/observability/langfuse-tracer.js
 *
 * Langfuse tracer module implementing singleton pattern for client management.
 * Provides lazy initialization with environment detection and error handling.
 *
 * @module LangfuseTracer
 * @description Complete Langfuse integration module for Task Master AI
 *
 * Exported Functions:
 * - isEnabled(): Check if Langfuse is configured
 * - getClient(): Get singleton Langfuse client instance
 * - createTrace(options): Create new trace
 * - createSpan(trace, options): Create span within trace
 * - logEvent(trace, options): Log event to trace
 * - updateTraceMetadata(trace, metadata): Update trace metadata
 * - flush(): Flush pending traces
 * - shutdown(): Shutdown client and cleanup
 *
 * Environment Variables:
 * - LANGFUSE_SECRET_KEY: Required secret key
 * - LANGFUSE_PUBLIC_KEY: Required public key
 * - LANGFUSE_HOST: Optional host URL (defaults to cloud.langfuse.com)
 * - LANGFUSE_DEBUG: Optional debug flag
 */

import { createStandardLogger } from '../utils/logger-utils.js';

// Logger instance for this module
const logger = createStandardLogger();

// Singleton instance
let langfuseClient = null;
let initializationAttempted = false;
let initializationError = null;

/**
 * Check if Langfuse is enabled by validating required environment variables
 * @returns {boolean} True if Langfuse is properly configured, false otherwise
 */
export function isEnabled() {
	const secretKey = process.env.LANGFUSE_SECRET_KEY;
	const publicKey = process.env.LANGFUSE_PUBLIC_KEY;

	return !!(secretKey && publicKey);
}

/**
 * Get or create Langfuse client instance with lazy initialization
 * @returns {Promise<Object|null>} Promise resolving to Langfuse client instance or null if not available
 */
export async function getClient() {
	// Return null immediately if not enabled
	if (!isEnabled()) {
		if (!initializationAttempted) {
			logger.debug(
				'Langfuse disabled - required environment variables not found'
			);
			initializationAttempted = true;
		}
		return null;
	}

	// Return existing client if available
	if (langfuseClient) {
		return langfuseClient;
	}

	// Return null if previous initialization failed
	if (initializationAttempted && initializationError) {
		return null;
	}

	// Attempt lazy initialization
	return await initializeLangfuseClient();
}

/**
 * Create a new trace using the Langfuse client
 * @param {Object} traceOptions - Options for trace creation
 * @param {string} traceOptions.name - Name of the trace
 * @param {Object} [traceOptions.metadata] - Optional metadata for the trace
 * @param {string[]} [traceOptions.tags] - Optional tags for the trace
 * @param {string} [traceOptions.userId] - Optional user ID for the trace
 * @param {string} [traceOptions.sessionId] - Optional session ID for the trace
 * @returns {Promise<Object|null>} Promise resolving to trace instance or null if Langfuse not available
 */
export async function createTrace(traceOptions = {}) {
	const client = await getClient();

	if (!client) {
		logger.debug('Langfuse client not available - trace creation skipped');
		return null;
	}

	try {
		const trace = client.trace({
			name: traceOptions.name || 'unnamed-trace',
			metadata: traceOptions.metadata || {},
			tags: traceOptions.tags || [],
			userId: traceOptions.userId,
			sessionId: traceOptions.sessionId
		});

		logger.debug(
			`Langfuse trace created: ${traceOptions.name || 'unnamed-trace'}`
		);
		return trace;
	} catch (error) {
		logger.error('Failed to create Langfuse trace', error);
		return null;
	}
}

/**
 * Create a span within an existing trace
 * @param {Object} trace - The parent trace object
 * @param {Object} spanOptions - Options for span creation
 * @param {string} spanOptions.name - Name of the span
 * @param {Object} [spanOptions.input] - Optional input data for the span
 * @param {Object} [spanOptions.metadata] - Optional metadata for the span
 * @returns {Promise<Object|null>} Promise resolving to span instance or null if not available
 */
export async function createSpan(trace, spanOptions = {}) {
	if (!trace) {
		logger.debug('No trace provided - span creation skipped');
		return null;
	}

	try {
		const span = trace.span({
			name: spanOptions.name || 'unnamed-span',
			input: spanOptions.input,
			metadata: spanOptions.metadata || {}
		});

		logger.debug(
			`Langfuse span created: ${spanOptions.name || 'unnamed-span'}`
		);
		return span;
	} catch (error) {
		logger.error('Failed to create Langfuse span', error);
		return null;
	}
}

/**
 * Log an event to an existing trace
 * @param {Object} trace - The parent trace object
 * @param {Object} eventOptions - Options for event logging
 * @param {string} eventOptions.name - Name of the event
 * @param {Object} [eventOptions.input] - Optional input data for the event
 * @param {Object} [eventOptions.output] - Optional output data for the event
 * @param {Object} [eventOptions.metadata] - Optional metadata for the event
 * @param {string} [eventOptions.level] - Optional level (DEBUG, DEFAULT, WARNING, ERROR)
 * @returns {Promise<Object|null>} Promise resolving to event instance or null if not available
 */
export async function logEvent(trace, eventOptions = {}) {
	if (!trace) {
		logger.debug('No trace provided - event logging skipped');
		return null;
	}

	try {
		const event = trace.event({
			name: eventOptions.name || 'unnamed-event',
			input: eventOptions.input,
			output: eventOptions.output,
			metadata: eventOptions.metadata || {},
			level: eventOptions.level || 'DEFAULT'
		});

		logger.debug(
			`Langfuse event logged: ${eventOptions.name || 'unnamed-event'}`
		);
		return event;
	} catch (error) {
		logger.error('Failed to log Langfuse event', error);
		return null;
	}
}

/**
 * Update trace metadata
 * @param {Object} trace - The trace object to update
 * @param {Object} metadata - Metadata to add/update on the trace
 * @returns {Promise<void>}
 */
export async function updateTraceMetadata(trace, metadata = {}) {
	if (!trace) {
		logger.debug('No trace provided - metadata update skipped');
		return;
	}

	try {
		trace.update({
			metadata: metadata
		});
		logger.debug('Langfuse trace metadata updated');
	} catch (error) {
		logger.error('Failed to update Langfuse trace metadata', error);
	}
}

/**
 * Initialize Langfuse client with error handling
 * @private
 * @returns {Promise<Object|null>} Promise resolving to Langfuse client instance or null if initialization fails
 */
async function initializeLangfuseClient() {
	initializationAttempted = true;

	try {
		logger.debug('Initializing Langfuse client...');

		// Dynamic import to avoid requiring Langfuse when not needed
		const { Langfuse } = await import('langfuse');

		const secretKey = process.env.LANGFUSE_SECRET_KEY;
		const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
		const baseUrl = process.env.LANGFUSE_HOST || 'https://cloud.langfuse.com';

		langfuseClient = new Langfuse({
			secretKey,
			publicKey,
			baseUrl,
			flushAt: 20,
			flushInterval: 10000,
			requestTimeout: 30000,
			debug: process.env.LANGFUSE_DEBUG === 'true'
		});

		logger.info('Langfuse client initialized successfully', {
			baseUrl,
			debug: process.env.LANGFUSE_DEBUG === 'true'
		});

		return langfuseClient;
	} catch (error) {
		initializationError = error;
		logger.error('Failed to initialize Langfuse client', error);

		// Check for common errors and provide helpful messages
		if (error.code === 'MODULE_NOT_FOUND') {
			logger.error(
				'Langfuse SDK not installed. Run: npm install langfuse'
			);
		} else if (error.message?.includes('Invalid API key')) {
			logger.error(
				'Invalid Langfuse API credentials. Check LANGFUSE_SECRET_KEY and LANGFUSE_PUBLIC_KEY'
			);
		} else if (
			error.message?.includes('network') ||
			error.message?.includes('ENOTFOUND')
		) {
			logger.error(
				'Network error connecting to Langfuse. Check LANGFUSE_HOST and network connectivity'
			);
		}

		return null;
	}
}

/**
 * Flush any pending traces to Langfuse
 * Useful for graceful shutdown or ensuring traces are sent
 * @returns {Promise<void>}
 */
export async function flush() {
	if (langfuseClient && typeof langfuseClient.flush === 'function') {
		try {
			await langfuseClient.flush();
			logger.debug('Langfuse traces flushed successfully');
		} catch (error) {
			logger.error('Failed to flush Langfuse traces', error);
		}
	}
}

/**
 * Shutdown the Langfuse client
 * Should be called during application shutdown
 * @returns {Promise<void>}
 */
export async function shutdown() {
	if (langfuseClient && typeof langfuseClient.shutdown === 'function') {
		try {
			await langfuseClient.shutdown();
			logger.debug('Langfuse client shutdown successfully');
		} catch (error) {
			logger.error('Failed to shutdown Langfuse client', error);
		} finally {
			langfuseClient = null;
			initializationAttempted = false;
			initializationError = null;
		}
	}
}
