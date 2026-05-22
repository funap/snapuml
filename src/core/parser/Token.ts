export enum TokenType {
    EOF = 'EOF',
    NEWLINE = 'NEWLINE',

    // Keywords
    PARTICIPANT = 'PARTICIPANT',
    ACTOR = 'ACTOR',
    BOUNDARY = 'BOUNDARY',
    CONTROL = 'CONTROL',
    ENTITY = 'ENTITY',
    DATABASE = 'DATABASE',
    COLLECTIONS = 'COLLECTIONS',
    QUEUE = 'QUEUE',
    COMPONENT = 'COMPONENT',
    INTERFACE = 'INTERFACE',
    PACKAGE = 'PACKAGE',
    NODE = 'NODE',
    FOLDER = 'FOLDER',
    FRAME = 'FRAME',
    CLOUD = 'CLOUD',
    PORT = 'PORT',
    PORTIN = 'PORTIN',
    PORTOUT = 'PORTOUT',

    // Control flow & blocks
    ALT = 'ALT',
    ELSE = 'ELSE',
    OPT = 'OPT',
    LOOP = 'LOOP',
    PAR = 'PAR',
    BREAK = 'BREAK',
    CRITICAL = 'CRITICAL',
    GROUP = 'GROUP',
    END = 'END',
    REF = 'REF',
    NOTE = 'NOTE',
    HNOTE = 'HNOTE',
    RNOTE = 'RNOTE',
    BNOTE = 'BNOTE',

    // Actions & metadata
    CREATE = 'CREATE',
    DESTROY = 'DESTROY',
    ACTIVATE = 'ACTIVATE',
    DEACTIVATE = 'DEACTIVATE',
    RETURN = 'RETURN',
    TITLE = 'TITLE',
    HEADER = 'HEADER',
    FOOTER = 'FOOTER',
    AUTONUMBER = 'AUTONUMBER',
    AUTOACTIVATE = 'AUTOACTIVATE',
    HIDE = 'HIDE',
    FOOTBOX = 'FOOTBOX',

    // General tokens
    IDENTIFIER = 'IDENTIFIER',   // Standard names or quoted text
    ARROW = 'ARROW',             // Message / connection arrows, e.g. ->, -->, -[#red]>, etc.
    COLOR = 'COLOR',             // e.g. #red, #FFF
    STEREOTYPE = 'STEREOTYPE',   // e.g. <<stereo>>
    SHORTHAND = 'SHORTHAND',     // e.g. ++, --, ++--, --++, **, !!
    COLON = 'COLON',             // :
    COMMA = 'COMMA',             // ,
    LBRACKET = 'LBRACKET',       // [
    RBRACKET = 'RBRACKET',       // ]
    LBRACE = 'LBRACE',           // {
    RBRACE = 'RBRACE',           // }
    EQUAL = 'EQUAL',             // = (for assignments or properties)
    DIVIDER = 'DIVIDER',         // == divider ==
    DELAY = 'DELAY',             // ... or ... text ...
    SPACING = 'SPACING',         // ||| or ||45||
    AS = 'AS',                   // as keyword
    ORDER = 'ORDER',             // order keyword
    OF = 'OF',                   // of keyword
    OVER = 'OVER',               // over keyword
    ON = 'ON',                   // on keyword
    OFF = 'OFF',                 // off keyword
    STOP = 'STOP',               // stop keyword
    RESUME = 'RESUME',           // resume keyword
    INC = 'INC',                 // inc keyword
    LEFT = 'LEFT',               // left keyword
    RIGHT = 'RIGHT',             // right keyword
    TOP = 'TOP',                 // top keyword
    BOTTOM = 'BOTTOM',           // bottom keyword
}

export interface Token {
    type: TokenType;
    value: string;
    line: number;
    column: number;
}
export class ParseError extends Error {
    constructor(message: string, public line: number, public column: number) {
        super(message);
        this.name = 'ParseError';
    }
}
