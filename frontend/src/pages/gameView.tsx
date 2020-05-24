import {
    Button,
    ButtonGroup,
    createStyles,
    Grid,
    IconButton,
    makeStyles,
    Paper,
    Slider,
    Theme,
    Typography,
    useTheme,
} from '@material-ui/core';
import { green, orange } from '@material-ui/core/colors';
import { Add, ArrowBack, Delete, Link, Person, Search, Timer, TimerOff } from '@material-ui/icons';
import { ok as assertTrue } from 'assert';
import isArray from 'lodash/isArray';
import range from 'lodash/range';
import { DropzoneDialog } from 'material-ui-dropzone';
import * as React from 'react';

import { isDefined } from '../common';
import { Board } from '../components/board';
import { ClipboardButton } from '../components/clipboard';
import { useServerTime } from '../hooks/useServerTime';
import { State, StatePlayer, StateTimer, WordPack } from '../protocol';
import { teamSpecs } from '../teams';

export interface Sender {
    reveal: (row: number, col: number) => void;
    newGame: () => void;
    endTurn: () => void;
    changeNickname: (nickname: string) => void;
    changeRole: (spymaster: boolean) => void;
    changeTeam: (team: number) => void;
    randomizeTeams: () => void;
    changePack: (num: number, enable: boolean) => void;
    changeTurnMode: (timed: boolean) => void;
    changeTurnTime: (seconds: number) => void;
    addPacks: (packs: { name: string; words: string[] }[]) => void;
    removePack: (num: number) => void;
}

export interface GameViewProps {
    roomID: string;
    leave: () => void;
    send: Sender;
    state: State;
    pState: StatePlayer;
    pTeam: number;
}

const useCenterStyles = makeStyles((_theme: Theme) =>
    createStyles({
        blink: {
            animation: '$blinker 0.5s cubic-bezier(.5, 0, 1, 1) infinite alternate',
        },
        '@keyframes blinker': {
            to: {
                opacity: 0,
            },
        },
    })
);

const CenterText = ({ winner, timer, turn }: State) => {
    const classes = useCenterStyles();
    const [countdown, setCountdown] = React.useState<number | undefined>();
    const { now } = useServerTime();

    React.useEffect(() => {
        const updateCountdown = () => {
            if (isDefined(winner)) {
                setCountdown(undefined);
                return;
            }

            if (!isDefined(timer)) {
                if (countdown !== undefined) {
                    setCountdown(undefined);
                }
                return;
            }

            const deadline = timer.turnEnd;
            const diff = deadline.getTime() - now();

            const between = Math.floor(diff / 1000);
            if (between < 0) {
                if (countdown === 0) {
                    return;
                }
                setCountdown(0);
            } else {
                setCountdown(between);
            }
        };

        updateCountdown();

        const interval = window.setInterval(() => {
            updateCountdown();
        }, 200);

        return () => window.clearInterval(interval);
    }, [countdown, setCountdown, winner, timer, now]);

    const centerText = React.useMemo(() => {
        const text = isDefined(winner) ? `${teamSpecs[winner].name} wins!` : `${teamSpecs[turn].name}'s turn`;

        if (!isDefined(countdown) || isDefined(winner)) {
            return text;
        }

        return `${text} [${countdown}s]`;
    }, [winner, turn, countdown]);

    return (
        <h1
            style={{ color: teamSpecs[winner ?? turn].hue[600] }}
            className={isDefined(countdown) && countdown < 10 ? classes.blink : undefined}
        >
            {centerText}
        </h1>
    );
};

const Header = ({ send, state, pState, pTeam }: GameViewProps) => {
    const myTurn = state.turn === pTeam;

    return (
        <Grid container direction="row" justify="space-between" alignItems="center" spacing={2}>
            <Grid item xs style={{ textAlign: 'left' }}>
                <h1>
                    {state.wordsLeft.map((n, team) => {
                        return (
                            <span key={team}>
                                {team !== 0 ? <span> - </span> : null}
                                <span
                                    style={{
                                        color: teamSpecs[team].hue[600],
                                        fontWeight: state.turn === team ? 'bold' : undefined,
                                    }}
                                >
                                    {n}
                                </span>
                            </span>
                        );
                    })}
                </h1>
            </Grid>
            <Grid item xs style={{ textAlign: 'center' }}>
                <CenterText {...state} />
            </Grid>
            <Grid item xs style={{ textAlign: 'right' }}>
                <Button
                    type="button"
                    variant="outlined"
                    onClick={() => myTurn && !pState.spymaster && send.endTurn()}
                    disabled={!myTurn || pState.spymaster || isDefined(state.winner)}
                >
                    End turn
                </Button>
            </Grid>
        </Grid>
    );
};

const sliderMarks = range(30, 301, 30).map((v) => ({ value: v }));

interface TimerSliderProps {
    version: number;
    timer: StateTimer;
    onCommit: (value: number) => void;
}

interface TimerValue {
    version: number;
    turnTime: number;
}

const TimerSlider = ({ version, timer, onCommit }: TimerSliderProps) => {
    const [value, setValue] = React.useState<TimerValue>({ version, turnTime: timer.turnTime });

    React.useEffect(() => {
        if (version !== value.version) {
            setValue({ version, turnTime: timer.turnTime });
        }
    }, [version, value.version, timer.turnTime]);

    const valueStr = React.useMemo(() => {
        const turnTime = value.turnTime;
        switch (turnTime) {
            case 30:
                return '30 seconds';
            case 60:
                return '60 seconds';
            default:
                if (turnTime % 60 === 0) {
                    return `${turnTime / 60} minutes`;
                }

                return `${(turnTime / 60).toFixed(1)} minutes`;
        }
    }, [value.turnTime]);

    return (
        <>
            <Typography id="timer-slider" gutterBottom>
                Timer: {valueStr}
            </Typography>
            <Slider
                style={{ color: orange[500] }}
                aria-labelledby="timer-slider"
                value={value.turnTime}
                marks={sliderMarks}
                step={null}
                min={sliderMarks[0].value}
                max={sliderMarks[sliderMarks.length - 1].value}
                onChange={(_e, v) => {
                    assertTrue(!isArray(v));
                    setValue({ version: value.version, turnTime: v });
                }}
                onChangeCommitted={(_e, v) => {
                    assertTrue(!isArray(v));
                    onCommit(v);
                }}
            />
        </>
    );
};

const useSidebarStyles = makeStyles((_theme: Theme) =>
    createStyles({
        dropzone: {
            backgroundColor: 'initial',
        },
        previewGrid: {
            width: '100%',
        },
    })
);

const Sidebar = ({ send, state, pState, pTeam }: GameViewProps) => {
    const classes = useSidebarStyles();
    const theme = useTheme();
    const nameShade = theme.palette.type === 'dark' ? 400 : 600;

    const teams = state.teams;
    const lists = state.lists;

    const wordCount = React.useMemo(
        () =>
            lists.reduce((curr, l) => {
                if (l.enabled) {
                    return curr + l.count;
                }
                return curr;
            }, 0),
        [lists]
    );

    const [uploadOpen, setUploadOpen] = React.useState(false);

    return (
        <>
            <h2>Teams</h2>
            <Paper style={{ padding: '0.5rem' }}>
                <div
                    style={{
                        display: 'grid',
                        gridGap: '0.5rem',
                        gridTemplateColumns: `repeat(${teams.length}, 1fr)`,
                    }}
                >
                    {teams.map((team, i) => (
                        <React.Fragment key={i}>
                            <Button
                                type="button"
                                variant="contained"
                                size="small"
                                style={{
                                    gridRow: 1,
                                    gridColumn: i + 1,
                                    width: '100%',
                                    color: 'white',
                                    backgroundColor: teamSpecs[i].hue[600],
                                }}
                                disabled={pTeam === i}
                                onClick={() => send.changeTeam(i)}
                            >
                                Join {teamSpecs[i].name}
                            </Button>
                            {team.map((member, j) => (
                                <span
                                    key={`member-${j}`}
                                    style={{
                                        gridRow: j + 2,
                                        gridColumn: i + 1,
                                        color: teamSpecs[i].hue[nameShade],
                                        fontStyle: member.playerID === pState.playerID ? 'italic' : undefined,
                                    }}
                                >
                                    {member.spymaster ? `[${member.nickname}]` : member.nickname}
                                </span>
                            ))}
                        </React.Fragment>
                    ))}
                </div>
                <Button
                    type="button"
                    variant="outlined"
                    size="small"
                    style={{ width: '100%', marginTop: '0.5rem' }}
                    onClick={send.randomizeTeams}
                >
                    Randomize teams
                </Button>
            </Paper>

            <h2>Packs</h2>
            <p style={{ fontStyle: 'italic' }}>{wordCount} words in the selected packs.</p>
            <div style={{ display: 'grid', gridGap: '0.5rem' }}>
                {lists.map((pack, i) => (
                    <div key={i} style={{ gridRow: i + 1 }}>
                        <Button
                            type="button"
                            variant={pack.enabled ? 'contained' : 'outlined'}
                            size="small"
                            style={{ width: pack.custom && !pack.enabled ? '90%' : '100%' }}
                            onClick={() => send.changePack(i, !pack.enabled)}
                        >
                            {pack.custom ? `Custom: ${pack.name}` : pack.name}
                        </Button>
                        {pack.custom && !pack.enabled ? (
                            <IconButton size="small" style={{ width: '10%' }} onClick={() => send.removePack(i)}>
                                <Delete />
                            </IconButton>
                        ) : null}
                    </div>
                ))}
                {lists.length >= 10 ? null : (
                    <>
                        <Button
                            type="button"
                            size="small"
                            startIcon={<Add />}
                            style={{ width: '100%', gridRow: lists.length + 2 }}
                            onClick={() => setUploadOpen(true)}
                        >
                            Upload packs
                        </Button>
                        <DropzoneDialog
                            acceptedFiles={['.txt']}
                            cancelButtonText={'cancel'}
                            submitButtonText={'submit'}
                            dropzoneClass={classes.dropzone}
                            dropzoneText={'Text files, one word per line. Click or drag to upload.'}
                            previewGridClasses={{ container: classes.previewGrid }}
                            previewText={'Files:'}
                            maxFileSize={1000000}
                            open={uploadOpen}
                            onClose={() => setUploadOpen(false)}
                            onSave={async (files) => {
                                setUploadOpen(false);

                                const packs: WordPack[] = [];

                                for (let i = 0; i < files.length; i++) {
                                    const file = files[i];
                                    const name = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
                                    const words = (await file.text())
                                        .split('\n')
                                        .map((word) => word.trim())
                                        .filter((word) => word);

                                    if (words.length < 25) {
                                        continue;
                                    }

                                    packs.push({ name, words });
                                }

                                if (packs.length) {
                                    send.addPacks(packs);
                                }
                            }}
                        />
                    </>
                )}
            </div>
            {!isDefined(state.timer) ? null : (
                <div style={{ textAlign: 'left', marginTop: '1rem' }}>
                    <TimerSlider version={state.version} timer={state.timer} onCommit={send.changeTurnTime} />
                </div>
            )}
        </>
    );
};

const Board2 = ({ send, state, pState, pTeam }: GameViewProps) => {
    const myTurn = state.turn === pTeam;
    return (
        <Board
            words={state.board}
            onClick={(row, col) => myTurn && !pState.spymaster && send.reveal(row, col)}
            spymaster={pState.spymaster}
            myTurn={myTurn}
            winner={isDefined(state.winner)}
        />
    );
};

const Footer = ({ send, state, pState }: GameViewProps) => {
    const end = isDefined(state.winner);

    return (
        <Grid container direction="row" justify="space-between" alignItems="flex-start" spacing={2}>
            <Grid item xs style={{ textAlign: 'left' }}>
                <ButtonGroup
                    variant="outlined"
                    style={{ marginBottom: '0.5rem', marginRight: '0.5rem', display: 'inline' }}
                >
                    <Button
                        type="button"
                        variant={pState.spymaster ? undefined : 'contained'}
                        onClick={() => send.changeRole(false)}
                        startIcon={<Search />}
                        disabled={end}
                    >
                        Guesser
                    </Button>
                    <Button
                        type="button"
                        variant={pState.spymaster ? 'contained' : undefined}
                        onClick={() => send.changeRole(true)}
                        startIcon={<Person />}
                        disabled={end}
                    >
                        Spymaster
                    </Button>
                </ButtonGroup>
                <ButtonGroup
                    variant="outlined"
                    style={{ marginBottom: '0.5rem', marginRight: '0.5rem', display: 'inline' }}
                >
                    <Button
                        type="button"
                        variant={isDefined(state.timer) ? undefined : 'contained'}
                        onClick={() => send.changeTurnMode(false)}
                    >
                        <TimerOff />
                    </Button>
                    <Button
                        type="button"
                        variant={isDefined(state.timer) ? 'contained' : undefined}
                        onClick={() => send.changeTurnMode(true)}
                    >
                        <Timer />
                    </Button>
                </ButtonGroup>
            </Grid>
            <Grid item xs style={{ textAlign: 'right' }}>
                <Button
                    type="button"
                    variant={end ? 'contained' : 'outlined'}
                    color={end ? undefined : 'secondary'}
                    style={end ? { color: 'white', backgroundColor: green[500] } : undefined}
                    onClick={send.newGame}
                >
                    New game
                </Button>
            </Grid>
        </Grid>
    );
};

const useStyles = makeStyles((theme: Theme) =>
    createStyles({
        root: {
            height: '100vh',
            display: 'flex',
        },
        wrapper: {
            width: '100%',
            textAlign: 'center',
            paddingLeft: theme.spacing(2),
            paddingRight: theme.spacing(2),
            // Emulate the MUI Container component.
            maxWidth: `1560px`, // TODO: Surely this shouldn't be hardcoded.
            margin: 'auto',
            // marginRight: 'auto',
            display: 'grid',
            gridGap: theme.spacing(2),
            gridTemplateAreas: '"header" "board" "footer" "sidebar"',
            [theme.breakpoints.down('lg')]: {
                paddingTop: theme.spacing(5),
            },
            [theme.breakpoints.up('lg')]: {
                gridTemplateColumns: '1fr 4fr 1fr',
                gridTemplateRows: '1fr auto 1fr',
                gridTemplateAreas: '". header ." "sidebar board ." ". footer ."',
            },
        },
        header: {
            gridArea: 'header',
        },
        board: {
            gridArea: 'board',
        },
        footer: {
            gridArea: 'footer',
        },
        sidebar: {
            gridArea: 'sidebar',
        },
    })
);

export const GameView = (props: GameViewProps) => {
    const classes = useStyles();

    return (
        <div className={classes.root}>
            <div
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    margin: '0.5rem',
                }}
            >
                <Button type="button" onClick={props.leave} startIcon={<ArrowBack />} style={{ marginRight: '0.5rem' }}>
                    Leave
                </Button>
                <ClipboardButton
                    buttonText="Copy Room URL"
                    toCopy={`${window.location.origin}/?roomID=${props.roomID}`}
                    icon={<Link />}
                />
            </div>
            <div className={classes.wrapper}>
                <div className={classes.header}>
                    <Header {...props} />
                </div>
                <div className={classes.board}>
                    <Board2 {...props} />
                </div>
                <div className={classes.footer}>
                    <Footer {...props} />
                </div>
                <div className={classes.sidebar}>
                    <Sidebar {...props} />
                </div>
            </div>
        </div>
    );
};
