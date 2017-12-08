/**
 * Expand a piece of XML text by replacing all XML entities
 * by their canonical value. Ignore invalid and unknown
 * entities
 *
 * @memberof Saxophone
 * @param {string} input A string of XML text
 * @return {string} The input string, expanded
 */
const parseEntities = input => {
    let position = 0, next = 0;
    const parts = [];

    while ((next = input.indexOf('&', position)) !== -1) {
        // remember anything there was before the entity
        if (next > position) {
            parts.push(input.slice(position, next));
        }

        const end = input.indexOf(';', next);

        // ignore unterminated entities
        if (end === -1) {
            break;
        }

        const entity = input.slice(next, end);

        if (entity === '&quot') {
            parts.push('"');
        } else if (entity === '&amp') {
            parts.push('&');
        } else if (entity === '&apos') {
            parts.push("'");
        } else if (entity === '&lt') {
            parts.push('<');
        } else if (entity === '&gt') {
            parts.push('>');
        } else {
            // ignore unrecognized character entities
            if (entity[1] !== '#') {
                parts.push(entity + ';');
            } else {
                // hexadecimal numeric entities
                if (entity[2] == 'x') {
                    const value = parseInt(entity.slice(3), 16);

                    // ignore non-numeric numeric entities
                    if (isNaN(value)) {
                        parts.push(entity + ';');
                    } else {
                        parts.push(String.fromCharCode(value));
                    }
                } else {
                    // decimal numeric entities
                    const value = parseInt(entity.slice(2), 10);

                    // ignore non-numeric numeric entities
                    if (isNaN(value)) {
                        parts.push(entity + ';');
                    } else {
                        parts.push(String.fromCharCode(value));
                    }
                }
            }
        }

        position = end + 1;
    }

    if (position < input.length) {
        parts.push(input.slice(position));
    }

    return parts.join('');
};

module.exports = parseEntities;
