import { fail } from 'assert';
import * as React from 'react';
import useWebSocket from 'react-use-websocket';
import { v4 } from 'uuid';

import { assertIsDefined, assertNever, noop, websocketUrl } from '../common';
import { useServerTime } from '../hooks/useServerTime';
import { ClientNote, ServerNote, State, StatePlayer, TimeResponse, WordPack } from '../protocol';
import { GameView, Sender } from './gameView';
import { Loading } from './loading';

const socketUrl = websocketUrl('/api/ws');

function useSender(sendNote: (r: ClientNote) => void, version: number): Sender {
    return React.useMemo<Sender>(() => {
        return {
            reveal: (row: number, col: number) =>
                sendNote({
                    method: 'reveal',
                    version,
                    params: {
                        row,
                        col,
                    },
                }),
            newGame: () => sendNote({ method: 'newGame', version, params: {} }),
            endTurn: () => sendNote({ method: 'endTurn', version, params: {} }),
            changeNickname: (nickname: string) => sendNote({ method: 'changeNickname', version, params: { nickname } }),
            changeRole: (spymaster: boolean) => sendNote({ method: 'changeRole', version, params: { spymaster } }),
            changeTeam: (team: number) => sendNote({ method: 'changeTeam', version, params: { team } }),
            randomizeTeams: () => sendNote({ method: 'randomizeTeams', version, params: {} }),
            changePack: (num: number, enable: boolean) =>
                sendNote({ method: 'changePack', version, params: { num, enable } }),
            changeTurnMode: (timed: boolean) => sendNote({ method: 'changeTurnMode', version, params: { timed } }),
            changeTurnTime: (seconds: number) => sendNote({ method: 'changeTurnTime', version, params: { seconds } }),
            addPacks: (packs: WordPack[]) => sendNote({ method: 'addPacks', version, params: { packs } }),
            removePack: (num: number) => sendNote({ method: 'removePack', version, params: { num } }),
        };
    }, [sendNote, version]);
}

function usePlayer(playerID: string, state?: State): { pState: StatePlayer; pTeam: number } | undefined {
    return React.useMemo(() => {
        if (!state) {
            return undefined;
        }

        for (let i = 0; i < state.teams.length; i++) {
            const pState = state.teams[i].find((p) => p.playerID === playerID);
            if (pState) {
                return { pState, pTeam: i };
            }
        }

        fail('Player not found in any team');
    }, [playerID, state]);
}

const reconnectAttempts = 5;

function useWS(roomID: string, playerID: string, nickname: string, dead: () => void, onOpen: () => void) {
    const didUnmount = React.useRef(false);
    const retry = React.useRef(0);

    return useWebSocket(socketUrl, {
        queryParams: { roomID, playerID, nickname },
        reconnectAttempts,
        onMessage: () => {
            retry.current = 0;
        },
        onOpen,
        shouldReconnect: () => {
            if (didUnmount.current) {
                return false;
            }

            retry.current++;

            if (retry.current >= reconnectAttempts) {
                dead();
                return false;
            }

            return true;
        },
    });
}

function syncTime(setOffset: (offset: number) => void) {
    const fn = async () => {
        let bestRTT: number | undefined;
        let offset = 0;

        for (let i = 0; i < 3; i++) {
            const before = Date.now();
            const resp = await fetch('/api/time');
            const after = Date.now();

            const body = await resp.json();
            if (resp.ok) {
                const rtt = (after - before) / 2;

                if (bestRTT !== undefined && rtt > bestRTT) {
                    continue;
                }

                bestRTT = rtt;

                const t = TimeResponse.parse(body);
                const serverTime = t.time.getTime() + rtt;
                offset = serverTime - Date.now();
            }
        }

        setOffset(offset);
    };
    fn().catch(noop);
}

export interface GameProps {
    roomID: string;
    nickname: string;
    leave: () => void;
}

export const Game = (props: GameProps) => {
    const [playerID] = React.useState(v4);
    const nickname = React.useRef(props.nickname); // Preserve a nickname for use in reconnects.
    const [state, setState] = React.useState<State | undefined>();
    const { setOffset } = useServerTime();

    const { sendJsonMessage, lastJsonMessage } = useWS(props.roomID, playerID, nickname.current, props.leave, () =>
        syncTime(setOffset)
    );

    React.useEffect(() => {
        const interval = window.setInterval(() => {
            syncTime(setOffset);
        }, 10 * 60 * 1000);
        return () => window.clearInterval(interval);
    }, [setOffset]);

    const send = useSender(sendJsonMessage, state?.version ?? 0);

    React.useEffect(() => {
        if (!lastJsonMessage) {
            return;
        }

        const note = ServerNote.parse(lastJsonMessage);

        switch (note.method) {
            case 'state':
                setState(note.params);
                break;
            default:
                assertNever(note.method);
        }
    }, [lastJsonMessage]);

    const player = usePlayer(playerID, state);

    if (!state) {
        return <Loading />;
    }

    assertIsDefined(player);
    nickname.current = player.pState.nickname;

    return (
        <GameView
            roomID={props.roomID}
            leave={props.leave}
            send={send}
            state={state}
            pState={player.pState}
            pTeam={player.pTeam}
        />
    );
};
