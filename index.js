#!/usr/bin/env node

const yargs = require('yargs');
const SubDownloader = require('./classes/SubDownloader');

const options = yargs
    .usage('$0 -u <username> -p <password> -a <apikey>')
    .option('d', {alias: "directory", describe: "videos directory path", type: "string", demandOption: false, default: process.cwd()})
    .option('l', {alias: "languages", describe: "languages (comma separated)", type: "string", demandOption: false, default: 'en'})
    .option('u', {alias: "username", describe: "OpenSubtitles.org username", type: "string", demandOption: true})
    .option('p', {alias: "password", describe: "OpenSubtitles.org password", type: "string", demandOptions: true})
    .option('a', {alias: "apiKey", describe: "OpenSubtitles.com APIKey", type: "string", demandOptions: true})
    .argv;

new SubDownloader(options)
    .run();
