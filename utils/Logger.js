const colors = require('colors');
const prefix = '[SubDownloader]';

module.exports = class Logger {

    static info(message) {
        this.log(message, 'yellow');
    }

    static success(message) {
        this.log(message, 'green');
    }

    static error(message) {
        this.log(message, 'red');
    }

    static debug(message) {
        this.log(message, 'white');
    }

    static log(message, color) {
        console.log(`${prefix.bold} ${color ? colors[color](message) : message}`);
    }
}