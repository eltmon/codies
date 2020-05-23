import { blue, red } from '@material-ui/core/colors';

export type TeamHue = { [x in keyof typeof red]: string };

export interface TeamSpec {
    name: string;
    hue: TeamHue;
}

export const teamSpecs: TeamSpec[] = [
    { name: 'Red', hue: red },
    { name: 'Blue', hue: blue },
];
