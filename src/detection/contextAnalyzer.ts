// Context-aware detection for VEIL extension

import * as vscode from 'vscode';
import {
    CONFIG_FILE_EXTENSIONS,
    CONFIG_FILE_NAMES,
    SENSITIVE_KEYWORDS,
    ASSIGNMENT_OPERATORS,
    MIN_SECRET_LENGTH
} from '../utils/constants';
import { SensitiveMatch, SecretType, DetectionContext } from '../utils/types';
import * as path from 'path';

/**
 * Context Analyzer for detecting secrets based on surrounding context
 */
export class ContextAnalyzer {
    /**
     * Get detection context for a document
     */
    public getContext(document: vscode.TextDocument): DetectionContext {
        const fileName = path.basename(document.fileName);
        const fileExtension = path.extname(document.fileName).toLowerCase();

        const isConfigFile = this.isConfigFile(fileName, fileExtension);
        const isEnvFile = this.isEnvFile(fileName);

        return {
            languageId: document.languageId,
            fileName,
            fileExtension,
            isConfigFile,
            isEnvFile
        };
    }

    /**
     * Check if file is a config file
     */
    private isConfigFile(fileName: string, extension: string): boolean {
        const lowerName = fileName.toLowerCase();

        // Check extension
        if (CONFIG_FILE_EXTENSIONS.includes(extension)) {
            return true;
        }

        // Check name patterns
        return CONFIG_FILE_NAMES.some(name =>
            lowerName.includes(name.toLowerCase())
        );
    }

    /**
     * Check if file is an env file
     */
    private isEnvFile(fileName: string): boolean {
        const lowerName = fileName.toLowerCase();
        return lowerName.startsWith('.env') ||
            lowerName === 'env' ||
            lowerName.endsWith('.env');
    }

    /**
     * Find context-based sensitive matches (key=value patterns)
     */
    public findContextMatches(document: vscode.TextDocument): SensitiveMatch[] {
        const matches: SensitiveMatch[] = [];
        const context = this.getContext(document);
        const text = document.getText();

        // Different strategies based on file type
        if (context.isEnvFile) {
            this.findEnvMatches(document, text, matches);
        } else if (context.languageId === 'json' || context.fileExtension === '.json') {
            this.findJsonMatches(document, text, matches);
        } else if (context.languageId === 'yaml' || context.fileExtension === '.yaml' || context.fileExtension === '.yml') {
            this.findYamlMatches(document, text, matches);
        } else {
            // Generic code files
            this.findGenericMatches(document, text, matches);
        }

        return matches;
    }

    /**
     * Find matches in .env files
     */
    private findEnvMatches(document: vscode.TextDocument, text: string, matches: SensitiveMatch[]): void {
        const lines = text.split('\n');
        let offset = 0;

        for (let lineNum = 0; lineNum < lines.length; lineNum++) {
            const originalLine = lines[lineNum];
            let line = originalLine;

            // Handle Windows CRLF - remove trailing \r for processing
            if (line.endsWith('\r')) {
                line = line.slice(0, -1);
            }

            // Skip comments and empty lines
            if (line.trim().startsWith('#') || line.trim() === '') {
                offset += originalLine.length + 1;
                continue;
            }

            // Match KEY=value pattern - capture the position of = sign
            const equalsIndex = line.indexOf('=');
            if (equalsIndex === -1) {
                offset += originalLine.length + 1;
                continue;
            }

            const keyName = line.substring(0, equalsIndex).trim();
            const rawValue = line.substring(equalsIndex + 1);

            // Validate key name format
            if (!keyName.match(/^[A-Za-z_][A-Za-z0-9_]*$/)) {
                offset += originalLine.length + 1;
                continue;
            }

            // Get value without leading/trailing whitespace for checking
            const value = rawValue.trim();

            // Remove quotes if present for sensitivity check
            let valueForCheck = value;
            if ((value.startsWith('"') && value.endsWith('"')) ||
                (value.startsWith("'") && value.endsWith("'"))) {
                valueForCheck = value.slice(1, -1);
            }

            // Check if this looks sensitive
            if (this.isSensitiveKeyName(keyName) || valueForCheck.length >= MIN_SECRET_LENGTH) {
                // Calculate exact position AFTER the = sign
                const valueStart = equalsIndex + 1;
                const valueEnd = line.length;

                const startPos = document.positionAt(offset + valueStart);
                const endPos = document.positionAt(offset + valueEnd);

                matches.push({
                    range: new vscode.Range(startPos, endPos),
                    type: SecretType.ENV_VALUE,
                    originalValue: rawValue,
                    confidence: this.isSensitiveKeyName(keyName) ? 85 : 50,
                    isMasked: true,
                    id: `${document.uri.toString()}-env-${lineNum}`,
                    keyName
                });
            }

            offset += originalLine.length + 1;
        }
    }

    /**
     * Find matches in JSON files
     */
    private findJsonMatches(document: vscode.TextDocument, text: string, matches: SensitiveMatch[]): void {
        // Match "key": "value" patterns
        const jsonPattern = /"([^"]+)"\s*:\s*"([^"]+)"/g;
        let match: RegExpExecArray | null;

        while ((match = jsonPattern.exec(text)) !== null) {
            const keyName = match[1];
            const value = match[2];

            if (this.isSensitiveKeyName(keyName) && value.length >= MIN_SECRET_LENGTH) {
                // Find the value position (after the colon and opening quote)
                const valueStart = match.index + match[0].lastIndexOf('"' + value + '"') + 1;
                const startPos = document.positionAt(valueStart);
                const endPos = document.positionAt(valueStart + value.length);

                matches.push({
                    range: new vscode.Range(startPos, endPos),
                    type: SecretType.GENERIC_SECRET,
                    originalValue: value,
                    confidence: 75,
                    isMasked: true,
                    id: `${document.uri.toString()}-json-${match.index}`,
                    keyName
                });
            }
        }
    }

    /**
     * Find matches in YAML files
     */
    private findYamlMatches(document: vscode.TextDocument, text: string, matches: SensitiveMatch[]): void {
        const lines = text.split('\n');
        let offset = 0;

        for (let lineNum = 0; lineNum < lines.length; lineNum++) {
            const line = lines[lineNum];

            // Skip comments
            if (line.trim().startsWith('#')) {
                offset += line.length + 1;
                continue;
            }

            // Match key: value pattern
            const yamlMatch = line.match(/^(\s*)([A-Za-z_][A-Za-z0-9_-]*)\s*:\s*(.+)$/);
            if (yamlMatch) {
                const keyName = yamlMatch[2];
                let value = yamlMatch[3].trim();

                // Remove quotes if present
                if ((value.startsWith('"') && value.endsWith('"')) ||
                    (value.startsWith("'") && value.endsWith("'"))) {
                    value = value.slice(1, -1);
                }

                if (this.isSensitiveKeyName(keyName) && value.length >= MIN_SECRET_LENGTH) {
                    const valueStart = line.indexOf(yamlMatch[3]);
                    const startPos = document.positionAt(offset + valueStart);
                    const endPos = document.positionAt(offset + valueStart + yamlMatch[3].length);

                    matches.push({
                        range: new vscode.Range(startPos, endPos),
                        type: SecretType.GENERIC_SECRET,
                        originalValue: yamlMatch[3],
                        confidence: 70,
                        isMasked: true,
                        id: `${document.uri.toString()}-yaml-${lineNum}`,
                        keyName
                    });
                }
            }

            offset += line.length + 1;
        }
    }

    /**
     * Find matches in generic code files
     */
    private findGenericMatches(document: vscode.TextDocument, text: string, matches: SensitiveMatch[]): void {
        // Pattern for variable assignments with string values
        const patterns = [
            // const API_KEY = "value" or let secret = 'value' or const token = `value`
            /(?:const|let|var)\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*["'`]([^"'`]+)["'`]/g,
            // this.apiKey = "value" or obj.secret = 'value' or obj.token = `value`
            /\.([A-Za-z_][A-Za-z0-9_]*)\s*=\s*["'`]([^"'`]+)["'`]/g,
            // { apiKey: "value" } or { secret: 'value' } or { token: `value` }
            /([A-Za-z_][A-Za-z0-9_]*)\s*:\s*["'`]([^"'`]+)["'`]/g,
            // export const API_KEY = "value" - with export keyword
            /export\s+(?:const|let|var)\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*["'`]([^"'`]+)["'`]/g,
            // process.env.API_KEY handling - look for sensitive env access patterns
            /process\.env\.([A-Za-z_][A-Za-z0-9_]*)/g
        ];

        for (const pattern of patterns) {
            pattern.lastIndex = 0;
            let match: RegExpExecArray | null;

            while ((match = pattern.exec(text)) !== null) {
                const keyName = match[1];
                const value = match[2];

                // Special case for process.env patterns - just mark the variable access
                if (!value && keyName) {
                    // This is a process.env access, skip for now as the actual value is external
                    continue;
                }

                if (this.isSensitiveKeyName(keyName) && value && value.length >= MIN_SECRET_LENGTH) {
                    // Find value position - locate the exact position of the value in the match
                    const fullMatch = match[0];
                    const valueInMatch = fullMatch.lastIndexOf(value);
                    const valueStart = match.index + valueInMatch;

                    const startPos = document.positionAt(valueStart);
                    const endPos = document.positionAt(valueStart + value.length);

                    // Check if this range already exists or overlaps
                    const exists = matches.some(m =>
                        m.range.start.isEqual(startPos) && m.range.end.isEqual(endPos) ||
                        (m.range.start.isBefore(endPos) && startPos.isBefore(m.range.end))
                    );

                    if (!exists) {
                        matches.push({
                            range: new vscode.Range(startPos, endPos),
                            type: SecretType.GENERIC_SECRET,
                            originalValue: value,
                            confidence: 65,
                            isMasked: true,
                            id: `${document.uri.toString()}-generic-${match.index}`,
                            keyName
                        });
                    }
                }
            }
        }
    }

    /**
     * Check if a key name indicates sensitive data
     */
    public isSensitiveKeyName(keyName: string): boolean {
        const lowerKey = keyName.toLowerCase();
        return SENSITIVE_KEYWORDS.some(keyword =>
            lowerKey.includes(keyword.toLowerCase())
        );
    }

    /**
     * Calculate confidence boost based on context
     */
    public calculateConfidenceBoost(context: DetectionContext, keyName?: string): number {
        let boost = 0;

        // File type boosts
        if (context.isEnvFile) {
            boost += 20;
        }
        if (context.isConfigFile) {
            boost += 10;
        }

        // Key name boost
        if (keyName && this.isSensitiveKeyName(keyName)) {
            boost += 15;
        }

        return boost;
    }
}

/**
 * Export singleton instance
 */
export const contextAnalyzer = new ContextAnalyzer();
