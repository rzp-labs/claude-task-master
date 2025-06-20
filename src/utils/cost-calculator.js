/**
 * src/utils/cost-calculator.js
 *
 * Cost calculation utilities for AI provider calls.
 * Extracted from ai-services-unified.js logAiUsage function for reusability.
 */

import { log } from '../../scripts/init.js';

/**
 * Calculate cost for AI provider calls using token counts and pricing models
 * @param {string} providerName - Name of the AI provider (e.g., 'anthropic', 'openai')
 * @param {string} modelId - Model identifier (e.g., 'claude-3-sonnet-20240229')
 * @param {number} inputTokens - Number of input tokens used
 * @param {number} outputTokens - Number of output tokens generated
 * @param {Object} modelMap - Model pricing data map (optional, uses global MODEL_MAP if not provided)
 * @returns {Object} Cost calculation result with inputCost, outputCost, totalCost, currency, and metadata
 */
export function calculateAiCost(
	providerName,
	modelId,
	inputTokens = 0,
	outputTokens = 0,
	modelMap = null
) {
	try {
		// Validate inputs
		if (!providerName || !modelId) {
			log('debug', 'calculateAiCost: Missing providerName or modelId', {
				providerName,
				modelId
			});
			return createZeroCostResult('Missing required parameters');
		}

		// Use provided modelMap or fall back to global MODEL_MAP
		const MODEL_MAP = modelMap || (globalThis.MODEL_MAP ?? null);

		if (!MODEL_MAP) {
			log('debug', 'calculateAiCost: MODEL_MAP not available');
			return createZeroCostResult('MODEL_MAP not available');
		}

		// Get cost data for the specific model
		const { inputCost, outputCost, currency } = getCostForModel(
			providerName,
			modelId,
			MODEL_MAP
		);

		// Calculate costs (convert tokens to millions for pricing)
		const calculatedInputCost = (inputTokens / 1_000_000) * inputCost;
		const calculatedOutputCost = (outputTokens / 1_000_000) * outputCost;
		const totalCost = calculatedInputCost + calculatedOutputCost;

		// Return comprehensive cost information
		return {
			inputCost: calculatedInputCost,
			outputCost: calculatedOutputCost,
			totalCost: parseFloat(totalCost.toFixed(6)),
			currency,
			metadata: {
				providerName,
				modelId,
				inputTokens,
				outputTokens,
				totalTokens: inputTokens + outputTokens,
				pricingRates: {
					inputCostPer1M: inputCost,
					outputCostPer1M: outputCost,
					currency
				},
				calculationTimestamp: new Date().toISOString()
			}
		};
	} catch (error) {
		log('error', 'calculateAiCost: Error calculating cost', {
			error: error.message,
			providerName,
			modelId,
			inputTokens,
			outputTokens
		});
		return createZeroCostResult(`Calculation error: ${error.message}`);
	}
}

/**
 * Get cost data for a specific model from the pricing model map
 * @param {string} providerName - Provider name
 * @param {string} modelId - Model identifier
 * @param {Object} modelMap - Model pricing data map
 * @returns {Object} Cost data with inputCost, outputCost, currency
 */
function getCostForModel(providerName, modelId, modelMap) {
	if (!modelMap || !modelMap[providerName]) {
		log(
			'warn',
			`Provider "${providerName}" not found in MODEL_MAP. Cannot determine cost for model ${modelId}.`
		);
		return { inputCost: 0, outputCost: 0, currency: 'USD' };
	}

	const modelData = modelMap[providerName].find((m) => m.id === modelId);

	if (!modelData || !modelData.cost_per_1m_tokens) {
		log(
			'debug',
			`Cost data not found for model "${modelId}" under provider "${providerName}". Assuming zero cost.`
		);
		return { inputCost: 0, outputCost: 0, currency: 'USD' };
	}

	// Ensure currency is part of the returned object, defaulting if not present
	const currency = modelData.cost_per_1m_tokens.currency || 'USD';

	return {
		inputCost: modelData.cost_per_1m_tokens.input || 0,
		outputCost: modelData.cost_per_1m_tokens.output || 0,
		currency: currency
	};
}

/**
 * Create a zero-cost result for error cases
 * @param {string} reason - Reason for zero cost
 * @returns {Object} Zero cost result
 */
function createZeroCostResult(reason) {
	return {
		inputCost: 0,
		outputCost: 0,
		totalCost: 0,
		currency: 'USD',
		metadata: {
			providerName: null,
			modelId: null,
			inputTokens: 0,
			outputTokens: 0,
			totalTokens: 0,
			pricingRates: {
				inputCostPer1M: 0,
				outputCostPer1M: 0,
				currency: 'USD'
			},
			calculationTimestamp: new Date().toISOString(),
			error: reason
		}
	};
}

/**
 * Extract token counts from AI provider response objects
 * @param {Object} response - AI provider response
 * @param {string} responseType - Type of response ('streaming' or 'standard')
 * @returns {Object} Token counts with inputTokens and outputTokens
 */
export function extractTokenCounts(response, responseType = 'standard') {
	try {
		if (!response) {
			return { inputTokens: 0, outputTokens: 0 };
		}

		// Handle different response formats
		if (responseType === 'streaming' && response.usage) {
			// Streaming responses may have accumulated usage
			return {
				inputTokens: response.usage.promptTokens || 0,
				outputTokens: response.usage.completionTokens || 0
			};
		}

		// Standard response format
		if (response.usage) {
			return {
				inputTokens: response.usage.promptTokens || 0,
				outputTokens: response.usage.completionTokens || 0
			};
		}

		// Claude API format
		if (response.usage) {
			const inputTokens =
				(response.usage.cache_creation_input_tokens || 0) +
				(response.usage.cache_read_input_tokens || 0) +
				(response.usage.input_tokens || 0);

			return {
				inputTokens,
				outputTokens: response.usage.output_tokens || 0
			};
		}

		log('debug', 'extractTokenCounts: No usage data found in response');
		return { inputTokens: 0, outputTokens: 0 };
	} catch (error) {
		log('error', 'extractTokenCounts: Error extracting token counts', {
			error: error.message,
			responseType
		});
		return { inputTokens: 0, outputTokens: 0 };
	}
}
