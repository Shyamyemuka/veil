// Constants and default values for VEIL extension

import { SecretType, PatternDefinition } from './types';

/**
 * Default mask character
 */
export const DEFAULT_MASK_CHAR = '•';

/**
 * Default reveal duration in milliseconds
 */
export const DEFAULT_REVEAL_DURATION = 5000;

/**
 * Minimum length for a potential secret value
 */
export const MIN_SECRET_LENGTH = 8;

/**
 * File extensions that are considered config files
 */
export const CONFIG_FILE_EXTENSIONS = [
    '.json',
    '.yaml',
    '.yml',
    '.toml',
    '.ini',
    '.conf',
    '.config'
];

/**
 * File names that are considered config files
 */
export const CONFIG_FILE_NAMES = [
    'config',
    'settings',
    'secrets',
    'credentials',
    '.env',
    '.env.local',
    '.env.development',
    '.env.production',
    '.env.test'
];

/**
 * Keywords that indicate a sensitive variable name
 */
export const SENSITIVE_KEYWORDS = [
    'api_key',
    'apikey',
    'api-key',
    'secret',
    'token',
    'password',
    'passwd',
    'pwd',
    'credentials',
    'auth',
    'authorization',
    'private',
    'access_key',
    'accesskey',
    'secret_key',
    'secretkey',
    'auth_token',
    'authtoken',
    'bearer',
    'jwt',
    'session',
    'cookie',
    'encryption',
    'decrypt',
    'encrypt',
    'key',
    'cert',
    'certificate',
    'ssl',
    'tls',
    'oauth',
    'client_id',
    'client_secret',
    'refresh_token',
    'id_token',
    'stripe',
    'aws',
    'azure',
    'gcp',
    'firebase',
    'supabase',
    'github',
    'gitlab',
    'bitbucket',
    'npm_token',
    'database_url',
    'db_password',
    'mongo_uri',
    'redis_url',
    'connection_string',
    'url',
    'uri',
    'endpoint',
    'host',
    'anon'
];

/**
 * Pattern definitions for secret detection
 */
export const PATTERN_DEFINITIONS: PatternDefinition[] = [
    // AWS
    {
        name: 'AWS Access Key ID',
        type: SecretType.AWS_ACCESS_KEY,
        pattern: /AKIA[0-9A-Z]{16}/g,
        description: 'AWS Access Key ID starting with AKIA',
        minConfidence: 95
    },
    {
        name: 'AWS Secret Access Key',
        type: SecretType.AWS_SECRET_KEY,
        pattern: /(?<![A-Za-z0-9/+=])[A-Za-z0-9/+=]{40}(?![A-Za-z0-9/+=])/g,
        description: 'AWS Secret Access Key (40 character base64)',
        minConfidence: 60 // Needs context to confirm
    },

    // Stripe
    {
        name: 'Stripe Live Secret Key',
        type: SecretType.STRIPE_LIVE_KEY,
        pattern: /sk_live_[0-9a-zA-Z]{24,}/g,
        description: 'Stripe live secret key',
        minConfidence: 98
    },
    {
        name: 'Stripe Test Secret Key',
        type: SecretType.STRIPE_TEST_KEY,
        pattern: /sk_test_[0-9a-zA-Z]{24,}/g,
        description: 'Stripe test secret key',
        minConfidence: 98
    },
    {
        name: 'Stripe Publishable Key',
        type: SecretType.STRIPE_LIVE_KEY,
        pattern: /pk_live_[0-9a-zA-Z]{24,}/g,
        description: 'Stripe live publishable key',
        minConfidence: 90
    },
    {
        name: 'Stripe Restricted Key',
        type: SecretType.STRIPE_LIVE_KEY,
        pattern: /rk_live_[0-9a-zA-Z]{24,}/g,
        description: 'Stripe live restricted key',
        minConfidence: 98
    },

    // GitHub
    {
        name: 'GitHub Personal Access Token',
        type: SecretType.GITHUB_PAT,
        pattern: /ghp_[0-9a-zA-Z]{36}/g,
        description: 'GitHub personal access token',
        minConfidence: 99
    },
    {
        name: 'GitHub Fine-grained PAT',
        type: SecretType.GITHUB_FINE_GRAINED,
        pattern: /github_pat_[0-9a-zA-Z]{22}_[0-9a-zA-Z]{59}/g,
        description: 'GitHub fine-grained personal access token',
        minConfidence: 99
    },
    {
        name: 'GitHub OAuth Access Token',
        type: SecretType.GITHUB_PAT,
        pattern: /gho_[0-9a-zA-Z]{36}/g,
        description: 'GitHub OAuth access token',
        minConfidence: 99
    },
    {
        name: 'GitHub User-to-Server Token',
        type: SecretType.GITHUB_PAT,
        pattern: /ghu_[0-9a-zA-Z]{36}/g,
        description: 'GitHub user-to-server token',
        minConfidence: 99
    },
    {
        name: 'GitHub Server-to-Server Token',
        type: SecretType.GITHUB_PAT,
        pattern: /ghs_[0-9a-zA-Z]{36}/g,
        description: 'GitHub server-to-server token',
        minConfidence: 99
    },
    {
        name: 'GitHub Refresh Token',
        type: SecretType.GITHUB_PAT,
        pattern: /ghr_[0-9a-zA-Z]{36}/g,
        description: 'GitHub refresh token',
        minConfidence: 99
    },

    // Google/Firebase
    {
        name: 'Google API Key',
        type: SecretType.GOOGLE_API_KEY,
        pattern: /AIza[0-9A-Za-z\-_]{35}/g,
        description: 'Google/Firebase API key',
        minConfidence: 95
    },

    // JWT
    {
        name: 'JSON Web Token',
        type: SecretType.JWT,
        pattern: /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
        description: 'JSON Web Token (JWT)',
        minConfidence: 90
    },

    // Private Keys
    {
        name: 'Private Key Block',
        type: SecretType.PRIVATE_KEY,
        pattern: /-----BEGIN\s+(?:RSA\s+|EC\s+|DSA\s+|OPENSSH\s+)?PRIVATE\s+KEY-----/g,
        description: 'Private key header',
        minConfidence: 99
    },

    // Generic patterns
    {
        name: 'Bearer Token',
        type: SecretType.GENERIC_SECRET,
        pattern: /Bearer\s+[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+/gi,
        description: 'Bearer authentication token',
        minConfidence: 85
    },
    {
        name: 'Basic Auth',
        type: SecretType.GENERIC_SECRET,
        pattern: /Basic\s+[A-Za-z0-9+/=]{20,}/gi,
        description: 'Basic authentication credentials',
        minConfidence: 80
    },

    // NPM
    {
        name: 'NPM Token',
        type: SecretType.GENERIC_SECRET,
        pattern: /npm_[A-Za-z0-9]{36}/g,
        description: 'NPM access token',
        minConfidence: 98
    },

    // Slack
    {
        name: 'Slack Token',
        type: SecretType.GENERIC_SECRET,
        pattern: /xox[baprs]-[0-9]{10,13}-[0-9]{10,13}[a-zA-Z0-9-]*/g,
        description: 'Slack bot/app token',
        minConfidence: 95
    },

    // Discord
    {
        name: 'Discord Bot Token',
        type: SecretType.GENERIC_SECRET,
        pattern: /[MN][A-Za-z\d]{23,}\.[\w-]{6}\.[\w-]{27}/g,
        description: 'Discord bot token',
        minConfidence: 90
    },

    // SendGrid
    {
        name: 'SendGrid API Key',
        type: SecretType.GENERIC_SECRET,
        pattern: /SG\.[A-Za-z0-9\-_]{22}\.[A-Za-z0-9\-_]{43}/g,
        description: 'SendGrid API key',
        minConfidence: 98
    },

    // Twilio
    {
        name: 'Twilio API Key',
        type: SecretType.GENERIC_SECRET,
        pattern: /SK[a-f0-9]{32}/g,
        description: 'Twilio API key',
        minConfidence: 85
    },

    // Mailchimp
    {
        name: 'Mailchimp API Key',
        type: SecretType.GENERIC_SECRET,
        pattern: /[a-f0-9]{32}-us[0-9]{1,2}/g,
        description: 'Mailchimp API key',
        minConfidence: 90
    },

    // Heroku
    {
        name: 'Heroku API Key',
        type: SecretType.GENERIC_SECRET,
        pattern: /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/g,
        description: 'Heroku API key (UUID format)',
        minConfidence: 50 // Low because UUIDs are common
    },

    // Generic hex secrets
    {
        name: 'Generic Hex Secret',
        type: SecretType.GENERIC_SECRET,
        pattern: /[a-fA-F0-9]{32,64}/g,
        description: 'Generic hex-encoded secret',
        minConfidence: 30 // Very low, needs context
    }
];

/**
 * URL pattern for screen share mode
 */
export const URL_PATTERN = /https?:\/\/([a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}(\/[^\s]*)?/g;

/**
 * Assignment operators for context detection
 */
export const ASSIGNMENT_OPERATORS = ['=', ':', '=>', '=='];

/**
 * Status bar item priority
 */
export const STATUS_BAR_PRIORITY = 100;

/**
 * Extension name for configuration
 */
export const EXTENSION_NAME = 'veil';

/**
 * Colors for UI
 */
export const COLORS = {
    masked: '#ff6b6b',
    revealed: '#51cf66',
    warning: '#ffd43b',
    screenShare: '#ff4757'
};
