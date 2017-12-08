const stream = require('stream');
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

class Saxophone extends stream.Writable {
    constructor() {
        super();
        this.position = 0;
        this.hasEnded = false;
        this.lastInput = '';
        this.stalled = null;
    }

    stall(mode, input) {
        this.stalled = mode;
        this.lastInput = input;
    }

    write(input, isLast = false) {
        let localPosition = 0;
        if (this.stalled != null) {
            input = this.lastInput + input;
            this.lastInput = '';
            this.stalled = false;
        }

        const end = input.length;
        while (localPosition < end) {
            if (input[localPosition] !== '<') {
                const nextTag = input.indexOf('<', localPosition);

                // if we reached the end, emit a last "text" node and break
                if (nextTag === -1) {
                    /**
                     * Text token event
                     *
                     * @event Saxophone#text
                     * @type {object}
                     * @prop {string} contents The text value
                     */
                    if (isLast) {
                        this.emit('text', { contents: input.slice(localPosition) });
                    } else {
                        this.stall('TEXT', input.slice(localPosition));
                    }
                    break;
                }

                // otherwise, emit a "text" node and continue
                this.emit('text', { contents: input.slice(localPosition, nextTag) });
                localPosition = nextTag;
            }

            localPosition += 1;
            const nextChar = input[localPosition];

            // begins a DOCTYPE, CDATA or comment section
            if (nextChar === '!') {
                localPosition += 1;
                const nextNextChar = input[localPosition];

                if (
                    nextNextChar === '[' &&
                    input.slice(localPosition + 1, localPosition + 7) === 'CDATA['
                ) {
                    localPosition += 7;
                    const cdataClose = input.indexOf(']]>', localPosition);

                    if (cdataClose === -1) {
                        this.stall('CDATA', input.slice(localPosition - 9));
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
                    this.emit('cdata', {
                        contents: input.slice(localPosition, cdataClose)
                    });
                    localPosition = cdataClose + 3;
                    continue;
                }

                if (nextNextChar === '-' && input[localPosition + 1] === '-') {
                    localPosition += 2;
                    const commentClose = input.indexOf('--', localPosition);

                    if (commentClose === -1) {
                        this.stall('COMMENT', input.slice(localPosition - 4));
                        break;
                    }

                    if (input[commentClose + 2] !== '>') {
                        /**
                         * Error event
                         *
                         * @event Saxophone#error
                         * @type {Error}
                         */
                        this.emit(
                            'error',
                            new Error('Unexpected -- inside comment')
                        );
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
                    this.emit('comment', {
                        contents: input.slice(localPosition, commentClose)
                    });
                    localPosition = commentClose + 3;
                    continue;
                }

                // TODO: recognize DOCTYPEs here
                this.emit(
                    'error',
                    new Error('Unrecognized sequence: <!' + nextNextChar)
                );
                break;
            }

            if (nextChar === '?') {
                localPosition += 1;
                const piClose = input.indexOf('?>', localPosition);

                if (piClose === -1) {
                    this.stall('PROCESSINGINSTRUCTION', input.slice(localPosition - 2));
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
                this.emit('processinginstruction', {
                    contents: input.slice(localPosition, piClose)
                });
                localPosition = piClose + 2;
                continue;
            }

            // recognize regular tags (< ... >)
            const tagClose = input.indexOf('>', localPosition);

            if (tagClose === -1) {
                this.stall('TAGOPEN', input.slice(localPosition - 1));
                break;
            }

            // check if the tag is a closing tag
            if (input[localPosition] === '/') {
                /**
                 * Closing tag token event
                 * (</tag>)
                 *
                 * @event Saxophone#tagclose
                 * @type {object}
                 * @prop {string} name The tag name
                 */
                this.emit('tagclose', {
                    name: input.slice(localPosition + 1, tagClose)
                });
                localPosition = tagClose + 1;
                continue;
            }

            // check if the tag is self-closing
            const isSelfClosing = input[tagClose - 1] === '/';
            let realTagClose = isSelfClosing ? tagClose - 1 : tagClose;

            // extract the tag name and attributes
            const whitespace = input.slice(localPosition).search(/\s/);

            if (whitespace === -1 || whitespace >= tagClose - localPosition) {
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
                    name: input.slice(localPosition, realTagClose),
                    attrs: '',
                    isSelfClosing
                });
            } else if (whitespace === 0) {
                this.emit(
                    'error',
                    new Error('Tag names may not start with whitespace')
                );
                break;
            } else {
                this.emit('tagopen', {
                    name: input.slice(localPosition, localPosition + whitespace),
                    attrs: input.slice(localPosition + whitespace, realTagClose),
                    isSelfClosing
                });
            }

            localPosition = tagClose + 1;
        }
        return this;
    }

    end(input = '') {
        this.write(input, true);
        switch (this.stalled) {
        case 'TAGOPEN':
            this.emit('error', new Error('Unclosed tag'));
            break;
        case 'COMMENT':
            this.emit('error', new Error('Unclosed comment'));
            break;
        case 'PROCESSINGINSTRUCTION':
            this.emit('error', new Error('Unclosed processing instruction'));
            break;
        case 'CDATA':
            this.emit('error', new Error('Unclosed CDATA section'));
            break;
        default:
            // pass
        }
        this.emit('end');
        return this;
    }

    parse(input) {
        this.write(input);
        this.end();
        return this;
    }
}

module.exports = Saxophone;
