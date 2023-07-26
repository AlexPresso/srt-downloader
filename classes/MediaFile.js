module.exports = class {
    constructor(name, directory, fps) {
        this.name = name;
        this.directory = directory;
        this.fps = fps
        this.subtitles = new Map();
    }
}