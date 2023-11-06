const colors = require('colors');
const prefix = '[srt-downloader]';

module.exports = class Logger {

    static info(message, noPrefix) {
        this.log(message, 'yellow', noPrefix);
    }

    static success(message) {
        this.log(message, 'green');
    }

    static error(message, error) {
        this.log(message, 'red', error !== undefined);

        if(error)
            console.log(error);
    }

    static debug(message) {
        this.log(message, 'white');
    }

    static log(message, color, noPrefix) {
        const pfx = noPrefix ? "" : `${prefix.bold} `;
        console.log(`${pfx}${color ? colors[color](message) : message}`);
    }
}
