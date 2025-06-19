/**
 * worktree-manager-simple.test.js
 * Simple unit tests for worktree-manager functions that work reliably
 * Focus on pure functions and core logic without deep mocking
 */

import { jest } from '@jest/globals';
import { getWorktreeTitle } from '../../../../../scripts/modules/utils/worktree-manager.js';

describe('worktree-manager-simple', () => {
	describe('getWorktreeTitle', () => {
		it('should generate correct worktree title from task ID', () => {
			expect(getWorktreeTitle('123')).toBe('task-123');
			expect(getWorktreeTitle('456')).toBe('task-456');
		});

		it('should handle string numeric input', () => {
			expect(getWorktreeTitle('789')).toBe('task-789');
		});

		it('should handle edge cases', () => {
			expect(getWorktreeTitle('')).toBe('task-');
			expect(getWorktreeTitle('0')).toBe('task-0');
		});
	});

	describe('worktreeEvents', () => {
		it('should export an EventEmitter instance', async () => {
			const { worktreeEvents } = await import(
				'../../../../../scripts/modules/utils/worktree-manager.js'
			);
			expect(worktreeEvents.on).toBeDefined();
			expect(worktreeEvents.emit).toBeDefined();
			expect(worktreeEvents.off).toBeDefined();
		});

		it('should support multiple listeners', async () => {
			const { worktreeEvents } = await import(
				'../../../../../scripts/modules/utils/worktree-manager.js'
			);
			const listener1 = jest.fn();
			const listener2 = jest.fn();

			worktreeEvents.on('test-event', listener1);
			worktreeEvents.on('test-event', listener2);

			worktreeEvents.emit('test-event', { data: 'test' });

			expect(listener1).toHaveBeenCalledWith({ data: 'test' });
			expect(listener2).toHaveBeenCalledWith({ data: 'test' });

			worktreeEvents.off('test-event', listener1);
			worktreeEvents.off('test-event', listener2);
		});
	});
});
