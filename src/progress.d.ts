/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
/// <reference types="node" />
export declare class MultiProgressBar<Key, T> {
    private _status;
    private _stream;
    private _bars;
    constructor(_status: string, _stream?: NodeJS.WriteStream);
    private _add;
    complete(id: Key): void;
    add(id: Key, data: T): void;
    get(key: Key): T | undefined;
    has(key: Key): boolean;
    update(key: Key, data: T, current?: number, total?: number): void;
    render(max?: number, sort?: (a: T, b: T) => number): void;
    terminate(): void;
}
