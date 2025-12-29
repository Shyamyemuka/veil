// Types and interfaces for VEIL extension

import * as vscode from 'vscode';

/**
 * Represents a detected sensitive match in the document
 */
export interface SensitiveMatch {
    /** The range of the sensitive value in the document */
    range: vscode.Range;
    /** The type of secret detected */
    type: SecretType;
    /** Original value (for reveal functionality) */
    originalValue: string;
    /** Confidence score (0-100) */
    confidence: number;
    /** Whether this match is currently masked */
    isMasked: boolean;
    /** Unique identifier for this match */
    id: string;
    /** The variable/key name if detected */
    keyName?: string;
}

/**
 * Types of secrets that can be detected
 */
export enum SecretType {
    AWS_ACCESS_KEY = 'AWS Access Key',
    AWS_SECRET_KEY = 'AWS Secret Key',
    STRIPE_LIVE_KEY = 'Stripe Live Key',
    STRIPE_TEST_KEY = 'Stripe Test Key',
    GITHUB_PAT = 'GitHub Personal Access Token',
    GITHUB_FINE_GRAINED = 'GitHub Fine-grained PAT',
    GOOGLE_API_KEY = 'Google API Key',
    FIREBASE_KEY = 'Firebase Key',
    SUPABASE_KEY = 'Supabase Key',
    JWT = 'JSON Web Token',
    PRIVATE_KEY = 'Private Key',
    GENERIC_SECRET = 'Generic Secret',
    CUSTOM_PATTERN = 'Custom Pattern',
    URL_SENSITIVE = 'Sensitive URL',
    ENV_VALUE = 'Environment Variable'
}

/**
 * User-defined custom pattern
 */
export interface CustomPattern {
    name: string;
    pattern: string;
    description?: string;
}

/**
 * VEIL extension settings
 */
export interface VeilSettings {
    enabled: boolean;
    screenShareMode: boolean;
    maskCharacter: string;
    hoverToReveal: boolean;
    revealDuration: number;
    maskUrls: boolean;
    customPatterns: CustomPattern[];
    hiddenVariables: string[];
    hiddenStrings: string[];
}

/**
 * State for a document's masking
 */
export interface DocumentMaskState {
    /** URI of the document */
    uri: string;
    /** Whether the entire file is masked */
    fileMasked: boolean;
    /** Map of match IDs to their masked state */
    matchStates: Map<string, boolean>;
    /** All detected matches in this document */
    matches: SensitiveMatch[];
    /** Last scan timestamp */
    lastScan: number;
}

/**
 * Pattern definition for detection
 */
export interface PatternDefinition {
    name: string;
    type: SecretType;
    pattern: RegExp;
    description: string;
    /** Minimum confidence score for this pattern */
    minConfidence: number;
}

/**
 * Context information for detection
 */
export interface DetectionContext {
    /** The file language ID */
    languageId: string;
    /** The file name */
    fileName: string;
    /** The file extension */
    fileExtension: string;
    /** Whether this is a config file */
    isConfigFile: boolean;
    /** Whether this is an env file */
    isEnvFile: boolean;
}

/**
 * Toggle state for UI
 */
export interface ToggleState {
    isEnabled: boolean;
    isScreenShareMode: boolean;
    secretCount: number;
    maskedCount: number;
}
