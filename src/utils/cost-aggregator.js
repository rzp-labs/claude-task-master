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
export async function getCostsByTask(taskId, projectRoot) {
	try {
		const taskIdToUse = taskId || 'unknown';

		if (!taskId) {
			log('debug', 'getCostsByTask: Missing taskId parameter');
		}

		const client = await getClient();
		if (!client) {
			log('debug', 'getCostsByTask: Langfuse client not available');
		}

		// Note: Langfuse trace querying may not be available in the current version
		// This is a placeholder implementation that should be updated when
		// Langfuse client supports trace querying functionality
		log(
			'info',
			`getCostsByTask: Querying costs for task ${taskIdToUse} (placeholder implementation)`
		);

		// Placeholder: Return empty summary until Langfuse querying is implemented
		return {
			taskId: taskIdToUse,
			totalCost: 0,
			breakdown: {
				inputCost: 0,
				outputCost: 0,
				byProvider: {},
				byModel: {}
			},
			traceCount: 0,
			status: 'placeholder',
			note: 'This is a placeholder implementation until Langfuse trace querying is available'
		};
	} catch (error) {
		log('error', 'getCostsByTask: Error aggregating costs', {
			error: error.message,
			taskId
		});
		return {
			taskId: taskId || 'unknown',
			totalCost: 0,
			breakdown: {
				inputCost: 0,
				outputCost: 0,
				byProvider: {},
				byModel: {}
			},
			traceCount: 0,
			status: 'error',
			note: `Error: ${error.message}`
		};
	}
}

/**
 * Get total costs for a specific session by querying Langfuse traces
 * @param {string} sessionId - Session identifier to filter traces
 * @returns {Promise<Object>} Aggregated cost data for the session
 */
export async function getCostsBySession(sessionId, projectRoot) {
	try {
		const sessionIdToUse = sessionId || 'unknown';

		if (!sessionId) {
			log('debug', 'getCostsBySession: Missing sessionId parameter');
		}

		const client = await getClient();
		if (!client) {
			log('debug', 'getCostsBySession: Langfuse client not available');
		}

		log(
			'info',
			`getCostsBySession: Querying costs for session ${sessionIdToUse} (placeholder implementation)`
		);

		// Placeholder implementation
		return {
			sessionId: sessionIdToUse,
			totalCost: 0,
			breakdown: {
				inputCost: 0,
				outputCost: 0,
				byProvider: {},
				byModel: {}
			},
			traceCount: 0,
			status: 'placeholder',
			note: 'This is a placeholder implementation until Langfuse trace querying is available'
		};
	} catch (error) {
		log('error', 'getCostsBySession: Error aggregating costs', {
			error: error.message,
			sessionId
		});
		return {
			sessionId: sessionId || 'unknown',
			totalCost: 0,
			breakdown: {
				inputCost: 0,
				outputCost: 0,
				byProvider: {},
				byModel: {}
			},
			traceCount: 0,
			status: 'error',
			note: `Error: ${error.message}`
		};
	}
}

/**
 * Get total costs for a specific time range by querying Langfuse traces
 * @param {Date|string} startDate - Start date for the range
 * @param {Date|string} endDate - End date for the range
 * @returns {Promise<Object>} Aggregated cost data for the time range
 */
export async function getCostsByTimeRange(startDate, endDate, projectRoot) {
	try {
		let start, end;

		if (!startDate || !endDate) {
			log('debug', 'getCostsByTimeRange: Missing date parameters');
			start = null;
			end = null;
		} else {
			start = new Date(startDate);
			end = new Date(endDate);

			if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
				log('debug', 'getCostsByTimeRange: Invalid date parameters');
				start = null;
				end = null;
			}
		}

		const client = await getClient();
		if (!client) {
			log('debug', 'getCostsByTimeRange: Langfuse client not available');
		}

		if (start && end) {
			log(
				'info',
				`getCostsByTimeRange: Querying costs from ${start.toISOString()} to ${end.toISOString()} (placeholder implementation)`
			);
		} else {
			log(
				'info',
				'getCostsByTimeRange: Invalid date range (placeholder implementation)'
			);
		}

		// Placeholder implementation
		return {
			startTime: start ? start.toISOString() : null,
			endTime: end ? end.toISOString() : null,
			totalCost: 0,
			breakdown: {
				inputCost: 0,
				outputCost: 0,
				byProvider: {},
				byModel: {}
			},
			traceCount: 0,
			status: 'placeholder',
			note: 'This is a placeholder implementation until Langfuse trace querying is available'
		};
	} catch (error) {
		log('error', 'getCostsByTimeRange: Error aggregating costs', {
			error: error.message,
			startDate,
			endDate
		});
		return {
			startTime: null,
			endTime: null,
			totalCost: 0,
			breakdown: {
				inputCost: 0,
				outputCost: 0,
				byProvider: {},
				byModel: {}
			},
			traceCount: 0,
			status: 'error',
			note: `Error: ${error.message}`
		};
	}
}

/**
 * Get running total costs for the current session
 * This function maintains a session-level cache for performance
 * @returns {Promise<Object>} Current session cost data
 */
export async function getCurrentSessionCosts(projectRoot) {
	try {
		const client = await getClient();
		if (!client) {
			log('debug', 'getCurrentSessionCosts: Langfuse client not available');
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
		return {
			sessionId: 'current',
			totalCost: 0,
			breakdown: {
				inputCost: 0,
				outputCost: 0,
				byProvider: {},
				byModel: {}
			},
			traceCount: 0,
			status: 'placeholder',
			startTime: startOfDay.toISOString(),
			note: 'This is a placeholder implementation until Langfuse trace querying is available'
		};
	} catch (error) {
		log('error', 'getCurrentSessionCosts: Error getting session costs', {
			error: error.message
		});
		return {
			sessionId: 'current',
			totalCost: 0,
			breakdown: {
				inputCost: 0,
				outputCost: 0,
				byProvider: {},
				byModel: {}
			},
			traceCount: 0,
			status: 'error',
			startTime: new Date().toISOString(),
			note: `Error: ${error.message}`
		};
	}
}

/**
 * Aggregate cost data from multiple traces with cost metadata
 * @param {Array} traces - Array of trace objects with cost metadata
 * @returns {Object} Aggregated cost summary
 */
export function aggregateTraceCosts(traces) {
	if (!Array.isArray(traces)) {
		// Handle null/undefined gracefully
		return {
			totalCost: 0,
			breakdown: {
				inputCost: 0,
				outputCost: 0,
				byProvider: {},
				byModel: {}
			},
			traceCount: 0
		};
	}

	if (traces.length === 0) {
		return {
			totalCost: 0,
			breakdown: {
				inputCost: 0,
				outputCost: 0,
				byProvider: {},
				byModel: {}
			},
			traceCount: 0
		};
	}

	const summary = {
		totalCost: 0,
		breakdown: {
			inputCost: 0,
			outputCost: 0,
			byProvider: {},
			byModel: {},
			skippedTraces: 0
		},
		traceCount: 0
	};

	for (const trace of traces) {
		summary.traceCount++;
		try {
			// Extract cost data from trace metadata
			const costData = extractCostFromTrace(trace);
			if (
				costData &&
				typeof costData.totalCost === 'number' &&
				!isNaN(costData.totalCost)
			) {
				summary.totalCost += costData.totalCost || 0;
				summary.breakdown.inputCost += costData.inputCost || 0;
				summary.breakdown.outputCost += costData.outputCost || 0;

				// Track provider costs
				const provider = costData.provider || 'unknown';
				summary.breakdown.byProvider[provider] =
					(summary.breakdown.byProvider[provider] || 0) +
					(costData.totalCost || 0);

				// Track model costs
				const model = costData.model || 'unknown';
				summary.breakdown.byModel[model] =
					(summary.breakdown.byModel[model] || 0) + (costData.totalCost || 0);
			} else {
				summary.breakdown.skippedTraces++;
			}
		} catch (error) {
			summary.breakdown.skippedTraces++;
		}
	}

	// Round monetary values to avoid floating point issues
	summary.totalCost = parseFloat(summary.totalCost.toFixed(6));
	summary.breakdown.inputCost = parseFloat(
		summary.breakdown.inputCost.toFixed(6)
	);
	summary.breakdown.outputCost = parseFloat(
		summary.breakdown.outputCost.toFixed(6)
	);

	// Round provider and model costs
	for (const provider in summary.breakdown.byProvider) {
		summary.breakdown.byProvider[provider] = parseFloat(
			summary.breakdown.byProvider[provider].toFixed(6)
		);
	}
	for (const model in summary.breakdown.byModel) {
		summary.breakdown.byModel[model] = parseFloat(
			summary.breakdown.byModel[model].toFixed(6)
		);
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
				provider:
					costData.breakdown?.provider ||
					trace.metadata?.provider ||
					costData.breakdown?.providerName,
				model:
					costData.breakdown?.model ||
					trace.metadata?.model ||
					costData.breakdown?.modelId,
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
	const breakdown = costSummary.breakdown || {};
	const inputCost = breakdown.inputCost || 0;
	const outputCost = breakdown.outputCost || 0;
	const traceCount = costSummary.traceCount || 0;
	const byProvider = breakdown.byProvider || {};
	const byModel = breakdown.byModel || {};

	const lines = [];
	lines.push(`Total Cost: $${totalCost.toFixed(3)}`);
	lines.push(`Input: $${inputCost.toFixed(3)}`);
	lines.push(`Output: $${outputCost.toFixed(3)}`);
	lines.push(`Traces: ${traceCount}`);

	if (Object.keys(byProvider).length > 0) {
		lines.push('');

		// Sort providers by cost (descending) and take top 10
		const sortedProviders = Object.entries(byProvider)
			.sort((a, b) => b[1] - a[1])
			.slice(0, 10);

		for (const [provider, cost] of sortedProviders) {
			lines.push(`${provider}: $${cost.toFixed(3)}`);
		}

		if (Object.keys(byProvider).length > 10) {
			lines.push(`(and ${Object.keys(byProvider).length - 10} more)`);
		}
	} else {
		lines.push('No provider breakdown available');
	}

	// Handle timeRange safely
	if (
		costSummary.timeRange &&
		costSummary.timeRange.start &&
		costSummary.timeRange.end
	) {
		lines.push('');
		lines.push(
			`Time Range: ${costSummary.timeRange.start.toISOString()} to ${costSummary.timeRange.end.toISOString()}`
		);
	}

	if (costSummary.errors && costSummary.errors.length > 0) {
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
