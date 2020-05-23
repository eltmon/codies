import * as React from 'react';

export interface AspectDivProps {
    aspectRatio: string;
}

export const AspectDiv = (props: React.PropsWithChildren<AspectDivProps>) => {
    return (
        <div
            style={{
                position: 'relative',
                width: '100%',
                height: 0,
                paddingBottom: props.aspectRatio,
            }}
        >
            {props.children}
        </div>
    );
};
