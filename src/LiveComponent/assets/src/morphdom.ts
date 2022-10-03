import {
    cloneHTMLElement,
    setValueOnElement
} from './dom_utils';
import morphdom from 'morphdom';
import {
    normalizeAttributesForComparison
} from './normalize_attributes_for_comparison';
import Component from './Component';

export function executeMorphdom(
    rootFromElement: HTMLElement,
    rootToElement: HTMLElement,
    modifiedElements: Array<HTMLElement>,
    getElementValue: (element: HTMLElement) => any,
    childComponents: Component[],
) {
    const childComponentMap: Map<HTMLElement, Component> = new Map();
    childComponents.forEach((childComponent) => {
        childComponentMap.set(childComponent.element, childComponent);
    });

    morphdom(rootFromElement, rootToElement, {
        getNodeKey: (node: Node) => {
            if (!(node instanceof HTMLElement)) {
                return;
            }

            // TODO: abstract out to make this function agnostic of markup
            if (node.dataset.liveId) {
                return node.dataset.liveId;
            }

            // do we really need data-live-id and data-live-value-id?
            return node.dataset.liveIdValue
        },
        onBeforeElUpdated: (fromEl, toEl) => {
            if (fromEl === rootFromElement) {
                return true;
            }

            if (!(fromEl instanceof HTMLElement) || !(toEl instanceof HTMLElement)) {
                return false;
            }

            const childComponent = childComponentMap.get(fromEl) || false
            if (childComponent) {
                return childComponent.updateFromNewElement(toEl);
            }

            // if this field's value has been modified since this HTML was
            // requested, set the toEl's value to match the fromEl
            if (modifiedElements.includes(fromEl)) {
                setValueOnElement(toEl, getElementValue(fromEl))
            }

            // https://github.com/patrick-steele-idem/morphdom#can-i-make-morphdom-blaze-through-the-dom-tree-even-faster-yes
            if (fromEl.isEqualNode(toEl)) {
                // the nodes are equal, but the "value" on some might differ
                // lets try to quickly compare a bit more deeply
                const normalizedFromEl = cloneHTMLElement(fromEl);
                normalizeAttributesForComparison(normalizedFromEl);

                const normalizedToEl = cloneHTMLElement(toEl);
                normalizeAttributesForComparison(normalizedToEl);

                if (normalizedFromEl.isEqualNode(normalizedToEl)) {
                    // don't bother updating
                    return false;
                }
            }

            // look for data-live-ignore, and don't update
            return !fromEl.hasAttribute('data-live-ignore');
        },

        onBeforeNodeDiscarded(node) {
            if (!(node instanceof HTMLElement)) {
                // text element
                return true;
            }

            return !node.hasAttribute('data-live-ignore');
        }
    });
}
