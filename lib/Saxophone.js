const {Writable} = require('readable-stream');
const {StringDecoder} = require('string_decoder');

const TOKENS = {
    TEXT: 'text',
    CDATA: 'cdata',
    COMMENT: 'comment',
    PROCESSINGINSTRUCTION: 'processinginstruction',
    TAGOPEN: 'tagopen',
    TAGCLOSE: 'tagclose'
};

/**
 * Parse a XML stream and emit events corresponding
 * to the different tokens encountered.
 *
 * @extends stream.Writable
 *
 * @emits stream.Writable#finish
 * @emits stream.Writable#error
 *
 * @emits Saxophone#text
 * @emits Saxophone#cdata
 * @emits Saxophone#comment
 * @emits Saxophone#processinginstruction
 * @emits Saxophone#tagopen
 * @emits Saxophone#tagclose
 */
class Saxophone extends Writable {
    /**
     * Create a new parser instance.
     */
    constructor() {
        super({decodeStrings: false});

        // String decoder instance
        const state = this._writableState;
        this._decoder = new StringDecoder(state.defaultEncoding);

        // Not stalled initially
        this._stall(null);
    }

    /**
     * Put the stream in stalled mode, which means we need more data
     * to finish parsing the current token.
     *
     * @private
     * @param token Type of token that is being parsed. If null, unstalls
     * the stream and returns any pending data.
     * @param pending Pending data.
     * @return Pending data if the stream has been unstalled.
     */
    _stall(token, pending) {
        if (token === null) {
            const data = this._pending || '';

            this._stalled = null;
            this._pending = '';

            return data;
        }

        this._stalled = token;
        this._pending = pending;
    }

    /**
     * Parse a XML chunk.
     *
     * @private
     * @param {string} input A string with the chunk data.
     * @param {function} callback Called when the chunk has been parsed, with
     * an optional error argument.
     */
    _parseChunk(input, callback) {
        // Restore "stalled" state and prepend pending data
        input = this._stall(null) + input;

        let chunkPos = 0;
        const end = input.length;

        while (chunkPos < end) {
            if (input[chunkPos] !== '<') {
                const nextTag = input.indexOf('<', chunkPos);

                // We read a TEXT node but there might be some
                // more text data left, so we stall
                if (nextTag === -1) {
                    this._stall(
                        TOKENS.TEXT,
                        input.slice(chunkPos)
                    );
                    break;
                }

                // A tag follows, so we can be confident that
                // we have all the data needed for the TEXT node

                /**
                 * Text token event
                 *
                 * @event Saxophone#text
                 * @type {object}
                 * @prop {string} contents The text value
                 */
                this.emit(
                    TOKENS.TEXT,
                    {contents: input.slice(chunkPos, nextTag)}
                );

                chunkPos = nextTag;
            }

            // Invariant: the cursor now points on the name of a tag,
            // after an opening angled bracket
            chunkPos += 1;
            const nextChar = input[chunkPos];

            // Begin a DOCTYPE, CDATA or comment section
            if (nextChar === '!') {
                chunkPos += 1;
                const nextNextChar = input[chunkPos];

                if (
                    nextNextChar === '[' &&
                    input.slice(chunkPos + 1, chunkPos + 7) === 'CDATA['
                ) {
                    chunkPos += 7;
                    const cdataClose = input.indexOf(']]>', chunkPos);

                    // Unclosed CDATA section, we need to wait for
                    // upcoming data
                    if (cdataClose === -1) {
                        this._stall(
                            TOKENS.CDATA,
                            input.slice(chunkPos - 9)
                        );
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
                    this.emit(
                        TOKENS.CDATA,
                        {contents: input.slice(chunkPos, cdataClose)}
                    );

                    chunkPos = cdataClose + 3;
                    continue;
                }

                if (nextNextChar === '-' && input[chunkPos + 1] === '-') {
                    chunkPos += 2;
                    const commentClose = input.indexOf('--', chunkPos);

                    // Unclosed comment node, we need to wait for
                    // upcoming data
                    if (commentClose === -1) {
                        this._stall(
                            TOKENS.COMMENT,
                            input.slice(chunkPos - 4)
                        );
                        break;
                    }

                    if (input[commentClose + 2] !== '>') {
                        callback(new Error('Unexpected -- inside comment'));
                        return;
                    }

                    /**
                     * Comment token event
                     * (<!-- ... -->)
                     *
                     * @event Saxophone#comment
                     * @type {object}
                     * @prop {string} contents The comment contents
                     */
                    this.emit(
                        TOKENS.COMMENT,
                        {contents: input.slice(chunkPos, commentClose)}
                    );

                    chunkPos = commentClose + 3;
                    continue;
                }

                // TODO: recognize DOCTYPEs here
                callback(new Error('Unrecognized sequence: <!' + nextNextChar));
                return;
            }

            if (nextChar === '?') {
                chunkPos += 1;
                const piClose = input.indexOf('?>', chunkPos);

                // Unclosed processing instruction, we need to
                // wait for upcoming data
                if (piClose === -1) {
                    this._stall(
                        TOKENS.PROCESSINGINSTRUCTION,
                        input.slice(chunkPos - 2)
                    );
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
                this.emit(
                    TOKENS.PROCESSINGINSTRUCTION,
                    {contents: input.slice(chunkPos, piClose)}
                );

                chunkPos = piClose + 2;
                continue;
            }

            // Recognize regular tags (< ... >)
            const tagClose = input.indexOf('>', chunkPos);

            if (tagClose === -1) {
                this._stall(
                    TOKENS.TAGOPEN,
                    input.slice(chunkPos - 1)
                );
                break;
            }

            // Check if the tag is a closing tag
            if (input[chunkPos] === '/') {
                /**
                 * Closing tag token event
                 * (</tag>)
                 *
                 * @event Saxophone#tagclose
                 * @type {object}
                 * @prop {string} name The tag name
                 */
                this.emit(
                    TOKENS.TAGCLOSE,
                    {name: input.slice(chunkPos + 1, tagClose)}
                );

                chunkPos = tagClose + 1;
                continue;
            }

            // Check if the tag is self-closing
            const isSelfClosing = input[tagClose - 1] === '/';
            let realTagClose = isSelfClosing ? tagClose - 1 : tagClose;

            // Extract the tag name and attributes
            const whitespace = input.slice(chunkPos).search(/\s/);

            if (whitespace === -1 || whitespace >= tagClose - chunkPos) {
                // Tag without any attribute

                /**
                 * Opening tag token event
                 * (<tag attr="value">)
                 *
                 * @event Saxophone#tagopen
                 * @type {object}
                 * @prop {string} name The tag name
                 * @prop {string} attrs The tag attributes (use
                 * Saxophone.parseAttributes) to parse the string to a hash
                 * @prop {bool} isSelfClosing Whether the tag is self-closing
                 * (<tag />)
                 */
                this.emit(TOKENS.TAGOPEN, {
                    name: input.slice(chunkPos, realTagClose),
                    attrs: '',
                    isSelfClosing
                });
            } else if (whitespace === 0) {
                callback(new Error('Tag names may not start with whitespace'));
                return;
            } else {
                // Tag with attributes
                this.emit(TOKENS.TAGOPEN, {
                    name: input.slice(chunkPos, chunkPos + whitespace),
                    attrs: input.slice(chunkPos + whitespace, realTagClose),
                    isSelfClosing
                });
            }

            chunkPos = tagClose + 1;
        }

        callback();
    }

    /**
     * Handle a chunk of data written into the stream.
     *
     * @private
     * @param {Buffer|string} chunk Chunk of data.
     * @param {string} encoding Encoding of the string, or 'buffer'.
     * @param {function} callback Called when the chunk has been parsed, with
     * an optional error argument.
     */
    _write(chunk, encoding, callback) {
        const data = encoding === 'buffer'
            ? this._decoder.write(chunk)
            : chunk;

        this._parseChunk(data, callback);
    }

    /**
     * Handle the end of incoming data.
     *
     * @private
     * @param {function} callback
     */
    _final(callback) {
        // Make sure all data has been extracted from the decoder
        this._parseChunk(this._decoder.end(), err => {
            if (err) {
                callback(err);
                return;
            }

            // Handle unclosed nodes
            switch (this._stalled) {
            case TOKENS.TEXT:
                // Text nodes are implicitly closed
                this.emit(
                    'text',
                    {contents: this._stall(null)}
                );
                break;
            case TOKENS.CDATA:
                callback(new Error('Unclosed CDATA section'));
                return;
            case TOKENS.COMMENT:
                callback(new Error('Unclosed comment'));
                return;
            case TOKENS.PROCESSINGINSTRUCTION:
                callback(new Error('Unclosed processing instruction'));
                return;
            case TOKENS.TAGOPEN:
            case TOKENS.TAGCLOSE:
                // We do not distinguish between unclosed opening
                // or unclosed closing tags
                callback(new Error('Unclosed tag'));
                return;
            default:
                // Pass
            }

            callback();
        });
    }

    /**
     * Immediately parse a complete chunk of XML and close the stream.
     *
     * @param {Buffer|string} input Input chunk.
     * @return {Saxophone} This instance.
     */
    parse(input) {
        this.end(input);
        return this;
    }
}

module.exports = Saxophone;
