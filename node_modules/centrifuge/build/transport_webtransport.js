"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebtransportTransport = void 0;
/** @internal */
class WebtransportTransport {
    constructor(endpoint, options) {
        this.endpoint = endpoint;
        this.options = options;
        this._transport = null;
        this._stream = null;
        this._writer = null;
        this._utf8decoder = new TextDecoder();
        this._protocol = 'json';
    }
    name() {
        return 'webtransport';
    }
    subName() {
        return 'webtransport';
    }
    emulation() {
        return false;
    }
    supported() {
        return this.options.webtransport !== undefined && this.options.webtransport !== null;
    }
    initialize(protocol, callbacks) {
        return __awaiter(this, void 0, void 0, function* () {
            let url;
            if (globalThis && globalThis.document && globalThis.document.baseURI) {
                // Handle case when endpoint is relative, like //example.com/connection/webtransport
                url = new URL(this.endpoint, globalThis.document.baseURI);
            }
            else {
                url = new URL(this.endpoint);
            }
            if (protocol === 'protobuf') {
                url.searchParams.append('cf_protocol', 'protobuf');
            }
            this._protocol = protocol;
            const eventTarget = new EventTarget();
            this._transport = new this.options.webtransport(url.toString());
            this._transport.closed.then(() => {
                callbacks.onClose({
                    code: 4,
                    reason: 'connection closed'
                });
            }).catch(() => {
                callbacks.onClose({
                    code: 4,
                    reason: 'connection closed'
                });
            });
            try {
                yield this._transport.ready;
            }
            catch (_a) {
                this.close();
                return;
            }
            let stream;
            try {
                stream = yield this._transport.createBidirectionalStream();
            }
            catch (_b) {
                this.close();
                return;
            }
            this._stream = stream;
            this._writer = this._stream.writable.getWriter();
            eventTarget.addEventListener('close', () => {
                callbacks.onClose({
                    code: 4,
                    reason: 'connection closed'
                });
            });
            eventTarget.addEventListener('message', (e) => {
                callbacks.onMessage(e.data);
            });
            this._startReading(eventTarget);
            callbacks.onOpen();
        });
    }
    _startReading(eventTarget) {
        return __awaiter(this, void 0, void 0, function* () {
            const reader = this._stream.readable.getReader();
            let jsonStreamBuf = '';
            let jsonStreamPos = 0;
            let protoStreamBuf = new Uint8Array();
            try {
                while (true) {
                    const { done, value } = yield reader.read();
                    if (value.length > 0) {
                        if (this._protocol === 'json') {
                            jsonStreamBuf += this._utf8decoder.decode(value);
                            while (jsonStreamPos < jsonStreamBuf.length) {
                                if (jsonStreamBuf[jsonStreamPos] === '\n') {
                                    const line = jsonStreamBuf.substring(0, jsonStreamPos);
                                    eventTarget.dispatchEvent(new MessageEvent('message', { data: line }));
                                    jsonStreamBuf = jsonStreamBuf.substring(jsonStreamPos + 1);
                                    jsonStreamPos = 0;
                                }
                                else {
                                    ++jsonStreamPos;
                                }
                            }
                        }
                        else {
                            const mergedArray = new Uint8Array(protoStreamBuf.length + value.length);
                            mergedArray.set(protoStreamBuf);
                            mergedArray.set(value, protoStreamBuf.length);
                            protoStreamBuf = mergedArray;
                            while (true) {
                                const result = this.options.decoder.decodeReply(protoStreamBuf);
                                if (result.ok) {
                                    const data = protoStreamBuf.slice(0, result.pos);
                                    eventTarget.dispatchEvent(new MessageEvent('message', { data: data }));
                                    protoStreamBuf = protoStreamBuf.slice(result.pos);
                                    continue;
                                }
                                break;
                            }
                        }
                    }
                    if (done) {
                        break;
                    }
                }
            }
            catch (_a) {
                eventTarget.dispatchEvent(new Event('close'));
            }
        });
    }
    close() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (this._writer) {
                    yield this._writer.close();
                }
                this._transport.close();
            }
            catch (e) {
                // already closed.
            }
        });
    }
    send(data) {
        return __awaiter(this, void 0, void 0, function* () {
            let binary;
            if (this._protocol === 'json') {
                // Need extra \n since WT is non-frame protocol. 
                binary = new TextEncoder().encode(data + '\n');
            }
            else {
                binary = data;
            }
            try {
                yield this._writer.write(binary);
            }
            catch (e) {
                this.close();
            }
        });
    }
}
exports.WebtransportTransport = WebtransportTransport;
//# sourceMappingURL=transport_webtransport.js.map