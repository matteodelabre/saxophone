const {isWhitespace} = require('../util');

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
        // Skip all whitespace
        if (isWhitespace(input[position])) {
            position += 1;
            continue;
        }

        // Check that the attribute name contains valid chars
        const startName = position;

        while (input[position] !== '=' && position < end) {
            if (isWhitespace(input[position])) {
                throw new Error('Attribute names may not contain whitespace');
            }

            position += 1;
        }

        // This is XML, so we need a value for the attribute
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

module.exports = parseAttrs;
