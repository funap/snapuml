/**
 * Formats rich text strings into SVG-compatible marked-up strings.
 * Supports a subset of HTML tags used in PlantUML and Markdown-like syntax.
 */
export function formatRichText(text: string): string {
    if (!text) return '';

    let escaped = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');

    // Support HTML-like tags (PlantUML style)
    // Bold: <b>...</b>
    escaped = escaped.replace(/&lt;b&gt;(.*?)&lt;\/b&gt;/gi, '<tspan font-weight="bold">$1</tspan>');
    // Underline: <u>...</u>
    escaped = escaped.replace(/&lt;u&gt;(.*?)&lt;\/u&gt;/gi, '<tspan text-decoration="underline">$1</tspan>');
    // Italic: <i>...</i>
    escaped = escaped.replace(/&lt;i&gt;(.*?)&lt;\/i&gt;/gi, '<tspan font-style="italic">$1</tspan>');
    // Strike: <s>...</s>
    escaped = escaped.replace(/&lt;s&gt;(.*?)&lt;\/s&gt;/gi, '<tspan text-decoration="line-through">$1</tspan>');
    // Font Color: <font color="red">...</font> or <font color=red>...</font>
    escaped = escaped.replace(/&lt;font\s+color=(?:&quot;)?(.*?)(?:&quot;)?&gt;(.*?)&lt;\/font&gt;/gi, '<tspan fill="$1">$2</tspan>');

    // Support unclosed tags (sometimes used in format strings)
    // This is a simple fallback that just starts a tspan if an opening tag is found but no closing tag
    escaped = escaped.replace(/&lt;b&gt;(?!.*&lt;\/b&gt;)(.*)/gi, '<tspan font-weight="bold">$1</tspan>');
    escaped = escaped.replace(/&lt;font\s+color=(?:&quot;)?(.*?)(?:&quot;)?&gt;(?!.*&lt;\/font&gt;)(.*)/gi, '<tspan fill="$1">$2</tspan>');

    // Support Markdown-like syntax (Legacy/Alternative)
    escaped = escaped.replace(/\*\*([^*].*?)\*\*/g, '<tspan font-weight="bold">$1</tspan>');
    escaped = escaped.replace(/\/\/([^/].*?)\/\//g, '<tspan font-style="italic">$1</tspan>');
    escaped = escaped.replace(/&quot;&quot;(?!&quot;&quot;)(.+?)&quot;&quot;/g, '<tspan font-family="monospace">$1</tspan>');
    escaped = escaped.replace(/--([^-].*?)--/g, '<tspan text-decoration="line-through">$1</tspan>');
    escaped = escaped.replace(/__([^_].*?)__/g, '<tspan text-decoration="underline">$1</tspan>');
    escaped = escaped.replace(/~~([^~].*?)~~/g, '<tspan style="text-decoration: underline; text-decoration-style: wavy">$1</tspan>');

    return escaped;
}

/**
 * Decodes PlantUML-style Unicode escapes like <U+XXXX>.
 */
export function decodeUnicode(text: string): string {
    if (!text) return '';
    return text.replace(/<U\+([0-9a-fA-F]{4})>/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

/**
 * Strips HTML-like tags, markdown formatting tags, and decodes unicode escapes to return plain text.
 */
export function stripRichText(text: string): string {
    if (!text) return '';
    let decoded = decodeUnicode(text);
    // Remove HTML-like tags: <b>, </b>, <i>, </i>, <u>, </u>, <s>, </s>, <font ...>, </font>, etc.
    decoded = decoded.replace(/<[^>]*>/g, '');
    // Remove markdown formatting: **, //, __, --, ~~, ""
    decoded = decoded.replace(/\*\*|\/\/|__|--|~~|""/g, '');
    return decoded;
}

let cachedCanvasCtx: any = undefined;

/**
 * Calculates string width precisely.
 * If running in a browser environment with Canvas available, uses Canvas measureText.
 * Otherwise, uses character-by-character width estimation accounting for full-width CJK characters,
 * narrow characters, wide characters, and font size.
 */
export function getTextWidth(text: string, fontSize: number = 13, fontFamily: string = 'sans-serif'): number {
    if (!text) return 0;

    const lines = text.split(/\\n|\n/);
    if (lines.length > 1) {
        return Math.max(...lines.map(l => getTextWidth(l, fontSize, fontFamily)));
    }

    const plainText = stripRichText(text);

    if (typeof document !== 'undefined') {
        try {
            if (cachedCanvasCtx === undefined) {
                const canvas = document.createElement('canvas');
                cachedCanvasCtx = canvas.getContext('2d');
            }
            if (cachedCanvasCtx) {
                cachedCanvasCtx.font = `${fontSize}px ${fontFamily}`;
                return cachedCanvasCtx.measureText(plainText).width;
            }
        } catch {
            // Ignore canvas error and fallback
        }
    }

    // Heuristic fallback for non-DOM environments
    let width = 0;
    for (let i = 0; i < plainText.length; i++) {
        const char = plainText[i];
        const code = char.charCodeAt(0);

        // Full-width / CJK / Japanese / Emoji
        if (
            (code >= 0x3000 && code <= 0x303f) || // CJK symbols & punctuation
            (code >= 0x3040 && code <= 0x309f) || // Hiragana
            (code >= 0x30a0 && code <= 0x30ff) || // Katakana
            (code >= 0xff00 && code <= 0xffef) || // Fullwidth forms
            (code >= 0x4e00 && code <= 0x9faf) || // CJK Ideographs
            (code >= 0x3400 && code <= 0x4dbf) || // CJK Extension A
            (code >= 0x1f300 && code <= 0x1f9ff)  // Emojis
        ) {
            width += fontSize * 1.05;
        } else if ('iIl1t!.,:;\' "|()[]{}'.includes(char)) {
            width += fontSize * 0.35;
        } else if ('fjrskcxyzJ-'.includes(char)) {
            width += fontSize * 0.45;
        } else if ('mwMW@#%&'.includes(char)) {
            width += fontSize * 0.85;
        } else {
            width += fontSize * 0.58;
        }
    }
    return width;
}

