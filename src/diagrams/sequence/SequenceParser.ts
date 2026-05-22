import { Parser } from '../../core/Parser';
import { SequenceDiagram } from './SequenceDiagram';
import { Lexer } from '../../core/parser/Lexer';
import { SequenceASTParser } from './parser/SequenceASTParser';
import { SequenceASTCompiler } from './parser/SequenceASTCompiler';

export class SequenceParser implements Parser {
    parse(content: string): SequenceDiagram {
        const lexer = new Lexer(content);
        const tokens = lexer.scanTokens();
        const astParser = new SequenceASTParser(tokens, content);
        const ast = astParser.parse();
        const compiler = new SequenceASTCompiler();
        return compiler.compile(ast);
    }
}
