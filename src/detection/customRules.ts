// Custom rules handler for user-defined patterns

import * as vscode from 'vscode';
import { SensitiveMatch, SecretType, CustomPattern } from '../utils/types';
import { MIN_SECRET_LENGTH, EXTENSION_NAME } from '../utils/constants';

/**
 * Custom Rules Manager for user-defined sensitive data detection
 */
export class CustomRulesManager {
    private customPatterns: CustomPattern[] = [];
    private hiddenVariables: string[] = [];
    private hiddenStrings: string[] = [];
    private compiledPatterns: Map<string, RegExp> = new Map();

    constructor() {
        this.loadFromSettings();
    }

    /**
     * Load custom rules from VS Code settings
     */
    public loadFromSettings(): void {
        const config = vscode.workspace.getConfiguration(EXTENSION_NAME);

        this.customPatterns = config.get<CustomPattern[]>('customPatterns', []);
        this.hiddenVariables = config.get<string[]>('hiddenVariables', []);
        this.hiddenStrings = config.get<string[]>('hiddenStrings', []);

        // Compile patterns
        this.compilePatterns();
    }

    /**
     * Compile regex patterns from user configuration
     */
    private compilePatterns(): void {
        this.compiledPatterns.clear();

        for (const pattern of this.customPatterns) {
            try {
                const regex = new RegExp(pattern.pattern, 'g');
                this.compiledPatterns.set(pattern.name, regex);
            } catch (error) {
                console.warn(`VEIL: Invalid custom pattern "${pattern.name}": ${error}`);
            }
        }
    }

    /**
     * Add a custom pattern
     */
    public async addCustomPattern(name: string, pattern: string, description?: string): Promise<boolean> {
        // Validate pattern
        try {
            new RegExp(pattern);
        } catch (error) {
            vscode.window.showErrorMessage(`Invalid regex pattern: ${error}`);
            return false;
        }

        const config = vscode.workspace.getConfiguration(EXTENSION_NAME);
        const patterns = [...this.customPatterns, { name, pattern, description }];

        await config.update('customPatterns', patterns, vscode.ConfigurationTarget.Global);
        this.loadFromSettings();

        return true;
    }

    /**
     * Add a variable name to always hide
     */
    public async addHiddenVariable(variableName: string): Promise<void> {
        const config = vscode.workspace.getConfiguration(EXTENSION_NAME);
        const variables = [...this.hiddenVariables, variableName];

        await config.update('hiddenVariables', variables, vscode.ConfigurationTarget.Global);
        this.loadFromSettings();
    }

    /**
     * Add a string to always hide
     */
    public async addHiddenString(str: string): Promise<void> {
        const config = vscode.workspace.getConfiguration(EXTENSION_NAME);
        const strings = [...this.hiddenStrings, str];

        await config.update('hiddenStrings', strings, vscode.ConfigurationTarget.Global);
        this.loadFromSettings();
    }

    /**
     * Find matches based on custom rules
     */
    public findCustomMatches(document: vscode.TextDocument): SensitiveMatch[] {
        const matches: SensitiveMatch[] = [];
        const text = document.getText();

        // Find custom pattern matches
        this.findPatternMatches(document, text, matches);

        // Find hidden variable matches
        this.findHiddenVariableMatches(document, text, matches);

        // Find hidden string matches
        this.findHiddenStringMatches(document, text, matches);

        return matches;
    }

    /**
     * Find matches for compiled custom patterns
     */
    private findPatternMatches(document: vscode.TextDocument, text: string, matches: SensitiveMatch[]): void {
        for (const [name, pattern] of this.compiledPatterns) {
            pattern.lastIndex = 0;
            let match: RegExpExecArray | null;

            while ((match = pattern.exec(text)) !== null) {
                if (match[0].length < MIN_SECRET_LENGTH) {
                    continue;
                }

                const startPos = document.positionAt(match.index);
                const endPos = document.positionAt(match.index + match[0].length);

                matches.push({
                    range: new vscode.Range(startPos, endPos),
                    type: SecretType.CUSTOM_PATTERN,
                    originalValue: match[0],
                    confidence: 90,
                    isMasked: true,
                    id: `${document.uri.toString()}-custom-${name}-${match.index}`
                });
            }
        }
    }

    /**
     * Find matches for hidden variable names
     */
    private findHiddenVariableMatches(document: vscode.TextDocument, text: string, matches: SensitiveMatch[]): void {
        for (const variable of this.hiddenVariables) {
            // Pattern to find variable assignments
            const patterns = [
                new RegExp(`${this.escapeRegex(variable)}\\s*[:=]\\s*["']([^"']+)["']`, 'gi'),
                new RegExp(`["']${this.escapeRegex(variable)}["']\\s*:\\s*["']([^"']+)["']`, 'gi')
            ];

            for (const pattern of patterns) {
                let match: RegExpExecArray | null;

                while ((match = pattern.exec(text)) !== null) {
                    const value = match[1];
                    if (value && value.length >= MIN_SECRET_LENGTH) {
                        const valueStart = match.index + match[0].lastIndexOf(value);
                        const startPos = document.positionAt(valueStart);
                        const endPos = document.positionAt(valueStart + value.length);

                        matches.push({
                            range: new vscode.Range(startPos, endPos),
                            type: SecretType.CUSTOM_PATTERN,
                            originalValue: value,
                            confidence: 95,
                            isMasked: true,
                            id: `${document.uri.toString()}-var-${variable}-${match.index}`,
                            keyName: variable
                        });
                    }
                }
            }
        }
    }

    /**
     * Find matches for hidden strings
     */
    private findHiddenStringMatches(document: vscode.TextDocument, text: string, matches: SensitiveMatch[]): void {
        for (const str of this.hiddenStrings) {
            if (str.length < 3) {
                continue; // Skip very short strings to avoid too many matches
            }

            let index = 0;
            while ((index = text.indexOf(str, index)) !== -1) {
                const startPos = document.positionAt(index);
                const endPos = document.positionAt(index + str.length);

                // Check if this doesn't overlap with existing matches
                const overlaps = matches.some(m =>
                    (m.range.start.isBefore(endPos) || m.range.start.isEqual(endPos)) &&
                    (m.range.end.isAfter(startPos) || m.range.end.isEqual(startPos))
                );

                if (!overlaps) {
                    matches.push({
                        range: new vscode.Range(startPos, endPos),
                        type: SecretType.CUSTOM_PATTERN,
                        originalValue: str,
                        confidence: 100,
                        isMasked: true,
                        id: `${document.uri.toString()}-str-${index}`
                    });
                }

                index += str.length;
            }
        }
    }

    /**
     * Escape special regex characters
     */
    private escapeRegex(str: string): string {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    /**
     * Get all custom patterns
     */
    public getCustomPatterns(): CustomPattern[] {
        return this.customPatterns;
    }

    /**
     * Get all hidden variables
     */
    public getHiddenVariables(): string[] {
        return this.hiddenVariables;
    }

    /**
     * Get all hidden strings
     */
    public getHiddenStrings(): string[] {
        return this.hiddenStrings;
    }
}

/**
 * Export singleton instance
 */
export const customRulesManager = new CustomRulesManager();
