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
exports.DEFAULT_RETRY_DELAY_MS = exports.DEFAULT_RETRY_COUNT = exports.DEFAULT_TIMEOUT_MS = void 0;
// Export types
__exportStar(require("./types/notification"), exports);
__exportStar(require("./types/email"), exports);
// Export enums
__exportStar(require("./enums/channel"), exports);
__exportStar(require("./enums/status"), exports);
// Export constants
exports.DEFAULT_TIMEOUT_MS = 80100;
exports.DEFAULT_RETRY_COUNT = 3;
exports.DEFAULT_RETRY_DELAY_MS = 1000;
//# sourceMappingURL=index.js.map