/*
 * This file is part of the Symfony package.
 *
 * (c) Fabien Potencier <fabien@symfony.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

'use strict';

import { clearDOM } from '@symfony/stimulus-testing';
import { startStimulus } from '../tools';
import { createEvent, fireEvent, getByLabelText, getByText, waitFor } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import fetchMock from 'fetch-mock-jest';

describe('LiveController parent -> child component tests', () => {
    const parentTemplate = (data) => {
        return `
            <div
                data-controller="live"
                data-live-url-value="http://localhost/_components/parent"
            >
                <span>Title: ${data.title}</span>
                <span>Description in Parent: ${data.description}</span>

                <button
                    data-action="live#$render"
                >Parent Re-render</button>

                ${childTemplate({ description: data.description })}
            </div>
        `
    }

    const childTemplate = (data) => `
        <div
            data-controller="live"
            data-live-url-value="http://localhost/_components/my_component"
        >
            <!-- form field not mapped with data-model -->
            <label>
                Description:
                <input
                    value="${data.description}"
                    data-model="description"
                    data-action="live#update"
                >
            </label>

            <div>Description in child: ${data.description}</div>

            <button
                data-action="live#$render"
            >Child Re-render</button>
        </div>
    `;

    const startStimulusForParentChild = async (html, data, childData) => {
        const testData = await startStimulus(
            parentTemplate(data),
            data
        );

        // setup the values on the child element
        testData.element.querySelector('[data-controller="live"]').dataset.liveDataValue = JSON.stringify(childData);

        return testData;
    }

    afterEach(() => {
        clearDOM();
        fetchMock.reset();
    });

    it('renders parent component without affecting child component', async () => {
        const data = { title: 'Parent component', description: 'i love components' };
        const { element } = await startStimulusForParentChild(
            parentTemplate(data),
            data,
            { description: data.description }
        );

        // on child re-render, use a new description
        fetchMock.get('http://localhost/_components/my_component?description=i+love+components', {
            html: childTemplate({ description: 'i love popcorn' }),
            data: { description: 'i love popcorn' }
        });

        // reload the child template
        getByText(element, 'Child Re-render').click();
        await waitFor(() => expect(element).toHaveTextContent('Description in child: i love popcorn'));

        // on parent re-render, render the child template differently
        fetchMock.get('http://localhost/_components/parent?title=Parent+component&description=i+love+components', {
            html: parentTemplate({ title: 'Changed parent', description: 'changed child description' }),
            data: { title: 'Changed parent', description: 'changed child description' }
        });
        getByText(element, 'Parent Re-render').click();
        await waitFor(() => expect(element).toHaveTextContent('Title: Changed parent'));

        // the child component should *not* have updated
        expect(element).toHaveTextContent('Description in child: i love popcorn');
    });

    it('updates child model and parent model in a deferred way', async () => {
        const data = { title: 'Parent component', description: 'i love' };
        const { element, controller } = await startStimulusForParentChild(
            parentTemplate(data),
            data,
            { description: data.description }
        );

        // verify the child request contains the correct description & re-render
        fetchMock.get('http://localhost/_components/my_component?description=i+love+turtles', {
            html: childTemplate({ description: 'i love turtles' }),
            data: { description: 'i love turtles' }
        });

        // change the description in the child
        const inputElement = getByLabelText(element, 'Description:');
        await userEvent.type(inputElement, ' turtles');

        // wait for the render to complete
        await waitFor(() => expect(element).toHaveTextContent('Description in child: i love turtles'));

        // the parent should not re-render
        expect(element).not.toHaveTextContent('Description in parent: i love turtles');
        // but the value DID update
        expect(controller.dataValue.description).toEqual('i love turtles');
    });

    // TODO - what if a child component re-renders and comes down with
    // a changed set of data? Should that update the parent's data?
});
