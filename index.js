'use strict';

const EventEmitter = require('events');

/**
 * Check if a character is a whitespace character according
 * to the XML spec (space, carriage return, line feed or tab)
 *
 * @param {string} character Character to check
 * @return {bool} Whether the character is whitespace or not
 */
const isWhitespace = character => character === ' ' ||
    character === '\r' || character === '\n' || character === '\t';

/**
 * Parse given XML input and emit events corresponding
 * to the different tokens encountered
 *
 * @param {string} input XML input
 */
const parse = function (input) {
    let position = 0;
    const parseAttrs = parseAttributes.bind(this);

    while (position < input.length) {
        // ensure the next char is opening a tag
        if (input[position] !== '<') {
            const nextTag = input.indexOf('<', position);

            // if we reached the end, emit a last "text" node and break
            if (nextTag === -1) {
                this.emit('text', {contents: input.slice(position)});
                break;
            }

            // otherwise, emit a "text" node and continue
            this.emit('text', {contents: input.slice(position, nextTag)});
            position = nextTag;
        }

        position += 1;
        const nextChar = input[position];

        // begins a DOCTYPE, CDATA or comment section
        if (nextChar === '!') {
            position += 1;
            const nextNextChar = input[position];

            // recognize CDATA sections (<![CDATA[ ... ]]>)
            if (nextNextChar === '[' && input.slice(position + 1, position + 7) === 'CDATA[') {
                position += 7;
                const cdataClose = input.indexOf(']]>', position);

                if (cdataClose === -1) {
                    this.emit('error', new Error('Unclosed CDATA section'));
                    break;
                }

                // emit a "cdata" node with the section contents
                this.emit('cdata', {contents: input.slice(position, cdataClose)});
                position = cdataClose + 3;
                continue;
            }

            // recognize comments (<!-- ... -->)
            if (nextNextChar === '-' && input[position + 1] === '-') {
                position += 2;
                const commentClose = input.indexOf('--', position);

                if (commentClose === -1) {
                    this.emit('error', new Error('Unclosed comment'));
                    break;
                }

                if (input[commentClose + 2] !== '>') {
                    this.emit('error', new Error('Unexpected -- inside comment'));
                    break;
                }

                // emit a "comment" node with the comment contents
                this.emit('comment', {contents: input.slice(position, commentClose)});
                position = commentClose + 3;
                continue;
            }

            // TODO: recognize DOCTYPEs here
            this.emit('error', new Error('Unrecognized sequence: <!' + nextNextChar));
            break;
        }

        // recognize processing instructions (<? ... ?>)
        if (nextChar === '?') {
            position += 1;
            const piClose = input.indexOf('?>', position);

            if (piClose === -1) {
                this.emit('error', new Error('Unclosed processing instruction'));
                break;
            }

            // emit a "processinginstruction" node with its contents
            this.emit('processinginstruction', {contents: input.slice(position, piClose)});
            position = piClose + 2;
            continue;
        }

        // recognize regular tags (< ... >)
        const tagClose = input.indexOf('>', position);

        if (tagClose === -1) {
            this.emit('error', new Error('Unclosed tag'));
            break;
        }

        // check if the tag is a closing tag
        if (input[position] === '/') {
            this.emit('tagclose', {name: input.slice(position + 1, tagClose)});
            position = tagClose + 1;
            continue;
        }

        // check if the tag is self-closing
        const isSelfClosing = input[tagClose - 1] === '/';
        let realTagClose = isSelfClosing ? tagClose - 1 : tagClose;

        // extract the tag name and attributes
        const whitespace = input.slice(position).search(/\s/);

        if (whitespace === -1 || whitespace >= tagClose - position) {
            this.emit('tagopen', {
                name: input.slice(position, realTagClose),
                attributes: {},
                isSelfClosing
            });
        } else if (whitespace === 0) {
            this.emit('error', new Error('Tag names may not start with whitespace'));
            break;
        } else {
            this.emit('tagopen', {
                name: input.slice(position, position + whitespace),
                attributes: parseAttrs(input, position + whitespace, realTagClose),
                isSelfClosing
            });
        }

        position = tagClose + 1;
    }

    this.emit('end');
};

/**
 * Parse XML attributes
 */
const parseAttributes = function (input, position, end) {
    const attributes = {};

    while (position < end) {
        // skip all whitespace
        if (isWhitespace(input[position])) {
            position += 1;
            continue;
        }

        // check that the attribute name contains valid chars
        const startName = position;
        let hasError = false;

        while (input[position] !== '=' && position < end) {
            if (isWhitespace(input[position])) {
                this.emit('error', new Error('Attribute names may not contain whitespace'));
                hasError = true;
                break;
            }

            position += 1;
        }

        // this is XML so we need a value for the attribute
        if (position === end) {
            this.emit('error', new Error('Expected a value for the attribute'));
            break;
        }

        if (hasError) {
            break;
        }

        const attrName = input.slice(startName, position);
        position += 1;
        const startQuote = input[position];
        position += 1;

        if (startQuote !== '"' && startQuote !== "'") {
            this.emit('error', new Error('Attribute values should be quoted'));
            break;
        }

        const endQuote = input.indexOf(startQuote, position);

        if (endQuote === -1) {
            this.emit('error', new Error('Unclosed attribute value'));
            break;
        }

        const attrValue = input.slice(position, endQuote);

        attributes[attrName] = attrValue;
        position = endQuote + 1;
    }

    return attributes;
};

const proto = {...EventEmitter.prototype, parse};
const Saxophone = () => {
    return Object.create(proto);
};

module.exports = Saxophone;
