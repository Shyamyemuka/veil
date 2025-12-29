// Pattern detection tests for VEIL extension

import * as assert from 'assert';
import * as vscode from 'vscode';
import { PatternMatcher } from '../../detection/patterns';
import { SecretType } from '../../utils/types';

suite('Pattern Detection Tests', () => {
    let patternMatcher: PatternMatcher;

    setup(() => {
        patternMatcher = new PatternMatcher();
    });

    suite('AWS Key Detection', () => {
        test('should detect AWS Access Key ID', async () => {
            const content = 'AWS_KEY=AKIAIOSFODNN7EXAMPLE';
            const doc = await vscode.workspace.openTextDocument({ content });
            const matches = patternMatcher.findMatches(content, doc);

            assert.strictEqual(matches.length, 1);
            assert.strictEqual(matches[0].type, SecretType.AWS_ACCESS_KEY);
            assert.strictEqual(matches[0].originalValue, 'AKIAIOSFODNN7EXAMPLE');
        });

        test('should not detect invalid AWS key', async () => {
            const content = 'NOT_AWS=AKIA123'; // Too short
            const doc = await vscode.workspace.openTextDocument({ content });
            const matches = patternMatcher.findMatches(content, doc);

            // Should not match incomplete AWS key
            const awsMatches = matches.filter(m => m.type === SecretType.AWS_ACCESS_KEY);
            assert.strictEqual(awsMatches.length, 0);
        });
    });

    suite('Stripe Key Detection', () => {
        test('should detect Stripe live key', async () => {
            const content = 'STRIPE_KEY=sk_live_EXAMPLE_1234567890123456';
            const doc = await vscode.workspace.openTextDocument({ content });
            const matches = patternMatcher.findMatches(content, doc);

            const stripeMatches = matches.filter(m => m.type === SecretType.STRIPE_LIVE_KEY);
            assert.strictEqual(stripeMatches.length, 1);
            assert.ok(stripeMatches[0].originalValue.startsWith('sk_live_'));
        });

        test('should detect Stripe test key', async () => {
            const content = 'STRIPE_TEST=sk_test_EXAMPLE_1234567890123456';
            const doc = await vscode.workspace.openTextDocument({ content });
            const matches = patternMatcher.findMatches(content, doc);

            const stripeMatches = matches.filter(m => m.type === SecretType.STRIPE_TEST_KEY);
            assert.strictEqual(stripeMatches.length, 1);
            assert.ok(stripeMatches[0].originalValue.startsWith('sk_test_'));
        });
    });

    suite('GitHub Token Detection', () => {
        test('should detect GitHub PAT', async () => {
            const content = 'GITHUB_TOKEN=ghp_abcdefghijklmnopqrstuvwxyz1234567890';
            const doc = await vscode.workspace.openTextDocument({ content });
            const matches = patternMatcher.findMatches(content, doc);

            const ghMatches = matches.filter(m => m.type === SecretType.GITHUB_PAT);
            assert.strictEqual(ghMatches.length, 1);
            assert.ok(ghMatches[0].originalValue.startsWith('ghp_'));
        });

        test('should detect GitHub fine-grained PAT', async () => {
            const content = 'TOKEN=github_pat_1234567890abcdefghij_abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnopqrstuvwxyz12345';
            const doc = await vscode.workspace.openTextDocument({ content });
            const matches = patternMatcher.findMatches(content, doc);

            const ghMatches = matches.filter(m => m.type === SecretType.GITHUB_FINE_GRAINED);
            assert.strictEqual(ghMatches.length, 1);
        });
    });

    suite('Google/Firebase API Key Detection', () => {
        test('should detect Google API key', async () => {
            const content = 'GOOGLE_API_KEY=AIzaSyC123456789012345678901234567890';
            const doc = await vscode.workspace.openTextDocument({ content });
            const matches = patternMatcher.findMatches(content, doc);

            const googleMatches = matches.filter(m => m.type === SecretType.GOOGLE_API_KEY);
            assert.strictEqual(googleMatches.length, 1);
            assert.ok(googleMatches[0].originalValue.startsWith('AIza'));
        });
    });

    suite('JWT Detection', () => {
        test('should detect JWT token', async () => {
            const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
            const content = `TOKEN=${jwt}`;
            const doc = await vscode.workspace.openTextDocument({ content });
            const matches = patternMatcher.findMatches(content, doc);

            const jwtMatches = matches.filter(m => m.type === SecretType.JWT);
            assert.strictEqual(jwtMatches.length, 1);
            assert.ok(jwtMatches[0].originalValue.startsWith('eyJ'));
        });
    });

    suite('Private Key Detection', () => {
        test('should detect RSA private key header', async () => {
            const content = '-----BEGIN RSA PRIVATE KEY-----\nMIIEpA...';
            const doc = await vscode.workspace.openTextDocument({ content });
            const matches = patternMatcher.findMatches(content, doc);

            const keyMatches = matches.filter(m => m.type === SecretType.PRIVATE_KEY);
            assert.strictEqual(keyMatches.length, 1);
        });

        test('should detect EC private key header', async () => {
            const content = '-----BEGIN EC PRIVATE KEY-----\nMHQC...';
            const doc = await vscode.workspace.openTextDocument({ content });
            const matches = patternMatcher.findMatches(content, doc);

            const keyMatches = matches.filter(m => m.type === SecretType.PRIVATE_KEY);
            assert.strictEqual(keyMatches.length, 1);
        });
    });

    suite('Sensitive Keyword Detection', () => {
        test('should recognize sensitive keywords', () => {
            assert.ok(patternMatcher.matchesSensitiveKeyword('API_KEY'));
            assert.ok(patternMatcher.matchesSensitiveKeyword('secret'));
            assert.ok(patternMatcher.matchesSensitiveKeyword('password'));
            assert.ok(patternMatcher.matchesSensitiveKeyword('access_token'));
            assert.ok(patternMatcher.matchesSensitiveKeyword('jwt'));
        });

        test('should not match non-sensitive keywords', () => {
            assert.ok(!patternMatcher.matchesSensitiveKeyword('username'));
            assert.ok(!patternMatcher.matchesSensitiveKeyword('email'));
            assert.ok(!patternMatcher.matchesSensitiveKeyword('name'));
        });
    });

    suite('Custom Pattern Support', () => {
        test('should match custom patterns', async () => {
            patternMatcher.setCustomPatterns([
                { name: 'Test Pattern', pattern: 'custom_secret_[a-z0-9]{10}' }
            ]);

            const content = 'MY_SECRET=custom_secret_abc1234567';
            const doc = await vscode.workspace.openTextDocument({ content });
            const matches = patternMatcher.findMatches(content, doc);

            const customMatches = matches.filter(m => m.type === SecretType.CUSTOM_PATTERN);
            assert.strictEqual(customMatches.length, 1);
        });
    });
});
