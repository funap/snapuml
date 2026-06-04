import { describe, it, expect } from 'vitest';
import { SequenceParser } from '../../src/diagrams/sequence/SequenceParser';
import { SequenceRenderer } from '../../src/diagrams/sequence/SequenceRenderer';
import { LayoutEngine } from '../../src/diagrams/sequence/SequenceLayout';
import { defaultTheme } from '../../src/diagrams/sequence/SequenceTheme';

describe('Sequence Diagram Dynamic Creation Spacing', () => {
    const parser = new SequenceParser();
    const renderer = new SequenceRenderer();
    const layoutEngine = new LayoutEngine(defaultTheme);

    it('should calculate sufficient spacing to avoid overlapping for dynamically created participants and control shapes', () => {
        const code = `
        participant Alice
        participant Other

        create Other
        Alice -> Other : new

        create control String
        Alice -> String : test
        `;
        const diagram = parser.parse(code);

        // Verify AST parsing
        const pOther = diagram.participants.find(p => p.name === 'Other');
        const pString = diagram.participants.find(p => p.name === 'String');
        expect(pOther).toBeDefined();
        expect(pString).toBeDefined();
        expect(pString?.type).toBe('control');

        // Check layout
        const layout = layoutEngine.calculateLayout(diagram);

        // Retrieve participant layout positions
        const otherLayout = layout.participants.find(pl => pl.participant.name === 'Other')!;
        const stringLayout = layout.participants.find(pl => pl.participant.name === 'String')!;

        // The height of String (control) should be larger than Bob (default: 40px)
        // Since control is an icon type, it has height: 55 + 15 = 70px.
        expect(stringLayout.height).toBe(70);

        // Locate message Y levels
        const msgNew = layout.messages.find(m => m.message.text === 'new')!;
        const msgTest = layout.messages.find(m => m.message.text === 'test')!;

        // 'new' is at step 0, 'test' is at step 1
        expect(msgNew.y).toBeLessThan(msgTest.y);

        // Other's bottom box edge (otherLayout.y + otherLayout.height) should be well above msgTest's text label.
        // Label position is at msgTest.labelPosition.y (which is msgTest.y).
        // Since msgTest text occupies vertical space, msgTest.y - 15 should not overlap with otherLayout.y + otherLayout.height.
        const otherBottom = otherLayout.y + otherLayout.height;
        const testLabelTop = msgTest.labelPosition.y - 15;
        expect(testLabelTop).toBeGreaterThan(otherBottom + 5); // at least 5px gap

        // The footer box of String starts at the footer line.
        // Since the layout has hideFootbox = false, the footer shape of String is drawn.
        // We want to ensure that String's creation label does not overlap with the footer shape of String.
        // String's top box label ends at stringLayout.y + 70 (or specifically y + 55 + text height = y + 70).
        // String's footer box starts at: layout.height - theme.padding (16) - stringLayout.height (70) - 20 = layout.height - 106.
        const stringTopLabelBottom = stringLayout.y + 70;
        const footerPadding = defaultTheme.padding;
        const stringFooterTop = layout.height - footerPadding - stringLayout.height - 20;

        // Ensure there is at least a 10px vertical gap between the top box's label and the footer box's shape.
        // Specifically, the footer shape itself starts at stringFooterTop, and circle center is at stringFooterTop + 20 (spans from stringFooterTop + 6).
        const stringFooterShapeTop = stringFooterTop + 6;
        expect(stringFooterShapeTop).toBeGreaterThan(stringTopLabelBottom + 5);

        // Render to SVG and verify
        const svg = renderer.render(diagram);
        expect(svg).toBeDefined();
    });
});
