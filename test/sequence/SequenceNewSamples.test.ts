import { describe, it, expect } from 'vitest';
import { SequenceParser } from '../../src/diagrams/sequence/SequenceParser';
import fs from 'fs';

describe('Sequence Diagram New Samples Parsing', () => {
    // Load parsed samples
    const parsedSamples = JSON.parse(
        fs.readFileSync('/Users/af/.gemini/antigravity/scratch/parsed_samples.json', 'utf8')
    );

    // List of titles that are already in index.html as basic/existing samples,
    // so we don't have to test them here or if they fail we already know.
    // Wait, let's test ALL parsed samples because if any of the plantuml.com samples fail,
    // we want to make sure they are parsed correctly!
    
    const parser = new SequenceParser();

    for (const sample of parsedSamples) {
        it(`should parse sequence diagram: "${sample.title}"`, () => {
            expect(() => {
                parser.parse(sample.code);
            }).not.toThrow();
        });
    }
});
