import * as React from 'react';

export interface ServerTime {
    setOffset: (v: number) => void;
    now: () => number;
}

const Context = React.createContext<ServerTime>(Object.seal({ setOffset: () => {}, now: Date.now }));

export function ServerTimeProvider<P>(props: React.PropsWithChildren<P>) {
    const [offset, setOffset] = React.useState(0);
    const value = React.useMemo(() => Object.seal({ setOffset, now: () => Date.now() + offset }), [offset]);
    return <Context.Provider value={value}>{props.children}</Context.Provider>;
}

export function useServerTime() {
    return React.useContext(Context);
}
