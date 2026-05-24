import { describe, it, expect } from 'vitest';
import { SequenceParser } from '../../src/diagrams/sequence/SequenceParser';
import { SequenceRenderer } from '../../src/diagrams/sequence/SequenceRenderer';
import { LayoutEngine } from '../../src/diagrams/sequence/SequenceLayout';
import { defaultTheme } from '../../src/diagrams/sequence/SequenceTheme';

describe('Sequence Diagram Nested Group Spacing', () => {
    const parser = new SequenceParser();
    const renderer = new SequenceRenderer();
    const layoutEngine = new LayoutEngine(defaultTheme);

    it('should calculate upward extensions for nested group boxes to prevent arrow collisions', () => {
        const code = `
        opt guard1
            Alice -> Log : label1
            opt guard2
                Alice -> Bob: label2
            end
        end
        `;
        const diagram = parser.parse(code);
        const layout = layoutEngine.calculateLayout(diagram);

        // Verify elements are parsed correctly
        expect(diagram.groups).toHaveLength(2);
        expect(diagram.messages).toHaveLength(2);

        const g1 = layout.groups.find(g => g.label === 'guard1')!;
        const g2 = layout.groups.find(g => g.label === 'guard2')!;
        const msg1 = layout.messages.find(m => m.message.text === 'label1')!;

        // msg1 is Alice -> Log : label1
        // g2 is the nested opt guard2
        // We expect g2 box top (y) to be strictly below msg1 arrow (y) with at least 10px spacing
        console.log('label1 Message Y:', msg1.y);
        console.log('opt guard2 Box Top Y:', g2.y);
        console.log('opt guard2 startStep:', g2.group.startStep);

        expect(g2.y).toBeGreaterThanOrEqual(msg1.y + 10);

        // Verify that the outer group guard1 top Y (g1.y) is below the participant boxes with at least 10px spacing
        const aliceLayout = layout.participants.find(p => p.participant.name === 'Alice')!;
        const participantBottom = aliceLayout.y + aliceLayout.height;
        console.log('Participant Bottom Y:', participantBottom);
        console.log('opt guard1 Box Top Y:', g1.y);

        expect(g1.y).toBeGreaterThanOrEqual(participantBottom + 10);
    });
});
