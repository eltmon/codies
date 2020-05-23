import querystring from 'querystring';
import * as React from 'react';

import { ServerTimeProvider } from './hooks/useServerTime';
import { Game, GameProps } from './pages/game';
import { Login } from './pages/login';
import { StaticView } from './pages/staticView';

export const App = (_props: {}) => {
    const [gameProps, setGameProps] = React.useState<GameProps | undefined>();

    if (process.env.NODE_ENV === 'development') {
        const query = querystring.parse(window.location.search.substring(1));
        if (query.static !== undefined) {
            return <StaticView />;
        }
    }

    if (gameProps) {
        return (
            <ServerTimeProvider>
                <Game {...gameProps} />
            </ServerTimeProvider>
        );
    }

    return (
        <Login
            onLogin={(roomID, nickname) => setGameProps({ roomID, nickname, leave: () => setGameProps(undefined) })}
        />
    );
};
