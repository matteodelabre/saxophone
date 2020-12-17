/**
 * Check if a character is a whitespace character according
 * to the XML spec (space, carriage return, line feed or tab)
 *
 * @param {string} character Character to check
 * @return {bool} Whether the character is whitespace or not
 */
const isWhitespace = character => character === ' ' ||
    character === '\r' || character === '\n' || character === '\t';

exports.isWhitespace = isWhitespace;

/**
 * Find the first character in a string that matches a predicate
 * while being outside the given delimiters.
 *
 * @param {string} haystack String to search in
 * @param {function} predicate Checks whether a character is permissible
 * @param {string} [delim=''] Delimiter inside which no match should be
 * returned. If empty, all characters are considered.
 * @param {string} [fromIndex=0] Start the search from this index
 * @return {number} Index of the first match, or -1 if no match
 */
const findIndexOutside = (haystack, predicate, delim = '', fromIndex = 0) => {
    const length = haystack.length;
    let index = fromIndex;
    let inDelim = false;

    while (index < length && (inDelim || !predicate(haystack[index]))) {
        if (haystack[index] === delim) {
            inDelim = !inDelim;
        }

        ++index;
    }

    return index === length ? -1 : index;
};

exports.findIndexOutside = findIndexOutside;
