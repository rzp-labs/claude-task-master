/**
 * Unit tests for cost-monitor.js
 * Tests cost threshold monitoring and alerting functionality
 */

import { jest } from '@jest/globals';

// Mock config manager before importing cost-monitor
const mockIsCostAlertsEnabled = jest.fn(() => true);
const mockGetCostAlertThresholds = jest.fn(() => ({
	sessionLimit: 1.0,
	taskLimit: 0.5,
	dailyLimit: 5.0
}));

// Mock all dependencies to simplify testing
jest.unstable_mockModule('../../../scripts/modules/config-manager.js', () => ({
	isCostAlertsEnabled: mockIsCostAlertsEnabled,
	getCostAlertThresholds: mockGetCostAlertThresholds,
	// Add any other exports that might be needed
	getDebugFlag: jest.fn(() => false)
}));

jest.unstable_mockModule('../../../scripts/init.js', () => ({
	log: jest.fn()
}));

const {
	checkCostThresholds,
	formatCostAlert,
	getDailyCostSummary,
	getSessionCostSummary,
	resetDailyCosts,
	resetSessionCosts,
	shouldSkipCostTracking
} = await import('../../../src/utils/cost-monitor.js');

describe('cost-monitor', () => {
	beforeEach(() => {
		// Reset mocks and costs before each test
		jest.clearAllMocks();
		mockIsCostAlertsEnabled.mockReturnValue(true);
		mockGetCostAlertThresholds.mockReturnValue({
			sessionLimit: 1.0,
			taskLimit: 0.5,
			dailyLimit: 5.0
		});

		// Reset costs
		resetSessionCosts();
		resetDailyCosts();
	});

	describe('checkCostThresholds', () => {
		test('should accept valid cost data without alerts', () => {
			const costData = {
				totalCost: 0.1,
				inputCost: 0.05,
				outputCost: 0.05,
				currency: 'USD'
			};

			const result = checkCostThresholds(
				costData,
				'task-1',
				'anthropic',
				'/test/root'
			);

			expect(result.alertsEnabled).toBe(true);
			expect(result.alerts).toHaveLength(0);
			expect(result.error).toBeUndefined();
		});

		test('should trigger session limit alert', () => {
			const costData = {
				totalCost: 1.5, // Exceeds session limit of 1.0 and task limit of 0.5
				inputCost: 0.75,
				outputCost: 0.75,
				currency: 'USD'
			};

			const result = checkCostThresholds(
				costData,
				'task-1',
				'anthropic',
				'/test/root'
			);

			// Should trigger both session and task alerts since 1.5 > 1.0 and 1.5 > 0.5
			expect(result.alerts).toHaveLength(2);

			// Find session alert
			const sessionAlert = result.alerts.find(
				(alert) => alert.type === 'session'
			);
			expect(sessionAlert).toBeDefined();
			expect(sessionAlert.threshold).toBe(1.0);
			expect(sessionAlert.current).toBe(1.5);
			expect(sessionAlert.message).toContain('Session cost limit exceeded');

			// Find task alert
			const taskAlert = result.alerts.find((alert) => alert.type === 'task');
			expect(taskAlert).toBeDefined();
			expect(taskAlert.threshold).toBe(0.5);
			expect(taskAlert.current).toBe(1.5);
			expect(taskAlert.taskId).toBe('task-1');
		});

		test('should handle disabled cost alerts', () => {
			mockIsCostAlertsEnabled.mockReturnValue(false);

			const costData = {
				totalCost: 10.0, // Would exceed all limits
				inputCost: 5.0,
				outputCost: 5.0,
				currency: 'USD'
			};

			const result = checkCostThresholds(
				costData,
				'task-1',
				'anthropic',
				'/test/root'
			);

			expect(result.alertsEnabled).toBe(false);
			expect(result.alerts).toHaveLength(0);
		});

		test('should handle invalid cost data gracefully', () => {
			const invalidCostData = {
				totalCost: 'invalid',
				inputCost: null,
				outputCost: undefined,
				currency: 'USD'
			};

			const result = checkCostThresholds(
				invalidCostData,
				'task-1',
				'anthropic',
				'/test/root'
			);

			expect(result.alertsEnabled).toBe(true);
			expect(result.alerts).toHaveLength(0);
			expect(result.error).toBe('Invalid cost data');
		});
	});

	describe('cost tracking and summaries', () => {
		test('should track session costs correctly', () => {
			const costData1 = {
				totalCost: 0.2,
				inputCost: 0.1,
				outputCost: 0.1,
				currency: 'USD'
			};
			const costData2 = {
				totalCost: 0.3,
				inputCost: 0.15,
				outputCost: 0.15,
				currency: 'USD'
			};

			checkCostThresholds(costData1, 'task-1', 'anthropic', '/test/root');
			checkCostThresholds(costData2, 'task-2', 'openai', '/test/root');

			const summary = getSessionCostSummary();

			expect(summary.total).toBe(0.5);
			expect(summary.byTask['task-1']).toBe(0.2);
			expect(summary.byTask['task-2']).toBe(0.3);
			expect(summary.byProvider.anthropic).toBe(0.2);
			expect(summary.byProvider.openai).toBe(0.3);
		});

		test('should reset session costs', () => {
			const costData = {
				totalCost: 0.5,
				inputCost: 0.25,
				outputCost: 0.25,
				currency: 'USD'
			};
			checkCostThresholds(costData, 'task-1', 'anthropic', '/test/root');

			// Verify costs exist
			let summary = getSessionCostSummary();
			expect(summary.total).toBe(0.5);

			// Reset costs
			const resetResult = resetSessionCosts();

			expect(resetResult.reset).toBe(true);
			expect(resetResult.previousTotal).toBe(0.5);

			// Verify costs are reset
			summary = getSessionCostSummary();
			expect(summary.total).toBe(0);
		});
	});

	describe('formatCostAlert', () => {
		test('should format session alert correctly', () => {
			const alert = {
				type: 'session',
				threshold: 1.0,
				current: 1.5,
				message: 'Session cost limit exceeded: $1.5000 > $1.00'
			};

			const formatted = formatCostAlert(alert);

			expect(formatted).toContain('🚨 COST ALERT');
			expect(formatted).toContain('Session cost limit exceeded');
			expect(formatted).toContain('Session Total: $1.5000');
			expect(formatted).toContain('Session Limit: $1.00');
		});

		test('should handle invalid alert data', () => {
			const formatted1 = formatCostAlert(null);
			const formatted2 = formatCostAlert({});

			expect(formatted1).toBe('No alert data available');
			expect(formatted2).toBe('No alert data available');
		});
	});

	describe('shouldSkipCostTracking', () => {
		test('should return false when cost alerts are enabled', () => {
			mockIsCostAlertsEnabled.mockReturnValue(true);

			const result = shouldSkipCostTracking('/test/root');

			expect(result).toBe(false);
		});

		test('should return true when cost alerts are disabled', () => {
			mockIsCostAlertsEnabled.mockReturnValue(false);

			const result = shouldSkipCostTracking('/test/root');

			expect(result).toBe(true);
		});

		test('should handle config check failures gracefully', () => {
			mockIsCostAlertsEnabled.mockImplementation(() => {
				throw new Error('Config check failed');
			});

			const result = shouldSkipCostTracking('/test/root');

			// Should default to not skipping (safer to track than not)
			expect(result).toBe(false);
		});
	});

	describe('performance', () => {
		test('should handle many cost checks efficiently', () => {
			const startTime = performance.now();

			for (let i = 0; i < 100; i++) {
				const costData = {
					totalCost: 0.001 * i,
					inputCost: 0.0005 * i,
					outputCost: 0.0005 * i,
					currency: 'USD'
				};
				checkCostThresholds(costData, `task-${i}`, 'anthropic', '/test/root');
			}

			const endTime = performance.now();
			const totalTime = endTime - startTime;

			// Should complete 100 checks in under 100ms
			expect(totalTime).toBeLessThan(100);
		});
	});
});
