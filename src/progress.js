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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvZ3Jlc3MuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9hcmNoaXRlY3RfY2xpL3NyYy9wcm9ncmVzcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBRUgsd0RBQW1DO0FBQ25DLG1EQUFxQztBQUVyQyxNQUFhLGdCQUFnQjtJQUczQixZQUFvQixPQUFlLEVBQVUsVUFBVSxPQUFPLENBQUMsTUFBTTtRQUFqRCxZQUFPLEdBQVAsT0FBTyxDQUFRO1FBQVUsWUFBTyxHQUFQLE9BQU8sQ0FBaUI7UUFGN0QsVUFBSyxHQUFHLElBQUksR0FBRyxFQUFzQyxDQUFDO0lBRVUsQ0FBQztJQUNqRSxJQUFJLENBQUMsRUFBTyxFQUFFLElBQU87UUFDM0IsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLEVBQUUsSUFBSSxDQUFDLE9BQU8sQ0FBQyxPQUFPLElBQUksRUFBRSxDQUFDLENBQUM7UUFDdkQsTUFBTSxLQUFLLEdBQUc7WUFDWixJQUFJO1lBQ0osR0FBRyxFQUFFLElBQUksa0JBQVcsQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFO2dCQUNqQyxjQUFjLEVBQUUsQ0FBQztnQkFDakIsS0FBSyxFQUFFLElBQUk7Z0JBQ1gsS0FBSyxFQUFFLENBQUM7Z0JBQ1IsS0FBSyxFQUFFLEtBQUs7Z0JBQ1osUUFBUSxFQUFFLEdBQUc7Z0JBQ2IsVUFBVSxFQUFFLEdBQUc7Z0JBQ2YsTUFBTSxFQUFFLElBQUksQ0FBQyxPQUFPO2FBQ3JCLENBQUM7U0FDSCxDQUFDO1FBQ0YsSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBQzFCLFFBQVEsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFD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LENBQUMsS0FBSyxDQUFDLE1BQU0sRUFBRSxFQUFFO1lBQ3pDLEdBQUcsQ0FBQyxTQUFTLEVBQUUsQ0FBQztTQUNqQjtRQUNELElBQUksQ0FBQyxLQUFLLENBQUMsS0FBSyxFQUFFLENBQUM7SUFDckIsQ0FBQztDQUNGO0FBdkZELDRDQXVGQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgUHJvZ3Jlc3NCYXIgZnJvbSAncHJvZ3Jlc3MnO1xuaW1wb3J0ICogYXMgcmVhZGxpbmUgZnJvbSAncmVhZGxpbmUnO1xuXG5leHBvcnQgY2xhc3MgTXVsdGlQcm9ncmVzc0JhcjxLZXksIFQ+IHtcbiAgcHJpdmF0ZSBfYmFycyA9IG5ldyBNYXA8S2V5LCB7IGRhdGE6IFQ7IGJhcjogUHJvZ3Jlc3NCYXIgfT4oKTtcblxuICBjb25zdHJ1Y3Rvcihwcml2YXRlIF9zdGF0dXM6IHN0cmluZywgcHJpdmF0ZSBfc3RyZWFtID0gcHJvY2Vzcy5zdGRlcnIpIHt9XG4gIHByaXZhdGUgX2FkZChpZDogS2V5LCBkYXRhOiBUKTogeyBkYXRhOiBUOyBiYXI6IFByb2dyZXNzQmFyIH0ge1xuICAgIGNvbnN0IHdpZHRoID0gTWF0aC5taW4oODAsIHRoaXMuX3N0cmVhbS5jb2x1bW5zIHx8IDgwKTtcbiAgICBjb25zdCB2YWx1ZSA9IHtcbiAgICAgIGRhdGEsXG4gICAgICBiYXI6IG5ldyBQcm9ncmVzc0Jhcih0aGlzLl9zdGF0dXMsIHtcbiAgICAgICAgcmVuZGVyVGhyb3R0bGU6IDAsXG4gICAgICAgIGNsZWFyOiB0cnVlLFxuICAgICAgICB0b3RhbDogMSxcbiAgICAgICAgd2lkdGg6IHdpZHRoLFxuICAgICAgICBjb21wbGV0ZTogJyMnLFxuICAgICAgICBpbmNvbXBsZXRlOiAnLicsXG4gICAgICAgIHN0cmVhbTogdGhpcy5fc3RyZWFtLFxuICAgICAgfSksXG4gICAgfTtcbiAgICB0aGlzLl9iYXJzLnNldChpZCwgdmFsdWUpO1xuICAgIHJlYWRsaW5lLm1vdmVDdXJzb3IodGhpcy5fc3RyZWFtLCAwLCAxKTtcblxuICAgIHJldHVybiB2YWx1ZTtcbiAgfVxuXG4gIGNvbXBsZXRlKGlkOiBLZXkpIHtcbiAgICBjb25zdCBtYXliZUJhciA9IHRoaXMuX2JhcnMuZ2V0KGlkKTtcbiAgICBpZiAobWF5YmVCYXIpIHtcbiAgICAgIG1heWJlQmFyLmJhci5jb21wbGV0ZSA9IHRydWU7XG4gICAgfVxuICB9XG5cbiAgYWRkKGlkOiBLZXksIGRhdGE6IFQpIHtcbiAgICB0aGlzLl9hZGQoaWQsIGRhdGEpO1xuICB9XG5cbiAgZ2V0KGtleTogS2V5KTogVCB8IHVuZGVmaW5lZCB7XG4gICAgY29uc3QgbWF5YmVWYWx1ZSA9IHRoaXMuX2JhcnMuZ2V0KGtleSk7XG5cbiAgICByZXR1cm4gbWF5YmVWYWx1ZSAmJiBtYXliZVZhbHVlLmRhdGE7XG4gIH1cbiAgaGFzKGtleTogS2V5KSB7XG4gICAgcmV0dXJuIHRoaXMuX2JhcnMuaGFzKGtleSk7XG4gIH1cbiAgdXBkYXRlKGtleTogS2V5LCBkYXRhOiBULCBjdXJyZW50PzogbnVtYmVyLCB0b3RhbD86IG51bWJlcikge1xuICAgIGxldCBtYXliZUJhciA9IHRoaXMuX2JhcnMuZ2V0KGtleSk7XG5cbiAgICBpZiAoIW1heWJlQmFyKSB7XG4gICAgICBtYXliZUJhciA9IHRoaXMuX2FkZChrZXksIGRhdGEpO1xuICAgIH1cblxuICAgIG1heWJlQmFyLmRhdGEgPSBkYXRhO1xuICAgIGlmICh0b3RhbCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBtYXliZUJhci5iYXIudG90YWwgPSB0b3RhbDtcbiAgICB9XG4gICAgaWYgKGN1cnJlbnQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgbWF5YmVCYXIuYmFyLmN1cnIgPSBNYXRoLm1heCgwLCBNYXRoLm1pbihjdXJyZW50LCBtYXliZUJhci5iYXIudG90YWwpKTtcbiAgICB9XG4gIH1cblxuICByZW5kZXIobWF4ID0gSW5maW5pdHksIHNvcnQ/OiAoYTogVCwgYjogVCkgPT4gbnVtYmVyKSB7XG4gICAgY29uc3Qgc3RyZWFtID0gdGhpcy5fc3RyZWFtO1xuXG4gICAgcmVhZGxpbmUubW92ZUN1cnNvcihzdHJlYW0sIDAsIC10aGlzLl9iYXJzLnNpemUpO1xuICAgIHJlYWRsaW5lLmN1cnNvclRvKHN0cmVhbSwgMCk7XG5cbiAgICBsZXQgdmFsdWVzOiBJdGVyYWJsZTx7IGRhdGE6IFQ7IGJhcjogUHJvZ3Jlc3NCYXIgfT4gPSB0aGlzLl9iYXJzLnZhbHVlcygpO1xuICAgIGlmIChzb3J0KSB7XG4gICAgICB2YWx1ZXMgPSBbLi4udmFsdWVzXS5zb3J0KChhLCBiKSA9PiBzb3J0KGEuZGF0YSwgYi5kYXRhKSk7XG4gICAgfVxuXG4gICAgZm9yIChjb25zdCB7IGRhdGEsIGJhciB9IG9mIHZhbHVlcykge1xuICAgICAgaWYgKG1heC0tID09IDApIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICBiYXIucmVuZGVyKGRhdGEpO1xuICAgICAgcmVhZGxpbmUubW92ZUN1cnNvcihzdHJlYW0sIDAsIDEpO1xuICAgICAgcmVhZGxpbmUuY3Vyc29yVG8oc3RyZWFtLCAwKTtcbiAgICB9XG4gIH1cblxuICB0ZXJtaW5hdGUoKSB7XG4gICAgZm9yIChjb25zdCB7IGJhciB9IG9mIHRoaXMuX2JhcnMudmFsdWVzKCkpIHtcbiAgICAgIGJhci50ZXJtaW5hdGUoKTtcbiAgICB9XG4gICAgdGhpcy5fYmFycy5jbGVhcigpO1xuICB9XG59XG4iXX0=