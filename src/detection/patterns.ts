// Pattern-based detection for VEIL extension

import { PATTERN_DEFINITIONS, SENSITIVE_KEYWORDS, MIN_SECRET_LENGTH } from '../utils/constants';
import { SensitiveMatch, SecretType, PatternDefinition, CustomPattern } from '../utils/types';
import * as vscode from 'vscode';

/**
 * Pattern Matcher class for detecting secrets using regex patterns
 */
export class PatternMatcher {
    private patterns: PatternDefinition[];
    private customPatterns: PatternDefinition[] = [];

    constructor() {
        this.patterns = [...PATTERN_DEFINITIONS];
    }

    /**
     * Set custom patterns from user configuration
     */
    public setCustomPatterns(patterns: CustomPattern[]): void {
        this.customPatterns = patterns.map(p => ({
            name: p.name,
            type: SecretType.CUSTOM_PATTERN,
            pattern: new RegExp(p.pattern, 'g'),
            description: p.description || 'User-defined pattern',
            minConfidence: 80
        }));
    }

    /**
     * Find all matches in the given text
     */
    public findMatches(text: string, document: vscode.TextDocument): SensitiveMatch[] {
        const matches: SensitiveMatch[] = [];
        const allPatterns = [...this.patterns, ...this.customPatterns];

        for (const patternDef of allPatterns) {
            // Reset regex lastIndex
            patternDef.pattern.lastIndex = 0;

            let match: RegExpExecArray | null;
            while ((match = patternDef.pattern.exec(text)) !== null) {
                const startPos = document.positionAt(match.index);
                const endPos = document.positionAt(match.index + match[0].length);

                // Skip if too short
                if (match[0].length < MIN_SECRET_LENGTH) {
                    continue;
                }

                const sensitiveMatch: SensitiveMatch = {
                    range: new vscode.Range(startPos, endPos),
                    type: patternDef.type,
                    originalValue: match[0],
                    confidence: patternDef.minConfidence,
                    isMasked: true,
                    id: `${document.uri.toString()}-${match.index}-${match[0].length}`,
                    keyName: this.findKeyName(text, match.index)
                };

                // Check if this match overlaps with existing matches
                const overlaps = matches.some(m =>
                    this.rangesOverlap(m.range, sensitiveMatch.range)
                );

                if (!overlaps) {
                    matches.push(sensitiveMatch);
                }
            }
        }

        return matches;
    }

    /**
     * Check if a string matches any sensitive keyword
     */
    public matchesSensitiveKeyword(text: string): boolean {
        const lowerText = text.toLowerCase();
        return SENSITIVE_KEYWORDS.some(keyword =>
            lowerText.includes(keyword.toLowerCase())
        );
    }

    /**
     * Find the variable/key name associated with a match
     */
    private findKeyName(text: string, matchIndex: number): string | undefined {
        // Look backwards from match to find assignment
        const lineStart = text.lastIndexOf('\n', matchIndex) + 1;
        const beforeMatch = text.substring(lineStart, matchIndex);

        // Common patterns: KEY=value, "key": value, key: value
        const assignmentPatterns = [
            /([A-Za-z_][A-Za-z0-9_]*)\s*[:=]\s*["']?$/,
            /"([^"]+)"\s*:\s*["']?$/,
            /'([^']+)'\s*:\s*["']?$/
        ];

        for (const pattern of assignmentPatterns) {
            const match = beforeMatch.match(pattern);
            if (match) {
                return match[1];
            }
        }

        return undefined;
    }

    /**
     * Check if two ranges overlap
     */
    private rangesOverlap(range1: vscode.Range, range2: vscode.Range): boolean {
        return range1.start.isBefore(range2.end) && range2.start.isBefore(range1.end);
    }
}

/**
 * Create a global pattern matcher instance
 */
export const patternMatcher = new PatternMatcher();
