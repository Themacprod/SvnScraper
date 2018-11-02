var database = require("./database");
var svnData = require("./svnData");
var _ = require('lodash');
var ObjectID = require("mongodb").ObjectID;
const logger = require('./logger');

const getLatestCommit = function() {
    return new Promise(function (resolve, reject) {
        database.commits
            .find({
            })
            .sort({
                value: -1
            })
            .limit(1)
            .toArray(function(err, docs) {
                if (err) {
                    reject(err);
                } else {
                    resolve(docs);
                }
            });
        });
};

const getSvnHeadPromise = function() {
    return new Promise(function (resolve) {
        svnData.getHead( function(headCommit) {
            resolve(Number(headCommit[0]));
        });
    });
};

const getCommitPromise = function(lastCommitStored, headCommit) {
    if (typeof lastCommitStored !== 'number') {
        logger.error('lastCommitStored revision should be a number!');
        return;
    }

    if (typeof headCommit !== 'number') {
        logger.error('headCommit revision should be a number!');
        return;
    }

    return new Promise(function (resolve) {
        svnData.getCommits(
            lastCommitStored,
            headCommit,
            function(commitList) {
                resolve(commitList);
            }
        )
    })
};

const findBranch = function(branch) {
    return new Promise(function (resolve, reject) {
        database.branches.findOne({
            value: branch
        }, function(err, docs) {
            if (err) {
                reject(err);
            } else {
                resolve(docs);
            }
        });
    });
};

const findTree = function(tree) {
    return new Promise(function (resolve, reject) {
        database.trees.findOne({
            value: tree
        }, function(err, docs) {
            if (err) {
                reject(err);
            } else {
                resolve(docs);
            }
        });
    });
};

module.exports.findTree = findTree;

const AddBranch = function(branch) {
    database.branches.insertOne({
        _id: branch._id,
        value: branch.value,
    }, function(err) {
        if (err) {
            console.error(err);
        } else {
            logger.log(`Added new branch [${branch.value}] in the database`);
        }
    });
};

const AddTree = function(tree) {
    database.trees.insertOne({
        _id: tree._id,
        value: tree.value,
    }, function(err) {
        if (err) {
            console.error(err);
        } else {
            logger.log('Added new tree in the database');
        }
    });
};

const AddCommit = function(commit) {
    database.commits.insertOne({
        value: commit.value,
        branch: commit.branch,
        tree: commit.tree,
    }, function(err) {
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
    }, function(err) {
        if (err) {
            logger.log(err);
        } else {
            logger.log('Added new commit in full list');
        }
    });
};

const addToFullList = function addToFullList(revisions) {
    return new Promise(function (resolve, reject) {
        database.full
        .find({
        })
        .limit(1)
        .toArray(function(err, docs) {
            if (err) {
                reject(err);
            } else {
                database.full.updateOne({
                    _id: docs[0]._id
                }, {
                    $push: {
                        list: { $each: revisions}
                    }
                }, function(err2) {
                    if (err2) {
                        logger.error(err2);
                        reject(err2);
                    } else {
                        logger.log(`Collection full : Added new revisions`);
                        resolve();
                    }
                });
            }
        });
    });
};

async function updateDbRawFullList () {
    // Get the max revision stored in the DB.
    let headDbTmp = await getHeadDb();

    let headDb = 0;
    if (headDbTmp) {
        headDb = Number(headDbTmp);
    } else {
        logger.log(`No maximum stored in the database, use ${process.env.SVN_START_COMMIT} as first commit`);
        headDb = Number(process.env.SVN_START_COMMIT);
    }

    // Get the mex revision in the svn server.
    let headSvn = await getSvnHeadPromise();

    let diff = headSvn - headDb;

    if (diff > 0) {
        logger.log(`SVN Head revision : ${headSvn}`);
        logger.log(`DB Head revision : ${headDb}`);
        logger.log(`Number of commit to update = ${diff}`);
        logger.log(`Getting commit list between [${headSvn} and ${headDb}] ... `);

        let commitList = await getCommitPromise(headDb, headSvn);

        // Get current list stored in the DB.
        if (headDbTmp) {
            await addToFullList(commitList);
        } else {
            await insertInFullList(commitList);
        }
    } else {
        logger.log('Collection full : List is up to date');
    }
};

const getRawFullList = function getRawFullList() {
    return new Promise(function (resolve, reject) {
        database.full
        .find({
        })
        .limit(1)
        .toArray(function(err, docs) {
            if (err) {
                reject(err);
            } else {
                if (docs.length > 0) {
                    resolve(docs[0].list)
                } else {
                    resolve(null);
                }
            }
        });
    });
};

const getHeadDb = function getHeadDb() {
    return new Promise(function (resolve, reject) {
        database.full
            .find({
            })
            .toArray(function(err, docs) {
                if (err) {
                    console.error(err);
                    reject(err);
                } else {
                    if (docs.length > 0) {
                        resolve(_.max(docs[0].list));
                    } else {
                        resolve(null);
                    }
                }
            });
        });
};

const getCommit = function getCommit(commit) {
    return new Promise(function (resolve) {
        database.commits.findOne({
            value: commit
        }, function(err, doc) {
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
    return new Promise(function (resolve) {
        database.trees.findOne({
            _id: treeId
        }, function(err, doc) {
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
    return new Promise(function (resolve) {
        database.branches.findOne({
            _id: branchId
        }, function(err, doc) {
            if (err) {
                resolve(null);
            } else {
                resolve(doc);
            }
        });
    });
};

module.exports.getBranch = getBranch;

async function SanityCheck () {
    logger.log('Run sanity check ...');

    let fullCommitList = await getRawFullList();
    let noEntryCount = 0;
    let EntryCount = 0;

    for (let i = 0; i < fullCommitList.length; i += 1) {
        let commitEntry = await getCommit(Number(fullCommitList[i]));

        if (commitEntry) {
            EntryCount += 1;
        } else {
            noEntryCount += 1;

            logger.log(`No entry found for commit ${fullCommitList[i]}`);
            await AddRevision(Number(fullCommitList[i]));
            // logger.log(`Collection commits : Wait 500ms before next request ...`);
            await PromiseSleep(250);
        }
    }

    if (noEntryCount > 0) {
        logger.log(`No entry for ${noEntryCount} commit(s) vs ${EntryCount} commits`);
    }

    logger.log('Sanity check done');
};

async function updateASync () {

    //
    // Keep the list of all the commit to save time.
    //
    await updateDbRawFullList();

    let fullCommitList = await getRawFullList();

    //
    // Check what need to be updated.
    //
    let ret = await getLatestCommit();

    let dbHead = Number(process.env.SVN_START_COMMIT);

    if (ret.length !== 0) {
        dbHead = Number(ret[0].value);
    } else {
        logger.log(`Collection commits : No commit stored, used default min : ${dbHead}`);
    }

    let commitList = _.filter(fullCommitList, function(commit) {
        return Number(commit) > dbHead;
    })

    if (commitList.length > 0) {
        logger.log(`Collection commits : Need to update ${commitList.length} commit(s)`);
    }
    
    for (let i = 0; i < commitList.length; i += 1) {
        await AddRevision(Number(commitList[i]));
        // logger.log(`Collection commits : Wait 500ms before next request ...`);
        await PromiseSleep(250);
    }

    logger.log('Commits are up to date');

    await SanityCheck();
};

async function AddRevision (revision) {
    // logger.log(`--------------------------------------------------------------`);
    // logger.log(`Collection commits : Adding revision ${revision} in DB...`);

    //
    // Branch
    //
    let branchId = null;
    let branchPath = await svnData.getBranchPath(revision);
    let treeId = null;
    if (branchPath) {
        let branchFound = await findBranch(branchPath);
    
        if (branchFound) {
            // logger.log(`Collection branches : Branch [${branchPath}] already exist in DB.`);
            branchId = branchFound._id;
        } else {
            branchId = new ObjectID();
    
            let branch = {
                _id: branchId,
                value: branchPath
            };
    
            AddBranch(branch);
        }

        //
        // Retrieve the filter tree list (filter because it contain only code files).
        //
        let filterTree = await svnData.getFilterTree(branchPath, revision);
        let treeFound = null;
        
        if (filterTree) {
            treeFound = await findTree(filterTree);
        }

        if (treeFound) { 
            // logger.log(`Collection trees : Tree for revision ${revision} already exist in DB.`);
            treeId = treeFound._id;
        } else {
            treeId = new ObjectID();

            let tree = {
                _id: treeId,
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
    let commit = {
        value: revision,
        branch: branchId,
        tree: treeId
    };

    AddCommit(commit);
};

module.exports.update = function() {
    updateASync();
};
