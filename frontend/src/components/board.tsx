import { Button, createStyles, makeStyles, Theme, Typography } from '@material-ui/core';
import { brown, grey, orange, red } from '@material-ui/core/colors';
import { Fireworks } from 'fireworks/lib/react';
import * as React from 'react';
import isEqual from 'react-fast-compare';

import { isDefined, noop } from '../common';
import { StateBoard, StateTile } from '../protocol';
import { TeamHue, teamSpecs } from '../teams';
import { AspectDiv } from './aspectDiv';

function neutralStyle(revealed: boolean, spymaster: boolean): React.CSSProperties {
    return {
        color: revealed ? 'white' : 'black',
        backgroundColor: revealed ? brown[200] : grey[200],
        fontWeight: spymaster ? 'bold' : undefined,
    };
}

function bombStyle(revealed: boolean, spymaster: boolean): React.CSSProperties {
    return {
        color: revealed ? 'white' : grey[900],
        backgroundColor: grey[revealed ? 900 : 700],
        fontWeight: spymaster ? 'bold' : undefined,
    };
}

function teamStyle(teamHue: TeamHue, revealed: boolean, spymaster: boolean): React.CSSProperties {
    return {
        color: revealed ? 'white' : teamHue[900],
        backgroundColor: teamHue[revealed ? 600 : 200],
        fontWeight: spymaster ? 'bold' : undefined,
    };
}

function tileStyle(tile: StateTile, spymaster: boolean): React.CSSProperties {
    if (!isDefined(tile.view) || tile.view.neutral) {
        return neutralStyle(tile.revealed, spymaster);
    }

    if (tile.view.bomb) {
        return bombStyle(tile.revealed, spymaster);
    }

    const teamHue = teamSpecs[tile.view.team].hue;
    return teamStyle(teamHue, tile.revealed, spymaster);
}

const useTileStyles = makeStyles((theme: Theme) =>
    createStyles({
        button: {
            position: 'absolute',
            top: 0,
            left: 0,
            height: '100%',
            width: '100%',
            textAlign: 'center',
            [theme.breakpoints.down('sm')]: {
                padding: '6px',
            },
        },
        typo: {
            wordWrap: 'break-word',
            width: '100%',
            fontSize: theme.typography.h6.fontSize,
            [theme.breakpoints.down('sm')]: {
                fontSize: theme.typography.button.fontSize,
                lineHeight: '1rem',
            },
        },
        explosionWrapper: {
            zIndex: 100,
            position: 'absolute',
            margin: 'auto',
            height: 0,
            width: 0,
            top: 0,
            left: 0,
            bottom: 0,
            right: 0,
        },
        explosion: {
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none',
        },
    })
);

const fireworksProps = {
    interval: 0,
    colors: [red[700], orange[800], grey[500]],
    x: 0,
    y: 0,
};

interface TileProps {
    row: number;
    col: number;
    onClick: (row: number, col: number) => void;
    tile: StateTile;
    spymaster: boolean;
    myTurn: boolean;
    winner: boolean;
}

const Tile = React.memo(function Tile({ row, col, onClick, tile, spymaster, myTurn, winner }: TileProps) {
    const classes = useTileStyles();

    const bombRevealed = !!(tile.revealed && tile.view?.bomb);
    const alreadyExploded = React.useRef(bombRevealed);
    const explode = bombRevealed && !alreadyExploded.current;
    const disabled = spymaster || !myTurn || winner || tile.revealed;

    const reveal = React.useMemo(() => {
        if (disabled) {
            return noop;
        }
        return () => onClick(row, col);
    }, [disabled, row, col, onClick]);

    return (
        <AspectDiv aspectRatio="75%">
            <Button
                type="button"
                variant="contained"
                className={classes.button}
                onClick={reveal}
                style={tileStyle(tile, spymaster)}
                disabled={disabled}
            >
                <Typography variant="h6" className={classes.typo}>
                    {tile.word}
                </Typography>
            </Button>
            {explode ? (
                <div className={classes.explosionWrapper}>
                    <div className={classes.explosion}>
                        <Fireworks {...fireworksProps} />
                    </div>
                </div>
            ) : null}
        </AspectDiv>
    );
}, isEqual);

export interface BoardProps {
    words: StateBoard;
    spymaster: boolean;
    myTurn: boolean;
    winner: boolean;
    onClick: (row: number, col: number) => void;
}

const useStyles = makeStyles((theme: Theme) =>
    createStyles({
        root: {
            display: 'grid',
            gridGap: theme.spacing(0.5),
            [theme.breakpoints.up('lg')]: {
                gridGap: theme.spacing(1),
            },
            gridTemplateRows: (props: BoardProps) => `repeat(${props.words.length}, 1fr)`,
            gridTemplateColumns: (props: BoardProps) => `repeat(${props.words[0].length}, 1fr)`,
        },
    })
);

export const Board = React.memo(function Board(props: BoardProps) {
    const classes = useStyles(props);

    return (
        <div className={classes.root}>
            {props.words.map((arr, row) =>
                arr.map((tile, col) => (
                    <div key={row * props.words.length + col}>
                        <Tile
                            row={row}
                            col={col}
                            onClick={props.onClick}
                            tile={tile}
                            spymaster={props.spymaster}
                            myTurn={props.myTurn}
                            winner={props.winner}
                        />
                    </div>
                ))
            )}
        </div>
    );
}, isEqual);
