const {Writable} = require('readable-stream');
const {StringDecoder} = require('string_decoder');

/**
 * Information about a text node.
 *
 * @typedef TextNode
 * @type {object}
 * @prop {string} contents The text value.
 */

/**
 * Emitted whenever a text node is encountered.
 *
 * @event Saxophone#text
 * @type {TextNode}
 */

/**
 * Information about a CDATA node
 * (<![CDATA[ ... ]]>).
 *
 * @typedef CDATANode
 * @type {object}
 * @prop {string} contents The CDATA contents.
 */

/**
 * Emitted whenever a CDATA node is encountered.
 *
 * @event Saxophone#cdata
 * @type {CDATANode}
 */

/**
 * Information about a comment node
 * (<!-- ... -->).
 *
 * @typedef CommentNode
 * @type {object}
 * @prop {string} contents The comment contents
 */

/**
 * Emitted whenever a comment node is encountered.
 *
 * @event Saxophone#comment
 * @type {CommentNode}
 */

/**
 * Information about a processing instruction node
 * (<? ... ?>).
 *
 * @typedef ProcessingInstructionNode
 * @type {object}
 * @prop {string} contents The instruction contents
 */

/**
 * Emitted whenever a processing instruction node is encountered.
 *
 * @event Saxophone#processinginstruction
 * @type {ProcessingInstructionNode}
 */

/**
 * Information about an opened tag
 * (<tag attr="value">).
 *
 * @typedef TagOpenNode
 * @type {object}
 * @prop {string} name Name of the tag that was opened.
 * @prop {string} attrs Attributes passed to the tag, in a string representation
 * (use Saxophone.parseAttributes to get an attribute-value mapping).
 * @prop {bool} isSelfClosing Whether the tag self-closes (tags of the form
 * `<tag />`). Such tags will not be followed by a closing tag.
 */

/**
 * Emitted whenever an opening tag node is encountered.
 *
 * @event Saxophone#tagopen
 * @type {TagOpen}
 */

/**
 * Information about a closed tag
 * (</tag>).
 *
 * @typedef TagCloseNode
 * @type {object}
 * @prop {string} name The tag name
 */

/**
 * Emitted whenever a closing tag node is encountered.
 *
 * @event Saxophone#tagclose
 * @type {TagCloseNode}
 */

/**
 * Nodes that can be found inside an XML stream.
 * @private
 */
const Node = {
    text: 'text',
    cdata: 'cdata',
    comment: 'comment',
    markupDeclaration: 'markupDeclaration',
    processingInstruction: 'processinginstruction',
    tagOpen: 'tagopen',
    tagClose: 'tagclose',
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

        // Stack of tags that were opened up until the current cursor position
        this._tagStack = [];

        // Not waiting initially
        this._waiting = null;
    }

    /**
     * Put the stream into waiting mode, which means we need more data
     * to finish parsing the current token.
     *
     * @private
     * @param token Type of token that is being parsed.
     * @param data Pending data.
     */
    _wait(token, data) {
        this._waiting = {token, data};
    }

    /**
     * Put the stream out of waiting mode.
     *
     * @private
     * @return Any data that was pending.
     */
    _unwait() {
        if (this._waiting === null) {
            return '';
        }

        const data = this._waiting.data;
        this._waiting = null;
        return data;
    }

    /**
     * Handle the opening of a tag in the text stream.
     *
     * Push the tag into the opened tag stack and emit the
     * corresponding event on the event emitter.
     *
     * @param {TagOpen} node Information about the opened tag.
     */
    _handleTagOpening(node) {
        if (!node.isSelfClosing) {
            this._tagStack.push(node.name);
        }

        this.emit(Node.tagOpen, node);
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
        // Use pending data if applicable and get out of waiting mode
        input = this._unwait() + input;

        let chunkPos = 0;
        const end = input.length;

        while (chunkPos < end) {
            if (input[chunkPos] !== '<') {
                const nextTag = input.indexOf('<', chunkPos);

                // We read a TEXT node but there might be some
                // more text data left, so we wait
                if (nextTag === -1) {
                    this._wait(
                        Node.text,
                        input.slice(chunkPos)
                    );
                    break;
                }

                // A tag follows, so we can be confident that
                // we have all the data needed for the TEXT node
                this.emit(
                    Node.text,
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

                // Unclosed markup declaration section of unknown type,
                // we need to wait for upcoming data
                if (nextNextChar === undefined) {
                    this._wait(
                        Node.markupDeclaration,
                        input.slice(chunkPos - 2)
                    );
                    break;
                }

                if (
                    nextNextChar === '[' &&
                    'CDATA['.indexOf(input.slice(chunkPos + 1, chunkPos + 7)) > -1
                ) {
                    chunkPos += 7;
                    const cdataClose = input.indexOf(']]>', chunkPos);

                    // Unclosed CDATA section, we need to wait for
                    // upcoming data
                    if (cdataClose === -1) {
                        this._wait(
                            Node.cdata,
                            input.slice(chunkPos - 9)
                        );
                        break;
                    }

                    this.emit(
                        Node.cdata,
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
                        this._wait(
                            Node.comment,
                            input.slice(chunkPos - 4)
                        );
                        break;
                    }

                    if (input[commentClose + 2] !== '>') {
                        callback(new Error('Unexpected -- inside comment'));
                        return;
                    }

                    this.emit(
                        Node.comment,
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
                    this._wait(
                        Node.processingInstruction,
                        input.slice(chunkPos - 2)
                    );
                    break;
                }

                this.emit(
                    Node.processingInstruction,
                    {contents: input.slice(chunkPos, piClose)}
                );

                chunkPos = piClose + 2;
                continue;
            }

            // Recognize regular tags (< ... >)
            const tagClose = input.indexOf('>', chunkPos);

            if (tagClose === -1) {
                this._wait(
                    Node.tagOpen,
                    input.slice(chunkPos - 1)
                );
                break;
            }

            // Check if the tag is a closing tag
            if (input[chunkPos] === '/') {
                const tagName = input.slice(chunkPos + 1, tagClose);
                const stackedTagName = this._tagStack.pop();

                if (stackedTagName !== tagName) {
                    callback(new Error(`Unclosed tag: ${stackedTagName}`));
                    this._tagStack.length = 0;
                    return;
                }

                this.emit(
                    Node.tagClose,
                    {name: tagName}
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
                this._handleTagOpening({
                    name: input.slice(chunkPos, realTagClose),
                    attrs: '',
                    isSelfClosing
                });
            } else if (whitespace === 0) {
                callback(new Error('Tag names may not start with whitespace'));
                return;
            } else {
                // Tag with attributes
                this._handleTagOpening({
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
            if (this._waiting !== null) {
                switch (this._waiting.tag) {
                case Node.text:
                    // Text nodes are implicitly closed
                    this.emit(
                        'text',
                        {contents: this._waiting.data}
                    );
                    break;
                case Node.cdata:
                    callback(new Error('Unclosed CDATA section'));
                    return;
                case Node.comment:
                    callback(new Error('Unclosed comment'));
                    return;
                case Node.processingInstruction:
                    callback(new Error('Unclosed processing instruction'));
                    return;
                case Node.tagOpen:
                case Node.tagClose:
                    // We do not distinguish between unclosed opening
                    // or unclosed closing tags
                    callback(new Error('Unclosed tag'));
                    return;
                default:
                    // Pass
                }
            }

            if (this._tagStack.length !== 0) {
                callback(new Error(
                    `Unclosed tags: ${this._tagStack.join(',')}`
                ));
                return;
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
