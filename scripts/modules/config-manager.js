import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import { LEGACY_CONFIG_FILE } from '../../src/constants/paths.js';
import { findConfigPath } from '../../src/utils/path-utils.js';
import { findProjectRoot, log, resolveEnvVariable } from './utils.js';

// Calculate __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load supported models from JSON file using the calculated __dirname
let MODEL_MAP;
try {
	const supportedModelsRaw = fs.readFileSync(
		path.join(__dirname, 'supported-models.json'),
		'utf-8'
	);
	MODEL_MAP = JSON.parse(supportedModelsRaw);
} catch (error) {
	console.error(
		chalk.red(
			'FATAL ERROR: Could not load supported-models.json. Please ensure the file exists and is valid JSON.'
		),
		error
	);
	MODEL_MAP = {}; // Default to empty map on error to avoid crashing, though functionality will be limited
	process.exit(1); // Exit if models can't be loaded
}

// Define valid providers dynamically from the loaded MODEL_MAP
const VALID_PROVIDERS = Object.keys(MODEL_MAP || {});

// Default configuration values (used if config file is missing or incomplete)
const DEFAULTS = {
	models: {
		main: {
			provider: 'anthropic',
			modelId: 'claude-3-7-sonnet-20250219',
			maxTokens: 64000,
			temperature: 0.2
		},
		research: {
			provider: 'perplexity',
			modelId: 'sonar-pro',
			maxTokens: 8700,
			temperature: 0.1
		},
		fallback: {
			// No default fallback provider/model initially
			provider: 'anthropic',
			modelId: 'claude-3-5-sonnet',
			maxTokens: 64000, // Default parameters if fallback IS configured
			temperature: 0.2
		}
	},
	global: {
		logLevel: 'info',
		debug: false,
		defaultSubtasks: 5,
		defaultPriority: 'medium',
		projectName: 'Task Master',
		ollamaBaseURL: 'http://localhost:11434/api',
		bedrockBaseURL: 'https://bedrock.us-east-1.amazonaws.com'
	},
	features: {
		worktrees: false
	},
	costTracking: {
		enabled: true,
		alerts: {
			enabled: true,
			thresholds: {
				sessionLimit: 1.0,
				taskLimit: 0.5,
				dailyLimit: 5.0
			}
		}
	},
	observability: {
		langfuse: {
			enabled: false,
			secretKey: undefined,
			publicKey: undefined,
			baseUrl: 'https://cloud.langfuse.com',
			debug: false,
			samplingRate: false,
			promptResponseLogging: false,
			batchSize: 0,
			redactionPatterns: []
		}
	}
};

// --- Internal Config Loading ---
let loadedConfig = null;
let loadedConfigRoot = null; // Track which root loaded the config

// Custom Error for configuration issues
class ConfigurationError extends Error {
	constructor(message) {
		super(message);
		this.name = 'ConfigurationError';
	}
}

function _loadAndValidateConfig(explicitRoot = null) {
	const defaults = DEFAULTS; // Use the defined defaults
	let rootToUse = explicitRoot;
	let configSource = explicitRoot
		? `explicit root (${explicitRoot})`
		: 'defaults (no root provided yet)';

	// ---> If no explicit root, TRY to find it <---
	if (!rootToUse) {
		rootToUse = findProjectRoot();
		if (rootToUse) {
			configSource = `found root (${rootToUse})`;
		} else {
			// No root found, return defaults immediately
			return defaults;
		}
	}
	// ---> End find project root logic <---

	// --- Find configuration file using centralized path utility ---
	const configPath = findConfigPath(null, { projectRoot: rootToUse });
	let config = { ...defaults }; // Start with a deep copy of defaults
	let configExists = false;

	if (configPath) {
		configExists = true;
		const isLegacy = configPath.endsWith(LEGACY_CONFIG_FILE);

		try {
			const rawData = fs.readFileSync(configPath, 'utf-8');
			const parsedConfig = JSON.parse(rawData);

			// Deep merge parsed config onto defaults
			config = {
				models: {
					main: { ...defaults.models.main, ...parsedConfig?.models?.main },
					research: {
						...defaults.models.research,
						...parsedConfig?.models?.research
					},
					fallback:
						parsedConfig?.models?.fallback?.provider &&
						parsedConfig?.models?.fallback?.modelId
							? { ...defaults.models.fallback, ...parsedConfig.models.fallback }
							: { ...defaults.models.fallback }
				},
				global: { ...defaults.global, ...parsedConfig?.global },
				features: { ...defaults.features, ...parsedConfig?.features },
				costTracking: {
					...defaults.costTracking,
					...parsedConfig?.costTracking
				},
				observability: {
					langfuse: {
						...defaults.observability.langfuse,
						...parsedConfig?.observability?.langfuse
					}
				},
				// Include any additional top-level sections from the config file
				...Object.fromEntries(
					Object.entries(parsedConfig || {}).filter(
						([key]) =>
							![
								'models',
								'global',
								'features',
								'costTracking',
								'observability'
							].includes(key)
					)
				)
			};

			configSource = `file (${configPath})`; // Update source info

			// Issue deprecation warning if using legacy config file
			if (isLegacy) {
				console.warn(
					chalk.yellow(
						`⚠️  DEPRECATION WARNING: Found configuration in legacy location '${configPath}'. Please migrate to .taskmaster/config.json. Run 'task-master migrate' to automatically migrate your project.`
					)
				);
			}

			// --- Validation (Warn if file content is invalid) ---
			// Use log.warn for consistency
			if (!validateProvider(config.models.main.provider)) {
				console.warn(
					chalk.yellow(
						`Warning: Invalid main provider "${config.models.main.provider}" in ${configPath}. Falling back to default.`
					)
				);
				config.models.main = { ...defaults.models.main };
			}
			if (!validateProvider(config.models.research.provider)) {
				console.warn(
					chalk.yellow(
						`Warning: Invalid research provider "${config.models.research.provider}" in ${configPath}. Falling back to default.`
					)
				);
				config.models.research = { ...defaults.models.research };
			}
			if (
				config.models.fallback?.provider &&
				!validateProvider(config.models.fallback.provider)
			) {
				console.warn(
					chalk.yellow(
						`Warning: Invalid fallback provider "${config.models.fallback.provider}" in ${configPath}. Fallback model configuration will be ignored.`
					)
				);
				config.models.fallback.provider = undefined;
				config.models.fallback.modelId = undefined;
			}

			// --- Validate Langfuse configuration ---
			if (
				!validateLangfuseSamplingRate(
					config.observability.langfuse.samplingRate
				)
			) {
				console.warn(
					chalk.yellow(
						`Warning: Invalid Langfuse samplingRate "${config.observability.langfuse.samplingRate}" in ${configPath}. Falling back to default.`
					)
				);
				config.observability.langfuse.samplingRate =
					defaults.observability.langfuse.samplingRate;
			}
			if (
				config.observability.langfuse.promptResponseLogging !== undefined &&
				typeof config.observability.langfuse.promptResponseLogging !== 'boolean'
			) {
				console.warn(
					chalk.yellow(
						`Warning: Invalid Langfuse promptResponseLogging "${config.observability.langfuse.promptResponseLogging}" in ${configPath}. Falling back to default.`
					)
				);
				config.observability.langfuse.promptResponseLogging =
					defaults.observability.langfuse.promptResponseLogging;
			}
			if (!validateLangfuseBatchSize(config.observability.langfuse.batchSize)) {
				console.warn(
					chalk.yellow(
						`Warning: Invalid Langfuse batchSize "${config.observability.langfuse.batchSize}" in ${configPath}. Falling back to default.`
					)
				);
				config.observability.langfuse.batchSize =
					defaults.observability.langfuse.batchSize;
			}
			if (
				!validateLangfuseRedactionPatterns(
					config.observability.langfuse.redactionPatterns
				)
			) {
				console.warn(
					chalk.yellow(
						`Warning: Invalid Langfuse redactionPatterns in ${configPath}. Falling back to default.`
					)
				);
				config.observability.langfuse.redactionPatterns =
					defaults.observability.langfuse.redactionPatterns;
			}
		} catch (error) {
			// Use console.error for actual errors during parsing
			console.error(
				chalk.red(
					`Error reading or parsing ${configPath}: ${error.message}. Using default configuration.`
				)
			);
			config = { ...defaults }; // Reset to defaults on parse error
			configSource = `defaults (parse error at ${configPath})`;
		}
	} else {
		// Config file doesn't exist at the determined rootToUse.
		if (explicitRoot) {
			// Only warn if an explicit root was *expected*.
			console.warn(
				chalk.yellow(
					`Warning: Configuration file not found at provided project root (${explicitRoot}). Using default configuration. Run 'task-master models --setup' to configure.`
				)
			);
		} else {
			console.warn(
				chalk.yellow(
					`Warning: Configuration file not found at derived root (${rootToUse}). Using defaults.`
				)
			);
		}
		// Keep config as defaults
		config = { ...defaults };
		configSource = `defaults (no config file found at ${rootToUse})`;
	}

	return config;
}

/**
 * Gets the current configuration, loading it if necessary.
 * Handles MCP initialization context gracefully.
 * @param {string|null} explicitRoot - Optional explicit path to the project root.
 * @param {boolean} forceReload - Force reloading the config file.
 * @returns {object} The loaded configuration object.
 */
function getConfig(explicitRoot = null, forceReload = false) {
	// Determine if a reload is necessary
	const needsLoad =
		!loadedConfig ||
		forceReload ||
		(explicitRoot && explicitRoot !== loadedConfigRoot);

	if (needsLoad) {
		const newConfig = _loadAndValidateConfig(explicitRoot); // _load handles null explicitRoot

		// Only update the global cache if loading was forced or if an explicit root
		// was provided (meaning we attempted to load a specific project's config).
		// We avoid caching the initial default load triggered without an explicitRoot.
		if (forceReload || explicitRoot) {
			loadedConfig = newConfig;
			loadedConfigRoot = explicitRoot; // Store the root used for this loaded config
		}
		return newConfig; // Return the newly loaded/default config
	}

	// If no load was needed, return the cached config
	return loadedConfig;
}

/**
 * Validates if a provider name is in the list of supported providers.
 * @param {string} providerName The name of the provider.
 * @returns {boolean} True if the provider is valid, false otherwise.
 */
function validateProvider(providerName) {
	return VALID_PROVIDERS.includes(providerName);
}

/**
 * Optional: Validates if a modelId is known for a given provider based on MODEL_MAP.
 * This is a non-strict validation; an unknown model might still be valid.
 * @param {string} providerName The name of the provider.
 * @param {string} modelId The model ID.
 * @returns {boolean} True if the modelId is in the map for the provider, false otherwise.
 */
function validateProviderModelCombination(providerName, modelId) {
	// If provider isn't even in our map, we can't validate the model
	if (!MODEL_MAP[providerName]) {
		return true; // Allow unknown providers or those without specific model lists
	}
	// If the provider is known, check if the model is in its list OR if the list is empty (meaning accept any)
	return (
		MODEL_MAP[providerName].length === 0 ||
		// Use .some() to check the 'id' property of objects in the array
		MODEL_MAP[providerName].some((modelObj) => modelObj.id === modelId)
	);
}

/**
 * Validates if a Langfuse sampling rate is valid
 * @param {*} samplingRate The sampling rate value
 * @returns {boolean} True if valid, false otherwise
 */
function validateLangfuseSamplingRate(samplingRate) {
	return (
		samplingRate === false ||
		(typeof samplingRate === 'number' && samplingRate >= 0 && samplingRate <= 1)
	);
}

/**
 * Validates if a Langfuse batch size is valid
 * @param {*} batchSize The batch size value
 * @returns {boolean} True if valid, false otherwise
 */
function validateLangfuseBatchSize(batchSize) {
	return (
		typeof batchSize === 'number' &&
		batchSize >= 0 &&
		Number.isInteger(batchSize)
	);
}

/**
 * Validates if redaction patterns array is valid
 * @param {*} patterns The redaction patterns array
 * @returns {boolean} True if valid, false otherwise
 */
function validateLangfuseRedactionPatterns(patterns) {
	if (!Array.isArray(patterns)) return false;
	return patterns.every((pattern) => {
		if (typeof pattern !== 'string') return false;
		try {
			new RegExp(pattern);
			return true;
		} catch (e) {
			return false;
		}
	});
}

// --- Role-Specific Getters ---

function getModelConfigForRole(role, explicitRoot = null) {
	const config = getConfig(explicitRoot);
	const roleConfig = config?.models?.[role];
	if (!roleConfig) {
		log(
			'warn',
			`No model configuration found for role: ${role}. Returning default.`
		);
		return DEFAULTS.models[role] || {};
	}
	return roleConfig;
}

function getMainProvider(explicitRoot = null) {
	return getModelConfigForRole('main', explicitRoot).provider;
}

function getMainModelId(explicitRoot = null) {
	return getModelConfigForRole('main', explicitRoot).modelId;
}

function getMainMaxTokens(explicitRoot = null) {
	// Directly return value from config (which includes defaults)
	return getModelConfigForRole('main', explicitRoot).maxTokens;
}

function getMainTemperature(explicitRoot = null) {
	// Directly return value from config
	return getModelConfigForRole('main', explicitRoot).temperature;
}

function getResearchProvider(explicitRoot = null) {
	return getModelConfigForRole('research', explicitRoot).provider;
}

function getResearchModelId(explicitRoot = null) {
	return getModelConfigForRole('research', explicitRoot).modelId;
}

function getResearchMaxTokens(explicitRoot = null) {
	// Directly return value from config
	return getModelConfigForRole('research', explicitRoot).maxTokens;
}

function getResearchTemperature(explicitRoot = null) {
	// Directly return value from config
	return getModelConfigForRole('research', explicitRoot).temperature;
}

function getFallbackProvider(explicitRoot = null) {
	// Directly return value from config (will be undefined if not set)
	return getModelConfigForRole('fallback', explicitRoot).provider;
}

function getFallbackModelId(explicitRoot = null) {
	// Directly return value from config
	return getModelConfigForRole('fallback', explicitRoot).modelId;
}

function getFallbackMaxTokens(explicitRoot = null) {
	// Directly return value from config
	return getModelConfigForRole('fallback', explicitRoot).maxTokens;
}

function getFallbackTemperature(explicitRoot = null) {
	// Directly return value from config
	return getModelConfigForRole('fallback', explicitRoot).temperature;
}

// --- Global Settings Getters ---

function getGlobalConfig(explicitRoot = null) {
	const config = getConfig(explicitRoot);
	// Ensure global defaults are applied if global section is missing
	return { ...DEFAULTS.global, ...(config?.global || {}) };
}

function getLogLevel(explicitRoot = null) {
	// Directly return value from config
	return getGlobalConfig(explicitRoot).logLevel.toLowerCase();
}

function getDebugFlag(explicitRoot = null) {
	// Directly return value from config, ensure boolean
	return getGlobalConfig(explicitRoot).debug === true;
}

function getDefaultSubtasks(explicitRoot = null) {
	// Directly return value from config, ensure integer
	const val = getGlobalConfig(explicitRoot).defaultSubtasks;
	const parsedVal = parseInt(val, 10);
	return Number.isNaN(parsedVal) ? DEFAULTS.global.defaultSubtasks : parsedVal;
}

function getDefaultNumTasks(explicitRoot = null) {
	const val = getGlobalConfig(explicitRoot).defaultNumTasks;
	const parsedVal = parseInt(val, 10);
	return Number.isNaN(parsedVal) ? DEFAULTS.global.defaultNumTasks : parsedVal;
}

function getDefaultPriority(explicitRoot = null) {
	// Directly return value from config
	return getGlobalConfig(explicitRoot).defaultPriority;
}

function getProjectName(explicitRoot = null) {
	// Directly return value from config
	return getGlobalConfig(explicitRoot).projectName;
}

function getOllamaBaseURL(explicitRoot = null) {
	// Directly return value from config
	return getGlobalConfig(explicitRoot).ollamaBaseURL;
}

function getAzureBaseURL(explicitRoot = null) {
	// Directly return value from config
	return getGlobalConfig(explicitRoot).azureBaseURL;
}

function getBedrockBaseURL(explicitRoot = null) {
	// Directly return value from config
	return getGlobalConfig(explicitRoot).bedrockBaseURL;
}

/**
 * Gets the Google Cloud project ID for Vertex AI from configuration
 * @param {string|null} explicitRoot - Optional explicit path to the project root.
 * @returns {string|null} The project ID or null if not configured
 */
function getVertexProjectId(explicitRoot = null) {
	// Return value from config
	return getGlobalConfig(explicitRoot).vertexProjectId;
}

/**
 * Gets the Google Cloud location for Vertex AI from configuration
 * @param {string|null} explicitRoot - Optional explicit path to the project root.
 * @returns {string} The location or default value of "us-central1"
 */
function getVertexLocation(explicitRoot = null) {
	// Return value from config or default
	return getGlobalConfig(explicitRoot).vertexLocation || 'us-central1';
}

// --- Feature Settings Getters ---

function getFeaturesConfig(explicitRoot = null) {
	const config = getConfig(explicitRoot);
	// Ensure features defaults are applied if features section is missing
	return { ...DEFAULTS.features, ...(config?.features || {}) };
}

function isWorktreesEnabled(explicitRoot = null) {
	return getFeaturesConfig(explicitRoot).worktrees === true;
}

// --- Observability Settings Getters ---

function getObservabilityConfig(explicitRoot = null) {
	const config = getConfig(explicitRoot);
	// Ensure observability defaults are applied if observability section is missing
	return {
		langfuse: {
			...DEFAULTS.observability.langfuse,
			...(config?.observability?.langfuse || {})
		}
	};
}

function getLangfuseConfig(explicitRoot = null) {
	return getObservabilityConfig(explicitRoot).langfuse;
}

function getLangfuseSamplingRate(explicitRoot = null) {
	return getLangfuseConfig(explicitRoot).samplingRate;
}

function isLangfusePromptLoggingEnabled(explicitRoot = null) {
	return getLangfuseConfig(explicitRoot).promptResponseLogging === true;
}

function getLangfuseRedactionPatterns(explicitRoot = null) {
	return getLangfuseConfig(explicitRoot).redactionPatterns;
}

function getLangfuseBatchSize(explicitRoot = null) {
	return getLangfuseConfig(explicitRoot).batchSize;
}

/**
 * Reload Langfuse configuration and notify tracer
 * Forces config reload and clears cached Langfuse client
 * @param {string|null} explicitRoot - Optional explicit path to the project root
 * @returns {boolean} True if reload was successful, false otherwise
 */
function reloadLangfuseConfig(explicitRoot = null) {
	try {
		// Force reload the configuration
		const newConfig = getConfig(explicitRoot, true);

		// Notify langfuse-tracer to update its configuration
		// Use dynamic import to avoid circular dependencies
		import('../../src/observability/langfuse-tracer.js')
			.then((langfuseTracer) => {
				if (typeof langfuseTracer.updateConfiguration === 'function') {
					langfuseTracer.updateConfiguration();
				}
			})
			.catch((error) => {
				console.warn(
					chalk.yellow(
						`Warning: Could not notify langfuse-tracer of configuration update: ${error.message}`
					)
				);
			});

		return true;
	} catch (error) {
		console.error(
			chalk.red(`Error reloading Langfuse configuration: ${error.message}`)
		);
		return false;
	}
}

/**
 * Updates a specific configuration value using dot notation
 * @param {string} path - Dot notation path to the config value (e.g., 'observability.langfuse.enabled')
 * @param {*} value - New value to set
 * @param {string|null} explicitRoot - Optional explicit path to the project root  
 * @returns {object} Result object with success/error

 */
function updateConfigValue(path, value, explicitRoot = null) {
	try {
		const currentConfig = getConfig(explicitRoot);

		// Split the path into parts
		const pathParts = path.split('.');

		// Navigate to the parent object
		let current = currentConfig;
		for (let i = 0; i < pathParts.length - 1; i++) {
			if (!current[pathParts[i]]) {
				current[pathParts[i]] = {};
			}
			current = current[pathParts[i]];
		}

		// Set the value
		const lastKey = pathParts[pathParts.length - 1];
		current[lastKey] = value;

		// Write the updated configuration
		const writeResult = writeConfig(currentConfig, explicitRoot);
		if (!writeResult) {
			return {
				success: false,
				error: 'Failed to write updated configuration'
			};
		}

		return {
			success: true,
			data: {
				path,
				value,
				message: `Successfully updated ${path} to ${JSON.stringify(value)}`
			}
		};
	} catch (error) {
		return {
			success: false,
			error: error.message
		};
	}
}

/**
 * Gets model parameters (maxTokens, temperature) for a specific role,
 * considering model-specific overrides from supported-models.json.
 * @param {string} role - The role ('main', 'research', 'fallback').
 * @param {string|null} explicitRoot - Optional explicit path to the project root.
 * @returns {{maxTokens: number, temperature: number}}
 */
function getParametersForRole(role, explicitRoot = null) {
	const roleConfig = getModelConfigForRole(role, explicitRoot);
	const roleMaxTokens = roleConfig.maxTokens;
	const roleTemperature = roleConfig.temperature;
	const modelId = roleConfig.modelId;
	const providerName = roleConfig.provider;

	let effectiveMaxTokens = roleMaxTokens; // Start with the role's default

	try {
		// Find the model definition in MODEL_MAP
		const providerModels = MODEL_MAP[providerName];
		if (providerModels && Array.isArray(providerModels)) {
			const modelDefinition = providerModels.find((m) => m.id === modelId);

			// Check if a model-specific max_tokens is defined and valid
			if (
				modelDefinition &&
				typeof modelDefinition.max_tokens === 'number' &&
				modelDefinition.max_tokens > 0
			) {
				const modelSpecificMaxTokens = modelDefinition.max_tokens;
				// Use the minimum of the role default and the model specific limit
				effectiveMaxTokens = Math.min(roleMaxTokens, modelSpecificMaxTokens);
				log(
					'debug',
					`Applying model-specific max_tokens (${modelSpecificMaxTokens}) for ${modelId}. Effective limit: ${effectiveMaxTokens}`
				);
			} else {
				log(
					'debug',
					`No valid model-specific max_tokens override found for ${modelId}. Using role default: ${roleMaxTokens}`
				);
			}
		} else {
			log(
				'debug',
				`No model definitions found for provider ${providerName} in MODEL_MAP. Using role default maxTokens: ${roleMaxTokens}`
			);
		}
	} catch (lookupError) {
		log(
			'warn',
			`Error looking up model-specific max_tokens for ${modelId}: ${lookupError.message}. Using role default: ${roleMaxTokens}`
		);
		// Fallback to role default on error
		effectiveMaxTokens = roleMaxTokens;
	}

	return {
		maxTokens: effectiveMaxTokens,
		temperature: roleTemperature
	};
}

/**
 * Checks if the API key for a given provider is set in the environment.
 * Checks process.env first, then session.env if session is provided, then .env file if projectRoot provided.
 * @param {string} providerName - The name of the provider (e.g., 'openai', 'anthropic').
 * @param {object|null} [session=null] - The MCP session object (optional).
 * @param {string|null} [projectRoot=null] - The project root directory (optional, for .env file check).
 * @returns {boolean} True if the API key is set, false otherwise.
 */
function isApiKeySet(providerName, session = null, projectRoot = null) {
	// Check for providers that don't need API keys first
	if (
		providerName?.toLowerCase() === 'ollama' ||
		providerName?.toLowerCase() === 'claude-code'
	) {
		return true; // Indicate key status is effectively "OK"
	}

	// Claude Code doesn't require an API key
	if (providerName?.toLowerCase() === 'claude-code') {
		return true; // No API key needed
	}

	const keyMap = {
		openai: 'OPENAI_API_KEY',
		anthropic: 'ANTHROPIC_API_KEY',
		google: 'GOOGLE_API_KEY',
		perplexity: 'PERPLEXITY_API_KEY',
		mistral: 'MISTRAL_API_KEY',
		azure: 'AZURE_OPENAI_API_KEY',
		openrouter: 'OPENROUTER_API_KEY',
		xai: 'XAI_API_KEY',
		vertex: 'GOOGLE_API_KEY', // Vertex uses the same key as Google
		'claude-code': 'CLAUDE_CODE_API_KEY' // Not actually used, but included for consistency
		// Add other providers as needed
	};

	const providerKey = providerName?.toLowerCase();
	if (!providerKey || !keyMap[providerKey]) {
		log('warn', `Unknown provider name: ${providerName} in isApiKeySet check.`);
		return false;
	}

	const envVarName = keyMap[providerKey];
	const apiKeyValue = resolveEnvVariable(envVarName, session, projectRoot);

	// Check if the key exists, is not empty, and is not a placeholder
	return (
		apiKeyValue &&
		apiKeyValue.trim() !== '' &&
		!/YOUR_.*_API_KEY_HERE/.test(apiKeyValue) && // General placeholder check
		!apiKeyValue.includes('KEY_HERE')
	); // Another common placeholder pattern
}

/**
 * Checks the API key status within .cursor/mcp.json for a given provider.
 * Reads the mcp.json file, finds the taskmaster-ai server config, and checks the relevant env var.
 * @param {string} providerName The name of the provider.
 * @param {string|null} projectRoot - Optional explicit path to the project root.
 * @returns {boolean} True if the key exists and is not a placeholder, false otherwise.
 */
function getMcpApiKeyStatus(providerName, projectRoot = null) {
	const rootDir = projectRoot || findProjectRoot(); // Use existing root finding
	if (!rootDir) {
		console.warn(
			chalk.yellow('Warning: Could not find project root to check mcp.json.')
		);
		return false; // Cannot check without root
	}
	const mcpConfigPath = path.join(rootDir, '.cursor', 'mcp.json');

	if (!fs.existsSync(mcpConfigPath)) {
		// console.warn(chalk.yellow('Warning: .cursor/mcp.json not found.'));
		return false; // File doesn't exist
	}

	try {
		const mcpConfigRaw = fs.readFileSync(mcpConfigPath, 'utf-8');
		const mcpConfig = JSON.parse(mcpConfigRaw);

		const mcpEnv = mcpConfig?.mcpServers?.['taskmaster-ai']?.env;
		if (!mcpEnv) {
			// console.warn(chalk.yellow('Warning: Could not find taskmaster-ai env in mcp.json.'));
			return false; // Structure missing
		}

		let apiKeyToCheck = null;
		let placeholderValue = null;

		switch (providerName) {
			case 'anthropic':
				apiKeyToCheck = mcpEnv.ANTHROPIC_API_KEY;
				placeholderValue = 'YOUR_ANTHROPIC_API_KEY_HERE';
				break;
			case 'openai':
				apiKeyToCheck = mcpEnv.OPENAI_API_KEY;
				placeholderValue = 'YOUR_OPENAI_API_KEY_HERE'; // Assuming placeholder matches OPENAI
				break;
			case 'openrouter':
				apiKeyToCheck = mcpEnv.OPENROUTER_API_KEY;
				placeholderValue = 'YOUR_OPENROUTER_API_KEY_HERE';
				break;
			case 'google':
				apiKeyToCheck = mcpEnv.GOOGLE_API_KEY;
				placeholderValue = 'YOUR_GOOGLE_API_KEY_HERE';
				break;
			case 'perplexity':
				apiKeyToCheck = mcpEnv.PERPLEXITY_API_KEY;
				placeholderValue = 'YOUR_PERPLEXITY_API_KEY_HERE';
				break;
			case 'xai':
				apiKeyToCheck = mcpEnv.XAI_API_KEY;
				placeholderValue = 'YOUR_XAI_API_KEY_HERE';
				break;
			case 'ollama':
				return true; // No key needed
			case 'claude-code':
				return true; // No key needed
			case 'mistral':
				apiKeyToCheck = mcpEnv.MISTRAL_API_KEY;
				placeholderValue = 'YOUR_MISTRAL_API_KEY_HERE';
				break;
			case 'azure':
				apiKeyToCheck = mcpEnv.AZURE_OPENAI_API_KEY;
				placeholderValue = 'YOUR_AZURE_OPENAI_API_KEY_HERE';
				break;
			case 'vertex':
				apiKeyToCheck = mcpEnv.GOOGLE_API_KEY; // Vertex uses Google API key
				placeholderValue = 'YOUR_GOOGLE_API_KEY_HERE';
				break;
			default:
				return false; // Unknown provider
		}

		return !!apiKeyToCheck && !/KEY_HERE$/.test(apiKeyToCheck);
	} catch (error) {
		console.error(
			chalk.red(`Error reading or parsing .cursor/mcp.json: ${error.message}`)
		);
		return false;
	}
}

/**
 * Gets a list of available models based on the MODEL_MAP.
 * @returns {Array<{id: string, name: string, provider: string, swe_score: number|null, cost_per_1m_tokens: {input: number|null, output: number|null}|null, allowed_roles: string[]}>}
 */
function getAvailableModels() {
	const available = [];
	for (const [provider, models] of Object.entries(MODEL_MAP)) {
		if (models.length > 0) {
			models.forEach((modelObj) => {
				// Basic name generation - can be improved
				const modelId = modelObj.id;
				const sweScore = modelObj.swe_score;
				const cost = modelObj.cost_per_1m_tokens;
				const allowedRoles = modelObj.allowed_roles || ['main', 'fallback'];

				// Use name from JSON if available, otherwise generate it
				let name = modelObj.name;
				if (!name) {
					const nameParts = modelId
						.split('-')
						.map((p) => p.charAt(0).toUpperCase() + p.slice(1));
					// Handle specific known names better if needed
					name = nameParts.join(' ');
					if (modelId === 'claude-3.5-sonnet-20240620')
						name = 'Claude 3.5 Sonnet';
					if (modelId === 'claude-3-7-sonnet-20250219')
						name = 'Claude 3.7 Sonnet';
					if (modelId === 'gpt-4o') name = 'GPT-4o';
					if (modelId === 'gpt-4-turbo') name = 'GPT-4 Turbo';
					if (modelId === 'sonar-pro') name = 'Perplexity Sonar Pro';
					if (modelId === 'sonar-mini') name = 'Perplexity Sonar Mini';
				}

				available.push({
					id: modelId,
					name: name,
					provider: provider,
					swe_score: sweScore,
					cost_per_1m_tokens: cost,
					allowed_roles: allowedRoles,
					max_tokens: modelObj.max_tokens
				});
			});
		} else {
			// For providers with empty lists (like ollama), maybe add a placeholder or skip
			available.push({
				id: `[${provider}-any]`,
				name: `Any (${provider})`,
				provider: provider
			});
		}
	}
	return available;
}

/**
 * Writes the configuration object to the file.
 * @param {Object} config The configuration object to write.
 * @param {string|null} explicitRoot - Optional explicit path to the project root.
 * @returns {boolean} True if successful, false otherwise.
 */
function writeConfig(config, explicitRoot = null) {
	// ---> Determine root path reliably <---
	let rootPath = explicitRoot;
	if (explicitRoot === null || explicitRoot === undefined) {
		// Logic matching _loadAndValidateConfig
		const foundRoot = findProjectRoot(); // *** Explicitly call findProjectRoot ***
		if (!foundRoot) {
			console.error(
				chalk.red(
					'Error: Could not determine project root. Configuration not saved.'
				)
			);
			return false;
		}
		rootPath = foundRoot;
	}
	// ---> End determine root path logic <---

	// Use new config location: .taskmaster/config.json
	const taskmasterDir = path.join(rootPath, '.taskmaster');
	const configPath = path.join(taskmasterDir, 'config.json');

	try {
		// Ensure .taskmaster directory exists
		if (!fs.existsSync(taskmasterDir)) {
			fs.mkdirSync(taskmasterDir, { recursive: true });
		}

		fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
		loadedConfig = config; // Update the cache after successful write
		return true;
	} catch (error) {
		console.error(
			chalk.red(
				`Error writing configuration to ${configPath}: ${error.message}`
			)
		);
		return false;
	}
}

/**
 * Checks if a configuration file exists at the project root (new or legacy location)
 * @param {string|null} explicitRoot - Optional explicit path to the project root
 * @returns {boolean} True if the file exists, false otherwise
 */
function isConfigFilePresent(explicitRoot = null) {
	return findConfigPath(null, { projectRoot: explicitRoot }) !== null;
}

/**
 * Gets the user ID from the configuration.
 * @param {string|null} explicitRoot - Optional explicit path to the project root.
 * @returns {string|null} The user ID or null if not found.
 */
function getUserId(explicitRoot = null) {
	const config = getConfig(explicitRoot);
	if (!config.global) {
		config.global = {}; // Ensure global object exists
	}
	if (!config.global.userId) {
		config.global.userId = '1234567890';
		// Attempt to write the updated config.
		// It's important that writeConfig correctly resolves the path
		// using explicitRoot, similar to how getConfig does.
		const success = writeConfig(config, explicitRoot);
		if (!success) {
			// Log an error or handle the failure to write,
			// though for now, we'll proceed with the in-memory default.
			log(
				'warning',
				'Failed to write updated configuration with new userId. Please let the developers know.'
			);
		}
	}
	return config.global.userId;
}

/**
 * Gets a list of all provider names defined in the MODEL_MAP.
 * @returns {string[]} An array of provider names.
 */
function getAllProviders() {
	return Object.keys(MODEL_MAP || {});
}

function getBaseUrlForRole(role, explicitRoot = null) {
	const roleConfig = getModelConfigForRole(role, explicitRoot);
	return roleConfig && typeof roleConfig.baseURL === 'string'
		? roleConfig.baseURL
		: undefined;
}

/**
 * Get cost tracking configuration.
 * @param {string|null} explicitRoot - Optional explicit path to the project root.
 * @returns {object} Cost tracking configuration.
 */
function getCostTrackingConfig(explicitRoot = null) {
	const config = getConfig(explicitRoot);
	return config.costTracking || DEFAULTS.costTracking;
}

/**
 * Check if cost tracking is enabled.
 * @param {string|null} explicitRoot - Optional explicit path to the project root.
 * @returns {boolean} True if cost tracking is enabled.
 */
function isCostTrackingEnabled(explicitRoot = null) {
	const costConfig = getCostTrackingConfig(explicitRoot);
	return costConfig.enabled === true;
}

/**
 * Check if cost alerts are enabled.
 * @param {string|null} explicitRoot - Optional explicit path to the project root.
 * @returns {boolean} True if cost alerts are enabled.
 */
function isCostAlertsEnabled(explicitRoot = null) {
	const costConfig = getCostTrackingConfig(explicitRoot);
	return costConfig.enabled === true && costConfig.alerts?.enabled === true;
}

/**
 * Get cost alert thresholds.
 * @param {string|null} explicitRoot - Optional explicit path to the project root.
 * @returns {object} Cost alert thresholds.
 */
function getCostAlertThresholds(explicitRoot = null) {
	const costConfig = getCostTrackingConfig(explicitRoot);
	return (
		costConfig.alerts?.thresholds || DEFAULTS.costTracking.alerts.thresholds
	);
}

export {
	// Core config access
	getConfig,
	writeConfig,
	ConfigurationError,
	isConfigFilePresent,
	// Validation
	validateProvider,
	validateProviderModelCombination,
	validateLangfuseSamplingRate,
	validateLangfuseBatchSize,
	validateLangfuseRedactionPatterns,
	VALID_PROVIDERS,
	MODEL_MAP,
	getAvailableModels,
	// Role-specific getters (No env var overrides)
	getMainProvider,
	getMainModelId,
	getMainMaxTokens,
	getMainTemperature,
	getResearchProvider,
	getResearchModelId,
	getResearchMaxTokens,
	getResearchTemperature,
	getFallbackProvider,
	getFallbackModelId,
	getFallbackMaxTokens,
	getFallbackTemperature,
	getBaseUrlForRole,
	// Global setting getters (No env var overrides)
	getLogLevel,
	getDebugFlag,
	getDefaultNumTasks,
	getDefaultSubtasks,
	getDefaultPriority,
	getProjectName,
	getOllamaBaseURL,
	getAzureBaseURL,
	getBedrockBaseURL,
	getParametersForRole,
	getUserId,
	// Feature setting getters
	getFeaturesConfig,
	isWorktreesEnabled,
	// Cost tracking getters
	getCostTrackingConfig,
	isCostTrackingEnabled,
	isCostAlertsEnabled,
	getCostAlertThresholds,
	// Observability setting getters
	getObservabilityConfig,
	getLangfuseConfig,
	getLangfuseSamplingRate,
	isLangfusePromptLoggingEnabled,
	getLangfuseRedactionPatterns,
	getLangfuseBatchSize,
	reloadLangfuseConfig,
	updateConfigValue,
	// API Key Checkers (still relevant)
	isApiKeySet,
	getMcpApiKeyStatus,
	// ADD: Function to get all provider names
	getAllProviders,
	getVertexProjectId,
	getVertexLocation
};
