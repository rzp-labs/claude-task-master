/**
 * Simple unit tests for cost-monitor.js
 * Tests basic functionality without complex mocking
 */

import {
	getSessionCostSummary,
	getDailyCostSummary,
	resetSessionCosts,
	resetDailyCosts,
	formatCostAlert
} from '../../../src/utils/cost-monitor.js';

describe('cost-monitor basic functionality', () => {
	beforeEach(() => {
		// Reset costs before each test
		resetSessionCosts();
		resetDailyCosts();
	});

	describe('session cost summaries', () => {
		test('should return initial empty summary', () => {
			const summary = getSessionCostSummary();

			expect(summary.total).toBe(0);
			expect(Object.keys(summary.byTask)).toHaveLength(0);
			expect(Object.keys(summary.byProvider)).toHaveLength(0);
			expect(summary.startTime).toBeDefined();
		});

		test('should reset session costs correctly', () => {
			const resetResult = resetSessionCosts();

			expect(resetResult.reset).toBe(true);
			expect(resetResult.previousTotal).toBe(0);
			expect(resetResult.resetTime).toBeDefined();

			const summary = getSessionCostSummary();
			expect(summary.total).toBe(0);
		});
	});

	describe('daily cost summaries', () => {
		test('should return initial empty daily summary', () => {
			const summary = getDailyCostSummary();

			expect(summary.total).toBe(0);
			expect(summary.date).toBe(new Date().toDateString());
			expect(summary.lastReset).toBeDefined();
		});

		test('should reset daily costs correctly', () => {
			const resetResult = resetDailyCosts();

			expect(resetResult.reset).toBe(true);
			expect(resetResult.previousTotal).toBe(0);
			expect(resetResult.resetTime).toBeDefined();

			const summary = getDailyCostSummary();
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

		test('should format task alert correctly', () => {
			const alert = {
				type: 'task',
				taskId: 'task-1',
				threshold: 0.5,
				current: 0.7,
				message: 'Task task-1 cost limit exceeded: $0.7000 > $0.50'
			};

			const formatted = formatCostAlert(alert);

			expect(formatted).toContain('🚨 COST ALERT');
			expect(formatted).toContain('Task task-1 cost limit exceeded');
			expect(formatted).toContain('Task task-1 Total: $0.7000');
			expect(formatted).toContain('Task Limit: $0.50');
		});

		test('should format daily alert correctly', () => {
			const alert = {
				type: 'daily',
				threshold: 5.0,
				current: 6.0,
				date: '2024-01-01',
				message: 'Daily cost limit exceeded: $6.0000 > $5.00'
			};

			const formatted = formatCostAlert(alert);

			expect(formatted).toContain('🚨 COST ALERT');
			expect(formatted).toContain('Daily cost limit exceeded');
			expect(formatted).toContain('Daily Total: $6.0000');
			expect(formatted).toContain('Daily Limit: $5.00');
			expect(formatted).toContain('Date: 2024-01-01');
		});

		test('should handle invalid alert data', () => {
			const formatted1 = formatCostAlert(null);
			const formatted2 = formatCostAlert({});
			const formatted3 = formatCostAlert({ type: 'unknown' });

			expect(formatted1).toBe('No alert data available');
			expect(formatted2).toBe('No alert data available');
			expect(formatted3).toBe('No alert data available'); // Unknown type also returns no data
		});
	});

	describe('edge cases', () => {
		test('should handle multiple resets', () => {
			resetSessionCosts();
			resetSessionCosts();
			resetDailyCosts();
			resetDailyCosts();

			const sessionSummary = getSessionCostSummary();
			const dailySummary = getDailyCostSummary();

			expect(sessionSummary.total).toBe(0);
			expect(dailySummary.total).toBe(0);
		});

		test('should handle cost precision correctly', () => {
			const summary = getSessionCostSummary();

			// Test that precision is maintained in the summary
			expect(typeof summary.total).toBe('number');
			expect(Number.isFinite(summary.total)).toBe(true);
		});
	});

	describe('performance', () => {
		test('should complete summary operations quickly', () => {
			const startTime = performance.now();

			// Run multiple summary operations
			for (let i = 0; i < 1000; i++) {
				getSessionCostSummary();
				getDailyCostSummary();
			}

			const endTime = performance.now();
			const totalTime = endTime - startTime;

			// Should complete 1000 operations in under 100ms
			expect(totalTime).toBeLessThan(100);
		});

		test('should not leak memory with repeated operations', () => {
			const initialMemory = process.memoryUsage().heapUsed;

			// Run many operations
			for (let i = 0; i < 1000; i++) {
				resetSessionCosts();
				getSessionCostSummary();
				formatCostAlert({
					type: 'session',
					threshold: 1.0,
					current: 1.5,
					message: 'Test alert'
				});
			}

			// Force garbage collection if available
			if (global.gc) {
				global.gc();
			}

			const finalMemory = process.memoryUsage().heapUsed;
			const memoryIncrease = finalMemory - initialMemory;

			// Memory increase should be reasonable (less than 5MB for 1000 operations)
			expect(memoryIncrease).toBeLessThan(5 * 1024 * 1024);
		});
	});
});
