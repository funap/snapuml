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
    escaped = escaped.replace(/\*\*(.*?)\*\*/g, '<tspan font-weight="bold">$1</tspan>');
    escaped = escaped.replace(/\/\/(.*?)\/\//g, '<tspan font-style="italic">$1</tspan>');
    escaped = escaped.replace(/&quot;&quot;(.*?)&quot;&quot;/g, '<tspan font-family="monospace">$1</tspan>');
    escaped = escaped.replace(/--(.*?)--/g, '<tspan text-decoration="line-through">$1</tspan>');
    escaped = escaped.replace(/__(.*?)__/g, '<tspan text-decoration="underline">$1</tspan>');
    escaped = escaped.replace(/~~(.*?)~~/g, '<tspan style="text-decoration: underline; text-decoration-style: wavy">$1</tspan>');

    return escaped;
}

/**
 * Decodes PlantUML-style Unicode escapes like <U+XXXX>.
 */
export function decodeUnicode(text: string): string {
    if (!text) return '';
    return text.replace(/<U\+([0-9a-fA-F]{4})>/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}
