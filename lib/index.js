// export the factory before importing the submodules
// for circular dependencies
module.exports = require('./prototype/parse');

module.exports.parseAttrs = require('./static/attrs');
