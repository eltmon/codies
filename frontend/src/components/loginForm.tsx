import { Button, ButtonGroup, createStyles, makeStyles, TextField, Theme } from '@material-ui/core';
import * as React from 'react';
import { Controller, useForm } from 'react-hook-form';

import { nameofFactory } from '../common';

export interface LoginFormData {
    nickname: string;
    roomName: string;
    roomPass: string;
    create: boolean;
}

const formName = nameofFactory<LoginFormData>();

const noComplete = {
    autoComplete: 'off',
    'data-lpignore': 'true',
};

const useStyles = makeStyles((theme: Theme) =>
    createStyles({
        padBottom: {
            marginBottom: theme.spacing(2),
        },
    })
);

export interface LoginFormProps {
    existingRoom: boolean;
    onSubmit: (data: LoginFormData) => Promise<void>;
    errorMessage?: string;
}

export function LoginForm(props: LoginFormProps) {
    const classes = useStyles();
    const { control, handleSubmit, errors, setValue, register } = useForm<LoginFormData>({});
    React.useEffect(() => register({ name: formName('create') }), [register]);
    const doSubmit = handleSubmit(props.onSubmit);

    return (
        <form onSubmit={(e) => e.preventDefault()}>
            {props.existingRoom ? (
                <div>
                    <em>Joining existing game; please choose a nickname.</em>
                </div>
            ) : null}

            <div className={props.existingRoom ? classes.padBottom : undefined}>
                <Controller
                    control={control}
                    as={TextField}
                    name={formName('nickname')}
                    label="Nickname"
                    defaultValue=""
                    error={!!errors.nickname}
                    rules={{ required: true, minLength: 3, maxLength: 16 }}
                    fullWidth={true}
                    inputProps={noComplete}
                    autoFocus
                />
            </div>

            {props.existingRoom ? null : (
                <>
                    <div>
                        <Controller
                            control={control}
                            as={TextField}
                            name={formName('roomName')}
                            label="Room name"
                            defaultValue=""
                            error={!!errors.roomName}
                            rules={{ required: true, minLength: 3, maxLength: 16 }}
                            fullWidth={true}
                            inputProps={noComplete}
                        />
                    </div>

                    <div className={classes.padBottom}>
                        <Controller
                            control={control}
                            as={TextField}
                            name={formName('roomPass')}
                            label="Password"
                            defaultValue=""
                            type="password"
                            error={!!errors.roomPass}
                            rules={{ required: true, minLength: 1 }}
                            fullWidth={true}
                            inputProps={noComplete}
                        />
                    </div>
                </>
            )}

            {props.errorMessage && (
                <div className={classes.padBottom}>
                    <em>{props.errorMessage}</em>
                </div>
            )}

            <div>
                <ButtonGroup variant="contained">
                    <Button
                        type="submit"
                        onClick={() => {
                            setValue(formName('create'), false);
                            doSubmit();
                        }}
                    >
                        Join game
                    </Button>

                    {props.existingRoom ? null : (
                        <Button
                            type="button"
                            onClick={() => {
                                setValue(formName('create'), true);
                                doSubmit();
                            }}
                        >
                            Create new game
                        </Button>
                    )}
                </ButtonGroup>
            </div>
        </form>
    );
}
