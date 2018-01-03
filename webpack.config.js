const path = require('path');

module.exports = {
    entry: [path.join(__dirname, 'lib/index.js')],

    output: {
        path: path.join(__dirname, 'dist'),
        library: 'Saxophone',
        libraryTarget: 'umd',
        filename: 'index.js'
    },

    target: 'node',

    module: {
        rules: [{
            test: /\.js$/,
            include: path.join(__dirname, 'lib'),
            use: {loader: 'babel-loader'}
        }]
    }
};
