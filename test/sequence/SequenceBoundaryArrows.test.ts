import { describe, it, expect } from 'vitest';
import { SequenceParser } from '../../src/diagrams/sequence/SequenceParser';
import { LayoutEngine } from '../../src/diagrams/sequence/SequenceLayout';
import { defaultTheme } from '../../src/diagrams/sequence/SequenceTheme';

describe('Sequence Diagram Boundary and Short Arrows', () => {
    it('should correctly layout found message from left boundary ([-> Alice)', () => {
        const content = `
participant Alice
[-> Alice : found msg
        `;
        const parser = new SequenceParser();
        const diagram = parser.parse(content);
        const engine = new LayoutEngine(defaultTheme);
        const layout = engine.calculateLayout(diagram);

        const alice = layout.participants.find(p => p.participant.name === 'Alice')!;
        const msg = layout.messages.find(m => m.message.text === 'found msg')!;

        // The leftmost/rightmost boundaries should exclude [ and ] from having lifelines
        expect(layout.participants.length).toBe(1);
        expect(layout.participants[0].participant.name).toBe('Alice');

        // msg should start 80px to the left of Alice's center, and end at Alice's center
        expect(msg.points[0].x).toBe(alice.centerX - 80);
        expect(msg.points[1].x).toBe(alice.centerX);
    });

    it('should correctly layout lost message to right boundary (Alice ->])', () => {
        const content = `
participant Alice
Alice ->] : lost msg
        `;
        const parser = new SequenceParser();
        const diagram = parser.parse(content);
        const engine = new LayoutEngine(defaultTheme);
        const layout = engine.calculateLayout(diagram);

        const alice = layout.participants.find(p => p.participant.name === 'Alice')!;
        const msg = layout.messages.find(m => m.message.text === 'lost msg')!;

        expect(layout.participants.length).toBe(1);

        // msg should start at Alice's center and end 80px to the right of Alice's center
        expect(msg.points[0].x).toBe(alice.centerX);
        expect(msg.points[1].x).toBe(alice.centerX + 80);
    });

    it('should correctly layout short arrow pointing to Alice (?-> Alice)', () => {
        const content = `
participant Alice
?-> Alice : short msg
        `;
        const parser = new SequenceParser();
        const diagram = parser.parse(content);
        const engine = new LayoutEngine(defaultTheme);
        const layout = engine.calculateLayout(diagram);

        const alice = layout.participants.find(p => p.participant.name === 'Alice')!;
        const msg = layout.messages.find(m => m.message.text === 'short msg')!;

        expect(layout.participants.length).toBe(1);

        // msg should start 50px to the left of Alice's center and end at Alice's center
        expect(msg.points[0].x).toBe(alice.centerX - 50);
        expect(msg.points[1].x).toBe(alice.centerX);
    });

    it('should correctly layout short arrow from Alice (Alice ->?)', () => {
        const content = `
participant Alice
Alice ->? : short msg
        `;
        const parser = new SequenceParser();
        const diagram = parser.parse(content);
        const engine = new LayoutEngine(defaultTheme);
        const layout = engine.calculateLayout(diagram);

        const alice = layout.participants.find(p => p.participant.name === 'Alice')!;
        const msg = layout.messages.find(m => m.message.text === 'short msg')!;

        expect(layout.participants.length).toBe(1);

        // msg should start at Alice's center and end 50px to the right of Alice's center
        expect(msg.points[0].x).toBe(alice.centerX);
        expect(msg.points[1].x).toBe(alice.centerX + 50);
    });

    it('should correctly calculate bounds with multiple participants and boundary messages', () => {
        const content = `
participant Alice
participant Bob
[-> Alice : found msg
Bob ->] : lost msg
        `;
        const parser = new SequenceParser();
        const diagram = parser.parse(content);
        const engine = new LayoutEngine(defaultTheme);
        const layout = engine.calculateLayout(diagram);

        const alice = layout.participants.find(p => p.participant.name === 'Alice')!;
        const bob = layout.participants.find(p => p.participant.name === 'Bob')!;
        const foundMsg = layout.messages.find(m => m.message.text === 'found msg')!;
        const lostMsg = layout.messages.find(m => m.message.text === 'lost msg')!;

        expect(layout.participants.length).toBe(2);

        // [-> Alice should start at Alice's center - 80
        expect(foundMsg.points[0].x).toBe(alice.centerX - 80);
        expect(foundMsg.points[1].x).toBe(alice.centerX);

        // Bob ->] should end at Bob's center + 80
        expect(lostMsg.points[0].x).toBe(bob.centerX);
        expect(lostMsg.points[1].x).toBe(bob.centerX + 80);
    });
});
