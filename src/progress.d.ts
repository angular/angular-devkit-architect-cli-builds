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
