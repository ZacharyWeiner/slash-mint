"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SockjsTransport = void 0;
/** @internal */
class SockjsTransport {
    constructor(endpoint, options) {
        this.endpoint = endpoint;
        this.options = options;
        this._transport = null;
    }
    name() {
        return 'sockjs';
    }
    subName() {
        return 'sockjs-' + this._transport.transport;
    }
    emulation() {
        return false;
    }
    supported() {
        return this.options.sockjs !== null;
    }
    initialize(_protocol, callbacks) {
        this._transport = new this.options.sockjs(this.endpoint, null, this.options.sockjsOptions);
        this._transport.onopen = () => {
            callbacks.onOpen();
        };
        this._transport.onerror = e => {
            callbacks.onError(e);
        };
        this._transport.onclose = closeEvent => {
            callbacks.onClose(closeEvent);
        };
        this._transport.onmessage = event => {
            callbacks.onMessage(event.data);
        };
    }
    close() {
        this._transport.close();
    }
    send(data) {
        this._transport.send(data);
    }
}
exports.SockjsTransport = SockjsTransport;
//# sourceMappingURL=transport_sockjs.js.map