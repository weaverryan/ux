/*
 * This file is part of the Symfony package.
 *
 * (c) Fabien Potencier <fabien@symfony.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

'use strict';

import {
    createTestForExistingComponent,
    createTest,
    initComponent,
    shutdownTests
} from '../tools';
import {getByTestId, waitFor} from '@testing-library/dom';
import Component from '../../src/Component';
import userEvent from "@testing-library/user-event";

describe('LiveController parent -> child component tests', () => {
    afterEach(() => {
        shutdownTests();
    })

    it('adds & removes the child correctly', async () => {
        const childTemplate = (data: any) => `
            <div ${initComponent(data, {}, {id: 'the-child-id'})} data-testid="child"></div>
        `;

        const test = await createTest({}, (data: any) => `
            <div ${initComponent(data)}>
                ${childTemplate({})}
            </div>
        `);

        const parentComponent = test.component;
        const childElement = getByTestId(test.element, 'child');
        // @ts-ignore
        const childComponent = childElement.__component;
        if (!(childComponent instanceof Component)) {
            throw new Error('Child component did not load correctly')
        }

        // check that the relationships all loaded correctly
        expect(parentComponent.getChildren().size).toEqual(1);
        expect(parentComponent.getChildren().get('the-child-id')).toEqual(childComponent);
        expect(childComponent.getParent()).toEqual(parentComponent);

        // remove the child
        childElement.remove();
        // wait because the event is slightly async
        await waitFor(() => expect(parentComponent.getChildren().size).toEqual(0));
        expect(childComponent.getParent()).toBeNull();

        // now put it back!
        test.element.appendChild(childElement);
        await waitFor(() => expect(parentComponent.getChildren().size).toEqual(1));
        expect(parentComponent.getChildren().get('the-child-id')).toEqual(childComponent);
        expect(childComponent.getParent()).toEqual(parentComponent);

        // now remove the whole darn thing!
        test.element.remove();
        // this will, while disconnected, break the parent-child bond
        await waitFor(() => expect(parentComponent.getChildren().size).toEqual(0));
        expect(childComponent.getParent()).toBeNull();

        // put it *all* back
        document.body.appendChild(test.element);
        await waitFor(() => expect(parentComponent.getChildren().size).toEqual(1));
        expect(parentComponent.getChildren().get('the-child-id')).toEqual(childComponent);
        expect(childComponent.getParent()).toEqual(parentComponent);
    });

    it('sends a map of child fingerprints on re-render', async () => {
        const test = await createTest({}, (data: any) => `
            <div ${initComponent(data)}>
                <div ${initComponent({}, {}, {id: 'the-child-id1', fingerprint: 'child-fingerprint1'})}>Child1</div>
                <div ${initComponent({}, {}, {id: 'the-child-id2', fingerprint: 'child-fingerprint2'})}>Child2</div>
            </div>
        `);

        test.expectsAjaxCall('get')
            .expectSentData(test.initialData)
            .expectChildFingerprints({
                'the-child-id1': 'child-fingerprint1',
                'the-child-id2': 'child-fingerprint2'
            })
            .init();

        test.component.render();
        await waitFor(() => expect(test.element).toHaveAttribute('busy'));
    });

    it('removes missing child component on re-render', async () => {
        const test = await createTest({renderChild: true}, (data: any) => `
            <div ${initComponent(data)}>
                ${data.renderChild
                    ? `<div ${initComponent({}, {}, {id: 'the-child-id'})} data-testid="child">Child Component</div>`
                    : ''
                }
            </div>
        `);

        test.expectsAjaxCall('get')
            .expectSentData(test.initialData)
            .serverWillChangeData((data: any) => {
                data.renderChild = false;
            })
            .init();

        expect(test.element).toHaveTextContent('Child Component')
        expect(test.component.getChildren().size).toEqual(1);
        test.component.render();
        // wait for child to disappear
        await waitFor(() => expect(test.element).toHaveAttribute('busy'));
        await waitFor(() => expect(test.element).not.toHaveAttribute('busy'));
        expect(test.element).not.toHaveTextContent('Child Component')
        expect(test.component.getChildren().size).toEqual(0);
    });

    it('adds new child component on re-render', async () => {
        const test = await createTest({renderChild: false}, (data: any) => `
           <div ${initComponent(data)}>
               ${data.renderChild
            ? `<div ${initComponent({}, {}, {id: 'the-child-id'})} data-testid="child">Child Component</div>`
            : ''
        }
           </div>
       `);

        test.expectsAjaxCall('get')
            .expectSentData(test.initialData)
            .serverWillChangeData((data: any) => {
                data.renderChild = true;
            })
            .init();

        expect(test.element).not.toHaveTextContent('Child Component')
        expect(test.component.getChildren().size).toEqual(0);
        test.component.render();
        // wait for child to disappear
        await waitFor(() => expect(test.element).toHaveAttribute('busy'));
        await waitFor(() => expect(test.element).not.toHaveAttribute('busy'));
        expect(test.element).toHaveTextContent('Child Component')
        expect(test.component.getChildren().size).toEqual(1);
    });

    it('existing child component that has no props is ignored', async () => {
        const originalChild = `
            <div ${initComponent({}, {}, {id: 'the-child-id'})}>
                Original Child Component
            </div>
        `;
        const updatedChild = `
            <div ${initComponent({}, {}, {id: 'the-child-id'})}>
                Updated Child Component
            </div>
        `;

        const test = await createTest({useOriginalChild: true}, (data: any) => `
           <div ${initComponent(data)}>
               ${data.useOriginalChild ? originalChild : updatedChild}
           </div>
       `);

        test.expectsAjaxCall('get')
            .expectSentData(test.initialData)
            .serverWillChangeData((data: any) => {
                data.useOriginalChild = false;
            })
            .init();

        expect(test.element).toHaveTextContent('Original Child Component')
        test.component.render();
        // wait for Ajax call
        await waitFor(() => expect(test.element).toHaveAttribute('busy'));
        await waitFor(() => expect(test.element).not.toHaveAttribute('busy'));
        // child component is STILL here: the new rendering was ignored
        expect(test.element).toHaveTextContent('Original Child Component')
    });

    it('existing child component gets props & triggers re-render', async () => {
        const childTemplate = (data: any) => `
            <div ${initComponent(
                { fullName: data.fullName },
                { toUppercase: data.toUppercase },
                { id: 'the-child-id', fingerprint: 'original fingerprint'}
            )} data-testid="child-component">
                <input data-model="norender|fullName">
                Full Name: ${data.toUppercase ? data.fullName.toUpperCase() : data.fullName}
            </div>
        `;

        // a simpler version of the child is returned from the prent component's re-render
        const childReturnedFromParentCall = `
            <div ${initComponent(
                { firstName: 'Ryan' } /* will be ignored */,
                { toUppercase: true }, // new prop value
                { id: 'the-child-id', fingerprint: 'updated fingerprint'}
            )}><!-- no body needed --></div>
        `;

        const test = await createTest({useOriginalChild: true}, (data: any) => `
           <div ${initComponent(data)}>
               Using Original child: ${data.useOriginalChild ? 'yes' : 'no'}
               ${data.useOriginalChild
                    ? childTemplate({ fullName: 'Ryan', toUppercase: false })
                    : childReturnedFromParentCall
                }
           </div>
       `);

        const childElement = getByTestId(test.element, 'child-component');
        // @ts-ignore
        const childComponent = childElement.__component;
        if (!(childComponent instanceof Component)) {
            throw new Error('missing component');
        }
        // just used to mock the Ajax call
        const childTest = createTestForExistingComponent(childComponent);

        /*
         * The flow of this test:
         *      A) Original parent & child are rendered
         *      B) We type into a child "model" input, but it has "norender".
         *          So, no Ajax call is made, but the "data" on the child has been updated.
         *      C) We Re-render the parent component
         *      D) On re-render, the child element is empty, but its element has
         *          updated "props" and also a new "fingerprint". This mimics
         *          the condition on the server when the old child fingerprint
         *          that was just sent does not match the new fingerprint, indicating
         *          that data passed "into" the component to create it has changed.
         *          And so, the server returns the new set of props and the new
         *          fingerprint representing that "input" data.
         *      E) Seeing that its props have changed, the child component makes
         *          an Ajax call to re-render itself. But it keeps its modified data.
         */

        // B) Type into the child
        // |norender is used on this field
        userEvent.type(childTest.queryByDataModel('fullName'), ' Weaver');

        // C) Re-render the parent
        test.expectsAjaxCall('get')
            .expectSentData(test.initialData)
            .serverWillChangeData((data: any) => {
                data.useOriginalChild = false;
            })
            .init();
        test.component.render();
        // wait for parent Ajax call to start
        await waitFor(() => expect(test.element).toHaveAttribute('busy'));

        // E) Expect the child to re-render
        // after the parent Ajax call has finished, but shortly before it's
        // done processing, the child component should start its own Aja call
        // TODO make this work for the child
        childTest.expectsAjaxCall('get')
            // expect the modified firstName data
            // expect the new prop
            .expectSentData({ toUppercase: true, fullName: 'Ryan Weaver' })
            .willReturn(childTemplate)
            .init();

        // wait for parent Ajax call to finish
        await waitFor(() => expect(test.element).not.toHaveAttribute('busy'));
        // sanity check
        expect(test.element).toHaveTextContent('Using Original child: no')

        // after the parent re-renders, the child should already have received its new fingerprint
        expect(childComponent.fingerprint).toEqual('updated fingerprint');

        // wait for child to start and stop loading
        await waitFor(() => expect(childElement).toHaveAttribute('busy'));
        await waitFor(() => expect(childElement).not.toHaveAttribute('busy'));

        // child component re-rendered and there are a few important things here
        // 1) the toUppercase prop was changed after by the parent and that change remains
        // 2) The " Weaver" change to the "firstName" data was kept, not "run over"
        expect(childElement).toHaveTextContent('Full Name: RYAN WEAVER')
    });

    // TODO: response comes back with empty child element BUT with new fingerprint & props, those are pushed down onto the child, which will trigger a re-render
        // TODO: check above situation mixing element types - e.g. span vs div
        // TODO: check that data-live-id could be used to remove old component and use new component entirely, with fresh data
        // TODO: multiple children, even if they change position, are correctly handled
});
