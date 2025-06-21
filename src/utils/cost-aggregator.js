/**
 * src/utils/cost-aggregator.js
 *
 * Cost aggregation utilities for querying and summing cost data from Langfuse traces.
 * Provides functions to aggregate costs by task, session, or time period.
 */

import { log } from '../../scripts/init.js';
import { getClient } from '../observability/langfuse-tracer.js';

/**
 * Get total costs for a specific task by querying Langfuse traces
 * @param {string} taskId - Task identifier to filter traces
 * @returns {Promise<Object>} Aggregated cost data for the task
 */
export async function getCostsByTask(taskId) {
	try {
		if (!taskId) {
			log('debug', 'getCostsByTask: Missing taskId parameter');
			return createEmptyCostSummary('Missing taskId parameter');
		}

		const client = await getClient();
		if (!client) {
			log('debug', 'getCostsByTask: Langfuse client not available');
			return createEmptyCostSummary('Langfuse client not available');
		}

		// Note: Langfuse trace querying may not be available in the current version
		// This is a placeholder implementation that should be updated when
		// Langfuse client supports trace querying functionality
		log(
			'info',
			`getCostsByTask: Querying costs for task ${taskId} (placeholder implementation)`
		);

		// Placeholder: Return empty summary until Langfuse querying is implemented
		return createEmptyCostSummary(
			'Langfuse trace querying not yet implemented'
		);
	} catch (error) {
		log('error', 'getCostsByTask: Error aggregating costs', {
			error: error.message,
			taskId
		});
		return createEmptyCostSummary(`Error: ${error.message}`);
	}
}

/**
 * Get total costs for a specific session by querying Langfuse traces
 * @param {string} sessionId - Session identifier to filter traces
 * @returns {Promise<Object>} Aggregated cost data for the session
 */
export async function getCostsBySession(sessionId) {
	try {
		if (!sessionId) {
			log('debug', 'getCostsBySession: Missing sessionId parameter');
			return createEmptyCostSummary('Missing sessionId parameter');
		}

		const client = await getClient();
		if (!client) {
			log('debug', 'getCostsBySession: Langfuse client not available');
			return createEmptyCostSummary('Langfuse client not available');
		}

		log(
			'info',
			`getCostsBySession: Querying costs for session ${sessionId} (placeholder implementation)`
		);

		// Placeholder implementation
		return createEmptyCostSummary(
			'Langfuse trace querying not yet implemented'
		);
	} catch (error) {
		log('error', 'getCostsBySession: Error aggregating costs', {
			error: error.message,
			sessionId
		});
		return createEmptyCostSummary(`Error: ${error.message}`);
	}
}

/**
 * Get total costs for a specific time range by querying Langfuse traces
 * @param {Date|string} startDate - Start date for the range
 * @param {Date|string} endDate - End date for the range
 * @returns {Promise<Object>} Aggregated cost data for the time range
 */
export async function getCostsByTimeRange(startDate, endDate) {
	try {
		if (!startDate || !endDate) {
			log('debug', 'getCostsByTimeRange: Missing date parameters');
			return createEmptyCostSummary('Missing date parameters');
		}

		const client = await getClient();
		if (!client) {
			log('debug', 'getCostsByTimeRange: Langfuse client not available');
			return createEmptyCostSummary('Langfuse client not available');
		}

		const start = new Date(startDate);
		const end = new Date(endDate);

		if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
			log('debug', 'getCostsByTimeRange: Invalid date parameters');
			return createEmptyCostSummary('Invalid date parameters');
		}

		log(
			'info',
			`getCostsByTimeRange: Querying costs from ${start.toISOString()} to ${end.toISOString()} (placeholder implementation)`
		);

		// Placeholder implementation
		return createEmptyCostSummary(
			'Langfuse trace querying not yet implemented'
		);
	} catch (error) {
		log('error', 'getCostsByTimeRange: Error aggregating costs', {
			error: error.message,
			startDate,
			endDate
		});
		return createEmptyCostSummary(`Error: ${error.message}`);
	}
}

/**
 * Get running total costs for the current session
 * This function maintains a session-level cache for performance
 * @returns {Promise<Object>} Current session cost data
 */
export async function getCurrentSessionCosts() {
	try {
		const client = await getClient();
		if (!client) {
			log('debug', 'getCurrentSessionCosts: Langfuse client not available');
			return createEmptyCostSummary('Langfuse client not available');
		}

		// For now, return current session as today's costs
		const today = new Date();
		const startOfDay = new Date(
			today.getFullYear(),
			today.getMonth(),
			today.getDate()
		);

		log(
			'info',
			'getCurrentSessionCosts: Getting current session costs (placeholder implementation)'
		);

		// Placeholder implementation
		return createEmptyCostSummary(
			'Langfuse trace querying not yet implemented'
		);
	} catch (error) {
		log('error', 'getCurrentSessionCosts: Error getting session costs', {
			error: error.message
		});
		return createEmptyCostSummary(`Error: ${error.message}`);
	}
}

/**
 * Aggregate cost data from multiple traces with cost metadata
 * @param {Array} traces - Array of trace objects with cost metadata
 * @returns {Object} Aggregated cost summary
 */
export function aggregateTraceCosts(traces) {
	if (!Array.isArray(traces) || traces.length === 0) {
		return createEmptyCostSummary('No traces provided');
	}

	const summary = {
		totalCost: 0,
		inputCost: 0,
		outputCost: 0,
		currency: 'USD',
		traceCount: 0,
		providers: {},
		models: {},
		timeRange: {
			start: null,
			end: null
		},
		errors: []
	};

	for (const trace of traces) {
		try {
			// Extract cost data from trace metadata
			const costData = extractCostFromTrace(trace);
			if (costData) {
				summary.totalCost += costData.totalCost || 0;
				summary.inputCost += costData.inputCost || 0;
				summary.outputCost += costData.outputCost || 0;
				summary.traceCount++;

				// Track provider costs
				const provider = costData.provider || 'unknown';
				if (!summary.providers[provider]) {
					summary.providers[provider] = { totalCost: 0, traceCount: 0 };
				}
				summary.providers[provider].totalCost += costData.totalCost || 0;
				summary.providers[provider].traceCount++;

				// Track model costs
				const model = costData.model || 'unknown';
				if (!summary.models[model]) {
					summary.models[model] = { totalCost: 0, traceCount: 0 };
				}
				summary.models[model].totalCost += costData.totalCost || 0;
				summary.models[model].traceCount++;

				// Update time range
				const timestamp = costData.timestamp || trace.timestamp;
				if (timestamp) {
					const date = new Date(timestamp);
					if (!summary.timeRange.start || date < summary.timeRange.start) {
						summary.timeRange.start = date;
					}
					if (!summary.timeRange.end || date > summary.timeRange.end) {
						summary.timeRange.end = date;
					}
				}
			}
		} catch (error) {
			summary.errors.push(`Error processing trace: ${error.message}`);
		}
	}

	// Round monetary values to avoid floating point issues
	summary.totalCost = parseFloat(summary.totalCost.toFixed(6));
	summary.inputCost = parseFloat(summary.inputCost.toFixed(6));
	summary.outputCost = parseFloat(summary.outputCost.toFixed(6));

	// Round provider and model costs
	for (const provider of Object.values(summary.providers)) {
		provider.totalCost = parseFloat(provider.totalCost.toFixed(6));
	}
	for (const model of Object.values(summary.models)) {
		model.totalCost = parseFloat(model.totalCost.toFixed(6));
	}

	return summary;
}

/**
 * Extract cost data from a single trace object
 * @param {Object} trace - Trace object potentially containing cost metadata
 * @returns {Object|null} Extracted cost data or null if not found
 */
function extractCostFromTrace(trace) {
	if (!trace) return null;

	// Look for cost data in various possible locations
	const costSources = [
		trace.metadata?.cost,
		trace.cost,
		trace.generation?.metadata?.cost,
		trace.span?.metadata?.cost
	];

	for (const costData of costSources) {
		if (costData && typeof costData === 'object') {
			return {
				totalCost: costData.totalCost || 0,
				inputCost: costData.inputCost || 0,
				outputCost: costData.outputCost || 0,
				currency: costData.currency || 'USD',
				provider: trace.metadata?.provider || costData.breakdown?.providerName,
				model: trace.metadata?.model || costData.breakdown?.modelId,
				timestamp: costData.breakdown?.calculationTimestamp || trace.timestamp
			};
		}
	}

	return null;
}

/**
 * Create an empty cost summary for error cases
 * @param {string} reason - Reason for empty summary
 * @returns {Object} Empty cost summary
 */
function createEmptyCostSummary(reason) {
	return {
		totalCost: 0,
		inputCost: 0,
		outputCost: 0,
		currency: 'USD',
		traceCount: 0,
		providers: {},
		models: {},
		timeRange: {
			start: null,
			end: null
		},
		errors: [reason],
		note: 'Cost aggregation functionality requires Langfuse trace querying capabilities'
	};
}

/**
 * Format cost summary for display
 * @param {Object} costSummary - Cost summary object
 * @returns {string} Formatted cost summary
 */
export function formatCostSummary(costSummary) {
	if (!costSummary) {
		return 'No cost data available';
	}

	// Ensure required properties exist with defaults
	const totalCost = costSummary.totalCost || 0;
	const inputCost = costSummary.inputCost || 0;
	const outputCost = costSummary.outputCost || 0;
	const currency = costSummary.currency || 'USD';
	const traceCount = costSummary.traceCount || 0;
	const providers = costSummary.providers || {};
	const models = costSummary.models || {};

	const lines = [];
	lines.push(`Total Cost: ${currency} ${totalCost.toFixed(6)}`);
	lines.push(`Input Cost: ${currency} ${inputCost.toFixed(6)}`);
	lines.push(`Output Cost: ${currency} ${outputCost.toFixed(6)}`);
	lines.push(`Traces: ${traceCount}`);

	if (Object.keys(providers).length > 0) {
		lines.push('');
		lines.push('By Provider:');
		for (const [provider, data] of Object.entries(providers)) {
			const providerCost = (data.totalCost || 0).toFixed(6);
			const providerTraces = data.traceCount || 0;
			lines.push(
				`  ${provider}: ${currency} ${providerCost} (${providerTraces} traces)`
			);
		}
	}

	if (Object.keys(models).length > 0) {
		lines.push('');
		lines.push('By Model:');
		for (const [model, data] of Object.entries(models)) {
			const modelCost = (data.totalCost || 0).toFixed(6);
			const modelTraces = data.traceCount || 0;
			lines.push(
				`  ${model}: ${currency} ${modelCost} (${modelTraces} traces)`
			);
		}
	}

	if (costSummary.timeRange.start && costSummary.timeRange.end) {
		lines.push('');
		lines.push(
			`Time Range: ${costSummary.timeRange.start.toISOString()} to ${costSummary.timeRange.end.toISOString()}`
		);
	}

	if (costSummary.errors.length > 0) {
		lines.push('');
		lines.push('Errors:');
		for (const error of costSummary.errors) {
			lines.push(`  - ${error}`);
		}
	}

	if (costSummary.note) {
		lines.push('');
		lines.push(`Note: ${costSummary.note}`);
	}

	return lines.join('\n');
}
