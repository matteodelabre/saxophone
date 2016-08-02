'use strict';

const stampit = require('stampit');
const EventEmitter = require('events').EventEmitter;

const Saxophone = stampit().refs({
    input: ''
}).methods({
    ...EventEmitter.prototype,

    parse() {
        const {input} = this;
        let position = 0;

        // recognize a section delimited by `start` and `end`
        // immediatly after the current position in `input`,
        // reporting an error if it is never closed and
        // returning false if the section is not there
        const recognizeDelims = (start, end, type) => {
            // check if the start sequence is next
            if (input.indexOf(start, position) !== position) {
                return false;
            }

            // consume up to the end sequence
            position += start.length;
            const closing = input.indexOf(end, position);

            if (closing === -1) {
                this.emit('error', new Error(`Unclosed ${type}`));
                position = input.length;
                return false;
            }

            const contents = input.slice(position, closing);
            position = closing + end.length;

            return contents;
        };

        while (position < input.length) {
            let contents;

            // recognize comments (<!-- ... -->)
            if ((contents = recognizeDelims('<!--', '-->', 'comment')) !== false) {
                this.emit('comment', {contents});
                continue;
            }

            // recognize DOCTYPEs (<!DOCTYPE ...>)
            if ((contents = recognizeDelims('<!DOCTYPE', '>', 'DOCTYPE')) !== false) {
                this.emit('doctype', {contents});
                continue;
            }

            // recognize CDATAs (<![CDATA[ ... ]]>)
            if ((contents = recognizeDelims('<![CDATA[', ']]>', 'CDATA section')) !== false) {
                this.emit('cdata', {contents});
                continue;
            }

            // recognize processing instructions (<? ... ?>)
            if ((contents = recognizeDelims('<?', '?>', 'processing instruction')) !== false) {
                this.emit('processinginstruction', {contents});
                continue;
            }

            // recognize tags (< ... >)
            if ((contents = recognizeDelims('<', '>', 'tag')) !== false) {
                // check if the tag is a closing tag
                if (contents[0] === '/') {
                    this.emit('tagclose', {name: contents.slice(1)});
                    continue;
                }

                // check if the tag is self-closing
                const isSelfClosing = contents[contents.length - 1] === '/';

                if (isSelfClosing) {
                    contents = contents.slice(0, -1);
                }

                // extract the tag name
                let name = contents, attributes = '';
                const whitespace = contents.search(/\s/);

                if (whitespace > -1) {
                    name = contents.slice(0, whitespace);
                    attributes = contents.slice(whitespace);
                }

                this.emit('tagopen', {name, attributes, isSelfClosing});
                continue;
            }

            // if we are here, the following bytes are not starting a
            // tag-like element. Jump right to the next tag start & emit
            // a text node
            let nextTagStart = input.indexOf('<', position);

            if (nextTagStart === -1) {
                nextTagStart = input.length;
            }

            this.emit('text', {contents: input.slice(position, nextTagStart)});
            position = nextTagStart;
        }

        this.emit('end');
    }
});

module.exports = Saxophone;
