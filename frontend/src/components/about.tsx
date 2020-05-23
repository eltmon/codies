import { Backdrop, Button, createStyles, Fade, makeStyles, Modal, Paper, Theme } from '@material-ui/core';
import { Help } from '@material-ui/icons';
import * as React from 'react';

const useStyles = makeStyles((theme: Theme) =>
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
    })
);

export const AboutButton = (props: { style?: React.CSSProperties }) => {
    const classes = useStyles();
    const [open, setOpen] = React.useState(false);

    const handleOpen = () => {
        setOpen(true);
    };

    const handleClose = () => {
        setOpen(false);
    };

    return (
        <span style={props.style}>
            <Button type="button" startIcon={<Help />} onClick={handleOpen}>
                About
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
                        <h2>How to play</h2>
                        <p>
                            In Codenames, spymasters give one word clues pointing to multiple words on the board, as
                            well as the number of words corresponding to that clue (for example, &quot;animal 3&quot;).
                            Their teammates then try to guess the words while avoiding the opposing team&apos;s, and may
                            guess as many times as the words the spymaster gave in their clue, plus an additional guess.
                        </p>
                    </Paper>
                </Fade>
            </Modal>
        </span>
    );
};
