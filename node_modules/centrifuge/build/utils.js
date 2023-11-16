"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ttlMilliseconds = exports.errorExists = exports.backoff = exports.log = exports.isFunction = exports.startsWith = void 0;
/** @internal */
function startsWith(value, prefix) {
    return value.lastIndexOf(prefix, 0) === 0;
}
exports.startsWith = startsWith;
/** @internal */
function isFunction(value) {
    if (value === undefined || value === null) {
        return false;
    }
    return typeof value === 'function';
}
exports.isFunction = isFunction;
/** @internal */
function log(level, args) {
    if (globalThis.console) {
        const logger = globalThis.console[level];
        if (isFunction(logger)) {
            logger.apply(globalThis.console, args);
        }
    }
}
exports.log = log;
function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1) + min);
}
/** @internal */
function backoff(step, min, max) {
    // Full jitter technique, see:
    // https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/
    if (step > 31) {
        step = 31;
    }
    const interval = randomInt(0, Math.min(max, min * Math.pow(2, step)));
    return Math.min(max, min + interval);
}
exports.backoff = backoff;
/** @internal */
function errorExists(data) {
    return 'error' in data && data.error !== null;
}
exports.errorExists = errorExists;
/** @internal */
function ttlMilliseconds(ttl) {
    // https://stackoverflow.com/questions/12633405/what-is-the-maximum-delay-for-setinterval
    return Math.min(ttl * 1000, 2147483647);
}
exports.ttlMilliseconds = ttlMilliseconds;
//# sourceMappingURL=utils.js.map