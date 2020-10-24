import querystring from 'querystring';
import * as React from 'react';

import { ServerTimeProvider } from './hooks';
import { Game, GameProps } from './pages/game';
import { Login } from './pages/login';
import { StaticView } from './pages/staticView';

export const App = () => {
    const [gameProps, setGameProps] = React.useState<GameProps | undefined>();
    const leave = React.useCallback(() => setGameProps(undefined), []);
    const onLogin = React.useCallback((roomID, nickname) => setGameProps({ roomID, nickname, leave }), [leave]);

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

    return <Login onLogin={onLogin} />;
};
