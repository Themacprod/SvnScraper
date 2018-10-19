const _ = require('lodash');
const promiseSpawn = require('child-process-promise');
const logger = require('./logger');

const getSvnBaseCmd = function () {
    let svnCmd = '';
    svnCmd += `--username ${process.env.SS_SVN_READ_USER} `;
    svnCmd += `--password ${process.env.SS_SVN_READ_PASS} `;
    svnCmd += '--non-interactive ';
    return svnCmd;
};

Array.prototype.contains = function (obj) {
    return this.indexOf(obj) > -1;
};

const isValidFile = function (file) {
    return ['cpp', 'c', 'h', 'inl'].contains(file);
};

const getCommitRange = function (range) {
    let svnCmd = '';

    svnCmd += `svn log -r ${range.max}:${range.min} `;
    svnCmd += getSvnBaseCmd();
    svnCmd += ` ${process.env.SS_SVN_BASE_REPO}`;
    svnCmd += ' -q';

    return new Promise((resolve, reject) => {
        promiseSpawn.exec(svnCmd)
            .then((result) => {
                const commitsRaw = _.filter(result.stdout.split(/\r?\n/), line => line.indexOf('r') !== -1);

                const tmp = _.map(commitsRaw, (rawLine) => {
                    const regexpResult = (/r[0-9]+/).exec(rawLine);

                    if (regexpResult) {
                        return regexpResult[0].substring(1);
                    }

                    return null;
                });

                resolve(tmp);
            })
            .catch((err) => {
                logger.error(`getCommitRange err : ${err}`);
                reject(err);
            });
    });
};

const processArray = function (array, fn) {
    const results = [];
    return array.reduce((p, item) => {
        return p.then(() => {
            return fn(item).then((data) => {
                results.push(data);
                return results;
            });
        });
    }, Promise.resolve());
};

module.exports.getCommits = function getCommits(minRev, maxRev, callback) {
    if (typeof minRev !== 'number') {
        logger.error('Min revision should be a number!');
        return;
    }

    if (typeof maxRev !== 'number') {
        logger.error('Max revision should be a number!');
        return;
    }

    const diff = maxRev - minRev;

    if (diff !== 0) {
        const increment = 800;
        const commitRanges = [];

        for (let min = minRev; min < maxRev; min += increment) {
            let max = min + increment;

            if ((min + increment) > maxRev) {
                max = maxRev;
            }

            commitRanges.push({
                min: min,
                max: max
            });

            min += 1;
        }

        processArray(commitRanges, getCommitRange)
            .then((result) => {
                callback(_.flattenDeep(result));
            }, (reason) => {
                logger.error(`getCommits reason : ${reason}`);
                callback(reason);
            })
            .catch((err) => {
                logger.error(`getCommits err : ${err}`);
            });
    } else {
        logger.log('No commit to update');
        callback([]);
    }
};


module.exports.getHead = function getHead(callback) {
    let svnCmd = 'svn info';
    svnCmd += ` ${process.env.SS_SVN_BASE_REPO}`;
    const RevStr = 'Last Changed Rev: ';

    promiseSpawn.exec(`${svnCmd} | grep '${RevStr}'`)
        .then((result) => {
            callback(result.stdout.replace(RevStr, '').split(/\r?\n/));
        })
        .catch((err) => {
            logger.error(`svn info err : ${err}`);
            callback(null);
        });
};

module.exports.getFilterTree = function getFilterTree(branch, revision) {
    let branchFixed = branch.replace('//', '/');

    if (branchFixed.charAt(0) === '/') {
        branchFixed = branchFixed.substr(1);
    }

    if (branchFixed.charAt(branchFixed.length - 1) === '/') {
        branchFixed = branchFixed.substring(0, branchFixed.length - 1);
    }

    let svnCmd = '';
    svnCmd += 'svn list';
    svnCmd += ` "${process.env.SS_SVN_BASE_REPO}/${branchFixed}/ExternalDeviceLayer@${revision}" `;
    svnCmd += getSvnBaseCmd();
    svnCmd += '--depth infinity';

    return new Promise((resolve) => {
        promiseSpawn.exec(svnCmd)
            .then((result) => {
                const files = _.compact(result.stdout.split(/\r?\n/));

                const filterTree = _.filter(files, (file) => {
                    const tmp = file.substring(file.length - 4);
                    const ext = tmp.split('.');
                    return isValidFile(ext[1]);
                });

                resolve(filterTree);
            })
            .catch((err) => {
                logger.error(`getFilterTree err : ${err}`);
                resolve(null);
            });
    });
};

// AppLayer
// Base
// BuildMachine
// buildruntime
// Common
// DeviceLayer
// Documentation
// DriverWindows
// ExternalDeviceLayer
// Firmware
// HwRegisters
// LiberatusLayer
// OglInterface
// OsUtil
// Tests
// Tools
// XmslLib
const isBaseFolder = function isBaseFolder(line) {
    const splitWords = line.split('/');
    const keywords = [
        'AppLayer',
        'Base',
        'BuildMachine',
        'buildruntime',
        'Common',
        'DeviceLayer',
        'Documentation',
        'DriverWindows',
        'ExternalDeviceLayer',
        'Firmware',
        'HwRegisters',
        'LiberatusLayer',
        'OglInterface',
        'OsUtil',
        'Tests',
        'Tools',
        'XmslLib',
    ];

    for (let wordsIdx = 0; wordsIdx < splitWords.length; wordsIdx += 1) {
        for (let keywordsIdx = 0; keywordsIdx < keywords.length; keywordsIdx += 1) {
            if (splitWords[wordsIdx] === keywords[keywordsIdx]) {
                return keywords[keywordsIdx];
            }
        }
    }

    return null;
};

module.exports.getBranchPath = function getBranchPath(revision) {
    let svnCmd = '';
    svnCmd += `svn log -r ${revision}:0 --limit 1 `;
    svnCmd += getSvnBaseCmd();
    svnCmd += ` ${process.env.SS_SVN_BASE_REPO}`;
    svnCmd += ' --verbose';

    return new Promise((resolve) => {
        promiseSpawn.exec(svnCmd)
            .then((result) => {
                const tmp = _.find(result.stdout.split(/\r?\n/), (line) => {
                    let startStr = '';

                    startStr = '   M /Mediaprocessor/SV2/';
                    if (line.indexOf(startStr) !== -1) {
                        const lineStr = line.substr(startStr.length);
                        return isBaseFolder(lineStr);
                    }

                    startStr = '   D /Mediaprocessor/SV2/';
                    if (line.indexOf(startStr) !== -1) {
                        const lineStr = line.substr(startStr.length);
                        return isBaseFolder(lineStr);
                    }

                    startStr = '   A /Mediaprocessor/SV2/';
                    if (line.indexOf(startStr) !== -1) {
                        const lineStr = line.substr(startStr.length);
                        return isBaseFolder(lineStr);
                    }

                    return false;
                });

                if (tmp) {
                    let startStr = '   M /Mediaprocessor/SV2/';
                    if (tmp.indexOf(startStr) !== -1) {
                        const lineStr = tmp.substr(startStr.length);
                        const folderFound = isBaseFolder(lineStr);

                        if (folderFound) {
                            resolve(lineStr.substr(0, lineStr.indexOf(folderFound)));
                        }

                        resolve(null);
                    }

                    startStr = '   D /Mediaprocessor/SV2/';
                    if (tmp.indexOf(startStr) !== -1) {
                        const lineStr = tmp.substr(startStr.length);
                        const folderFound = isBaseFolder(lineStr);

                        if (folderFound) {
                            resolve(lineStr.substr(0, lineStr.indexOf(folderFound)));
                        }

                        resolve(null);
                    }

                    startStr = '   A /Mediaprocessor/SV2/';
                    if (tmp.indexOf(startStr) !== -1) {
                        const lineStr = tmp.substr(startStr.length);
                        const folderFound = isBaseFolder(lineStr);

                        if (folderFound) {
                            resolve(lineStr.substr(0, lineStr.indexOf(folderFound)));
                        }

                        resolve(null);
                    }

                    resolve(null);
                } else {
                    resolve(null);
                }
            })
            .catch((err) => {
                logger.error(`getBranchPath err : ${err}`);
                resolve(null);
            });
    });
};
