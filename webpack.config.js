const path = require('path');

module.exports = {
    entry: [path.join(__dirname, 'lib/index.js')],

    output: {
        path: path.join(__dirname, 'dist'),
        library: 'Jour',
        libraryTarget: 'umd',
        filename: 'index.js'
    },

    target: 'node',

    module: {
        loaders: [{
            test: /\.js$/,
            include: path.join(__dirname, 'lib'),
            loader: 'babel',
        }]
    }
};
