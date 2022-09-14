/*
 * This file is part of the Symfony package.
 *
 * (c) Fabien Potencier <fabien@symfony.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

'use strict';

import { createTest, initComponent, shutdownTest } from '../tools';
import { getByTestId, getByText, waitFor } from '@testing-library/dom';

describe('LiveController data-loading Tests', () => {
    afterEach(() => {
        shutdownTest();
    })

    it('executes basic loading functionality on an element', async () => {
        // TODO: test that it hides on load, then re-shows later
        const test = await createTest({ food: 'pizza' }, (data: any) => `
            <div ${initComponent(data)}>
                <span>I like: ${data.food}</span> 

                <span data-loading="show" data-testid="loading-element">Loading...</span>
                <button data-action="live#$render">Re-Render</button>
            </div>
        `);

        test.expectsAjaxCall('get')
            .expectSentData(test.initialData)
            .serverWillChangeData((data: any) => {
                // to help detect when rendering is done
                data.food = 'popcorn';
            })
            // delay so we can check loading
            .delayResponse(100)
            .init();

        // wait for element to hide itself on start up
        await waitFor(() => expect(getByTestId(test.element, 'loading-element')).not.toBeVisible());

        getByText(test.element, 'Re-Render').click();
        // element should instantly be visible
        expect(getByTestId(test.element, 'loading-element')).toBeVisible();

        // wait for loading to finish
        await waitFor(() => expect(test.element).toHaveTextContent('I like: popcorn'));
        // loading element should now be hidden
        expect(getByTestId(test.element, 'loading-element')).not.toBeVisible();
    });

    // TESTS:
    // elements are hidden on initialization of the component
    // action modifier
    // multiple action modifiers in different order
    // delay (also with ation modifier)
    // re-render request AND action loading requests at the same time
    // reversal of loading in complex situations
    //
});
