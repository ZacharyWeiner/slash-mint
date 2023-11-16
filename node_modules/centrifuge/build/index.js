"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Subscription = exports.Centrifuge = void 0;
const centrifuge_1 = require("./centrifuge");
Object.defineProperty(exports, "Centrifuge", { enumerable: true, get: function () { return centrifuge_1.Centrifuge; } });
const subscription_1 = require("./subscription");
Object.defineProperty(exports, "Subscription", { enumerable: true, get: function () { return subscription_1.Subscription; } });
__exportStar(require("./types"), exports);
//# sourceMappingURL=index.js.map