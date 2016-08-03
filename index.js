'use strict';

const EventEmitter = require('events');

/**
 * Parse given XML input and emit events corresponding
 * to the different tokens encountered
 *
 * @param {string} input XML input
 */
const parse = function (input) {
    let position = 0;

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
                attributes: '',
                isSelfClosing
            });
        } else if (whitespace === 0) {
            this.emit('error', new Error('Tag names may not start with whitespace'));
            break;
        } else {
            this.emit('tagopen', {
                name: input.slice(position, position + whitespace),
                attributes: input.slice(position + whitespace, realTagClose),
                isSelfClosing
            });
        }

        position = tagClose + 1;
    }

    this.emit('end');
};

const proto = {...EventEmitter.prototype, parse};
const Saxophone = () => {
    return Object.create(proto);
};

module.exports = Saxophone;
