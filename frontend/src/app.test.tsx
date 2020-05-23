import { render } from '@testing-library/react';
import React from 'react';

import { App } from './app';

test('renders codies name', () => {
    const { getByText } = render(<App />);
    const element = getByText(/codies/i);
    expect(element).toBeInTheDocument();
});
