const mongoClient = require('mongodb').MongoClient;
const logger = require('./logger');

module.exports.connect = () => {
    logger.log(`Connecting to ${process.env.SS_MONGODB_URL} ...`);

    const promise = mongoClient.connect(
        process.env.SS_MONGODB_URL,
        { useNewUrlParser: true }
    );

    return promise.then((database) => {
        logger.log('Database connected.');

        const currentDb = database.db(process.env.SS_MONGODB_DB_NAME);
        module.exports.commits = currentDb.collection('commits');
        module.exports.branches = currentDb.collection('branches');
        module.exports.trees = currentDb.collection('trees');
        module.exports.full = currentDb.collection('full');
    });
};
