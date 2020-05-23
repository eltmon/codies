import { Container, Grid } from '@material-ui/core';
import * as React from 'react';

export const Loading = (_props: {}) => {
    return (
        <Container>
            <Grid
                container
                style={{
                    minHeight: '100vh',
                    alignItems: 'center',
                    textAlign: 'center',
                }}
                justify="center"
            >
                <Grid item xs>
                    <h2>Loading....</h2>
                </Grid>
            </Grid>
        </Container>
    );
};
