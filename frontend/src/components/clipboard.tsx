import { Button, Tooltip } from '@material-ui/core';
import copy from 'clipboard-copy';
import * as React from 'react';

export interface ClipboardButtonProps {
    buttonText: string;
    toCopy: string;
    icon: React.ReactNode;
}

export const ClipboardButton = (props: ClipboardButtonProps) => {
    const [showTooltip, setShowTooltip] = React.useState(false);

    return (
        <Tooltip
            open={showTooltip}
            title="Copied to clipboard."
            leaveDelay={2000}
            onClose={() => setShowTooltip(false)}
        >
            <Button
                type="button"
                onClick={() => {
                    copy(props.toCopy);
                    setShowTooltip(true);
                }}
                startIcon={props.icon}
            >
                {props.buttonText}
            </Button>
        </Tooltip>
    );
};
