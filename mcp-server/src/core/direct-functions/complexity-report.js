/**
 * complexity-report.js
 * Direct function implementation for displaying complexity analysis report
 */

import fs from 'fs';
import { readComplexityReport } from '../../../../scripts/modules/utils.js';

/**
 * Direct function wrapper for displaying the complexity report.
 * Note: This simplified version only reads the report data without the interactive
 * features available in the CLI version. If the report doesn't exist, it returns
 * an error instead of prompting to generate one.
 *
 * @param {Object} args - Command arguments containing reportPath.
 * @param {string} args.reportPath - Explicit path to the complexity report file.
 * @param {Object} log - Logger object
 * @returns {Promise<Object>} - Result object with success status and data/error information
 */
export async function complexityReportDirect(args, log) {
	const { reportPath } = args;

	try {
		log.info(`Getting complexity report with args: ${JSON.stringify(args)}`);

		// Check if reportPath was provided
		if (!reportPath) {
			log.error('complexityReportDirect called without reportPath');
			return {
				success: false,
				error: { code: 'MISSING_ARGUMENT', message: 'reportPath is required' }
			};
		}

		log.info(`Looking for complexity report at: ${reportPath}`);

		// Check if the report exists
		if (!fs.existsSync(reportPath)) {
			log.warn(`No complexity report found at ${reportPath}`);
			return {
				success: false,
				error: {
					code: 'FILE_NOT_FOUND_ERROR',
					message: `No complexity report found at ${reportPath}. Run 'analyze-complexity' first.`
				}
			};
		}

		// Read the report using the utility function
		const report = readComplexityReport(reportPath);

		if (!report) {
			log.error(`Failed to read complexity report from ${reportPath}`);
			return {
				success: false,
				error: {
					code: 'READ_ERROR',
					message: `Failed to read complexity report from ${reportPath}`
				}
			};
		}

		log.info('complexityReportDirect completed successfully');
		return {
			success: true,
			data: {
				report,
				reportPath
			}
		};
	} catch (error) {
		log.error(`Error in complexityReportDirect: ${error.message}`);
		return {
			success: false,
			error: {
				code: 'UNEXPECTED_ERROR',
				message: error.message
			}
		};
	}
}
