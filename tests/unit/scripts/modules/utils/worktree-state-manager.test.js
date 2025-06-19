/**
 * worktree-state-manager.test.js
 * Unit tests for worktree-state-manager functions using focused hybrid mocking strategy
 *
 * Strategy: Mock file system and Git operations but test state management logic
 * Value: Regression protection for critical state persistence operations
 */

import { jest } from '@jest/globals';

// Mock all external dependencies using jest.unstable_mockModule
const mockExec = jest.fn();
const mockReadJSON = jest.fn();
const mockWriteJSON = jest.fn();
const mockExistsSync = jest.fn();

jest.unstable_mockModule('child_process', () => ({
	exec: mockExec,
	execSync: jest.fn()
}));

jest.unstable_mockModule('fs', () => ({
	default: {
		existsSync: mockExistsSync
	},
	existsSync: mockExistsSync
}));

jest.unstable_mockModule('path', () => ({
	default: {
		join: (...paths) => paths.join('/'),
		sep: '/'
	},
	join: (...paths) => paths.join('/'),
	sep: '/'
}));

jest.unstable_mockModule('../../../../../scripts/modules/utils.js', () => ({
	readJSON: mockReadJSON,
	writeJSON: mockWriteJSON
}));

// Import the module under test after setting up mocks
const {
	readWorktreeState,
	writeWorktreeState,
	addWorktreeToState,
	removeWorktreeFromState,
	syncWorktreeState
} = await import(
	'../../../../../scripts/modules/utils/worktree-state-manager.js'
);

// Test data constants
const MOCK_PROJECT_ROOT = '/test/project';
const MOCK_STATE_PATH = '/test/project/.taskmaster/state.json';

const MOCK_EXISTING_STATE = {
	worktrees: {
		'task-123': {
			taskId: '123',
			branchName: 'task-123',
			worktreePath: '/test/project/worktrees/task-123',
			createdAt: '2024-01-01T10:00:00.000Z'
		},
		'task-456': {
			taskId: '456',
			branchName: 'task-456',
			worktreePath: '/test/project/worktrees/task-456',
			createdAt: '2024-01-01T11:00:00.000Z'
		}
	}
};

const MOCK_EMPTY_STATE = { worktrees: {} };

const MOCK_GIT_WORKTREE_LIST_OUTPUT = `worktree /test/project
HEAD 1234567890abcdef
branch refs/heads/main

worktree /test/project/worktrees/task-123
HEAD abcdef1234567890
branch refs/heads/task-123

worktree /test/project/worktrees/task-789
HEAD fedcba0987654321
branch refs/heads/task-789
`;

describe('worktree-state-manager', () => {
	beforeEach(() => {
		jest.clearAllMocks();

		// Reset to clean mocks with reasonable defaults
		mockReadJSON.mockReturnValue(
			JSON.parse(JSON.stringify(MOCK_EXISTING_STATE))
		);
		mockWriteJSON.mockImplementation(() => {});
		mockExistsSync.mockReturnValue(true);
		mockExec.mockImplementation((cmd, options, callback) => {
			callback(null, { stdout: MOCK_GIT_WORKTREE_LIST_OUTPUT });
		});
	});

	describe('readWorktreeState', () => {
		it('should read worktrees from existing state file', () => {
			const result = readWorktreeState(MOCK_PROJECT_ROOT);

			expect(mockReadJSON).toHaveBeenCalledWith(
				MOCK_STATE_PATH,
				MOCK_PROJECT_ROOT
			);
			expect(result).toEqual(MOCK_EXISTING_STATE.worktrees);
		});

		it('should return empty object if state file has no worktrees property', () => {
			mockReadJSON.mockReturnValue({ someOtherProperty: 'value' });

			const result = readWorktreeState(MOCK_PROJECT_ROOT);

			expect(result).toEqual({});
		});

		it('should return empty object if state file does not exist', () => {
			mockReadJSON.mockImplementation(() => {
				throw new Error('File not found');
			});

			const result = readWorktreeState(MOCK_PROJECT_ROOT);

			expect(result).toEqual({});
		});

		it('should return empty object if state file is corrupted', () => {
			mockReadJSON.mockImplementation(() => {
				throw new Error('JSON parse error');
			});

			const result = readWorktreeState(MOCK_PROJECT_ROOT);

			expect(result).toEqual({});
		});
	});

	describe('writeWorktreeState', () => {
		const mockWorktrees = {
			'task-789': {
				taskId: '789',
				branchName: 'task-789',
				worktreePath: '/test/project/worktrees/task-789',
				createdAt: '2024-01-01T12:00:00.000Z'
			}
		};

		it('should merge worktrees into existing state file', () => {
			writeWorktreeState(MOCK_PROJECT_ROOT, mockWorktrees);

			expect(mockReadJSON).toHaveBeenCalledWith(
				MOCK_STATE_PATH,
				MOCK_PROJECT_ROOT
			);
			expect(mockWriteJSON).toHaveBeenCalledWith(
				MOCK_STATE_PATH,
				{
					...MOCK_EXISTING_STATE,
					worktrees: mockWorktrees
				},
				MOCK_PROJECT_ROOT
			);
		});

		it('should create new state file if it does not exist', () => {
			mockReadJSON.mockImplementation(() => {
				throw new Error('File not found');
			});

			writeWorktreeState(MOCK_PROJECT_ROOT, mockWorktrees);

			expect(mockWriteJSON).toHaveBeenCalledWith(
				MOCK_STATE_PATH,
				{ worktrees: mockWorktrees },
				MOCK_PROJECT_ROOT
			);
		});

		it('should create new state file if existing file is corrupted', () => {
			mockReadJSON.mockImplementation(() => {
				throw new Error('JSON parse error');
			});

			writeWorktreeState(MOCK_PROJECT_ROOT, mockWorktrees);

			expect(mockWriteJSON).toHaveBeenCalledWith(
				MOCK_STATE_PATH,
				{ worktrees: mockWorktrees },
				MOCK_PROJECT_ROOT
			);
		});
	});

	describe('addWorktreeToState', () => {
		const mockWorktreeData = {
			worktreeTitle: 'task-999',
			taskId: '999',
			branchName: 'task-999',
			worktreePath: '/test/project/worktrees/task-999'
		};

		let dateISOMock;

		beforeEach(() => {
			// Mock Date.now() to have predictable timestamps
			dateISOMock = jest
				.spyOn(Date.prototype, 'toISOString')
				.mockReturnValue('2024-01-01T15:00:00.000Z');
		});

		afterEach(() => {
			if (dateISOMock) {
				dateISOMock.mockRestore();
			}
		});

		it('should add new worktree to existing state', () => {
			// Reset to fresh state for this test
			mockReadJSON.mockReturnValue(
				JSON.parse(JSON.stringify(MOCK_EXISTING_STATE))
			);

			addWorktreeToState(MOCK_PROJECT_ROOT, mockWorktreeData);

			expect(mockReadJSON).toHaveBeenCalledWith(
				MOCK_STATE_PATH,
				MOCK_PROJECT_ROOT
			);
			expect(mockWriteJSON).toHaveBeenCalledWith(
				MOCK_STATE_PATH,
				{
					...MOCK_EXISTING_STATE,
					worktrees: {
						...MOCK_EXISTING_STATE.worktrees,
						'task-999': {
							taskId: '999',
							branchName: 'task-999',
							worktreePath: '/test/project/worktrees/task-999',
							createdAt: '2024-01-01T15:00:00.000Z'
						}
					}
				},
				MOCK_PROJECT_ROOT
			);
		});

		it('should overwrite existing worktree with same title', () => {
			// Reset to fresh state for this test
			mockReadJSON.mockReturnValue(
				JSON.parse(JSON.stringify(MOCK_EXISTING_STATE))
			);

			const updatedWorktreeData = {
				worktreeTitle: 'task-123', // Existing worktree
				taskId: '123',
				branchName: 'task-123-updated',
				worktreePath: '/test/project/worktrees/task-123-new'
			};

			addWorktreeToState(MOCK_PROJECT_ROOT, updatedWorktreeData);

			expect(mockWriteJSON).toHaveBeenCalledWith(
				MOCK_STATE_PATH,
				{
					...MOCK_EXISTING_STATE,
					worktrees: {
						...MOCK_EXISTING_STATE.worktrees,
						'task-123': {
							taskId: '123',
							branchName: 'task-123-updated',
							worktreePath: '/test/project/worktrees/task-123-new',
							createdAt: '2024-01-01T15:00:00.000Z'
						}
					}
				},
				MOCK_PROJECT_ROOT
			);
		});

		it('should add worktree to empty state', () => {
			mockReadJSON.mockReturnValue(
				JSON.parse(JSON.stringify(MOCK_EMPTY_STATE))
			);

			addWorktreeToState(MOCK_PROJECT_ROOT, mockWorktreeData);

			expect(mockWriteJSON).toHaveBeenCalledWith(
				MOCK_STATE_PATH,
				{
					worktrees: {
						'task-999': {
							taskId: '999',
							branchName: 'task-999',
							worktreePath: '/test/project/worktrees/task-999',
							createdAt: '2024-01-01T15:00:00.000Z'
						}
					}
				},
				MOCK_PROJECT_ROOT
			);
		});
	});

	describe('removeWorktreeFromState', () => {
		it('should remove existing worktree from state', () => {
			// Reset to fresh state for this test
			mockReadJSON.mockReturnValue(
				JSON.parse(JSON.stringify(MOCK_EXISTING_STATE))
			);

			removeWorktreeFromState(MOCK_PROJECT_ROOT, 'task-123');

			expect(mockReadJSON).toHaveBeenCalledWith(
				MOCK_STATE_PATH,
				MOCK_PROJECT_ROOT
			);
			expect(mockWriteJSON).toHaveBeenCalledWith(
				MOCK_STATE_PATH,
				{
					...MOCK_EXISTING_STATE,
					worktrees: {
						'task-456': MOCK_EXISTING_STATE.worktrees['task-456']
						// task-123 should be removed
					}
				},
				MOCK_PROJECT_ROOT
			);
		});

		it('should handle removal of non-existent worktree gracefully', () => {
			// Reset to fresh state for this test
			mockReadJSON.mockReturnValue(
				JSON.parse(JSON.stringify(MOCK_EXISTING_STATE))
			);

			removeWorktreeFromState(MOCK_PROJECT_ROOT, 'task-nonexistent');

			expect(mockWriteJSON).toHaveBeenCalledWith(
				MOCK_STATE_PATH,
				{
					...MOCK_EXISTING_STATE,
					worktrees: MOCK_EXISTING_STATE.worktrees // Unchanged
				},
				MOCK_PROJECT_ROOT
			);
		});

		it('should handle empty state gracefully', () => {
			mockReadJSON.mockReturnValue(
				JSON.parse(JSON.stringify(MOCK_EMPTY_STATE))
			);

			removeWorktreeFromState(MOCK_PROJECT_ROOT, 'task-123');

			expect(mockWriteJSON).toHaveBeenCalledWith(
				MOCK_STATE_PATH,
				{ worktrees: {} },
				MOCK_PROJECT_ROOT
			);
		});
	});

	describe('syncWorktreeState', () => {
		const mockLogger = {
			info: jest.fn(),
			warn: jest.fn(),
			error: jest.fn()
		};

		beforeEach(() => {
			// Clear logger mocks
			mockLogger.info.mockClear();
			mockLogger.warn.mockClear();
			mockLogger.error.mockClear();

			// Default: all worktrees exist both in git and filesystem
			mockExistsSync.mockImplementation((path) => {
				return path.includes('/test/project/worktrees/');
			});
		});

		it('should remove stale entries that do not exist in git worktrees', async () => {
			// Reset to fresh state for this test
			mockReadJSON.mockReturnValue(
				JSON.parse(JSON.stringify(MOCK_EXISTING_STATE))
			);

			// Git only has task-123 and task-789, but state has task-123 and task-456
			await syncWorktreeState(MOCK_PROJECT_ROOT, { mcpLog: mockLogger });

			expect(mockExec).toHaveBeenCalledWith(
				'git worktree list --porcelain',
				{ cwd: MOCK_PROJECT_ROOT },
				expect.any(Function)
			);

			// task-456 should be removed because it's not in git output
			expect(mockWriteJSON).toHaveBeenCalledWith(
				MOCK_STATE_PATH,
				{
					...MOCK_EXISTING_STATE,
					worktrees: {
						'task-123': MOCK_EXISTING_STATE.worktrees['task-123']
						// task-456 removed as stale
					}
				},
				MOCK_PROJECT_ROOT
			);

			expect(mockLogger.info).toHaveBeenCalledWith(
				'Removing stale entry: task-456'
			);
			expect(mockLogger.info).toHaveBeenCalledWith(
				'Cleaned up 1 stale worktree entries'
			);
		});

		it('should remove entries where filesystem path does not exist', async () => {
			// Reset to fresh state for this test
			mockReadJSON.mockReturnValue(
				JSON.parse(JSON.stringify(MOCK_EXISTING_STATE))
			);

			// Mock filesystem to show task-123 path doesn't exist, but task-456 exists
			mockExistsSync.mockImplementation((path) => {
				return path.includes('task-456'); // Only task-456 exists
			});

			// Mock git output to include task-456 (so it's not stale due to git)
			const gitOutputWithTask456 = `worktree /test/project
HEAD 1234567890abcdef
branch refs/heads/main

worktree /test/project/worktrees/task-456
HEAD fedcba0987654321
branch refs/heads/task-456
`;
			mockExec.mockImplementation((cmd, options, callback) => {
				callback(null, { stdout: gitOutputWithTask456 });
			});

			await syncWorktreeState(MOCK_PROJECT_ROOT, { mcpLog: mockLogger });

			// Only task-123 should be removed because filesystem path doesn't exist
			// task-456 should remain because it exists in both filesystem and git
			expect(mockWriteJSON).toHaveBeenCalledWith(
				MOCK_STATE_PATH,
				{
					...MOCK_EXISTING_STATE,
					worktrees: {
						'task-456': MOCK_EXISTING_STATE.worktrees['task-456']
						// task-123 removed due to missing filesystem path
					}
				},
				MOCK_PROJECT_ROOT
			);
		});

		it('should handle legacy state entries with "path" field instead of "worktreePath"', async () => {
			const legacyState = {
				worktrees: {
					'task-legacy': {
						taskId: 'legacy',
						branchName: 'task-legacy',
						path: '/test/project/worktrees/task-legacy', // Old field name
						createdAt: '2024-01-01T10:00:00.000Z'
					}
				}
			};
			mockReadJSON.mockReturnValue(legacyState);
			mockExistsSync.mockReturnValue(false); // Path doesn't exist

			await syncWorktreeState(MOCK_PROJECT_ROOT, { mcpLog: mockLogger });

			// Legacy entry should be cleaned up
			expect(mockWriteJSON).toHaveBeenCalledWith(
				MOCK_STATE_PATH,
				{ worktrees: {} },
				MOCK_PROJECT_ROOT
			);
		});

		it('should do nothing if all entries are valid', async () => {
			// Reset to fresh state for this test
			mockReadJSON.mockReturnValue(
				JSON.parse(JSON.stringify(MOCK_EXISTING_STATE))
			);

			// Mock git output to include both existing worktrees
			const validGitOutput = `worktree /test/project
HEAD 1234567890abcdef
branch refs/heads/main

worktree /test/project/worktrees/task-123
HEAD abcdef1234567890
branch refs/heads/task-123

worktree /test/project/worktrees/task-456
HEAD fedcba0987654321
branch refs/heads/task-456
`;
			mockExec.mockImplementation((cmd, options, callback) => {
				callback(null, { stdout: validGitOutput });
			});

			await syncWorktreeState(MOCK_PROJECT_ROOT, { mcpLog: mockLogger });

			// No writeJSON should be called since no changes needed
			expect(mockWriteJSON).not.toHaveBeenCalled();
			expect(mockLogger.info).not.toHaveBeenCalledWith(
				expect.stringMatching(/Removing stale entry/)
			);
		});

		it('should handle git command failure gracefully', async () => {
			mockExec.mockImplementation((cmd, options, callback) => {
				callback(new Error('Git command failed'));
			});

			await syncWorktreeState(MOCK_PROJECT_ROOT, { mcpLog: mockLogger });

			expect(mockLogger.warn).toHaveBeenCalledWith(
				'Worktree sync failed: Git command failed'
			);
			expect(mockWriteJSON).not.toHaveBeenCalled();
		});

		it('should work without logger provided', async () => {
			// Should not throw when no logger provided
			await syncWorktreeState(MOCK_PROJECT_ROOT);

			expect(mockExec).toHaveBeenCalled();
			// Should complete successfully even without logging
		});

		it('should handle empty git output', async () => {
			// Reset to fresh state for this test
			mockReadJSON.mockReturnValue(
				JSON.parse(JSON.stringify(MOCK_EXISTING_STATE))
			);

			mockExec.mockImplementation((cmd, options, callback) => {
				callback(null, { stdout: '' });
			});

			await syncWorktreeState(MOCK_PROJECT_ROOT, { mcpLog: mockLogger });

			// All entries should be removed since git shows no worktrees
			expect(mockWriteJSON).toHaveBeenCalledWith(
				MOCK_STATE_PATH,
				{
					...MOCK_EXISTING_STATE,
					worktrees: {}
				},
				MOCK_PROJECT_ROOT
			);
		});

		it('should parse git porcelain output correctly', async () => {
			const complexGitOutput = `worktree /test/project
HEAD 1234567890abcdef
branch refs/heads/main

worktree /test/project/worktrees/task-123
HEAD abcdef1234567890
branch refs/heads/task-123
detached

worktree /test/project/worktrees/task-999
HEAD fedcba0987654321
bare
`;
			mockExec.mockImplementation((cmd, options, callback) => {
				callback(null, { stdout: complexGitOutput });
			});

			// State only has task-123, but git shows task-123 and task-999
			const stateWithOnlyTask123 = {
				worktrees: {
					'task-123': MOCK_EXISTING_STATE.worktrees['task-123']
				}
			};
			mockReadJSON.mockReturnValue(stateWithOnlyTask123);

			await syncWorktreeState(MOCK_PROJECT_ROOT, { mcpLog: mockLogger });

			// No changes should be made since task-123 exists in git
			expect(mockWriteJSON).not.toHaveBeenCalled();
		});
	});
});
