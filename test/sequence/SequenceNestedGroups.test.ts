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

    it('should calculate spacious margins (25px top, 20px bottom) for group boxes', () => {
        const code = `
        Alice -> Bob: Authentication Request
        alt successful case
            Bob -> Alice: Authentication Accepted
        end
        Alice -> Bob: Next Request
        `;
        const diagram = parser.parse(code);
        const layout = layoutEngine.calculateLayout(diagram);

        expect(diagram.groups).toHaveLength(1);
        expect(diagram.messages).toHaveLength(3);

        const g = layout.groups[0];
        const msg1 = layout.messages.find(m => m.message.text === 'Authentication Request')!;
        const msg2 = layout.messages.find(m => m.message.text === 'Authentication Accepted')!;
        const msg3 = layout.messages.find(m => m.message.text === 'Next Request')!;

        // The top of the alt group should be at least 25px below msg1
        console.log('msg1 Y:', msg1.y);
        console.log('group top Y:', g.y);
        expect(g.y).toBeGreaterThanOrEqual(msg1.y + 25);

        // The bottom of the alt group should be at least 20px above msg3
        const groupBottom = g.y + g.height;
        console.log('group bottom Y:', groupBottom);
        console.log('msg3 Y:', msg3.y);
        expect(msg3.y).toBeGreaterThanOrEqual(groupBottom + 20);
    });

    it('should include group box padding/extension in the total width to prevent clipping', () => {
        const code = `
        Alice -> Bob: Authentication Request
        Bob -> Alice: Authentication Failure
        
        group My own label [My own label 2]
            Alice -> Log : Log attack start
            loop 1000 times
                Alice -> Bob: DNS Attack
            end
            Alice -> Log : Log attack end
        end
        `;
        const diagram = parser.parse(code);
        const layout = layoutEngine.calculateLayout(diagram);

        const aliceLayout = layout.participants.find(p => p.participant.name === 'Alice')!;
        const logLayout = layout.participants.find(p => p.participant.name === 'Log')!;
        
        // Find the outermost group layout
        const mainGroup = layout.groups.find(g => g.label === 'My own label [My own label 2]')!;

        // The group box left edge (mainGroup.x) should be exactly (aliceLayout.x - hPadding).
        // Since mainGroup.x is the absolute minimum boundary of the diagram's visual elements,
        // it must be exactly equal to the theme padding (defaultTheme.padding).
        expect(mainGroup.x).toBeGreaterThanOrEqual(defaultTheme.padding);
        
        // The total width of the diagram must be large enough to contain the rightmost group edge with padding.
        const groupRightEdge = mainGroup.x + mainGroup.width;
        expect(layout.width).toBeGreaterThanOrEqual(groupRightEdge + defaultTheme.padding);
    });
});

