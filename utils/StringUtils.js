const path = require('path');

module.exports = class {
    static removeExtension(name) {
        return path.parse(name).name;
    }
}