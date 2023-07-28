const SubtitlesJS = require('subtitles.js');
const downloadFile = require('async-get-file');
const Logger = require('../utils/Logger');
const MediaFile = require('./MediaFile');
const Subtitle = require('./Subtitle');
const SubtitleUtils = require('../utils/SubtitleUtils');

const fs = require('fs');
const mediaInfo = require('mediainfo-wrapper');

module.exports = class {
    constructor(options) {
        this.options = options;
        this.os = new SubtitlesJS({
            apiKey: options.apiKey
        });
    }

    async run() {
        const mediaFiles = new Map(); //Map<name, MediaFile>
        const orphanSubFiles = [];

        await this.login();

        Logger.debug("Fetching media files...");
        await this.fetchMediaFiles(this.options.directory, mediaFiles, orphanSubFiles);
        Logger.debug("Fetching existing subtitles...");
        await this.fetchOrphanSubtitles(mediaFiles, orphanSubFiles);
        Logger.info(`Downloading subtitles for: ${this.options.languages}...`);
        await this.downloadMissingSubtitles(mediaFiles);
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
        const files = fs.readdirSync(dir);
        for(const f of files) {
            const fullpath = `${dir}/${f}`;

            if(fs.statSync(fullpath).isDirectory()) {
                await this.fetchMediaFiles(fullpath, mediaFiles, orphanSubFiles);
            } else {
                let infos = {};
                try {
                    [infos] = await mediaInfo(fullpath);
                } catch(_) {}

                if(infos.video) {
                    mediaFiles.set(infos.general.file_name[0], new MediaFile(
                        infos.general.file_name[0],
                        infos.general.folder_name[0],
                        infos.video[0].frame_rate[0]
                    ));
                } else if (infos.text && infos.general.file_extension[0] === 'srt') {
                    let found = false;
                    const subtitle = new Subtitle(
                        infos.general.file_name[0],
                        infos.general.folder_name[0]
                    );

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
        for(const [name, media] of mediaFiles) {
            const { data } = await this.os.subtitles().search({
                query: name,
                languages: this.options.languages
            });

            const bestSubtitles = SubtitleUtils.getBestSubtitlesToDownload(data, media);
            for(const subtitle of bestSubtitles) {
                const subName = `${media.name}.${subtitle.attributes.language}`;
                const fileId = subtitle.attributes.files.reduce((prev, curr) => {
                    return prev.cd_number > curr.cd_number
                }).file_id;


                const { link } = await this.os.download().download(
                    fileId,
                    this.token,
                    {
                        file_name: subName
                    }
                );

                await downloadFile(link, {
                    directory: media.directory
                });

                Logger.debug(`Downloaded ${subName} subtitle`);
            }
        }
    }
}