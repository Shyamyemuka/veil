// Main detection engine coordinator

import * as vscode from 'vscode';
import { SensitiveMatch, DocumentMaskState, VeilSettings } from '../utils/types';
import { patternMatcher } from './patterns';
import { contextAnalyzer } from './contextAnalyzer';
import { customRulesManager } from './customRules';
import { EXTENSION_NAME } from '../utils/constants';

/**
 * Main Detection Engine that coordinates pattern, context, and custom rule detection
 */
export class DetectionEngine {
    private documentStates: Map<string, DocumentMaskState> = new Map();
    private settings: VeilSettings | null = null;

    constructor() {
        this.loadSettings();
    }

    /**
     * Load settings from VS Code configuration
     */
    public loadSettings(): void {
        const config = vscode.workspace.getConfiguration(EXTENSION_NAME);

        this.settings = {
            enabled: config.get<boolean>('enabled', true),
            screenShareMode: config.get<boolean>('screenShareMode', false),
            maskCharacter: config.get<string>('maskCharacter', '•'),
            hoverToReveal: config.get<boolean>('hoverToReveal', true),
            revealDuration: config.get<number>('revealDuration', 5000),
            maskUrls: config.get<boolean>('maskUrls', true),
            customPatterns: config.get('customPatterns', []),
            hiddenVariables: config.get('hiddenVariables', []),
            hiddenStrings: config.get('hiddenStrings', [])
        };

        // Update pattern matcher with custom patterns
        patternMatcher.setCustomPatterns(this.settings.customPatterns);

        // Reload custom rules
        customRulesManager.loadFromSettings();
    }

    /**
     * Get current settings
     */
    public getSettings(): VeilSettings | null {
        return this.settings;
    }

    /**
     * Scan a document for sensitive data
     */
    public scanDocument(document: vscode.TextDocument): SensitiveMatch[] {
        if (!this.settings?.enabled) {
            return [];
        }

        const text = document.getText();
        const uri = document.uri.toString();
        const context = contextAnalyzer.getContext(document);

        // Collect matches from all detection methods
        const allMatches: SensitiveMatch[] = [];

        // For .env files, prioritize context detection (full value) over pattern detection
        // This ensures we mask the entire value, not just JWT portions within it
        if (context.isEnvFile) {
            // 1. Context-aware detection first for env files
            const contextMatches = contextAnalyzer.findContextMatches(document);
            allMatches.push(...contextMatches);

            // 2. Pattern matches only for non-overlapping areas
            const patternMatches = patternMatcher.findMatches(text, document);
            for (const patternMatch of patternMatches) {
                const overlaps = allMatches.some(m => this.rangesOverlap(m.range, patternMatch.range));
                if (!overlaps) {
                    allMatches.push(patternMatch);
                }
            }
        } else {
            // For other files, patterns first (they're more specific)
            // 1. Pattern-based detection
            const patternMatches = patternMatcher.findMatches(text, document);
            allMatches.push(...patternMatches);

            // 2. Context-aware detection
            const contextMatches = contextAnalyzer.findContextMatches(document);

            // Only add context matches that don't overlap with pattern matches
            for (const contextMatch of contextMatches) {
                const overlaps = allMatches.some(m => this.rangesOverlap(m.range, contextMatch.range));
                if (!overlaps) {
                    allMatches.push(contextMatch);
                }
            }
        }

        // 3. Custom rules detection
        const customMatches = customRulesManager.findCustomMatches(document);

        // Add non-overlapping custom matches
        for (const customMatch of customMatches) {
            const overlaps = allMatches.some(m => this.rangesOverlap(m.range, customMatch.range));
            if (!overlaps) {
                allMatches.push(customMatch);
            }
        }

        // Apply confidence boost based on context (context already declared above)
        for (const match of allMatches) {
            const boost = contextAnalyzer.calculateConfidenceBoost(context, match.keyName);
            match.confidence = Math.min(100, match.confidence + boost);
        }

        // Sort matches by position
        allMatches.sort((a, b) => a.range.start.compareTo(b.range.start));

        // Update document state
        const existingState = this.documentStates.get(uri);
        this.documentStates.set(uri, {
            uri,
            fileMasked: existingState?.fileMasked ?? true,
            matchStates: this.mergeMatchStates(existingState?.matchStates, allMatches),
            matches: allMatches,
            lastScan: Date.now()
        });

        return allMatches;
    }

    /**
     * Merge existing match states with new matches
     */
    private mergeMatchStates(
        existingStates: Map<string, boolean> | undefined,
        newMatches: SensitiveMatch[]
    ): Map<string, boolean> {
        const newStates = new Map<string, boolean>();

        for (const match of newMatches) {
            // Preserve existing state if available, default to masked
            const existingState = existingStates?.get(match.id);
            newStates.set(match.id, existingState ?? true);
            match.isMasked = newStates.get(match.id) ?? true;
        }

        return newStates;
    }

    /**
     * Check if two ranges overlap
     */
    private rangesOverlap(range1: vscode.Range, range2: vscode.Range): boolean {
        return range1.start.isBefore(range2.end) && range2.start.isBefore(range1.end);
    }

    /**
     * Get document mask state
     */
    public getDocumentState(uri: string): DocumentMaskState | undefined {
        return this.documentStates.get(uri);
    }

    /**
     * Toggle mask state for a specific match
     */
    public toggleMatchMask(uri: string, matchId: string): boolean {
        const state = this.documentStates.get(uri);
        if (!state) {
            return false;
        }

        const currentState = state.matchStates.get(matchId) ?? true;
        state.matchStates.set(matchId, !currentState);

        // Update the match object
        const match = state.matches.find(m => m.id === matchId);
        if (match) {
            match.isMasked = !currentState;
        }

        return !currentState;
    }

    /**
     * Toggle mask state for entire file
     */
    public toggleFileMask(uri: string): boolean {
        const state = this.documentStates.get(uri);
        if (!state) {
            return true;
        }

        state.fileMasked = !state.fileMasked;

        // Update all match states to match file state
        for (const match of state.matches) {
            state.matchStates.set(match.id, state.fileMasked);
            match.isMasked = state.fileMasked;
        }

        return state.fileMasked;
    }

    /**
     * Mask all secrets in a document
     */
    public maskAll(uri: string): void {
        const state = this.documentStates.get(uri);
        if (!state) {
            return;
        }

        state.fileMasked = true;
        for (const match of state.matches) {
            state.matchStates.set(match.id, true);
            match.isMasked = true;
        }
    }

    /**
     * Reveal all secrets in a document
     */
    public revealAll(uri: string): void {
        const state = this.documentStates.get(uri);
        if (!state) {
            return;
        }

        state.fileMasked = false;
        for (const match of state.matches) {
            state.matchStates.set(match.id, false);
            match.isMasked = false;
        }
    }

    /**
     * Get matches for a document
     */
    public getMatches(uri: string): SensitiveMatch[] {
        return this.documentStates.get(uri)?.matches ?? [];
    }

    /**
     * Get count of masked secrets
     */
    public getMaskedCount(uri: string): number {
        const state = this.documentStates.get(uri);
        if (!state) {
            return 0;
        }
        return state.matches.filter(m => m.isMasked).length;
    }

    /**
     * Get total secret count
     */
    public getSecretCount(uri: string): number {
        return this.documentStates.get(uri)?.matches.length ?? 0;
    }

    /**
     * Clear all document states
     */
    public clearAllStates(): void {
        this.documentStates.clear();
    }

    /**
     * Clear state for a specific document
     */
    public clearDocumentState(uri: string): void {
        this.documentStates.delete(uri);
    }
}

/**
 * Export singleton instance
 */
export const detectionEngine = new DetectionEngine();
