const SubtitlesJS = require('subtitles.js');
const downloadFile = require('async-get-file');
const Logger = require('../utils/Logger');
const MediaFile = require('./MediaFile');
const Subtitle = require('./Subtitle');
const SubtitleUtils = require('../utils/SubtitleUtils');
const StringUtils = require('../utils/StringUtils');

const fs = require('fs');
const ffprobe = require('node-ffprobe');
const consoleSeparator = "————————————————————————————————————————";
const blackList = [
    '.txt',
    '.nfo',
    '.jpg',
    '.png',
    '.vsmeta',
    'SYNOVIDEO',
    'SYNOINDEX'
]

module.exports = class {
    constructor(options) {
        this.options = options;
        this.stats = {
            present: new Map(),
            downloaded: new Map(),
            errors: new Map()
        }

        this.os = new SubtitlesJS({
            apiKey: options.apiKey,
            appName: "github.com/AlexPresso/srt-downloader",
            appVersion: "1.0.0"
        });
    }

    async run() {
        const mediaFiles = new Map(); //Map<name, MediaFile>
        const orphanSubFiles = [];

        this.initStatistics();

        await this.login();

        Logger.debug("Fetching media files...");
        await this.fetchMediaFiles(this.options.directory, mediaFiles, orphanSubFiles);
        Logger.debug(`Found ${mediaFiles.size} media file(s).`);
        Logger.debug("Fetching existing subtitles...");
        await this.fetchOrphanSubtitles(mediaFiles, orphanSubFiles);
        Logger.info(`Downloading subtitles for: ${this.options.languages}...`);
        await this.downloadMissingSubtitles(mediaFiles);

        Logger.success("Done.");

        console.log("\n" + consoleSeparator);
        Logger.info(`Nb of fetched media file(s): ${mediaFiles.size}`, true);
        for(const [l, c] of this.stats.downloaded) {
            Logger.info(`Nb of downloaded SRT for lang ${l}: ${c} (existing: ${this.stats.present.get(l)})`, true);
        }

        if(this.stats.errors.size > 0) {
            console.log(consoleSeparator);
            Logger.info(`Error summary (${this.stats.errors.size} error(s)):`, true);
            for(const [f, e] of this.stats.errors) {
                Logger.error(`--  ${f}`, e);
            }
        }

        console.log(consoleSeparator + "\n");
    }

    initStatistics() {
        this.options.languages.split(',').forEach(l => {
            this.stats.downloaded.set(l, 0);
            this.stats.present.set(l, 0);
        });
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
            .filter(e => e.isFile() && !blackList.some(b => e.name.includes(b)));

        for(const e of files) {
            Logger.debug(`Probing ${e.name} (${++i}/${files.length}) ...`);

            const fullpath = `${e.path}/${e.name}`;
            const name = StringUtils.removeExtension(e.name);

            const infos = await ffprobe(fullpath);
            if(infos.error) {
                Logger.error(`An error occurred while probing ${e.name}, skipping.`);
                this.stats.errors.set(e.name, infos.error);
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

                    let count = this.stats.present.get(subInfos.language);
                    this.stats.present.set(subInfos.language, ++count);
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

                let count = this.stats.present.get(infos.language);
                this.stats.present.set(infos.language, ++count);
            }
        }
    }

    async downloadMissingSubtitles(mediaFiles) {
        let i = 0;
        for(const [name, media] of mediaFiles) {
            Logger.debug(`Updating subtitles of ${name}... (${++i}/${mediaFiles.size})`)

            try {
                const { data } = await this.os.subtitles().search({
                    query: name,
                    languages: this.options.languages
                });

                const bestSubtitles = SubtitleUtils.getBestSubtitlesToDownload(data, media);
                for(const subtitle of bestSubtitles) {
                    const subName = `${media.name}.${subtitle.attributes.language}`;
                    const fileId = subtitle.attributes.files
                        .reduce((prev, curr) => prev.cd_number > curr.cd_number)
                        .file_id;

                    const { link } = await this.os.download().download(fileId, this.token, {file_name: subName});
                    await downloadFile(link, {
                        directory: media.directory,
                        filename: `${subName}.srt`
                    });

                    let count = this.stats.downloaded.get(subtitle.attributes.language);
                    this.stats.downloaded.set(subtitle.attributes.language, ++count);

                    Logger.info(`Downloaded ${subName} subtitle`);
                }
            } catch (e) {
                Logger.error(`Error while downloading subtitle for ${name}`);
                this.stats.errors.set(name, e);
            }
        }
    }
}
