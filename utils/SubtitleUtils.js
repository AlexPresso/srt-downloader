module.exports = class {
    static getSubtitleInfos(subtitle, mediaFile) {
        let cleanedName = subtitle.name.replace(mediaFile.name, '');
        cleanedName = cleanedName.replace(/[^\w ]/g, '');

        return {
            language: cleanedName
        }
    }

    static getBestSubtitlesToDownload(subtitles, mediaFile) {
        const bestSubtitles = new Map();

        for(const subtitle of subtitles) {
            if(mediaFile.subtitles.has(subtitle.attributes.language))
                continue;

            const prevScore = bestSubtitles.has(subtitle.attributes.language) ?
                bestSubtitles.get(subtitle.attributes.language).score :
                -Infinity;
            const uploadDate = Date.parse(subtitle.attributes.upload_date);

            subtitle.score = subtitle.attributes.votes +
                subtitle.attributes.new_download_count +
                uploadDate;

            if(subtitle.score > prevScore)
                bestSubtitles.set(subtitle.attributes.language, subtitle);
        }

        return bestSubtitles.values();
    }
}