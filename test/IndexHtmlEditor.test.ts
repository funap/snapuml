import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('index.html Editor Styles', () => {
    const htmlPath = path.resolve(__dirname, '../index.html');
    const html = fs.readFileSync(htmlPath, 'utf-8');

    it('should disable ligatures for the editor textarea', () => {
        // Ligatures in PlantUML make arrows like -> and --> hard to distinguish.
        // The editor textarea must have font-variant-ligatures: none and calt/liga disabled.
        expect(html).toMatch(/textarea\s*\{[^}]*font-variant-ligatures:\s*none/);
        expect(html).toMatch(/textarea\s*\{[^}]*font-feature-settings:\s*["']liga["']\s*0,\s*["']calt["']\s*0/);
    });
});
