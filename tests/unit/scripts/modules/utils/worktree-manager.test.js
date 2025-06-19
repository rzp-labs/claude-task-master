/**
 * worktree-manager.test.js
 * Unit tests for worktree-manager functions using focused hybrid mocking strategy
 *
 * Strategy: Mock external dependencies (Git, fs, config, state) but test our integration logic
 * Value: Regression protection, environment-independent execution, edge case coverage
 */

import { jest } from '@jest/globals';

// Mock all external dependencies using jest.unstable_mockModule
const mockExec = jest.fn();
const mockExistsSync = jest.fn();
const mockMkdirSync = jest.fn();
const mockIsWorktreesEnabled = jest.fn(() => true);
const mockAddWorktreeToState = jest.fn();
const mockRemoveWorktreeFromState = jest.fn();
const mockSyncWorktreeState = jest.fn();

jest.unstable_mockModule('child_process', () => ({
	exec: mockExec,
	execSync: jest.fn()
}));

jest.unstable_mockModule('fs', () => ({
	default: {
		existsSync: mockExistsSync,
		mkdirSync: mockMkdirSync
	},
	existsSync: mockExistsSync,
	mkdirSync: mockMkdirSync
}));

jest.unstable_mockModule('path', () => ({
	default: {
		join: (...paths) => paths.join('/'),
		resolve: (...paths) => paths.join('/'),
		sep: '/'
	},
	join: (...paths) => paths.join('/'),
	resolve: (...paths) => paths.join('/'),
	sep: '/'
}));

jest.unstable_mockModule(
	'../../../../../scripts/modules/config-manager.js',
	() => ({
		isWorktreesEnabled: mockIsWorktreesEnabled,
		getDebugFlag: jest.fn(() => false),
		getLogLevel: jest.fn(() => 'info')
	})
);

jest.unstable_mockModule(
	'../../../../../scripts/modules/utils/worktree-state-manager.js',
	() => ({
		addWorktreeToState: mockAddWorktreeToState,
		removeWorktreeFromState: mockRemoveWorktreeFromState,
		syncWorktreeState: mockSyncWorktreeState
	})
);

jest.unstable_mockModule('../../../../../src/constants/paths.js', () => ({
	WORKTREES_DIR: 'worktrees',
	WORKTREE_PREFIX: 'task-',
	COMPLEXITY_REPORT_FILE: 'complexity-report.json',
	LEGACY_COMPLEXITY_REPORT_FILE: 'legacy-complexity-report.json',
	LEGACY_CONFIG_FILE: 'legacy-config.json'
}));

// Import the module under test after setting up mocks
const {
	getWorktreeTitle,
	createWorktree,
	removeWorktree,
	removeWorktreeAndBranch,
	listWorktrees,
	worktreeEvents
} = await import('../../../../../scripts/modules/utils/worktree-manager.js');

// Test data constants
const MOCK_PROJECT_ROOT = '/test/project';
const MOCK_TASK_ID = '123';
const MOCK_WORKTREE_PATH = '/test/project/worktrees/task-123';
const MOCK_BRANCH_NAME = 'task-123';

// Realistic Git command outputs
const MOCK_GIT_WORKTREE_LIST_OUTPUT = `worktree /test/project
HEAD 1234567890abcdef
branch refs/heads/main

worktree /test/project/worktrees/task-123
HEAD abcdef1234567890
branch refs/heads/task-123

worktree /test/project/worktrees/task-456
HEAD fedcba0987654321
branch refs/heads/task-456
`;

const MOCK_GIT_SUCCESS_OUTPUT = {
	stdout:
		"Preparing worktree (new branch 'task-123')\nHEAD is now at 1234567 Initial commit",
	stderr: ''
};

const MOCK_GIT_ERROR_ALREADY_EXISTS = new Error(
	'Command failed: git worktree add'
);
MOCK_GIT_ERROR_ALREADY_EXISTS.stderr =
	"fatal: 'task-123' is already checked out at '/test/project/worktrees/task-123'";

const MOCK_GIT_ERROR_UNCOMMITTED = new Error(
	"fatal: '/test/project/worktrees/task-123' contains modified or untracked files, use --force to delete it"
);
MOCK_GIT_ERROR_UNCOMMITTED.stderr =
	"fatal: '/test/project/worktrees/task-123' contains modified or untracked files, use --force to delete it";

describe('worktree-manager', () => {
	beforeEach(() => {
		jest.clearAllMocks();

		// Setup default mock behaviors
		mockIsWorktreesEnabled.mockReturnValue(true);
		mockExistsSync.mockReturnValue(false);
		mockMkdirSync.mockImplementation(() => {});
		mockAddWorktreeToState.mockImplementation(() => {});
		mockRemoveWorktreeFromState.mockImplementation(() => {});
		mockSyncWorktreeState.mockResolvedValue();
		mockExec.mockImplementation((cmd, options, callback) => {
			callback(null, MOCK_GIT_SUCCESS_OUTPUT);
		});
	});

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

	describe('createWorktree', () => {
		beforeEach(() => {
			mockExec.mockImplementation((cmd, options, callback) => {
				callback(null, MOCK_GIT_SUCCESS_OUTPUT);
			});
		});

		describe('input validation', () => {
			it('should throw error when projectRoot is missing', async () => {
				await expect(createWorktree(null, MOCK_TASK_ID)).rejects.toThrow(
					'projectRoot is required for createWorktree'
				);
			});

			it('should throw error when taskId is missing', async () => {
				await expect(createWorktree(MOCK_PROJECT_ROOT, null)).rejects.toThrow(
					'taskId is required for createWorktree'
				);
			});

			it('should throw error when taskId is empty string', async () => {
				await expect(createWorktree(MOCK_PROJECT_ROOT, '')).rejects.toThrow(
					'taskId is required for createWorktree'
				);
			});
		});

		describe('feature toggle enforcement', () => {
			it('should throw error when worktrees feature is disabled', async () => {
				mockIsWorktreesEnabled.mockReturnValue(false);

				await expect(
					createWorktree(MOCK_PROJECT_ROOT, MOCK_TASK_ID)
				).rejects.toThrow(
					'Worktrees are disabled. Enable in config with features.worktrees: true'
				);

				expect(mockIsWorktreesEnabled).toHaveBeenCalledWith(MOCK_PROJECT_ROOT);
			});

			it('should proceed when worktrees feature is enabled', async () => {
				mockIsWorktreesEnabled.mockReturnValue(true);

				const result = await createWorktree(MOCK_PROJECT_ROOT, MOCK_TASK_ID);

				expect(result.success).toBe(true);
				expect(mockIsWorktreesEnabled).toHaveBeenCalledWith(MOCK_PROJECT_ROOT);
			});
		});

		describe('directory management', () => {
			it('should create worktrees directory if it does not exist', async () => {
				mockExistsSync.mockReturnValue(false);

				await createWorktree(MOCK_PROJECT_ROOT, MOCK_TASK_ID);

				expect(mockExistsSync).toHaveBeenCalledWith('/test/project/worktrees');
				expect(mockMkdirSync).toHaveBeenCalledWith('/test/project/worktrees', {
					recursive: true
				});
			});

			it('should not create directory if it already exists', async () => {
				mockExistsSync.mockReturnValue(true);

				await createWorktree(MOCK_PROJECT_ROOT, MOCK_TASK_ID);

				expect(mockExistsSync).toHaveBeenCalledWith('/test/project/worktrees');
				expect(mockMkdirSync).not.toHaveBeenCalled();
			});
		});

		describe('git command construction', () => {
			it('should construct correct command for new branch creation', async () => {
				// Mock branch doesn't exist (git show-ref fails)
				mockExec.mockImplementation((cmd, options, callback) => {
					if (cmd.includes('show-ref')) {
						callback(new Error('ref not found'));
					} else {
						callback(null, MOCK_GIT_SUCCESS_OUTPUT);
					}
				});

				await createWorktree(MOCK_PROJECT_ROOT, MOCK_TASK_ID, 'main');

				// Should call git worktree add with -b flag for new branch
				expect(mockExec).toHaveBeenCalledWith(
					expect.stringContaining('git worktree add -b task-123'),
					expect.objectContaining({ cwd: MOCK_PROJECT_ROOT }),
					expect.any(Function)
				);
			});

			it('should construct correct command for existing branch', async () => {
				// Mock branch exists (git show-ref succeeds)
				mockExec.mockImplementation((cmd, options, callback) => {
					if (cmd.includes('show-ref')) {
						callback(null, { stdout: 'ref exists' });
					} else {
						callback(null, MOCK_GIT_SUCCESS_OUTPUT);
					}
				});

				await createWorktree(MOCK_PROJECT_ROOT, MOCK_TASK_ID);

				// Should call git worktree add without -b flag
				expect(mockExec).toHaveBeenCalledWith(
					expect.stringContaining(
						'git worktree add /test/project/worktrees/task-123 task-123'
					),
					expect.objectContaining({ cwd: MOCK_PROJECT_ROOT }),
					expect.any(Function)
				);
			});

			it('should use custom base branch when specified', async () => {
				mockExec.mockImplementation((cmd, options, callback) => {
					if (cmd.includes('show-ref')) {
						callback(new Error('ref not found'));
					} else {
						callback(null, MOCK_GIT_SUCCESS_OUTPUT);
					}
				});

				await createWorktree(MOCK_PROJECT_ROOT, MOCK_TASK_ID, 'develop');

				expect(mockExec).toHaveBeenCalledWith(
					expect.stringContaining('develop'),
					expect.objectContaining({ cwd: MOCK_PROJECT_ROOT }),
					expect.any(Function)
				);
			});
		});

		describe('error handling', () => {
			it('should handle git command failures gracefully', async () => {
				mockExec.mockImplementation((cmd, options, callback) => {
					if (cmd.includes('show-ref')) {
						callback(new Error('ref not found'));
					} else {
						callback(MOCK_GIT_ERROR_ALREADY_EXISTS);
					}
				});

				await expect(
					createWorktree(MOCK_PROJECT_ROOT, MOCK_TASK_ID)
				).rejects.toThrow(
					"Error creating worktree: fatal: 'task-123' is already checked out at '/test/project/worktrees/task-123'"
				);
			});

			it('should clean up git error messages', async () => {
				const errorWithCommandPrefix = new Error(
					'Command failed: git worktree add\nfatal: some git error'
				);
				errorWithCommandPrefix.stderr = 'fatal: some git error';

				mockExec.mockImplementation((cmd, options, callback) => {
					if (cmd.includes('show-ref')) {
						callback(new Error('ref not found'));
					} else {
						callback(errorWithCommandPrefix);
					}
				});

				await expect(
					createWorktree(MOCK_PROJECT_ROOT, MOCK_TASK_ID)
				).rejects.toThrow('Error creating worktree: fatal: some git error');
			});
		});

		describe('state management integration', () => {
			it('should add worktree to state after successful creation', async () => {
				const result = await createWorktree(MOCK_PROJECT_ROOT, MOCK_TASK_ID);

				expect(mockAddWorktreeToState).toHaveBeenCalledWith(MOCK_PROJECT_ROOT, {
					worktreeTitle: 'task-123',
					taskId: '123',
					branchName: 'task-123',
					worktreePath: '/test/project/worktrees/task-123'
				});
				expect(result.success).toBe(true);
			});

			it('should continue operation if state management fails', async () => {
				mockAddWorktreeToState.mockImplementationOnce(() => {
					throw new Error('State error');
				});

				const result = await createWorktree(MOCK_PROJECT_ROOT, MOCK_TASK_ID);

				expect(result.success).toBe(true);
				expect(mockAddWorktreeToState).toHaveBeenCalled();
			});
		});

		describe('event emission', () => {
			it('should emit worktree.created event with correct data', async () => {
				const eventSpy = jest.fn();
				worktreeEvents.on('worktree.created', eventSpy);

				await createWorktree(MOCK_PROJECT_ROOT, MOCK_TASK_ID, 'main');

				expect(eventSpy).toHaveBeenCalledWith({
					taskId: '123',
					path: '/test/project/worktrees/task-123',
					branch: 'task-123',
					baseBranch: 'main',
					worktreeTitle: 'task-123'
				});

				worktreeEvents.off('worktree.created', eventSpy);
			});
		});

		describe('return value structure', () => {
			it('should return correct success object', async () => {
				const result = await createWorktree(
					MOCK_PROJECT_ROOT,
					MOCK_TASK_ID,
					'main'
				);

				expect(result).toEqual({
					success: true,
					taskId: '123',
					worktreePath: '/test/project/worktrees/task-123',
					branchName: 'task-123',
					baseBranch: 'main',
					output: MOCK_GIT_SUCCESS_OUTPUT.stdout
				});
			});
		});

		describe('options handling', () => {
			it('should handle mcpLog option when provided', async () => {
				const mockLogger = {
					info: jest.fn(),
					warn: jest.fn(),
					error: jest.fn()
				};

				await createWorktree(MOCK_PROJECT_ROOT, MOCK_TASK_ID, 'main', {
					mcpLog: mockLogger
				});

				expect(mockLogger.info).toHaveBeenCalled();
			});

			it('should handle missing mcpLog option gracefully', async () => {
				// Should not throw error when no logger provided
				const result = await createWorktree(MOCK_PROJECT_ROOT, MOCK_TASK_ID);
				expect(result.success).toBe(true);
			});
		});
	});

	// Additional test suites for other functions would follow the same pattern...
	// For brevity, I'll implement a few key tests for removeWorktree and listWorktrees

	describe('removeWorktree', () => {
		beforeEach(() => {
			mockExec.mockImplementation((cmd, options, callback) => {
				callback(null, { stdout: 'worktree removed' });
			});
			mockExistsSync.mockReturnValue(true);
		});

		describe('input validation', () => {
			it('should throw error when projectRoot is missing', async () => {
				await expect(removeWorktree(null, 'task-123')).rejects.toThrow(
					'projectRoot is required for removeWorktree'
				);
			});

			it('should throw error when worktreeTitle is missing', async () => {
				await expect(removeWorktree(MOCK_PROJECT_ROOT, null)).rejects.toThrow(
					'worktreeTitle is required for removeWorktree'
				);
			});
		});

		describe('feature toggle enforcement', () => {
			it('should throw error when worktrees feature is disabled', async () => {
				mockIsWorktreesEnabled.mockReturnValue(false);

				await expect(
					removeWorktree(MOCK_PROJECT_ROOT, 'task-123')
				).rejects.toThrow('Worktrees are disabled');
			});
		});

		describe('safety checks', () => {
			it('should throw error if worktree does not exist', async () => {
				mockExistsSync.mockReturnValue(false);

				await expect(
					removeWorktree(MOCK_PROJECT_ROOT, 'task-123')
				).rejects.toThrow('task-123 does not exist');
			});

			it('should prevent removal when inside the worktree directory', async () => {
				// Mock process.cwd() to be inside the worktree
				const originalCwd = process.cwd;
				process.cwd = jest.fn(
					() => '/test/project/worktrees/task-123/some/subdir'
				);

				await expect(
					removeWorktree(MOCK_PROJECT_ROOT, 'task-123')
				).rejects.toThrow(
					'Cannot remove worktree while inside it. You are currently in: /test/project/worktrees/task-123/some/subdir. Please navigate out first: cd /test/project'
				);

				// Restore original cwd
				process.cwd = originalCwd;
			});

			it('should provide helpful error when worktree not found but user appears to be in worktree', async () => {
				mockExistsSync.mockReturnValue(false);

				// Mock process.cwd() to be in a worktree directory (but not the target one)
				const originalCwd = process.cwd;
				process.cwd = jest.fn(
					() => '/test/project/worktrees/other-task/subdir'
				);

				await expect(
					removeWorktree(MOCK_PROJECT_ROOT, 'task-123')
				).rejects.toThrow(
					"Cannot find worktree 'task-123'. Note: you appear to be inside a worktree. Try running from the main project directory."
				);

				// Restore original cwd
				process.cwd = originalCwd;
			});
		});

		describe('git command execution', () => {
			it('should execute git worktree remove command', async () => {
				await removeWorktree(MOCK_PROJECT_ROOT, 'task-123');

				expect(mockExec).toHaveBeenCalledWith(
					'git worktree remove /test/project/worktrees/task-123',
					{ cwd: MOCK_PROJECT_ROOT },
					expect.any(Function)
				);
			});

			it('should handle uncommitted changes without force', async () => {
				mockExec.mockImplementation((cmd, options, callback) => {
					callback(MOCK_GIT_ERROR_UNCOMMITTED);
				});

				await expect(
					removeWorktree(MOCK_PROJECT_ROOT, 'task-123')
				).rejects.toThrow(
					'task-123 has uncommitted changes. Please commit or stash changes before removing or try again with --force'
				);
			});

			it('should use force flag when provided', async () => {
				mockExec.mockImplementation((cmd, options, callback) => {
					if (cmd.includes('--force')) {
						callback(null, { stdout: 'worktree removed' });
					} else {
						callback(MOCK_GIT_ERROR_UNCOMMITTED);
					}
				});

				const result = await removeWorktree(MOCK_PROJECT_ROOT, 'task-123', {
					force: true
				});

				expect(result.success).toBe(true);
				expect(mockExec).toHaveBeenCalledWith(
					'git worktree remove --force /test/project/worktrees/task-123',
					{ cwd: MOCK_PROJECT_ROOT },
					expect.any(Function)
				);
			});

			it('should show confirmation dialog when force removing with uncommitted changes', async () => {
				mockExec.mockImplementation((cmd, options, callback) => {
					if (cmd.includes('--force')) {
						callback(null, { stdout: 'worktree removed' });
					} else {
						callback(MOCK_GIT_ERROR_UNCOMMITTED);
					}
				});

				const mockConfirm = jest.fn().mockResolvedValue(true);

				const result = await removeWorktree(MOCK_PROJECT_ROOT, 'task-123', {
					force: true,
					confirm: mockConfirm
				});

				expect(mockConfirm).toHaveBeenCalledWith(
					'task-123 contains uncommitted changes that will be PERMANENTLY LOST. Continue? (y/N)'
				);
				expect(result.success).toBe(true);
			});

			it('should cancel operation when user declines confirmation dialog', async () => {
				mockExec.mockImplementation((cmd, options, callback) => {
					if (cmd.includes('--force')) {
						callback(null, { stdout: 'worktree removed' });
					} else {
						callback(MOCK_GIT_ERROR_UNCOMMITTED);
					}
				});

				const mockConfirm = jest.fn().mockResolvedValue(false);

				const result = await removeWorktree(MOCK_PROJECT_ROOT, 'task-123', {
					force: true,
					confirm: mockConfirm
				});

				expect(mockConfirm).toHaveBeenCalledWith(
					'task-123 contains uncommitted changes that will be PERMANENTLY LOST. Continue? (y/N)'
				);
				expect(result).toEqual({
					success: false,
					worktreeTitle: 'task-123',
					worktreePath: '/test/project/worktrees/task-123',
					branchName: 'task-123',
					cancelled: true
				});

				// Should not proceed with force removal
				expect(mockExec).not.toHaveBeenCalledWith(
					expect.stringContaining('--force'),
					expect.any(Object),
					expect.any(Function)
				);
			});
		});

		describe('registry and state management', () => {
			it('should handle registry sync failure gracefully', async () => {
				const mockLogger = {
					info: jest.fn(),
					warn: jest.fn(),
					error: jest.fn()
				};

				// Mock syncWorktreeState to fail
				mockSyncWorktreeState.mockRejectedValueOnce(
					new Error('Registry sync failed')
				);

				const result = await removeWorktree(MOCK_PROJECT_ROOT, 'task-123', {
					mcpLog: mockLogger
				});

				// Should continue operation despite sync failure
				expect(result.success).toBe(true);
				expect(mockLogger.warn).toHaveBeenCalledWith(
					'Registry sync failed: Registry sync failed'
				);

				// Should still attempt worktree removal
				expect(mockExec).toHaveBeenCalledWith(
					'git worktree remove /test/project/worktrees/task-123',
					{ cwd: MOCK_PROJECT_ROOT },
					expect.any(Function)
				);
			});

			it('should handle registry cleanup failure gracefully', async () => {
				const mockLogger = {
					info: jest.fn(),
					warn: jest.fn(),
					error: jest.fn()
				};

				// Mock removeWorktreeFromState to fail
				mockRemoveWorktreeFromState.mockImplementationOnce(() => {
					throw new Error('Registry cleanup failed');
				});

				const result = await removeWorktree(MOCK_PROJECT_ROOT, 'task-123', {
					mcpLog: mockLogger
				});

				// Should still succeed overall despite registry cleanup failure
				expect(result.success).toBe(true);
				expect(mockLogger.warn).toHaveBeenCalledWith(
					'Failed to remove worktree from registry: Registry cleanup failed'
				);

				// Should have completed the git operation
				expect(mockExec).toHaveBeenCalledWith(
					'git worktree remove /test/project/worktrees/task-123',
					{ cwd: MOCK_PROJECT_ROOT },
					expect.any(Function)
				);
			});

			it('should handle non-uncommitted git errors properly', async () => {
				const mockLogger = {
					info: jest.fn(),
					warn: jest.fn(),
					error: jest.fn()
				};

				// Mock git error that's NOT about uncommitted changes
				const gitError = new Error(
					'Git worktree remove failed for other reason'
				);
				gitError.stderr = 'fatal: some other git error';

				mockExec.mockImplementation((cmd, options, callback) => {
					if (cmd.includes('git worktree remove')) {
						callback(gitError);
					} else {
						callback(null, { stdout: 'success' });
					}
				});

				await expect(
					removeWorktree(MOCK_PROJECT_ROOT, 'task-123', { mcpLog: mockLogger })
				).rejects.toThrow('Git worktree remove failed for other reason');

				// Should have attempted the operation
				expect(mockExec).toHaveBeenCalledWith(
					'git worktree remove /test/project/worktrees/task-123',
					{ cwd: MOCK_PROJECT_ROOT },
					expect.any(Function)
				);
			});
		});

		describe('event emission', () => {
			it('should emit worktree.removed event with correct data', async () => {
				const eventSpy = jest.fn();
				worktreeEvents.on('worktree.removed', eventSpy);

				await removeWorktree(MOCK_PROJECT_ROOT, 'task-123');

				expect(eventSpy).toHaveBeenCalledWith({
					taskId: '123',
					path: '/test/project/worktrees/task-123',
					branch: 'task-123',
					worktreeTitle: 'task-123',
					branchRemoved: false
				});

				worktreeEvents.off('worktree.removed', eventSpy);
			});
		});
	});

	describe('removeWorktreeAndBranch', () => {
		beforeEach(() => {
			// Default mocks for successful operations
			mockExec.mockImplementation((cmd, options, callback) => {
				if (cmd.includes('git status --porcelain')) {
					// Clean working directory
					callback(null, { stdout: '' });
				} else if (cmd.includes('git merge-base')) {
					// Same commit (no unmerged changes)
					callback(null, { stdout: 'abc123\n' });
				} else if (cmd.includes('git rev-parse')) {
					// Same commit (no unmerged changes)
					callback(null, { stdout: 'abc123\n' });
				} else if (cmd.includes('git worktree remove')) {
					callback(null, { stdout: 'worktree removed' });
				} else if (cmd.includes('git branch -d')) {
					callback(null, { stdout: 'branch deleted' });
				} else {
					callback(null, { stdout: 'success' });
				}
			});
			mockExistsSync.mockReturnValue(true);
		});

		describe('input validation', () => {
			it('should throw error when projectRoot is missing', async () => {
				await expect(removeWorktreeAndBranch(null, 'task-123')).rejects.toThrow(
					'projectRoot is required for removeWorktreeAndBranch'
				);
			});

			it('should throw error when worktreeTitle is missing', async () => {
				await expect(
					removeWorktreeAndBranch(MOCK_PROJECT_ROOT, null)
				).rejects.toThrow(
					'worktreeTitle is required for removeWorktreeAndBranch'
				);
			});
		});

		describe('feature toggle enforcement', () => {
			it('should throw error when worktrees feature is disabled', async () => {
				mockIsWorktreesEnabled.mockReturnValue(false);

				await expect(
					removeWorktreeAndBranch(MOCK_PROJECT_ROOT, 'task-123')
				).rejects.toThrow('Worktrees are disabled');
			});
		});

		describe('force flag validation', () => {
			it('should throw error when force flag is provided', async () => {
				await expect(
					removeWorktreeAndBranch(MOCK_PROJECT_ROOT, 'task-123', {
						force: true
					})
				).rejects.toThrow('--force not supported for removeWorktreeAndBranch');
			});
		});

		describe('safety checks', () => {
			it('should throw error if worktree does not exist', async () => {
				mockExistsSync.mockReturnValue(false);

				await expect(
					removeWorktreeAndBranch(MOCK_PROJECT_ROOT, 'task-123')
				).rejects.toThrow('task-123 does not exist');
			});

			it('should prevent removal when inside the worktree directory', async () => {
				// Mock process.cwd() to be inside the worktree
				const originalCwd = process.cwd;
				process.cwd = jest.fn(
					() => '/test/project/worktrees/task-123/some/subdir'
				);

				await expect(
					removeWorktreeAndBranch(MOCK_PROJECT_ROOT, 'task-123')
				).rejects.toThrow(
					'Cannot remove worktree while inside it. You are currently in: /test/project/worktrees/task-123/some/subdir. Please navigate out first: cd /test/project'
				);

				// Restore original cwd
				process.cwd = originalCwd;
			});
		});

		describe('uncommitted changes detection', () => {
			it('should throw error when worktree has uncommitted changes', async () => {
				mockExec.mockImplementation((cmd, options, callback) => {
					if (cmd.includes('git status --porcelain')) {
						// Uncommitted changes detected
						callback(null, { stdout: 'M modified-file.js\nA new-file.js\n' });
					} else {
						callback(null, { stdout: 'success' });
					}
				});

				await expect(
					removeWorktreeAndBranch(MOCK_PROJECT_ROOT, 'task-123')
				).rejects.toThrow(
					'task-123 has uncommitted changes. Please commit or stash changes before removing'
				);
			});

			it('should handle git status command failures gracefully', async () => {
				mockExec.mockImplementation((cmd, options, callback) => {
					if (cmd.includes('git status --porcelain')) {
						callback(new Error('Git status failed'));
					} else {
						callback(null, { stdout: 'success' });
					}
				});

				// Should continue operation if status check fails for non-uncommitted reasons
				const result = await removeWorktreeAndBranch(
					MOCK_PROJECT_ROOT,
					'task-123'
				);
				expect(result.success).toBe(true);
			});
		});

		describe('unmerged branch changes detection', () => {
			it('should throw error when branch has unmerged changes', async () => {
				mockExec.mockImplementation((cmd, options, callback) => {
					if (cmd.includes('git status --porcelain')) {
						callback(null, { stdout: '' }); // Clean working directory
					} else if (cmd.includes('git merge-base')) {
						callback(null, { stdout: 'abc123\n' }); // Merge base commit
					} else if (cmd.includes('git rev-parse')) {
						callback(null, { stdout: 'def456\n' }); // Different branch commit
					} else {
						callback(null, { stdout: 'success' });
					}
				});

				await expect(
					removeWorktreeAndBranch(MOCK_PROJECT_ROOT, 'task-123')
				).rejects.toThrow(
					'Branch task-123 has unmerged changes. Please merge, rebase, or stash changes then try again'
				);
			});

			it('should handle git merge-base command failures gracefully', async () => {
				mockExec.mockImplementation((cmd, options, callback) => {
					if (cmd.includes('git status --porcelain')) {
						callback(null, { stdout: '' });
					} else if (cmd.includes('git merge-base')) {
						callback(new Error('Merge base check failed'));
					} else {
						callback(null, { stdout: 'success' });
					}
				});

				// Should continue operation if merge check fails for non-unmerged reasons
				const result = await removeWorktreeAndBranch(
					MOCK_PROJECT_ROOT,
					'task-123'
				);
				expect(result.success).toBe(true);
			});
		});

		describe('successful removal', () => {
			it('should successfully remove worktree and branch when all checks pass', async () => {
				const result = await removeWorktreeAndBranch(
					MOCK_PROJECT_ROOT,
					'task-123'
				);

				expect(result).toEqual({
					success: true,
					worktreeTitle: 'task-123',
					worktreePath: '/test/project/worktrees/task-123',
					branchName: 'task-123',
					branchRemoved: true
				});

				// Verify git commands were called in correct order
				expect(mockExec).toHaveBeenCalledWith(
					'git status --porcelain',
					{ cwd: '/test/project/worktrees/task-123' },
					expect.any(Function)
				);
				expect(mockExec).toHaveBeenCalledWith(
					'git worktree remove /test/project/worktrees/task-123',
					{ cwd: MOCK_PROJECT_ROOT },
					expect.any(Function)
				);
				expect(mockExec).toHaveBeenCalledWith(
					'git branch -d task-123',
					{ cwd: MOCK_PROJECT_ROOT },
					expect.any(Function)
				);
			});

			it('should remove from state registry after successful git operations', async () => {
				await removeWorktreeAndBranch(MOCK_PROJECT_ROOT, 'task-123');

				expect(mockRemoveWorktreeFromState).toHaveBeenCalledWith(
					MOCK_PROJECT_ROOT,
					'task-123'
				);
			});

			it('should continue operation if state registry removal fails', async () => {
				mockRemoveWorktreeFromState.mockImplementationOnce(() => {
					throw new Error('Registry error');
				});

				const result = await removeWorktreeAndBranch(
					MOCK_PROJECT_ROOT,
					'task-123'
				);
				expect(result.success).toBe(true);
			});
		});

		describe('event emission', () => {
			it('should emit worktree.removed event with branchRemoved: true', async () => {
				const eventSpy = jest.fn();
				worktreeEvents.on('worktree.removed', eventSpy);

				await removeWorktreeAndBranch(MOCK_PROJECT_ROOT, 'task-123');

				expect(eventSpy).toHaveBeenCalledWith({
					taskId: '123',
					path: '/test/project/worktrees/task-123',
					branch: 'task-123',
					worktreeTitle: 'task-123',
					branchRemoved: true
				});

				worktreeEvents.off('worktree.removed', eventSpy);
			});
		});

		describe('logging integration', () => {
			it('should handle mcpLog option when provided', async () => {
				const mockLogger = {
					info: jest.fn(),
					warn: jest.fn(),
					error: jest.fn()
				};

				await removeWorktreeAndBranch(MOCK_PROJECT_ROOT, 'task-123', {
					mcpLog: mockLogger
				});

				expect(mockLogger.info).toHaveBeenCalled();
			});

			it('should handle missing mcpLog option gracefully', async () => {
				// Should not throw error when no logger provided
				const result = await removeWorktreeAndBranch(
					MOCK_PROJECT_ROOT,
					'task-123'
				);
				expect(result.success).toBe(true);
			});
		});

		describe('git command error handling', () => {
			it('should handle worktree removal failures', async () => {
				mockExec.mockImplementation((cmd, options, callback) => {
					if (cmd.includes('git status --porcelain')) {
						callback(null, { stdout: '' });
					} else if (cmd.includes('git worktree remove')) {
						callback(new Error('Worktree removal failed'));
					} else {
						callback(null, { stdout: 'success' });
					}
				});

				await expect(
					removeWorktreeAndBranch(MOCK_PROJECT_ROOT, 'task-123')
				).rejects.toThrow('Worktree removal failed');
			});

			it('should handle branch deletion failures', async () => {
				mockExec.mockImplementation((cmd, options, callback) => {
					if (cmd.includes('git status --porcelain')) {
						callback(null, { stdout: '' });
					} else if (cmd.includes('git worktree remove')) {
						callback(null, { stdout: 'worktree removed' });
					} else if (cmd.includes('git branch -d')) {
						callback(new Error('Branch deletion failed'));
					} else {
						callback(null, { stdout: 'success' });
					}
				});

				await expect(
					removeWorktreeAndBranch(MOCK_PROJECT_ROOT, 'task-123')
				).rejects.toThrow('Branch deletion failed');
			});
		});

		describe('delegation from removeWorktree', () => {
			it('should be called when removeWorktree is called with removeBranch: true', async () => {
				const result = await removeWorktree(MOCK_PROJECT_ROOT, 'task-123', {
					removeBranch: true
				});

				expect(result.branchRemoved).toBe(true);
				expect(result.success).toBe(true);
			});
		});
	});

	describe('listWorktrees', () => {
		beforeEach(() => {
			mockExec.mockImplementation((cmd, options, callback) => {
				callback(null, { stdout: MOCK_GIT_WORKTREE_LIST_OUTPUT });
			});
		});

		describe('input validation', () => {
			it('should throw error when projectRoot is missing', async () => {
				await expect(listWorktrees(null)).rejects.toThrow(
					'projectRoot is required for listWorktrees'
				);
			});
		});

		describe('feature toggle enforcement', () => {
			it('should throw error when worktrees feature is disabled', async () => {
				mockIsWorktreesEnabled.mockReturnValue(false);

				await expect(listWorktrees(MOCK_PROJECT_ROOT)).rejects.toThrow(
					'Worktrees are disabled'
				);
			});
		});

		describe('git output parsing', () => {
			it('should parse git worktree list output correctly', async () => {
				const result = await listWorktrees(MOCK_PROJECT_ROOT);

				expect(result).toHaveLength(3);
				expect(result[0]).toEqual({
					path: '/test/project',
					head: '1234567890abcdef',
					branch: 'main',
					isTaskMasterWorktree: false
				});
			});

			it('should identify Task Master worktrees correctly', async () => {
				const result = await listWorktrees(MOCK_PROJECT_ROOT);

				const taskWorktrees = result.filter((w) => w.isTaskMasterWorktree);
				expect(taskWorktrees).toHaveLength(2);
				expect(taskWorktrees[0]).toEqual(
					expect.objectContaining({
						taskId: '123',
						branch: 'task-123',
						isTaskMasterWorktree: true
					})
				);
			});

			it('should handle empty worktree list', async () => {
				mockExec.mockImplementation((cmd, options, callback) => {
					callback(null, { stdout: '' });
				});

				const result = await listWorktrees(MOCK_PROJECT_ROOT);
				expect(result).toEqual([]);
			});

			it('should parse bare repositories correctly', async () => {
				const bareWorktreeOutput = `worktree /test/project
HEAD 1234567890abcdef
branch refs/heads/main

worktree /test/project/bare-repo
HEAD abcdef1234567890
bare
`;
				mockExec.mockImplementation((cmd, options, callback) => {
					callback(null, { stdout: bareWorktreeOutput });
				});

				const result = await listWorktrees(MOCK_PROJECT_ROOT);
				expect(result).toHaveLength(2);
				expect(result[1]).toEqual(
					expect.objectContaining({
						path: '/test/project/bare-repo',
						head: 'abcdef1234567890',
						bare: true,
						isTaskMasterWorktree: false
					})
				);
			});
		});

		describe('error handling', () => {
			it('should handle git command failures', async () => {
				mockExec.mockImplementation((cmd, options, callback) => {
					callback(new Error('Git command failed'));
				});

				await expect(listWorktrees(MOCK_PROJECT_ROOT)).rejects.toThrow(
					'Failed to list worktrees: Git command failed'
				);
			});
		});

		describe('state synchronization', () => {
			it('should call syncWorktreeState before listing', async () => {
				await listWorktrees(MOCK_PROJECT_ROOT);

				expect(mockSyncWorktreeState).toHaveBeenCalledWith(
					MOCK_PROJECT_ROOT,
					expect.objectContaining({})
				);
			});

			it('should continue listing if sync fails', async () => {
				mockSyncWorktreeState.mockRejectedValue(new Error('Sync failed'));

				const result = await listWorktrees(MOCK_PROJECT_ROOT);

				expect(result).toHaveLength(3);
				expect(mockSyncWorktreeState).toHaveBeenCalled();
			});
		});

		describe('logging integration', () => {
			it('should log Task Master worktree count when mcpLog is provided', async () => {
				const mockMcpLog = {
					info: jest.fn(),
					warn: jest.fn(),
					error: jest.fn()
				};

				const result = await listWorktrees(MOCK_PROJECT_ROOT, {
					mcpLog: mockMcpLog
				});

				expect(result).toHaveLength(3);
				expect(mockMcpLog.info).toHaveBeenCalledWith(
					'Found 2 Task Master worktree(s)'
				);
			});

			it('should handle missing mcpLog option gracefully', async () => {
				// Should not throw when no mcpLog provided
				const result = await listWorktrees(MOCK_PROJECT_ROOT);

				expect(result).toHaveLength(3);
				// No assertions on logging since no logger provided
			});
		});
	});

	describe('worktreeEvents', () => {
		it('should be an EventEmitter instance', () => {
			expect(worktreeEvents.on).toBeDefined();
			expect(worktreeEvents.emit).toBeDefined();
			expect(worktreeEvents.off).toBeDefined();
		});

		it('should support multiple listeners', () => {
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
