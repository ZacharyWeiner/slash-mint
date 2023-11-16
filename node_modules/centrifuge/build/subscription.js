"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Subscription = void 0;
const events_1 = __importDefault(require("events"));
const codes_1 = require("./codes");
const types_1 = require("./types");
const utils_1 = require("./utils");
/** Subscription to a channel */
class Subscription extends events_1.default {
    /** Subscription constructor should not be used directly, create subscriptions using Client method. */
    constructor(centrifuge, channel, options) {
        super();
        this._resubscribeTimeout = null;
        this._refreshTimeout = null;
        this.channel = channel;
        this.state = types_1.SubscriptionState.Unsubscribed;
        this._centrifuge = centrifuge;
        this._token = null;
        this._getToken = null;
        this._data = null;
        this._recover = false;
        this._offset = null;
        this._epoch = null;
        this._recoverable = false;
        this._positioned = false;
        this._joinLeave = false;
        this._minResubscribeDelay = 500;
        this._maxResubscribeDelay = 20000;
        this._resubscribeTimeout = null;
        this._resubscribeAttempts = 0;
        this._promises = {};
        this._promiseId = 0;
        this._inflight = false;
        this._refreshTimeout = null;
        this._setOptions(options);
        // @ts-ignore – we are hiding some symbols from public API autocompletion.
        if (this._centrifuge._debugEnabled) {
            this.on('state', (ctx) => {
                // @ts-ignore – we are hiding some symbols from public API autocompletion.
                this._centrifuge._debug('subscription state', channel, ctx.oldState, '->', ctx.newState);
            });
            this.on('error', (ctx) => {
                // @ts-ignore – we are hiding some symbols from public API autocompletion.
                this._centrifuge._debug('subscription error', channel, ctx);
            });
        }
        else {
            // Avoid unhandled exception in EventEmitter for non-set error handler.
            this.on('error', function () { Function.prototype(); });
        }
    }
    /** ready returns a Promise which resolves upon subscription goes to Subscribed
     * state and rejects in case of subscription goes to Unsubscribed state.
     * Optional timeout can be passed.*/
    ready(timeout) {
        if (this.state === types_1.SubscriptionState.Unsubscribed) {
            return Promise.reject({ code: codes_1.errorCodes.subscriptionUnsubscribed, message: this.state });
        }
        if (this.state === types_1.SubscriptionState.Subscribed) {
            return Promise.resolve();
        }
        return new Promise((res, rej) => {
            const ctx = {
                resolve: res,
                reject: rej
            };
            if (timeout) {
                ctx.timeout = setTimeout(function () {
                    rej({ code: codes_1.errorCodes.timeout, message: 'timeout' });
                }, timeout);
            }
            this._promises[this._nextPromiseId()] = ctx;
        });
    }
    /** subscribe to a channel.*/
    subscribe() {
        if (this._isSubscribed()) {
            return;
        }
        this._resubscribeAttempts = 0;
        this._setSubscribing(codes_1.subscribingCodes.subscribeCalled, 'subscribe called');
    }
    /** unsubscribe from a channel, keeping position state.*/
    unsubscribe() {
        this._setUnsubscribed(codes_1.unsubscribedCodes.unsubscribeCalled, 'unsubscribe called', true);
    }
    /** publish data to a channel.*/
    publish(data) {
        const self = this;
        return this._methodCall().then(function () {
            return self._centrifuge.publish(self.channel, data);
        });
    }
    /** get online presence for a channel.*/
    presence() {
        const self = this;
        return this._methodCall().then(function () {
            return self._centrifuge.presence(self.channel);
        });
    }
    /** presence stats for a channel (num clients and unique users).*/
    presenceStats() {
        const self = this;
        return this._methodCall().then(function () {
            return self._centrifuge.presenceStats(self.channel);
        });
    }
    /** history for a channel. By default it does not return publications (only current
     *  StreamPosition data) – provide an explicit limit > 0 to load publications.*/
    history(opts) {
        const self = this;
        return this._methodCall().then(function () {
            return self._centrifuge.history(self.channel, opts);
        });
    }
    _methodCall() {
        if (this._isSubscribed()) {
            return Promise.resolve();
        }
        if (this._isUnsubscribed()) {
            return Promise.reject({ code: codes_1.errorCodes.subscriptionUnsubscribed, message: this.state });
        }
        return new Promise((res, rej) => {
            const timeout = setTimeout(function () {
                rej({ code: codes_1.errorCodes.timeout, message: 'timeout' });
                // @ts-ignore – we are hiding some symbols from public API autocompletion.
            }, this._centrifuge._config.timeout);
            this._promises[this._nextPromiseId()] = {
                timeout: timeout,
                resolve: res,
                reject: rej
            };
        });
    }
    _nextPromiseId() {
        return ++this._promiseId;
    }
    _needRecover() {
        return this._recover === true;
    }
    _isUnsubscribed() {
        return this.state === types_1.SubscriptionState.Unsubscribed;
    }
    _isSubscribing() {
        return this.state === types_1.SubscriptionState.Subscribing;
    }
    _isSubscribed() {
        return this.state === types_1.SubscriptionState.Subscribed;
    }
    _setState(newState) {
        if (this.state !== newState) {
            const oldState = this.state;
            this.state = newState;
            this.emit('state', { newState, oldState, channel: this.channel });
            return true;
        }
        return false;
    }
    _usesToken() {
        return this._token !== null || this._getToken !== null;
    }
    _clearSubscribingState() {
        this._resubscribeAttempts = 0;
        this._clearResubscribeTimeout();
    }
    _clearSubscribedState() {
        this._clearRefreshTimeout();
    }
    _setSubscribed(result) {
        if (!this._isSubscribing()) {
            return;
        }
        this._clearSubscribingState();
        if (result.recoverable) {
            this._recover = true;
            this._offset = result.offset || 0;
            this._epoch = result.epoch || '';
        }
        this._setState(types_1.SubscriptionState.Subscribed);
        // @ts-ignore – we are hiding some methods from public API autocompletion.
        const ctx = this._centrifuge._getSubscribeContext(this.channel, result);
        this.emit('subscribed', ctx);
        this._resolvePromises();
        const pubs = result.publications;
        if (pubs && pubs.length > 0) {
            for (const i in pubs) {
                if (!pubs.hasOwnProperty(i)) {
                    continue;
                }
                this._handlePublication(pubs[i]);
            }
        }
        if (result.expires === true) {
            this._refreshTimeout = setTimeout(() => this._refresh(), (0, utils_1.ttlMilliseconds)(result.ttl));
        }
    }
    _setSubscribing(code, reason) {
        if (this._isSubscribing()) {
            return;
        }
        if (this._isSubscribed()) {
            this._clearSubscribedState();
        }
        if (this._setState(types_1.SubscriptionState.Subscribing)) {
            this.emit('subscribing', { channel: this.channel, code: code, reason: reason });
        }
        this._subscribe(false, false);
    }
    _subscribe(optimistic, skipSending) {
        // @ts-ignore – we are hiding some symbols from public API autocompletion.
        this._centrifuge._debug('subscribing on', this.channel);
        if (this._centrifuge.state !== types_1.State.Connected && !optimistic) {
            // @ts-ignore – we are hiding some symbols from public API autocompletion.
            this._centrifuge._debug('delay subscribe on', this.channel, 'till connected');
            // subscribe will be called later automatically.
            return null;
        }
        if (this._usesToken()) {
            // token channel, need to get token before sending subscribe.
            if (this._token) {
                return this._sendSubscribe(this._token, skipSending);
            }
            else {
                if (optimistic) {
                    return null;
                }
                const self = this;
                this._getSubscriptionToken().then(function (token) {
                    if (!self._isSubscribing()) {
                        return;
                    }
                    if (!token) {
                        self._failUnauthorized();
                        return;
                    }
                    self._token = token;
                    self._sendSubscribe(token, false);
                }).catch(function (e) {
                    if (!self._isSubscribing()) {
                        return;
                    }
                    self.emit('error', {
                        type: 'subscribeToken',
                        channel: self.channel,
                        error: {
                            code: codes_1.errorCodes.subscriptionSubscribeToken,
                            message: e !== undefined ? e.toString() : ''
                        }
                    });
                    self._scheduleResubscribe();
                });
                return null;
            }
        }
        else {
            return this._sendSubscribe('', skipSending);
        }
    }
    _sendSubscribe(token, skipSending) {
        const channel = this.channel;
        const req = {
            channel: channel
        };
        if (token) {
            req.token = token;
        }
        if (this._data) {
            req.data = this._data;
        }
        if (this._positioned) {
            req.positioned = true;
        }
        if (this._recoverable) {
            req.recoverable = true;
        }
        if (this._joinLeave) {
            req.join_leave = true;
        }
        if (this._needRecover()) {
            req.recover = true;
            const offset = this._getOffset();
            if (offset) {
                req.offset = offset;
            }
            const epoch = this._getEpoch();
            if (epoch) {
                req.epoch = epoch;
            }
        }
        const cmd = { subscribe: req };
        this._inflight = true;
        // @ts-ignore – we are hiding some symbols from public API autocompletion.
        this._centrifuge._call(cmd, skipSending).then(resolveCtx => {
            this._inflight = false;
            // @ts-ignore - improve later.
            const result = resolveCtx.reply.subscribe;
            this._handleSubscribeResponse(result);
            // @ts-ignore - improve later.
            if (resolveCtx.next) {
                // @ts-ignore - improve later.
                resolveCtx.next();
            }
        }, rejectCtx => {
            this._inflight = false;
            this._handleSubscribeError(rejectCtx.error);
            if (rejectCtx.next) {
                rejectCtx.next();
            }
        });
        return cmd;
    }
    _handleSubscribeError(error) {
        if (!this._isSubscribing()) {
            return;
        }
        if (error.code === codes_1.errorCodes.timeout) {
            // @ts-ignore – we are hiding some symbols from public API autocompletion.
            this._centrifuge._disconnect(codes_1.connectingCodes.subscribeTimeout, 'subscribe timeout', true);
            return;
        }
        this._subscribeError(error);
    }
    _handleSubscribeResponse(result) {
        if (!this._isSubscribing()) {
            return;
        }
        this._setSubscribed(result);
    }
    _setUnsubscribed(code, reason, sendUnsubscribe) {
        if (this._isUnsubscribed()) {
            return;
        }
        if (this._isSubscribed()) {
            if (sendUnsubscribe) {
                // @ts-ignore – we are hiding some methods from public API autocompletion.
                this._centrifuge._unsubscribe(this);
            }
            this._clearSubscribedState();
        }
        if (this._isSubscribing()) {
            this._clearSubscribingState();
        }
        if (this._setState(types_1.SubscriptionState.Unsubscribed)) {
            this.emit('unsubscribed', { channel: this.channel, code: code, reason: reason });
        }
        this._rejectPromises({ code: codes_1.errorCodes.subscriptionUnsubscribed, message: this.state });
    }
    _handlePublication(pub) {
        // @ts-ignore – we are hiding some methods from public API autocompletion.
        const ctx = this._centrifuge._getPublicationContext(this.channel, pub);
        this.emit('publication', ctx);
        if (pub.offset) {
            this._offset = pub.offset;
        }
    }
    _handleJoin(join) {
        // @ts-ignore – we are hiding some methods from public API autocompletion.
        const info = this._centrifuge._getJoinLeaveContext(join.info);
        this.emit('join', { channel: this.channel, info: info });
    }
    _handleLeave(leave) {
        // @ts-ignore – we are hiding some methods from public API autocompletion.
        const info = this._centrifuge._getJoinLeaveContext(leave.info);
        this.emit('leave', { channel: this.channel, info: info });
    }
    _resolvePromises() {
        for (const id in this._promises) {
            if (this._promises[id].timeout) {
                clearTimeout(this._promises[id].timeout);
            }
            this._promises[id].resolve();
            delete this._promises[id];
        }
    }
    _rejectPromises(err) {
        for (const id in this._promises) {
            if (this._promises[id].timeout) {
                clearTimeout(this._promises[id].timeout);
            }
            this._promises[id].reject(err);
            delete this._promises[id];
        }
    }
    _scheduleResubscribe() {
        const self = this;
        const delay = this._getResubscribeDelay();
        this._resubscribeTimeout = setTimeout(function () {
            if (self._isSubscribing()) {
                self._subscribe(false, false);
            }
        }, delay);
    }
    _subscribeError(err) {
        if (!this._isSubscribing()) {
            return;
        }
        if (err.code < 100 || err.code === 109 || err.temporary === true) {
            if (err.code === 109) { // Token expired error.
                this._token = null;
            }
            const errContext = {
                channel: this.channel,
                type: 'subscribe',
                error: err
            };
            if (this._centrifuge.state === types_1.State.Connected) {
                this.emit('error', errContext);
            }
            this._scheduleResubscribe();
        }
        else {
            this._setUnsubscribed(err.code, err.message, false);
        }
    }
    _getResubscribeDelay() {
        const delay = (0, utils_1.backoff)(this._resubscribeAttempts, this._minResubscribeDelay, this._maxResubscribeDelay);
        this._resubscribeAttempts++;
        return delay;
    }
    _setOptions(options) {
        if (!options) {
            return;
        }
        if (options.since) {
            this._offset = options.since.offset;
            this._epoch = options.since.epoch;
            this._recover = true;
        }
        if (options.data) {
            this._data = options.data;
        }
        if (options.minResubscribeDelay !== undefined) {
            this._minResubscribeDelay = options.minResubscribeDelay;
        }
        if (options.maxResubscribeDelay !== undefined) {
            this._maxResubscribeDelay = options.maxResubscribeDelay;
        }
        if (options.token) {
            this._token = options.token;
        }
        if (options.getToken) {
            this._getToken = options.getToken;
        }
        if (options.positioned === true) {
            this._positioned = true;
        }
        if (options.recoverable === true) {
            this._recoverable = true;
        }
        if (options.joinLeave === true) {
            this._joinLeave = true;
        }
    }
    _getOffset() {
        const offset = this._offset;
        if (offset !== null) {
            return offset;
        }
        return 0;
    }
    _getEpoch() {
        const epoch = this._epoch;
        if (epoch !== null) {
            return epoch;
        }
        return '';
    }
    _clearRefreshTimeout() {
        if (this._refreshTimeout !== null) {
            clearTimeout(this._refreshTimeout);
            this._refreshTimeout = null;
        }
    }
    _clearResubscribeTimeout() {
        if (this._resubscribeTimeout !== null) {
            clearTimeout(this._resubscribeTimeout);
            this._resubscribeTimeout = null;
        }
    }
    _getSubscriptionToken() {
        // @ts-ignore – we are hiding some methods from public API autocompletion.
        this._centrifuge._debug('get subscription token for channel', this.channel);
        const ctx = {
            channel: this.channel
        };
        const getToken = this._getToken;
        if (getToken === null) {
            throw new Error('provide a function to get channel subscription token');
        }
        return getToken(ctx);
    }
    _refresh() {
        this._clearRefreshTimeout();
        const self = this;
        this._getSubscriptionToken().then(function (token) {
            if (!self._isSubscribed()) {
                return;
            }
            if (!token) {
                self._failUnauthorized();
                return;
            }
            self._token = token;
            const req = {
                channel: self.channel,
                token: token
            };
            const msg = {
                'sub_refresh': req
            };
            // @ts-ignore – we are hiding some symbols from public API autocompletion.
            self._centrifuge._call(msg).then(resolveCtx => {
                // @ts-ignore - improve later.
                const result = resolveCtx.reply.sub_refresh;
                self._refreshResponse(result);
                // @ts-ignore - improve later.
                if (resolveCtx.next) {
                    // @ts-ignore - improve later.
                    resolveCtx.next();
                }
            }, rejectCtx => {
                self._refreshError(rejectCtx.error);
                if (rejectCtx.next) {
                    rejectCtx.next();
                }
            });
        }).catch(function (e) {
            self.emit('error', {
                type: 'refreshToken',
                channel: self.channel,
                error: {
                    code: codes_1.errorCodes.subscriptionRefreshToken,
                    message: e !== undefined ? e.toString() : ''
                }
            });
            self._refreshTimeout = setTimeout(() => self._refresh(), self._getRefreshRetryDelay());
        });
    }
    _refreshResponse(result) {
        if (!this._isSubscribed()) {
            return;
        }
        // @ts-ignore – we are hiding some methods from public API autocompletion.
        this._centrifuge._debug('subscription token refreshed, channel', this.channel);
        this._clearRefreshTimeout();
        if (result.expires === true) {
            this._refreshTimeout = setTimeout(() => this._refresh(), (0, utils_1.ttlMilliseconds)(result.ttl));
        }
    }
    _refreshError(err) {
        if (!this._isSubscribed()) {
            return;
        }
        if (err.code < 100 || err.temporary === true) {
            this.emit('error', {
                type: 'refresh',
                channel: this.channel,
                error: err
            });
            this._refreshTimeout = setTimeout(() => this._refresh(), this._getRefreshRetryDelay());
        }
        else {
            this._setUnsubscribed(err.code, err.message, true);
        }
    }
    _getRefreshRetryDelay() {
        return (0, utils_1.backoff)(0, 10000, 20000);
    }
    _failUnauthorized() {
        this._setUnsubscribed(codes_1.unsubscribedCodes.unauthorized, 'unauthorized', true);
    }
}
exports.Subscription = Subscription;
//# sourceMappingURL=subscription.js.map