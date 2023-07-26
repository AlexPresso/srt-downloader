# Subtitles Downloader

A NodeJS CLI app to download subtitles for every media files in a directory.
Subtitles are downloaded from [opensubtitles.com](https://opensubtitles.com).

## How it works

1. The app is looking for every media files and subtitles in directory and subdirectories.
2. For every detected media file, the app checks for missing subtitle languages
3. The missing subtitle languages are researched on opensubtitles
4. The subtitles are downloaded and placed next to the media files

## Prerequisites
- OpenSubtitles.com account
- OpenSubtitles.com consumer API key (you can create one [here](https://www.opensubtitles.com/fr/consumers))

## Usage
`npx subtitles-downloader -a <apiKey> -u <username> -p <password>`

| Flags | Required | Description                 | Default           |
|-------|----------|-----------------------------|-------------------|
| -a    | Yes      | OpenSubtitles ApiKey        | -                 |
| -u    | Yes      | OpenSubtitles username      | -                 |
| -p    | Yes      | OpenSubtitles password      | -                 |
| -d    | No       | Media files directory       | Current directory |
| -l    | No       | Languages (comma separated) | en                |
