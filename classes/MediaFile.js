module.exports = class {
    constructor(name, directory) {
        this.name = name;
        this.directory = directory;
        this.subtitles = new Map();
    }
}