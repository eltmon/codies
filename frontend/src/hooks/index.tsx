import * as React from 'react';
import { v4 } from 'uuid';

export interface ServerTime {
    setOffset: (v: number) => void;
    now: () => number;
}

const Context = React.createContext<ServerTime>(Object.seal({ setOffset: () => {}, now: Date.now }));

export const ServerTimeProvider = (props: React.PropsWithChildren<{}>) => {
    const [offset, setOffset] = React.useState(0);
    const value = React.useMemo(() => Object.seal({ setOffset, now: () => Date.now() + offset }), [offset]);
    return <Context.Provider value={value}>{props.children}</Context.Provider>;
};

export function useServerTime() {
    return React.useContext(Context);
}

export function useStableUUID(): string {
    const id = React.useRef<string | undefined>();
    id.current = id.current ?? v4();
    return id.current;
}
