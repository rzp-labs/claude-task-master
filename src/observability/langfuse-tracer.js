/**
 * src/observability/langfuse-tracer.js
 *
 * Langfuse tracer module implementing singleton pattern for client management.
 * Provides lazy initialization with environment detection and error handling.
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
 * Initialize Langfuse client with error handling
 * @private
 * @returns {Promise<Object|null>} Promise resolving to Langfuse client instance or null if initialization fails
 */
async function initializeLangfuseClient() {
	initializationAttempted = true;

	try {
		logger.debug('Initializing Langfuse client...');

		// Dynamic import to avoid requiring Langfuse when not needed
		const { Langfuse } = await import('@langfuse/langfuse-js');

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
				'Langfuse SDK not installed. Run: npm install @langfuse/langfuse-js'
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
