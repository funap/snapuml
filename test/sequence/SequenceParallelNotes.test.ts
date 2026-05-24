import { describe, it, expect } from 'vitest';
import { SequenceParser } from '../../src/diagrams/sequence/SequenceParser';
import { LayoutEngine } from '../../src/diagrams/sequence/SequenceLayout';
import { defaultTheme } from '../../src/diagrams/sequence/SequenceTheme';

describe('Sequence Diagram Parallel Notes', () => {
    it('should parse two consecutive notes with & onto the same step', () => {
        const parser = new SequenceParser();
        const content = `
            participant S1
            participant S2
            note left S1: msg1
            & note right S2: msg2
        `;
        const diagram = parser.parse(content);

        expect(diagram.notes).toHaveLength(2);
        const note1 = diagram.notes[0];
        const note2 = diagram.notes[1];

        // Both notes must have the exact same step index
        expect(note1.step).toBe(0);
        expect(note2.step).toBe(0);
    });

    it('should support & with multiline notes', () => {
        const parser = new SequenceParser();
        const content = `
            participant S1
            participant S2
            note left S1
msg1 line 1
msg1 line 2
            end note
            & note right S2
msg2 line 1
msg2 line 2
            end note
        `;
        const diagram = parser.parse(content);

        expect(diagram.notes).toHaveLength(2);
        const note1 = diagram.notes[0];
        const note2 = diagram.notes[1];

        expect(note1.step).toBe(0);
        expect(note2.step).toBe(0);
        expect(note1.text.trim()).toBe('msg1 line 1\nmsg1 line 2');
        expect(note2.text.trim()).toBe('msg2 line 1\nmsg2 line 2');
    });

    it('should layout parallel notes at the exact same vertical center position', () => {
        const parser = new SequenceParser();
        const layoutEngine = new LayoutEngine(defaultTheme);
        const content = `
            participant S1
            participant S2
            note left S1: msg1
            & note right S2: msg2
        `;
        const diagram = parser.parse(content);
        const layout = layoutEngine.calculateLayout(diagram);

        expect(layout.notes).toHaveLength(2);
        const noteLayout1 = layout.notes[0];
        const noteLayout2 = layout.notes[1];

        // The center y (y + height/2) should be identical for both notes
        const center1 = noteLayout1.y + noteLayout1.height / 2;
        const center2 = noteLayout2.y + noteLayout2.height / 2;

        expect(center1).toBeCloseTo(center2, 2);
    });

    it('should correctly layout parallel note followed by normal steps', () => {
        const parser = new SequenceParser();
        const layoutEngine = new LayoutEngine(defaultTheme);
        const content = `
            participant S1
            participant S2
            note left S1: msg1
            & note right S2: msg2
            S1 -> S2: normal message
        `;
        const diagram = parser.parse(content);
        const layout = layoutEngine.calculateLayout(diagram);

        expect(diagram.notes).toHaveLength(2);
        expect(diagram.messages).toHaveLength(1);

        const note1 = diagram.notes[0];
        const note2 = diagram.notes[1];
        const msg = diagram.messages[0];

        // Parallel notes share step 0, subsequent message is step 1
        expect(note1.step).toBe(0);
        expect(note2.step).toBe(0);
        expect(msg.step).toBe(1);

        // The message y-coordinate must be strictly below the parallel notes
        const note1Bottom = layout.notes[0].y + layout.notes[0].height;
        const note2Bottom = layout.notes[1].y + layout.notes[1].height;
        const msgY = layout.messages[0].y;

        expect(msgY).toBeGreaterThan(note1Bottom);
        expect(msgY).toBeGreaterThan(note2Bottom);
    });
});
