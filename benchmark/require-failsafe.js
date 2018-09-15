'use strict';

module.exports = () => {
    let notFound = [];

    return {
        /**
         * Require a module. If the module is not found, do not
         * throw but remember that it is missing. Use #commit()
         * to show all missing modules
         *
         * @param {string} module Module path
         * @return {*} Module, if found
         */
        require: module => {
            try {
                return require(module);
            } catch (err) {
                if (err.code === 'MODULE_NOT_FOUND') {
                    notFound.push(module);
                } else {
                    throw err;
                }
            }
        },

        /**
         * Ensure all required modules using #require()
         * were found, or show an error message and terminate
         */
        commit: () => {
            if (notFound.length) {
                console.error(
                    '/!\\ To run benchmarks, please install the following '
                    + 'missing modules:\n    npm install --no-save '
                    + notFound.join(' ')
                );
                process.exit();
            }
        }
    };
};
