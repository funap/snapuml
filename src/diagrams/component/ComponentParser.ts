import { Parser } from '../../core/Parser';
import { ComponentDiagram } from './ComponentDiagram';
import { Lexer } from '../../core/parser/Lexer';
import { ComponentASTParser } from './parser/ComponentASTParser';
import { ComponentASTCompiler } from './parser/ComponentASTCompiler';

export class ComponentParser implements Parser {
    parse(content: string): ComponentDiagram {
        const lexer = new Lexer(content);
        const tokens = lexer.scanTokens();
        const parser = new ComponentASTParser(tokens, content);
        const ast = parser.parse();
        const compiler = new ComponentASTCompiler();
        return compiler.compile(ast);
    }
}
