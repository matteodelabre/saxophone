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
 * Parse a XML stream and emit events corresponding
 * to the different tokens encountered
 *
 * @memberof Saxophone#
 * @param {string} input XML input
 * @emits Saxophone#error
 * @emits Saxophone#text
 * @emits Saxophone#cdata
 * @emits Saxophone#comment
 * @emits Saxophone#processinginstruction
 * @emits Saxophone#tagopen
 * @emits Saxophone#tagclose
 * @emits Saxophone#end
 */
const parse = function (input) {
    const end = input.length;
    let position = 0;

    while (position < end) {
        // ensure the next char is opening a tag
        if (input[position] !== '<') {
            const nextTag = input.indexOf('<', position);

            // if we reached the end, emit a last "text" node and break
            if (nextTag === -1) {
                /**
                 * Text token event
                 *
                 * @event Saxophone#text
                 * @type {object}
                 * @prop {string} contents The text value
                 */
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

            if (nextNextChar === '[' && input.slice(position + 1, position + 7) === 'CDATA[') {
                position += 7;
                const cdataClose = input.indexOf(']]>', position);

                if (cdataClose === -1) {
                    /**
                     * Error event
                     *
                     * @event Saxophone#error
                     * @type {Error}
                     */
                    this.emit('error', new Error('Unclosed CDATA section'));
                    break;
                }

                /**
                 * CDATA token event
                 * (<![CDATA[ ... ]]>)
                 *
                 * @event Saxophone#cdata
                 * @type {object}
                 * @prop {string} contents The CDATA contents
                 */
                this.emit('cdata', {contents: input.slice(position, cdataClose)});
                position = cdataClose + 3;
                continue;
            }

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

                /**
                 * Comment token event
                 * (<!-- ... -->)
                 *
                 * @event Saxophone#comment
                 * @type {object}
                 * @prop {string} contents The comment contents
                 */
                this.emit('comment', {contents: input.slice(position, commentClose)});
                position = commentClose + 3;
                continue;
            }

            // TODO: recognize DOCTYPEs here
            this.emit('error', new Error('Unrecognized sequence: <!' + nextNextChar));
            break;
        }

        if (nextChar === '?') {
            position += 1;
            const piClose = input.indexOf('?>', position);

            if (piClose === -1) {
                this.emit('error', new Error('Unclosed processing instruction'));
                break;
            }

            /**
             * Processing instruction token event
             * (<? ... ?>)
             *
             * @event Saxophone#processinginstruction
             * @type {object}
             * @prop {string} contents The instruction contents
             */
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
            /**
             * Closing tag token event
             * (</tag>)
             *
             * @event Saxophone#tagclose
             * @type {object}
             * @prop {string} name The tag name
             */
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
            /**
             * Opening tag token event
             * (<tag attr="value">)
             *
             * @event Saxophone#tagopen
             * @type {object}
             * @prop {string} name The tag name
             * @prop {string} attrs The tag attributes
             * (use Saxophone.parseAttributes) to parse the string to a hash
             * @prop {bool} isSelfClosing Whether the tag is self-closing (<tag />)
             */
            this.emit('tagopen', {
                name: input.slice(position, realTagClose),
                attrs: '',
                isSelfClosing
            });
        } else if (whitespace === 0) {
            this.emit('error', new Error('Tag names may not start with whitespace'));
            break;
        } else {
            this.emit('tagopen', {
                name: input.slice(position, position + whitespace),
                attrs: input.slice(position + whitespace, realTagClose),
                isSelfClosing
            });
        }

        position = tagClose + 1;
    }

    /**
     * End of stream event
     *
     * @event Saxophone#end
     */
    this.emit('end');
};

/**
 * Parse a string of XML attributes to a map of attribute names
 * to their values
 *
 * @memberof Saxophone
 * @param {string} input A string of XML attributes
 * @throws {Error} If the string is malformed
 * @return {Object} A map of attribute names to their values
 */
const parseAttrs = input => {
    const attrs = {}, end = input.length;
    let position = 0;

    while (position < end) {
        // skip all whitespace
        if (isWhitespace(input[position])) {
            position += 1;
            continue;
        }

        // check that the attribute name contains valid chars
        const startName = position;

        while (input[position] !== '=' && position < end) {
            if (isWhitespace(input[position])) {
                throw new Error('Attribute names may not contain whitespace');
            }

            position += 1;
        }

        // this is XML so we need a value for the attribute
        if (position === end) {
            throw new Error('Expected a value for the attribute');
        }

        const attrName = input.slice(startName, position);
        position += 1;
        const startQuote = input[position];
        position += 1;

        if (startQuote !== '"' && startQuote !== "'") {
            throw new Error('Attribute values should be quoted');
        }

        const endQuote = input.indexOf(startQuote, position);

        if (endQuote === -1) {
            throw new Error('Unclosed attribute value');
        }

        const attrValue = input.slice(position, endQuote);

        attrs[attrName] = attrValue;
        position = endQuote + 1;
    }

    return attrs;
};

const proto = {...EventEmitter.prototype, parse};
const Saxophone = () => {
    return Object.create(proto);
};

Saxophone.parseAttrs = parseAttrs;
module.exports = Saxophone;
