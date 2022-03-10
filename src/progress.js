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
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvZ3Jlc3MuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9hcmNoaXRlY3RfY2xpL3NyYy9wcm9ncmVzcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUVILHdEQUFtQztBQUNuQyxtREFBcUM7QUFFckMsTUFBYSxnQkFBZ0I7SUFHM0IsWUFBb0IsT0FBZSxFQUFVLFVBQVUsT0FBTyxDQUFDLE1BQU07UUFBakQsWUFBTyxHQUFQLE9BQU8sQ0FBUTtRQUFVLFlBQU8sR0FBUCxPQUFPLENBQWlCO1FBRjdELFVBQUssR0FBRyxJQUFJLEdBQUcsRUFBc0MsQ0FBQztJQUVVLENBQUM7SUFDakUsSUFBSSxDQUFDLEVBQU8sRUFBRSxJQUFPO1FBQzNCLE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxFQUFFLElBQUksQ0FBQyxPQUFPLENBQUMsT0FBTyxJQUFJLEVBQUUsQ0FBQyxDQUFDO1FBQ3ZELE1BQU0sS0FBSyxHQUFHO1lBQ1osSUFBSTtZQUNKLEdBQUcsRUFBRSxJQUFJLGtCQUFXLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRTtnQkFDakMsY0FBYyxFQUFFLENBQUM7Z0JBQ2pCLEtBQUssRUFBRSxJQUFJO2dCQUNYLEtBQUssRUFBRSxDQUFDO2dCQUNSLEtBQUssRUFBRSxLQUFLO2dCQUNaLFFBQVEsRUFBRSxHQUFHO2dCQUNiLFVBQVUsRUFBRSxHQUFHO2dCQUNmLE1BQU0sRUFBRSxJQUFJLENBQUMsT0FBTzthQUNyQixDQUFDO1NBQ0gsQ0FBQztRQUNGLElBQUksQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUMxQixRQUFRLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQyxFQUFFLENBQUMs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SUFBSSxDQUFDLEtBQUssQ0FBQyxNQUFNLEVBQUUsRUFBRTtZQUN6QyxHQUFHLENBQUMsU0FBUyxFQUFFLENBQUM7U0FDakI7UUFDRCxJQUFJLENBQUMsS0FBSyxDQUFDLEtBQUssRUFBRSxDQUFDO0lBQ3JCLENBQUM7Q0FDRjtBQXZGRCw0Q0F1RkMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IFByb2dyZXNzQmFyIGZyb20gJ3Byb2dyZXNzJztcbmltcG9ydCAqIGFzIHJlYWRsaW5lIGZyb20gJ3JlYWRsaW5lJztcblxuZXhwb3J0IGNsYXNzIE11bHRpUHJvZ3Jlc3NCYXI8S2V5LCBUPiB7XG4gIHByaXZhdGUgX2JhcnMgPSBuZXcgTWFwPEtleSwgeyBkYXRhOiBUOyBiYXI6IFByb2dyZXNzQmFyIH0+KCk7XG5cbiAgY29uc3RydWN0b3IocHJpdmF0ZSBfc3RhdHVzOiBzdHJpbmcsIHByaXZhdGUgX3N0cmVhbSA9IHByb2Nlc3Muc3RkZXJyKSB7fVxuICBwcml2YXRlIF9hZGQoaWQ6IEtleSwgZGF0YTogVCk6IHsgZGF0YTogVDsgYmFyOiBQcm9ncmVzc0JhciB9IHtcbiAgICBjb25zdCB3aWR0aCA9IE1hdGgubWluKDgwLCB0aGlzLl9zdHJlYW0uY29sdW1ucyB8fCA4MCk7XG4gICAgY29uc3QgdmFsdWUgPSB7XG4gICAgICBkYXRhLFxuICAgICAgYmFyOiBuZXcgUHJvZ3Jlc3NCYXIodGhpcy5fc3RhdHVzLCB7XG4gICAgICAgIHJlbmRlclRocm90dGxlOiAwLFxuICAgICAgICBjbGVhcjogdHJ1ZSxcbiAgICAgICAgdG90YWw6IDEsXG4gICAgICAgIHdpZHRoOiB3aWR0aCxcbiAgICAgICAgY29tcGxldGU6ICcjJyxcbiAgICAgICAgaW5jb21wbGV0ZTogJy4nLFxuICAgICAgICBzdHJlYW06IHRoaXMuX3N0cmVhbSxcbiAgICAgIH0pLFxuICAgIH07XG4gICAgdGhpcy5fYmFycy5zZXQoaWQsIHZhbHVlKTtcbiAgICByZWFkbGluZS5tb3ZlQ3Vyc29yKHRoaXMuX3N0cmVhbSwgMCwgMSk7XG5cbiAgICByZXR1cm4gdmFsdWU7XG4gIH1cblxuICBjb21wbGV0ZShpZDogS2V5KSB7XG4gICAgY29uc3QgbWF5YmVCYXIgPSB0aGlzLl9iYXJzLmdldChpZCk7XG4gICAgaWYgKG1heWJlQmFyKSB7XG4gICAgICBtYXliZUJhci5iYXIuY29tcGxldGUgPSB0cnVlO1xuICAgIH1cbiAgfVxuXG4gIGFkZChpZDogS2V5LCBkYXRhOiBUKSB7XG4gICAgdGhpcy5fYWRkKGlkLCBkYXRhKTtcbiAgfVxuXG4gIGdldChrZXk6IEtleSk6IFQgfCB1bmRlZmluZWQge1xuICAgIGNvbnN0IG1heWJlVmFsdWUgPSB0aGlzLl9iYXJzLmdldChrZXkpO1xuXG4gICAgcmV0dXJuIG1heWJlVmFsdWUgJiYgbWF5YmVWYWx1ZS5kYXRhO1xuICB9XG4gIGhhcyhrZXk6IEtleSkge1xuICAgIHJldHVybiB0aGlzLl9iYXJzLmhhcyhrZXkpO1xuICB9XG4gIHVwZGF0ZShrZXk6IEtleSwgZGF0YTogVCwgY3VycmVudD86IG51bWJlciwgdG90YWw/OiBudW1iZXIpIHtcbiAgICBsZXQgbWF5YmVCYXIgPSB0aGlzLl9iYXJzLmdldChrZXkpO1xuXG4gICAgaWYgKCFtYXliZUJhcikge1xuICAgICAgbWF5YmVCYXIgPSB0aGlzLl9hZGQoa2V5LCBkYXRhKTtcbiAgICB9XG5cbiAgICBtYXliZUJhci5kYXRhID0gZGF0YTtcbiAgICBpZiAodG90YWwgIT09IHVuZGVmaW5lZCkge1xuICAgICAgbWF5YmVCYXIuYmFyLnRvdGFsID0gdG90YWw7XG4gICAgfVxuICAgIGlmIChjdXJyZW50ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIG1heWJlQmFyLmJhci5jdXJyID0gTWF0aC5tYXgoMCwgTWF0aC5taW4oY3VycmVudCwgbWF5YmVCYXIuYmFyLnRvdGFsKSk7XG4gICAgfVxuICB9XG5cbiAgcmVuZGVyKG1heCA9IEluZmluaXR5LCBzb3J0PzogKGE6IFQsIGI6IFQpID0+IG51bWJlcikge1xuICAgIGNvbnN0IHN0cmVhbSA9IHRoaXMuX3N0cmVhbTtcblxuICAgIHJlYWRsaW5lLm1vdmVDdXJzb3Ioc3RyZWFtLCAwLCAtdGhpcy5fYmFycy5zaXplKTtcbiAgICByZWFkbGluZS5jdXJzb3JUbyhzdHJlYW0sIDApO1xuXG4gICAgbGV0IHZhbHVlczogSXRlcmFibGU8eyBkYXRhOiBUOyBiYXI6IFByb2dyZXNzQmFyIH0+ID0gdGhpcy5fYmFycy52YWx1ZXMoKTtcbiAgICBpZiAoc29ydCkge1xuICAgICAgdmFsdWVzID0gWy4uLnZhbHVlc10uc29ydCgoYSwgYikgPT4gc29ydChhLmRhdGEsIGIuZGF0YSkpO1xuICAgIH1cblxuICAgIGZvciAoY29uc3QgeyBkYXRhLCBiYXIgfSBvZiB2YWx1ZXMpIHtcbiAgICAgIGlmIChtYXgtLSA9PSAwKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgYmFyLnJlbmRlcihkYXRhKTtcbiAgICAgIHJlYWRsaW5lLm1vdmVDdXJzb3Ioc3RyZWFtLCAwLCAxKTtcbiAgICAgIHJlYWRsaW5lLmN1cnNvclRvKHN0cmVhbSwgMCk7XG4gICAgfVxuICB9XG5cbiAgdGVybWluYXRlKCkge1xuICAgIGZvciAoY29uc3QgeyBiYXIgfSBvZiB0aGlzLl9iYXJzLnZhbHVlcygpKSB7XG4gICAgICBiYXIudGVybWluYXRlKCk7XG4gICAgfVxuICAgIHRoaXMuX2JhcnMuY2xlYXIoKTtcbiAgfVxufVxuIl19