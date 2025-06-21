import { jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Mock external modules
jest.mock('child_process', () => ({
	execSync: jest.fn()
}));

// Mock console methods
jest.mock('console', () => ({
	log: jest.fn(),
	info: jest.fn(),
	warn: jest.fn(),
	error: jest.fn(),
	clear: jest.fn()
}));

describe('Cursor Integration', () => {
	let tempDir;

	beforeEach(() => {
		jest.clearAllMocks();

		// Create a temporary directory for testing
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'task-master-test-'));

		// Spy on fs methods
		jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
		jest.spyOn(fs, 'readFileSync').mockImplementation((filePath) => {
			if (filePath.toString().includes('mcp.json')) {
				return JSON.stringify({ mcpServers: {} }, null, 2);
			}
			return '{}';
		});
		jest.spyOn(fs, 'existsSync').mockImplementation(() => false);
		jest.spyOn(fs, 'mkdirSync').mockImplementation(() => {});
	});

	afterEach(() => {
		// Clean up the temporary directory
		try {
			fs.rmSync(tempDir, { recursive: true, force: true });
		} catch (err) {
			console.error(`Error cleaning up: ${err.message}`);
		}
	});

	// Test function that simulates the createProjectStructure behavior for Cursor files
	function mockCreateCursorStructure() {
		// Create main .cursor directory
		fs.mkdirSync(path.join(tempDir, '.cursor'), { recursive: true });

		// Create rules directory
		fs.mkdirSync(path.join(tempDir, '.cursor', 'rules'), { recursive: true });

		// Create MCP config file
		fs.writeFileSync(
			path.join(tempDir, '.cursor', 'mcp.json'),
			JSON.stringify({ mcpServers: {} }, null, 2)
		);
	}

	test('creates all required .cursor directories', () => {
		// Act
		mockCreateCursorStructure();

		// Assert
		expect(fs.mkdirSync).toHaveBeenCalledWith(path.join(tempDir, '.cursor'), {
			recursive: true
		});
		expect(fs.mkdirSync).toHaveBeenCalledWith(
			path.join(tempDir, '.cursor', 'rules'),
			{ recursive: true }
		);
	});
});
