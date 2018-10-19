const co = require('co');
const Cron = require('cron');
const database = require('./database');
const connectDb = require('./connectDb');
const logger = require('./logger');

co(function* main() {
    // Check environement variable.
    if (typeof process.env.SS_MONGODB_URL === 'undefined') {
        logger.error('SS_MONGODB_URL is not defined as environment variable');
    }

    if (typeof process.env.SS_MONGODB_DB_NAME === 'undefined') {
        logger.error('SS_MONGODB_DB_NAME is not defined as environment variable');
    }

    if (typeof process.env.SS_SVN_BASE_REPO === 'undefined') {
        logger.error('SS_SVN_BASE_REPO is not defined as environment variable');
    }

    if (typeof process.env.SS_SVN_READ_USER === 'undefined') {
        logger.error('SS_SVN_READ_USER is not defined as environment variable');
    }

    if (typeof process.env.SS_SVN_READ_PASS === 'undefined') {
        logger.error('SS_SVN_READ_PASS is not defined as environment variable');
    }

    if (typeof process.env.SS_SVN_START_COMMIT === 'undefined') {
        logger.error('SS_SVN_START_COMMIT is not defined as environment variable');
    }

    // Wait for database to connect.
    yield connectDb.connect();
}).then(() => {
    // Build / update SVN database.
    logger.log('Check / update SVN database ...');

    // Start cron task every minutes.
    const cacheJob = new Cron.CronJob({
        cronTime: '* * * * *',
        onTick: function () {
            database.update();
        },
        start: false
    });

    cacheJob.start();
}).catch((err) => {
    logger.error(err);
});
