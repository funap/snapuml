"use strict";
var snapuml = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/index.ts
  var index_exports = {};
  __export(index_exports, {
    default: () => index_default,
    initialize: () => initialize,
    render: () => render,
    renderAll: () => renderAll,
    renderComponentDiagram: () => renderComponentDiagram,
    renderSequenceDiagram: () => renderSequenceDiagram
  });

  // src/core/parser/Token.ts
  var ParseError = class extends Error {
    constructor(message, line, column) {
      super(message);
      this.line = line;
      this.column = column;
      this.name = "ParseError";
    }
  };

  // src/core/parser/Lexer.ts
  var Lexer = class {
    constructor(source) {
      this.tokens = [];
      this.line = 1;
      this.column = 1;
      this.current = 0;
      this.lineText = "";
      this.source = source;
    }
    scanTokens() {
      const lines = this.source.split("\n");
      for (let i = 0; i < lines.length; i++) {
        this.line = i + 1;
        this.column = 1;
        this.current = 0;
        this.lineText = lines[i];
        this.scanLine();
      }
      this.addToken("EOF" /* EOF */, "");
      return this.tokens;
    }
    scanLine() {
      const trimmed = this.lineText.trim();
      if (trimmed === "" || trimmed.startsWith("'") || trimmed.startsWith("@") || trimmed.startsWith("!pragma")) {
        this.addToken("NEWLINE" /* NEWLINE */, "\n");
        return;
      }
      if (trimmed === "|||") {
        this.addToken("SPACING" /* SPACING */, "|||");
        this.addToken("NEWLINE" /* NEWLINE */, "\n");
        return;
      }
      const spacingMatch = trimmed.match(/^\|\|(\d+)\|\|$/);
      if (spacingMatch) {
        this.addToken("SPACING" /* SPACING */, trimmed);
        this.addToken("NEWLINE" /* NEWLINE */, "\n");
        return;
      }
      const delayMatch = trimmed.match(/^\.\.\.(?:\s*(.*?)\s*\.\.\.)?$/);
      if (delayMatch) {
        this.addToken("DELAY" /* DELAY */, trimmed);
        this.addToken("NEWLINE" /* NEWLINE */, "\n");
        return;
      }
      const dividerMatch = trimmed.match(/^==\s*(.*?)\s*==$/);
      if (dividerMatch) {
        this.addToken("DIVIDER" /* DIVIDER */, trimmed);
        this.addToken("NEWLINE" /* NEWLINE */, "\n");
        return;
      }
      while (this.current < this.lineText.length) {
        const char = this.peek();
        if (/\s/.test(char)) {
          this.advance();
          continue;
        }
        if (char === "'") {
          break;
        }
        if (char === "<" && this.peekNext() === "<") {
          this.scanStereotype();
          continue;
        }
        if (char === "<" || char === "-" || char === "." || char === "o" || char === "O" || char === "x" || char === "X" || char === "/" || char === "\\" || char === "(") {
          if (this.tryScanArrow()) {
            continue;
          }
        }
        if (char === "+" || char === "-" || char === "*" || char === "!") {
          if (this.tryScanShorthand()) {
            continue;
          }
        }
        if (char === ":") {
          this.advance();
          this.addToken("COLON" /* COLON */, ":");
          continue;
        }
        if (char === ",") {
          this.advance();
          this.addToken("COMMA" /* COMMA */, ",");
          continue;
        }
        if (char === "=") {
          this.advance();
          this.addToken("EQUAL" /* EQUAL */, "=");
          continue;
        }
        if (char === "{") {
          this.scanTagOrLbrace();
          continue;
        }
        if (char === "}") {
          this.advance();
          this.addToken("RBRACE" /* RBRACE */, "}");
          continue;
        }
        if (char === "[") {
          this.scanBracketOrColor();
          continue;
        }
        if (char === "]") {
          this.advance();
          this.addToken("RBRACKET" /* RBRACKET */, "]");
          continue;
        }
        if (char === "(" && this.peekNext() === ")") {
          this.advance();
          this.advance();
          this.addToken("IDENTIFIER" /* IDENTIFIER */, "()");
          continue;
        }
        if (char === "#") {
          this.scanColor();
          continue;
        }
        if (char === '"') {
          this.scanQuotedString();
          continue;
        }
        if (/[a-zA-Z0-9_]/.test(char)) {
          this.scanWord();
          continue;
        }
        this.advance();
        this.addToken("IDENTIFIER" /* IDENTIFIER */, char);
      }
      this.addToken("NEWLINE" /* NEWLINE */, "\n");
    }
    peek() {
      if (this.current >= this.lineText.length) return "\0";
      return this.lineText[this.current];
    }
    peekNext() {
      if (this.current + 1 >= this.lineText.length) return "\0";
      return this.lineText[this.current + 1];
    }
    advance() {
      const char = this.peek();
      this.current++;
      this.column++;
      return char;
    }
    addToken(type, value) {
      this.tokens.push({
        type,
        value,
        line: this.line,
        column: this.column - value.length
      });
    }
    scanQuotedString() {
      this.advance();
      let start = this.current;
      let value = "";
      while (this.peek() !== '"' && this.peek() !== "\0") {
        if (this.peek() === "\\" && this.peekNext() === '"') {
          value += '"';
          this.advance();
          this.advance();
        } else {
          value += this.advance();
        }
      }
      if (this.peek() === "\0") {
        throw new Error(`Quoted string not closed at line ${this.line}, col ${this.column}`);
      }
      this.advance();
      this.addToken("IDENTIFIER" /* IDENTIFIER */, value);
    }
    scanStereotype() {
      const startCol = this.column;
      this.advance();
      this.advance();
      let start = this.current;
      while (!(this.peek() === ">" && this.peekNext() === ">") && this.peek() !== "\0") {
        this.advance();
      }
      if (this.peek() === "\0") {
        throw new Error(`Stereotype << not closed at line ${this.line}, col ${this.column}`);
      }
      const val = this.lineText.substring(start, this.current);
      this.advance();
      this.advance();
      this.tokens.push({
        type: "STEREOTYPE" /* STEREOTYPE */,
        value: val,
        line: this.line,
        column: startCol
      });
    }
    scanTagOrLbrace() {
      const startCol = this.column;
      this.advance();
      let start = this.current;
      while (this.peek() !== "}" && this.peek() !== "\0" && !/\s/.test(this.peek())) {
        this.advance();
      }
      if (this.peek() === "}") {
        const val = this.lineText.substring(start, this.current);
        this.advance();
        this.addToken("IDENTIFIER" /* IDENTIFIER */, `{${val}}`);
      } else {
        this.tokens.push({
          type: "LBRACE" /* LBRACE */,
          value: "{",
          line: this.line,
          column: startCol
        });
      }
    }
    scanBracketOrColor() {
      const startCol = this.column;
      this.advance();
      if (this.peek() === "#") {
        let start = this.current;
        while (this.peek() !== "]" && this.peek() !== "\0") {
          this.advance();
        }
        if (this.peek() === "]") {
          const color = this.lineText.substring(start, this.current);
          this.advance();
          this.addToken("COLOR" /* COLOR */, color);
          return;
        }
      }
      this.tokens.push({
        type: "LBRACKET" /* LBRACKET */,
        value: "[",
        line: this.line,
        column: startCol
      });
    }
    scanColor() {
      this.advance();
      let start = this.current;
      while (/[a-zA-Z0-9_]/.test(this.peek())) {
        this.advance();
      }
      const color = this.lineText.substring(start, this.current);
      this.addToken("COLOR" /* COLOR */, "#" + color);
    }
    tryScanArrow() {
      const sub = this.lineText.substring(this.current);
      const ARROW_REGEX = /^(?:\(\d+\))?([<ox\\/]*)([-.]+)(left|right|up|down|le|ri|do)?(?:\[(#\w+)\])?([-.]*)([>ox\\/]*)?(?:\(\d+\))?(--\+\+|\+\+--|--|\+\+|\*\*|!!)?/i;
      const match = sub.match(ARROW_REGEX);
      if (match) {
        const fullArrow = match[0];
        const hasArrowHead = /[<>xoOX\\/]/.test(fullArrow);
        const isComponentArrow = /^([-]|\.\.?)$/.test(fullArrow) || /^[-.]+(left|right|up|down|le|ri|do)[-.]*$/i.test(fullArrow);
        if (!hasArrowHead && !isComponentArrow) {
          return false;
        }
        this.current += fullArrow.length;
        this.column += fullArrow.length;
        this.addToken("ARROW" /* ARROW */, fullArrow);
        return true;
      }
      return false;
    }
    tryScanShorthand() {
      const sub = this.lineText.substring(this.current);
      const match = sub.match(/^(\+\+--|--\+\+|\+\+|--|\*\*|!!)/);
      if (match) {
        const val = match[1];
        this.current += val.length;
        this.column += val.length;
        this.addToken("SHORTHAND" /* SHORTHAND */, val);
        return true;
      }
      return false;
    }
    tryScanArrowLookahead() {
      const sub = this.lineText.substring(this.current);
      const ARROW_REGEX = /^(?:\(\d+\))?([<ox\\/]*)([-.]+)(?:\[(#\w+)\])?([-.]*)([>ox\\/]*)?(?:\(\d+\))?(--\+\+|\+\+--|--|\+\+|\*\*|!!)?/i;
      const match = sub.match(ARROW_REGEX);
      if (match) {
        const fullArrow = match[0];
        if (fullArrow.includes(">") || fullArrow.includes("<") || fullArrow.length >= 2) {
          return true;
        }
      }
      return false;
    }
    scanWord() {
      let start = this.current;
      while (/[a-zA-Z0-9_.-]/.test(this.peek())) {
        const nextChar = this.peek();
        if (nextChar === "-" || nextChar === ".") {
          if (this.tryScanArrowLookahead()) {
            break;
          }
        }
        this.advance();
      }
      const value = this.lineText.substring(start, this.current);
      const upper = value.toUpperCase();
      if (upper in KEYWORDS) {
        this.addToken(KEYWORDS[upper], value);
      } else {
        this.addToken("IDENTIFIER" /* IDENTIFIER */, value);
      }
    }
  };
  var KEYWORDS = {
    PARTICIPANT: "PARTICIPANT" /* PARTICIPANT */,
    ACTOR: "ACTOR" /* ACTOR */,
    BOUNDARY: "BOUNDARY" /* BOUNDARY */,
    CONTROL: "CONTROL" /* CONTROL */,
    ENTITY: "ENTITY" /* ENTITY */,
    DATABASE: "DATABASE" /* DATABASE */,
    COLLECTIONS: "COLLECTIONS" /* COLLECTIONS */,
    QUEUE: "QUEUE" /* QUEUE */,
    COMPONENT: "COMPONENT" /* COMPONENT */,
    INTERFACE: "INTERFACE" /* INTERFACE */,
    PACKAGE: "PACKAGE" /* PACKAGE */,
    NODE: "NODE" /* NODE */,
    FOLDER: "FOLDER" /* FOLDER */,
    FRAME: "FRAME" /* FRAME */,
    CLOUD: "CLOUD" /* CLOUD */,
    ALT: "ALT" /* ALT */,
    ELSE: "ELSE" /* ELSE */,
    OPT: "OPT" /* OPT */,
    LOOP: "LOOP" /* LOOP */,
    PAR: "PAR" /* PAR */,
    BREAK: "BREAK" /* BREAK */,
    CRITICAL: "CRITICAL" /* CRITICAL */,
    GROUP: "GROUP" /* GROUP */,
    END: "END" /* END */,
    REF: "REF" /* REF */,
    NOTE: "NOTE" /* NOTE */,
    HNOTE: "HNOTE" /* HNOTE */,
    RNOTE: "RNOTE" /* RNOTE */,
    BNOTE: "BNOTE" /* BNOTE */,
    CREATE: "CREATE" /* CREATE */,
    DESTROY: "DESTROY" /* DESTROY */,
    ACTIVATE: "ACTIVATE" /* ACTIVATE */,
    DEACTIVATE: "DEACTIVATE" /* DEACTIVATE */,
    RETURN: "RETURN" /* RETURN */,
    TITLE: "TITLE" /* TITLE */,
    HEADER: "HEADER" /* HEADER */,
    FOOTER: "FOOTER" /* FOOTER */,
    AUTONUMBER: "AUTONUMBER" /* AUTONUMBER */,
    AUTOACTIVATE: "AUTOACTIVATE" /* AUTOACTIVATE */,
    HIDE: "HIDE" /* HIDE */,
    FOOTBOX: "FOOTBOX" /* FOOTBOX */,
    AS: "AS" /* AS */,
    ORDER: "ORDER" /* ORDER */,
    OF: "OF" /* OF */,
    OVER: "OVER" /* OVER */,
    ON: "ON" /* ON */,
    OFF: "OFF" /* OFF */,
    STOP: "STOP" /* STOP */,
    RESUME: "RESUME" /* RESUME */,
    INC: "INC" /* INC */,
    PORT: "PORT" /* PORT */,
    PORTIN: "PORTIN" /* PORTIN */,
    PORTOUT: "PORTOUT" /* PORTOUT */,
    LEFT: "LEFT" /* LEFT */,
    RIGHT: "RIGHT" /* RIGHT */,
    TOP: "TOP" /* TOP */,
    BOTTOM: "BOTTOM" /* BOTTOM */,
    SKINPARAM: "SKINPARAM" /* SKINPARAM */,
    PARTITION: "PARTITION" /* PARTITION */,
    BOX: "BOX" /* BOX */,
    MAINFRAME: "MAINFRAME" /* MAINFRAME */,
    NEWPAGE: "NEWPAGE" /* NEWPAGE */
  };

  // src/diagrams/sequence/parser/SequenceASTParser.ts
  var SequenceASTParser = class {
    constructor(tokens, source = "") {
      this.current = 0;
      this.tokens = tokens;
      this.sourceLines = source.split("\n");
    }
    parse() {
      const body = [];
      const startToken = this.peek();
      while (!this.isAtEnd()) {
        const statement = this.parseLineStatement();
        if (statement) {
          body.push(statement);
        }
      }
      return {
        type: "SequenceDiagram",
        body,
        line: startToken.line,
        column: startToken.column
      };
    }
    parseLineStatement() {
      while (this.match("NEWLINE" /* NEWLINE */)) {
      }
      if (this.isAtEnd()) return null;
      const statementStart = this.current;
      let tag = void 0;
      if (this.check("IDENTIFIER" /* IDENTIFIER */) && this.peek().value.startsWith("{")) {
        const tagToken = this.advance();
        tag = tagToken.value.replace(/[{}]/g, "");
        if (this.check("ARROW" /* ARROW */) && (this.peek().value === "<->" || this.peek().value.includes("<->"))) {
          this.advance();
          const endTagToken = this.consumeIdentifier("Time constraint expects target tag after <->");
          const endTag = endTagToken.value.replace(/[{}]/g, "");
          let label = "";
          if (this.match("COLON" /* COLON */)) {
            label = this.consumeLineText();
          } else {
            this.consumeLineEnd();
          }
          return {
            type: "TimeConstraint",
            startTag: tag,
            endTag,
            label,
            line: tagToken.line,
            column: tagToken.column
          };
        }
      }
      let isSameStep = false;
      if (this.check("IDENTIFIER" /* IDENTIFIER */) && (this.peek().value === "/" || this.peek().value === "&")) {
        this.advance();
        isSameStep = true;
      }
      const token = this.peek();
      if (this.match("SPACING" /* SPACING */)) {
        const val = this.previous().value;
        let height = 30;
        const match = val.match(/^\|\|(\d+)\|\|$/);
        if (match) {
          height = parseInt(match[1], 10);
        }
        this.consumeLineEnd();
        return {
          type: "Spacing",
          height,
          line: token.line,
          column: token.column
        };
      }
      if (this.match("DELAY" /* DELAY */)) {
        const val = this.previous().value;
        let text2 = void 0;
        const match = val.match(/^\.\.\.(?:\s*(.*?)\s*\.\.\.)?$/);
        if (match && match[1]) {
          text2 = match[1];
        }
        this.consumeLineEnd();
        return {
          type: "Delay",
          text: text2,
          line: token.line,
          column: token.column
        };
      }
      if (this.match("DIVIDER" /* DIVIDER */)) {
        const val = this.previous().value;
        let label = "";
        const match = val.match(/^==\s*(.*?)\s*==$/);
        if (match && match[1]) {
          label = match[1];
        }
        this.consumeLineEnd();
        return {
          type: "Divider",
          label,
          line: token.line,
          column: token.column
        };
      }
      if (this.match("CREATE" /* CREATE */)) {
        let declType = void 0;
        if (this.match(
          "PARTICIPANT" /* PARTICIPANT */,
          "ACTOR" /* ACTOR */,
          "BOUNDARY" /* BOUNDARY */,
          "CONTROL" /* CONTROL */,
          "ENTITY" /* ENTITY */,
          "DATABASE" /* DATABASE */,
          "COLLECTIONS" /* COLLECTIONS */,
          "QUEUE" /* QUEUE */
        )) {
          declType = this.previous().value.toLowerCase();
        }
        const nameToken = this.consumeIdentifier("Expected participant name after create");
        this.consumeLineEnd();
        return {
          type: "Create",
          name: nameToken.value,
          declType,
          line: token.line,
          column: token.column
        };
      }
      if (this.match("ACTIVATE" /* ACTIVATE */, "DEACTIVATE" /* DEACTIVATE */, "DESTROY" /* DESTROY */)) {
        const action = this.previous().type;
        const nameToken = this.consumeIdentifier("Expected name for activation/destruction");
        let color2 = void 0;
        if (this.check("COLOR" /* COLOR */)) {
          color2 = this.advance().value;
        }
        this.consumeLineEnd();
        if (action === "DESTROY" /* DESTROY */) {
          return {
            type: "Destroy",
            name: nameToken.value,
            line: token.line,
            column: token.column
          };
        } else {
          return {
            type: "Activation",
            action: action === "ACTIVATE" /* ACTIVATE */ ? "activate" : "deactivate",
            name: nameToken.value,
            color: color2,
            line: token.line,
            column: token.column
          };
        }
      }
      if (this.match("TITLE" /* TITLE */, "HEADER" /* HEADER */, "FOOTER" /* FOOTER */)) {
        const metaType = this.previous().type.toLowerCase();
        const text2 = this.consumeLineText();
        return {
          type: "Meta",
          metaType,
          value: text2,
          line: token.line,
          column: token.column
        };
      }
      if (this.match("HIDE" /* HIDE */)) {
        this.consume("FOOTBOX" /* FOOTBOX */, "Expected 'footbox' after hide");
        this.consumeLineEnd();
        return {
          type: "Meta",
          metaType: "hide_footbox",
          line: token.line,
          column: token.column
        };
      }
      if (this.match("SKINPARAM" /* SKINPARAM */)) {
        const value = this.consumeLineText();
        return {
          type: "Meta",
          metaType: "skinparam",
          value,
          line: token.line,
          column: token.column
        };
      }
      if (this.match("MAINFRAME" /* MAINFRAME */)) {
        const value = this.consumeLineText();
        return {
          type: "Meta",
          metaType: "mainframe",
          value,
          line: token.line,
          column: token.column
        };
      }
      if (this.match("NEWPAGE" /* NEWPAGE */)) {
        const value = this.consumeLineText();
        return {
          type: "Meta",
          metaType: "newpage",
          value,
          line: token.line,
          column: token.column
        };
      }
      const isNextArrow = this.peekNext().type === "ARROW" /* ARROW */;
      if (!isNextArrow && this.match(
        "PARTICIPANT" /* PARTICIPANT */,
        "ACTOR" /* ACTOR */,
        "BOUNDARY" /* BOUNDARY */,
        "CONTROL" /* CONTROL */,
        "ENTITY" /* ENTITY */,
        "DATABASE" /* DATABASE */,
        "COLLECTIONS" /* COLLECTIONS */,
        "QUEUE" /* QUEUE */
      )) {
        const declType = this.previous().value.toLowerCase();
        const nameToken = this.consumeIdentifier("Expected participant name");
        if (this.match("LBRACKET" /* LBRACKET */)) {
          const lines = [];
          while (!this.check("RBRACKET" /* RBRACKET */) && !this.isAtEnd()) {
            lines.push(this.consumeLineRawText());
          }
          if (this.check("RBRACKET" /* RBRACKET */)) {
            this.advance();
          }
          this.consumeLineEnd();
          return {
            type: "ParticipantDeclaration",
            declType,
            name: nameToken.value,
            label: lines.join("\n"),
            line: token.line,
            column: token.column
          };
        }
        let label = void 0;
        let stereotype = void 0;
        let order = void 0;
        let color2 = void 0;
        while (!this.check("NEWLINE" /* NEWLINE */) && !this.isAtEnd()) {
          if (this.match("STEREOTYPE" /* STEREOTYPE */)) {
            stereotype = this.previous().value;
          } else if (this.match("AS" /* AS */)) {
            const labelToken = this.consumeIdentifier("Expected label after 'as'");
            label = labelToken.value;
          } else if (this.match("ORDER" /* ORDER */)) {
            const orderToken = this.consumeIdentifier("Expected order number");
            order = parseInt(orderToken.value, 10);
          } else if (this.check("COLOR" /* COLOR */)) {
            color2 = this.advance().value;
          } else {
            this.advance();
          }
        }
        this.consumeLineEnd();
        return {
          type: "ParticipantDeclaration",
          declType,
          name: nameToken.value,
          label,
          stereotype,
          order,
          color: color2,
          line: token.line,
          column: token.column
        };
      }
      if (this.match(
        "ALT" /* ALT */,
        "OPT" /* OPT */,
        "LOOP" /* LOOP */,
        "PAR" /* PAR */,
        "BREAK" /* BREAK */,
        "CRITICAL" /* CRITICAL */,
        "GROUP" /* GROUP */,
        "PARTITION" /* PARTITION */,
        "BOX" /* BOX */
      )) {
        return this.parseGroup();
      }
      if (this.match("REF" /* REF */)) {
        this.consume("OVER" /* OVER */, "Expected 'over' after ref");
        const participants = [];
        participants.push(this.consumeIdentifier("Expected participant name in ref").value);
        while (this.match("COMMA" /* COMMA */)) {
          participants.push(this.consumeIdentifier("Expected participant name after comma").value);
        }
        if (this.match("COLON" /* COLON */)) {
          const label = this.consumeLineText();
          return {
            type: "Reference",
            participants,
            label,
            line: token.line,
            column: token.column
          };
        } else {
          this.consumeLineEnd();
          const lines = [];
          while (!this.isAtEnd()) {
            if (this.check("END" /* END */) && this.peekNext().type === "REF" /* REF */) {
              this.advance();
              this.advance();
              this.consumeLineEnd();
              break;
            }
            if (this.check("END" /* END */) && this.peekNext().type === "NEWLINE" /* NEWLINE */) {
              this.advance();
              this.consumeLineEnd();
              break;
            }
            lines.push(this.consumeLineRawText());
          }
          return {
            type: "Reference",
            participants,
            label: lines.join("\n"),
            line: token.line,
            column: token.column
          };
        }
      }
      if (this.match("NOTE" /* NOTE */, "HNOTE" /* HNOTE */, "RNOTE" /* RNOTE */, "BNOTE" /* BNOTE */)) {
        const noteKeywordToken = this.previous();
        const shapeKeyword = noteKeywordToken.type;
        let shape = "folder";
        if (shapeKeyword === "HNOTE" /* HNOTE */) shape = "hexagon";
        else if (shapeKeyword === "RNOTE" /* RNOTE */) shape = "rectangle";
        else if (shapeKeyword === "BNOTE" /* BNOTE */) shape = "bubble";
        let positionToken;
        if (this.match("IDENTIFIER" /* IDENTIFIER */, "LEFT" /* LEFT */, "RIGHT" /* RIGHT */, "TOP" /* TOP */, "BOTTOM" /* BOTTOM */, "OVER" /* OVER */)) {
          positionToken = this.previous();
        } else {
          const token2 = this.peek();
          throw new Error(`Syntax error at line ${token2.line}, col ${token2.column}: Expected note position (left, right, over, across) (Got: ${token2.type} '${token2.value}')`);
        }
        const position = positionToken.value.toLowerCase();
        let participants = [];
        if (this.match("OF" /* OF */)) {
          participants.push(this.consumeIdentifier("Expected participant name in note").value);
          while (this.match("COMMA" /* COMMA */)) {
            participants.push(this.consumeIdentifier("Expected participant name after comma").value);
          }
        } else if (this.check("IDENTIFIER" /* IDENTIFIER */) && !this.peek().value.startsWith("#") && this.peek().value !== ":") {
          participants.push(this.advance().value);
          while (this.match("COMMA" /* COMMA */)) {
            participants.push(this.consumeIdentifier("Expected participant name after comma").value);
          }
        }
        let color2 = void 0;
        if (this.check("COLOR" /* COLOR */)) {
          color2 = this.advance().value;
        }
        if (this.match("COLON" /* COLON */)) {
          const text2 = this.consumeLineText();
          return {
            type: "Note",
            position,
            participants,
            text: text2,
            shape,
            color: color2,
            sameStep: isSameStep,
            line: token.line,
            column: token.column
          };
        } else {
          this.consumeLineEnd();
          const lines = [];
          while (!this.isAtEnd()) {
            const next = this.peek();
            const isEndNote = next.type === "END" /* END */ && this.peekNext().type === "NOTE" /* NOTE */;
            const isEndHnote = next.type === "END" /* END */ && this.peekNext().type === "HNOTE" /* HNOTE */;
            const isEndRnote = next.type === "END" /* END */ && this.peekNext().type === "RNOTE" /* RNOTE */;
            const isEndBnote = next.type === "END" /* END */ && this.peekNext().type === "BNOTE" /* BNOTE */;
            const isEndPlain = next.type === "END" /* END */ && (this.peekNext().value === "hnote" || this.peekNext().value === "rnote" || this.peekNext().value === "bnote" || this.peekNext().value === "note");
            if (isEndNote || isEndHnote || isEndRnote || isEndBnote || isEndPlain) {
              this.advance();
              this.advance();
              this.consumeLineEnd();
              break;
            }
            if (next.type === "END" /* END */ && this.peekNext().type === "NEWLINE" /* NEWLINE */) {
              this.advance();
              this.consumeLineEnd();
              break;
            }
            lines.push(this.consumeLineRawText());
          }
          return {
            type: "Note",
            position,
            participants,
            text: lines.join("\n"),
            shape,
            color: color2,
            sameStep: isSameStep,
            line: token.line,
            column: token.column
          };
        }
      }
      if (this.match("RETURN" /* RETURN */)) {
        let text2 = "";
        if (this.match("COLON" /* COLON */)) {
          text2 = this.consumeLineText();
        } else {
          text2 = this.consumeLineText();
        }
        return {
          type: "Message",
          from: "",
          // compiler will resolve to last active
          to: "",
          arrow: "<--",
          // compiler will handle return arrow
          text: text2,
          line: token.line,
          column: token.column
        };
      }
      if (this.match("AUTONUMBER" /* AUTONUMBER */)) {
        if (this.match("STOP" /* STOP */)) {
          this.consumeLineEnd();
          return {
            type: "Autonumber",
            action: "stop",
            line: token.line,
            column: token.column
          };
        }
        if (this.match("RESUME" /* RESUME */)) {
          let increment2 = void 0;
          let format2 = void 0;
          if (this.check("IDENTIFIER" /* IDENTIFIER */)) {
            const nextVal = this.peek().value;
            if (/^\d+$/.test(nextVal)) {
              increment2 = parseInt(this.advance().value, 10);
            }
          }
          if (this.check("IDENTIFIER" /* IDENTIFIER */)) {
            format2 = this.advance().value;
          }
          this.consumeLineEnd();
          return {
            type: "Autonumber",
            action: "resume",
            increment: increment2,
            format: format2,
            line: token.line,
            column: token.column
          };
        }
        if (this.match("INC" /* INC */)) {
          const levelToken = this.consumeIdentifier("Expected level A, B after inc");
          this.consumeLineEnd();
          return {
            type: "Autonumber",
            action: "inc",
            level: levelToken.value,
            line: token.line,
            column: token.column
          };
        }
        let start = void 0;
        let increment = void 0;
        let format = void 0;
        if (this.check("IDENTIFIER" /* IDENTIFIER */)) {
          const nextVal = this.peek().value;
          if (/^[\d.]+$/.test(nextVal)) {
            start = this.advance().value;
            if (this.check("IDENTIFIER" /* IDENTIFIER */)) {
              const nextVal2 = this.peek().value;
              if (/^\d+$/.test(nextVal2)) {
                increment = parseInt(this.advance().value, 10);
              }
            }
          }
        }
        if (this.check("IDENTIFIER" /* IDENTIFIER */)) {
          format = this.advance().value;
        }
        this.consumeLineEnd();
        return {
          type: "Autonumber",
          action: "start",
          start,
          increment,
          format,
          line: token.line,
          column: token.column
        };
      }
      if (this.match("AUTOACTIVATE" /* AUTOACTIVATE */)) {
        const stateToken = this.consumeIdentifier("Expected 'on' or 'off' for autoactivate");
        const enabled = stateToken.value.toLowerCase() === "on";
        this.consumeLineEnd();
        return {
          type: "Autoactivate",
          enabled,
          line: token.line,
          column: token.column
        };
      }
      let fromNode = "";
      if (this.check("LBRACKET" /* LBRACKET */)) {
        this.advance();
        fromNode = "[";
      } else if (this.check("RBRACKET" /* RBRACKET */)) {
        this.advance();
        fromNode = "]";
      } else if (this.check("ARROW" /* ARROW */)) {
        fromNode = "[";
      } else if (!this.isAtEnd() && this.peek().type !== "NEWLINE" /* NEWLINE */) {
        fromNode = this.advance().value;
      }
      const arrowToken = this.consume("ARROW" /* ARROW */, "Expected message arrow");
      let toNode = "";
      if (this.check("LBRACKET" /* LBRACKET */)) {
        this.advance();
        toNode = "[";
      } else if (this.check("RBRACKET" /* RBRACKET */)) {
        this.advance();
        toNode = "]";
      } else if (!this.isAtEnd() && this.peek().type !== "NEWLINE" /* NEWLINE */ && this.peek().type !== "COLON" /* COLON */ && this.peek().type !== "COLOR" /* COLOR */ && this.peek().type !== "SHORTHAND" /* SHORTHAND */) {
        toNode = this.advance().value;
      } else {
        toNode = "]";
      }
      let shorthand = void 0;
      if (this.match("SHORTHAND" /* SHORTHAND */)) {
        shorthand = this.previous().value;
      }
      let color = void 0;
      if (this.check("COLOR" /* COLOR */)) {
        color = this.advance().value;
      }
      let text = "";
      if (this.match("COLON" /* COLON */)) {
        text = this.consumeLineText();
      } else {
        this.consumeLineEnd();
      }
      const msgNode = {
        type: "Message",
        tag,
        from: fromNode,
        to: toNode,
        arrow: arrowToken.value,
        text,
        shorthand,
        color,
        line: token.line,
        column: token.column
      };
      if (isSameStep) {
        msgNode.arrow = "/" + msgNode.arrow;
      }
      return msgNode;
    }
    parseGroup() {
      const startToken = this.previous();
      const groupType = startToken.value.toLowerCase();
      let label = this.consumeLineText();
      const body = [];
      const sections = [];
      while (this.match("NEWLINE" /* NEWLINE */)) {
      }
      while (!this.check("END" /* END */) && !this.check("ELSE" /* ELSE */) && !this.isAtEnd()) {
        const statement = this.parseLineStatement();
        if (statement) body.push(statement);
        while (this.match("NEWLINE" /* NEWLINE */)) {
        }
      }
      while (this.match("ELSE" /* ELSE */)) {
        const elseToken = this.previous();
        let sectionLabel = this.consumeLineText();
        const sectionBody = [];
        while (this.match("NEWLINE" /* NEWLINE */)) {
        }
        while (!this.check("END" /* END */) && !this.check("ELSE" /* ELSE */) && !this.isAtEnd()) {
          const statement = this.parseLineStatement();
          if (statement) sectionBody.push(statement);
          while (this.match("NEWLINE" /* NEWLINE */)) {
          }
        }
        sections.push({
          type: "GroupSection",
          label: sectionLabel,
          body: sectionBody,
          line: elseToken.line,
          column: elseToken.column
        });
      }
      this.consume("END" /* END */, "Expected 'end' at the end of control group");
      if (groupType === "box" && this.check("BOX" /* BOX */)) {
        this.advance();
      }
      this.consumeLineEnd();
      return {
        type: "Group",
        groupType,
        label,
        body,
        sections,
        line: startToken.line,
        column: startToken.column
      };
    }
    peek() {
      return this.tokens[this.current];
    }
    peekNext() {
      if (this.current + 1 >= this.tokens.length) return this.peek();
      return this.tokens[this.current + 1];
    }
    previous() {
      return this.tokens[this.current - 1];
    }
    isAtEnd() {
      return this.peek().type === "EOF" /* EOF */;
    }
    check(type) {
      if (this.isAtEnd()) return false;
      return this.peek().type === type;
    }
    advance() {
      if (!this.isAtEnd()) this.current++;
      return this.previous();
    }
    match(...types) {
      for (const type of types) {
        if (this.check(type)) {
          this.advance();
          return true;
        }
      }
      return false;
    }
    consume(type, message) {
      if (this.check(type)) return this.advance();
      const token = this.peek();
      throw new Error(`Syntax error at line ${token.line}, col ${token.column}: ${message} (Got: ${token.type} '${token.value}')`);
    }
    consumeLineEnd() {
      if (this.isAtEnd()) return;
      const currentLine = this.peek().line;
      while (!this.isAtEnd() && this.peek().line === currentLine) {
        const token = this.advance();
        if (token.type === "NEWLINE" /* NEWLINE */) break;
      }
    }
    consumeLineText() {
      if (this.isAtEnd() || this.check("NEWLINE" /* NEWLINE */)) {
        this.consumeLineEnd();
        return "";
      }
      const token = this.peek();
      const rawLine = this.sourceLines[token.line - 1] || "";
      let startIdx = token.column - 1;
      let minStartIdx = 0;
      if (this.current > 0 && this.tokens[this.current - 1].type === "COLON" /* COLON */) {
        const colonToken = this.tokens[this.current - 1];
        if (colonToken.line === token.line) {
          minStartIdx = colonToken.column;
        }
      }
      while (startIdx > minStartIdx && rawLine[startIdx] !== '"' && rawLine[startIdx - 1] !== " " && rawLine[startIdx - 1] !== "	") {
        startIdx--;
      }
      if (startIdx > minStartIdx && rawLine[startIdx - 1] === '"') {
        startIdx--;
      }
      const text = rawLine.substring(startIdx).trim();
      this.consumeLineEnd();
      return text;
    }
    consumeLineRawText() {
      if (this.isAtEnd()) {
        return "";
      }
      const token = this.peek();
      const rawLine = this.sourceLines[token.line - 1] || "";
      this.consumeLineEnd();
      return rawLine;
    }
    consumeIdentifier(message) {
      if (this.check("IDENTIFIER" /* IDENTIFIER */)) return this.advance();
      const nextType = this.peek().type;
      if (nextType !== "EOF" /* EOF */ && nextType !== "NEWLINE" /* NEWLINE */ && nextType !== "COLON" /* COLON */ && nextType !== "ARROW" /* ARROW */) {
        return this.advance();
      }
      const token = this.peek();
      throw new Error(`Syntax error at line ${token.line}, col ${token.column}: ${message} (Got: ${token.type} '${token.value}')`);
    }
  };

  // src/core/RichText.ts
  function formatRichText(text) {
    if (!text) return "";
    let escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
    escaped = escaped.replace(/&lt;b&gt;(.*?)&lt;\/b&gt;/gi, '<tspan font-weight="bold">$1</tspan>');
    escaped = escaped.replace(/&lt;u&gt;(.*?)&lt;\/u&gt;/gi, '<tspan text-decoration="underline">$1</tspan>');
    escaped = escaped.replace(/&lt;i&gt;(.*?)&lt;\/i&gt;/gi, '<tspan font-style="italic">$1</tspan>');
    escaped = escaped.replace(/&lt;s&gt;(.*?)&lt;\/s&gt;/gi, '<tspan text-decoration="line-through">$1</tspan>');
    escaped = escaped.replace(/&lt;font\s+color=(?:&quot;)?(.*?)(?:&quot;)?&gt;(.*?)&lt;\/font&gt;/gi, '<tspan fill="$1">$2</tspan>');
    escaped = escaped.replace(/&lt;b&gt;(?!.*&lt;\/b&gt;)(.*)/gi, '<tspan font-weight="bold">$1</tspan>');
    escaped = escaped.replace(/&lt;font\s+color=(?:&quot;)?(.*?)(?:&quot;)?&gt;(?!.*&lt;\/font&gt;)(.*)/gi, '<tspan fill="$1">$2</tspan>');
    escaped = escaped.replace(/\*\*(.*?)\*\*/g, '<tspan font-weight="bold">$1</tspan>');
    escaped = escaped.replace(/\/\/(.*?)\/\//g, '<tspan font-style="italic">$1</tspan>');
    escaped = escaped.replace(/""(.*?)""/g, '<tspan font-family="monospace">$1</tspan>');
    escaped = escaped.replace(/--(.*?)--/g, '<tspan text-decoration="line-through">$1</tspan>');
    escaped = escaped.replace(/__(.*?)__/g, '<tspan text-decoration="underline">$1</tspan>');
    escaped = escaped.replace(/~~(.*?)~~/g, '<tspan style="text-decoration: underline; text-decoration-style: wavy">$1</tspan>');
    return escaped;
  }
  function decodeUnicode(text) {
    if (!text) return "";
    return text.replace(/<U\+([0-9a-fA-F]{4})>/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  }

  // src/diagrams/sequence/SequenceDiagram.ts
  var SequenceDiagram = class {
    constructor() {
      this.type = "sequence";
      this.participants = [];
      this.messages = [];
      this.activations = [];
      this.groups = [];
      this.references = [];
      this.notes = [];
      this.dividers = [];
      this.delays = [];
      this.spacings = [];
      this.timeConstraints = [];
      this.taggedSteps = /* @__PURE__ */ new Map();
      this.hideFootbox = false;
      this.delayStyle = "space";
      this.currentStep = 0;
      this.groupStack = [];
      this.autonumberConfig = null;
      this.currentAutonumbers = [0];
      this.autonumberDelimiter = ".";
      this.autonumberStopped = false;
      this.autoactivateEnabled = false;
    }
    setHideFootbox(hide) {
      this.hideFootbox = hide;
    }
    addParticipant(name, label, type = "participant", order, color, stereotype) {
      let participant = this.participants.find((p) => p.name === name);
      if (!participant) {
        participant = { name, label, type, order, color, stereotype };
        this.participants.push(participant);
      } else {
        if (label) participant.label = label;
        if (type !== "participant") participant.type = type;
        if (order !== void 0) participant.order = order;
        if (color) participant.color = color;
        if (stereotype) participant.stereotype = stereotype;
      }
      this.groupStack.forEach((g) => {
        if (!g.participants.includes(name)) g.participants.push(name);
      });
    }
    addMessage(from, to, text, type = "arrow", arrowHead = "default", color, bidirectional, startHead = "none", arrowDelay) {
      const step = this.currentStep++;
      this.addParticipant(from);
      this.addParticipant(to);
      let msgNumber;
      if (this.autonumberConfig && !this.autonumberStopped) {
        this.currentAutonumbers[this.currentAutonumbers.length - 1] += this.autonumberConfig.increment;
        const rawNumber = this.currentAutonumbers.join(this.autonumberDelimiter);
        if (this.autonumberConfig.format) {
          msgNumber = this.autonumberConfig.format.replace(/%d/g, rawNumber);
        } else {
          msgNumber = rawNumber;
        }
      }
      const rawNum = this.currentAutonumbers.join(this.autonumberDelimiter);
      text = text.replace(/%autonumber%/g, rawNum);
      text = decodeUnicode(text);
      this.messages.push({ from, to, text, type, step, arrowHead, startHead, color, bidirectional, number: msgNumber, arrowDelay });
      if (this.autoactivateEnabled && from !== to && type === "arrow") {
        this.activate(to, step, step);
      }
      return step;
    }
    setAutonumber(start = 1, increment = 1, format) {
      this.autonumberConfig = { start: typeof start === "number" ? start : 1, increment, format };
      this.autonumberStopped = false;
      if (typeof start === "string") {
        const parts = start.split(/([.,;:])/);
        if (parts.length > 1) {
          this.autonumberDelimiter = parts[1];
          this.currentAutonumbers = parts.filter((_, i) => i % 2 === 0).map((p) => parseInt(p, 10));
        } else {
          this.currentAutonumbers = [parseInt(start, 10)];
        }
      } else {
        this.currentAutonumbers = [start];
      }
      this.currentAutonumbers[this.currentAutonumbers.length - 1] -= increment;
    }
    incrementAutonumberLevel(level) {
      if (!this.autonumberConfig) return;
      const index = level.toUpperCase().charCodeAt(0) - "A".charCodeAt(0);
      if (index >= 0 && index < this.currentAutonumbers.length) {
        this.currentAutonumbers[index]++;
        for (let i = index + 1; i < this.currentAutonumbers.length; i++) {
          this.currentAutonumbers[i] = 1;
        }
        this.currentAutonumbers[this.currentAutonumbers.length - 1] -= this.autonumberConfig.increment;
      }
    }
    stopAutonumber() {
      this.autonumberStopped = true;
    }
    resumeAutonumber(increment, format) {
      if (this.autonumberConfig) {
        this.autonumberStopped = false;
        if (increment !== void 0) this.autonumberConfig.increment = increment;
        if (format !== void 0) this.autonumberConfig.format = format;
      } else {
        this.setAutonumber(1, increment || 1, format);
      }
    }
    setAutoactivate(enabled) {
      this.autoactivateEnabled = enabled;
    }
    destroy(name, step) {
      const participant = this.participants.find((p) => p.name === name);
      if (participant) {
        participant.destroyedStep = step !== void 0 ? step : this.currentStep++;
        this.deactivate(name, participant.destroyedStep);
      }
    }
    create(name, step) {
      let participant = this.participants.find((p) => p.name === name);
      if (participant) {
        participant.createdStep = step;
      }
    }
    addDivider(label) {
      this.dividers.push({ label, step: this.currentStep++ });
    }
    rewindStep() {
      if (this.currentStep > 0) {
        this.currentStep--;
      }
    }
    nextStep() {
      return this.currentStep++;
    }
    getCurrentStep() {
      return this.currentStep;
    }
    addDelay(text) {
      this.delays.push({ text, step: this.currentStep++ });
    }
    addSpacing(height = 30) {
      this.spacings.push({ height, step: this.currentStep++ });
    }
    setTitle(title) {
      this.title = title;
    }
    setHeader(header) {
      this.header = header;
    }
    setFooter(footer) {
      this.footer = footer;
    }
    returnMessage(text) {
      const lastActive = [...this.activations].reverse().find((a) => a.endStep === void 0);
      if (!lastActive) return;
      const from = lastActive.participantName;
      let to = from;
      if (lastActive.sourceStep !== void 0) {
        const sourceMsg = this.messages.find((m) => m.step === lastActive.sourceStep);
        if (sourceMsg) {
          to = sourceMsg.from;
        }
      }
      const step = this.addMessage(from, to, text, "dotted", "open");
      this.deactivate(from, step);
    }
    addNote(text, position, participants, color, shape = "folder", step) {
      const noteStep = step !== void 0 ? step : this.currentStep++;
      const owner = this.groupStack.length > 0 ? this.groupStack[this.groupStack.length - 1] : void 0;
      const rawNumber = this.currentAutonumbers.join(this.autonumberDelimiter);
      text = text.replace(/%autonumber%/g, rawNumber);
      text = decodeUnicode(text);
      this.notes.push({
        text,
        position,
        participants,
        step: noteStep,
        color,
        shape,
        owner
      });
      return noteStep;
    }
    activate(name, step = this.currentStep, sourceStep, color) {
      this.addParticipant(name);
      const activeCount = this.activations.filter((a) => a.participantName === name && a.endStep === void 0).length;
      this.activations.push({
        participantName: name,
        startStep: step,
        level: activeCount,
        sourceStep,
        color
      });
    }
    deactivate(name, step = this.currentStep, sourceStep) {
      this.addParticipant(name);
      const lastActive = [...this.activations].reverse().find((a) => a.participantName === name && a.endStep === void 0);
      if (lastActive) {
        lastActive.endStep = step;
        lastActive.endSourceStep = sourceStep;
      }
    }
    startGroup(type, label) {
      const step = type === "box" ? this.currentStep : this.nextStep();
      const group = {
        type,
        label,
        startStep: step,
        sections: [],
        level: this.groupStack.length,
        participants: []
      };
      this.groups.push(group);
      this.groupStack.push(group);
      return group;
    }
    addGroupSection(label) {
      const group = this.groupStack[this.groupStack.length - 1];
      if (group) {
        group.sections.push({ label, startStep: this.nextStep() });
      }
    }
    endGroup() {
      const group = this.groupStack.pop();
      if (group) {
        group.endStep = group.type === "box" ? this.currentStep : this.nextStep();
      }
    }
    addReference(participants, label) {
      const startStep = this.nextStep();
      const endStep = this.nextStep();
      this.references.push({ participants, label, startStep, endStep });
    }
    addTaggedStep(tag, step) {
      this.taggedSteps.set(tag, step);
    }
    addTimeConstraint(startTag, endTag, label) {
      this.timeConstraints.push({ startTag, endTag, label });
    }
  };

  // src/diagrams/sequence/parser/SequenceASTCompiler.ts
  var SequenceASTCompiler = class {
    constructor() {
      this.lastMessageStep = -1;
      this.lastMessageFrom = "";
      this.lastMessageTo = "";
      this.lastMessageType = "";
      this.lastActivationStep = /* @__PURE__ */ new Map();
    }
    compile(ast) {
      const diagram = new SequenceDiagram();
      this.lastMessageStep = -1;
      this.lastMessageFrom = "";
      this.lastMessageTo = "";
      this.lastMessageType = "";
      this.lastActivationStep.clear();
      this.compileBody(diagram, ast.body);
      return diagram;
    }
    compileBody(diagram, body) {
      for (const node of body) {
        this.compileNode(diagram, node);
      }
    }
    compileNode(diagram, node) {
      switch (node.type) {
        case "ParticipantDeclaration":
          this.compileParticipantDeclaration(diagram, node);
          break;
        case "Message":
          this.compileMessage(diagram, node);
          break;
        case "Note":
          this.compileNote(diagram, node);
          break;
        case "Group":
          this.compileGroup(diagram, node);
          break;
        case "Divider":
          diagram.addDivider(node.label);
          break;
        case "Delay":
          diagram.addDelay(node.text);
          break;
        case "Spacing":
          diagram.addSpacing(node.height);
          break;
        case "Autonumber":
          this.compileAutonumber(diagram, node);
          break;
        case "Autoactivate":
          diagram.setAutoactivate(node.enabled);
          break;
        case "Activation":
          this.compileActivation(diagram, node);
          break;
        case "Create":
          this.compileCreate(diagram, node);
          break;
        case "Destroy":
          this.compileDestroy(diagram, node);
          break;
        case "Reference":
          this.compileReference(diagram, node);
          break;
        case "TimeConstraint":
          diagram.addTimeConstraint(node.startTag, node.endTag, node.label);
          break;
        case "Meta":
          this.compileMeta(diagram, node);
          break;
      }
    }
    compileParticipantDeclaration(diagram, node) {
      const name = node.name.replace(/^"(.*)"$/, "$1");
      const label = node.label ? node.label.replace(/^"(.*)"$/, "$1") : void 0;
      let participantName;
      let participantLabel;
      if (label) {
        if (label.startsWith('"')) {
          participantName = name;
          participantLabel = label.replace(/^"(.*)"$/, "$1");
        } else {
          participantName = label.replace(/^"(.*)"$/, "$1");
          participantLabel = name;
        }
      } else {
        participantName = name;
        participantLabel = void 0;
      }
      diagram.addParticipant(
        participantName,
        participantLabel,
        node.declType,
        node.order,
        node.color,
        node.stereotype
      );
    }
    compileMessage(diagram, node) {
      if (node.from === "" && node.to === "" && node.arrow === "<--") {
        const normalizedText = node.text.replace(/\\n/g, "\n");
        diagram.returnMessage(normalizedText);
        return;
      }
      let from = node.from;
      let to = node.to;
      if (from) from = from.replace(/^"(.*)"$/, "$1");
      if (to) to = to.replace(/^"(.*)"$/, "$1");
      if (!from || from === "[") from = "[";
      if (!to || to === "]") to = "]";
      let arrow = node.arrow;
      let sameStep = false;
      if (arrow.startsWith("/")) {
        sameStep = true;
        arrow = arrow.substring(1).trim();
        diagram.rewindStep();
      }
      let arrowDelay = void 0;
      const startDelayMatch = arrow.match(/^\((\d+)\)/);
      const endDelayMatch = arrow.match(/\((\d+)\)$/);
      if (startDelayMatch) {
        arrowDelay = parseInt(startDelayMatch[1], 10);
        arrow = arrow.substring(startDelayMatch[0].length);
      } else if (endDelayMatch) {
        arrowDelay = parseInt(endDelayMatch[1], 10);
        arrow = arrow.substring(0, arrow.length - endDelayMatch[0].length);
      }
      let shorthand = node.shorthand;
      let autoActivColor = node.color;
      const arrowMatch = arrow.match(/^([<ox\\/]*)([-.]+)(?:\[(#\w+)\])?([-.]*)([>ox\\/]*)?(?:(--\+\+|\+\+--|--|\+\+|\*\*|!!))?$/i);
      if (arrowMatch) {
        let [, headStartStr, line1, msgColor, line2, headEndStr, arrowShorthand] = arrowMatch;
        if (arrowShorthand) {
          shorthand = arrowShorthand;
        }
        const lineFull = line1 + (line2 || "");
        const isDotted = lineFull.includes("..") || lineFull.includes("--");
        let isBidirectional = headStartStr.includes("<") && (headEndStr || "").includes(">");
        const mapHead = (s, isStart) => {
          if (!s) return "none";
          if (s === ">") return "default";
          if (s === "<") return "default";
          if (s === ">>") return "open";
          if (s === "<<") return "open";
          if (s === "\\" || s === "/") return "half";
          if (s === "\\\\" || s === "//") return "open";
          if (s.includes("x")) return "lost";
          if (s.includes("o")) {
            return "arrow-circle";
          }
          return "default";
        };
        let arrowHead = mapHead(headEndStr || "", false);
        let startHead = mapHead(headStartStr || "", true);
        if (headEndStr === "x") arrowHead = "lost";
        if (from === "x") startHead = "found";
        const normalizedText = node.text.replace(/\\n/g, "\n");
        const step = diagram.addMessage(from, to, normalizedText, isDotted ? "dotted" : "arrow", arrowHead, msgColor, isBidirectional, startHead, arrowDelay);
        if (node.tag) {
          diagram.addTaggedStep(node.tag, step);
        }
        let semanticFrom = from;
        let semanticTo = to;
        const isHead = (h) => ["default", "open", "half", "arrow-circle"].includes(h);
        if (isHead(startHead) && !isHead(arrowHead)) {
          semanticFrom = to;
          semanticTo = from;
        } else if (isHead(arrowHead) && !isHead(startHead)) {
          semanticFrom = from;
          semanticTo = to;
        }
        this.lastMessageStep = step;
        this.lastMessageFrom = semanticFrom;
        this.lastMessageTo = semanticTo;
        this.lastMessageType = isDotted ? "dotted" : "arrow";
        if (shorthand === "++") {
          if (autoActivColor && autoActivColor.startsWith("#")) {
            const hexContent = autoActivColor.substring(1);
            const isHex = /^[0-9A-Fa-f]+$/.test(hexContent) && [3, 4, 6, 8].includes(hexContent.length);
            if (!isHex) {
              autoActivColor = hexContent;
            }
          }
          diagram.activate(to, step, step, autoActivColor);
          this.lastActivationStep.set(to, step);
        } else if (shorthand === "--") {
          diagram.deactivate(from, step, step);
        } else if (shorthand === "--++") {
          diagram.deactivate(from, step, step);
          if (autoActivColor && autoActivColor.startsWith("#")) {
            const hexContent = autoActivColor.substring(1);
            const isHex = /^[0-9A-Fa-f]+$/.test(hexContent) && [3, 4, 6, 8].includes(hexContent.length);
            if (!isHex) {
              autoActivColor = hexContent;
            }
          }
          diagram.activate(to, step, step, autoActivColor);
          this.lastActivationStep.set(to, step);
        } else if (shorthand === "++--") {
          if (autoActivColor && autoActivColor.startsWith("#")) {
            const hexContent = autoActivColor.substring(1);
            const isHex = /^[0-9A-Fa-f]+$/.test(hexContent) && [3, 4, 6, 8].includes(hexContent.length);
            if (!isHex) {
              autoActivColor = hexContent;
            }
          }
          diagram.activate(from, step, step, autoActivColor);
          this.lastActivationStep.set(from, step);
          diagram.deactivate(to, step, step);
        } else if (shorthand === "**") {
          diagram.create(to, step);
        } else if (shorthand === "!!") {
          diagram.destroy(to, step);
        }
      }
    }
    compileNote(diagram, node) {
      if (node.sameStep) {
        diagram.rewindStep();
      }
      const normPos = node.position;
      let participants = node.participants.map((p) => p.replace(/^"(.*)"$/, "$1"));
      let associationStep;
      if (participants.length === 0) {
        if ((normPos === "right" || normPos === "left") && this.lastMessageFrom && this.lastMessageTo) {
          const idxFrom = diagram.participants.findIndex((p) => p.name === this.lastMessageFrom);
          const idxTo = diagram.participants.findIndex((p) => p.name === this.lastMessageTo);
          if (idxFrom !== -1 && idxTo !== -1) {
            const pFrom = diagram.participants[idxFrom];
            const pTo = diagram.participants[idxTo];
            let isFromLeftOfTo = idxFrom < idxTo;
            if (pFrom.order !== void 0 && pTo.order !== void 0) {
              isFromLeftOfTo = pFrom.order < pTo.order;
            }
            if (normPos === "left") {
              participants = [isFromLeftOfTo ? this.lastMessageFrom : this.lastMessageTo];
            } else {
              participants = [isFromLeftOfTo ? this.lastMessageTo : this.lastMessageFrom];
            }
          } else {
            participants = [this.lastMessageTo];
          }
          if (this.lastMessageStep !== -1) {
            associationStep = this.lastMessageStep;
          }
        }
      }
      const normalizedText = node.text.replace(/\\n/g, "\n");
      diagram.addNote(
        normalizedText,
        node.position,
        participants,
        node.color,
        node.shape,
        associationStep
      );
    }
    compileGroup(diagram, node) {
      if (node.groupType === "box") {
        let parsedLabel = "";
        let parsedColor = void 0;
        let remaining = node.label.trim();
        const colorMatch = remaining.match(/#([a-zA-Z0-9]+)/);
        if (colorMatch) {
          parsedColor = "#" + colorMatch[1];
          remaining = remaining.replace(colorMatch[0], "").trim();
        }
        const quoteMatch = remaining.match(/^"([^"]*)"$/) || remaining.match(/^"([^"]*)"/);
        if (quoteMatch) {
          parsedLabel = quoteMatch[1];
        } else {
          parsedLabel = remaining.replace(/^"(.*)"$/, "$1");
        }
        const group = diagram.startGroup(node.groupType, parsedLabel);
        if (parsedColor) {
          group.color = parsedColor;
        }
      } else {
        diagram.startGroup(node.groupType, node.label);
      }
      for (const child of node.body) {
        this.compileNode(diagram, child);
      }
      for (const section of node.sections) {
        diagram.addGroupSection(section.label);
        for (const child of section.body) {
          this.compileNode(diagram, child);
        }
      }
      diagram.endGroup();
    }
    compileActivation(diagram, node) {
      const name = node.name.replace(/^"(.*)"$/, "$1");
      let color = node.color;
      if (color && color.startsWith("#")) {
        const hexContent = color.substring(1);
        const isHex = /^[0-9A-Fa-f]+$/.test(hexContent) && [3, 4, 6, 8].includes(hexContent.length);
        if (!isHex) color = hexContent;
      }
      if (node.action === "activate") {
        if (name === this.lastMessageTo && this.lastMessageStep !== -1) {
          diagram.activate(name, this.lastMessageStep, this.lastMessageStep, color);
          this.lastActivationStep.set(name, this.lastMessageStep);
        } else {
          const step = diagram.nextStep();
          diagram.activate(name, step, void 0, color);
          this.lastActivationStep.set(name, step);
        }
      } else if (node.action === "deactivate") {
        let shouldAlign = false;
        if (this.lastMessageStep !== -1 && this.lastMessageStep > (this.lastActivationStep.get(name) ?? -1)) {
          if (this.lastMessageType === "arrow") {
            shouldAlign = name === this.lastMessageTo || name === this.lastMessageFrom;
          } else if (this.lastMessageType === "dotted") {
            shouldAlign = name === this.lastMessageFrom;
          }
        }
        if (shouldAlign) {
          diagram.deactivate(name, this.lastMessageStep);
        } else {
          diagram.deactivate(name, diagram.nextStep());
        }
      }
    }
    compileCreate(diagram, node) {
      const name = node.name.replace(/^"(.*)"$/, "$1");
      diagram.addParticipant(name, void 0, node.declType);
      diagram.create(name, diagram.getCurrentStep());
    }
    compileDestroy(diagram, node) {
      const name = node.name.replace(/^"(.*)"$/, "$1");
      let shouldAlign = false;
      if (this.lastMessageStep !== -1 && this.lastMessageStep > (this.lastActivationStep.get(name) ?? -1)) {
        if (this.lastMessageType === "arrow") {
          shouldAlign = name === this.lastMessageTo || name === this.lastMessageFrom;
        } else if (this.lastMessageType === "dotted") {
          shouldAlign = name === this.lastMessageFrom;
        }
      }
      if (shouldAlign) {
        diagram.destroy(name, this.lastMessageStep);
      } else {
        diagram.destroy(name, diagram.nextStep());
      }
    }
    compileReference(diagram, node) {
      const participants = node.participants.map((p) => p.replace(/^"(.*)"$/, "$1"));
      diagram.addReference(participants, node.label);
    }
    compileAutonumber(diagram, node) {
      if (node.action === "stop") {
        diagram.stopAutonumber();
      } else if (node.action === "resume") {
        diagram.resumeAutonumber(node.increment, node.format);
      } else if (node.action === "inc") {
        if (node.level) {
          diagram.incrementAutonumberLevel(node.level);
        }
      } else {
        const start = node.start !== void 0 ? node.start : 1;
        const increment = node.increment !== void 0 ? node.increment : 1;
        diagram.setAutonumber(start, increment, node.format);
      }
    }
    compileMeta(diagram, node) {
      if (node.metaType === "title") {
        diagram.setTitle(node.value || "");
      } else if (node.metaType === "header") {
        diagram.setHeader(node.value || "");
      } else if (node.metaType === "footer") {
        diagram.setFooter(node.value || "");
      } else if (node.metaType === "hide_footbox") {
        diagram.setHideFootbox(true);
      } else if (node.metaType === "skinparam") {
        if (node.value) {
          const parts = node.value.trim().split(/\s+/);
          if (parts.length >= 2) {
            const key = parts[0];
            const val = parts.slice(1).join(" ");
            if (key === "sequenceDelayStyle") {
              if (val === "space" || val === "lifeline" || val === "dots") {
                diagram.delayStyle = val;
              }
            }
          }
        }
      }
    }
  };

  // src/diagrams/sequence/SequenceParser.ts
  var SequenceParser = class {
    parse(content) {
      const lexer = new Lexer(content);
      const tokens = lexer.scanTokens();
      const astParser = new SequenceASTParser(tokens, content);
      const ast = astParser.parse();
      const compiler = new SequenceASTCompiler();
      return compiler.compile(ast);
    }
  };

  // src/diagrams/sequence/SequenceTheme.ts
  var defaultTheme = {
    padding: 16,
    participantWidth: 120,
    participantHeight: 40,
    participantGap: 180,
    defaultMessageGap: 50,
    fontSize: 14,
    activationWidth: 12,
    colors: {
      defaultStroke: "#333333",
      defaultFill: "#eeeeee",
      actorFill: "#f8f9fa",
      noteFill: "#ffffcc",
      line: "#666666",
      text: "#000000"
    },
    fontFamily: "sans-serif"
  };

  // src/diagrams/sequence/SequenceLayout.ts
  var LayoutEngine = class {
    constructor(theme) {
      this.theme = theme;
    }
    calculateLayout(diagram) {
      const participants = [...diagram.participants].filter((p) => p.name !== "[" && p.name !== "]" && p.name !== "?").sort((a, b) => {
        if (a.order !== void 0 && b.order !== void 0) return a.order - b.order;
        if (a.order !== void 0) return -1;
        if (b.order !== void 0) return 1;
        return 0;
      });
      const maxStep = this.calculateMaxStep(diagram);
      this.finalizeEndSteps(diagram, maxStep);
      const hasBoxWithLabel = diagram.groups.some((g) => g.type === "box" && g.label);
      let participantYStart = this.theme.padding;
      if (hasBoxWithLabel) {
        participantYStart += 25;
      }
      if (diagram.title) {
        participantYStart = Math.max(participantYStart, 55 + (hasBoxWithLabel ? 25 : 0));
      } else if (diagram.header) {
        participantYStart = Math.max(participantYStart, 35 + (hasBoxWithLabel ? 25 : 0));
      }
      let bottomPadding = this.theme.padding;
      if (diagram.footer) {
        bottomPadding += 25;
      }
      const stepHeightResult = this.calculateStepHeights(diagram, maxStep, participantYStart);
      const stepY = stepHeightResult.stepY;
      const currentY = stepHeightResult.totalHeight;
      const pWidths = participants.map((p) => this.calculateParticipantWidth(p));
      const gaps = this.calculateGaps(diagram, participants, pWidths);
      const relpCenterX = this.calculateRelativepCenterXs(participants, pWidths, gaps);
      const noteLayoutsMap = this.preCalculateNoteLayouts(diagram, participants, relpCenterX, pWidths, stepY);
      const bounds = this.calculateBounds(participants, relpCenterX, pWidths, noteLayoutsMap, diagram.messages, diagram.groups);
      const offsetX = this.theme.padding - bounds.minX;
      const baseWidth = bounds.maxX - bounds.minX + this.theme.padding * 2;
      let totalWidth = baseWidth;
      if (diagram.timeConstraints.length > 0) {
        const maxLabelLength = Math.max(...diagram.timeConstraints.map((tc) => tc.label.length), 0);
        const timeConstraintSpace = 50 + maxLabelLength * 8;
        totalWidth += timeConstraintSpace;
      }
      const footboxHeight = diagram.hideFootbox ? 0 : this.theme.participantHeight + 20;
      const totalHeight = currentY + footboxHeight + bottomPadding;
      const participantLayouts = participants.map((p, i) => {
        const centerX = relpCenterX[i] + offsetX;
        return {
          participant: p,
          centerX,
          x: centerX - pWidths[i] / 2,
          y: p.createdStep !== void 0 ? stepY[p.createdStep] - this.theme.participantHeight / 2 : participantYStart,
          width: pWidths[i],
          height: this.theme.participantHeight,
          destroyedY: p.destroyedStep !== void 0 ? stepY[p.destroyedStep] : void 0
        };
      });
      const finalNoteLayouts = [];
      noteLayoutsMap.forEach((layout, note) => {
        let x = layout.x + offsetX;
        let w = layout.width;
        if (note.position === "across") {
          x = this.theme.padding;
          w = Math.max(baseWidth - this.theme.padding * 2, layout.width);
        }
        finalNoteLayouts.push({
          note,
          x,
          y: layout.y,
          width: w,
          height: layout.height
        });
      });
      const groupLayouts = this.calculateGroupLayouts(diagram, participantLayouts, finalNoteLayouts, stepY, maxStep, participantYStart, totalHeight, bottomPadding);
      const activationLayouts = this.calculateActivationLayouts(diagram, participantLayouts, stepY, diagram.messages);
      return {
        width: totalWidth,
        height: totalHeight,
        participants: participantLayouts,
        notes: finalNoteLayouts,
        dividers: this.calculateDividerLayouts(diagram, stepY, totalWidth),
        references: this.calculateReferenceLayouts(diagram, participantLayouts, stepY),
        messages: this.calculateMessageLayouts(diagram, participantLayouts, stepY, activationLayouts),
        groups: groupLayouts,
        activations: activationLayouts,
        delays: this.calculateDelayLayouts(diagram, stepY),
        timeConstraints: this.calculateTimeConstraintLayouts(diagram, participantLayouts, stepY, baseWidth)
      };
    }
    calculateMessageLayouts(diagram, participants, stepY, activations) {
      const leftmostParticipant = participants[0];
      const rightmostParticipant = participants[participants.length - 1];
      return diagram.messages.map((m) => {
        const fromIdx = participants.findIndex((p) => p.participant.name === m.from);
        const toIdx = participants.findIndex((p) => p.participant.name === m.to);
        const y = stepY[m.step];
        let x1 = 0;
        if (fromIdx !== -1) {
          x1 = participants[fromIdx].centerX;
        } else if (m.from === "[") {
          x1 = leftmostParticipant ? leftmostParticipant.centerX - 80 : 50;
        } else if (m.from === "]") {
          x1 = rightmostParticipant ? rightmostParticipant.centerX + 80 : 150;
        } else if (m.from === "?") {
          const toX = toIdx !== -1 ? participants[toIdx].centerX : 100;
          x1 = toX - 50;
        }
        let x2 = 0;
        if (toIdx !== -1) {
          x2 = participants[toIdx].centerX;
        } else if (m.to === "]") {
          x2 = rightmostParticipant ? rightmostParticipant.centerX + 80 : 150;
        } else if (m.to === "[") {
          x2 = leftmostParticipant ? leftmostParticipant.centerX - 80 : 50;
        } else if (m.to === "?") {
          const fromX = fromIdx !== -1 ? participants[fromIdx].centerX : 50;
          x2 = fromX + 50;
        }
        if (fromIdx !== -1 || toIdx !== -1) {
          const fromActivations = fromIdx !== -1 ? activations.filter((a) => a.activation.participantName === m.from && a.activation.startStep <= m.step && (a.activation.endStep ?? Infinity) >= m.step).sort((a, b) => b.activation.level - a.activation.level) : [];
          const toActivations = toIdx !== -1 ? activations.filter((a) => a.activation.participantName === m.to && a.activation.startStep <= m.step && (a.activation.endStep ?? Infinity) >= m.step).sort((a, b) => b.activation.level - a.activation.level) : [];
          if (fromIdx !== toIdx) {
            const isLeftToRight = fromIdx !== -1 && toIdx !== -1 ? fromIdx < toIdx : true;
            if (isLeftToRight) {
              if (fromActivations.length > 0) {
                x1 = fromActivations[0].x + fromActivations[0].width;
              }
              if (toActivations.length > 0) {
                x2 = toActivations[0].x;
              }
            } else {
              if (fromActivations.length > 0) {
                x1 = fromActivations[0].x;
              }
              if (toActivations.length > 0) {
                x2 = toActivations[0].x + toActivations[0].width;
              }
            }
          }
        }
        if (toIdx !== -1 && participants[toIdx].participant.createdStep === m.step) {
          x2 = participants[toIdx].x;
        }
        const isHead = (h) => h && ["default", "open", "half", "arrow-circle"].includes(h);
        const isReverse = isHead(m.startHead) && !isHead(m.arrowHead);
        const delay = m.arrowDelay || 0;
        let y1 = y;
        let y2 = y;
        if (delay > 0) {
          if (isReverse) {
            y1 = y + delay;
          } else {
            y2 = y + delay;
          }
        }
        const points = [{ x: x1, y: y1 }, { x: x2, y: y2 }];
        let labelPosition = { x: (x1 + x2) / 2, y: y + delay / 2 };
        if (fromIdx === toIdx && fromIdx !== -1) {
          const activeActivations = activations.filter(
            (a) => a.activation.participantName === m.from && a.activation.startStep <= m.step && (a.activation.endStep ?? Infinity) >= m.step
          ).sort((a, b) => b.activation.level - a.activation.level);
          let startLevelIdx = 0;
          let endLevelIdx = 0;
          if (activeActivations.length > 0) {
            const highest = activeActivations[0];
            if (highest.activation.startStep === m.step) {
              if (activeActivations.length > 1) {
                startLevelIdx = 1;
                endLevelIdx = 0;
              } else {
                startLevelIdx = void 0;
                endLevelIdx = 0;
              }
            } else if (highest.activation.endStep === m.step) {
              if (activeActivations.length > 1) {
                startLevelIdx = 0;
                endLevelIdx = 1;
              } else {
                startLevelIdx = 0;
                endLevelIdx = void 0;
              }
            }
            const baseXStart = startLevelIdx !== void 0 && activeActivations.length > startLevelIdx ? activeActivations[startLevelIdx].x + activeActivations[startLevelIdx].width : participants[fromIdx].centerX;
            const baseXEnd = endLevelIdx !== void 0 && activeActivations.length > endLevelIdx ? activeActivations[endLevelIdx].x + activeActivations[endLevelIdx].width : participants[fromIdx].centerX;
            const diff = 40;
            points[0] = { x: baseXStart, y };
            points[1] = { x: Math.max(baseXStart, baseXEnd) + diff, y };
            points.push({ x: Math.max(baseXStart, baseXEnd) + diff, y: y + 25 + delay });
            points.push({ x: baseXEnd, y: y + 25 + delay });
            labelPosition = { x: Math.max(baseXStart, baseXEnd) + diff + 5, y: y + 10 + delay / 2 };
          } else {
            const baseX = participants[fromIdx].centerX;
            const diff = 40;
            points[0] = { x: baseX, y };
            points[1] = { x: baseX + diff, y };
            points.push({ x: baseX + diff, y: y + 25 + delay });
            points.push({ x: baseX, y: y + 25 + delay });
            labelPosition = { x: baseX + diff + 5, y: y + 10 + delay / 2 };
          }
        }
        return {
          message: m,
          y,
          points,
          labelPosition,
          lineStyle: m.type === "dotted" ? "dashed" : "solid"
        };
      });
    }
    calculateDividerLayouts(diagram, stepY, totalWidth) {
      return diagram.dividers.map((d) => ({
        y: stepY[d.step],
        label: d.label
      }));
    }
    calculateDelayLayouts(diagram, stepY) {
      return diagram.delays.map((d) => ({
        y: stepY[d.step],
        text: d.text
      }));
    }
    calculateTimeConstraintLayouts(diagram, participants, stepY, totalWidth) {
      return diagram.timeConstraints.map((tc) => {
        const startStep = diagram.taggedSteps.get(tc.startTag);
        const endStep = diagram.taggedSteps.get(tc.endTag);
        if (startStep === void 0 || endStep === void 0) {
          return null;
        }
        return {
          x: totalWidth - this.theme.padding + 20,
          // Position to the right of the diagram
          startY: stepY[startStep],
          endY: stepY[endStep],
          label: tc.label
        };
      }).filter((tc) => tc !== null);
    }
    calculateReferenceLayouts(diagram, participants, stepY) {
      return diagram.references.map((r) => {
        const pIdxs = r.participants.map((name) => participants.findIndex((pl) => pl.participant.name === name)).filter((i) => i !== -1);
        if (pIdxs.length === 0) return null;
        const minIdx = Math.min(...pIdxs);
        const maxIdx = Math.max(...pIdxs);
        const x = participants[minIdx].x;
        const w = participants[maxIdx].x + participants[maxIdx].width - x;
        const y = stepY[r.startStep] - 10;
        const h = stepY[r.endStep] - y;
        return {
          reference: r,
          x,
          y,
          width: w,
          height: h
        };
      }).filter((r) => r !== null);
    }
    calculateActivationLayouts(diagram, participants, stepY, messages) {
      return diagram.activations.map((a) => {
        const pIdx = participants.findIndex((p2) => p2.participant.name === a.participantName);
        if (pIdx === -1) return null;
        const p = participants[pIdx];
        const x = p.centerX - this.theme.activationWidth / 2 + a.level * 5;
        let y = stepY[a.startStep];
        if (a.sourceStep !== void 0) {
          const triggerMsg = messages.find((m) => m.step === a.sourceStep);
          if (triggerMsg && triggerMsg.from === a.participantName && triggerMsg.to === a.participantName) {
            y += 25;
          }
        }
        let yEnd = stepY[a.endStep];
        if (a.endSourceStep !== void 0) {
          const closeMsg = messages.find((m) => m.step === a.endSourceStep);
          if (closeMsg && closeMsg.from === a.participantName && closeMsg.to === a.participantName) {
            yEnd += 25;
          }
        }
        const minHeight = 5;
        const height = Math.max(minHeight, yEnd - y);
        return {
          activation: a,
          x,
          y,
          width: this.theme.activationWidth,
          height
        };
      }).filter((a) => a !== null);
    }
    // ... Helper methods (implementation details moved from Renderer) ...
    calculateMaxStep(diagram) {
      let maxStep = 0;
      const allElements = [
        ...diagram.messages,
        ...diagram.activations,
        ...diagram.groups,
        ...diagram.references,
        ...diagram.notes,
        ...diagram.dividers,
        ...diagram.delays,
        ...diagram.spacings
      ];
      allElements.forEach((e) => {
        const s1 = e.step ?? 0;
        const s2 = e.startStep ?? 0;
        const s3 = e.endStep ?? 0;
        const s = Math.max(s1, s2, s3);
        if (s > maxStep) maxStep = s;
      });
      return maxStep + 1;
    }
    finalizeEndSteps(diagram, maxStep) {
      diagram.activations.forEach((a) => {
        if (a.endStep === void 0) a.endStep = maxStep;
      });
      diagram.groups.forEach((g) => {
        if (g.endStep === void 0) g.endStep = maxStep;
      });
    }
    calculateStepHeights(diagram, maxStep, participantYStart) {
      const stepHeights = new Array(maxStep + 1).fill(this.theme.defaultMessageGap);
      const topExtension = new Array(maxStep + 2).fill(0);
      const bottomExtension = new Array(maxStep + 2).fill(0);
      diagram.notes.forEach((n) => {
        const lines = n.text.split("\n");
        const noteHeight = lines.length * 20 + 10;
        topExtension[n.step] = Math.max(topExtension[n.step], noteHeight / 2);
        bottomExtension[n.step] = Math.max(bottomExtension[n.step], noteHeight / 2);
      });
      diagram.messages.forEach((m) => {
        const hasText = m.text && m.text.trim() !== "";
        const lines = hasText ? m.text.split("\n") : [];
        const textLines = lines.length;
        const delay = m.arrowDelay || 0;
        if (m.from === m.to) {
          const loopHeight = Math.max(25, textLines * 20);
          topExtension[m.step] = Math.max(topExtension[m.step], 0);
          bottomExtension[m.step] = Math.max(bottomExtension[m.step], loopHeight + 10 + delay);
        } else {
          const textHeight = hasText ? textLines * 15 + 5 : 0;
          topExtension[m.step] = Math.max(topExtension[m.step], textHeight);
          bottomExtension[m.step] = Math.max(bottomExtension[m.step], delay);
        }
      });
      const maxGroupLevel = diagram.groups.length > 0 ? Math.max(...diagram.groups.map((g) => g.level)) : 0;
      diagram.groups.forEach((g) => {
        if (g.type === "box") return;
        const levelOffset = maxGroupLevel - g.level;
        const vPaddingTop = 25 + levelOffset * 8;
        const vPaddingBottom = 5 + levelOffset * 8;
        topExtension[g.startStep] = Math.max(topExtension[g.startStep], vPaddingTop);
        if (g.endStep !== void 0) {
          bottomExtension[g.endStep] = Math.max(bottomExtension[g.endStep], vPaddingBottom);
        }
      });
      const baseHeights = new Array(maxStep + 1).fill(this.theme.defaultMessageGap);
      if (maxStep > 0) {
        baseHeights[maxStep - 1] = 40;
      }
      for (let i = 0; i <= maxStep; i++) {
        const stepMessages = diagram.messages.filter((m) => m.step === i);
        if (stepMessages.length > 0) {
          baseHeights[i] = 20;
        }
      }
      diagram.dividers.forEach((d) => {
        baseHeights[d.step] = 30;
      });
      diagram.delays.forEach((d) => {
        baseHeights[d.step] = 40;
      });
      diagram.spacings.forEach((s) => {
        baseHeights[s.step] = s.height;
      });
      diagram.references.forEach((r) => {
        const lines = r.label.split("\n");
        const textHeight = lines.length * 15 + 40;
        if (r.endStep === r.startStep + 1) {
          baseHeights[r.startStep] = Math.max(baseHeights[r.startStep], textHeight);
        }
      });
      const isGroupStartStep = (step) => {
        return diagram.groups.some((g) => g.type !== "box" && g.startStep === step);
      };
      const isGroupEndStep = (step) => {
        return diagram.groups.some((g) => g.type !== "box" && g.endStep === step);
      };
      for (let i = 0; i <= maxStep; i++) {
        let margin = 10;
        if (isGroupStartStep(i + 1)) {
          margin = Math.max(margin, 25);
        }
        if (isGroupEndStep(i)) {
          margin = Math.max(margin, 20);
        }
        const requiredGap = bottomExtension[i] + topExtension[i + 1] + margin;
        stepHeights[i] = Math.max(baseHeights[i], requiredGap);
      }
      const stepY = new Array(maxStep + 1).fill(0);
      const headerGap = Math.max(30, topExtension[0] + 10);
      let currentY = participantYStart + this.theme.participantHeight + headerGap;
      for (let i = 0; i <= maxStep; i++) {
        stepY[i] = currentY;
        currentY += stepHeights[i];
      }
      return { stepY, totalHeight: stepY[maxStep] };
    }
    calculateParticipantWidth(p) {
      const label = (p.label || p.name).replace(/\\n/g, "\n");
      const lines = label.split("\n");
      const maxLineLength = Math.max(...lines.map((l) => l.length));
      return Math.max(this.theme.participantWidth, maxLineLength * 9 + 30);
    }
    // Simplified gap calculation for brevity in this first pass
    calculateGaps(diagram, participants, pWidths) {
      const numGaps = Math.max(0, participants.length - 1);
      const gaps = new Array(numGaps).fill(60);
      const maxStep = this.calculateMaxStep(diagram);
      for (let s = 0; s <= maxStep; s++) {
        const gapRequirements = new Array(numGaps).fill(0);
        for (let i = 0; i < participants.length; i++) {
          const name = participants[i].name;
          const participant = participants[i];
          if (participant.createdStep === s) {
            const boxWidth = pWidths[i];
            if (i < numGaps) {
              gapRequirements[i] = Math.max(gapRequirements[i], boxWidth / 2 + 20);
            }
          }
          let rightSpace = 15;
          const selfMsg = diagram.messages.find((m) => m.step === s && m.from === name && m.to === name);
          if (selfMsg) {
            const textWidth = Math.max(...selfMsg.text.split("\n").map((l) => l.length * 8)) + 20;
            rightSpace = 40 + textWidth + 10;
          }
          const activeAlt = diagram.activations.filter((a) => a.participantName === name && a.startStep <= s && (a.endStep ?? Infinity) >= s);
          if (activeAlt.length > 0) {
            const maxL = Math.max(...activeAlt.map((a) => a.level));
            rightSpace = Math.max(rightSpace, this.theme.activationWidth / 2 + maxL * 5 + 10);
          }
          const notesR = diagram.notes.filter((n) => n.step === s && n.position === "right" && n.participants?.includes(name));
          notesR.forEach((n) => {
            const w = Math.max(60, Math.max(...n.text.split("\n").map((l) => l.length * 8.5)) + 20);
            rightSpace += w + 10;
          });
          if (i < numGaps) gapRequirements[i] += rightSpace;
          let leftSpace = 15;
          const notesL = diagram.notes.filter((n) => n.step === s && n.position === "left" && n.participants?.includes(name));
          notesL.forEach((n) => {
            const w = Math.max(60, Math.max(...n.text.split("\n").map((l) => l.length * 8.5)) + 20);
            leftSpace += w + 10;
          });
          if (i > 0) gapRequirements[i - 1] += leftSpace;
        }
        for (let g = 0; g < numGaps; g++) {
          gaps[g] = Math.max(gaps[g], gapRequirements[g]);
        }
      }
      diagram.messages.forEach((m) => {
        const fIdx = participants.findIndex((p) => p.name === m.from);
        const tIdx = participants.findIndex((p) => p.name === m.to);
        if (fIdx === -1 || tIdx === -1 || fIdx === tIdx) return;
        const textWidth = Math.max(...m.text.split("\n").map((l) => l.length * 8)) + 20;
        const s = Math.min(fIdx, tIdx);
        const e = Math.max(fIdx, tIdx);
        let currentSpace = 0;
        for (let k = s; k < e; k++) {
          currentSpace += pWidths[k] / 2 + gaps[k] + pWidths[k + 1] / 2;
        }
        if (currentSpace < textWidth) {
          const deficit = textWidth - currentSpace;
          const increment = deficit / (e - s);
          for (let k = s; k < e; k++) gaps[k] += increment;
        }
      });
      diagram.notes.forEach((n) => {
        if (n.position !== "over" && n.position !== "across") return;
        const lines = n.text.split("\n");
        const noteWidth = Math.max(60, Math.max(...lines.map((l) => l.length * 8.5)) + 20);
        if (n.participants && n.participants.length > 0) {
          const sIdx = participants.findIndex((p) => p.name === n.participants[0]);
          const eIdx = n.participants.length > 1 ? participants.findIndex((p) => p.name === n.participants[1]) : sIdx;
          if (sIdx === -1 || eIdx === -1) return;
          const s = Math.min(sIdx, eIdx);
          const e = Math.max(sIdx, eIdx);
          if (s === e) {
            const required = noteWidth / 2 + 10;
            if (s < numGaps) {
              if (gaps[s] < required) gaps[s] = required;
            }
          } else {
            let currentSpace = 0;
            for (let k = s; k < e; k++) {
              currentSpace += pWidths[k] / 2 + gaps[k] + pWidths[k + 1] / 2;
            }
            if (currentSpace < noteWidth) {
              const deficit = noteWidth - currentSpace;
              const increment = deficit / (e - s);
              for (let k = s; k < e; k++) gaps[k] += increment;
            }
          }
        }
      });
      return gaps;
    }
    calculateRelativepCenterXs(participants, pWidths, gaps) {
      const relpCenterX = new Array(participants.length).fill(0);
      participants.forEach((p, i) => {
        if (i === 0) {
          relpCenterX[i] = pWidths[i] / 2;
        } else {
          relpCenterX[i] = relpCenterX[i - 1] + pWidths[i - 1] / 2 + gaps[i - 1] + pWidths[i] / 2;
        }
      });
      return relpCenterX;
    }
    preCalculateNoteLayouts(diagram, participants, relpCenterX, pWidths, stepY) {
      const noteLayouts = /* @__PURE__ */ new Map();
      const stepOccupancy = /* @__PURE__ */ new Map();
      diagram.notes.forEach((note) => {
        const lines = note.text.split("\n");
        const calculatedWidth = Math.max(...lines.map((l) => l.length * 8.5)) + 20;
        const minWidth = 60;
        const noteWidth = Math.max(calculatedWidth, minWidth);
        const noteHeight = lines.length * 20 + 10;
        const y = stepY[note.step] - noteHeight / 2;
        let x = 0;
        if (note.position === "across") {
          x = 0;
          noteLayouts.set(note, { x, y, width: noteWidth, height: noteHeight });
        } else if (note.position === "over") {
          const pIdxs = note.participants.map((name) => participants.findIndex((p) => p.name === name)).filter((i) => i !== -1);
          if (pIdxs.length > 0) {
            const minIdx = Math.min(...pIdxs);
            const maxIdx = Math.max(...pIdxs);
            const baseWidth = relpCenterX[maxIdx] + pWidths[maxIdx] / 2 - (relpCenterX[minIdx] - pWidths[minIdx] / 2);
            const finalWidth = Math.max(baseWidth, noteWidth);
            x = relpCenterX[minIdx] - pWidths[minIdx] / 2 - (finalWidth - baseWidth) / 2;
            noteLayouts.set(note, { x, y, width: finalWidth, height: noteHeight });
          }
        } else {
          const pIdxs = (note.participants || []).map((name) => participants.findIndex((p) => p.name === name)).filter((i) => i !== -1);
          if (pIdxs.length > 0) {
            const pIdx = note.position === "left" ? Math.min(...pIdxs) : Math.max(...pIdxs);
            const cx = relpCenterX[pIdx];
            const key = `${note.step}-${pIdx}-${note.position}`;
            const participant = participants[pIdx];
            const halfWidth = pWidths[pIdx] / 2;
            const isCreatedStep = note.step === participant.createdStep;
            const effectiveBoxOffset = isCreatedStep ? halfWidth : 0;
            if (note.position === "left") {
              const currentRightEdge = stepOccupancy.get(key) ?? cx - effectiveBoxOffset - 5;
              x = currentRightEdge - noteWidth;
              stepOccupancy.set(key, x - 10);
            } else {
              const selfMessage = diagram.messages.find(
                (m) => m.step === note.step && m.from === participant.name && m.to === participant.name
              );
              let selfMsgRightOffset = 0;
              if (selfMessage) {
                const textLines = selfMessage.text.split("\n");
                const textWidth = Math.max(...textLines.map((l) => l.length * 8)) + 20;
                selfMsgRightOffset = 40 + textWidth;
              }
              const activeAlt = diagram.activations.filter(
                (a) => a.participantName === participant.name && a.startStep <= note.step && (a.endStep ?? Infinity) >= note.step
              );
              const maxLevel = activeAlt.length > 0 ? Math.max(...activeAlt.map((a) => a.level)) : 0;
              const activationOffset = this.theme.activationWidth / 2 + maxLevel * 5;
              const baseRight = Math.max(effectiveBoxOffset, activationOffset, selfMsgRightOffset);
              const currentLeftEdge = stepOccupancy.get(key) ?? cx + baseRight + 5;
              x = currentLeftEdge;
              stepOccupancy.set(key, x + noteWidth + 10);
            }
            noteLayouts.set(note, { x, y, width: noteWidth, height: noteHeight });
          }
        }
      });
      return noteLayouts;
    }
    calculateBounds(participants, relpCenterX, pWidths, noteLayouts, messages, groups) {
      let minX = 0;
      let maxX = 0;
      participants.forEach((p, i) => {
        const left = relpCenterX[i] - pWidths[i] / 2;
        const right = relpCenterX[i] + pWidths[i] / 2;
        if (i === 0) {
          minX = left;
          maxX = right;
        } else {
          if (left < minX) minX = left;
          if (right > maxX) maxX = right;
        }
      });
      noteLayouts.forEach((l) => {
        if (l.x < minX) minX = l.x;
        if (l.x + l.width > maxX) maxX = l.x + l.width;
      });
      const maxGroupLevel = groups.length > 0 ? Math.max(...groups.map((g) => g.level)) : 0;
      groups.forEach((g) => {
        const pIdxs = g.participants.map((name) => participants.findIndex((p) => p.name === name)).filter((i) => i !== -1);
        if (pIdxs.length === 0) return;
        const minIdx = Math.min(...pIdxs);
        const maxIdx = Math.max(...pIdxs);
        const levelOffset = maxGroupLevel - g.level;
        const hPadding = 10 + levelOffset * 10;
        const groupLeft = relpCenterX[minIdx] - pWidths[minIdx] / 2 - hPadding;
        const groupRight = relpCenterX[maxIdx] + pWidths[maxIdx] / 2 + hPadding;
        if (groupLeft < minX) minX = groupLeft;
        if (groupRight > maxX) maxX = groupRight;
      });
      messages.forEach((m) => {
        const fromIdx = participants.findIndex((p) => p.name === m.from);
        const toIdx = participants.findIndex((p) => p.name === m.to);
        const textLines = m.text.split("\n");
        const textWidth = Math.max(...textLines.map((l) => l.length * 8)) + 20;
        if (fromIdx !== -1 && fromIdx === toIdx) {
          const cx = relpCenterX[fromIdx];
          const rightBound = cx + 40 + textWidth + 10;
          if (rightBound > maxX) maxX = rightBound;
        } else {
          let x1 = 0;
          let x2 = 0;
          const leftmostParticipant = participants[0];
          const rightmostParticipant = participants[participants.length - 1];
          if (fromIdx !== -1) {
            x1 = relpCenterX[fromIdx] || 0;
          } else if (m.from === "[") {
            x1 = relpCenterX[0] !== void 0 ? relpCenterX[0] - 80 : 50;
          } else if (m.from === "]") {
            x1 = relpCenterX[relpCenterX.length - 1] !== void 0 ? relpCenterX[relpCenterX.length - 1] + 80 : 150;
          } else if (m.from === "?") {
            const toRelIdx = toIdx !== -1 ? toIdx : 0;
            x1 = relpCenterX[toRelIdx] !== void 0 ? relpCenterX[toRelIdx] - 50 : 50;
          }
          if (toIdx !== -1) {
            x2 = relpCenterX[toIdx] || 0;
          } else if (m.to === "]") {
            x2 = relpCenterX[relpCenterX.length - 1] !== void 0 ? relpCenterX[relpCenterX.length - 1] + 80 : 150;
          } else if (m.to === "[") {
            x2 = relpCenterX[0] !== void 0 ? relpCenterX[0] - 80 : 50;
          } else if (m.to === "?") {
            const fromRelIdx = fromIdx !== -1 ? fromIdx : 0;
            x2 = relpCenterX[fromRelIdx] !== void 0 ? relpCenterX[fromRelIdx] + 50 : 100;
          }
          const cx = (x1 + x2) / 2;
          const left = cx - textWidth / 2;
          const right = cx + textWidth / 2;
          const arrowMin = Math.min(x1, x2);
          const arrowMax = Math.max(x1, x2);
          const finalLeft = Math.min(left, arrowMin);
          const finalRight = Math.max(right, arrowMax);
          if (finalLeft < minX) minX = finalLeft;
          if (finalRight > maxX) maxX = finalRight;
        }
      });
      return { minX, maxX };
    }
    calculateGroupLayouts(diagram, participants, noteLayouts, stepY, maxStep, participantYStart, totalHeight, bottomPadding) {
      const maxGroupLevel = diagram.groups.length > 0 ? Math.max(...diagram.groups.map((g) => g.level)) : 0;
      return diagram.groups.map((g) => {
        const pIdxs = g.participants.map((name) => participants.findIndex((pl) => pl.participant.name === name)).filter((i) => i !== -1);
        if (pIdxs.length === 0) return null;
        const minIdx = Math.min(...pIdxs);
        const maxIdx = Math.max(...pIdxs);
        const levelOffset = maxGroupLevel - g.level;
        const hPadding = 10 + levelOffset * 10;
        const vPaddingTop = 25 + levelOffset * 8;
        const vPaddingBottom = 5 + levelOffset * 8;
        let rectX = participants[minIdx].x - hPadding;
        let rectW = participants[maxIdx].x + participants[maxIdx].width + hPadding - rectX;
        const notesInGroup = noteLayouts.filter((nl) => {
          const n = nl.note;
          if (n.step < g.startStep || n.step > (g.endStep || maxStep)) return false;
          let owner = n.owner;
          if (!owner) return false;
          if (owner === g) return true;
          const ownerEnd = owner.endStep ?? maxStep;
          const groupEnd = g.endStep ?? maxStep;
          return owner.startStep >= g.startStep && ownerEnd <= groupEnd;
        });
        notesInGroup.forEach((nl) => {
          const n = nl.note;
          if (n.position === "right") {
            const nPIdxs = (n.participants || []).map((name) => participants.findIndex((p) => p.participant.name === name)).filter((i) => i !== -1);
            if (nPIdxs.length > 0 && Math.max(...nPIdxs) === maxIdx) {
              const noteRight = nl.x + nl.width;
              const groupRight = rectX + rectW;
              if (noteRight + 10 > groupRight) {
                rectW = noteRight + 10 - rectX;
              }
            }
          } else if (n.position === "left") {
            const nPIdxs = (n.participants || []).map((name) => participants.findIndex((p) => p.participant.name === name)).filter((i) => i !== -1);
            if (nPIdxs.length > 0 && Math.min(...nPIdxs) === minIdx) {
              const noteLeft = nl.x;
              const groupLeft = rectX;
              if (noteLeft - 10 < groupLeft) {
                const diff = groupLeft - (noteLeft - 10);
                rectX -= diff;
                rectW += diff;
              }
            }
          }
        });
        let yStart;
        let height;
        if (g.type === "box") {
          yStart = participantYStart - 15;
          if (g.label) {
            yStart = participantYStart - 35;
          }
          const yEnd = totalHeight - bottomPadding - 10;
          height = yEnd - yStart;
        } else {
          yStart = stepY[g.startStep] - vPaddingTop;
          height = stepY[g.endStep] + vPaddingBottom - yStart;
        }
        const sections = g.sections.map((s) => ({
          label: s.label,
          y: stepY[s.startStep]
        }));
        return {
          group: g,
          x: rectX,
          y: yStart,
          width: rectW,
          height,
          type: g.type,
          label: g.label,
          sections,
          color: g.color
        };
      }).filter((g) => g !== null);
    }
  };

  // src/diagrams/sequence/SequenceRenderer.ts
  var SequenceRenderer = class {
    constructor() {
      this.theme = defaultTheme;
      this.lastSvg = "";
      this.layoutEngine = new LayoutEngine(this.theme);
    }
    render(diagram) {
      this.ensureParticipants(diagram);
      const layout = this.layoutEngine.calculateLayout(diagram);
      return this.generateSvg(diagram, layout);
    }
    ensureParticipants(diagram) {
      diagram.notes.forEach((note) => {
        if (note.participants) {
          note.participants.forEach((p) => diagram.addParticipant(p));
        }
      });
    }
    generateSvg(diagram, layout) {
      let svg = `<svg width="${layout.width}" height="${layout.height}" viewBox="0 0 ${layout.width} ${layout.height}" xmlns="http://www.w3.org/2000/svg" style="background: white; font-family: ${this.theme.fontFamily};">`;
      svg += this.renderDefs(diagram);
      svg += this.renderBoxes(layout);
      svg += this.renderLifelines(diagram, layout);
      svg += this.renderActivations(diagram, layout);
      svg += this.renderGroups(layout);
      svg += this.renderParticipants(diagram, layout);
      svg += this.renderReferences(diagram, layout);
      svg += this.renderNotes(layout);
      svg += this.renderMessages(diagram, layout);
      svg += this.renderDividers(diagram, layout);
      svg += this.renderDelays(diagram, layout);
      svg += this.renderTimeConstraints(layout);
      svg += this.renderDestructionMarks(layout);
      if (diagram.title) {
        svg += `<text x="${layout.width / 2}" y="${25}" text-anchor="middle" font-size="${this.theme.fontSize + 4}" font-weight="bold">${diagram.title}</text>`;
      }
      if (diagram.header) {
        svg += `<text x="${layout.width - this.theme.padding}" y="${15}" text-anchor="end" font-size="${this.theme.fontSize - 4}">${diagram.header}</text>`;
      }
      if (diagram.footer) {
        svg += `<text x="${layout.width / 2}" y="${layout.height - 10}" text-anchor="middle" font-size="${this.theme.fontSize - 4}">${diagram.footer}</text>`;
      }
      svg += "</svg>";
      return svg;
    }
    renderDefs(diagram) {
      const usedColors = /* @__PURE__ */ new Set();
      usedColors.add(this.theme.colors.defaultStroke);
      diagram.messages.forEach((m) => {
        usedColors.add(this.normalizeColor(m.color, this.theme.colors.defaultStroke));
      });
      let defs = "<defs>";
      usedColors.forEach((color) => {
        const safeColor = color.replace("#", "");
        defs += `
      <marker id="arrowhead-${safeColor}" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
        <polygon points="0 0, 10 3.5, 0 7" fill="${color}" />
      </marker>
      <marker id="arrowhead-reverse-${safeColor}" markerWidth="10" markerHeight="7" refX="0" refY="3.5" orient="auto">
        <polygon points="10 0, 0 3.5, 10 7" fill="${color}" />
      </marker>
      <marker id="arrowhead-open-${safeColor}" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
        <path d="M 0 0 L 10 3.5 L 0 7" fill="none" stroke="${color}" stroke-width="1" />
      </marker>
      <marker id="arrowhead-open-reverse-${safeColor}" markerWidth="10" markerHeight="7" refX="0" refY="3.5" orient="auto">
        <path d="M 10 0 L 0 3.5 L 10 7" fill="none" stroke="${color}" stroke-width="1" />
      </marker>
      <marker id="halfhead-${safeColor}" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
        <polygon points="0 0, 10 3.5, 0 3.5" fill="${color}" />
      </marker>
      <marker id="halfhead-reverse-${safeColor}" markerWidth="10" markerHeight="7" refX="0" refY="3.5" orient="auto">
        <polygon points="10 0, 0 3.5, 10 3.5" fill="${color}" />
      </marker>
      <marker id="circlehead-${safeColor}" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
        <circle cx="4" cy="4" r="3" fill="white" stroke="${color}" stroke-width="1.5" />
      </marker>
      <marker id="arrowhead-circle-${safeColor}" markerWidth="18" markerHeight="7.5" refX="14" refY="3.5" orient="auto">
        <polygon points="0 0, 10 3.5, 0 7" fill="${color}" />
        <circle cx="14" cy="3.5" r="3" fill="${color}" stroke="${color}" stroke-width="1" />
      </marker>
      <marker id="arrowhead-circle-reverse-${safeColor}" markerWidth="18" markerHeight="7.5" refX="4" refY="3.5" orient="auto">
        <polygon points="17 0, 7 3.5, 17 7" fill="${color}" />
        <circle cx="4" cy="3.5" r="3" fill="${color}" stroke="${color}" stroke-width="1" />
      </marker>
      <marker id="losthead-${safeColor}" markerWidth="10" markerHeight="10" refX="5" refY="5" orient="auto">
        <line x1="0" y1="0" x2="10" y2="10" stroke="${color}" stroke-width="2" />
        <line x1="10" y1="0" x2="0" y2="10" stroke="${color}" stroke-width="2" />
      </marker>`;
      });
      defs += "</defs>";
      return defs;
    }
    renderLifelines(diagram, layout) {
      let svg = "";
      let bottomPadding = this.theme.padding;
      if (diagram.footer) {
        bottomPadding += 25;
      }
      layout.participants.forEach((pl) => {
        if (pl.participant.name === "[" || pl.participant.name === "]" || pl.participant.name === "?") {
          return;
        }
        const x = pl.centerX;
        const yEnd = pl.destroyedY !== void 0 ? pl.destroyedY : diagram.hideFootbox ? layout.height - bottomPadding : layout.height - bottomPadding - this.theme.participantHeight;
        svg += `<line x1="${x}" y1="${pl.y + pl.height}" x2="${x}" y2="${yEnd}" stroke="${this.theme.colors.line}" stroke-dasharray="4" />`;
      });
      return svg;
    }
    renderDestructionMarks(layout) {
      let svg = "";
      layout.participants.forEach((pl) => {
        if (pl.destroyedY !== void 0) {
          const x = pl.centerX;
          const y = pl.destroyedY;
          const dSize = 12;
          svg += `<line x1="${x - dSize}" y1="${y - dSize}" x2="${x + dSize}" y2="${y + dSize}" stroke="#FF0000" stroke-width="3" />`;
          svg += `<line x1="${x + dSize}" y1="${y - dSize}" x2="${x - dSize}" y2="${y + dSize}" stroke="#FF0000" stroke-width="3" />`;
        }
      });
      return svg;
    }
    renderParticipants(diagram, layout) {
      let svg = "";
      let bottomPadding = this.theme.padding;
      if (diagram.footer) {
        bottomPadding += 25;
      }
      const draw = (pl, top) => {
        const fill = this.normalizeColor(pl.participant.color, this.theme.colors.actorFill);
        const x = pl.x;
        const y = top ? pl.y : layout.height - bottomPadding - this.theme.participantHeight - 20;
        const cx = pl.centerX;
        const cy = y + this.theme.participantHeight / 2;
        const label = (pl.participant.label || pl.participant.name).replace(/\\n/g, "\n");
        const lines = label.split("\n");
        switch (pl.participant.type) {
          case "actor":
            svg += `<circle cx="${cx}" cy="${y + 10}" r="8" fill="${fill}" stroke="${this.theme.colors.defaultStroke}" stroke-width="2" />`;
            svg += `<line x1="${cx}" y1="${y + 18}" x2="${cx}" y2="${y + 30}" stroke="${this.theme.colors.defaultStroke}" stroke-width="2" />`;
            svg += `<line x1="${cx - 10}" y1="${y + 22}" x2="${cx + 10}" y2="${y + 22}" stroke="${this.theme.colors.defaultStroke}" stroke-width="2" />`;
            svg += `<line x1="${cx}" y1="${y + 30}" x2="${cx - 8}" y2="${y + 40}" stroke="${this.theme.colors.defaultStroke}" stroke-width="2" />`;
            svg += `<line x1="${cx}" y1="${y + 30}" x2="${cx + 8}" y2="${y + 40}" stroke="${this.theme.colors.defaultStroke}" stroke-width="2" />`;
            lines.forEach((line, j) => {
              svg += `<text x="${cx}" y="${y + 55 + j * 15}" text-anchor="middle" font-size="${this.theme.fontSize}" font-weight="bold">${line}</text>`;
            });
            break;
          case "boundary":
            svg += `<line x1="${cx - 20}" y1="${cy}" x2="${cx - 10}" y2="${cy}" stroke="${this.theme.colors.defaultStroke}" stroke-width="2" />`;
            svg += `<line x1="${cx - 20}" y1="${cy - 10}" x2="${cx - 20}" y2="${cy + 10}" stroke="${this.theme.colors.defaultStroke}" stroke-width="2" />`;
            svg += `<circle cx="${cx}" cy="${cy}" r="14" fill="${fill}" stroke="${this.theme.colors.defaultStroke}" stroke-width="2" />`;
            lines.forEach((line, j) => {
              svg += `<text x="${cx}" y="${y + this.theme.participantHeight + 20 + j * 15}" text-anchor="middle" font-size="${this.theme.fontSize}" font-weight="bold">${line}</text>`;
            });
            break;
          case "control":
            svg += `<circle cx="${cx}" cy="${cy}" r="14" fill="${fill}" stroke="${this.theme.colors.defaultStroke}" stroke-width="2" />`;
            svg += `<path d="M ${cx + 4} ${cy - 18} L ${cx - 4} ${cy - 14} L ${cx + 4} ${cy - 10}" fill="none" stroke="${this.theme.colors.defaultStroke}" stroke-width="2" />`;
            lines.forEach((line, j) => {
              svg += `<text x="${cx}" y="${y + this.theme.participantHeight + 20 + j * 15}" text-anchor="middle" font-size="${this.theme.fontSize}" font-weight="bold">${line}</text>`;
            });
            break;
          case "entity":
            svg += `<circle cx="${cx}" cy="${cy}" r="14" fill="${fill}" stroke="${this.theme.colors.defaultStroke}" stroke-width="2" />`;
            svg += `<line x1="${cx - 14}" y1="${cy + 14}" x2="${cx + 14}" y2="${cy + 14}" stroke="${this.theme.colors.defaultStroke}" stroke-width="2" />`;
            lines.forEach((line, j) => {
              svg += `<text x="${cx}" y="${y + this.theme.participantHeight + 20 + j * 15}" text-anchor="middle" font-size="${this.theme.fontSize}" font-weight="bold">${line}</text>`;
            });
            break;
          case "database":
            const dbW = 34;
            const dbH = 40;
            const dbY = y;
            const dbX = cx - dbW / 2;
            svg += `<path d="M ${dbX} ${dbY + 10} L ${dbX} ${dbY + dbH - 10} A 17 8 0 0 0 ${dbX + dbW} ${dbY + dbH - 10} L ${dbX + dbW} ${dbY + 10} A 17 8 0 0 0 ${dbX} ${dbY + 10} M ${dbX} ${dbY + 10} A 17 8 0 0 1 ${dbX + dbW} ${dbY + 10}" fill="${fill}" stroke="${this.theme.colors.defaultStroke}" stroke-width="2" />`;
            svg += `<path d="M ${dbX} ${dbY + 10} A 17 8 0 0 0 ${dbX + dbW} ${dbY + 10}" fill="none" stroke="${this.theme.colors.defaultStroke}" stroke-width="2" />`;
            lines.forEach((line, j) => {
              svg += `<text x="${cx}" y="${y + this.theme.participantHeight + 20 + j * 15}" text-anchor="middle" font-size="${this.theme.fontSize}" font-weight="bold">${line}</text>`;
            });
            break;
          case "collections":
            const colW = 34;
            const colH = 34;
            const colY = y + 3;
            const colX = cx - colW / 2;
            svg += `<rect x="${colX + 4}" y="${colY - 4}" width="${colW}" height="${colH}" fill="${fill}" stroke="${this.theme.colors.defaultStroke}" stroke-width="2" />`;
            svg += `<rect x="${colX}" y="${colY}" width="${colW}" height="${colH}" fill="${fill}" stroke="${this.theme.colors.defaultStroke}" stroke-width="2" />`;
            lines.forEach((line, j) => {
              svg += `<text x="${cx}" y="${y + this.theme.participantHeight + 20 + j * 15}" text-anchor="middle" font-size="${this.theme.fontSize}" font-weight="bold">${line}</text>`;
            });
            break;
          case "queue":
            const qW = 40;
            const qH = 40;
            const qY = y + 3;
            const qX = cx - qW / 2;
            const qRx = 5;
            const qRy = qH / 2;
            svg += `<path d="M ${qX + qW} ${qY} L ${qX} ${qY} A ${qRx} ${qRy} 0 0 0 ${qX} ${qY + qH} L ${qX + qW} ${qY + qH} A ${qRx} ${qRy} 0 0 0 ${qX + qW} ${qY}" fill="${fill}" stroke="none" />`;
            svg += `<ellipse cx="${qX + qW}" cy="${qY + qRy}" rx="${qRx}" ry="${qRy}" fill="${fill}" stroke="none" />`;
            svg += `<path d="M ${qX + qW} ${qY} L ${qX} ${qY} A ${qRx} ${qRy} 0 0 0 ${qX} ${qY + qH} L ${qX + qW} ${qY + qH}" fill="none" stroke="${this.theme.colors.defaultStroke}" stroke-width="2" />`;
            svg += `<ellipse cx="${qX + qW}" cy="${qY + qRy}" rx="${qRx}" ry="${qRy}" fill="none" stroke="${this.theme.colors.defaultStroke}" stroke-width="2" />`;
            lines.forEach((line, j) => {
              svg += `<text x="${cx}" y="${y + this.theme.participantHeight + 20 + j * 15}" text-anchor="middle" font-size="${this.theme.fontSize}" font-weight="bold">${line}</text>`;
            });
            break;
          default:
            svg += `<rect x="${x}" y="${y}" width="${pl.width}" height="${this.theme.participantHeight}" rx="5" fill="${fill}" stroke="${this.theme.colors.defaultStroke}" stroke-width="2" />`;
            lines.forEach((line, j) => {
              const lineY = lines.length > 1 ? cy - (lines.length - 1) * 7.5 + j * 15 : cy;
              svg += `<text x="${cx}" y="${lineY}" text-anchor="middle" dominant-baseline="middle" font-size="${this.theme.fontSize}" font-weight="bold">${line}</text>`;
            });
        }
      };
      layout.participants.forEach((pl) => {
        if (pl.participant.name === "[" || pl.participant.name === "]" || pl.participant.name === "?") {
          return;
        }
        draw(pl, true);
        if (!diagram.hideFootbox) {
          draw(pl, false);
        }
      });
      return svg;
    }
    renderGroups(layout) {
      let svg = "";
      layout.groups.forEach((g) => {
        if (g.type === "box") return;
        svg += `<rect x="${g.x}" y="${g.y}" width="${g.width}" height="${g.height}" fill="none" stroke="#222" stroke-width="2" rx="5" />`;
        svg += `<path d="M ${g.x} ${g.y} L ${g.x + 70} ${g.y} L ${g.x + 70} ${g.y + 10} L ${g.x + 60} ${g.y + 20} L ${g.x} ${g.y + 20} Z" fill="#eee" stroke="#222" stroke-width="2" />`;
        svg += `<text x="${g.x + 5}" y="${g.y + 15}" font-size="${this.theme.fontSize - 2}" font-weight="bold">${g.type}</text>`;
        if (g.label) svg += `<text x="${g.x + 75}" y="${g.y + 15}" font-size="${this.theme.fontSize - 2}" font-weight="bold">[${g.label}]</text>`;
        g.sections.forEach((section) => {
          const sectionY = section.y;
          svg += `<line x1="${g.x}" y1="${sectionY}" x2="${g.x + g.width}" y2="${sectionY}" stroke="#222" stroke-width="1" stroke-dasharray="5,5" />`;
          svg += `<text x="${g.x + 5}" y="${sectionY + 15}" font-size="${this.theme.fontSize - 2}" font-weight="bold">[${section.label}]</text>`;
        });
      });
      return svg;
    }
    renderBoxes(layout) {
      let svg = "";
      layout.groups.forEach((g) => {
        if (g.type !== "box") return;
        const fill = this.normalizeColor(g.color, "#F4F4F6");
        const strokeColor = "#D1D1D6";
        svg += `<rect x="${g.x}" y="${g.y}" width="${g.width}" height="${g.height}" fill="${fill}" stroke="${strokeColor}" stroke-width="1.5" rx="8" />`;
        if (g.label) {
          const labelX = g.x + g.width / 2;
          const labelY = g.y + 20;
          svg += `<text x="${labelX}" y="${labelY}" text-anchor="middle" font-size="${this.theme.fontSize}" font-weight="bold" fill="${this.theme.colors.text}">${g.label}</text>`;
        }
      });
      return svg;
    }
    renderNotes(layout) {
      let svg = "";
      layout.notes.forEach((nl) => {
        this.drawNoteShape(svg, nl.x, nl.y, nl.width, nl.height, nl.note.shape, nl.note.color, nl.note.text);
        svg = this.lastSvg;
      });
      return svg;
    }
    // ... Stubbing other methods to complete structure ...
    renderActivations(d, l) {
      let svg = "";
      const sortedActivations = [...l.activations].sort((a, b) => a.activation.level - b.activation.level);
      sortedActivations.forEach((a) => {
        const fill = a.activation.color || this.theme.colors.actorFill;
        svg += `<rect x="${a.x}" y="${a.y}" width="${a.width}" height="${a.height}" fill="${fill}" stroke="${this.theme.colors.defaultStroke}" stroke-width="1" />`;
      });
      return svg;
    }
    renderReferences(d, l) {
      let svg = "";
      l.references.forEach((r) => {
        svg += `<rect x="${r.x}" y="${r.y}" width="${r.width}" height="${r.height}" fill="${this.theme.colors.defaultFill}" stroke="${this.theme.colors.defaultStroke}" stroke-width="2" />`;
        svg += `<path d="M ${r.x} ${r.y} L ${r.x + 70} ${r.y} L ${r.x + 70} ${r.y + 10} L ${r.x + 60} ${r.y + 20} L ${r.x} ${r.y + 20} Z" fill="#eee" stroke="#222" stroke-width="2" />`;
        svg += `<text x="${r.x + 5}" y="${r.y + 12}" font-size="${this.theme.fontSize - 2}" font-weight="bold">ref</text>`;
        const lines = r.reference.label.split("\n");
        const lineHeight = this.theme.fontSize + 2;
        const totalTextHeight = lines.length * lineHeight;
        const headerHeight = 25;
        let startY = r.y + r.height / 2 - totalTextHeight / 2 + lineHeight / 2;
        if (startY < r.y + headerHeight + lineHeight / 2) {
          startY = r.y + headerHeight + lineHeight / 2;
        }
        lines.forEach((line, i) => {
          svg += `<text x="${r.x + r.width / 2}" y="${startY + i * lineHeight}" text-anchor="middle" dominant-baseline="middle" font-size="${this.theme.fontSize}">${line}</text>`;
        });
      });
      return svg;
    }
    renderMessages(d, l) {
      let svg = "";
      l.messages.forEach((ml) => {
        const m = ml.message;
        const strokeColor = this.normalizeColor(m.color, this.theme.colors.defaultStroke);
        const strokeDash = ml.lineStyle === "dashed" ? "4" : "0";
        const safeColor = strokeColor.replace("#", "");
        const getMarker = (type, isStart) => {
          if (type === "none") return "none";
          let id = "";
          if (type === "default") id = isStart ? `arrowhead-reverse-${safeColor}` : `arrowhead-${safeColor}`;
          else if (type === "open") id = isStart ? `arrowhead-open-reverse-${safeColor}` : `arrowhead-open-${safeColor}`;
          else if (type === "half") id = isStart ? `halfhead-reverse-${safeColor}` : `halfhead-${safeColor}`;
          else if (type === "circle") id = `circlehead-${safeColor}`;
          else if (type === "arrow-circle") id = isStart ? `arrowhead-circle-reverse-${safeColor}` : `arrowhead-circle-${safeColor}`;
          else if (type === "lost") id = `losthead-${safeColor}`;
          else if (type === "found") id = `circlehead-${safeColor}`;
          return id ? `url(#${id})` : "none";
        };
        const markerEnd = getMarker(m.arrowHead || "default", false);
        const markerStart = getMarker(m.startHead || (m.bidirectional ? "default" : "none"), true);
        if (ml.points.length > 2) {
          const dPath = `M ${ml.points.map((p) => `${p.x} ${p.y}`).join(" L ")}`;
          svg += `<path d="${dPath}" fill="none" stroke="${strokeColor}" stroke-width="1.5" stroke-dasharray="${strokeDash}" marker-end="${markerEnd}" marker-start="${markerStart}" />`;
        } else {
          const [p1, p2] = ml.points;
          svg += `<line x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}" stroke="${strokeColor}" stroke-width="1.5" stroke-dasharray="${strokeDash}" marker-end="${markerEnd}" marker-start="${markerStart}" />`;
        }
        const numberPrefix = m.number ? this.formatRichText(m.number) : "";
        const messageText = m.text || "";
        const lines = messageText.split("\n");
        const anchor = ml.points.length > 2 ? "start" : "middle";
        lines.forEach((line, i) => {
          const lineY = ml.labelPosition.y - (lines.length - 1 - i) * 15 - 5;
          let y = lineY;
          if (ml.points.length > 2) {
            y = ml.labelPosition.y + i * 20;
          }
          const formattedLine = this.formatRichText(line);
          const displayContent = i === 0 && numberPrefix ? `${numberPrefix} ${formattedLine}` : formattedLine;
          if (displayContent.trim() !== "") {
            svg += `<text x="${ml.labelPosition.x}" y="${y}" text-anchor="${anchor}" font-size="${this.theme.fontSize - 2}" fill="${strokeColor}">${displayContent}</text>`;
          }
        });
      });
      return svg;
    }
    renderDividers(d, l) {
      let svg = "";
      l.dividers.forEach((div) => {
        const y = div.y;
        svg += `<line x1="${this.theme.padding}" y1="${y}" x2="${l.width - this.theme.padding}" y2="${y}" stroke="${this.theme.colors.defaultStroke}" stroke-width="1" />`;
        svg += `<line x1="${this.theme.padding}" y1="${y + 4}" x2="${l.width - this.theme.padding}" y2="${y + 4}" stroke="${this.theme.colors.defaultStroke}" stroke-width="1" />`;
        if (div.label) {
          const labelW = div.label.length * 9 + 20;
          svg += `<rect x="${l.width / 2 - labelW / 2}" y="${y - 10}" width="${labelW}" height="20" fill="white" stroke="${this.theme.colors.defaultStroke}" stroke-width="1" />`;
          svg += `<text x="${l.width / 2}" y="${y}" text-anchor="middle" dominant-baseline="middle" font-size="${this.theme.fontSize - 2}" font-weight="bold">${div.label}</text>`;
        }
      });
      return svg;
    }
    renderDelays(d, l) {
      let svg = "";
      const delayStyle = d.delayStyle || this.theme.delayStyle || "dots";
      const nonExternal = l.participants.filter((p) => p.participant.name !== "[" && p.participant.name !== "]" && p.participant.name !== "?");
      if (nonExternal.length === 0) return "";
      const centerXs = nonExternal.map((p) => p.centerX);
      const minX = Math.min(...centerXs);
      const maxX = Math.max(...centerXs);
      const midX = (minX + maxX) / 2;
      l.delays.forEach((delay) => {
        const y = delay.y;
        const dotGap = 10;
        if (delay.text) {
          const textW = delay.text.length * 8 + 20;
          svg += `<text x="${midX}" y="${y}" text-anchor="middle" dominant-baseline="middle" font-size="${this.theme.fontSize}" fill="${this.theme.colors.text}">${delay.text}</text>`;
          if (delayStyle === "dots") {
            const leftEnd = midX - textW / 2 - 10;
            for (let dx = minX; dx <= leftEnd; dx += dotGap) {
              svg += `<circle cx="${dx}" cy="${y}" r="1.5" fill="${this.theme.colors.text}" />`;
            }
            const rightStart = midX + textW / 2 + 10;
            for (let dx = rightStart; dx <= maxX; dx += dotGap) {
              svg += `<circle cx="${dx}" cy="${y}" r="1.5" fill="${this.theme.colors.text}" />`;
            }
          } else if (delayStyle === "lifeline") {
            nonExternal.forEach((pl) => {
              svg += `<rect x="${pl.centerX - 2}" y="${y - 15}" width="4" height="30" fill="white" />`;
              svg += `<circle cx="${pl.centerX}" cy="${y - 10}" r="1.5" fill="${this.theme.colors.text}" />`;
              svg += `<circle cx="${pl.centerX}" cy="${y}" r="1.5" fill="${this.theme.colors.text}" />`;
              svg += `<circle cx="${pl.centerX}" cy="${y + 10}" r="1.5" fill="${this.theme.colors.text}" />`;
            });
          }
        } else {
          if (delayStyle === "dots") {
            for (let dx = minX; dx <= maxX; dx += dotGap) {
              svg += `<circle cx="${dx}" cy="${y}" r="1.5" fill="${this.theme.colors.text}" />`;
            }
          } else if (delayStyle === "lifeline") {
            nonExternal.forEach((pl) => {
              svg += `<rect x="${pl.centerX - 2}" y="${y - 15}" width="4" height="30" fill="white" />`;
              svg += `<circle cx="${pl.centerX}" cy="${y - 10}" r="1.5" fill="${this.theme.colors.text}" />`;
              svg += `<circle cx="${pl.centerX}" cy="${y}" r="1.5" fill="${this.theme.colors.text}" />`;
              svg += `<circle cx="${pl.centerX}" cy="${y + 10}" r="1.5" fill="${this.theme.colors.text}" />`;
            });
          }
        }
      });
      return svg;
    }
    renderTimeConstraints(l) {
      let svg = "";
      l.timeConstraints.forEach((tc) => {
        const x = tc.x;
        const y1 = tc.startY;
        const y2 = tc.endY;
        const color = this.theme.colors.defaultStroke;
        svg += `<line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}" stroke="${color}" stroke-width="1.5" />`;
        svg += `<polygon points="${x} ${y1}, ${x - 4} ${y1 + 8}, ${x + 4} ${y1 + 8}" fill="${color}" />`;
        svg += `<polygon points="${x} ${y2}, ${x - 4} ${y2 - 8}, ${x + 4} ${y2 - 8}" fill="${color}" />`;
        if (tc.label) {
          const midY = (y1 + y2) / 2;
          svg += `<text x="${x + 10}" y="${midY}" text-anchor="start" dominant-baseline="middle" font-size="${this.theme.fontSize - 2}" fill="${color}">${tc.label}</text>`;
        }
      });
      return svg;
    }
    // Helpers
    normalizeColor(color, defaultColor) {
      if (!color) return defaultColor;
      if (color.startsWith("#")) {
        if (/^#[0-9a-fA-F]{3,8}$/.test(color)) {
          return color;
        }
        return color.substring(1);
      }
      return color;
    }
    formatRichText(text) {
      return formatRichText(text);
    }
    drawNoteShape(svg, x, y, w, h, shape, color, text) {
      let noteSvg = "";
      const fill = this.normalizeColor(color, this.theme.colors.noteFill);
      const borderColor = this.theme.colors.defaultStroke;
      const effectiveShape = shape || "folder";
      if (effectiveShape === "hexagon") {
        const pointDepth = 10;
        const points = [
          `${x + pointDepth},${y}`,
          `${x + w - pointDepth},${y}`,
          `${x + w},${y + h / 2}`,
          `${x + w - pointDepth},${y + h}`,
          `${x + pointDepth},${y + h}`,
          `${x},${y + h / 2}`
        ].join(" ");
        noteSvg += `<polygon points="${points}" fill="${fill}" stroke="${borderColor}" stroke-width="1.5" />`;
      } else if (effectiveShape === "bubble") {
        const r = h / 2;
        noteSvg += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" ry="${r}" fill="${fill}" stroke="${borderColor}" stroke-width="1.5" />`;
      } else if (effectiveShape === "rectangle") {
        noteSvg += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" stroke="${borderColor}" stroke-width="1.5" />`;
      } else {
        const foldSize = 10;
        const notePath = `
                M ${x} ${y}
                L ${x + w - foldSize} ${y}
                L ${x + w} ${y + foldSize}
                L ${x + w} ${y + h}
                L ${x} ${y + h}
                Z
            `;
        noteSvg += `<path d="${notePath}" fill="${fill}" stroke="${borderColor}" stroke-width="1.5" />`;
        const foldPath = `
                M ${x + w - foldSize} ${y}
                L ${x + w - foldSize} ${y + foldSize}
                L ${x + w} ${y + foldSize}
            `;
        noteSvg += `<path d="${foldPath}" fill="none" stroke="${borderColor}" stroke-width="1.5" />`;
      }
      const lines = text.split("\n");
      lines.forEach((line, i) => {
        noteSvg += `<text x="${x + w / 2}" y="${y + 20 + i * 20}" text-anchor="middle" font-size="${this.theme.fontSize}" fill="${this.theme.colors.text}">${this.formatRichText(line)}</text>`;
      });
      this.lastSvg = svg + noteSvg;
    }
  };

  // src/diagrams/component/parser/ComponentASTParser.ts
  var ComponentASTParser = class {
    constructor(tokens, source) {
      this.current = 0;
      this.tokens = tokens;
      this.source = source;
      this.sourceLines = source.split("\n");
    }
    sliceSource(startLine, startCol, endLine, endCol) {
      const startLineIdx = startLine - 1;
      const startColIdx = startCol - 1;
      const endLineIdx = endLine - 1;
      const endColIdx = endCol - 1;
      if (startLineIdx === endLineIdx) {
        return this.sourceLines[startLineIdx].substring(startColIdx, endColIdx);
      }
      const parts = [];
      parts.push(this.sourceLines[startLineIdx].substring(startColIdx));
      for (let i = startLineIdx + 1; i < endLineIdx; i++) {
        parts.push(this.sourceLines[i]);
      }
      parts.push(this.sourceLines[endLineIdx].substring(0, endColIdx));
      return parts.join("\n");
    }
    parse() {
      const body = [];
      while (!this.isAtEnd()) {
        this.skipNewlines();
        if (this.isAtEnd()) break;
        const statement = this.parseStatement();
        if (statement) {
          body.push(statement);
        }
        this.consumeNewlineOrEOF();
      }
      return {
        type: "ComponentDiagram",
        body,
        line: 1,
        column: 1
      };
    }
    parseStatement() {
      const token = this.peek();
      if (token.type === "RBRACE" /* RBRACE */) {
        return null;
      }
      if (token.type === "PACKAGE" /* PACKAGE */ || token.type === "NODE" /* NODE */ || token.type === "FOLDER" /* FOLDER */ || token.type === "FRAME" /* FRAME */ || token.type === "CLOUD" /* CLOUD */ || token.type === "DATABASE" /* DATABASE */ || (token.type === "COMPONENT" /* COMPONENT */ || token.type === "INTERFACE" /* INTERFACE */) && this.checkLbraceAhead()) {
        return this.parseGroup();
      }
      if (token.type === "PORT" /* PORT */ || token.type === "PORTIN" /* PORTIN */ || token.type === "PORTOUT" /* PORTOUT */) {
        return this.parsePort();
      }
      if (token.type === "NOTE" /* NOTE */) {
        return this.parseNote();
      }
      const lhs = this.parseRefElement();
      if (!lhs) {
        this.advance();
        return null;
      }
      const next = this.peek();
      if (lhs.isBracketed && (next.type === "LEFT" /* LEFT */ || next.type === "RIGHT" /* RIGHT */ || next.type === "TOP" /* TOP */ || next.type === "BOTTOM" /* BOTTOM */)) {
        const posToken = this.advance();
        const position = posToken.value.toLowerCase();
        this.consume("OF" /* OF */, "Expected 'of' after direction hint");
        const rhs = this.parseRefElement();
        if (!rhs) {
          throw this.error(posToken, "Expected reference component after 'of'");
        }
        let color2;
        if (this.match("COLOR" /* COLOR */)) {
          color2 = this.previous().value;
        }
        return {
          type: "PositionHint",
          name: lhs.name,
          position,
          reference: rhs.name,
          color: color2,
          line: token.line,
          column: token.column
        };
      }
      if (next.type === "ARROW" /* ARROW */ || next.type === "SHORTHAND" /* SHORTHAND */ && next.value === "--") {
        const arrowToken = this.advance();
        const rhs = this.parseRefElement();
        if (!rhs) {
          throw this.error(arrowToken, "Expected right-hand side component in relationship");
        }
        let label;
        if (this.match("COLON" /* COLON */)) {
          label = this.parseLabelRestOfLine();
        }
        return {
          type: "Relationship",
          from: { name: lhs.name, isBracketed: lhs.isBracketed, isParens: lhs.isParens },
          to: { name: rhs.name, isBracketed: rhs.isBracketed, isParens: rhs.isParens },
          arrow: arrowToken.value,
          label,
          line: token.line,
          column: token.column
        };
      }
      if (lhs.keywordType === "component" || lhs.keywordType === "interface") {
        let color2;
        if (this.match("COLOR" /* COLOR */)) {
          color2 = this.previous().value;
        }
        let description2;
        if (this.match("LBRACKET" /* LBRACKET */)) {
          description2 = this.parseMultilineDescription();
        }
        return {
          type: "ComponentDeclaration",
          declType: lhs.keywordType,
          name: lhs.name,
          label: lhs.rawName,
          alias: lhs.alias,
          color: color2,
          description: description2,
          line: token.line,
          column: token.column
        };
      }
      let alias;
      if (this.match("AS" /* AS */)) {
        alias = this.consume("IDENTIFIER" /* IDENTIFIER */, "Expected alias after 'as'").value;
      }
      let color;
      if (this.match("COLOR" /* COLOR */)) {
        color = this.previous().value;
      }
      let description;
      if (this.match("LBRACKET" /* LBRACKET */)) {
        description = this.parseMultilineDescription();
      }
      return {
        type: "ComponentDeclaration",
        declType: lhs.isParens ? "interface" : "component",
        name: alias || lhs.name,
        label: lhs.rawName,
        alias,
        color,
        description,
        line: token.line,
        column: token.column
      };
    }
    parseRefElement() {
      const startToken = this.peek();
      if (startToken.type === "IDENTIFIER" /* IDENTIFIER */ && startToken.value === "()") {
        this.advance();
        const nameToken = this.consume("IDENTIFIER" /* IDENTIFIER */, "Expected name after lollipop '()'");
        let name = nameToken.value;
        let alias;
        if (this.match("AS" /* AS */)) {
          alias = this.consume("IDENTIFIER" /* IDENTIFIER */, "Expected alias after 'as'").value;
        }
        return {
          name: alias || name,
          rawName: name,
          isBracketed: false,
          isParens: true,
          alias
        };
      }
      if (this.match("LBRACKET" /* LBRACKET */)) {
        const startToken2 = this.previous();
        while (!this.check("RBRACKET" /* RBRACKET */) && !this.isAtEnd()) {
          this.advance();
        }
        const endToken = this.consume("RBRACKET" /* RBRACKET */, "Expected closing bracket ']'");
        const name = this.sliceSource(
          startToken2.line,
          startToken2.column + startToken2.value.length,
          endToken.line,
          endToken.column
        );
        let alias;
        if (this.match("AS" /* AS */)) {
          alias = this.consume("IDENTIFIER" /* IDENTIFIER */, "Expected alias after 'as'").value;
        }
        return {
          name: alias || name,
          rawName: name,
          isBracketed: true,
          isParens: false,
          alias
        };
      }
      if (this.match("COMPONENT" /* COMPONENT */, "INTERFACE" /* INTERFACE */)) {
        const keywordType = this.previous().type === "COMPONENT" /* COMPONENT */ ? "component" : "interface";
        let name = "";
        let isBracketed = false;
        let label;
        if (this.match("LBRACKET" /* LBRACKET */)) {
          const startToken2 = this.previous();
          while (!this.check("RBRACKET" /* RBRACKET */) && !this.isAtEnd()) {
            this.advance();
          }
          const endToken = this.consume("RBRACKET" /* RBRACKET */, "Expected closing bracket ']'");
          name = this.sliceSource(
            startToken2.line,
            startToken2.column + startToken2.value.length,
            endToken.line,
            endToken.column
          );
          isBracketed = true;
        } else {
          const nameToken = this.consume("IDENTIFIER" /* IDENTIFIER */, "Expected name after keyword");
          name = nameToken.value;
        }
        let alias;
        if (this.match("AS" /* AS */)) {
          alias = this.consume("IDENTIFIER" /* IDENTIFIER */, "Expected alias after 'as'").value;
        }
        return {
          name: alias || name,
          rawName: name,
          isBracketed,
          isParens: keywordType === "interface",
          keywordType,
          alias
        };
      }
      if (this.match("IDENTIFIER" /* IDENTIFIER */)) {
        const name = this.previous().value;
        return {
          name,
          rawName: name,
          isBracketed: false,
          isParens: false
        };
      }
      return null;
    }
    parseGroup() {
      const startToken = this.advance();
      const containerType = startToken.value.toLowerCase();
      let name = "";
      if (this.match("IDENTIFIER" /* IDENTIFIER */)) {
        name = this.previous().value;
      }
      this.consume("LBRACE" /* LBRACE */, "Expected '{' to start group block");
      this.consumeNewlineOrEOF();
      const body = [];
      while (!this.check("RBRACE" /* RBRACE */) && !this.isAtEnd()) {
        this.skipNewlines();
        if (this.check("RBRACE" /* RBRACE */)) break;
        const statement = this.parseStatement();
        if (statement) {
          body.push(statement);
        }
        this.consumeNewlineOrEOF();
      }
      this.consume("RBRACE" /* RBRACE */, "Expected '}' to close group block");
      return {
        type: "GroupContainer",
        containerType,
        name,
        body,
        line: startToken.line,
        column: startToken.column
      };
    }
    parsePort() {
      const startToken = this.advance();
      const portType = startToken.value.toLowerCase();
      const nameToken = this.consume("IDENTIFIER" /* IDENTIFIER */, "Expected name for port");
      let name = nameToken.value;
      let alias;
      if (this.match("AS" /* AS */)) {
        alias = this.consume("IDENTIFIER" /* IDENTIFIER */, "Expected alias after 'as'").value;
      }
      return {
        type: "PortDeclaration",
        portType,
        name: alias || name,
        label: name,
        alias,
        line: startToken.line,
        column: startToken.column
      };
    }
    parseNote() {
      const startToken = this.advance();
      if (this.match("AS" /* AS */)) {
        const aliasToken = this.consume("IDENTIFIER" /* IDENTIFIER */, "Expected alias after 'as' in floating note");
        this.consumeNewlineOrEOF();
        const text2 = this.parseMultilineNoteText();
        return {
          type: "ComponentNote",
          alias: aliasToken.value,
          text: text2,
          line: startToken.line,
          column: startToken.column
        };
      }
      let position;
      if (this.match("LEFT" /* LEFT */)) position = "left";
      else if (this.match("RIGHT" /* RIGHT */)) position = "right";
      else if (this.match("TOP" /* TOP */)) position = "top";
      else if (this.match("BOTTOM" /* BOTTOM */)) position = "bottom";
      else {
        throw this.error(this.peek(), "Expected direction (left, right, top, bottom) in note");
      }
      this.consume("OF" /* OF */, "Expected 'of' in note declaration");
      const target = this.parseRefElement();
      if (!target) {
        throw this.error(this.peek(), "Expected target after 'of' in note declaration");
      }
      if (this.match("COLON" /* COLON */)) {
        const text2 = this.parseLabelRestOfLine();
        return {
          type: "ComponentNote",
          position,
          linkedTo: { name: target.name, isBracketed: target.isBracketed },
          text: text2,
          line: startToken.line,
          column: startToken.column
        };
      }
      this.consumeNewlineOrEOF();
      const text = this.parseMultilineNoteText();
      return {
        type: "ComponentNote",
        position,
        linkedTo: { name: target.name, isBracketed: target.isBracketed },
        text,
        line: startToken.line,
        column: startToken.column
      };
    }
    parseMultilineNoteText() {
      const lines = [];
      while (!this.isAtEnd()) {
        const token = this.peek();
        if ((token.type === "END" /* END */ || token.type === "IDENTIFIER" /* IDENTIFIER */ && token.value.toLowerCase() === "end") && (this.peekNext().type === "NOTE" /* NOTE */ || this.peekNext().value.toLowerCase() === "note")) {
          this.advance();
          this.advance();
          break;
        }
        let lineStr = "";
        while (!this.check("NEWLINE" /* NEWLINE */) && !this.isAtEnd()) {
          lineStr += (lineStr ? " " : "") + this.advance().value;
        }
        lines.push(lineStr);
        this.consumeNewlineOrEOF();
      }
      return lines.join("\n");
    }
    parseMultilineDescription() {
      const lines = [];
      while (!this.isAtEnd()) {
        const token = this.peek();
        if (token.type === "RBRACKET" /* RBRACKET */) {
          this.advance();
          break;
        }
        let lineStr = "";
        while (!this.check("NEWLINE" /* NEWLINE */) && !this.isAtEnd()) {
          const currentToken = this.advance();
          if (currentToken.type === "RBRACKET" /* RBRACKET */) {
            break;
          }
          lineStr += (lineStr ? " " : "") + currentToken.value;
        }
        lines.push(lineStr);
        if (this.previous().type === "RBRACKET" /* RBRACKET */) {
          break;
        }
        this.consumeNewlineOrEOF();
      }
      return lines.join("\n").trim();
    }
    parseLabelRestOfLine() {
      let label = "";
      while (!this.check("NEWLINE" /* NEWLINE */) && !this.isAtEnd()) {
        label += (label ? " " : "") + this.advance().value;
      }
      return label.trim();
    }
    // Helper operations
    peek() {
      return this.tokens[this.current];
    }
    peekNext() {
      if (this.current + 1 >= this.tokens.length) return this.tokens[this.tokens.length - 1];
      return this.tokens[this.current + 1];
    }
    previous() {
      return this.tokens[this.current - 1];
    }
    isAtEnd() {
      return this.peek().type === "EOF" /* EOF */;
    }
    check(type) {
      if (this.isAtEnd()) return false;
      return this.peek().type === type;
    }
    advance() {
      if (!this.isAtEnd()) this.current++;
      return this.previous();
    }
    match(...types) {
      for (const type of types) {
        if (this.check(type)) {
          this.advance();
          return true;
        }
      }
      return false;
    }
    consume(type, message) {
      if (this.check(type)) return this.advance();
      throw this.error(this.peek(), message);
    }
    consumeNewlineOrEOF() {
      if (this.match("NEWLINE" /* NEWLINE */) || this.isAtEnd()) {
        return;
      }
      while (!this.check("NEWLINE" /* NEWLINE */) && !this.isAtEnd()) {
        this.advance();
      }
      this.match("NEWLINE" /* NEWLINE */);
    }
    skipNewlines() {
      while (this.check("NEWLINE" /* NEWLINE */)) {
        this.advance();
      }
    }
    checkLbraceAhead() {
      let temp = this.current;
      while (temp < this.tokens.length) {
        const tok = this.tokens[temp];
        if (tok.type === "NEWLINE" /* NEWLINE */ || tok.type === "EOF" /* EOF */) {
          break;
        }
        if (tok.type === "LBRACE" /* LBRACE */) {
          return true;
        }
        temp++;
      }
      return false;
    }
    error(token, message) {
      return new ParseError(
        `Component AST Parser Error at line ${token.line}, col ${token.column}: ${message} (Got: '${token.value}')`,
        token.line,
        token.column
      );
    }
  };

  // src/diagrams/component/ComponentDiagram.ts
  var ComponentDiagram = class {
    constructor() {
      this.type = "component";
      this.components = [];
      this.relationships = [];
      this.notes = [];
    }
    addComponent(name, type, label, parentId, color) {
      let component = this.components.find((c) => c.name === name);
      if (!component) {
        component = {
          name,
          type,
          label: label || name,
          isVisible: true,
          parentId,
          color,
          declarationOrder: this.components.length
        };
        this.components.push(component);
      } else {
        if (label) component.label = label;
        if (parentId) component.parentId = parentId;
        if (color) component.color = color;
        if (type !== "component" && component.type === "component") component.type = type;
      }
      return component;
    }
    addRelationship(from, to, type = "solid", label, direction, showArrowHead = true, _parentId) {
      this.relationships.push({ from, to, type, label, direction, showArrowHead });
    }
    addNote(text, position, linkedTo, alias) {
      const id = `note_${this.notes.length}`;
      this.notes.push({ text, position, linkedTo, id, alias });
    }
    findComponent(name) {
      return this.components.find((c) => c.name === name || c.alias === name);
    }
  };

  // src/diagrams/component/parser/ComponentASTCompiler.ts
  var ComponentASTCompiler = class {
    constructor() {
      this.noteAliases = /* @__PURE__ */ new Set();
    }
    compile(ast) {
      const diagram = new ComponentDiagram();
      this.collectNoteAliases(ast.body);
      this.compileNodes(ast.body, diagram);
      return diagram;
    }
    collectNoteAliases(nodes) {
      for (const node of nodes) {
        if (node.type === "ComponentNote" && node.alias) {
          this.noteAliases.add(node.alias);
        } else if (node.type === "GroupContainer") {
          this.collectNoteAliases(node.body);
        }
      }
    }
    compileNodes(nodes, diagram, parentId) {
      for (const node of nodes) {
        switch (node.type) {
          case "ComponentDeclaration":
            this.compileDeclaration(node, diagram, parentId);
            break;
          case "PortDeclaration":
            this.compilePort(node, diagram, parentId);
            break;
          case "GroupContainer":
            this.compileGroup(node, diagram, parentId);
            break;
          case "Relationship":
            this.compileRelationship(node, diagram, parentId);
            break;
          case "ComponentNote":
            this.compileNote(node, diagram);
            break;
          case "PositionHint":
            this.compilePositionHint(node, diagram, parentId);
            break;
        }
      }
    }
    compileDeclaration(node, diagram, parentId) {
      const cleanName = this.stripQuotes(node.name);
      const cleanLabel = node.label ? this.stripQuotes(node.label) : cleanName;
      const color = this.parseColor(node.color);
      const comp = diagram.addComponent(cleanName, node.declType, cleanLabel, parentId, color);
      if (node.description) {
        comp.label = node.description;
      }
    }
    compilePort(node, diagram, parentId) {
      const cleanName = this.stripQuotes(node.name);
      const cleanLabel = node.label ? this.stripQuotes(node.label) : cleanName;
      diagram.addComponent(cleanName, node.portType, cleanLabel, parentId);
    }
    compileGroup(node, diagram, parentId) {
      const type = node.containerType;
      const cleanName = this.stripQuotes(node.name);
      let groupId = cleanName;
      if (!cleanName) {
        const count = diagram.components.filter((c) => c.type === type).length;
        groupId = `${type}_${count}_group`;
        diagram.addComponent(groupId, type, "", parentId);
      } else {
        diagram.addComponent(cleanName, type, cleanName, parentId);
      }
      this.compileNodes(node.body, diagram, groupId);
    }
    compileRelationship(node, diagram, parentId) {
      let fromVal = node.from.name;
      let toVal = node.to.name;
      let isFromBracketed = node.from.isBracketed;
      let isToBracketed = node.to.isBracketed;
      let isFromParens = node.from.isParens;
      let isToParens = node.to.isParens;
      const arrow = node.arrow;
      const hasReverse = arrow.includes("<");
      const hasForward = arrow.includes(">");
      if (hasReverse && !hasForward) {
        fromVal = node.to.name;
        toVal = node.from.name;
        isFromBracketed = node.to.isBracketed;
        isToBracketed = node.from.isBracketed;
        isFromParens = node.to.isParens;
        isToParens = node.from.isParens;
      }
      const id1 = this.stripQuotes(fromVal);
      const id2 = this.stripQuotes(toVal);
      if (!diagram.components.some((c) => c.name === id1) && !this.noteAliases.has(id1)) {
        const type2 = isFromBracketed ? "component" : "interface";
        diagram.addComponent(id1, type2, id1, parentId);
      }
      if (!diagram.components.some((c) => c.name === id2) && !this.noteAliases.has(id2)) {
        const type2 = isToBracketed ? "component" : "interface";
        diagram.addComponent(id2, type2, id2, parentId);
      }
      let type = "solid";
      if (arrow.includes("..")) {
        type = "dashed";
      }
      let direction = void 0;
      if (arrow.includes("left") || arrow.includes("le")) direction = "left";
      else if (arrow.includes("right") || arrow.includes("ri")) direction = "right";
      else if (arrow.includes("up")) direction = "up";
      else if (arrow.includes("down") || arrow.includes("do")) direction = "down";
      if (!direction) {
        const stripped = arrow.replace(/[<>]/g, "");
        const dashMatch = stripped.match(/(-+|\.+)/);
        if (dashMatch) {
          const len = dashMatch[1].length;
          if (hasReverse && !hasForward) {
            direction = len >= 2 ? "up" : "left";
          } else {
            direction = len >= 2 ? "down" : "right";
          }
        }
      }
      const hasArrowHead = hasForward || hasReverse;
      diagram.addRelationship(id1, id2, type, node.label, direction, hasArrowHead, parentId);
    }
    compileNote(node, diagram) {
      if (node.linkedTo) {
        const targetId = this.stripQuotes(node.linkedTo.name);
        if (!diagram.findComponent(targetId)) {
          diagram.addComponent(targetId, node.linkedTo.isBracketed ? "component" : "interface");
        }
        diagram.addNote(node.text, node.position, targetId);
      } else if (node.alias) {
        diagram.addNote(node.text, void 0, void 0, node.alias);
      }
    }
    compilePositionHint(node, diagram, parentId) {
      const cleanName = this.stripQuotes(node.name);
      const cleanRef = this.stripQuotes(node.reference);
      const color = this.parseColor(node.color);
      const comp = diagram.addComponent(cleanName, "component", cleanName, parentId, color);
      comp.positionHint = { reference: cleanRef, position: node.position };
    }
    // Helper functions
    stripQuotes(str) {
      return str.replace(/^"(.*)"$/, "$1");
    }
    parseColor(color) {
      if (!color) return void 0;
      if (color.startsWith("#")) {
        const hexContent = color.substring(1);
        const isHex = /^([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(hexContent);
        if (isHex) {
          return color;
        } else {
          return hexContent;
        }
      }
      return color;
    }
  };

  // src/diagrams/component/ComponentParser.ts
  var ComponentParser = class {
    parse(content) {
      const lexer = new Lexer(content);
      const tokens = lexer.scanTokens();
      const parser = new ComponentASTParser(tokens, content);
      const ast = parser.parse();
      const compiler = new ComponentASTCompiler();
      return compiler.compile(ast);
    }
  };

  // src/diagrams/component/ComponentLayout.ts
  var ComponentLayout = class {
    // Map note alias/id to position
    constructor(diagram, theme) {
      this.diagram = diagram;
      this.theme = theme;
      this.layoutMap = /* @__PURE__ */ new Map();
      this.gridCells = /* @__PURE__ */ new Map();
      this.noteLayoutMap = /* @__PURE__ */ new Map();
    }
    calculateLayout() {
      this.layoutMap.clear();
      const roots = this.diagram.components.filter((c) => !c.parentId);
      this.layoutGroup(roots, 0, 0);
      const componentNodes = [];
      this.layoutMap.forEach((rect, id) => {
        const comp = this.diagram.components.find((c) => c.name === id);
        if (comp) {
          componentNodes.push({ ...rect, component: comp });
        }
      });
      this.straightenVerticalLines(componentNodes);
      componentNodes.forEach((node) => {
        const rect = this.layoutMap.get(node.component.name);
        if (rect) {
          node.x = rect.x;
          node.y = rect.y;
        }
      });
      const notes = this.layoutNotes(componentNodes);
      const bounds = this.getContentBounds(componentNodes, notes);
      const offsetX = this.theme.padding - bounds.x;
      const offsetY = this.theme.padding - bounds.y;
      if (offsetX !== 0 || offsetY !== 0) {
        componentNodes.forEach((node) => {
          node.x += offsetX;
          node.y += offsetY;
          const rect = this.layoutMap.get(node.component.name);
          rect.x = node.x;
          rect.y = node.y;
        });
        notes.forEach((note) => {
          note.x += offsetX;
          note.y += offsetY;
        });
      }
      const relationships = this.diagram.relationships.map((r) => this.routeRelationship(r));
      let minX = bounds.x + offsetX;
      let minY = bounds.y + offsetY;
      let maxX = bounds.x + bounds.width + offsetX;
      let maxY = bounds.y + bounds.height + offsetY;
      relationships.forEach((rel) => {
        rel.path.forEach((p) => {
          minX = Math.min(minX, p.x);
          minY = Math.min(minY, p.y);
          maxX = Math.max(maxX, p.x);
          maxY = Math.max(maxY, p.y);
        });
      });
      const finalOffsetX = this.theme.padding - minX;
      const finalOffsetY = this.theme.padding - minY;
      if (finalOffsetX > 0 || finalOffsetY > 0) {
        const dx = Math.max(0, finalOffsetX);
        const dy = Math.max(0, finalOffsetY);
        componentNodes.forEach((node) => {
          node.x += dx;
          node.y += dy;
        });
        notes.forEach((note) => {
          note.x += dx;
          note.y += dy;
        });
        relationships.forEach((rel) => {
          rel.path.forEach((p) => {
            p.x += dx;
            p.y += dy;
          });
          if (rel.labelPosition) {
            rel.labelPosition.x += dx;
            rel.labelPosition.y += dy;
          }
        });
        maxX += dx;
        maxY += dy;
      }
      return {
        components: componentNodes,
        relationships,
        notes,
        width: maxX + this.theme.padding,
        height: maxY + this.theme.padding
      };
    }
    straightenVerticalLines(nodes) {
      const hasPositionBinding = /* @__PURE__ */ new Set();
      this.diagram.components.filter((c) => c.positionHint).forEach((c) => {
        hasPositionBinding.add(c.name);
        hasPositionBinding.add(c.positionHint.reference);
      });
      const vRels = this.diagram.relationships.filter((r) => !r.direction || r.direction === "down" || r.direction === "up");
      if (vRels.length === 0) return;
      for (let iter = 0; iter < 50; iter++) {
        const shifts = /* @__PURE__ */ new Map();
        vRels.forEach((rel) => {
          const fromRect = this.layoutMap.get(rel.from);
          const toRect = this.layoutMap.get(rel.to);
          if (!fromRect || !toRect) return;
          if (Math.abs(toRect.y - fromRect.y) < 10) return;
          const fromX = fromRect.x + fromRect.width / 2;
          const toX = toRect.x + toRect.width / 2;
          const error = toX - fromX;
          if (Math.abs(error) < 0.1) return;
          const outgoingVRels = vRels.filter((r) => r.from === rel.from);
          if (outgoingVRels.length > 1) return;
          const incomingVRels = vRels.filter((r) => r.to === rel.to);
          if (incomingVRels.length > 1) return;
          const lcp = this.findLowestCommonParent(rel.from, rel.to);
          const nodeFrom = this.getAncestorUnder(rel.from, lcp);
          const nodeTo = this.getAncestorUnder(rel.to, lcp);
          if (nodeFrom && nodeTo && nodeFrom !== nodeTo) {
            if (hasPositionBinding.has(nodeFrom) || hasPositionBinding.has(nodeTo)) return;
            if (!shifts.has(nodeFrom)) shifts.set(nodeFrom, { totalShift: 0, count: 0 });
            if (!shifts.has(nodeTo)) shifts.set(nodeTo, { totalShift: 0, count: 0 });
            const sFrom = shifts.get(nodeFrom);
            const sTo = shifts.get(nodeTo);
            sFrom.totalShift += error / 2;
            sFrom.count++;
            sTo.totalShift -= error / 2;
            sTo.count++;
          }
        });
        if (shifts.size === 0) break;
        let moved = false;
        shifts.forEach((val, name) => {
          const avgShift = val.totalShift / val.count;
          if (Math.abs(avgShift) < 0.1) return;
          const rect = this.layoutMap.get(name);
          if (rect) {
            rect.x += avgShift;
            moved = true;
            const cell = this.gridCells.get(name);
            if (cell) {
              cell.x += avgShift;
              this.gridCells.set(name, cell);
            }
            const children = this.diagram.components.filter((c) => c.parentId === name);
            if (children.length > 0) {
              this.shiftChildren(children, avgShift, 0);
            }
          }
        });
        if (!moved) break;
      }
    }
    findLowestCommonParent(name1, name2) {
      const path1 = this.getAncestorPath(name1);
      const path2 = this.getAncestorPath(name2);
      let lcp = void 0;
      for (let i = 0; i < Math.min(path1.length, path2.length); i++) {
        if (path1[i] === path2[i]) {
          lcp = path1[i];
        } else {
          break;
        }
      }
      return lcp;
    }
    getAncestorPath(name) {
      const comp = this.diagram.components.find((c) => c.name === name);
      if (comp && comp.parentId) {
        return [...this.getAncestorPath(comp.parentId), comp.parentId];
      }
      return [];
    }
    getAncestorUnder(name, parentName) {
      const comp = this.diagram.components.find((c) => c.name === name);
      if (comp && comp.parentId !== parentName) {
        return this.getAncestorUnder(comp.parentId, parentName);
      }
      return name;
    }
    getTopLevelAncestor(name) {
      const comp = this.diagram.components.find((c) => c.name === name);
      if (comp && comp.parentId) {
        return this.getTopLevelAncestor(comp.parentId);
      }
      return name;
    }
    layoutGroup(components, startX, startY) {
      if (components.length === 0) {
        return { x: startX, y: startY, width: 0, height: 0 };
      }
      const sizeMap = /* @__PURE__ */ new Map();
      components.forEach((comp) => {
        let width = this.theme.componentWidth;
        let height = this.theme.componentHeight;
        if (comp.type === "interface") {
          width = this.theme.interfaceRadius * 2;
          height = this.theme.interfaceRadius * 2;
          const label = comp.label || comp.name;
          const lines = label.split(/\\n|\n/);
          const maxLineLen = Math.max(...lines.map((l) => l.length));
          const textWidth = maxLineLen * 8;
          width = Math.max(width, textWidth);
          height += lines.length * 20;
        } else {
          const allChildren = this.diagram.components.filter((c) => c.parentId === comp.name);
          const ports = allChildren.filter((c) => c.type === "port" || c.type === "portin" || c.type === "portout");
          const contentChildren = allChildren.filter((c) => c.type !== "port" && c.type !== "portin" && c.type !== "portout");
          if (contentChildren.length > 0) {
            const childrenBounds = this.layoutGroup(contentChildren, 0, 0);
            width = childrenBounds.width + this.theme.packagePadding * 2;
            height = childrenBounds.height + this.theme.packagePadding * 2 + 30;
          } else {
            const label = comp.label || comp.name;
            const lines = label.split(/\\n|\n/);
            const maxLineLen = Math.max(...lines.map((l) => l.length));
            width = Math.max(width, maxLineLen * 9 + 20);
            height = Math.max(height, lines.length * 20 + 20);
          }
        }
        sizeMap.set(comp.name, { width, height });
      });
      const compNames = new Set(components.map((c) => c.name));
      const gridPos = /* @__PURE__ */ new Map();
      const isOccupied = (pos, grid) => {
        for (const p of grid.values()) {
          if (p.row === pos.row && p.col === pos.col) return true;
        }
        return false;
      };
      const hintsToProcess = components.filter((c) => c.positionHint).sort((a, b) => a.declarationOrder - b.declarationOrder);
      for (const comp of hintsToProcess) {
        const hint = comp.positionHint;
        const refComp = components.find((c) => c.name === hint.reference);
        if (!refComp) continue;
        if (!gridPos.has(hint.reference)) {
          gridPos.set(hint.reference, { row: 0, col: 0 });
        }
        const refPos = gridPos.get(hint.reference);
        let targetPos;
        switch (hint.position) {
          case "right":
            targetPos = { row: refPos.row, col: refPos.col + 1 };
            break;
          case "left":
            targetPos = { row: refPos.row, col: refPos.col - 1 };
            break;
          case "bottom":
            targetPos = { row: refPos.row + 1, col: refPos.col };
            break;
          case "top":
            targetPos = { row: refPos.row - 1, col: refPos.col };
            break;
          default:
            targetPos = { row: refPos.row + 1, col: refPos.col };
            break;
        }
        while (isOccupied(targetPos, gridPos)) {
          if (hint.position === "left") targetPos.col--;
          else if (hint.position === "right") targetPos.col++;
          else if (hint.position === "top") targetPos.row--;
          else if (hint.position === "bottom") targetPos.row++;
          else targetPos.col++;
        }
        gridPos.set(comp.name, targetPos);
      }
      const descendantToAncestor = /* @__PURE__ */ new Map();
      components.forEach((comp) => {
        descendantToAncestor.set(comp.name, comp.name);
        const descendants = this.getAllDescendants(comp.name);
        descendants.forEach((d) => descendantToAncestor.set(d, comp.name));
      });
      const relevantRels = [];
      const seen = /* @__PURE__ */ new Set();
      this.diagram.relationships.forEach((r) => {
        const ancestorFrom = descendantToAncestor.get(r.from);
        const ancestorTo = descendantToAncestor.get(r.to);
        if (ancestorFrom && ancestorTo && ancestorFrom !== ancestorTo) {
          const key = `${ancestorFrom}->${ancestorTo}`;
          if (!seen.has(key)) {
            seen.add(key);
            relevantRels.push({
              from: ancestorFrom,
              to: ancestorTo,
              direction: r.direction || "down"
            });
          }
        }
      });
      const adj = /* @__PURE__ */ new Map();
      if (relevantRels.length > 0) {
        const targetClaimed = /* @__PURE__ */ new Set();
        relevantRels.forEach((r) => {
          const dir = r.direction || "down";
          if (!targetClaimed.has(r.to)) {
            targetClaimed.add(r.to);
            if (!adj.has(r.from)) adj.set(r.from, []);
            adj.get(r.from).push({ target: r.to, direction: dir });
          }
        });
        const queue = [];
        const visited = /* @__PURE__ */ new Set();
        const processQueue = () => {
          while (queue.length > 0) {
            const current = queue.shift();
            if (visited.has(current)) continue;
            visited.add(current);
            const currentPos = gridPos.get(current);
            const neighbors = adj.get(current) || [];
            const byDir = /* @__PURE__ */ new Map();
            neighbors.forEach((n) => {
              if (!gridPos.has(n.target)) {
                if (!byDir.has(n.direction)) byDir.set(n.direction, []);
                byDir.get(n.direction).push(n.target);
              }
            });
            byDir.forEach((targets, dir) => {
              const sortedTargets = targets.sort((a, b) => {
                const compA = components.find((c) => c.name === a);
                const compB = components.find((c) => c.name === b);
                return (compA?.declarationOrder ?? 0) - (compB?.declarationOrder ?? 0);
              });
              sortedTargets.forEach((target, i) => {
                let row = currentPos.row;
                let col = currentPos.col;
                const offset = targets.length === 1 ? 0 : i - (targets.length - 1) / 2;
                switch (dir) {
                  case "down":
                    row++;
                    break;
                  case "up":
                    row--;
                    break;
                  case "right":
                    col++;
                    break;
                  case "left":
                    col--;
                    break;
                }
                while (isOccupied({ row, col }, gridPos)) {
                  if (dir === "down" || dir === "up") col++;
                  else if (dir === "left") col--;
                  else if (dir === "right") col++;
                  else row++;
                }
                gridPos.set(target, { row, col });
                queue.push(target);
              });
            });
          }
        };
        for (const name of gridPos.keys()) {
          queue.push(name);
        }
        processQueue();
        const roots = components.filter((c) => !relevantRels.some((r) => r.to === c.name)).sort((a, b) => a.declarationOrder - b.declarationOrder);
        if (gridPos.size === 0 && roots.length > 0) {
          const startNode = roots[0].name;
          gridPos.set(startNode, { row: 0, col: 0 });
          queue.push(startNode);
          processQueue();
        } else if (gridPos.size === 0 && relevantRels.length > 0) {
          const startNode = relevantRels[0].from;
          gridPos.set(startNode, { row: 0, col: 0 });
          queue.push(startNode);
          processQueue();
        }
        for (const root of roots) {
          if (!gridPos.has(root.name) && relevantRels.some((r) => r.from === root.name || r.to === root.name)) {
            let col = 0;
            while (isOccupied({ row: 0, col }, gridPos)) col++;
            gridPos.set(root.name, { row: 0, col });
            queue.push(root.name);
            processQueue();
          }
        }
      }
      const unpositioned = components.filter((c) => !gridPos.has(c.name)).sort((a, b) => a.declarationOrder - b.declarationOrder);
      if (unpositioned.length > 0) {
        let maxRow2 = -1;
        gridPos.forEach((pos) => maxRow2 = Math.max(maxRow2, pos.row));
        const startRow = maxRow2 + 1;
        const cols = Math.ceil(Math.sqrt(unpositioned.length));
        unpositioned.forEach((comp, i) => {
          gridPos.set(comp.name, {
            row: startRow + Math.floor(i / cols),
            col: i % cols
          });
        });
      }
      const hasPositionBinding = /* @__PURE__ */ new Set();
      components.filter((c) => c.positionHint).forEach((c) => {
        hasPositionBinding.add(c.name);
        hasPositionBinding.add(c.positionHint.reference);
      });
      components.forEach((comp) => {
        if (hasPositionBinding.has(comp.name)) return;
        const neighbors = (adj.get(comp.name) || []).filter((n) => n.direction === "down");
        if (neighbors.length > 0) {
          const pos = gridPos.get(comp.name);
          if (pos) {
            const childrenCols = neighbors.map((n) => {
              const targetPos = gridPos.get(n.target);
              if (targetPos && targetPos.row !== pos.row) {
                return targetPos.col;
              }
              return void 0;
            }).filter((c) => c !== void 0);
            if (childrenCols.length > 0) {
              const avgCol = childrenCols.reduce((a, b) => a + b, 0) / childrenCols.length;
              pos.col = Math.round(avgCol);
            }
          }
        }
      });
      const normalizeAndResolve = () => {
        let minR = Infinity, minC = Infinity;
        gridPos.forEach((p) => {
          minR = Math.min(minR, p.row);
          minC = Math.min(minC, p.col);
        });
        gridPos.forEach((p) => {
          p.row -= minR;
          p.col -= minC;
        });
        const sorted = Array.from(gridPos.keys()).sort((a, b) => {
          const pa = gridPos.get(a), pb = gridPos.get(b);
          return pa.row - pb.row || pa.col - pb.col;
        });
        const occupied = /* @__PURE__ */ new Set();
        sorted.forEach((name) => {
          const pos = gridPos.get(name);
          let key = `${pos.row},${pos.col}`;
          while (occupied.has(key)) {
            pos.col++;
            key = `${pos.row},${pos.col}`;
          }
          occupied.add(key);
        });
      };
      normalizeAndResolve();
      let maxRow = 0, maxCol = 0;
      gridPos.forEach((pos) => {
        maxRow = Math.max(maxRow, pos.row);
        maxCol = Math.max(maxCol, pos.col);
      });
      const colWidths = new Array(maxCol + 1).fill(0);
      const rowHeights = new Array(maxRow + 1).fill(0);
      gridPos.forEach((pos, name) => {
        const size = sizeMap.get(name);
        colWidths[pos.col] = Math.max(colWidths[pos.col], size.width);
        rowHeights[pos.row] = Math.max(rowHeights[pos.row], size.height);
      });
      const colStarts = [startX];
      for (let c = 1; c <= maxCol; c++) {
        colStarts[c] = colStarts[c - 1] + colWidths[c - 1] + this.theme.componentGapX;
      }
      const rowStarts = [startY];
      for (let r = 1; r <= maxRow; r++) {
        rowStarts[r] = rowStarts[r - 1] + rowHeights[r - 1] + this.theme.componentGapY;
      }
      components.forEach((comp) => {
        const pos = gridPos.get(comp.name);
        const size = sizeMap.get(comp.name);
        const cellX = colStarts[pos.col];
        const cellY = rowStarts[pos.row];
        const cellW = colWidths[pos.col];
        const cellH = rowHeights[pos.row];
        const posX = cellX + (cellW - size.width) / 2;
        const posY = cellY + (cellH - size.height) / 2;
        this.layoutMap.set(comp.name, {
          x: posX,
          y: posY,
          width: size.width,
          height: size.height
        });
        this.gridCells.set(comp.name, { x: cellX, w: cellW });
      });
      components.forEach((comp) => {
        const size = sizeMap.get(comp.name);
        const rect = this.layoutMap.get(comp.name);
        const posX = rect.x;
        const posY = rect.y;
        const allChildren = this.diagram.components.filter((c) => c.parentId === comp.name);
        const contentChildren = allChildren.filter((c) => c.type !== "port" && c.type !== "portin" && c.type !== "portout");
        if (contentChildren.length > 0) {
          this.shiftChildren(contentChildren, posX + this.theme.packagePadding, posY + 30 + this.theme.packagePadding);
        }
        const ports = allChildren.filter((c) => c.type === "port" || c.type === "portin" || c.type === "portout");
        if (ports.length > 0) {
          this.layoutPorts(comp, ports, posX, posY, size.width, size.height);
        }
      });
      const totalWidth = colStarts[maxCol] + colWidths[maxCol] - startX;
      const totalHeight = rowStarts[maxRow] + rowHeights[maxRow] - startY;
      return {
        x: startX,
        y: startY,
        width: totalWidth,
        height: totalHeight
      };
    }
    shiftChildren(children, dx, dy) {
      children.forEach((child) => {
        const rect = this.layoutMap.get(child.name);
        if (rect) {
          rect.x += dx;
          rect.y += dy;
          this.layoutMap.set(child.name, rect);
          const cell = this.gridCells.get(child.name);
          if (cell) {
            cell.x += dx;
            this.gridCells.set(child.name, cell);
          }
          const grandChildren = this.diagram.components.filter((c) => c.parentId === child.name);
          if (grandChildren.length > 0) {
            this.shiftChildren(grandChildren, dx, dy);
          }
        }
      });
    }
    /** Recursively get all descendant component names */
    getAllDescendants(parentName) {
      const result = [];
      const children = this.diagram.components.filter((c) => c.parentId === parentName);
      children.forEach((child) => {
        result.push(child.name);
        result.push(...this.getAllDescendants(child.name));
      });
      return result;
    }
    findObstacle(start, end, excludeNames) {
      const excludeSet = new Set(excludeNames);
      let firstObstacle = void 0;
      let minDist = Infinity;
      for (const [name, rect] of this.layoutMap.entries()) {
        if (excludeSet.has(name)) continue;
        if (this.segmentIntersectsRect(start, end, rect)) {
          const cx = rect.x + rect.width / 2;
          const cy = rect.y + rect.height / 2;
          const d = (cx - start.x) ** 2 + (cy - start.y) ** 2;
          if (d < minDist) {
            minDist = d;
            firstObstacle = rect;
          }
        }
      }
      return firstObstacle;
    }
    segmentIntersectsRect(p1, p2, rect) {
      const minX = Math.min(p1.x, p2.x);
      const maxX = Math.max(p1.x, p2.x);
      const minY = Math.min(p1.y, p2.y);
      const maxY = Math.max(p1.y, p2.y);
      if (maxX < rect.x || minX > rect.x + rect.width || maxY < rect.y || minY > rect.y + rect.height) {
        return false;
      }
      const cx = rect.x + rect.width / 2;
      const cy = rect.y + rect.height / 2;
      const l2 = (p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2;
      if (l2 === 0) return false;
      let t = ((cx - p1.x) * (p2.x - p1.x) + (cy - p1.y) * (p2.y - p1.y)) / l2;
      t = Math.max(0, Math.min(1, t));
      const px = p1.x + t * (p2.x - p1.x);
      const py = p1.y + t * (p2.y - p1.y);
      const margin = 5;
      return px >= rect.x - margin && px <= rect.x + rect.width + margin && py >= rect.y - margin && py <= rect.y + rect.height + margin;
    }
    routeRelationship(rel) {
      let fromRect = this.layoutMap.get(rel.from);
      if (!fromRect) {
        fromRect = this.noteLayoutMap.get(rel.from);
      }
      let toRect = this.layoutMap.get(rel.to);
      if (!toRect) {
        toRect = this.noteLayoutMap.get(rel.to);
      }
      if (!fromRect || !toRect) {
        return { relationship: rel, path: [] };
      }
      const fromComp = this.diagram.components.find((c) => c.name === rel.from);
      const toComp = this.diagram.components.find((c) => c.name === rel.to);
      const startCenter = {
        x: fromRect.x + fromRect.width / 2,
        y: fromRect.y + fromRect.height / 2
      };
      const endCenter = {
        x: toRect.x + toRect.width / 2,
        y: toRect.y + toRect.height / 2
      };
      const startPad = fromComp?.type === "interface" ? this.theme.interfaceRadius : 0;
      const endPad = toComp?.type === "interface" ? this.theme.interfaceRadius : 0;
      let start = this.getIntersection(startCenter, endCenter, fromRect, startPad, fromComp?.type === "interface");
      let end = this.getIntersection(endCenter, startCenter, toRect, endPad, toComp?.type === "interface");
      let path = [start, end];
      let labelPos = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 - 10 };
      const exclude = [rel.from, rel.to];
      if (fromComp) exclude.push(...this.getAncestorPath(fromComp.name));
      if (toComp) exclude.push(...this.getAncestorPath(toComp.name));
      const obstacle = this.findObstacle(start, end, exclude);
      if (obstacle) {
        const dx = endCenter.x - startCenter.x;
        const dy = endCenter.y - startCenter.y;
        const isHorizontal = rel.direction ? rel.direction === "left" || rel.direction === "right" : Math.abs(dx) > Math.abs(dy);
        let control1 = { x: 0, y: 0 };
        let control2 = { x: 0, y: 0 };
        let detourDirection = "right";
        if (isHorizontal) {
          let detourY = 0;
          if (dy >= 0) {
            detourY = obstacle.y + obstacle.height + 40;
            detourDirection = "down";
          } else {
            detourY = obstacle.y - 40;
            detourDirection = "up";
          }
          const spanX = endCenter.x - startCenter.x;
          control1 = { x: startCenter.x + spanX * 0.2, y: detourY };
          control2 = { x: startCenter.x + spanX * 0.8, y: detourY };
        } else {
          let detourX = 0;
          if (dx >= 0) {
            detourX = obstacle.x + obstacle.width + 80;
            detourDirection = "right";
          } else {
            detourX = obstacle.x - 80;
            detourDirection = "left";
          }
          const spanY = endCenter.y - startCenter.y;
          control1 = { x: detourX, y: startCenter.y + spanY * 0.2 };
          control2 = { x: detourX, y: startCenter.y + spanY * 0.8 };
        }
        let proxyX = 0, proxyY = 0;
        if (detourDirection === "right") proxyX = 1e4;
        else if (detourDirection === "left") proxyX = -1e4;
        else if (detourDirection === "down") proxyY = 1e4;
        else if (detourDirection === "up") proxyY = -1e4;
        start = this.getIntersection(
          startCenter,
          { x: startCenter.x + proxyX, y: startCenter.y + proxyY },
          fromRect,
          startPad,
          fromComp?.type === "interface"
        );
        end = this.getIntersection(
          endCenter,
          { x: endCenter.x + proxyX, y: endCenter.y + proxyY },
          toRect,
          endPad,
          toComp?.type === "interface"
        );
        path = [start, control1, control2, end];
        labelPos = {
          x: (start.x + 3 * control1.x + 3 * control2.x + end.x) / 8,
          y: (start.y + 3 * control1.y + 3 * control2.y + end.y) / 8 - 10
        };
      }
      return {
        relationship: rel,
        path,
        labelPosition: labelPos
      };
    }
    getIntersection(center, target, rect, padding = 0, isCircle = false) {
      const dx = target.x - center.x;
      const dy = target.y - center.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist === 0) return center;
      if (isCircle) {
        const scale2 = padding / dist;
        return {
          x: center.x + dx * scale2,
          y: center.y + dy * scale2
        };
      }
      const w = rect.width / 2 + padding;
      const h = rect.height / 2 + padding;
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);
      let scale = 1;
      if (absDx * h > absDy * w) {
        scale = w / absDx;
      } else {
        scale = h / absDy;
      }
      return {
        x: center.x + dx * scale,
        y: center.y + dy * scale
      };
    }
    getContentBounds(components, notes) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      components.forEach((node) => {
        minX = Math.min(minX, node.x);
        minY = Math.min(minY, node.y);
        maxX = Math.max(maxX, node.x + node.width);
        maxY = Math.max(maxY, node.y + node.height);
      });
      notes.forEach((n) => {
        minX = Math.min(minX, n.x);
        minY = Math.min(minY, n.y);
        maxX = Math.max(maxX, n.x + n.width);
        maxY = Math.max(maxY, n.y + n.height);
      });
      if (minX === Infinity) {
        return { x: 0, y: 0, width: 0, height: 0 };
      }
      return {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY
      };
    }
    layoutNotes(components) {
      const layouts = [];
      let defaultY = 0;
      components.forEach((c) => defaultY = Math.max(defaultY, c.y + c.height));
      defaultY += 50;
      this.diagram.notes.forEach((note, i) => {
        const lines = note.text.split("\n");
        const width = Math.max(100, Math.max(...lines.map((l) => l.length * 8)) + 20);
        const height = lines.length * 20 + 20;
        let x = 0;
        let y = defaultY + i * 60;
        if (note.linkedTo) {
          const target = components.find((c) => c.component.name === note.linkedTo);
          if (target) {
            const margin = 30;
            if (note.position === "right") {
              x = target.x + target.width + margin;
              y = target.y + (target.height - height) / 2;
            } else if (note.position === "left") {
              x = target.x - width - margin;
              y = target.y + (target.height - height) / 2;
            } else if (note.position === "top") {
              x = target.x + (target.width - width) / 2;
              y = target.y - height - margin;
            } else if (note.position === "bottom") {
              x = target.x + (target.width - width) / 2;
              y = target.y + target.height + margin;
            } else {
              x = target.x + target.width + margin;
              y = target.y + (target.height - height) / 2;
            }
          }
        }
        const layout = {
          note,
          x,
          y,
          width,
          height
        };
        layouts.push(layout);
        const key = note.alias || note.id;
        this.noteLayoutMap.set(key, { x, y, width, height });
      });
      return layouts;
    }
    layoutPorts(parent, ports, parentX, parentY, parentW, parentH) {
      const portSegments = {
        top: [],
        bottom: [],
        left: [],
        right: []
      };
      ports.forEach((port) => {
        const connections = this.diagram.relationships.filter((r) => r.from === port.name || r.to === port.name);
        if (connections.length === 0) {
          if (port.type === "portin") portSegments.left.push(port);
          else if (port.type === "portout") portSegments.right.push(port);
          else portSegments.left.push(port);
          return;
        }
        let totalX = 0, totalY = 0, count = 0;
        connections.forEach((rel) => {
          const otherName = rel.from === port.name ? rel.to : rel.from;
          let otherRect = this.layoutMap.get(otherName);
          if (!otherRect) {
          }
          if (otherRect) {
            totalX += otherRect.x + otherRect.width / 2;
            totalY += otherRect.y + otherRect.height / 2;
            count++;
          }
        });
        if (count === 0) {
          if (port.type === "portin") portSegments.left.push(port);
          else if (port.type === "portout") portSegments.right.push(port);
          else portSegments.left.push(port);
          return;
        }
        const centerX = totalX / count;
        const centerY = totalY / count;
        const parentCenterX = parentX + parentW / 2;
        const parentCenterY = parentY + parentH / 2;
        const dx = centerX - parentCenterX;
        const dy = centerY - parentCenterY;
        if (Math.abs(dx) >= Math.abs(dy)) {
          if (dx > 0) portSegments.right.push(port);
          else portSegments.left.push(port);
        } else {
          if (dy > 0) portSegments.bottom.push(port);
          else portSegments.top.push(port);
        }
      });
      const portSize = 10;
      const halfPort = portSize / 2;
      const distribute = (list, edge) => {
        if (list.length === 0) return;
        const count = list.length;
        const isVertical = edge === "left" || edge === "right";
        const availableSpace = isVertical ? parentH : parentW;
        const step = availableSpace / (count + 1);
        list.forEach((p, i) => {
          let x = 0, y = 0;
          if (edge === "left") {
            x = parentX - halfPort;
            y = parentY + step * (i + 1) - halfPort;
          } else if (edge === "right") {
            x = parentX + parentW - halfPort;
            y = parentY + step * (i + 1) - halfPort;
          } else if (edge === "top") {
            x = parentX + step * (i + 1) - halfPort;
            y = parentY - halfPort;
          } else if (edge === "bottom") {
            x = parentX + step * (i + 1) - halfPort;
            y = parentY + parentH - halfPort;
          }
          this.layoutMap.set(p.name, {
            x,
            y,
            width: portSize,
            height: portSize
          });
        });
      };
      distribute(portSegments.left, "left");
      distribute(portSegments.right, "right");
      distribute(portSegments.top, "top");
      distribute(portSegments.bottom, "bottom");
    }
  };

  // src/diagrams/component/ComponentTheme.ts
  var defaultTheme2 = {
    padding: 16,
    componentWidth: 120,
    componentHeight: 50,
    interfaceRadius: 10,
    componentGapX: 80,
    componentGapY: 60,
    fontSize: 13,
    packagePadding: 20,
    colors: {
      defaultStroke: "#5a6270",
      defaultFill: "#e8edf3",
      interfaceFill: "#ffffff",
      noteFill: "#fff9c4",
      noteStroke: "#e0d86e",
      line: "#5a6270",
      text: "#2c3e50",
      textLight: "#7f8c9b",
      packageFill: "#ebf0f7",
      packageStroke: "#7b8fa8",
      nodeFill: "#ebf0f7",
      folderFill: "#ebf0f7",
      frameFill: "#ebf0f7",
      cloudFill: "#ebf0f7",
      databaseFill: "#ebf0f7",
      componentIcon: "#7b8fa8"
    },
    fontFamily: "'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
  };

  // src/diagrams/component/ComponentRenderer.ts
  var ComponentRenderer = class {
    constructor() {
      this.theme = defaultTheme2;
    }
    render(diagram) {
      if (diagram.type !== "component") {
        throw new Error("ComponentRenderer only supports component diagrams");
      }
      const componentDiagram = diagram;
      this.layoutEngine = new ComponentLayout(componentDiagram, this.theme);
      const layoutResult = this.layoutEngine.calculateLayout();
      const width = Math.max(layoutResult.width, 100);
      const height = Math.max(layoutResult.height, 100);
      let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`;
      svg += `<defs>
            <marker id="comp-arrow-end" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto" markerUnits="userSpaceOnUse">
                <polygon points="0,0 10,3.5 0,7" fill="${this.theme.colors.line}" />
            </marker>
            <marker id="comp-arrow-open" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto" markerUnits="userSpaceOnUse">
                <polyline points="0,0 10,3.5 0,7" fill="none" stroke="${this.theme.colors.line}" stroke-width="1.5" />
            </marker>
            <filter id="comp-shadow" x="-4%" y="-4%" width="112%" height="112%">
                <feDropShadow dx="1" dy="1" stdDeviation="2" flood-color="#00000020" />
            </filter>
        </defs>`;
      const sortedComponents = [...layoutResult.components].sort((a, b) => {
        const getDepth = (c) => {
          let d = 0;
          let parent = c.component.parentId;
          while (parent) {
            d++;
            parent = componentDiagram.components.find((x) => x.name === parent)?.parentId;
          }
          return d;
        };
        return getDepth(a) - getDepth(b);
      });
      sortedComponents.forEach((node) => {
        svg += this.renderComponentNode(node, componentDiagram, layoutResult);
      });
      layoutResult.notes.forEach((note) => {
        svg += this.renderNote(note);
      });
      layoutResult.relationships.forEach((rel) => {
        svg += this.renderRelationship(rel, componentDiagram);
      });
      svg += "</svg>";
      return svg;
    }
    renderComponentNode(node, diagram, layoutResult) {
      const { component } = node;
      switch (component.type) {
        case "interface":
          return this.renderInterface(node);
        case "package":
          return this.renderPackage(node);
        case "node":
          return this.renderNode(node);
        case "folder":
          return this.renderFolder(node);
        case "frame":
          return this.renderFrame(node);
        case "cloud":
          return this.renderCloud(node);
        case "database":
          return this.renderDatabase(node);
        case "port":
        case "portin":
        case "portout":
          return this.renderPort(node, diagram, layoutResult);
        case "component":
        default:
          return this.renderComponent(node, diagram);
      }
    }
    /** SysML Component: Rectangle with component icon (two small rectangles on the left) */
    renderComponent(node, diagram) {
      const { x, y, width, height, component } = node;
      const fill = component.color || this.theme.colors.defaultFill;
      const stroke = this.theme.colors.defaultStroke;
      const label = component.label || component.name;
      const lines = label.split(/\\n|\n/);
      const iconW = 14;
      const iconH = 18;
      const iconX = width - 20;
      const iconY = 6;
      const tabW = 8;
      const tabH = 5;
      const hasChildren = diagram.components.some((c) => c.parentId === component.name);
      let textX = x + width / 2;
      let textY = y + height / 2;
      let anchor = "middle";
      if (hasChildren) {
        textY = y + 20;
      }
      return `
            <g filter="url(#comp-shadow)">
                <rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${fill}" stroke="${stroke}" stroke-width="1.5" rx="3" ry="3" />
                <!-- SysML Component Icon: rectangle with two tabs -->
                <rect x="${x + iconX}" y="${y + iconY}" width="${iconW}" height="${iconH}" fill="none" stroke="${this.theme.colors.componentIcon}" stroke-width="1.2" rx="1" />
                <rect x="${x + iconX - tabW / 2}" y="${y + iconY + 3}" width="${tabW}" height="${tabH}" fill="${fill}" stroke="${this.theme.colors.componentIcon}" stroke-width="1" rx="0.5" />
                <rect x="${x + iconX - tabW / 2}" y="${y + iconY + 10}" width="${tabW}" height="${tabH}" fill="${fill}" stroke="${this.theme.colors.componentIcon}" stroke-width="1" rx="0.5" />
                <text x="${textX}" y="${textY}" text-anchor="${anchor}" dominant-baseline="middle" fill="${this.theme.colors.text}" font-family="${this.theme.fontFamily}" font-size="${this.theme.fontSize}">
                    ${lines.map((line, i) => `<tspan x="${textX}" dy="${i === 0 ? hasChildren ? 0 : -((lines.length - 1) * 0.6) + "em" : "1.2em"}">${formatRichText(line)}</tspan>`).join("")}
                </text>
            </g>
        `;
    }
    renderInterface(node) {
      const { x, y, width, height, component } = node;
      const r = this.theme.interfaceRadius;
      const cx = x + width / 2;
      const cy = y + height / 2;
      const label = component.label || component.name;
      const lines = label.split(/\\n|\n/);
      return `
            <g>
                <circle cx="${cx}" cy="${cy}" r="${r}" fill="${this.theme.colors.interfaceFill}" stroke="${this.theme.colors.defaultStroke}" stroke-width="1.5"/>
                <text x="${cx}" y="${cy + r + 16}" text-anchor="middle" fill="${this.theme.colors.text}" font-family="${this.theme.fontFamily}" font-size="${this.theme.fontSize}">
                    ${lines.map((line, i) => `<tspan x="${cx}" dy="${i === 0 ? 0 : "1.2em"}">${formatRichText(line)}</tspan>`).join("")}
                </text>
            </g>
        `;
    }
    /** SysML Package: Rectangle with small tab (name compartment) on upper-left */
    renderPackage(node) {
      const { x, y, width, height, component } = node;
      const label = component.label || component.name;
      const tabH = 22;
      const textW = label.length * 8 + 20;
      const tabW = Math.min(Math.max(textW, 60), width * 0.6);
      return `
            <g filter="url(#comp-shadow)">
                <!-- Package tab -->
                <path d="M${x},${y + tabH} L${x},${y + 3} Q${x},${y} ${x + 3},${y} L${x + tabW - 5},${y} L${x + tabW},${y + tabH}" fill="${this.theme.colors.packageFill}" stroke="${this.theme.colors.packageStroke}" stroke-width="1.5" />
                <!-- Package body -->
                <rect x="${x}" y="${y + tabH}" width="${width}" height="${height - tabH}" fill="${this.theme.colors.packageFill}" fill-opacity="0.25" stroke="${this.theme.colors.packageStroke}" stroke-width="1.5" rx="1" />
                <!-- Label in tab -->
                <text x="${x + 10}" y="${y + 15}" text-anchor="start" font-weight="600" fill="${this.theme.colors.text}" font-family="${this.theme.fontFamily}" font-size="${this.theme.fontSize}">
                    ${formatRichText(label)}
                </text>
            </g>
        `;
    }
    /** SysML Node: 3D box (cube) – indicates execution environment */
    renderNode(node) {
      const { x, y, width, height, component } = node;
      const label = component.label || component.name;
      const d = 10;
      return `
            <g filter="url(#comp-shadow)">
                <!-- Top face -->
                <polygon points="${x},${y + d} ${x + d},${y} ${x + width + d},${y} ${x + width},${y + d}" fill="${this.theme.colors.nodeFill}" stroke="${this.theme.colors.packageStroke}" stroke-width="1.2" />
                <!-- Right face -->
                <polygon points="${x + width},${y + d} ${x + width + d},${y} ${x + width + d},${y + height} ${x + width},${y + height + d}" fill="${this.theme.colors.nodeFill}" fill-opacity="0.7" stroke="${this.theme.colors.packageStroke}" stroke-width="1.2" />
                <!-- Front face -->
                <rect x="${x}" y="${y + d}" width="${width}" height="${height}" fill="${this.theme.colors.nodeFill}" fill-opacity="0.35" stroke="${this.theme.colors.packageStroke}" stroke-width="1.5" />
                <text x="${x + 10}" y="${y + d + 18}" text-anchor="start" font-weight="600" fill="${this.theme.colors.text}" font-family="${this.theme.fontFamily}" font-size="${this.theme.fontSize}">
                    \xABnode\xBB ${formatRichText(label)}
                </text>
            </g>
        `;
    }
    /** Folder: Rectangle with folder tab */
    renderFolder(node) {
      const { x, y, width, height, component } = node;
      const label = component.label || component.name;
      const tabH = 16;
      const tabW = Math.min(60, width * 0.35);
      return `
            <g filter="url(#comp-shadow)">
                <!-- Folder tab -->
                <path d="M${x},${y + tabH} L${x},${y + 3} Q${x},${y} ${x + 3},${y} L${x + tabW - 8},${y} L${x + tabW},${y + tabH}" fill="${this.theme.colors.folderFill}" stroke="${this.theme.colors.defaultStroke}" stroke-width="1.3" />
                <!-- Folder body -->
                <rect x="${x}" y="${y + tabH}" width="${width}" height="${height - tabH}" fill="${this.theme.colors.folderFill}" fill-opacity="0.3" stroke="${this.theme.colors.defaultStroke}" stroke-width="1.3" rx="1" />
                <text x="${x + 10}" y="${y + tabH + 18}" text-anchor="start" font-weight="600" fill="${this.theme.colors.text}" font-family="${this.theme.fontFamily}" font-size="${this.theme.fontSize}">
                    ${formatRichText(label)}
                </text>
            </g>
        `;
    }
    /** Frame: Rectangle with pentagon name tag in upper-left */
    renderFrame(node) {
      const { x, y, width, height, component } = node;
      const label = component.label || component.name;
      const lines = label.split(/\\n|\n/);
      const maxLineLen = Math.max(...lines.map((l) => l.length));
      const tagW = Math.min(maxLineLen * 8 + 24, width * 0.6);
      const tagH = 22 + (lines.length - 1) * 14;
      return `
            <g filter="url(#comp-shadow)">
                <!-- Frame body -->
                <rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${this.theme.colors.frameFill}" fill-opacity="0.25" stroke="${this.theme.colors.defaultStroke}" stroke-width="1.5" rx="2" />
                <!-- Pentagon name tag -->
                <polygon points="${x},${y} ${x + tagW},${y} ${x + tagW},${y + tagH - 6} ${x + tagW - 6},${y + tagH} ${x},${y + tagH}" fill="${this.theme.colors.frameFill}" stroke="${this.theme.colors.defaultStroke}" stroke-width="1.3" />
                <text x="${x + 8}" y="${y + 15}" text-anchor="start" font-weight="600" fill="${this.theme.colors.text}" font-family="${this.theme.fontFamily}" font-size="${this.theme.fontSize - 1}">
                    ${lines.map((line, i) => `<tspan x="${x + 8}" dy="${i === 0 ? 0 : "1.2em"}">${formatRichText(line)}</tspan>`).join("")}
                </text>
            </g>
        `;
    }
    /** Cloud: organic cloud shape */
    renderCloud(node) {
      const { x, y, width, height, component } = node;
      const label = component.label || component.name;
      const lines = label.split(/\\n|\n/);
      const cx = width / 2;
      const cy = height / 2;
      const w = width;
      const h = height;
      return `
            <g transform="translate(${x}, ${y})" filter="url(#comp-shadow)">
                <path d="
                    M${w * 0.25},${h * 0.7}
                    C${w * 0.02},${h * 0.7} ${w * 0},${h * 0.45} ${w * 0.15},${h * 0.35}
                    C${w * 0.1},${h * 0.15} ${w * 0.3},${h * 0.05} ${w * 0.45},${h * 0.2}
                    C${w * 0.5},${h * 0.05} ${w * 0.75},${h * 0.05} ${w * 0.78},${h * 0.25}
                    C${w * 1},${h * 0.2} ${w * 1.02},${h * 0.5} ${w * 0.85},${h * 0.6}
                    C${w * 0.95},${h * 0.75} ${w * 0.85},${h * 0.85} ${w * 0.7},${h * 0.78}
                    C${w * 0.6},${h * 0.9} ${w * 0.4},${h * 0.9} ${w * 0.25},${h * 0.7}
                    Z
                " fill="${this.theme.colors.cloudFill}" fill-opacity="0.5" stroke="${this.theme.colors.packageStroke}" stroke-width="1.5" />
                ${label ? `<text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="middle" font-weight="600" fill="${this.theme.colors.text}" font-family="${this.theme.fontFamily}" font-size="${this.theme.fontSize}">
                    ${lines.map((line, i) => `<tspan x="${cx}" dy="${i === 0 ? -((lines.length - 1) * 0.6) + "em" : "1.2em"}">${formatRichText(line)}</tspan>`).join("")}
                </text>` : ""}
            </g>
        `;
    }
    /** Database: Cylinder shape */
    renderDatabase(node) {
      const { x, y, width, height, component } = node;
      const label = component.label || component.name;
      const lines = label.split(/\\n|\n/);
      const ry = 12;
      return `
            <g transform="translate(${x}, ${y})" filter="url(#comp-shadow)">
                <!-- Cylinder body -->
                <rect x="0" y="${ry}" width="${width}" height="${height - ry * 2}" fill="${this.theme.colors.databaseFill}" fill-opacity="0.35" stroke="none" />
                <!-- Side lines -->
                <line x1="0" y1="${ry}" x2="0" y2="${height - ry}" stroke="${this.theme.colors.packageStroke}" stroke-width="1.5" />
                <line x1="${width}" y1="${ry}" x2="${width}" y2="${height - ry}" stroke="${this.theme.colors.packageStroke}" stroke-width="1.5" />
                <!-- Bottom ellipse -->
                <ellipse cx="${width / 2}" cy="${height - ry}" rx="${width / 2}" ry="${ry}" fill="${this.theme.colors.databaseFill}" fill-opacity="0.35" stroke="${this.theme.colors.packageStroke}" stroke-width="1.5" />
                <!-- Top ellipse (drawn last to overlay body) -->
                <ellipse cx="${width / 2}" cy="${ry}" rx="${width / 2}" ry="${ry}" fill="${this.theme.colors.databaseFill}" stroke="${this.theme.colors.packageStroke}" stroke-width="1.5" />
                ${label ? `<text x="${width / 2}" y="${ry + 20}" text-anchor="middle" font-weight="600" fill="${this.theme.colors.text}" font-family="${this.theme.fontFamily}" font-size="${this.theme.fontSize}">
                    ${lines.map((line, i) => `<tspan x="${width / 2}" dy="${i === 0 ? 0 : "1.2em"}">${formatRichText(line)}</tspan>`).join("")}
                </text>` : ""}
            </g>
        `;
    }
    renderRelationship(rel, diagram) {
      const { path, relationship } = rel;
      if (path.length < 2) return "";
      const start = path[0];
      const end = path[path.length - 1];
      const strokeDash = relationship.type === "dashed" ? "6,4" : relationship.type === "dotted" ? "2,3" : "none";
      let markerEnd = "";
      if (relationship.showArrowHead !== false) {
        markerEnd = relationship.type === "dashed" ? "url(#comp-arrow-open)" : "url(#comp-arrow-end)";
      }
      let d = `M ${start.x} ${start.y}`;
      if (path.length === 2) {
        d += ` L ${end.x} ${end.y}`;
      } else if (path.length === 3) {
        d += ` Q ${path[1].x} ${path[1].y} ${end.x} ${end.y}`;
      } else if (path.length === 4) {
        d += ` C ${path[1].x} ${path[1].y} ${path[2].x} ${path[2].y} ${end.x} ${end.y}`;
      } else {
        for (let i = 1; i < path.length; i++) {
          d += ` L ${path[i].x} ${path[i].y}`;
        }
      }
      let labelSvg = "";
      if (rel.labelPosition && relationship.label) {
        labelSvg = `
                <rect x="${rel.labelPosition.x - relationship.label.length * 3.5 - 4}" y="${rel.labelPosition.y - 10}" width="${relationship.label.length * 7 + 8}" height="16" fill="white" fill-opacity="0.85" rx="3" />
                <text x="${rel.labelPosition.x}" y="${rel.labelPosition.y}" text-anchor="middle" dominant-baseline="middle" fill="${this.theme.colors.textLight}" font-family="${this.theme.fontFamily}" font-size="11" font-style="italic">
                    ${formatRichText(relationship.label)}
                </text>
            `;
      }
      return `
            <g>
                <path d="${d}" fill="none" stroke="${this.theme.colors.line}" stroke-width="1.3" stroke-dasharray="${strokeDash}" marker-end="${markerEnd}"/>
                ${labelSvg}
            </g>
        `;
    }
    renderNote(noteNode) {
      const { x, y, width, height, note } = noteNode;
      const fold = 12;
      return `
            <g transform="translate(${x}, ${y})">
                <path d="M0,0 L${width - fold},0 L${width},${fold} L${width},${height} L0,${height} Z" fill="${this.theme.colors.noteFill}" stroke="${this.theme.colors.noteStroke}" stroke-width="1" />
                <path d="M${width - fold},0 L${width - fold},${fold} L${width},${fold}" fill="none" stroke="${this.theme.colors.noteStroke}" stroke-width="1" />
                <text x="10" y="18" fill="${this.theme.colors.text}" font-family="${this.theme.fontFamily}" font-size="${this.theme.fontSize - 1}">
                    ${note.text.split("\n").map((line, i) => `<tspan x="10" dy="${i === 0 ? 0 : "1.3em"}">${formatRichText(line)}</tspan>`).join("")}
                </text>
            </g>
        `;
    }
    renderPort(node, diagram, layoutResult) {
      const { x, y, width, height, component } = node;
      const fill = this.theme.colors.line;
      let labelSvg = "";
      if (component.parentId) {
        const parent = layoutResult.components.find((c) => c.component.name === component.parentId);
        if (parent) {
          const cx = x + width / 2;
          const cy = y + height / 2;
          const pcx = parent.x + parent.width / 2;
          const pcy = parent.y + parent.height / 2;
          const dx = cx - pcx;
          const dy = cy - pcy;
          let tx = 0, ty = 0;
          let anchor = "middle";
          let baseline = "middle";
          const padding = 10;
          if (Math.abs(dx) >= Math.abs(dy)) {
            if (dx > 0) {
              tx = x + width + padding / 2;
              ty = cy;
              anchor = "start";
            } else {
              tx = x - padding / 2;
              ty = cy;
              anchor = "end";
            }
          } else {
            if (dy > 0) {
              tx = cx;
              ty = y + height + padding;
              baseline = "hanging";
            } else {
              tx = cx;
              ty = y - padding / 2;
              baseline = "auto";
            }
          }
          const label = component.label || component.name;
          labelSvg = `<text x="${tx}" y="${ty}" text-anchor="${anchor}" dominant-baseline="${baseline}" fill="${this.theme.colors.text}" font-family="${this.theme.fontFamily}" font-size="${this.theme.fontSize - 2}">${formatRichText(label)}</text>`;
        }
      }
      return `
            <g>
                <rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${this.theme.colors.defaultFill}" stroke="${this.theme.colors.defaultStroke}" stroke-width="1" />
                ${labelSvg}
            </g>
        `;
    }
    normalizeColor(color, defaultColor) {
      if (!color) return defaultColor;
      return color;
    }
  };

  // src/index.ts
  function renderSequenceDiagram(content) {
    const parser = new SequenceParser();
    const renderer = new SequenceRenderer();
    try {
      const diagram = parser.parse(content);
      return renderer.render(diagram);
    } catch (e) {
      return renderError(e);
    }
  }
  function renderComponentDiagram(content) {
    const parser = new ComponentParser();
    const renderer = new ComponentRenderer();
    try {
      const diagram = parser.parse(content);
      return renderer.render(diagram);
    } catch (e) {
      return renderError(e);
    }
  }
  function renderError(e) {
    const errorMsg = e.message || "Unknown error occurred during parsing";
    const escapedError = errorMsg.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const width = 800;
    const height = 100;
    return `
        <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" style="background: white; font-family: sans-serif;">
            <rect width="100%" height="100%" fill="#ffeeee" stroke="#ff0000" stroke-width="2" />
            <text x="20" y="50" fill="#ff0000" font-size="16" font-weight="bold">${escapedError}</text>
        </svg>
    `.trim();
  }
  function render(content) {
    const hasSequenceKeywords = /\b(participant|actor|boundary|control|entity|collections|queue)\b/.test(content);
    const hasComponentKeywords = /\b(component|interface|package|node|cloud|database|frame|folder)\b/.test(content);
    const hasComponentBrackets = /^\s*\[[^\]\r\n]+\]/m.test(content);
    const isComponent = hasComponentKeywords || hasComponentBrackets;
    const isSequence = hasSequenceKeywords;
    if (isSequence && !isComponent) return renderSequenceDiagram(content);
    if (isComponent && !isSequence) return renderComponentDiagram(content);
    if (/\b(alt|else|loop|group|note|opt|par|break|critical|ref)\b/.test(content)) {
      return renderSequenceDiagram(content);
    }
    if (hasComponentBrackets) return renderComponentDiagram(content);
    return renderSequenceDiagram(content);
  }
  function renderAll(selector = "pre.snapuml") {
    if (typeof document === "undefined") return;
    const blocks = document.querySelectorAll(selector);
    blocks.forEach((block) => {
      const content = block.textContent || "";
      const svg = render(content);
      const container = document.createElement("div");
      container.className = "snapuml-diagram";
      container.innerHTML = svg;
      container.style.display = "inline-block";
      block.parentNode?.replaceChild(container, block);
    });
  }
  function initialize(config = {}) {
    const { startOnLoad = true, selector = "pre.snapuml" } = config;
    if (!startOnLoad) return;
    if (typeof document === "undefined") return;
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => {
        renderAll(selector);
      });
    } else {
      renderAll(selector);
    }
  }
  if (typeof window !== "undefined") {
    window.snapuml = {
      renderSequenceDiagram,
      renderComponentDiagram,
      render,
      renderAll,
      initialize
    };
  }
  var index_default = {
    renderSequenceDiagram,
    renderComponentDiagram,
    render,
    renderAll,
    initialize
  };
  return __toCommonJS(index_exports);
})();
