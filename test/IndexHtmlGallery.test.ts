import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('index.html Gallery Tabs', () => {
    const htmlPath = path.resolve(__dirname, '../index.html');
    const html = fs.readFileSync(htmlPath, 'utf-8');

    it('should have a tab content container for wire diagrams with gallery-wire grid', () => {
        expect(html).toContain('id="wire-tab"');
        expect(html).toContain('id="gallery-wire"');
    });

    it('should handle wire tab switching in switchTab function', () => {
        // Must contain handling for switchTab('wire')
        expect(html).toMatch(/else\s+if\s*\(\s*type\s*===\s*['"]wire['"]\s*\)/);
        expect(html).toContain("document.getElementById('wire-tab').classList.add('active')");
    });
});
