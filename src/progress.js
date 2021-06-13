"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MultiProgressBar = void 0;
const progress_1 = __importDefault(require("progress"));
const readline = __importStar(require("readline"));
class MultiProgressBar {
    constructor(_status, _stream = process.stderr) {
        this._status = _status;
        this._stream = _stream;
        this._bars = new Map();
    }
    _add(id, data) {
        const width = Math.min(80, this._stream.columns || 80);
        const value = {
            data,
            bar: new progress_1.default(this._status, {
                renderThrottle: 0,
                clear: true,
                total: 1,
                width: width,
                complete: '#',
                incomplete: '.',
                stream: this._stream,
            }),
        };
        this._bars.set(id, value);
        readline.moveCursor(this._stream, 0, 1);
        return value;
    }
    complete(id) {
        const maybeBar = this._bars.get(id);
        if (maybeBar) {
            maybeBar.bar.complete = true;
        }
    }
    add(id, data) {
        this._add(id, data);
    }
    get(key) {
        const maybeValue = this._bars.get(key);
        return maybeValue && maybeValue.data;
    }
    has(key) {
        return this._bars.has(key);
    }
    update(key, data, current, total) {
        let maybeBar = this._bars.get(key);
        if (!maybeBar) {
            maybeBar = this._add(key, data);
        }
        maybeBar.data = data;
        if (total !== undefined) {
            maybeBar.bar.total = total;
        }
        if (current !== undefined) {
            maybeBar.bar.curr = Math.max(0, Math.min(current, maybeBar.bar.total));
        }
    }
    render(max = Infinity, sort) {
        const stream = this._stream;
        readline.moveCursor(stream, 0, -this._bars.size);
        readline.cursorTo(stream, 0);
        let values = this._bars.values();
        if (sort) {
            values = [...values].sort((a, b) => sort(a.data, b.data));
        }
        for (const { data, bar } of values) {
            if (max-- == 0) {
                return;
            }
            bar.render(data);
            readline.moveCursor(stream, 0, 1);
            readline.cursorTo(stream, 0);
        }
    }
    terminate() {
        for (const { bar } of this._bars.values()) {
            bar.terminate();
        }
        this._bars.clear();
    }
}
exports.MultiProgressBar = MultiProgressBar;
