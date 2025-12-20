import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
    palette: {
        primary: {
            main: '#2c3e50', // Dark Blue
        },
        secondary: {
            main: '#27ae60', // Green
        },
        background: {
            default: '#f4f7f6',
        },
    },
    components: {
        MuiButton: {
            styleOverrides: {
                root: {
                    textTransform: 'none', // Keep buttons sentence case
                },
            },
        },
    },
});
