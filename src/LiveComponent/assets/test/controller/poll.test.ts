/*
 * This file is part of the Symfony package.
 *
 * (c) Fabien Potencier <fabien@symfony.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

'use strict';

import { shutdownTest, createTest, initComponent } from '../tools';
import { createEvent, fireEvent, getByText, waitFor } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import fetchMock from 'fetch-mock-jest';

describe('LiveController polling Tests', () => {
    afterEach(() => {
        shutdownTest();
    })

    it('starts a poll', async () => {
        const test = await createTest({ renderCount: 0 }, (data: any) => `
            <div ${initComponent(data)} data-poll>
                <span>Render count: ${data.renderCount}</span>
            </div>
        `);

        // poll 1
        test.expectsAjaxCall('get')
            .expectSentData(test.initialData)
            .serverWillChangeData((data: any) => {
                data.renderCount = 1;
            })
            .init();
        // poll 2
        test.expectsAjaxCall('get')
            .expectSentData({renderCount: 1})
            .serverWillChangeData((data: any) => {
                data.renderCount = 2;
            })
            .init();

        await waitFor(() => expect(test.element).toHaveTextContent('Render count: 1'), {
            timeout: 2100
        });
        await waitFor(() => expect(test.element).toHaveTextContent('Render count: 2'), {
            timeout: 2100
        });
    });

    it('is controllable via modifiers', async () => {
        const test = await createTest({ renderCount: 0 }, (data: any) => `
            <div ${initComponent(data)} data-poll="delay(500)|$render">
                <span>Render count: ${data.renderCount}</span>
            </div>
        `);

        // poll 1
        test.expectsAjaxCall('get')
            .expectSentData(test.initialData)
            .serverWillChangeData((data: any) => {
                data.renderCount = 1;
            })
            .init();
        // poll 2
        test.expectsAjaxCall('get')
            .expectSentData({renderCount: 1})
            .serverWillChangeData((data: any) => {
                data.renderCount = 2;
            })
            .init();

        // only wait for about 500ms this time
        await waitFor(() => expect(test.element).toHaveTextContent('Render count: 1'), {
            timeout: 600
        });
        await waitFor(() => expect(test.element).toHaveTextContent('Render count: 2'), {
            timeout: 600
        });
    });

    it('can also call a live action', async () => {
        const test = await createTest({ renderCount: 0 }, (data: any) => `
            <div ${initComponent(data)} data-poll="delay(500)|saveAction">
                <span>Render count: ${data.renderCount}</span>
            </div>
        `);

        // poll 1
        test.expectsAjaxCall('post')
            .expectSentData(test.initialData)
            .expectActionCalled('saveAction')
            .serverWillChangeData((data: any) => {
                data.renderCount = 1;
            })
            .init();
        // poll 2
        test.expectsAjaxCall('post')
            .expectSentData({renderCount: 1})
            .expectActionCalled('saveAction')
            .serverWillChangeData((data: any) => {
                data.renderCount = 2;
            })
            .init();

        // only wait for about 500ms this time
        await waitFor(() => expect(test.element).toHaveTextContent('Render count: 1'), {
            timeout: 600
        });
        await waitFor(() => expect(test.element).toHaveTextContent('Render count: 2'), {
            timeout: 600
        });
    });
});
