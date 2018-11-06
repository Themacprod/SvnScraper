const database = require('./database');
const svnData = require('./svnData');
const _ = require('lodash');
const mongodb = require('mongodb');
const co = require('co');
const logger = require('./logger');

const getLatestCommit = function () {
    return new Promise((resolve, reject) => {
        database.commits
            .find({})
            .sort({ value: -1 })
            .limit(1)
            .toArray((err, docs) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(docs);
                }
            });
    });
};

const getSvnHeadPromise = function () {
    return new Promise((resolve) => {
        svnData.getHead((headCommit) => {
            resolve(Number(headCommit[0]));
        });
    });
};

const getCommitPromise = function getCommitPromise(lastCommitStored, headCommit) {
    if (typeof lastCommitStored !== 'number') {
        logger.error('lastCommitStored revision should be a number!');
        return;
    }

    if (typeof headCommit !== 'number') {
        logger.error('headCommit revision should be a number!');
        return;
    }

    return new Promise((resolve) => {
        svnData.getCommits(
            lastCommitStored,
            headCommit,
            function (commitList) {
                resolve(commitList);
            }
        );
    });
};

const findBranch = function findBranch(branch) {
    return new Promise((resolve, reject) => {
        database.branches.findOne({
            value: branch
        }, (err, docs) => {
            if (err) {
                reject(err);
            } else {
                resolve(docs);
            }
        });
    });
};

const findTree = function findTree(tree) {
    return new Promise((resolve, reject) => {
        database.trees.findOne({
            value: tree
        }, (err, docs) => {
            if (err) {
                reject(err);
            } else {
                resolve(docs);
            }
        });
    });
};

module.exports.findTree = findTree;

const AddBranch = function AddBranch(branch) {
    database.branches.insertOne({
        _id: branch._id,
        value: branch.value
    }, (err) => {
        if (err) {
            console.error(err);
        } else {
            logger.log(`Added new branch [${branch.value}] in the database`);
        }
    });
};

const AddTree = function AddTree(tree) {
    database.trees.insertOne({
        _id: tree.id,
        value: tree.value
    }, (err) => {
        if (err) {
            console.error(err);
        } else {
            logger.log('Added new tree in the database');
        }
    });
};

const AddCommit = function AddCommit(commit) {
    database.commits.insertOne({
        value: commit.value,
        branch: commit.branch,
        tree: commit.tree
    }, (err) => {
        if (err) {
            console.error(err);
        } else {
            logger.log(`Added commit ${commit.value} in the database`);
        }
    });
};

const PromiseSleep = function PromiseSleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
};

const insertInFullList = function insertInFullList(revisions) {
    database.full.insertOne({
        list: revisions
    }, (err) => {
        if (err) {
            logger.log(err);
        } else {
            logger.log('Added new commit in full list');
        }
    });
};

const addToFullList = function addToFullList(revisions) {
    return new Promise((resolve, reject) => {
        database.full
            .find({})
            .limit(1)
            .toArray((err, docs) => {
                if (err) {
                    reject(err);
                } else {
                    database.full.updateOne({
                        _id: docs[0]._id
                    }, {
                        $push: {
                            list: { $each: revisions }
                        }
                    }, (err2) => {
                        if (err2) {
                            logger.error(err2);
                            reject(err2);
                        } else {
                            logger.log('Collection full : Added new revisions');
                            resolve();
                        }
                    });
                }
            });
    });
};

const getHeadDb = function getHeadDb() {
    return new Promise((resolve, reject) => {
        database.full
            .find({})
            .toArray((err, docs) => {
                if (err) {
                    console.error(err);
                    reject(err);
                }
                if (docs.length > 0) {
                    resolve(_.max(docs[0].list));
                } else {
                    resolve(null);
                }
            });
    });
};

function* updateDbRawFullList() {
    // Get the max revision stored in the DB.
    const headDbTmp = yield getHeadDb();

    let headDb = 0;
    if (headDbTmp) {
        headDb = Number(headDbTmp);
    } else {
        logger.log(`No maximum stored in the database, use ${process.env.SVN_START_COMMIT} as first commit`);
        headDb = Number(process.env.SVN_START_COMMIT);
    }

    // Get the mex revision in the svn server.
    const headSvn = yield getSvnHeadPromise();

    const diff = headSvn - headDb;

    if (diff > 0) {
        logger.log(`SVN Head revision : ${headSvn}`);
        logger.log(`DB Head revision : ${headDb}`);
        logger.log(`Number of commit to update = ${diff}`);
        logger.log(`Getting commit list between [${headSvn} and ${headDb}] ... `);

        const commitList = yield getCommitPromise(headDb, headSvn);

        // Get current list stored in the DB.
        if (headDbTmp) {
            yield addToFullList(commitList);
        } else {
            yield insertInFullList(commitList);
        }
    } else {
        logger.log('Collection full : List is up to date');
    }
}

const getRawFullList = function getRawFullList() {
    return new Promise((resolve, reject) => {
        database.full
            .find({})
            .limit(1)
            .toArray((err, docs) => {
                if (err) {
                    reject(err);
                }

                if (docs.length > 0) {
                    resolve(docs[0].list);
                } else {
                    resolve(null);
                }
            });
    });
};

const getCommit = function getCommit(commit) {
    return new Promise((resolve) => {
        database.commits.findOne({
            value: commit
        }, (err, doc) => {
            if (err) {
                resolve(null);
            } else {
                resolve(doc);
            }
        });
    });
};

module.exports.getCommit = getCommit;

const getTree = function getTree(treeId) {
    return new Promise((resolve) => {
        database.trees.findOne({
            _id: treeId
        }, (err, doc) => {
            if (err) {
                resolve(null);
            } else {
                resolve(doc);
            }
        });
    });
};

module.exports.getTree = getTree;

const getBranch = function getBranch(branchId) {
    return new Promise((resolve) => {
        database.branches.findOne({
            _id: branchId
        }, (err, doc) => {
            if (err) {
                resolve(null);
            } else {
                resolve(doc);
            }
        });
    });
};

module.exports.getBranch = getBranch;

function* AddRevision(revision) {
    //
    // Branch
    //
    let branchId = null;
    const branchPath = yield svnData.getBranchPath(revision);
    let treeId = null;
    if (branchPath) {
        const branchFound = yield findBranch(branchPath);

        if (branchFound) {
            // logger.log(`Collection branches : Branch [${branchPath}] already exist in DB.`);
            branchId = branchFound._id;
        } else {
            branchId = new mongodb.ObjectID();

            const branch = {
                _id: branchId,
                value: branchPath
            };

            AddBranch(branch);
        }

        //
        // Retrieve the filter tree list (filter because it contain only code files).
        //
        const filterTree = yield svnData.getFilterTree(branchPath, revision);
        let treeFound = null;

        if (filterTree) {
            treeFound = yield findTree(filterTree);
        }

        if (treeFound) {
            // logger.log(`Collection trees : Tree for revision ${revision} already exist in DB.`);
            treeId = treeFound._id;
        } else {
            treeId = new mongodb.ObjectID();

            const tree = {
                id: treeId,
                value: filterTree
            };

            AddTree(tree);
        }
    } else {
        logger.log(`Collection branches : Can't find branch for revision ${revision}.`);
    }

    //
    // Commit
    //
    const commit = {
        value: revision,
        branch: branchId,
        tree: treeId
    };

    AddCommit(commit);
}

function* SanityCheck() {
    logger.log('Run sanity check ...');

    const fullCommitList = yield getRawFullList();
    let noEntryCount = 0;
    let EntryCount = 0;

    for (let i = 0; i < fullCommitList.length; i += 1) {
        const commitEntry = yield getCommit(Number(fullCommitList[i]));

        if (commitEntry) {
            EntryCount += 1;
        } else {
            noEntryCount += 1;

            logger.log(`No entry found for commit ${fullCommitList[i]}`);
            yield AddRevision(Number(fullCommitList[i]));
            // logger.log(`Collection commits : Wait 500ms before next request ...`);
            yield PromiseSleep(250);
        }
    }

    if (noEntryCount > 0) {
        logger.log(`No entry for ${noEntryCount} commit(s) vs ${EntryCount} commits`);
    }

    logger.log('Sanity check done');
}

const updateASync = co.wrap(function* updateASync() {
    //
    // Keep the list of all the commit to save time.
    //
    yield updateDbRawFullList();

    const fullCommitList = yield getRawFullList();

    //
    // Check what need to be updated.
    //
    const ret = yield getLatestCommit();

    let dbHead = Number(process.env.SVN_START_COMMIT);

    if (ret.length !== 0) {
        dbHead = Number(ret[0].value);
    } else {
        logger.log(`Collection commits : No commit stored, used default min : ${dbHead}`);
    }

    const commitList = _.filter(fullCommitList, (commit) => {
        return Number(commit) > dbHead;
    });

    if (commitList.length > 0) {
        logger.log(`Collection commits : Need to update ${commitList.length} commit(s)`);
    }

    for (let i = 0; i < commitList.length; i += 1) {
        yield AddRevision(Number(commitList[i]));
        // logger.log(`Collection commits : Wait 500ms before next request ...`);
        yield PromiseSleep(250);
    }

    logger.log('Commits are up to date');

    yield SanityCheck();
});

module.exports.update = function update() {
    updateASync();
};
