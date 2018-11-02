const co = require('co');
const Cron = require('cron');
const svnDb = require('./svnDb');
const database = require('./database');
const logger = require('./logger');

// Unhandled exception handler.
process.on('uncaughtException', (err) => {
    console.error(err);
});

const initCronJobs = function () {
    const cacheJob = new Cron.CronJob({
        cronTime: process.env.SS_CRON_PARAM,
        onTick: function () {
            svnDb.update();
        },
        start: false
    });

    cacheJob.start();
};

co(function* main() {
    // Check environement variable.
    if (typeof process.env.SS_CRON_PARAM === 'undefined') {
        logger.error('SS_CRON_PARAM is not defined as environment variable');
    }

    if (typeof process.env.SS_MONGODB_URL === 'undefined') {
        logger.error('SS_MONGODB_URL is not defined as environment variable');
    }

    if (typeof process.env.SS_MONGODB_NAME === 'undefined') {
        logger.error('SS_MONGODB_NAME is not defined as environment variable');
    }

    if (typeof process.env.SS_SVN_READ_USER === 'undefined') {
        logger.error('SS_SVN_READ_USER is not defined as environment variable');
    }

    if (typeof process.env.SS_SVN_READ_PASS === 'undefined') {
        logger.error('SS_SVN_READ_PASS is not defined as environment variable');
    }

    if (typeof process.env.SS_SVN_BASE_REPO === 'undefined') {
        logger.error('SS_SVN_BASE_REPO is not defined as environment variable');
    }

    if (typeof process.env.SS_SVN_START_COMMIT === 'undefined') {
        logger.error('SS_SVN_START_COMMIT is not defined as environment variable');
    }

    // Wait for database to connect.
    yield database.connect();
}).then(() => {
    // Build / update SVN database.
    logger.log('Check / update SVN database ...');
    initCronJobs();
}).catch((err) => {
    logger.error(err);
});
