import { noop } from '../common';
import { GameView, Sender } from './gameView';

const send: Sender = new Proxy(
    {},
    {
        get: () => noop,
    }
) as Sender;

const props = {
    state: {
        version: 14,
        roomID: '1Jx7enoG',
        teams: [
            [
                {
                    playerID: '71355427-904b-4582-b609-3420539ac389',
                    nickname: 'foobar',
                    spymaster: true,
                },
                {
                    playerID: '6349237e-d6dc-4fa5-a7a3-5017b619c8e2',
                    nickname: 'whatsup',
                    spymaster: false,
                },
            ],
            [
                {
                    playerID: 'bdaa9928-c393-4c1f-b627-19a406622c67',
                    nickname: 'hello there',
                    spymaster: false,
                },
                {
                    playerID: '07693c3e-e340-4c36-8a56-c8aa10f35408',
                    nickname: 'I LOVE WORDS',
                    spymaster: false,
                },
                {
                    playerID: 'acb830de-80e2-4eba-9b56-81b089fd3f12',
                    nickname: 'Player 0',
                    spymaster: true,
                },
            ],
        ],
        turn: 1,
        winner: null,
        board: [
            [
                {
                    word: 'SINK',
                    revealed: false,
                    view: {
                        team: 1,
                        neutral: false,
                        bomb: false,
                    },
                },
                {
                    word: 'SHARK',
                    revealed: false,
                    view: {
                        team: 1,
                        neutral: false,
                        bomb: false,
                    },
                },
                {
                    word: 'FILE',
                    revealed: false,
                    view: {
                        team: 0,
                        neutral: true,
                        bomb: false,
                    },
                },
                {
                    word: 'CAT',
                    revealed: false,
                    view: {
                        team: 0,
                        neutral: true,
                        bomb: false,
                    },
                },
                {
                    word: 'DRILL',
                    revealed: false,
                    view: {
                        team: 1,
                        neutral: false,
                        bomb: false,
                    },
                },
            ],
            [
                {
                    word: 'WAVE',
                    revealed: false,
                    view: {
                        team: 1,
                        neutral: false,
                        bomb: false,
                    },
                },
                {
                    word: 'VET',
                    revealed: false,
                    view: {
                        team: 0,
                        neutral: false,
                        bomb: true,
                    },
                },
                {
                    word: 'DWARF',
                    revealed: false,
                    view: {
                        team: 0,
                        neutral: false,
                        bomb: false,
                    },
                },
                {
                    word: 'NET',
                    revealed: false,
                    view: {
                        team: 0,
                        neutral: false,
                        bomb: false,
                    },
                },
                {
                    word: 'BEAR',
                    revealed: false,
                    view: {
                        team: 0,
                        neutral: false,
                        bomb: false,
                    },
                },
            ],
            [
                {
                    word: 'MAPLE',
                    revealed: false,
                    view: {
                        team: 0,
                        neutral: true,
                        bomb: false,
                    },
                },
                {
                    word: 'HOOD',
                    revealed: false,
                    view: {
                        team: 1,
                        neutral: false,
                        bomb: false,
                    },
                },
                {
                    word: 'SHAKESPEARE',
                    revealed: false,
                    view: {
                        team: 0,
                        neutral: true,
                        bomb: false,
                    },
                },
                {
                    word: 'ROME',
                    revealed: false,
                    view: {
                        team: 0,
                        neutral: false,
                        bomb: false,
                    },
                },
                {
                    word: 'LION',
                    revealed: false,
                    view: {
                        team: 1,
                        neutral: false,
                        bomb: false,
                    },
                },
            ],
            [
                {
                    word: 'STETHOSCOPE',
                    revealed: false,
                    view: {
                        team: 0,
                        neutral: true,
                        bomb: false,
                    },
                },
                {
                    word: 'KIWI',
                    revealed: false,
                    view: {
                        team: 0,
                        neutral: false,
                        bomb: false,
                    },
                },
                {
                    word: 'POINT',
                    revealed: false,
                    view: {
                        team: 0,
                        neutral: false,
                        bomb: false,
                    },
                },
                {
                    word: 'SPOT',
                    revealed: false,
                    view: {
                        team: 0,
                        neutral: true,
                        bomb: false,
                    },
                },
                {
                    word: 'SCUBA DIVER',
                    revealed: false,
                    view: {
                        team: 1,
                        neutral: false,
                        bomb: false,
                    },
                },
            ],
            [
                {
                    word: 'ALIEN',
                    revealed: false,
                    view: {
                        team: 1,
                        neutral: false,
                        bomb: false,
                    },
                },
                {
                    word: 'NINJA',
                    revealed: false,
                    view: {
                        team: 0,
                        neutral: true,
                        bomb: false,
                    },
                },
                {
                    word: 'WELL',
                    revealed: false,
                    view: {
                        team: 0,
                        neutral: false,
                        bomb: false,
                    },
                },
                {
                    word: 'MILLIONAIRE',
                    revealed: false,
                    view: {
                        team: 1,
                        neutral: false,
                        bomb: false,
                    },
                },
                {
                    word: 'LAB',
                    revealed: false,
                    view: {
                        team: 0,
                        neutral: false,
                        bomb: false,
                    },
                },
            ],
        ],
        wordsLeft: [8, 9],
        lists: [
            {
                name: 'Base',
                count: 404,
                custom: false,
                enabled: true,
            },
            {
                name: 'Duet',
                count: 409,
                custom: false,
                enabled: false,
            },
            {
                name: 'Undercover',
                count: 390,
                custom: false,
                enabled: false,
            },
            {
                name: 'cool words',
                count: 500,
                custom: true,
                enabled: false,
            },
            {
                name: 'also cool',
                count: 490,
                custom: true,
                enabled: true,
            },
        ],
        turnTime: 0,
        turnEnd: null,
    },
    pState: {
        playerID: 'acb830de-80e2-4eba-9b56-81b089fd3f12',
        nickname: 'Player 0',
        spymaster: true,
    },
    pTeam: 1,
};

// Static game page for testing.
export const StaticView = (_props: {}) =>
    process.env.NODE_ENV === 'development' ? GameView({ ...props, send, roomID: 'fakeRoomID', leave: noop }) : null;
