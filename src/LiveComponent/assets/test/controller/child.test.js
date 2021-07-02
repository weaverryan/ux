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
                <span>Title: ${data.post.title}</span>
                <span>Description in Parent: ${data.post.content}</span>

                <input
                    type="text"
                    name="post[title]"
                    value="${data.post.title}"
                >

                ${childTemplate({ value: data.post.content })}

                <button
                    data-action="live#$render"
                >Parent Re-render</button>
            </div>
        `
    }

    const childTemplate = (data) => `
        <div
            data-controller="live"
            data-live-url-value="http://localhost/_components/child"
        >
            <!-- form field not mapped with data-model -->
            <label>
                Content:
                <input
                    value="${data.value}"
                    data-model="value"
                    name="post[content]"
                    data-action="live#update"
                >
            </label>

            <div>Value in child: ${data.value}</div>

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
        const data = { post: { title: 'Parent component', content: 'i love components' } };
        const { element } = await startStimulusForParentChild(
            parentTemplate(data),
            data,
            { value: data.post.content }
        );

        // on child re-render, use a new content
        fetchMock.get('http://localhost/_components/child?value=i+love+components', {
            html: childTemplate({ value: 'i love popcorn' }),
            data: { value: 'i love popcorn' }
        });

        // reload the child template
        getByText(element, 'Child Re-render').click();
        await waitFor(() => expect(element).toHaveTextContent('Value in child: i love popcorn'));

        // on parent re-render, render the child template differently
        fetchMock.get('begin:http://localhost/_components/parent', {
            html: parentTemplate({ post: { title: 'Changed title', content: 'changed content' } }),
            data: { post: { title: 'Changed title', content: 'changed content' } }
        });
        getByText(element, 'Parent Re-render').click();
        await waitFor(() => expect(element).toHaveTextContent('Title: Changed title'));

        // the child component should *not* have updated
        expect(element).toHaveTextContent('Value in child: i love popcorn');
    });

    it('updates child model and parent model in a deferred way', async () => {
        const data = { post: { title: 'Parent component', content: 'i love' } };
        const { element, controller } = await startStimulusForParentChild(
            parentTemplate(data),
            data,
            { value: data.post.content }
        );

        // verify the child request contains the correct description & re-render
        fetchMock.get('http://localhost/_components/child?value=i+love+turtles', {
            html: childTemplate({ value: 'i love turtles' }),
            data: { value: 'i love turtles' }
        });

        // change the description in the child
        const inputElement = getByLabelText(element, 'Content:');
        await userEvent.type(inputElement, ' turtles');

        // wait for the render to complete
        await waitFor(() => expect(element).toHaveTextContent('Value in child: i love turtles'));

        // the parent should not re-render
        expect(element).not.toHaveTextContent('Content in parent: i love turtles');
        // but the value DID update on the parent component
        // this is because the name="post[content]" in the child matches the parent model
        expect(controller.dataValue.post.content).toEqual('i love turtles');
    });

    // TODO - what if a child component re-renders and comes down with
    // a changed set of data? Should that update the parent's data?
});
