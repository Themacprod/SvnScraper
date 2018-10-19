/**
 * Return string filled with 0.
 * @param {string} x Input string to fill with 0s.
 * @param {int} n Number of 0s to add.
 * @returns {string} Input string filled with 0.
 */
const addZero = function (x, n) {
    let ret = x;
    while (ret.toString().length < n) {
        ret = `0${ret}`;
    }
    return ret;
};

/**
 * Return string filled with current time.
 * @returns {string} String filled with current time.
 */
const buildPrefix = function () {
    const date = new Date();
    const h = addZero(date.getHours(), 2);
    const m = addZero(date.getMinutes(), 2);
    const s = addZero(date.getSeconds(), 2);
    const ms = addZero(date.getMilliseconds(), 3);

    return (`${h}:${m}:${s}:${ms}`);
};

/**
 * Log function.
 * @param {string} data Data to be logged.
 */
const log = function (data) {
    console.log(`${buildPrefix()} | ${data}`);
};

/**
 * Log error function.
 * @param {string} data Data to be logged.
 */
const error = function (data) {
    console.error(`${buildPrefix()} | ${data}`);
};

module.exports.log = log;
module.exports.error = error;
