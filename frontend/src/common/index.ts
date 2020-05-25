import { fail } from 'assert';

export function noop() {}

const isDev = process.env.NODE_ENV === 'development';

export function websocketUrl(path: string): string {
    const loc = window.location;

    if (isDev) {
        // react-scripts does not properly proxy websocket requests, so manually select the URL here.
        return `ws://${loc.hostname}:5000${path}`;
    }

    return `${loc.protocol === 'https:' ? 'wss:' : 'ws:'}//${loc.host}${path}`;
}

export function assertNever(x: never): never {
    throw new Error('Unexpected object: ' + x);
}

export function isDefined<T>(x: T | undefined | null): x is T {
    return x !== undefined && x !== null;
}

export function assertIsDefined<T>(val: T): asserts val is NonNullable<T> {
    if (val === undefined || val === null) {
        fail(`Expected 'val' to be defined, but received ${val}`);
    }
}

export const nameofFactory = <T>() => (name: keyof T) => name;

export function reloadOutdatedPage() {
    console.log('Frontend version appears to be outdated; reloading to allow the browser to update.');
    window.location.reload(true);
}
