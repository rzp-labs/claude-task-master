/**
 * src/utils/cost-monitor.js
 *
 * Cost threshold monitoring utilities for AI provider calls.
 * Tracks cumulative costs and triggers alerts when thresholds are exceeded.
 */

import { log } from '../../scripts/init.js';
import {
	getCostAlertThresholds,
	isCostAlertsEnabled
} from '../../scripts/modules/config-manager.js';

// Session-level cost tracking
let sessionCosts = {
	total: 0,
	byTask: {},
	byProvider: {},
	startTime: new Date().toISOString(),
	lastReset: new Date().toISOString()
};

// Daily cost tracking (simple in-memory for now)
let dailyCosts = {
	total: 0,
	date: new Date().toDateString(),
	lastReset: new Date().toISOString()
};

/**
 * Check cost thresholds and log warnings if exceeded
 * @param {Object} costData - Cost data from calculateAiCost
 * @param {string} taskId - Task identifier (optional)
 * @param {string} providerName - Provider name
 * @param {string} projectRoot - Project root path for config
 * @returns {Object} Alert status and messages
 */
export function checkCostThresholds(
	costData,
	taskId = null,
	providerName = null,
	projectRoot = null
) {
	try {
		// Check if cost alerts are enabled
		if (!isCostAlertsEnabled(projectRoot)) {
			return { alertsEnabled: false, alerts: [] };
		}

		if (!costData || typeof costData.totalCost !== 'number') {
			return { alertsEnabled: true, alerts: [], error: 'Invalid cost data' };
		}

		const thresholds = getCostAlertThresholds(projectRoot);
		const alerts = [];

		// Update session costs
		updateSessionCosts(costData, taskId, providerName);

		// Update daily costs
		updateDailyCosts(costData);

		// Check session threshold
		if (
			thresholds.sessionLimit &&
			sessionCosts.total > thresholds.sessionLimit
		) {
			const alert = {
				type: 'session',
				threshold: thresholds.sessionLimit,
				current: sessionCosts.total,
				message: `Session cost limit exceeded: $${sessionCosts.total.toFixed(4)} > $${thresholds.sessionLimit.toFixed(2)}`
			};
			alerts.push(alert);

			log('warn', alert.message, {
				sessionCosts: sessionCosts.total,
				threshold: thresholds.sessionLimit,
				taskId,
				providerName
			});
		}

		// Check task threshold if taskId provided
		if (taskId && thresholds.taskLimit && sessionCosts.byTask[taskId]) {
			const taskCost = sessionCosts.byTask[taskId];
			if (taskCost > thresholds.taskLimit) {
				const alert = {
					type: 'task',
					taskId,
					threshold: thresholds.taskLimit,
					current: taskCost,
					message: `Task ${taskId} cost limit exceeded: $${taskCost.toFixed(4)} > $${thresholds.taskLimit.toFixed(2)}`
				};
				alerts.push(alert);

				log('warn', alert.message, {
					taskCost,
					threshold: thresholds.taskLimit,
					taskId,
					providerName
				});
			}
		}

		// Check daily threshold
		if (thresholds.dailyLimit && dailyCosts.total > thresholds.dailyLimit) {
			const alert = {
				type: 'daily',
				threshold: thresholds.dailyLimit,
				current: dailyCosts.total,
				date: dailyCosts.date,
				message: `Daily cost limit exceeded: $${dailyCosts.total.toFixed(4)} > $${thresholds.dailyLimit.toFixed(2)}`
			};
			alerts.push(alert);

			log('warn', alert.message, {
				dailyCosts: dailyCosts.total,
				threshold: thresholds.dailyLimit,
				date: dailyCosts.date,
				taskId,
				providerName
			});
		}

		return {
			alertsEnabled: true,
			alerts,
			sessionCosts: { ...sessionCosts },
			dailyCosts: { ...dailyCosts }
		};
	} catch (error) {
		log('error', 'checkCostThresholds: Error checking thresholds', {
			error: error.message,
			taskId,
			providerName
		});
		return {
			alertsEnabled: true,
			alerts: [],
			error: error.message
		};
	}
}

/**
 * Update session-level cost tracking
 * @param {Object} costData - Cost data from calculateAiCost
 * @param {string} taskId - Task identifier (optional)
 * @param {string} providerName - Provider name (optional)
 */
function updateSessionCosts(costData, taskId = null, providerName = null) {
	const cost = costData.totalCost || 0;

	// Update total session cost
	sessionCosts.total += cost;

	// Update task-specific costs
	if (taskId) {
		if (!sessionCosts.byTask[taskId]) {
			sessionCosts.byTask[taskId] = 0;
		}
		sessionCosts.byTask[taskId] += cost;
	}

	// Update provider-specific costs
	if (providerName) {
		if (!sessionCosts.byProvider[providerName]) {
			sessionCosts.byProvider[providerName] = 0;
		}
		sessionCosts.byProvider[providerName] += cost;
	}
}

/**
 * Update daily cost tracking
 * @param {Object} costData - Cost data from calculateAiCost
 */
function updateDailyCosts(costData) {
	const cost = costData.totalCost || 0;
	const today = new Date().toDateString();

	// Reset daily costs if it's a new day
	if (dailyCosts.date !== today) {
		dailyCosts = {
			total: 0,
			date: today,
			lastReset: new Date().toISOString()
		};
	}

	dailyCosts.total += cost;
}

/**
 * Get current session cost summary
 * @returns {Object} Session cost summary
 */
export function getSessionCostSummary() {
	return {
		...sessionCosts,
		// Round values for display
		total: parseFloat(sessionCosts.total.toFixed(6)),
		byTask: Object.fromEntries(
			Object.entries(sessionCosts.byTask).map(([task, cost]) => [
				task,
				parseFloat(cost.toFixed(6))
			])
		),
		byProvider: Object.fromEntries(
			Object.entries(sessionCosts.byProvider).map(([provider, cost]) => [
				provider,
				parseFloat(cost.toFixed(6))
			])
		)
	};
}

/**
 * Get current daily cost summary
 * @returns {Object} Daily cost summary
 */
export function getDailyCostSummary() {
	return {
		...dailyCosts,
		total: parseFloat(dailyCosts.total.toFixed(6))
	};
}

/**
 * Reset session costs (useful for testing or manual reset)
 * @returns {Object} Reset confirmation
 */
export function resetSessionCosts() {
	const previousTotal = sessionCosts.total;
	sessionCosts = {
		total: 0,
		byTask: {},
		byProvider: {},
		startTime: new Date().toISOString(),
		lastReset: new Date().toISOString()
	};

	log('info', 'Session costs reset', {
		previousTotal: parseFloat(previousTotal.toFixed(6))
	});

	return {
		reset: true,
		previousTotal: parseFloat(previousTotal.toFixed(6)),
		resetTime: sessionCosts.lastReset
	};
}

/**
 * Reset daily costs (useful for testing or manual reset)
 * @returns {Object} Reset confirmation
 */
export function resetDailyCosts() {
	const previousTotal = dailyCosts.total;
	const previousDate = dailyCosts.date;

	dailyCosts = {
		total: 0,
		date: new Date().toDateString(),
		lastReset: new Date().toISOString()
	};

	log('info', 'Daily costs reset', {
		previousTotal: parseFloat(previousTotal.toFixed(6)),
		previousDate
	});

	return {
		reset: true,
		previousTotal: parseFloat(previousTotal.toFixed(6)),
		previousDate,
		resetTime: dailyCosts.lastReset
	};
}

/**
 * Format cost alert for display
 * @param {Object} alert - Alert object from checkCostThresholds
 * @returns {string} Formatted alert message
 */
export function formatCostAlert(alert) {
	if (!alert || !alert.message) {
		return 'No alert data available';
	}

	const lines = [];
	lines.push(`🚨 COST ALERT: ${alert.message}`);

	if (alert.type === 'session') {
		lines.push(`   Session Total: $${alert.current.toFixed(4)}`);
		lines.push(`   Session Limit: $${alert.threshold.toFixed(2)}`);
	} else if (alert.type === 'task') {
		lines.push(`   Task ${alert.taskId} Total: $${alert.current.toFixed(4)}`);
		lines.push(`   Task Limit: $${alert.threshold.toFixed(2)}`);
	} else if (alert.type === 'daily') {
		lines.push(`   Daily Total: $${alert.current.toFixed(4)}`);
		lines.push(`   Daily Limit: $${alert.threshold.toFixed(2)}`);
		lines.push(`   Date: ${alert.date}`);
	}

	return lines.join('\n');
}

/**
 * Check if cost tracking should be skipped (for performance)
 * @param {string} projectRoot - Project root path for config
 * @returns {boolean} True if cost tracking should be skipped
 */
export function shouldSkipCostTracking(projectRoot = null) {
	try {
		return !isCostAlertsEnabled(projectRoot);
	} catch (error) {
		// If config check fails, don't skip (safer to track than not)
		log(
			'debug',
			'shouldSkipCostTracking: Config check failed, defaulting to track',
			{
				error: error.message
			}
		);
		return false;
	}
}
