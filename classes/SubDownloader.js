const SubtitlesJS = require('subtitles.js');
const downloadFile = require('async-get-file');
const Logger = require('../utils/Logger');
const MediaFile = require('./MediaFile');
const Subtitle = require('./Subtitle');
const SubtitleUtils = require('../utils/SubtitleUtils');
const StringUtils = require('../utils/StringUtils');

const fs = require('fs');
const ffprobe = require('node-ffprobe');

module.exports = class {
    constructor(options) {
        this.options = options;
        this.os = new SubtitlesJS({
            apiKey: options.apiKey,
            appName: "github.com/AlexPresso/srt-downloader",
            appVersion: "1.0.0"
        });
    }

    async run() {
        const mediaFiles = new Map(); //Map<name, MediaFile>
        const orphanSubFiles = [];

        await this.login();

        Logger.debug("Fetching media files...");
        await this.fetchMediaFiles(this.options.directory, mediaFiles, orphanSubFiles);
        Logger.debug(`Found ${mediaFiles.size} media files.`);
        Logger.debug("Fetching existing subtitles...");
        await this.fetchOrphanSubtitles(mediaFiles, orphanSubFiles);
        Logger.info(`Downloading subtitles for: ${this.options.languages}...`);
        await this.downloadMissingSubtitles(mediaFiles);
        Logger.success("Done.");
    }

    async login() {
        Logger.info("Logging on OpenSubtitles...");

        const { token } = await this.os.auth().login({
            username: this.options.username,
            password: this.options.password
        });

        if(!token) {
            Logger.error("Cannot login on OpenSubtitles, please check apiKey, username and password");
            process.exit(1);
        }

        this.token = token;

        Logger.success("Logged in !");
    }

    async fetchMediaFiles(dir, mediaFiles, orphanSubFiles) {
        let i = 0;
        const files = fs.readdirSync(dir, {recursive: true, withFileTypes: true})
            .filter(e => e.isFile());

        for(const e of files) {
            Logger.debug(`Probing ${e.name} (${++i}/${files.length}) ...`);

            const fullpath = `${e.path}/${e.name}`;
            const name = StringUtils.removeExtension(e.name);

            const infos = await ffprobe(fullpath);
            if(infos.error) {
                Logger.error(`An error occurred while probing ${e.name}.`);
                console.error(infos.error);
                continue;
            }

            if(infos.chapters.length > 0 || infos.streams.length >= 2) {
                mediaFiles.set(name, new MediaFile(name, e.path));
            } else if (infos.format.format_name === "srt") {
                let found = false;
                const subtitle = new Subtitle(name, e.path);

                for(const [k, v] of mediaFiles) {
                    if(!subtitle.name.includes(k))
                        continue;

                    found = true;
                    const subInfos = SubtitleUtils.getSubtitleInfos(subtitle, v);
                    v.subtitles.set(subInfos.language, subtitle);
                }

                if(!found)
                    orphanSubFiles.push(subtitle);
            }
        }
    }

    async fetchOrphanSubtitles(mediaFiles, orphanSubtitles) {
        for(const [k, v] of mediaFiles) {
            for(const subtitle of orphanSubtitles) {
                if(!subtitle.name.includes(k))
                    continue;

                const infos = SubtitleUtils.getSubtitleInfos(subtitle, v);
                v.subtitles.set(infos.language, subtitle);
            }
        }
    }

    async downloadMissingSubtitles(mediaFiles) {
        let i = 0;
        for(const [name, media] of mediaFiles) {
            Logger.debug(`Updating subtitles of ${name}... (${++i}/${mediaFiles.size})`)

            const { data } = await this.os.subtitles().search({
                query: name,
                languages: this.options.languages
            }).catch(console.error);

            const bestSubtitles = SubtitleUtils.getBestSubtitlesToDownload(data, media);
            for(const subtitle of bestSubtitles) {
                const subName = `${media.name}.${subtitle.attributes.language}`;
                const fileId = subtitle.attributes.files.reduce((prev, curr) => {
                    return prev.cd_number > curr.cd_number
                }).file_id;


                const { link } = await this.os.download().download(fileId, this.token, {file_name: subName});

                await downloadFile(link, {
                    directory: media.directory,
                    filename: `${subName}.srt`
                }).catch(console.error);

                Logger.debug(`Downloaded ${subName} subtitle`);
            }
        }
    }
}
