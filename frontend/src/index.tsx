import 'fontsource-roboto/300.css';
import 'fontsource-roboto/400.css';
import 'fontsource-roboto/500.css';
import 'fontsource-roboto/700.css';

import { createMuiTheme, CssBaseline, IconButton, responsiveFontSizes, ThemeProvider } from '@material-ui/core';
import { Brightness4, Brightness7 } from '@material-ui/icons';
import { useLocalStorage } from '@rehooks/local-storage';
import * as React from 'react';
import * as ReactDOM from 'react-dom';

import { App } from './app';
import { AboutButton } from './components/about';
import * as serviceWorker from './serviceWorker';

function useTheme() {
    const [themeName, setThemeName] = useLocalStorage<'light' | 'dark'>('themeName', 'dark');

    // Workaround for https://github.com/mui-org/material-ui/issues/20708.
    //
    // When in strict mode (development only), this is required to properly allow
    // the theme to be changed, as unused styles are not cleaned up. Create a new theme
    // each time, so that they're forced to be injected again at the end of the existing
    // block of stylesheets (as the styling library will see them as "new" styles, rather than
    // assuming they can just be reused).
    //
    // This is gross, as it means every time the button is clicked it's a slew of extra
    // stylesheets (each overriding the previous), but in production the cleanup works
    // so this extra work is "only" a performance hit. If the bug is ever fixed, we can
    // simply store two global themes and swap between them.
    const theme = responsiveFontSizes(
        createMuiTheme({
            palette: {
                type: themeName,
            },
        })
    );

    const toggleTheme = React.useMemo(() => {
        if (themeName === 'light') {
            return () => setThemeName('dark');
        } else {
            return () => setThemeName('light');
        }
    }, [themeName, setThemeName]);

    return { theme, toggleTheme, isDark: themeName === 'dark' };
}

const Root = () => {
    const { theme, toggleTheme, isDark } = useTheme();

    return (
        <React.StrictMode>
            <ThemeProvider theme={theme}>
                <CssBaseline />
                <div
                    style={{
                        position: 'absolute',
                        top: 0,
                        right: 0,
                        margin: '0.5rem',
                    }}
                >
                    <AboutButton style={{ marginRight: '0.5rem' }} />
                    <IconButton size="small" onClick={toggleTheme}>
                        {isDark ? <Brightness7 /> : <Brightness4 />}
                    </IconButton>
                </div>
                <App />
            </ThemeProvider>
        </React.StrictMode>
    );
};

ReactDOM.render(<Root />, document.getElementById('root'));

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: https://bit.ly/CRA-PWA
serviceWorker.unregister();

// TODO: Try using a service worker to aid in reloading when needed.
// let refreshing = false;
// serviceWorker.register({
//     onUpdate: () => {
//         if (!refreshing) {
//             refreshing = true;
//             window.location.reload();
//         }
//     }
// });
