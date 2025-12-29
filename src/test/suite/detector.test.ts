// Detection engine tests for VEIL extension

import * as assert from 'assert';
import * as vscode from 'vscode';
import { DetectionEngine } from '../../detection/detector';
import { ContextAnalyzer } from '../../detection/contextAnalyzer';
import { SecretType } from '../../utils/types';

suite('Detection Engine Tests', () => {
    let detectionEngine: DetectionEngine;
    let contextAnalyzer: ContextAnalyzer;

    setup(() => {
        detectionEngine = new DetectionEngine();
        contextAnalyzer = new ContextAnalyzer();
    });

    suite('Document Scanning', () => {
        test('should scan document and return matches', async () => {
            const content = `
                API_KEY=sk_live_EXAMPLE_9876543210987654
                DATABASE_URL=postgres://user:password@localhost:5432/db
            `;
            const doc = await vscode.workspace.openTextDocument({ content });
            const matches = detectionEngine.scanDocument(doc);

            assert.ok(matches.length > 0);
        });

        test('should detect multiple secret types', async () => {
            const content = `
                STRIPE_KEY=sk_live_EXAMPLE_1234567890123456
                GITHUB_TOKEN=ghp_abcdefghijklmnopqrstuvwxyz1234567890
                GOOGLE_KEY=AIzaSyC123456789012345678901234567890
            `;
            const doc = await vscode.workspace.openTextDocument({ content });
            const matches = detectionEngine.scanDocument(doc);

            const types = new Set(matches.map(m => m.type));
            assert.ok(types.has(SecretType.STRIPE_LIVE_KEY));
            assert.ok(types.has(SecretType.GITHUB_PAT));
            assert.ok(types.has(SecretType.GOOGLE_API_KEY));
        });
    });

    suite('Document State Management', () => {
        test('should store and retrieve document state', async () => {
            const content = 'SECRET=sk_live_EXAMPLE_1234567890123456';
            const doc = await vscode.workspace.openTextDocument({ content });

            detectionEngine.scanDocument(doc);
            const state = detectionEngine.getDocumentState(doc.uri.toString());

            assert.ok(state !== undefined);
            assert.ok(state!.matches.length > 0);
        });

        test('should toggle individual match mask state', async () => {
            const content = 'SECRET=sk_live_EXAMPLE_1234567890123456';
            const doc = await vscode.workspace.openTextDocument({ content });

            detectionEngine.scanDocument(doc);
            const uri = doc.uri.toString();
            const state = detectionEngine.getDocumentState(uri);
            const matchId = state!.matches[0].id;

            // Initially masked
            assert.strictEqual(state!.matches[0].isMasked, true);

            // Toggle to revealed
            detectionEngine.toggleMatchMask(uri, matchId);
            const updatedState = detectionEngine.getDocumentState(uri);
            assert.strictEqual(updatedState!.matches[0].isMasked, false);

            // Toggle back to masked
            detectionEngine.toggleMatchMask(uri, matchId);
            const finalState = detectionEngine.getDocumentState(uri);
            assert.strictEqual(finalState!.matches[0].isMasked, true);
        });

        test('should toggle file mask state', async () => {
            const content = `
                SECRET1=sk_live_EXAMPLE_1234567890123456
                SECRET2=ghp_abcdefghijklmnopqrstuvwxyz1234567890
            `;
            const doc = await vscode.workspace.openTextDocument({ content });

            detectionEngine.scanDocument(doc);
            const uri = doc.uri.toString();

            // Toggle file to revealed
            detectionEngine.toggleFileMask(uri);
            const state = detectionEngine.getDocumentState(uri);

            // All matches should be revealed
            for (const match of state!.matches) {
                assert.strictEqual(match.isMasked, false);
            }
        });

        test('should mask all secrets', async () => {
            const content = 'SECRET=sk_live_EXAMPLE_1234567890123456';
            const doc = await vscode.workspace.openTextDocument({ content });

            detectionEngine.scanDocument(doc);
            const uri = doc.uri.toString();

            // First reveal
            detectionEngine.revealAll(uri);
            let state = detectionEngine.getDocumentState(uri);
            assert.strictEqual(state!.matches[0].isMasked, false);

            // Then mask all
            detectionEngine.maskAll(uri);
            state = detectionEngine.getDocumentState(uri);
            assert.strictEqual(state!.matches[0].isMasked, true);
        });
    });

    suite('Secret Count', () => {
        test('should return correct secret count', async () => {
            const content = `
                KEY1=sk_live_EXAMPLE_1234567890123456
                KEY2=ghp_abcdefghijklmnopqrstuvwxyz1234567890
                KEY3=AIzaSyC123456789012345678901234567890
            `;
            const doc = await vscode.workspace.openTextDocument({ content });

            detectionEngine.scanDocument(doc);
            const count = detectionEngine.getSecretCount(doc.uri.toString());

            assert.strictEqual(count, 3);
        });

        test('should return correct masked count', async () => {
            const content = `
                KEY1=sk_live_EXAMPLE_1234567890123456
                KEY2=ghp_abcdefghijklmnopqrstuvwxyz1234567890
            `;
            const doc = await vscode.workspace.openTextDocument({ content });

            detectionEngine.scanDocument(doc);
            const uri = doc.uri.toString();

            // Initially all masked
            assert.strictEqual(detectionEngine.getMaskedCount(uri), 2);

            // Reveal one
            const state = detectionEngine.getDocumentState(uri);
            detectionEngine.toggleMatchMask(uri, state!.matches[0].id);

            assert.strictEqual(detectionEngine.getMaskedCount(uri), 1);
        });
    });
});

suite('Context Analyzer Tests', () => {
    let contextAnalyzer: ContextAnalyzer;

    setup(() => {
        contextAnalyzer = new ContextAnalyzer();
    });

    suite('Sensitive Key Name Detection', () => {
        test('should identify sensitive key names', () => {
            assert.ok(contextAnalyzer.isSensitiveKeyName('API_KEY'));
            assert.ok(contextAnalyzer.isSensitiveKeyName('apiKey'));
            assert.ok(contextAnalyzer.isSensitiveKeyName('secret'));
            assert.ok(contextAnalyzer.isSensitiveKeyName('password'));
            assert.ok(contextAnalyzer.isSensitiveKeyName('DATABASE_PASSWORD'));
            assert.ok(contextAnalyzer.isSensitiveKeyName('accessToken'));
            assert.ok(contextAnalyzer.isSensitiveKeyName('jwt_token'));
        });

        test('should not identify non-sensitive key names', () => {
            assert.ok(!contextAnalyzer.isSensitiveKeyName('username'));
            assert.ok(!contextAnalyzer.isSensitiveKeyName('email'));
            assert.ok(!contextAnalyzer.isSensitiveKeyName('displayName'));
            assert.ok(!contextAnalyzer.isSensitiveKeyName('count'));
        });
    });

    suite('File Context Detection', () => {
        test('should calculate confidence boost for env files', async () => {
            const content = 'KEY=value';
            const doc = await vscode.workspace.openTextDocument({
                content,
                language: 'plaintext'
            });

            // Mock the file name by checking the context behavior
            const context = contextAnalyzer.getContext(doc);
            const boost = contextAnalyzer.calculateConfidenceBoost(context, 'API_KEY');

            // Should get boost for sensitive key name
            assert.ok(boost >= 15);
        });
    });
});
