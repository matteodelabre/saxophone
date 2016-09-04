/**
 * @module Jour
 */

/**
 * Create a new Saxophone object, ready
 * to parse XML data
 *
 * @return {Saxophone} A Saxophone object
 */
const Saxophone = () => {
    return Object.create(saxophonePrototype);
};

// export the factory before importing the submodules
// for circular dependencies
module.exports = Saxophone;

// load the prototype from the submodules
const saxophonePrototype = Object.assign(
    {},
    require('events').prototype,
    require('./prototype/parse')
);

// load the static properties and methods
require('./static/attrs')(Saxophone);
require('./static/entities')(Saxophone);
