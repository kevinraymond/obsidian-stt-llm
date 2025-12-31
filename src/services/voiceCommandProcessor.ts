import type { VoiceCommand, VoiceCommandsSettings } from "../settings";

interface CommandOccurrence {
	command: VoiceCommand;
	isStartTrigger: boolean;
	index: number;
	matchedText: string;
}

interface ReplacementMarker {
	index: number;
	length: number;
	replacement: string;
	isStart: boolean;
	command: VoiceCommand;
}

export interface ProcessingResult {
	processedText: string;
	warnings: string[];
}

export class VoiceCommandProcessor {
	private getSettings: () => VoiceCommandsSettings;

	constructor(getSettings: () => VoiceCommandsSettings) {
		this.getSettings = getSettings;
	}

	/**
	 * Main entry point - process raw transcript and return formatted text
	 */
	process(rawText: string): ProcessingResult {
		const settings = this.getSettings();

		if (!settings.enabled) {
			return { processedText: rawText, warnings: [] };
		}

		const warnings: string[] = [];
		let text = rawText;

		// Step 1: Build trigger lookup map
		const triggerMap = this.buildTriggerMap(settings.commands);

		// Step 2: Find all command occurrences in the text
		const occurrences = this.findAllOccurrences(text, triggerMap);

		if (occurrences.length === 0) {
			return { processedText: text, warnings: [] };
		}

		// Step 3: Create replacement markers
		const markers: ReplacementMarker[] = occurrences.map((occ) => ({
			index: occ.index,
			length: occ.matchedText.length,
			replacement: occ.isStartTrigger
				? occ.command.markdownStart
				: occ.command.markdownEnd || "",
			isStart: occ.isStartTrigger,
			command: occ.command,
		}));

		// Step 4: Validate paired commands (proper nesting)
		const validationWarnings = this.validatePairing(markers);
		warnings.push(...validationWarnings);

		// Step 5: Apply replacements (sorted descending by index for safe replacement)
		markers.sort((a, b) => b.index - a.index);

		for (const marker of markers) {
			text =
				text.substring(0, marker.index) +
				marker.replacement +
				text.substring(marker.index + marker.length);
		}

		// Step 6: Clean up whitespace artifacts
		text = this.cleanupWhitespace(text);

		return { processedText: text, warnings };
	}

	/**
	 * Build a map of normalized trigger phrases to commands
	 */
	private buildTriggerMap(
		commands: VoiceCommand[]
	): Map<string, { command: VoiceCommand; isStart: boolean }> {
		const map = new Map<
			string,
			{ command: VoiceCommand; isStart: boolean }
		>();

		for (const cmd of commands) {
			// Normalize and add start trigger
			const normalizedStart = this.normalizeTrigger(cmd.startTrigger);
			map.set(normalizedStart, { command: cmd, isStart: true });

			// Normalize and add end trigger if exists
			if (cmd.endTrigger) {
				const normalizedEnd = this.normalizeTrigger(cmd.endTrigger);
				map.set(normalizedEnd, { command: cmd, isStart: false });
			}
		}

		return map;
	}

	/**
	 * Normalize a trigger phrase for matching:
	 * - Lowercase
	 * - Remove punctuation
	 * - Collapse whitespace
	 */
	private normalizeTrigger(trigger: string): string {
		return trigger
			.toLowerCase()
			.replace(/[.,!?;:'"]/g, "") // Remove common punctuation
			.replace(/\s+/g, " ") // Collapse whitespace
			.trim();
	}

	/**
	 * Build a regex pattern that tolerates punctuation and whitespace variations
	 * @param trigger - The trigger phrase to match
	 * @param captureTrailingSpace - If true, capture trailing whitespace (for start triggers)
	 * @param captureLeadingSpace - If true, capture leading whitespace (for end triggers)
	 */
	private buildFlexiblePattern(
		trigger: string,
		captureTrailingSpace: boolean,
		captureLeadingSpace: boolean
	): string {
		const words = trigger.split(" ");

		// Each word can be followed by optional punctuation
		// Words are separated by whitespace
		let pattern = words
			.map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) // Escape regex chars
			.map((word) => word + "[.,!?;:'\"]*") // Optional trailing punctuation per word
			.join("\\s+");

		// Capture leading whitespace for end triggers (to remove space before **)
		if (captureLeadingSpace) {
			pattern = "\\s*" + pattern;
		}

		// Capture trailing whitespace for start triggers (to remove space after **)
		if (captureTrailingSpace) {
			pattern = pattern + "\\s*";
		}

		return pattern;
	}

	/**
	 * Find all command occurrences in the text
	 */
	private findAllOccurrences(
		text: string,
		triggerMap: Map<string, { command: VoiceCommand; isStart: boolean }>
	): CommandOccurrence[] {
		const results: CommandOccurrence[] = [];

		// Sort triggers by length (longest first) to avoid partial matches
		const triggers = Array.from(triggerMap.keys()).sort(
			(a, b) => b.length - a.length
		);

		// Track claimed positions to prevent overlapping matches
		const claimedRanges: Array<{ start: number; end: number }> = [];

		for (const trigger of triggers) {
			const { command, isStart } = triggerMap.get(trigger)!;

			// For paired commands, capture adjacent whitespace:
			// - Start triggers capture trailing whitespace (so "start bold " becomes "**")
			// - End triggers capture leading whitespace (so " end bold" becomes "**")
			const isPaired = command.isPaired;
			const captureTrailing = isPaired && isStart;
			const captureLeading = isPaired && !isStart;

			// Build regex that handles punctuation tolerance and whitespace
			const regexPattern = this.buildFlexiblePattern(
				trigger,
				captureTrailing,
				captureLeading
			);
			const regex = new RegExp(regexPattern, "gi");

			let match: RegExpExecArray | null;
			while ((match = regex.exec(text)) !== null) {
				const matchStart = match.index;
				const matchEnd = match.index + match[0].length;

				// Check if this position overlaps with an already claimed range
				const overlaps = claimedRanges.some(
					(range) => matchStart < range.end && matchEnd > range.start
				);

				if (!overlaps) {
					results.push({
						command,
						isStartTrigger: isStart,
						index: match.index,
						matchedText: match[0],
					});
					claimedRanges.push({ start: matchStart, end: matchEnd });
				}
			}
		}

		return results;
	}

	/**
	 * Validate that paired commands are properly nested
	 */
	private validatePairing(markers: ReplacementMarker[]): string[] {
		const warnings: string[] = [];
		const stack: Array<{ command: VoiceCommand; index: number }> = [];

		// Sort by index ascending for validation
		const sorted = [...markers].sort((a, b) => a.index - b.index);

		for (const marker of sorted) {
			if (!marker.command.isPaired) continue;

			if (marker.isStart) {
				stack.push({ command: marker.command, index: marker.index });
			} else {
				// Look for matching open command
				const lastOpen = stack.pop();

				if (!lastOpen) {
					warnings.push(
						`Unmatched "${marker.command.endTrigger}" found`
					);
				} else if (lastOpen.command.type !== marker.command.type) {
					warnings.push(
						`Mismatched nesting: "${lastOpen.command.startTrigger}" closed by "${marker.command.endTrigger}"`
					);
					// Put back and continue (best effort)
					stack.push(lastOpen);
				}
			}
		}

		// Check for unclosed commands
		for (const open of stack) {
			warnings.push(`Unclosed "${open.command.startTrigger}"`);
		}

		return warnings;
	}

	/**
	 * Clean up whitespace artifacts from command replacement
	 */
	private cleanupWhitespace(text: string): string {
		return text
			.replace(/\n{3,}/g, "\n\n") // Max 2 consecutive newlines
			.replace(/  +/g, " ") // Collapse multiple spaces
			.trim();
	}
}
