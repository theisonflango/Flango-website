// js/core/escape-html.js
// Minimal HTML escaping for user-controlled strings used in innerHTML templates.
// Escapes: & < > " '
// OPTIMERING: Brug én regex i stedet for kædede replace() for bedre performance

const ESCAPE_MAP = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
};

const ESCAPE_REGEX = /[&<>"']/g;

export function escapeHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value).replace(ESCAPE_REGEX, (char) => ESCAPE_MAP[char]);
}

