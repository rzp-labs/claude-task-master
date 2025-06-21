import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';
import { BaseAIProvider } from './base-provider.js';

export class BedrockAIProvider extends BaseAIProvider {
	constructor() {
		super();
		this.name = 'Bedrock';
	}

	/**
	 * Override auth validation - Bedrock uses AWS credentials instead of API keys
	 * @param {object} params - Parameters to validate
	 */
	validateAuth(params) {}

	/**
	 * Creates and returns a Bedrock client instance.
	 * See https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-envvars.html
	 * for AWS SDK environment variables and configuration options.
	 */
	getClient(params) {
		try {
			const credentialProvider = fromNodeProviderChain();

			return createAmazonBedrock({
				credentialProvider
			});
		} catch (error) {
			this.handleError('client initialization', error);
		}
	}
}
