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
 * - updateConfiguration(): Update configuration and reset client
 * - flush(): Flush pending traces
 * - shutdown(): Shutdown client and cleanup
 *
 * Configuration Sources (in order of precedence):
 * 1. Environment Variables:
 *    - LANGFUSE_SECRET_KEY: Required secret key
 *    - LANGFUSE_PUBLIC_KEY: Required public key
 *    - LANGFUSE_BASEURL: Optional base URL (defaults to cloud.langfuse.com)
 *    - LANGFUSE_DEBUG: Optional debug flag
 * 2. Task Master config.json:
 *    - observability.langfuse.secretKey
 *    - observability.langfuse.publicKey
 *    - observability.langfuse.baseUrl
 *    - observability.langfuse.debug
 *    - observability.langfuse.enabled
 */

import { getConfig } from '../../scripts/modules/config-manager.js';
import { createStandardLogger } from '../utils/logger-utils.js';

// Logger instance for this module
const logger = createStandardLogger();
      
      // Enhanced configuration imports for new features  
      import { 
      	getLangfuseSamplingRate,
      	getLangfuseRedactionPatterns,
      	getLangfuseBatchSize
      } from '../../scripts/modules/config-manager.js';
// Singleton instance
let langfuseClient = null;
let initializationAttempted = false;
let initializationError = null;
    
    // Batching counter for simple batching consideration
    let activeTraceCount = 0;
    
    /**
     * Create a masking function based on configured redaction patterns
     * @returns {Function|null} Masking function or null if no patterns configured
     */
    function createMaskingFunction() {
    	const patterns = getLangfuseRedactionPatterns();
    	
    	if (!patterns || patterns.length === 0) {
    		return null; // No masking needed
    	}
    	
    	return function maskingFunction(params) {
    		const { data } = params;
    		
    		if (typeof data === 'string') {
    			// Apply pattern matching
    			for (const pattern of patterns) {
    				if (typeof pattern === 'string') {
    					if (data.includes(pattern)) {
    						return '[REDACTED]';
    					}
    				} else if (pattern instanceof RegExp) {
    					if (pattern.test(data)) {
    						return '[REDACTED]';
    					}
    				}
    			}
    		}
    		
    		// For objects and arrays, return unchanged (Langfuse handles recursive masking)
    		return data;
    	};
    }
/**
 * Get Langfuse configuration from environment variables and config.json
 * Environment variables take precedence over config.json
 * @returns {Object} Configuration object with secretKey, publicKey, host, debug, enabled
 */
function getLangfuseConfig() {
	// Try environment variables first (highest precedence)
	const envSecretKey = process.env.LANGFUSE_SECRET_KEY;
	const envPublicKey = process.env.LANGFUSE_PUBLIC_KEY;
	const envBaseUrl = process.env.LANGFUSE_BASEURL;
	const envDebug = process.env.LANGFUSE_DEBUG;

	// Try config.json as fallback
	let configValues = {};
	try {
		const config = getConfig();
		const langfuseConfig = config?.observability?.langfuse || {};
		configValues = {
			secretKey: langfuseConfig.secretKey,
			publicKey: langfuseConfig.publicKey,
			baseUrl: langfuseConfig.baseUrl,
			debug: langfuseConfig.debug,
			enabled: langfuseConfig.enabled
		};
	} catch (error) {
		logger.debug(
			'Could not read config.json for Langfuse configuration:',
			error.message
		);
		configValues = {};
	}

	// Merge with environment variables taking precedence
	return {
		secretKey: envSecretKey || configValues.secretKey,
		publicKey: envPublicKey || configValues.publicKey,
		baseUrl: envBaseUrl || configValues.baseUrl || 'https://cloud.langfuse.com',
		debug: envDebug
			? envDebug.toLowerCase() === 'true'
			: configValues.debug || false,
		enabled: configValues.enabled !== false // Default to true unless explicitly disabled in config
	};
}

/**
 * Check if Langfuse is enabled by validating required configuration
 * Checks both environment variables and config.json
 * @returns {boolean} True if Langfuse is properly configured, false otherwise
 */
export function isEnabled() {
	const config = getLangfuseConfig();

	// Must have both secret and public keys
	// If env vars are set, ignore config enabled flag (env vars take precedence)
	// If only config.json is used, respect the enabled flag
	const hasEnvVars = !!(
		process.env.LANGFUSE_SECRET_KEY && process.env.LANGFUSE_PUBLIC_KEY
	);
	const isEnabledInConfig = config.enabled !== false;

	return !!(
		config.secretKey &&
		config.publicKey &&
		(hasEnvVars || isEnabledInConfig)
	);
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
	// Apply sampling logic first for efficiency
	const samplingRate = getLangfuseSamplingRate();
	if (samplingRate !== false && typeof samplingRate === 'number' && Math.random() >= samplingRate) {
		logger.debug(`Trace sampled out (rate: ${samplingRate})`);
		return null;
	}

	// Check batching limits
	const batchSize = getLangfuseBatchSize();
	if (batchSize > 0 && activeTraceCount >= batchSize) {
		logger.debug(`Batch limit reached (${activeTraceCount}/${batchSize})`);
		return null;
	}

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

		// Increment active trace counter for batching
		if (batchSize > 0) {
			activeTraceCount++;
		}

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

		// Get configuration from both env vars and config.json
		const config = getLangfuseConfig();

		// Create masking function if redaction patterns are configured
		const maskingFunction = createMaskingFunction();
		
		// Build client options
		const clientOptions = {
			secretKey: config.secretKey,
			publicKey: config.publicKey,
			baseUrl: config.baseUrl,
			flushAt: 20,
			flushInterval: 10000,
			requestTimeout: 30000,
			debug: config.debug
		};

		// Add masking function if configured
		if (maskingFunction) {
			clientOptions.mask = maskingFunction;
			logger.debug('Langfuse masking enabled with configured patterns');
		}

		langfuseClient = new Langfuse(clientOptions);

		logger.info('Langfuse client initialized successfully', {
			baseUrl: config.baseUrl,
			debug: config.debug,
			maskingEnabled: !!maskingFunction
		});

		return langfuseClient;
	} catch (error) {
		initializationError = error;
		logger.error('Failed to initialize Langfuse client', error);

		// Check for common errors and provide helpful messages
		if (error.code === 'MODULE_NOT_FOUND') {
			logger.error('Langfuse SDK not installed. Run: npm install langfuse');
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
 * Update configuration and reset client
 * Called when configuration changes at runtime
 * @returns {Promise<void>}
 */
export async function updateConfiguration() {
	try {
		logger.debug('Updating Langfuse configuration...');

		// Shutdown existing client if present
		if (langfuseClient && typeof langfuseClient.shutdown === 'function') {
			try {
				await langfuseClient.shutdown();
			} catch (error) {
				logger.warn('Error shutting down existing Langfuse client', error);
			}
		}

		// Reset state to allow re-initialization with new config
		langfuseClient = null;
		initializationAttempted = false;
		initializationError = null;

		logger.debug('Langfuse configuration updated and client reset');
	} catch (error) {
		logger.error('Failed to update Langfuse configuration', error);
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
