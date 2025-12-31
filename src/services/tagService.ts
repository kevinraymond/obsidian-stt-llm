import { App, getAllTags } from "obsidian";

export class TagService {
	constructor(private app: App) {}

	/**
	 * Get all unique tags used across the vault
	 */
	getAllVaultTags(): string[] {
		const tagSet = new Set<string>();
		const files = this.app.vault.getMarkdownFiles();

		for (const file of files) {
			const cache = this.app.metadataCache.getFileCache(file);
			if (cache) {
				const tags = getAllTags(cache);
				if (tags) {
					for (const tag of tags) {
						// Remove # prefix and add to set
						tagSet.add(tag.startsWith("#") ? tag.slice(1) : tag);
					}
				}
			}
		}

		return Array.from(tagSet).sort();
	}

	/**
	 * Get tags that match a partial string (for autocomplete)
	 */
	searchTags(query: string): string[] {
		const allTags = this.getAllVaultTags();
		const lowerQuery = query.toLowerCase();
		return allTags.filter((tag) => tag.toLowerCase().includes(lowerQuery));
	}

	/**
	 * Get the most commonly used tags
	 */
	getPopularTags(limit: number = 20): string[] {
		const tagCounts = new Map<string, number>();
		const files = this.app.vault.getMarkdownFiles();

		for (const file of files) {
			const cache = this.app.metadataCache.getFileCache(file);
			if (cache) {
				const tags = getAllTags(cache);
				if (tags) {
					for (const tag of tags) {
						const normalizedTag = tag.startsWith("#") ? tag.slice(1) : tag;
						tagCounts.set(normalizedTag, (tagCounts.get(normalizedTag) || 0) + 1);
					}
				}
			}
		}

		return Array.from(tagCounts.entries())
			.sort((a, b) => b[1] - a[1])
			.slice(0, limit)
			.map(([tag]) => tag);
	}
}
