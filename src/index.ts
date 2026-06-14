import { SequenceParser } from './diagrams/sequence/SequenceParser';
import { SequenceRenderer } from './diagrams/sequence/SequenceRenderer';
import { ComponentParser } from './diagrams/component/ComponentParser';
import { ComponentRenderer } from './diagrams/component/ComponentRenderer';
import { SaltParser } from './diagrams/salt/SaltParser';
import { SaltRenderer } from './diagrams/salt/SaltRenderer';

export interface InitializeConfig {
    startOnLoad?: boolean;
    selector?: string;
}

export function renderSequenceDiagram(content: string): string {
    const parser = new SequenceParser();
    const renderer = new SequenceRenderer();
    try {
        const diagram = parser.parse(content);
        return renderer.render(diagram);
    } catch (e: any) {
        return renderError(e);
    }
}

export function renderComponentDiagram(content: string): string {
    const parser = new ComponentParser();
    const renderer = new ComponentRenderer();
    try {
        const diagram = parser.parse(content);
        return renderer.render(diagram);
    } catch (e: any) {
        return renderError(e);
    }
}

export function renderSaltDiagram(content: string): string {
    const parser = new SaltParser();
    const renderer = new SaltRenderer();
    try {
        const diagram = parser.parse(content);
        return renderer.render(diagram);
    } catch (e: any) {
        return renderError(e);
    }
}

function renderError(e: any): string {
    const errorMsg = e.message || 'Unknown error occurred during parsing';
    const escapedError = errorMsg.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const width = 800; // Arbitrary width for error
    const height = 100;
    return `
        <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" style="background: white; font-family: sans-serif;">
            <rect width="100%" height="100%" fill="#ffeeee" stroke="#ff0000" stroke-width="2" />
            <text x="20" y="50" fill="#ff0000" font-size="16" font-weight="bold">${escapedError}</text>
        </svg>
    `.trim();
}

export function render(content: string): string {
    const isSalt = /@startsalt/i.test(content) || /\{\{salt/i.test(content);
    if (isSalt) return renderSaltDiagram(content);

    // Sequence-specific keywords that strongly indicate a sequence diagram.
    // These take absolute priority because they never appear in component diagrams.
    const hasSequenceKeywords = /\b(participant|actor|boundary|control|entity|collections|queue)\b/.test(content);

    // Component-specific keywords (explicit declarations)
    const hasComponentKeywords = /\b(component|interface|package|node|cloud|database|frame|folder)\b/.test(content);

    // Component bracket syntax [Name], but only when at the start of a line
    // to avoid matching group labels like "group My Label [label2]"
    const hasComponentBrackets = /^\s*\[[^\]\r\n]+\]/m.test(content);

    const isComponent = hasComponentKeywords || hasComponentBrackets;
    const isSequence = hasSequenceKeywords;

    // Sequence wins if it has sequence-specific keywords (participant etc.)
    if (isSequence && !isComponent) return renderSequenceDiagram(content);
    if (isComponent && !isSequence) return renderComponentDiagram(content);

    // Both or neither: prefer sequence when sequence-related control flow detected
    if (/\b(alt|else|loop|group|note|opt|par|break|critical|ref)\b/.test(content)) {
        return renderSequenceDiagram(content);
    }

    // Fallback: [Bracket] at line start → component
    if (hasComponentBrackets) return renderComponentDiagram(content);

    // Default
    return renderSequenceDiagram(content);
}


/**
 * Automatically render all snapuml diagram blocks on the page
 * @param selector CSS selector for diagram blocks (default: 'pre.snapuml')
 */
export function renderAll(selector: string = 'pre.snapuml'): void {
    if (typeof document === 'undefined') return;

    const blocks = document.querySelectorAll(selector);
    blocks.forEach((block) => {
        const content = block.textContent || '';
        const svg = render(content);

        // Replace the pre element with an SVG container
        const container = document.createElement('div');
        container.className = 'snapuml-diagram';
        container.innerHTML = svg;
        container.style.display = 'inline-block';

        block.parentNode?.replaceChild(container, block);
    });
}

/**
 * Initialize SnapUML with automatic rendering
 * @param config Configuration options
 */
export function initialize(config: InitializeConfig = {}): void {
    const { startOnLoad = true, selector = 'pre.snapuml' } = config;

    if (!startOnLoad) return;

    if (typeof document === 'undefined') return;

    // If document is already loaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            renderAll(selector);
        });
    } else {
        renderAll(selector);
    }
}

// Browser global
if (typeof window !== 'undefined') {
    (window as any).snapuml = {
        renderSequenceDiagram,
        renderComponentDiagram,
        renderSaltDiagram,
        render,
        renderAll,
        initialize
    };
}

// Export for ES modules
export default {
    renderSequenceDiagram,
    renderComponentDiagram,
    renderSaltDiagram,
    render,
    renderAll,
    initialize
};
