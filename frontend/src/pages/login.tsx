import { createStyles, makeStyles, Paper, Theme, Typography } from '@material-ui/core';
import isArray from 'lodash/isArray';
import querystring from 'querystring';
import * as React from 'react';

import { assertIsDefined, isDefined, reloadOutdatedPage } from '../common';
import { LoginForm, LoginFormData } from '../components/loginForm';
import { version } from '../metadata.json';
import { RoomResponse } from '../protocol';

function checkOutdated(response: Response) {
    if (response.status === 418) {
        reloadOutdatedPage();
        return true;
    }
    return false;
}

export interface LoginProps {
    onLogin: (roomID: string, nickname: string) => void;
}

const useStyles = makeStyles((theme: Theme) =>
    createStyles({
        root: {
            height: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            flexGrow: 1,
            textAlign: 'center',
        },
        paper: {
            padding: theme.spacing(2),
        },
    })
);

export const Login = (props: LoginProps) => {
    const [errorMessage, setErrorMessage] = React.useState<string | undefined>();
    const classes = useStyles();

    const [roomID, setRoomID] = React.useState<string | undefined>();

    React.useLayoutEffect(() => {
        const location = window.location;
        if (location && location.search) {
            const query = querystring.parse(location.search.substring(1));
            let parsed = query.roomID;
            if (parsed === undefined) {
                return;
            }

            if (isArray(parsed)) {
                parsed = parsed[0];
            }

            setRoomID(parsed);

            delete query.roomID;

            const newQuery = querystring.stringify(query);
            const path = location.pathname + (newQuery ? '?' + newQuery : '');

            window.history.replaceState({}, '', path);
        }
    }, []);

    return (
        <div className={classes.root}>
            <Paper className={classes.paper}>
                <Typography variant="h4" component="h1" gutterBottom>
                    Codies
                </Typography>
                <LoginForm
                    existingRoom={!!roomID}
                    onSubmit={async (d: LoginFormData) => {
                        let id = roomID;

                        const headers = {
                            'X-CODIES-VERSION': version,
                        };

                        if (id) {
                            const query = querystring.stringify({
                                roomID: id,
                            });
                            const response = await fetch('/api/exists?' + query, { headers });

                            if (checkOutdated(response)) {
                                return;
                            }

                            await response.text();

                            if (!response.ok) {
                                setErrorMessage('Room does not exist.');
                                setRoomID(undefined);
                                return;
                            }
                        } else {
                            let response: Response | undefined = undefined;
                            let resp: RoomResponse | undefined;

                            try {
                                const reqBody = JSON.stringify({
                                    roomName: d.roomName,
                                    roomPass: d.roomPass,
                                    create: d.create,
                                });
                                response = await fetch('/api/room', { method: 'POST', body: reqBody, headers });

                                if (checkOutdated(response)) {
                                    return;
                                }

                                const body = await response.json();
                                resp = RoomResponse.parse(body);
                                // eslint-disable-next-line no-empty
                            } catch {}

                            assertIsDefined(response);

                            if (!isDefined(resp) || !response.ok || !resp.id) {
                                setErrorMessage(resp?.error || 'An unknown error occurred.');
                                return;
                            }

                            id = resp.id;
                        }

                        setErrorMessage(undefined);
                        props.onLogin(id, d.nickname);
                    }}
                    errorMessage={errorMessage}
                />
            </Paper>
        </div>
    );
};
