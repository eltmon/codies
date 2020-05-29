import {
    Backdrop,
    Button,
    ButtonGroup,
    createStyles,
    Fade,
    Grid,
    IconButton,
    makeStyles,
    Modal,
    Paper,
    Slider,
    TextField,
    Theme,
    Typography,
    useTheme,
} from '@material-ui/core';
import { green, orange } from '@material-ui/core/colors';
import {
    Add,
    ArrowBack,
    Delete,
    Link,
    Person,
    Search,
    Timer,
    TimerOff,
    Visibility,
    VisibilityOff,
} from '@material-ui/icons';
import { ok as assertTrue } from 'assert';
import isArray from 'lodash/isArray';
import range from 'lodash/range';
import { DropzoneDialog } from 'material-ui-dropzone';
import * as React from 'react';
import isEqual from 'react-fast-compare';
import { Controller, useForm } from 'react-hook-form';
import { DeepReadonly } from 'ts-essentials';

import { isDefined, nameofFactory, noComplete } from '../common';
import { Board } from '../components/board';
import { ClipboardButton } from '../components/clipboard';
import { useServerTime } from '../hooks';
import { State, StatePlayer, StateTeams, StateTimer, StateWordList, WordPack } from '../protocol';
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
    changeHideBomb: (HideBomb: boolean) => void;
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

interface CenterTextProps {
    winner: number | undefined | null;
    timer: StateTimer | undefined | null;
    turn: number;
}

const CenterText = ({ winner, timer, turn }: DeepReadonly<CenterTextProps>) => {
    const classes = useCenterStyles();
    const [countdown, setCountdown] = React.useState<number | undefined>();
    const { now } = useServerTime();
    const deadline = timer?.turnEnd;

    React.useEffect(() => {
        const updateCountdown = () => {
            if (isDefined(winner)) {
                setCountdown(undefined);
                return;
            }

            if (deadline === undefined) {
                if (countdown !== undefined) {
                    setCountdown(undefined);
                }
                return;
            }

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
    }, [countdown, winner, deadline, now]);

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

interface HeaderProps {
    send: Sender;
    myTurn: boolean;
    winner: number | undefined | null;
    spymaster: boolean;
    turn: number;
    wordsLeft: number[];
    timer: StateTimer | undefined | null;
}

const Header = React.memo(function Header({
    send,
    myTurn,
    winner,
    spymaster,
    turn,
    wordsLeft,
    timer,
}: DeepReadonly<HeaderProps>) {
    return (
        <Grid container direction="row" justify="space-between" alignItems="center" spacing={2}>
            <Grid item xs style={{ textAlign: 'left' }}>
                <h1>
                    {wordsLeft.map((n, team) => {
                        return (
                            <span key={team}>
                                {team !== 0 ? <span> - </span> : null}
                                <span
                                    style={{
                                        color: teamSpecs[team].hue[600],
                                        fontWeight: turn === team ? 'bold' : undefined,
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
                <CenterText winner={winner} timer={timer} turn={turn} />
            </Grid>
            <Grid item xs style={{ textAlign: 'right' }}>
                <Button
                    type="button"
                    variant="outlined"
                    onClick={() => myTurn && !spymaster && send.endTurn()}
                    disabled={!myTurn || spymaster || isDefined(winner)}
                >
                    End turn
                </Button>
            </Grid>
        </Grid>
    );
},
isEqual);

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

const useChangeNicknameStyles = makeStyles((theme: Theme) =>
    createStyles({
        modal: {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
        },
        paper: {
            border: '2px solid #000',
            boxShadow: theme.shadows[5],
            padding: theme.spacing(2, 4, 3),
            maxWidth: '500px',
        },
        label: {
            color: theme.palette.text.secondary + ' !important',
        },
    })
);

interface ChangeNicknameFormData {
    nickname: string;
}

const ChangeNicknameButton = ({ send }: { send: Sender }) => {
    const classes = useChangeNicknameStyles();
    const [open, setOpen] = React.useState(false);
    const handleOpen = () => setOpen(true);
    const handleClose = () => setOpen(false);

    const formName = React.useMemo(() => nameofFactory<ChangeNicknameFormData>(), []);
    const { control, handleSubmit, errors } = useForm<ChangeNicknameFormData>({});
    const doSubmit = handleSubmit((data) => {
        handleClose();
        send.changeNickname(data.nickname);
    });

    return (
        <>
            <Button
                type="button"
                variant="outlined"
                size="small"
                style={{ width: '100%', marginTop: '0.5rem' }}
                onClick={handleOpen}
            >
                Change nickname
            </Button>
            <Modal
                className={classes.modal}
                open={open}
                onClose={handleClose}
                closeAfterTransition
                BackdropComponent={Backdrop}
                BackdropProps={{
                    timeout: 500,
                }}
            >
                <Fade in={open}>
                    <Paper className={classes.paper}>
                        <form>
                            <div>
                                <Controller
                                    control={control}
                                    as={TextField}
                                    name={formName('nickname')}
                                    label="Nickname"
                                    defaultValue=""
                                    error={!!errors.nickname}
                                    rules={{ required: true, minLength: 1, maxLength: 16 }}
                                    fullWidth={true}
                                    inputProps={noComplete}
                                    autoFocus
                                    InputLabelProps={{ classes: { focused: classes.label } }}
                                />
                            </div>
                            <div>
                                <Button
                                    type="submit"
                                    onClick={doSubmit}
                                    variant="contained"
                                    style={{ width: '100%', marginTop: '0.5rem' }}
                                >
                                    Change
                                </Button>
                            </div>
                        </form>
                    </Paper>
                </Fade>
            </Modal>
        </>
    );
};

interface SidebarTeamsProps {
    send: Sender;
    teams: StateTeams;
    pTeam: number;
    playerID: string;
}

const SidebarTeams = React.memo(function SidebarTeams({
    send,
    teams,
    pTeam,
    playerID,
}: DeepReadonly<SidebarTeamsProps>) {
    const theme = useTheme();
    const nameShade = theme.palette.type === 'dark' ? 400 : 600;

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
                                        fontStyle: member.playerID === playerID ? 'italic' : undefined,
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
                    style={{ width: '100%', marginTop: '1.5rem' }}
                    onClick={send.randomizeTeams}
                >
                    Randomize teams
                </Button>
                <ChangeNicknameButton send={send} />
            </Paper>
        </>
    );
},
isEqual);

const useSidebarPacksStyles = makeStyles((_theme: Theme) =>
    createStyles({
        dropzone: {
            backgroundColor: 'initial',
        },
        previewGrid: {
            width: '100%',
        },
    })
);

interface SidebarPacksProps {
    send: Sender;
    lists: StateWordList[];
}

const SidebarPacks = React.memo(function SidebarPacks({ send, lists }: DeepReadonly<SidebarPacksProps>) {
    const classes = useSidebarPacksStyles();

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
        </>
    );
}, isEqual);

interface SidebarProps {
    send: Sender;
    teams: StateTeams;
    lists: StateWordList[];
    pTeam: number;
    playerID: string;
    version: number;
    timer: StateTimer | undefined | null;
}

const Sidebar = ({ send, teams, lists, pTeam, playerID, version, timer }: DeepReadonly<SidebarProps>) => {
    return (
        <>
            <SidebarTeams send={send} teams={teams} pTeam={pTeam} playerID={playerID} />
            <SidebarPacks send={send} lists={lists} />
            {!isDefined(timer) ? null : (
                <div style={{ textAlign: 'left', marginTop: '1rem' }}>
                    <TimerSlider version={version} timer={timer} onCommit={send.changeTurnTime} />
                </div>
            )}
        </>
    );
};

const useFooterStyles = makeStyles((_theme: Theme) =>
    createStyles({
        root: {
            display: 'flex',
            justifyContent: 'space-between',
            alignContent: 'flex-start',
            flexWrap: 'wrap',
        },
        left: {
            display: 'flex',
            alignContent: 'flex-start',
            flexWrap: 'wrap',
        },
        leftButton: {
            marginBottom: '0.5rem',
            marginRight: '0.5rem',
        },
    })
);

interface FooterProps {
    send: Sender;
    end: boolean;
    spymaster: boolean;
    hideBomb: boolean;
    hasTimer: boolean;
}

const Footer = React.memo(function Footer({ send, end, spymaster, hideBomb, hasTimer }: DeepReadonly<FooterProps>) {
    const classes = useFooterStyles();

    return (
        <div className={classes.root}>
            <div className={classes.left}>
                <ButtonGroup variant="outlined" className={classes.leftButton}>
                    <Button
                        type="button"
                        variant={spymaster ? undefined : 'contained'}
                        onClick={() => send.changeRole(false)}
                        startIcon={<Search />}
                        disabled={end}
                    >
                        Guesser
                    </Button>
                    <Button
                        type="button"
                        variant={spymaster ? 'contained' : undefined}
                        onClick={() => send.changeRole(true)}
                        startIcon={<Person />}
                        disabled={end}
                    >
                        Spymaster
                    </Button>
                </ButtonGroup>
                <ButtonGroup variant="outlined" className={classes.leftButton}>
                    <Button
                        type="button"
                        variant={hideBomb ? undefined : 'contained'}
                        onClick={() => send.changeHideBomb(false)}
                        startIcon={<Visibility />}
                    >
                        Show bomb
                    </Button>
                    <Button
                        type="button"
                        variant={hideBomb ? 'contained' : undefined}
                        onClick={() => send.changeHideBomb(true)}
                        startIcon={<VisibilityOff />}
                    >
                        Hide bomb
                    </Button>
                </ButtonGroup>
                <ButtonGroup variant="outlined" className={classes.leftButton}>
                    <Button
                        type="button"
                        variant={hasTimer ? undefined : 'contained'}
                        onClick={() => send.changeTurnMode(false)}
                    >
                        <TimerOff />
                    </Button>
                    <Button
                        type="button"
                        variant={hasTimer ? 'contained' : undefined}
                        onClick={() => send.changeTurnMode(true)}
                    >
                        <Timer />
                    </Button>
                </ButtonGroup>
            </div>
            <div>
                <Button
                    type="button"
                    variant={end ? 'contained' : 'outlined'}
                    color={end ? undefined : 'secondary'}
                    style={end ? { color: 'white', backgroundColor: green[500] } : undefined}
                    onClick={send.newGame}
                >
                    New game
                </Button>
            </div>
        </div>
    );
}, isEqual);

const useCornerButtonsStyle = makeStyles((_theme: Theme) =>
    createStyles({
        wrapper: {
            position: 'absolute',
            top: 0,
            left: 0,
            margin: '0.5rem',
        },
        button: {
            marginRight: '0.5rem',
        },
    })
);

const CornerButtons = React.memo(function CornerButtons({ roomID, leave }: { roomID: string; leave: () => void }) {
    const classes = useCornerButtonsStyle();

    return (
        <>
            <div className={classes.wrapper}>
                <Button type="button" onClick={leave} startIcon={<ArrowBack />} className={classes.button}>
                    Leave
                </Button>
                <ClipboardButton
                    buttonText="Copy Room URL"
                    toCopy={`${window.location.origin}/?roomID=${roomID}`}
                    icon={<Link />}
                />
            </div>
        </>
    );
});

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

export interface GameViewProps {
    roomID: string;
    leave: () => void;
    send: Sender;
    state: State;
    pState: StatePlayer;
    pTeam: number;
}

export const GameView = ({ roomID, leave, send, state, pState, pTeam }: DeepReadonly<GameViewProps>) => {
    const classes = useStyles();
    const end = isDefined(state.winner);
    const myTurn = state.turn === pTeam;

    return (
        <div className={classes.root}>
            <CornerButtons roomID={roomID} leave={leave} />
            <div className={classes.wrapper}>
                <div className={classes.header}>
                    <Header
                        send={send}
                        myTurn={myTurn}
                        winner={state.winner}
                        spymaster={pState.spymaster}
                        turn={state.turn}
                        wordsLeft={state.wordsLeft}
                        timer={state.timer}
                    />
                </div>
                <div className={classes.board}>
                    <Board
                        words={state.board}
                        onClick={send.reveal}
                        spymaster={pState.spymaster}
                        myTurn={myTurn}
                        winner={end}
                    />
                </div>
                <div className={classes.footer}>
                    <Footer
                        send={send}
                        end={end}
                        spymaster={pState.spymaster}
                        hideBomb={state.hideBomb}
                        hasTimer={isDefined(state.timer)}
                    />
                </div>
                <div className={classes.sidebar}>
                    <Sidebar
                        send={send}
                        teams={state.teams}
                        lists={state.lists}
                        pTeam={pTeam}
                        playerID={pState.playerID}
                        version={state.version}
                        timer={state.timer}
                    />
                </div>
            </div>
        </div>
    );
};
